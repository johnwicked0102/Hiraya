# Hiraya — Where Family Stories Live Forever

A private, installable family-heritage web app: an interactive family tree with customizable portraits, a Google Drive–backed memory archive, and simple admin-controlled sign-in for every generation.

Built with Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Motion · React Flow · PostgreSQL (Supabase-ready) · Google Drive API.

---

## What's inside

| Area | Highlights |
|---|---|
| **Family gate (sign-in)** | Admin registers a member → generates a **6-digit code valid for exactly 3 minutes**, single-use, bound to that account, max **5 attempts** → shares it on Messenger/Viber/SMS from the dashboard. Members type their registered name + code. **New devices must also answer a security question** agreed in person (names alone never prove identity). Sessions last up to **30 days**, revocable any time. |
| **Administrator security** | Admin powers require **email + strong password + authenticator app (TOTP)**, with replay protection, lockout after 5 failures, and 12-hour sessions. A promoted admin can't activate admin powers without a fresh code from another admin. |
| **Family tree** | React Flow + dagre layout; unlimited generations; marriages, multiple partners, divorce/widowed, adoption/step/foster/guardian links; pan/zoom/fold branches; search; views for *whole family / ancestors / descendants / mother's side / father's side*; cycle protection; PNG and PDF export; spring "branch-growth" animations. |
| **Portraits** | Upload or pick from the Memory Garden, crop/zoom/reposition, five storybook frames — saved as a crop rectangle so **the original photo is never altered**. |
| **Profiles** | Names, nickname, maiden name, birth/death with day/month/year precision, places, occupation, hobbies, achievements, life story, relatives, tagged memories, life events, greeting cards. Respectful **memorial design** for those who've passed. **Private details** (phone, email, address, notes) visible only to admins and the person themself. |
| **Google Drive** | Admin connects once with OAuth using the narrow `drive.file` scope (Hiraya sees only its own folder). Files upload **straight from the browser to Drive** in resumable 8 MiB chunks — originals, uncompressed, up to 5 GB, with progress, retry and resume. Server verifies every upload with Google, de-duplicates (SHA-256 + Drive MD5), auto-files into `Hiraya Family Archive / Photos / 2026`. Media is streamed through Hiraya after a permission check (with Range support for video seeking) — **Drive files are never shared publicly**. Refresh token encrypted with AES-256-GCM. |
| **Memory Garden** | Scrapbook grid, albums, full-screen viewer with swipe/keys, video & audio playback, slideshow, people tagging, search and filters (person, year, type), downloads (switchable). |
| **Timeline** | Births, marriages, remembrances, milestones, reunions, dated stories and albums, grouped by decade; filter by person, generation and type. |
| **Stories & legacy** | Stories, memories of ancestors, recipes, traditions, letters, interviews and messages to the future; attach scans; **record voice or video interviews in the browser**. |
| **Time capsules** | Seal messages and files until a chosen date — hidden from everyone (admins included, and even in exports) until they open. |
| **Celebrations** | Month calendar + upcoming list of birthdays, anniversaries, remembrance days and events; greeting cards; **private calendar subscription link** (Google/Apple/Outlook) with reminders the evening before. |
| **Admin dashboard** | Members & roles (admin / editor / viewer), codes, access requests ("knock on the gate"), suspend/revoke sessions/forget devices, Drive connection & storage, activity log with change review, family settings, logo, featured photo. |
| **Preservation** | Download a full JSON archive, **GEDCOM 5.5.1** (opens in Ancestry, FamilySearch, MyHeritage, Gramps…), a CSV of every media file; one-click backup into Drive; merge-safe import; `npm run backup` downloads the database **and every original file** to any computer. |
| **Experience** | Original hand-drawn-style countryside scenery, drifting clouds, falling leaves, butterflies, fireflies at night; light/dark ("day/night"), **reduced-motion** and **larger-text** settings; large tap targets and a bottom nav on phones; installable PWA with offline page. |

---

## Quick start (local)

Requirements: Node.js 20+ and a PostgreSQL 14+ database (a free Supabase project works).

```bash
npm install
cp .env.example .env.local          # then fill in the values (see below)
npm run db:migrate                  # creates the tables (safe to re-run)
# optional: npm run db:seed-demo    # adds a small fictional demo family
npm run dev
```

Open http://localhost:3000/setup, enter your `SETUP_TOKEN`, create the first administrator, and scan the QR code with an authenticator app. Then in **Admin → Google Drive** connect the family archive account and start registering relatives.

### Environment variables

| Variable | Purpose |
|---|---|
| `APP_URL` | Public URL, e.g. `https://hiraya-santos.vercel.app` (no trailing slash) |
| `DATABASE_URL` | Postgres connection string. On Supabase use the **Transaction pooler** URI (port 6543). |
| `DATABASE_SSL` | `require` (default) — set `disable` only for a local Postgres without TLS |
| `AUTH_SECRET` | 32+ random chars — keys the code hashes. `openssl rand -base64 48` |
| `ENCRYPTION_KEY` | 32+ random chars, different from above — encrypts the Drive token, TOTP secrets and sealed capsules in exports. **Back it up**; without it the Drive connection and sealed exports can't be decrypted. |
| `SETUP_TOKEN` | One-time password that unlocks `/setup` until the first admin finishes |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client (below) |
| `DRIVE_ROOT_FOLDER_NAME` | Optional, default `Hiraya Family Archive` |
| `FAMILY_TIMEZONE` | Optional, default `Asia/Manila` (greetings and "today" on the calendar) |

