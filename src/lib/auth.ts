import "server-only";
import bcrypt from "bcryptjs";
import { sql } from "./db";
import { hmac, randomSixDigitCode, randomToken, sha256, safeEqual, decrypt } from "./crypto";
import { verifyTotp } from "./totp";
import { HttpError } from "./http";

export const CODE_TTL_SECONDS = 180; // exactly 3 minutes
export const MAX_CODE_ATTEMPTS = 5;
const IP_FAIL_LIMIT = 25; // failed sign-ins per IP per 15 minutes
const ADMIN_FAIL_LIMIT = 5; // failed admin sign-ins per email per 15 minutes

export function normalizeLoginName(s: string): string {
  return s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeAnswer(s: string): string {
  return s.normalize("NFKC").trim().toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ");
}

function codeHash(accountId: string, code: string) {
  return hmac(`code:${accountId}:${code}`);
}

export async function recordFailure(scope: string) {
  await sql`insert into auth_failures (scope) values (${scope})`;
  // opportunistic cleanup
  if (Math.random() < 0.05) await sql`delete from auth_failures where created_at < now() - interval '1 day'`;
}

export async function recentFailures(scope: string, minutes = 15): Promise<number> {
  const [r] = await sql<{ n: number }[]>`
    select count(*)::int as n from auth_failures
    where scope = ${scope} and created_at > now() - make_interval(mins => ${minutes})`;
  return r?.n ?? 0;
}

export async function assertIpNotThrottled(ip: string) {
  if ((await recentFailures(`ip:${ip}`)) >= IP_FAIL_LIMIT) {
    throw new HttpError(429, "Too many attempts from this connection. Please wait 15 minutes and try again.");
  }
}

/** Admin issues a fresh single-use code. Older unused codes for the account are revoked. */
export async function issueAccessCode(accountId: string, issuedBy: string) {
  const code = randomSixDigitCode();
  const [row] = await sql.begin(async (tx) => {
    await tx`update access_codes set revoked_at = now()
             where account_id = ${accountId} and used_at is null and revoked_at is null`;
    return tx<{ id: string; expiresAt: string }[]>`
      insert into access_codes (account_id, code_hash, created_by, expires_at)
      values (${accountId}, ${codeHash(accountId, code)}, ${issuedBy},
              now() + make_interval(secs => ${CODE_TTL_SECONDS}))
      returning id, expires_at`;
  });
  return { code, expiresAt: row!.expiresAt, codeId: row!.id };
}

/**
 * Check a member's code. Always increments the attempt counter on the live code,
 * consumes it on success, and never reveals whether the name exists.
 */
export async function consumeAccessCode(accountId: string, code: string): Promise<boolean> {
  return sql.begin(async (tx) => {
    const [c] = await tx<{ id: string; codeHash: string; attempts: number }[]>`
      select id, code_hash, attempts from access_codes
      where account_id = ${accountId} and used_at is null and revoked_at is null
        and expires_at > now() and attempts < ${MAX_CODE_ATTEMPTS}
      order by created_at desc limit 1
      for update`;
    if (!c) return false;
    const ok = safeEqual(c.codeHash, codeHash(accountId, code));
    if (ok) {
      await tx`update access_codes set attempts = attempts + 1, used_at = now() where id = ${c.id}`;
    } else {
      await tx`update access_codes set attempts = attempts + 1 where id = ${c.id}`;
    }
    return ok;
  });
}

export async function findActiveAccountByLoginName(name: string) {
  const [a] = await sql<
    { id: string; verifyQuestion: string | null; verifyAnswerHash: string | null; role: string }[]
  >`select id, verify_question, verify_answer_hash, role from accounts
    where login_name_norm = ${normalizeLoginName(name)} and status = 'active' limit 1`;
  return a ?? null;
}

export async function isKnownDevice(accountId: string, deviceHash: string) {
  const [d] = await sql`select 1 from devices where account_id = ${accountId} and device_hash = ${deviceHash}`;
  return !!d;
}

export async function rememberDevice(accountId: string, deviceHash: string, userAgent: string | null) {
  const label = describeDevice(userAgent ?? "");
  await sql`
    insert into devices (account_id, device_hash, label) values (${accountId}, ${deviceHash}, ${label})
    on conflict (account_id, device_hash) do update set last_seen = now()`;
}

export function describeDevice(ua: string): string {
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

export async function createLoginChallenge(accountId: string, deviceHash: string) {
  const token = randomToken(32);
  await sql`
    insert into login_challenges (token_hash, account_id, device_hash, expires_at)
    values (${sha256(token)}, ${accountId}, ${deviceHash}, now() + interval '5 minutes')`;
  return token;
}

export async function answerLoginChallenge(token: string, answer: string, deviceHash: string) {
  return sql.begin(async (tx) => {
    const [c] = await tx<{ id: string; accountId: string; attempts: number; deviceHash: string }[]>`
      select id, account_id, attempts, device_hash from login_challenges
      where token_hash = ${sha256(token)} and used_at is null and expires_at > now() and attempts < 5
      for update`;
    if (!c || c.deviceHash !== deviceHash) return null;
    const [a] = await tx<{ verifyAnswerHash: string | null }[]>`
      select verify_answer_hash from accounts where id = ${c.accountId} and status = 'active'`;
    const ok = !!a?.verifyAnswerHash && (await bcrypt.compare(normalizeAnswer(answer), a.verifyAnswerHash));
    await tx`update login_challenges set attempts = attempts + 1 ${ok ? tx`, used_at = now()` : tx``}
             where id = ${c.id}`;
    return ok ? c.accountId : null;
  });
}

export async function hashSecret(s: string) {
  return bcrypt.hash(s, 12);
}

let dummyHash: string | null = null;
function getDummyHash() {
  // Used so unknown emails take as long to reject as wrong passwords.
  if (!dummyHash) dummyHash = bcrypt.hashSync("not-a-real-password", 12);
  return dummyHash;
}

/** Admin sign-in: email + password + 6-digit authenticator code. */
export async function verifyAdminCredentials(email: string, password: string, totp: string, ip: string) {
  const emailNorm = email.trim().toLowerCase();
  if ((await recentFailures(`admin:${emailNorm}`)) >= ADMIN_FAIL_LIMIT) {
    throw new HttpError(429, "This account is temporarily locked after several failed attempts. Try again in 15 minutes.");
  }
  const [a] = await sql<
    { id: string; passwordHash: string | null; totpSecretEnc: string | null; totpEnabled: boolean; totpLastCounter: string; role: string; status: string }[]
  >`select id, password_hash, totp_secret_enc, totp_enabled, totp_last_counter, role, status
    from accounts where lower(email) = ${emailNorm} limit 1`;
  const pwOk = await bcrypt.compare(password, a?.passwordHash ?? getDummyHash());
  let counter: number | null = null;
  if (pwOk && a?.totpEnabled && a.totpSecretEnc) {
    counter = verifyTotp(decrypt(a.totpSecretEnc), totp.replace(/\s/g, ""));
  }
  const valid =
    !!a && pwOk && a.role === "admin" && a.status === "active" && counter !== null && counter > Number(a.totpLastCounter);
  if (!valid) {
    await recordFailure(`admin:${emailNorm}`);
    await recordFailure(`ip:${ip}`);
    return null;
  }
  await sql`update accounts set totp_last_counter = ${counter} where id = ${a!.id}`;
  return a!.id;
}

export function passwordProblems(pw: string): string | null {
  if (pw.length < 12) return "Use at least 12 characters.";
  if (pw.length > 200) return "That password is too long.";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3) return "Mix upper and lower case letters, numbers and symbols (at least three kinds).";
  return null;
}

export { sha256 };
