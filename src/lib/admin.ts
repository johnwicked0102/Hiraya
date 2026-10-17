import "server-only";
import { sql } from "./db";

export type AdminAccount = {
  id: string; displayName: string; loginName: string; role: "admin" | "editor" | "viewer"; status: "active" | "suspended";
  personId: string | null; email: string | null; totpEnabled: boolean; hasQuestion: boolean; verifyQuestion: string | null;
  lastLoginAt: string | null; createdAt: string; sessions: number; devices: number; codeExpiresAt: string | null;
};

export function listAccounts() {
  return sql<AdminAccount[]>`
    select a.id, a.display_name, a.login_name, a.role, a.status, a.person_id, a.email, a.totp_enabled,
      a.verify_answer_hash is not null as has_question, a.verify_question, a.last_login_at, a.created_at,
      (select count(*)::int from sessions s where s.account_id = a.id and s.revoked_at is null and s.expires_at > now()) as sessions,
      (select count(*)::int from devices d where d.account_id = a.id) as devices,
      (select max(c.expires_at) from access_codes c where c.account_id = a.id and c.used_at is null and c.revoked_at is null
         and c.expires_at > now() and c.attempts < 5) as code_expires_at
    from accounts a order by a.role = 'admin' desc, a.display_name`;
}

export async function strongAdminCount(excludeId?: string) {
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int as n from accounts where role = 'admin' and status = 'active' and totp_enabled
    ${excludeId ? sql`and id <> ${excludeId}` : sql``}`;
  return r?.n ?? 0;
}
