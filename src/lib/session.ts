import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "./db";
import { randomToken, sha256 } from "./crypto";
import { getSettings } from "./settings";
import type { Role, ViewerInfo } from "./types";

export const SESSION_COOKIE = "hiraya_session";
export const DEVICE_COOKIE = "hiraya_device";

const MEMBER_SESSION_DAYS = 30;
const ADMIN_SESSION_HOURS = 12;

export interface Viewer extends ViewerInfo {
  sessionId: string;
}

const secure = process.env.NODE_ENV === "production";

/** The signed-in family member for this request, or null. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20 || token.length > 200) return null;
  const rows = await sql<
    {
      sessionId: string;
      accountId: string;
      personId: string | null;
      displayName: string;
      role: Role;
      authLevel: "code" | "strong";
      totpEnabled: boolean;
      lastSeenAt: string;
    }[]
  >`
    select s.id as session_id, a.id as account_id, a.person_id, a.display_name, a.role,
           s.auth_level, a.totp_enabled, s.last_seen_at
    from sessions s join accounts a on a.id = s.account_id
    where s.token_hash = ${sha256(token)}
      and s.revoked_at is null
      and s.expires_at > now()
      and a.status = 'active'
    limit 1`;
  const r = rows[0];
  if (!r) return null;

  // Touch last_seen at most every 5 minutes.
  if (Date.now() - new Date(r.lastSeenAt).getTime() > 5 * 60_000) {
    sql`update sessions set last_seen_at = now() where id = ${r.sessionId}`.catch(() => {});
  }

  const settings = await getSettings();
  // Admin powers only switch on for a "strong" session (password + authenticator).
  const effectiveRole: Role =
    r.role === "admin" ? (r.authLevel === "strong" && r.totpEnabled ? "admin" : "editor") : r.role;
  const canEditTree = effectiveRole === "admin" || effectiveRole === "editor";
  return {
    sessionId: r.sessionId,
    accountId: r.accountId,
    personId: r.personId,
    displayName: r.displayName,
    role: r.role,
    effectiveRole,
    authLevel: r.authLevel,
    canEditTree,
    canContribute: canEditTree || settings.viewersCanContribute,
    isAdmin: effectiveRole === "admin",
    canDownload: canEditTree || settings.membersCanDownload,
  };
});

/** For pages: redirect to the gate when signed out. */
export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  return v;
}

export async function requireAdminPage(): Promise<Viewer> {
  const v = await requireViewer();
  if (!v.isAdmin) redirect("/admin-login?next=/admin");
  return v;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const jar = await cookies();
  let id = jar.get(DEVICE_COOKIE)?.value;
  if (!id || !/^[A-Za-z0-9_-]{30,64}$/.test(id)) {
    id = randomToken(32);
    jar.set(DEVICE_COOKIE, id, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
  }
  return id;
}

export async function createSession(accountId: string, level: "code" | "strong", deviceHash: string | null) {
  const token = randomToken(32);
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
  const ua = (h.get("user-agent") ?? "").slice(0, 300);
  const maxAgeSec = level === "strong" ? ADMIN_SESSION_HOURS * 3600 : MEMBER_SESSION_DAYS * 86400;
  await sql`
    insert into sessions (account_id, token_hash, auth_level, device_hash, user_agent, ip, expires_at)
    values (${accountId}, ${sha256(token)}, ${level}, ${deviceHash}, ${ua}, ${ip},
            now() + make_interval(secs => ${maxAgeSec}))`;
  await sql`update accounts set last_login_at = now() where id = ${accountId}`;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: maxAgeSec });
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await sql`update sessions set revoked_at = now() where token_hash = ${sha256(token)}`;
  jar.delete(SESSION_COOKIE);
}

export function viewerInfo(v: Viewer): ViewerInfo {
  const { sessionId: _s, ...info } = v;
  return info;
}
