import { z } from "zod";
import { api, HttpError, zDate, zUuid } from "@/lib/http";
import { sql } from "@/lib/db";
import { appUrl, createResumableSession, ensureFolder, folderFor, folderForAlbum } from "@/lib/drive";
import { kindForMime, MAX_UPLOAD_BYTES, baseMime } from "@/lib/media";

const Body = z.object({
  fileName: z.string().min(1).max(250),
  mimeType: z.string().min(3).max(120),
  size: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
  purpose: z.enum(["memory", "portrait", "cover", "story", "capsule", "logo"]).default("memory"),
  takenOn: zDate,
  albumId: zUuid.nullable().optional(),
});

export const POST = api({ level: "contributor", body: Body }, async ({ req, viewer, body }) => {
  const mime = baseMime(body.mimeType);
  const kind = kindForMime(mime);
  if (!kind) throw new HttpError(415, `“${body.fileName}” isn't a supported photo, video, audio or PDF file.`);
  if (body.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "Files can be up to 5 GB each.");
  if (body.purpose === "logo" && !viewer.isAdmin) {
    throw new HttpError(403, "Only admins can change the family logo.");
  }

  if (body.sha256) {
    const [dup] = await sql<{ id: string; fileName: string }[]>`
      select id, file_name from media where sha256 = ${body.sha256} and deleted_at is null`;
    if (dup) return { duplicate: true, mediaId: dup.id, existingName: dup.fileName };
  }

  const [up] = await sql<{ id: string }[]>`
    insert into uploads (account_id, sha256, file_name, mime_type, size_bytes, purpose)
    values (${viewer.accountId}, ${body.sha256 ?? null}, ${body.fileName}, ${mime}, ${body.size}, ${body.purpose})
    returning id`;

  // Memory uploads filed under an album go into a Drive folder named after that album;
  // everything else keeps the type/year layout (and portraits/covers their own folder).
  let albumTitle: string | null = null;
  if (body.purpose === "memory" && body.albumId) {
    const [a] = await sql<{ title: string }[]>`select title from albums where id = ${body.albumId}`;
    albumTitle = a?.title ?? null;
  }
  const year = body.takenOn ? Number(body.takenOn.slice(0, 4)) : null;
  const path = albumTitle
    ? folderForAlbum(albumTitle)
    : body.purpose === "memory" || body.purpose === "story" || body.purpose === "capsule"
    ? folderFor(kind, year)
    : [kind === "image" ? "Photos" : "Documents", "Portraits & Covers"];
  const folderId = await ensureFolder(path);
  const origin = req.headers.get("origin") ?? appUrl();
  const uploadUrl = await createResumableSession({
    name: body.fileName,
    mimeType: mime,
    size: body.size,
    folderId,
    origin,
    appProperties: { hirayaUpload: up!.id, hirayaPurpose: body.purpose },
  });
  return { uploadId: up!.id, uploadUrl };
});
