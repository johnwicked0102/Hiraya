import { z } from "zod";
import { api } from "@/lib/http";
import { sql } from "@/lib/db";
import { logActivity } from "@/lib/activity";

/** Sign someone out everywhere; optionally forget their devices so the identity question is asked again. */
export const POST = api({ level: "admin", body: z.object({ forgetDevices: z.boolean().default(false) }) }, async ({ viewer, body, params }) => {
  await sql`update sessions set revoked_at = now() where account_id = ${params.id!} and revoked_at is null`;
  if (body.forgetDevices) await sql`delete from devices where account_id = ${params.id!}`;
  await logActivity({ accountId: viewer.accountId, action: "account.sessions_revoked", entityType: "account", entityId: params.id, summary: `Signed a member out of all devices${body.forgetDevices ? " and forgot their devices" : ""}` });
  return { ok: true };
});
