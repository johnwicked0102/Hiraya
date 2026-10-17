import { z } from "zod";
import QRCode from "qrcode";
import { api, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { encrypt, decrypt, safeEqual, sha256 } from "@/lib/crypto";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/totp";
import { hashSecret, normalizeLoginName, passwordProblems, rememberDevice } from "@/lib/auth";
import { createSession, getOrCreateDeviceId } from "@/lib/session";
import { logActivity } from "@/lib/activity";

/** First-run setup is only possible until an administrator has finished enrolling an authenticator. */
async function setupOpen() {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from accounts where role = 'admin' and totp_enabled`;
  return (r?.n ?? 0) === 0;
}

function checkToken(token: string) {
  const expected = process.env.SETUP_TOKEN;
  if (!expected || expected.length < 8) throw new HttpError(500, "SETUP_TOKEN is not configured on the server.");
  if (!safeEqual(sha256(token), sha256(expected))) throw new HttpError(403, "Setup token is incorrect.");
}

export const GET = api({ level: "public" }, async () => ({ open: await setupOpen() }));

const Body = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("begin"),
    setupToken: z.string().min(1).max(200),
    displayName: z.string().min(1).max(120),
    email: z.string().email().max(200),
    password: z.string().min(1).max(200),
    familyName: z.string().min(1).max(120),
  }),
  z.object({
    step: z.literal("confirm"),
    setupToken: z.string().min(1).max(200),
    email: z.string().email().max(200),
    totp: z.string().min(6).max(10),
  }),
]);

export const POST = api({ level: "public", body: Body }, async ({ body }) => {
  if (!(await setupOpen())) throw new HttpError(403, "Hiraya is already set up. Sign in as an administrator instead.");
  checkToken(body.setupToken);
  const email = body.email.trim().toLowerCase();

  if (body.step === "begin") {
    const problem = passwordProblems(body.password);
    if (problem) throw new HttpError(400, problem);
    const secret = generateTotpSecret();
    const pwHash = await hashSecret(body.password);
    await sql.begin(async (tx) => {
      const [existing] = await tx<{ id: string }[]>`select id from accounts where lower(email) = ${email}`;
      if (existing) {
        // Recovering an existing administrator (e.g. after scripts/reset-admin.mjs).
        await tx`update accounts set role = 'admin', status = 'active', password_hash = ${pwHash},
                 totp_pending_enc = ${encrypt(secret)}, totp_enabled = false where id = ${existing.id}`;
      } else {
        // Re-running setup before confirming replaces only an unfinished, never-used setup admin.
        await tx`delete from accounts where role = 'admin' and not totp_enabled and last_login_at is null and created_by is null and email is not null`;
        await tx`
          insert into accounts (display_name, login_name, login_name_norm, role, email, password_hash, totp_pending_enc)
          values (${body.displayName}, ${body.displayName}, ${normalizeLoginName(body.displayName)}, 'admin',
                  ${email}, ${pwHash}, ${encrypt(secret)})`;
      }
      await tx`insert into settings (key, value) values ('family_name', ${tx.json(body.familyName)})
               on conflict (key) do update set value = excluded.value`;
    });
    const uri = totpUri(secret, email);
    return { secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  }

  const [a] = await sql<{ id: string; totpPendingEnc: string | null }[]>`
    select id, totp_pending_enc from accounts where lower(email) = ${email} and role = 'admin' and not totp_enabled`;
  if (!a?.totpPendingEnc) throw new HttpError(400, "Start setup again — no pending administrator found.");
  const counter = verifyTotp(decrypt(a.totpPendingEnc), body.totp.replace(/\s/g, ""));
  if (counter === null) throw new HttpError(400, "That authenticator code didn't match. Check the time on your phone and try again.");
  await sql`update accounts set totp_secret_enc = totp_pending_enc, totp_pending_enc = null,
            totp_enabled = true, totp_last_counter = ${counter} where id = ${a.id}`;
  const deviceHash = sha256(await getOrCreateDeviceId());
  await rememberDevice(a.id, deviceHash, null);
  await createSession(a.id, "strong", deviceHash);
  await logActivity({ accountId: a.id, action: "setup.completed", summary: "First administrator created" });
  return { ok: true };
});
