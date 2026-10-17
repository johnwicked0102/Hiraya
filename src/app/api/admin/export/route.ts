import { NextResponse } from "next/server";
import { api } from "@/lib/http";
import { buildExport, buildGedcom } from "@/lib/archive";
import { getSettings } from "@/lib/settings";
import { sql } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const maxDuration = 60;

export const GET = api({ level: "admin" }, async ({ req, viewer }) => {
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const settings = await getSettings();
  const slug = settings.familyName.replace(/[^\w]+/g, "-").toLowerCase() || "family";
  const date = new Date().toISOString().slice(0, 10);
  await logActivity({ accountId: viewer.accountId, action: "archive.exported", summary: `Downloaded a ${format.toUpperCase()} export` });

  if (format === "gedcom") {
    return new NextResponse(await buildGedcom(settings.familyName), {
      headers: { "Content-Type": "text/vnd.familysearch.gedcom; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}-${date}.ged"` },
    });
  }
  if (format === "media-csv") {
    const rows = await sql<{ id: string; driveFileId: string; fileName: string; kind: string; sizeBytes: string; md5: string | null; sha256: string | null; takenOn: string | null; title: string | null }[]>`
      select id, drive_file_id, file_name, kind, size_bytes, md5, sha256, taken_on, title from media where deleted_at is null order by created_at`;
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["id,drive_file_id,file_name,kind,size_bytes,md5,sha256,taken_on,title,drive_link",
      ...rows.map((r) => [r.id, r.driveFileId, r.fileName, r.kind, r.sizeBytes, r.md5, r.sha256, r.takenOn, r.title, `https://drive.google.com/file/d/${r.driveFileId}/view`].map(q).join(","))].join("\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}-media-${date}.csv"` } });
  }
  return new NextResponse(JSON.stringify(await buildExport(), null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}-hiraya-archive-${date}.json"` },
  });
});
