import { api, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { issueAccessCode } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

/** Generate a single-use, 3-minute code tied to this account. Shown once to the admin. */
export const POST = api({ level: "admin" }, async ({ viewer, params }) => {
  const [a] = await sql<{ displayName: string; loginName: string; status: string }[]>`select display_name, login_name, status from accounts where id = ${params.id!}`;
  if (!a) throw new HttpError(404, "Account not found.");
  if (a.status !== "active") throw new HttpError(400, "Reactivate this account before sending a code.");
  const [recent] = await sql<{ n: number }[]>`select count(*)::int as n from access_codes where account_id = ${params.id!} and created_at > now() - interval '10 minutes'`;
  if ((recent?.n ?? 0) >= 10) throw new HttpError(429, "Too many codes generated for this person. Wait a few minutes.");
  const { code, expiresAt } = await issueAccessCode(params.id!, viewer.accountId);
  await logActivity({ accountId: viewer.accountId, action: "auth.code_issued", entityType: "account", entityId: params.id, summary: `Generated a sign-in code for ${a.displayName}` });
  return { code, expiresAt, loginName: a.loginName, serverNow: new Date().toISOString() };
});

export const DELETE = api({ level: "admin" }, async ({ viewer, params }) => {
  await sql`update access_codes set revoked_at = now() where account_id = ${params.id!} and used_at is null and revoked_at is null`;
  await logActivity({ accountId: viewer.accountId, action: "auth.code_revoked", entityType: "account", entityId: params.id, summary: "Cancelled an unused sign-in code" });
  return { ok: true };
});
