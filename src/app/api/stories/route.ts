import { api } from "@/lib/http";
import { sql } from "@/lib/db";
import { StoryInput } from "@/lib/story-input";
import { logActivity } from "@/lib/activity";

export const POST = api({ level: "contributor", body: StoryInput }, async ({ viewer, body }) => {
  const id = await sql.begin(async (tx) => {
    const [s] = await tx<{ id: string }[]>`
      insert into stories (title, kind, body, story_date, cover_media_id, author_id)
      values (${body.title}, ${body.kind}, ${body.body}, ${body.storyDate}, ${body.coverMediaId ?? null}, ${viewer.accountId})
      returning id`;
    if (body.people.length) await tx`insert into story_people ${tx(body.people.map((p) => ({ storyId: s!.id, personId: p })))} on conflict do nothing`;
    if (body.media.length) await tx`insert into story_media ${tx(body.media.map((m, i) => ({ storyId: s!.id, mediaId: m, position: i })))} on conflict do nothing`;
    return s!.id;
  });
  await logActivity({ accountId: viewer.accountId, action: "story.created", entityType: "story", entityId: id, summary: `Wrote “${body.title}”` });
  return { id };
});
