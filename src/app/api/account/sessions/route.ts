import { z } from "zod";
import { api } from "@/lib/http";
import { sql } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const POST = api({ level: "member", body: z.object({ action: z.literal("sign_out_others") }) }, async ({ viewer }) => {
  await sql`update sessions set revoked_at = now() where account_id = ${viewer.accountId} and id <> ${viewer.sessionId} and revoked_at is null`;
  await logActivity({ accountId: viewer.accountId, action: "auth.signed_out_others", summary: "Signed out of all other devices" });
  return { ok: true };
});
