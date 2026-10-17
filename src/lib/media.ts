import "server-only";
import { sql } from "./db";
import type { MediaKind } from "./types";

export const MAX_UPLOAD_BYTES = 5 * 1024 ** 3; // 5 GB per file

// Only formats that are safe to serve from our origin. (No SVG/HTML: they can carry scripts.)
const ALLOWED: Record<string, MediaKind> = {
  "image/jpeg": "image", "image/png": "image", "image/gif": "image", "image/webp": "image",
  "image/heic": "image", "image/heif": "image", "image/avif": "image", "image/tiff": "image", "image/bmp": "image",
  "video/mp4": "video", "video/quicktime": "video", "video/webm": "video", "video/3gpp": "video", "video/x-m4v": "video",
  "audio/mpeg": "audio", "audio/mp4": "audio", "audio/x-m4a": "audio", "audio/wav": "audio", "audio/x-wav": "audio",
  "audio/webm": "audio", "audio/ogg": "audio", "audio/aac": "audio",
  "application/pdf": "document", "text/plain": "document",
};

export function kindForMime(mime: string): MediaKind | null {
  const base = mime.split(";")[0]!.trim().toLowerCase();
  return ALLOWED[base] ?? null;
}

export function baseMime(mime: string) {
  return mime.split(";")[0]!.trim().toLowerCase();
}

/** Media inside a still-sealed time capsule is hidden from everyone except its author. */
export async function isSealedForViewer(mediaId: string, accountId: string): Promise<boolean> {
  const [r] = await sql<{ sealed: boolean }[]>`
    select exists(
      select 1 from capsule_media cm join time_capsules t on t.id = cm.capsule_id
      where cm.media_id = ${mediaId} and t.unlock_at > now() and t.author_id is distinct from ${accountId}
    ) as sealed`;
  return !!r?.sealed;
}

export function exifDate(t?: string): string | null {
  // Drive reports EXIF time as "YYYY:MM:DD HH:MM:SS"
  const m = t?.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  if (y < 1826 || y > 2200) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
