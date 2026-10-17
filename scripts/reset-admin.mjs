#!/usr/bin/env node
/**
 * Emergency recovery for a locked-out administrator (lost phone / forgotten password).
 * Run from a trusted computer with the production DATABASE_URL:
 *
 *   node scripts/reset-admin.mjs admin@example.com
 *
 * It clears that admin's password and authenticator and signs them out everywhere,
 * then re-opens /setup (protected by SETUP_TOKEN) if no other admin remains — or
 * another admin can send them a code and they re-enroll from "My settings".
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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
const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email || !process.env.DATABASE_URL) {
  console.error("Usage: DATABASE_URL=... node scripts/reset-admin.mjs admin@example.com");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DATABASE_SSL === "disable" ? false : "require", prepare: false });
const rows = await sql`update accounts set password_hash = null, totp_secret_enc = null, totp_pending_enc = null, totp_enabled = false
                       where lower(email) = ${email} and role = 'admin' returning id, display_name`;
if (!rows.length) {
  console.error("No administrator with that email.");
} else {
  await sql`update sessions set revoked_at = now() where account_id = ${rows[0].id} and revoked_at is null`;
  await sql`insert into activity_log (account_id, action, summary) values (${rows[0].id}, 'auth.admin_reset', 'Admin credentials reset from the command line')`;
  const [n] = await sql`select count(*)::int as n from accounts where role = 'admin' and totp_enabled`;
  console.log(`✓ Reset ${rows[0].display_name}.`);
  console.log(n.n === 0
    ? "No admin has an authenticator now, so /setup is open again (requires SETUP_TOKEN). Use the SAME email in setup to recover this account."
    : "Ask another admin to send them a sign-in code; they can re-enroll under My settings.");
}
await sql.end();
