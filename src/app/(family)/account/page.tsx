import { requireViewer } from "@/lib/session";
import { sql } from "@/lib/db";
import { AccountView } from "./account-view";

export const metadata = { title: "My settings" };

export default async function AccountPage() {
  const viewer = await requireViewer();
  const [acct] = await sql<{ totpEnabled: boolean; email: string | null; hasCalendar: boolean; loginName: string }[]>`
    select totp_enabled, email, calendar_token_hash is not null as has_calendar, login_name from accounts where id = ${viewer.accountId}`;
  const sessions = await sql<{ id: string; userAgent: string | null; ip: string | null; createdAt: string; lastSeenAt: string; authLevel: string }[]>`
    select id, user_agent, ip, created_at, last_seen_at, auth_level from sessions
    where account_id = ${viewer.accountId} and revoked_at is null and expires_at > now() order by last_seen_at desc`;
  return <AccountView account={acct!} sessions={sessions} currentSessionId={viewer.sessionId} />;
}
