import { z } from "zod";
import { api, HttpError, zDate, zText, zUuid } from "@/lib/http";
import { sql } from "@/lib/db";
import { trashFile } from "@/lib/drive";
import { logActivity } from "@/lib/activity";
import type { Viewer } from "@/lib/session";

async function loadOwned(id: string, viewer: Viewer) {
  const [m] = await sql<{ id: string; uploadedBy: string | null; driveFileId: string; fileName: string }[]>`
    select id, uploaded_by, drive_file_id, file_name from media where id = ${id} and deleted_at is null`;
  if (!m) throw new HttpError(404, "Memory not found.");
  if (!viewer.canEditTree && m.uploadedBy !== viewer.accountId) throw new HttpError(403, "Only the person who shared this memory, editors or admins can change it.");
  return m;
}

const Patch = z.object({
  title: zText(200),
  caption: zText(4000),
  takenOn: zDate,
  location: zText(200),
  albumId: zUuid.nullable().optional(),
  people: z.array(zUuid).max(100).optional(),
});

export const PATCH = api({ level: "contributor", body: Patch }, async ({ viewer, body, params }) => {
  const m = await loadOwned(params.id!, viewer);
  await sql.begin(async (tx) => {
    await tx`update media set title = ${body.title}, caption = ${body.caption}, taken_on = ${body.takenOn},
             location = ${body.location}, album_id = ${body.albumId ?? null} where id = ${m.id}`;
    if (body.people) {
      await tx`delete from media_people where media_id = ${m.id}`;
      if (body.people.length) await tx`insert into media_people ${tx(body.people.map((p) => ({ mediaId: m.id, personId: p })))} on conflict do nothing`;
    }
  });
  await logActivity({ accountId: viewer.accountId, action: "media.updated", entityType: "media", entityId: m.id, summary: `Edited “${body.title ?? m.fileName}”` });
  return { ok: true };
});

export const DELETE = api({ level: "contributor" }, async ({ viewer, params }) => {
  const m = await loadOwned(params.id!, viewer);
  await sql`update media set deleted_at = now() where id = ${m.id}`;
  // Moved to Drive's trash (recoverable for 30 days) — never permanently deleted by the app.
  await trashFile(m.driveFileId).catch((e) => console.error("[media] trash failed", e));
  await logActivity({ accountId: viewer.accountId, action: "media.removed", entityType: "media", entityId: m.id, summary: `Removed “${m.fileName}” (moved to Drive trash)` });
  return { ok: true };
});
