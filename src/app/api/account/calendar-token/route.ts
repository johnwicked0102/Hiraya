import { api } from "@/lib/http";
import { sql } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { appUrl } from "@/lib/drive";

/** Private calendar feed (birthdays, anniversaries, memorials, events) with reminders. */
export const POST = api({ level: "member" }, async ({ viewer }) => {
  const token = `hcal_${randomToken(24)}`;
  await sql`update accounts set calendar_token_hash = ${sha256(token)} where id = ${viewer.accountId}`;
  return { url: `${appUrl()}/api/calendar/feed/${token}` };
});

export const DELETE = api({ level: "member" }, async ({ viewer }) => {
  await sql`update accounts set calendar_token_hash = null where id = ${viewer.accountId}`;
  return { ok: true };
});
