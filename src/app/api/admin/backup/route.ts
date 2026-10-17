import { api } from "@/lib/http";
import { buildExport, buildGedcom } from "@/lib/archive";
import { ensureFolder, uploadSmallFile } from "@/lib/drive";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

export const maxDuration = 60;

/** Save a dated JSON archive + GEDCOM into "Hiraya Family Archive/Backups" on Google Drive. */
export const POST = api({ level: "admin" }, async ({ viewer }) => {
  const settings = await getSettings();
  const folder = await ensureFolder(["Backups"]);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const json = await uploadSmallFile(`hiraya-archive-${stamp}.json`, "application/json", JSON.stringify(await buildExport()), folder);
  const ged = await uploadSmallFile(`family-tree-${stamp}.ged`, "text/plain", await buildGedcom(settings.familyName), folder);
  await logActivity({ accountId: viewer.accountId, action: "archive.backed_up", summary: "Saved a backup to Google Drive", details: { json: json.name, gedcom: ged.name } });
  return { ok: true, files: [json.name, ged.name] };
});
