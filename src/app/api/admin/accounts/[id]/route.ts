import { z } from "zod";
import { api, HttpError, zText, zUuid } from "@/lib/http";
import { sql } from "@/lib/db";
import { strongAdminCount } from "@/lib/admin";
import { hashSecret, normalizeAnswer, normalizeLoginName } from "@/lib/auth";
import { diff, logActivity } from "@/lib/activity";

const Patch = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  loginName: z.string().trim().min(2).max(120).optional(),
  role: z.enum(["admin", "editor", "viewer"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  personId: zUuid.nullable().optional(),
  verifyQuestion: zText(200),
  verifyAnswer: zText(200),
});

export const PATCH = api({ level: "admin", body: Patch }, async ({ viewer, body, params }) => {
  const id = params.id!;
  const [before] = await sql<{ displayName: string; loginName: string; role: string; status: string; personId: string | null; totpEnabled: boolean }[]>`
    select display_name, login_name, role, status, person_id, totp_enabled from accounts where id = ${id}`;
  if (!before) throw new HttpError(404, "Account not found.");
  const losingAdmin = before.role === "admin" && before.totpEnabled && ((body.role && body.role !== "admin") || body.status === "suspended");
  if (losingAdmin && (await strongAdminCount(id)) === 0) throw new HttpError(400, "Hiraya needs at least one active administrator. Promote someone else first.");
  if (id === viewer.accountId && (body.status === "suspended" || (body.role && body.role !== "admin"))) {
    throw new HttpError(400, "You can't suspend or demote yourself.");
  }
  const cols: Record<string, unknown> = {};
  if (body.displayName) cols.displayName = body.displayName;
  if (body.loginName) {
    cols.loginName = body.loginName;
    cols.loginNameNorm = normalizeLoginName(body.loginName);
  }
  if (body.role) cols.role = body.role;
  if (body.status) cols.status = body.status;
  if (body.personId !== undefined) cols.personId = body.personId;
  if (body.verifyQuestion !== undefined || body.verifyAnswer !== undefined) {
    if (body.verifyQuestion && body.verifyAnswer) {
      cols.verifyQuestion = body.verifyQuestion;
      cols.verifyAnswerHash = await hashSecret(normalizeAnswer(body.verifyAnswer));
    } else if (!body.verifyQuestion && !body.verifyAnswer) {
      cols.verifyQuestion = null;
      cols.verifyAnswerHash = null;
    }
  }
  if (body.role && body.role !== "admin" && before.role === "admin") {
    // Remove admin credentials when demoting.
    Object.assign(cols, { passwordHash: null, totpSecretEnc: null, totpPendingEnc: null, totpEnabled: false });
  }
  if (Object.keys(cols).length) await sql`update accounts set ${sql(cols)} where id = ${id}`;
  if (body.status === "suspended" || (body.role && body.role !== before.role)) {
    await sql`update sessions set revoked_at = now() where account_id = ${id} and revoked_at is null`;
  }
  const changes = diff(before as unknown as Record<string, unknown>, { ...body, verifyAnswer: undefined } as Record<string, unknown>);
  await logActivity({ accountId: viewer.accountId, action: "account.updated", entityType: "account", entityId: id, summary: `Updated ${before.displayName}'s access`, details: changes });
  return { ok: true };
});

export const DELETE = api({ level: "admin" }, async ({ viewer, params }) => {
  const id = params.id!;
  if (id === viewer.accountId) throw new HttpError(400, "You can't remove your own account.");
  const [a] = await sql<{ displayName: string; role: string; totpEnabled: boolean }[]>`select display_name, role, totp_enabled from accounts where id = ${id}`;
  if (!a) throw new HttpError(404, "Account not found.");
  if (a.role === "admin" && a.totpEnabled && (await strongAdminCount(id)) === 0) throw new HttpError(400, "Can't remove the last administrator.");
  await sql`delete from accounts where id = ${id}`;
  await logActivity({ accountId: viewer.accountId, action: "account.deleted", entityType: "account", entityId: id, summary: `Removed ${a.displayName}'s access (their family profile stays)` });
  return { ok: true };
});
