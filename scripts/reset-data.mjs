#!/usr/bin/env node
/**
 * Clear demo / uploaded data before going live.
 *
 *   node scripts/reset-data.mjs --yes
 *       Deletes ALL family content and uploaded-media records (people, tree,
 *       photos, albums, stories, capsules, events, greetings, activity log).
 *       KEEPS: admin/member accounts, settings config and the Drive connection.
 *
 *   node scripts/reset-data.mjs --factory --yes
 *       Wipes EVERYTHING, accounts and Drive connection included, and resets
 *       settings to defaults. You then re-run /setup to create the first admin.
 *
 * Note: files already uploaded to Google Drive are NOT deleted here — the app
 * only ever shows database rows, so clearing them is enough to start clean.
 * If you also want the files gone, trash the archive folder inside Google Drive.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
  const p = join(root, file);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const factory = process.argv.includes("--factory");
const confirmed = process.argv.includes("--yes");

// Content tables in FK-safe delete order (children before parents).
const contentTables = [
  "greetings", "story_media", "story_people", "stories",
  "capsule_media", "capsule_recipients", "time_capsules",
  "event_people", "events", "media_people", "uploads",
  "access_requests", "activity_log", "media", "albums",
  "parent_child", "partnerships", "persons",
];
// Everything, for a full factory reset.
const factoryTables = [
  ...contentTables,
  "login_challenges", "access_codes", "devices", "sessions",
  "auth_failures", "drive_connection", "accounts",
];

if (!confirmed) {
  console.log(
    factory
      ? "FACTORY RESET: this ERASES EVERYTHING — accounts, the Google Drive connection and settings included."
      : "This deletes all family content and uploaded-media records.\nAdmin/member accounts, settings and the Drive connection are kept.",
  );
  console.log("\nBack up first if unsure:  node scripts/backup.mjs");
  console.log(`Then re-run with --yes:   node scripts/reset-data.mjs ${factory ? "--factory " : ""}--yes\n`);
  process.exit(0);
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
  prepare: false,
  onnotice: () => {},
});

try {
  if (factory) {
    await sql.unsafe(`truncate table ${factoryTables.join(", ")} restart identity cascade`);
    await sql.unsafe(`
      insert into settings (key, value) values
        ('family_name', '"Our Family"'),
        ('family_motto', '"Every branch tells a story. Every memory keeps us together."'),
        ('logo_media_id', 'null'),
        ('featured_media_id', 'null'),
        ('viewers_can_contribute', 'true'),
        ('members_can_download', 'true'),
        ('root_person_id', 'null')
      on conflict (key) do update set value = excluded.value`);
    console.log("✓ Factory reset complete. Visit /setup to create the first administrator again.");
  } else {
    await sql.begin(async (tx) => {
      for (const t of contentTables) await tx.unsafe(`delete from ${t}`);
      await tx`update settings set value = 'null'::jsonb
               where key in ('logo_media_id', 'featured_media_id', 'root_person_id')`;
    });
    console.log("✓ All family content and uploaded-media records removed.");
    console.log("  Admin/member accounts, settings and the Drive connection were kept.");
  }
  console.log("Note: files already in Google Drive are untouched — trash the archive folder there if you want them gone too.");
} catch (e) {
  console.error("Reset failed:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
