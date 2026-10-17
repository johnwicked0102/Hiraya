#!/usr/bin/env node
// Applies db/schema.sql (idempotent). Usage:
//   DATABASE_URL=... node scripts/migrate.mjs            # create / update tables
//   DATABASE_URL=... node scripts/migrate.mjs --seed-demo # also add a small demo family
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
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DATABASE_SSL === "disable" ? false : "require", prepare: false, onnotice: () => {} });
try {
  await sql.unsafe(readFileSync(join(root, "db/schema.sql"), "utf8"));
  console.log("✓ Schema is up to date.");
  if (process.argv.includes("--seed-demo")) {
    await sql.unsafe(readFileSync(join(root, "db/seed-demo.sql"), "utf8"));
    console.log("✓ Demo family added.");
  }
} catch (e) {
  console.error("Migration failed:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
