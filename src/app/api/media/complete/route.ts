import { z } from "zod";
import { api, HttpError, zDate, zText, zUuid } from "@/lib/http";
import { sql } from "@/lib/db";
import { getFile, trashFile } from "@/lib/drive";
import { baseMime, exifDate, kindForMime } from "@/lib/media";
import { logActivity } from "@/lib/activity";

const Body = z.object({
  uploadId: zUuid,
  driveFileId: z.string().min(10).max(200).regex(/^[A-Za-z0-9_-]+$/),
  title: zText(200),
  caption: zText(4000),
  takenOn: zDate,
  location: zText(200),
  albumId: zUuid.nullable().optional(),
  people: z.array(zUuid).max(100).optional(),
});

export const POST = api({ level: "contributor", body: Body }, async ({ viewer, body }) => {
  const [up] = await sql<{ id: string; sha256: string | null; fileName: string; mimeType: string; purpose: string; completedAt: string | null; mediaId: string | null }[]>`
    select id, sha256, file_name, mime_type, purpose, completed_at, media_id from uploads
    where id = ${body.uploadId} and account_id = ${viewer.accountId} and created_at > now() - interval '7 days'`;
  if (!up) throw new HttpError(404, "Upload not found or expired.");
  if (up.completedAt && up.mediaId) return { mediaId: up.mediaId };

  // Verify with Google that this file really came from this upload session.
  const f = await getFile(body.driveFileId);
  if (f.appProperties?.hirayaUpload !== up.id || f.trashed) throw new HttpError(400, "That file doesn't match this upload.");
  const mime = baseMime(f.mimeType || up.mimeType);
  const kind = kindForMime(mime);
  if (!kind) {
    await trashFile(f.id).catch(() => {});
    throw new HttpError(415, "Unsupported file type.");
  }

  // Server-side duplicate check using Google's own checksum.
  if (f.md5Checksum) {
    const [dup] = await sql<{ id: string }[]>`
      select id from media where md5 = ${f.md5Checksum} and size_bytes = ${Number(f.size ?? 0)} and deleted_at is null limit 1`;
    if (dup) {
      await trashFile(f.id).catch(() => {});
      await sql`update uploads set completed_at = now(), media_id = ${dup.id} where id = ${up.id}`;
      return { mediaId: dup.id, duplicate: true };
    }
  }

  const meta = f.imageMediaMetadata ?? f.videoMediaMetadata;
  const takenOn = body.takenOn ?? exifDate(f.imageMediaMetadata?.time);
  const mediaId = await sql.begin(async (tx) => {
    const [m] = await tx<{ id: string }[]>`
      insert into media (drive_file_id, kind, mime_type, file_name, size_bytes, sha256, md5, width, height,
                         title, caption, taken_on, location, album_id, purpose, uploaded_by)
      values (${f.id}, ${kind}, ${mime}, ${f.name || up.fileName}, ${Number(f.size ?? 0)}, ${up.sha256}, ${f.md5Checksum ?? null},
              ${meta?.width ?? null}, ${meta?.height ?? null}, ${body.title}, ${body.caption}, ${takenOn}, ${body.location},
              ${body.albumId ?? null}, ${up.purpose}, ${viewer.accountId})
      returning id`;
    if (body.people?.length) {
      await tx`insert into media_people ${tx(body.people.map((p) => ({ mediaId: m!.id, personId: p })))} on conflict do nothing`;
    }
    await tx`update uploads set completed_at = now(), media_id = ${m!.id} where id = ${up.id}`;
    return m!.id;
  });
  if (up.purpose === "memory") {
    await logActivity({ accountId: viewer.accountId, action: "media.uploaded", entityType: "media", entityId: mediaId, summary: `Added “${f.name}”` });
  }
  return { mediaId };
});
