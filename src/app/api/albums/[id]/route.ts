import { z } from "zod";
import { api, HttpError, zDate, zText, zUuid } from "@/lib/http";
import { sql } from "@/lib/db";
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
  // Photos stay in the garden; only the album grouping is removed.
  const [a] = await sql<{ title: string }[]>`delete from albums where id = ${params.id!} returning title`;
  if (!a) throw new HttpError(404, "Album not found.");
  await logActivity({ accountId: viewer.accountId, action: "album.deleted", entityType: "album", entityId: params.id, summary: `Removed album “${a.title}” (photos kept)` });
  return { ok: true };
});
