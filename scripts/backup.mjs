#!/usr/bin/env node
/**
 * Full offline backup of the family archive: the database as JSON plus every
 * original photo/video downloaded from Google Drive.
 *
 *   node scripts/backup.mjs [output-folder]
 *
 * Needs DATABASE_URL, ENCRYPTION_KEY, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
 * (the same values as the server — e.g. in .env.local). Re-running only downloads
 * files that aren't already in the folder.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, createWriteStream, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash, createDecipheriv } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const need = ["DATABASE_URL", "ENCRYPTION_KEY"];
for (const k of need) if (!process.env[k]) { console.error(`${k} is not set`); process.exit(1); }

const out = process.argv[2] ?? join(root, "backups", new Date().toISOString().slice(0, 10));
mkdirSync(join(out, "files"), { recursive: true });
const sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DATABASE_SSL === "disable" ? false : "require", prepare: false });

function decrypt(payload) {
  const [, iv, tag, data] = payload.split(".");
  const key = createHash("sha256").update(process.env.ENCRYPTION_KEY).digest();
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

const tables = ["settings", "persons", "parent_child", "partnerships", "albums", "media", "media_people", "events", "event_people",
  "stories", "story_people", "story_media", "time_capsules", "capsule_recipients", "capsule_media", "greetings"];
const data = {};
for (const t of tables) data[t] = await sql.unsafe(`select * from ${t}`);
// keep sealed capsule messages sealed in the backup
data.time_capsules = data.time_capsules.map((c) => (new Date(c.unlock_at) > new Date() ? { ...c, message: null, message_sealed: true } : c));
writeFileSync(join(out, "hiraya-archive.json"), JSON.stringify({ format: "hiraya-archive", version: 1, exportedAt: new Date().toISOString(), data }, null, 2));
console.log(`✓ Database saved to ${join(out, "hiraya-archive.json")}`);

const [conn] = await sql`select refresh_token_enc from drive_connection where id = 1`;
if (!conn || !process.env.GOOGLE_CLIENT_ID) {
  console.log("Google Drive isn't connected/configured — skipping file download.");
  await sql.end();
  process.exit(0);
}
const tok = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: decrypt(conn.refresh_token_enc), grant_type: "refresh_token" }),
}).then((r) => r.json());
if (!tok.access_token) { console.error("Couldn't get a Google access token:", tok.error); process.exit(1); }

const media = await sql`select id, drive_file_id, file_name, size_bytes from media where deleted_at is null order by created_at`;
let done = 0, skipped = 0, failed = 0;
for (const m of media) {
  const safe = `${m.id}-${m.file_name.replace(/[^\w.\- ()]/g, "_")}`;
  const dest = join(out, "files", safe);
  if (existsSync(dest) && statSync(dest).size === Number(m.size_bytes)) { skipped++; continue; }
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${m.drive_file_id}?alt=media`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (!res.ok) throw new Error(String(res.status));
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
    done++;
    process.stdout.write(`\r  downloaded ${done}, skipped ${skipped}, failed ${failed} of ${media.length}`);
  } catch (e) {
    failed++;
    console.error(`\n  ✗ ${m.file_name}: ${e.message}`);
  }
}
console.log(`\n✓ Files in ${join(out, "files")} (${done} new, ${skipped} already there, ${failed} failed)`);
await sql.end();
