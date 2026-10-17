import { api, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { StoryInput } from "@/lib/story-input";
import { logActivity } from "@/lib/activity";
import type { Viewer } from "@/lib/session";

async function assertCanEdit(id: string, viewer: Viewer) {
  const [s] = await sql<{ authorId: string | null; title: string }[]>`select author_id, title from stories where id = ${id}`;
  if (!s) throw new HttpError(404, "Story not found.");
  if (!viewer.canEditTree && s.authorId !== viewer.accountId) throw new HttpError(403, "Only the author, editors or admins can change this story.");
  return s;
}

export const PATCH = api({ level: "contributor", body: StoryInput }, async ({ viewer, body, params }) => {
  const id = params.id!;
  await assertCanEdit(id, viewer);
  await sql.begin(async (tx) => {
    await tx`update stories set title = ${body.title}, kind = ${body.kind}, body = ${body.body}, story_date = ${body.storyDate},
             cover_media_id = ${body.coverMediaId ?? null}, updated_at = now() where id = ${id}`;
    await tx`delete from story_people where story_id = ${id}`;
    await tx`delete from story_media where story_id = ${id}`;
    if (body.people.length) await tx`insert into story_people ${tx(body.people.map((p) => ({ storyId: id, personId: p })))} on conflict do nothing`;
    if (body.media.length) await tx`insert into story_media ${tx(body.media.map((m, i) => ({ storyId: id, mediaId: m, position: i })))} on conflict do nothing`;
  });
  await logActivity({ accountId: viewer.accountId, action: "story.updated", entityType: "story", entityId: id, summary: `Edited “${body.title}”` });
  return { ok: true };
});

export const DELETE = api({ level: "contributor" }, async ({ viewer, params }) => {
  const s = await assertCanEdit(params.id!, viewer);
  await sql`delete from stories where id = ${params.id!}`;
  await logActivity({ accountId: viewer.accountId, action: "story.deleted", entityType: "story", entityId: params.id, summary: `Removed the story “${s.title}”` });
  return { ok: true };
});
