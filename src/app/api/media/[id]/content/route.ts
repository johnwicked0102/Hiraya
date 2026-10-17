import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/session";
import { sql } from "@/lib/db";
import { fetchContent, fetchThumbnail } from "@/lib/drive";
import { isSealedForViewer } from "@/lib/media";
import { HttpError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Streams a private Drive file to an authenticated family member.
 * Supports HTTP Range so videos can seek; thumbnails come from Drive's own
 * thumbnailer. Drive files are never shared publicly.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

  const [m] = await sql<{ driveFileId: string; mimeType: string; kind: string; fileName: string }[]>`
    select drive_file_id, mime_type, kind, file_name from media where id = ${id} and deleted_at is null`;
  if (!m) return new NextResponse("Not found", { status: 404 });
  if (await isSealedForViewer(id, viewer.accountId)) return new NextResponse("Sealed until the capsule opens", { status: 403 });

  const thumb = Number(req.nextUrl.searchParams.get("thumb") ?? 0);
  const download = req.nextUrl.searchParams.get("download") === "1";
  if (download && !viewer.canDownload) return new NextResponse("Downloads are turned off for viewers.", { status: 403 });
  const etag = `"${id}-${thumb || "o"}"`;
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag } });

  try {
    if (thumb && (m.kind === "image" || m.kind === "video") && !download) {
      const size = Math.min(1600, Math.max(64, Math.round(thumb)));
      const t = await fetchThumbnail(m.driveFileId, size);
      if (t) {
        return new NextResponse(t.body, {
          headers: {
            "Content-Type": t.headers.get("content-type") ?? "image/jpeg",
            "Cache-Control": "private, max-age=604800",
            ETag: etag,
          },
        });
      }
      if (m.kind === "video") return new NextResponse("No preview yet", { status: 404 });
    }

    const range = download ? null : req.headers.get("range");
    const res = await fetchContent(m.driveFileId, range);
    if (!res.ok && res.status !== 206) {
      return new NextResponse("The file couldn't be loaded from Google Drive.", { status: res.status === 404 ? 404 : 502 });
    }
    const headers = new Headers({
      "Content-Type": m.mimeType,
      "Cache-Control": "private, max-age=604800",
      "Accept-Ranges": "bytes",
      ETag: etag,
    });
    for (const h of ["content-length", "content-range"]) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    const safeName = m.fileName.replace(/[^\w.\- ()]/g, "_");
    const inline = !download && (m.kind !== "document" || m.mimeType === "application/pdf");
    headers.set("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(m.fileName)}`);
    return new NextResponse(res.body, { status: res.status, headers });
  } catch (e) {
    if (e instanceof HttpError) return new NextResponse(e.message, { status: e.status });
    console.error("[media] stream failed", e);
    return new NextResponse("Couldn't load this file right now.", { status: 502 });
  }
}