---

## Deploying to Vercel

1. **Database** — create a Supabase project → *Project Settings → Database → Connection string → Transaction pooler*. Run the schema once, either `DATABASE_URL=... npm run db:migrate` from your computer or paste `db/schema.sql` into Supabase's SQL editor. (The schema enables Row-Level Security with no policies, so Supabase's public API keys can never read family data; the app connects server-side only.)
2. **Google Cloud** — at console.cloud.google.com create a project →
   - *APIs & Services → Library →* enable **Google Drive API**.
   - *OAuth consent screen →* External, app name "Hiraya", add scopes `openid`, `email`, `.../auth/drive.file`. Add the admin's Google account as a test user, or **Publish** the app (the `drive.file` scope is non-sensitive, so verification is light).
   - *Credentials → Create OAuth client ID → Web application.* Authorized redirect URI: `https://YOUR-DOMAIN/api/drive/callback` (add `http://localhost:3000/api/drive/callback` for local dev).
3. **Vercel** — import the repository, add every environment variable above for *Production*, deploy. HTTPS is automatic.
4. Visit `https://YOUR-DOMAIN/setup`, create the administrator, connect Google Drive, register the family.
5. Tip: on phones, open the site and choose *Add to Home Screen* — Hiraya installs like an app.

Upload limits on Vercel don't apply to media: the browser sends files directly to Google's resumable endpoint; the server only issues and verifies the upload session.

---

## Everyday use

**Inviting a relative:** Admin → Members → *Register a family member* (sign-in name, role, linked tree profile, security question you agree on together) → *Send code* → share the message. The code works for 3 minutes, once.

**Roles:** *Viewer* explores and (if enabled in Family settings) shares memories, stories, events, cards and capsules. *Editor* also edits the tree and anyone's profile. *Admin* manages people, access, Drive and backups. Everyone can edit their own linked profile.

**Lost phone / forgotten admin password:** another admin can sign the person out everywhere. For admin recovery run `node scripts/reset-admin.mjs admin@email` with the production `DATABASE_URL`, then re-enroll via `/setup` (same email) or *My settings*.

---

## Backups & long-term preservation

- **Admin → Backup & export**: JSON archive, GEDCOM family tree, CSV media list, or *Back up now* to the Drive `Backups` folder.
- **Full offline copy:** `npm run backup [folder]` on any computer with `.env.local` filled in — saves the database and downloads every original file (re-runs only fetch new files).
- **Moving providers:** create a new database, run migrations, import the JSON archive (merge-safe), reconnect Drive with the same Google account. If you ever change Google accounts, move the *Hiraya Family Archive* folder to the new account and use the CSV to re-link files.
- Also enable your database provider's daily backups (Supabase does this on paid plans; free plans: use `npm run backup` on a schedule).

---

## Security model (summary)

- Sessions: random 256-bit tokens in `HttpOnly`, `Secure`, `SameSite=Lax` cookies; only SHA-256 hashes stored; server-checked on every request; revocable.
- Codes: 6 digits from a CSPRNG, HMAC-SHA256 hashed with `AUTH_SECRET`, account-bound, 180 s, single-use, 5 attempts, plus per-IP throttling and identical error messages for unknown names.
- New devices: long-lived random device cookie; unknown devices must answer the bcrypt-hashed security question (5 tries).
- Admins: bcrypt (cost 12) password policy + RFC 6238 TOTP with replay protection and lockouts; admin rights only in a "strong" session.
- Requests: same-origin checks on all state-changing APIs, strict CSP, HSTS, `X-Frame-Options: DENY`, `noindex`, Zod validation on every input.
- Data: private details filtered server-side; sealed capsules filtered server-side and encrypted in exports; activity log for every change; media served only to signed-in members, with safe content types (no SVG/HTML uploads).

---

## Project layout

```
db/schema.sql            Postgres schema (idempotent)          db/seed-demo.sql   demo family
scripts/                 migrate · backup · reset-admin
src/app/login            the countryside gate                  src/app/setup      first-run wizard
src/app/(family)/        home · tree · people/[id] · memories · timeline · stories · capsules · calendar · admin · account
src/app/api/             auth · admin · persons · relationships · media · albums · events · stories · capsules · greetings · drive · calendar
src/lib/                 db · session · auth · totp · crypto · drive · archive (JSON/GEDCOM) · celebrations · timeline
src/components/          tree (layout + nodes) · people (portrait editor, profile form) · media (uploader, gallery) · heritage · scene (scenery & ambient motion) · ui
```

Scripts: `npm run dev | build | start | typecheck | db:migrate | db:seed-demo | backup | admin:reset`.

All artwork is original SVG drawn for Hiraya, inspired by the feeling of hand-painted countryside films — no third-party characters or film imagery.
