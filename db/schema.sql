-- ============================================================================
-- Hiraya — Where Family Stories Live Forever
-- PostgreSQL schema (works on Supabase, Neon, RDS or any Postgres 14+).
-- Idempotent: safe to run more than once. Applied by `npm run db:migrate`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Family-wide settings (single family per deployment)
-- ---------------------------------------------------------------------------
create table if not exists settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

insert into settings (key, value) values
  ('family_name',            '"Our Family"'),
  ('family_motto',           '"Every branch tells a story. Every memory keeps us together."'),
  ('logo_media_id',          'null'),
  ('featured_media_id',      'null'),
  ('viewers_can_contribute', 'true'),
  ('members_can_download',   'true'),
  ('root_person_id',         'null')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- People in the family tree
-- ---------------------------------------------------------------------------
create table if not exists persons (
  id               uuid primary key default gen_random_uuid(),
  first_name       text not null check (length(first_name) between 1 and 120),
  middle_name      text,
  last_name        text,
  maiden_name      text,
  nickname         text,
  gender           text not null default 'unknown' check (gender in ('female','male','other','unknown')),
  birth_date       date,
  birth_date_precision text not null default 'day' check (birth_date_precision in ('day','month','year')),
  birth_place      text,
  is_deceased      boolean not null default false,
  death_date       date,
  death_date_precision text not null default 'day' check (death_date_precision in ('day','month','year')),
  death_place      text,
  resting_place    text,
  occupation       text,
  hobbies          text,
  achievements     text,
  biography        text,
  memorial_message text,
  -- Portrait: media item + non-destructive crop (percentages of the original) + frame style
  photo_media_id   uuid,
  photo_crop       jsonb,               -- {x,y,width,height} in % of the original image
  photo_frame      text not null default 'round' check (photo_frame in ('round','storybook','leaf','polaroid','oval')),
  cover_media_id   uuid,
  -- Private details: only admins and the person themself can see these
  sensitive        jsonb not null default '{}'::jsonb,  -- {phone,email,address,notes}
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index if not exists persons_name_idx on persons (lower(first_name), lower(coalesce(last_name,'')));

-- Parent → child links (supports biological, adoptive, step, foster, guardian)
create table if not exists parent_child (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid not null references persons(id) on delete cascade,
  child_id    uuid not null references persons(id) on delete cascade,
  kind        text not null default 'biological' check (kind in ('biological','adopted','step','foster','guardian')),
  created_at  timestamptz not null default now(),
  unique (parent_id, child_id),
  check (parent_id <> child_id)
);
create index if not exists parent_child_child_idx on parent_child (child_id);

-- Partnerships (marriages, partners; multiple per person, past and present)
create table if not exists partnerships (
  id          uuid primary key default gen_random_uuid(),
  person_a    uuid not null references persons(id) on delete cascade,
  person_b    uuid not null references persons(id) on delete cascade,
  kind        text not null default 'married' check (kind in ('married','partner','engaged')),
  status      text not null default 'current' check (status in ('current','divorced','separated','widowed')),
  start_date  date,
  end_date    date,
  place       text,
  created_at  timestamptz not null default now(),
  check (person_a <> person_b)
);
create unique index if not exists partnerships_pair_idx
  on partnerships (least(person_a, person_b), greatest(person_a, person_b), coalesce(start_date, '0001-01-01'));

-- ---------------------------------------------------------------------------
-- Accounts, authentication and sessions
-- ---------------------------------------------------------------------------
create table if not exists accounts (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid unique references persons(id) on delete set null,
  display_name       text not null,
  login_name         text not null,                        -- the "registered name" members type
  login_name_norm    text not null unique,                 -- normalized for lookup
  role               text not null default 'viewer' check (role in ('admin','editor','viewer')),
  status             text not null default 'active' check (status in ('active','suspended')),
  -- Admin-grade credentials (required before admin powers activate)
  email              text unique,
  password_hash      text,
  totp_secret_enc    text,
  totp_pending_enc   text,
  totp_enabled       boolean not null default false,
  totp_last_counter  bigint not null default 0,
  -- New-device identity check (question agreed with the member in person)
  verify_question    text,
  verify_answer_hash text,
  calendar_token_hash text unique,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  last_login_at      timestamptz
);

-- One-time 6-digit codes. Only an HMAC of the code is stored.
create table if not exists access_codes (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  code_hash   text not null,
  created_by  uuid references accounts(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  attempts    int not null default 0,
  used_at     timestamptz,
  revoked_at  timestamptz
);
create index if not exists access_codes_account_idx on access_codes (account_id, created_at desc);

-- Known devices per account (random device id kept in a long-lived cookie; only its hash is stored)
create table if not exists devices (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  device_hash text not null,
  label       text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  unique (account_id, device_hash)
);

-- Pending login waiting for the new-device identity answer
create table if not exists login_challenges (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  account_id  uuid not null references accounts(id) on delete cascade,
  device_hash text not null,
  attempts    int not null default 0,
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create table if not exists sessions (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  token_hash   text not null unique,
  auth_level   text not null check (auth_level in ('code','strong')),
  device_hash  text,
  user_agent   text,
  ip           text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz
);
create index if not exists sessions_account_idx on sessions (account_id);

-- Failed-attempt tracking for throttling (per IP / per account)
create table if not exists auth_failures (
  id          bigserial primary key,
  scope       text not null,          -- 'ip:<addr>' or 'acct:<id>' or 'admin:<email>'
  created_at  timestamptz not null default now()
);
create index if not exists auth_failures_scope_idx on auth_failures (scope, created_at desc);

-- "Knock on the gate": people asking the admin for access
create table if not exists access_requests (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  relationship text,
  contact      text,
  message      text,
  ip           text,
  status       text not null default 'pending' check (status in ('pending','approved','declined')),
  handled_by   uuid references accounts(id) on delete set null,
  handled_at   timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Google Drive connection (single row) and media archive
-- ---------------------------------------------------------------------------
create table if not exists drive_connection (
  id                smallint primary key default 1 check (id = 1),
  google_email      text,
  refresh_token_enc text not null,
  root_folder_id    text,
  folder_cache      jsonb not null default '{}'::jsonb,
  status            text not null default 'ok' check (status in ('ok','broken')),
  connected_by      uuid references accounts(id) on delete set null,
  connected_at      timestamptz not null default now()
);

create table if not exists albums (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  event_date     date,
  cover_media_id uuid,
  created_by     uuid references accounts(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table if not exists media (
  id             uuid primary key default gen_random_uuid(),
  drive_file_id  text not null unique,
  kind           text not null check (kind in ('image','video','audio','document')),
  mime_type      text not null,
  file_name      text not null,
  size_bytes     bigint not null default 0,
  sha256         text unique,
  md5            text,
  width          int,
  height         int,
  title          text,
  caption        text,
  taken_on       date,
  location       text,
  album_id       uuid references albums(id) on delete set null,
  purpose        text not null default 'memory' check (purpose in ('memory','portrait','cover','story','capsule','logo','backup')),
  uploaded_by    uuid references accounts(id) on delete set null,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index if not exists media_album_idx on media (album_id) where deleted_at is null;
create index if not exists media_taken_idx on media (taken_on) where deleted_at is null;

create table if not exists media_people (
  media_id  uuid not null references media(id) on delete cascade,
  person_id uuid not null references persons(id) on delete cascade,
  primary key (media_id, person_id)
);

-- Upload sessions issued to the browser (ties a Drive upload to an account)
create table if not exists uploads (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  sha256      text,
  file_name   text not null,
  mime_type   text not null,
  size_bytes  bigint not null,
  purpose     text not null default 'memory',
  created_at  timestamptz not null default now(),
  completed_at timestamptz,
  media_id    uuid references media(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Heritage: timeline events, stories, time capsules, greetings
-- ---------------------------------------------------------------------------
create table if not exists events (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  kind           text not null default 'milestone'
                   check (kind in ('milestone','reunion','achievement','historical','celebration','memorial','custom')),
  event_date     date not null,
  date_precision text not null default 'day' check (date_precision in ('day','month','year')),
  location       text,
  recurring      boolean not null default false,   -- shows every year on the calendar
  media_id       uuid references media(id) on delete set null,
  created_by     uuid references accounts(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists events_date_idx on events (event_date);

create table if not exists event_people (
  event_id  uuid not null references events(id) on delete cascade,
  person_id uuid not null references persons(id) on delete cascade,
  primary key (event_id, person_id)
);

create table if not exists stories (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  kind           text not null default 'story'
                   check (kind in ('story','memory','recipe','tradition','letter','interview','lesson')),
  body           text not null default '',
  story_date     date,
  cover_media_id uuid references media(id) on delete set null,
  author_id      uuid references accounts(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists story_people (
  story_id  uuid not null references stories(id) on delete cascade,
  person_id uuid not null references persons(id) on delete cascade,
  primary key (story_id, person_id)
);

create table if not exists story_media (
  story_id  uuid not null references stories(id) on delete cascade,
  media_id  uuid not null references media(id) on delete cascade,
  position  int not null default 0,
  primary key (story_id, media_id)
);

create table if not exists time_capsules (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  message     text not null,
  unlock_at   timestamptz not null,
  audience    text not null default 'family' check (audience in ('family','people')),
  author_id   uuid references accounts(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists capsule_recipients (
  capsule_id uuid not null references time_capsules(id) on delete cascade,
  person_id  uuid not null references persons(id) on delete cascade,
  primary key (capsule_id, person_id)
);

create table if not exists capsule_media (
  capsule_id uuid not null references time_capsules(id) on delete cascade,
  media_id   uuid not null references media(id) on delete cascade,
  primary key (capsule_id, media_id)
);

create table if not exists greetings (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references persons(id) on delete cascade,
  author_id   uuid references accounts(id) on delete set null,
  occasion    text not null default 'birthday' check (occasion in ('birthday','anniversary','memorial','congrats')),
  year        int not null,
  message     text not null,
  card_style  text not null default 'meadow' check (card_style in ('meadow','lantern','sunflower','starlight')),
  created_at  timestamptz not null default now()
);
create index if not exists greetings_person_idx on greetings (person_id, year desc);

-- ---------------------------------------------------------------------------
-- Activity log (who changed what) — reviewed in the admin dashboard
-- ---------------------------------------------------------------------------
create table if not exists activity_log (
  id          bigserial primary key,
  account_id  uuid references accounts(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   text,
  summary     text,
  details     jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);
create index if not exists activity_log_created_idx on activity_log (created_at desc);

-- Late-bound foreign keys (persons → media) added after media exists
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'persons_photo_media_fk') then
    alter table persons add constraint persons_photo_media_fk foreign key (photo_media_id) references media(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'persons_cover_media_fk') then
    alter table persons add constraint persons_cover_media_fk foreign key (cover_media_id) references media(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'albums_cover_media_fk') then
    alter table albums add constraint albums_cover_media_fk foreign key (cover_media_id) references media(id) on delete set null;
  end if;
end $$;

-- Supabase: this app connects with a server-side connection string only.
-- Enable RLS with no policies so the anon/public API keys can never read family data.
alter table settings          enable row level security;
alter table persons           enable row level security;
alter table parent_child      enable row level security;
alter table partnerships      enable row level security;
alter table accounts          enable row level security;
alter table access_codes      enable row level security;
alter table devices           enable row level security;
alter table login_challenges  enable row level security;
alter table sessions          enable row level security;
alter table auth_failures     enable row level security;
alter table access_requests   enable row level security;
alter table drive_connection  enable row level security;
alter table albums            enable row level security;
alter table media             enable row level security;
alter table media_people      enable row level security;
alter table uploads           enable row level security;
alter table events            enable row level security;
alter table event_people      enable row level security;
alter table stories           enable row level security;
alter table story_people      enable row level security;
alter table story_media       enable row level security;
alter table time_capsules     enable row level security;
alter table capsule_recipients enable row level security;
alter table capsule_media     enable row level security;
alter table greetings         enable row level security;
alter table activity_log      enable row level security;
