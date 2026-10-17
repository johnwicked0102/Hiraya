import { z } from "zod";
import { api, HttpError, zText, zUuid } from "@/lib/http";
import { sql } from "@/lib/db";
import { listAccounts } from "@/lib/admin";
import { hashSecret, normalizeAnswer, normalizeLoginName } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export const GET = api({ level: "admin" }, async () => ({ accounts: await listAccounts() }));

export const POST = api(
  {
    level: "admin",
    body: z.object({
      displayName: z.string().trim().min(1).max(120),
      loginName: z.string().trim().min(2).max(120),
      role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
      personId: zUuid.nullable().optional(),
      verifyQuestion: zText(200),
      verifyAnswer: zText(200),
      requestId: zUuid.nullable().optional(),
    }),
  },
  async ({ viewer, body }) => {
    if (!!body.verifyQuestion !== !!body.verifyAnswer) throw new HttpError(400, "Add both a security question and its answer, or neither.");
    if (body.verifyAnswer && normalizeAnswer(body.verifyAnswer).length < 2) throw new HttpError(400, "The answer is too short.");
    const norm = normalizeLoginName(body.loginName);
    const [dup] = await sql`select 1 from accounts where login_name_norm = ${norm}`;
    if (dup) throw new HttpError(409, "Someone is already registered with that sign-in name. Add a middle name or nickname to tell them apart.");
    const [a] = await sql<{ id: string }[]>`
      insert into accounts (person_id, display_name, login_name, login_name_norm, role, verify_question, verify_answer_hash, created_by)
      values (${body.personId ?? null}, ${body.displayName}, ${body.loginName}, ${norm}, ${body.role}, ${body.verifyQuestion},
              ${body.verifyAnswer ? await hashSecret(normalizeAnswer(body.verifyAnswer)) : null}, ${viewer.accountId})
      returning id`;
    if (body.requestId) {
      await sql`update access_requests set status = 'approved', handled_by = ${viewer.accountId}, handled_at = now() where id = ${body.requestId}`;
    }
    await logActivity({ accountId: viewer.accountId, action: "account.created", entityType: "account", entityId: a!.id, summary: `Registered ${body.displayName} as ${body.role}` });
    return { id: a!.id };
  },
);
