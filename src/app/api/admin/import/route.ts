import { NextResponse } from "next/server";
import { api, HttpError } from "@/lib/http";
import { importArchive } from "@/lib/archive";
import { logActivity } from "@/lib/activity";

export const maxDuration = 60;

/** Merge a Hiraya JSON archive into this database. Existing records are never overwritten. */
export const POST = api({ level: "admin" }, async ({ req, viewer }) => {
  const text = await req.text();
  if (text.length > 50 * 1024 * 1024) throw new HttpError(413, "Archive is larger than 50 MB.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, "That file isn't valid JSON.");
  }
  try {
    const counts = await importArchive(parsed as never);
    await logActivity({ accountId: viewer.accountId, action: "archive.imported", summary: "Imported a family archive", details: counts });
    return NextResponse.json({ ok: true, counts });
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Import failed.");
  }
});
