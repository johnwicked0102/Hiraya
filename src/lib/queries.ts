import "server-only";
import { sql } from "./db";
import type { Album, MediaItem } from "./types";

export async function listMedia(sp: URLSearchParams, accountId: string) {
  const album = sp.get("album");
  const person = sp.get("person");
  const kind = sp.get("kind");
  const year = Number(sp.get("year") ?? 0);
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  const limit = Math.min(Number(sp.get("limit") ?? 60), 200);
  const offset = Math.max(Number(sp.get("offset") ?? 0), 0);
  const uuid = /^[0-9a-f-]{36}$/i;

  const items = await sql<MediaItem[]>`
    select m.id, m.kind, m.mime_type, m.file_name, m.size_bytes, m.width, m.height, m.title, m.caption, m.taken_on,
           m.location, m.album_id, m.purpose, m.uploaded_by, m.created_at, a.display_name as uploader_name,
           coalesce((select array_agg(mp.person_id::text) from media_people mp where mp.media_id = m.id), '{}') as people
    from media m
    left join accounts a on a.id = m.uploaded_by
    where m.deleted_at is null
      and m.purpose in ('memory', 'story')
      and not exists (select 1 from capsule_media cm join time_capsules t on t.id = cm.capsule_id
                      where cm.media_id = m.id and t.unlock_at > now() and t.author_id is distinct from ${accountId})
      ${album && uuid.test(album) ? sql`and m.album_id = ${album}` : sql``}
      ${person && uuid.test(person) ? sql`and exists (select 1 from media_people mp where mp.media_id = m.id and mp.person_id = ${person})` : sql``}
      ${kind && ["image", "video", "audio", "document"].includes(kind) ? sql`and m.kind = ${kind}` : sql``}
      ${year > 1000 ? sql`and extract(year from coalesce(m.taken_on, m.created_at::date)) = ${year}` : sql``}
      ${q ? sql`and (m.title ilike ${"%" + q + "%"} or m.caption ilike ${"%" + q + "%"} or m.location ilike ${"%" + q + "%"} or m.file_name ilike ${"%" + q + "%"})` : sql``}
    order by coalesce(m.taken_on, m.created_at::date) desc, m.created_at desc
    limit ${limit + 1} offset ${offset}`;
  return { items: items.slice(0, limit), hasMore: items.length > limit };
}

export function listAlbums() {
  return sql<Album[]>`
    select al.id, al.title, al.description, al.event_date,
      coalesce(al.cover_media_id, (select m.id from media m where m.album_id = al.id and m.kind = 'image' and m.deleted_at is null order by m.created_at limit 1)) as cover_media_id,
      (select count(*)::int from media m where m.album_id = al.id and m.deleted_at is null) as media_count
    from albums al order by al.event_date desc nulls last, al.created_at desc`;
}

