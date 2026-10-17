import "server-only";
import { sql } from "./db";
import type { MediaItem } from "./types";

export const STORY_KINDS = ["story", "memory", "recipe", "tradition", "letter", "interview", "lesson"] as const;

export type StorySummary = {
  id: string; title: string; kind: string; body: string; storyDate: string | null; coverMediaId: string | null;
  authorId: string | null; authorName: string | null; createdAt: string; people: string[]; mediaCount: number;
};

export function listStories() {
  return sql<StorySummary[]>`
    select s.id, s.title, s.kind, left(s.body, 400) as body, s.story_date, s.cover_media_id, s.author_id, a.display_name as author_name, s.created_at,
      coalesce((select array_agg(sp.person_id::text) from story_people sp where sp.story_id = s.id), '{}') as people,
      (select count(*)::int from story_media sm where sm.story_id = s.id) as media_count
    from stories s left join accounts a on a.id = s.author_id
    order by s.created_at desc`;
}

export async function getStory(id: string) {
  const [s] = await sql<(StorySummary & { updatedAt: string })[]>`
    select s.id, s.title, s.kind, s.body, s.story_date, s.cover_media_id, s.author_id, a.display_name as author_name, s.created_at, s.updated_at,
      coalesce((select array_agg(sp.person_id::text) from story_people sp where sp.story_id = s.id), '{}') as people, 0 as media_count
    from stories s left join accounts a on a.id = s.author_id where s.id = ${id}`;
  if (!s) return null;
  const media = await sql<MediaItem[]>`
    select m.*, '{}'::text[] as people from story_media sm join media m on m.id = sm.media_id
    where sm.story_id = ${id} and m.deleted_at is null order by sm.position`;
  return { ...s, media };
}
