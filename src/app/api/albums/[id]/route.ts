import { revalidatePath } from "next/cache";
import { z } from "zod";
import { api, HttpError, zDate, zText, zUuid } from "@/lib/http";
import { sql } from "@/lib/db";
import { trashFile } from "@/lib/drive";
import { logActivity } from "@/lib/activity";

export const PATCH = api(
  { level: "editor", body: z.object({ title: z.string().trim().min(1).max(120), description: zText(1000), eventDate: zDate, coverMediaId: zUuid.nullable().optional() }) },
  async ({ viewer, body, params }) => {
    const r = await sql`update albums set title = ${body.title}, description = ${body.description}, event_date = ${body.eventDate},
                        cover_media_id = ${body.coverMediaId ?? null} where id = ${params.id!} returning id`;
    if (!r.length) throw new HttpError(404, "Album not found.");
    await logActivity({ accountId: viewer.accountId, action: "album.updated", entityType: "album", entityId: params.id, summary: `Edited album “${body.title}”` });
    return { ok: true };
  },
);

export const DELETE = api({ level: "editor" }, async ({ viewer, params }) => {
  const id = params.id!;
  const [a] = await sql<{ title: string }[]>`select title from albums where id = ${id}`;
  if (!a) throw new HttpError(404, "Album not found.");
  // Remove the album and its memories together, so nothing lingers in the garden.
  const media = await sql<{ id: string; driveFileId: string }[]>`
    select id, drive_file_id from media where album_id = ${id} and deleted_at is null`;
  await sql.begin(async (tx) => {
    await tx`update media set deleted_at = now() where album_id = ${id} and deleted_at is null`;
    await tx`delete from albums where id = ${id}`;
    // If the featured photo lived in this album, stop featuring it.
    if (media.length) {
      await tx`update settings set value = 'null'::jsonb, updated_at = now()
               where key = 'featured_media_id' and (value #>> '{}') = any(${media.map((m) => m.id)})`;
    }
  });
  // Originals move to Drive's trash (recoverable for 30 days) — never hard-deleted by the app.
  for (const m of media) await trashFile(m.driveFileId).catch((e) => console.error("[album] trash failed", e));
  const n = media.length;
  await logActivity({
    accountId: viewer.accountId, action: "album.deleted", entityType: "album", entityId: id,
    summary: `Removed album “${a.title}” and ${n} ${n === 1 ? "memory" : "memories"} (moved to Drive trash)`,
  });
  revalidatePath("/home");
  revalidatePath("/memories");
  return { ok: true, removed: n };
});
