import { z } from "zod";
import QRCode from "qrcode";
import { api, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/totp";
import { consumeAccessCode, hashSecret, passwordProblems } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

/**
 * An account promoted to administrator activates admin powers by adding a password
 * and an authenticator app. Because this raises privileges, it also requires a
 * fresh one-time code issued by an existing administrator.
 */
const Body = z.discriminatedUnion("step", [
  z.object({ step: z.literal("begin"), email: z.string().email().max(200), password: z.string().max(200), code: z.string().max(10) }),
  z.object({ step: z.literal("confirm"), totp: z.string().min(6).max(10) }),
]);

export const POST = api({ level: "member", body: Body }, async ({ viewer, body }) => {
  const [a] = await sql<{ role: string; totpEnabled: boolean; totpPendingEnc: string | null; email: string | null }[]>`
    select role, totp_enabled, totp_pending_enc, email from accounts where id = ${viewer.accountId}`;
  if (!a || a.role !== "admin") throw new HttpError(403, "Only accounts promoted to administrator need this.");
  if (a.totpEnabled) throw new HttpError(400, "Your administrator sign-in is already set up. Use the admin reset script to change it.");

  if (body.step === "begin") {
    const problem = passwordProblems(body.password);
    if (problem) throw new HttpError(400, problem);
    const ok = await consumeAccessCode(viewer.accountId, body.code.replace(/\D/g, ""));
    if (!ok) throw new HttpError(401, "That confirmation code didn't work. Ask another admin for a fresh code.");
    const secret = generateTotpSecret();
    await sql`update accounts set email = ${body.email.trim().toLowerCase()}, password_hash = ${await hashSecret(body.password)},
              totp_pending_enc = ${encrypt(secret)} where id = ${viewer.accountId}`;
    return { secret, qr: await QRCode.toDataURL(totpUri(secret, body.email), { margin: 1, width: 220 }) };
  }
  if (!a.totpPendingEnc) throw new HttpError(400, "Start again — no pending setup.");
  const counter = verifyTotp(decrypt(a.totpPendingEnc), body.totp.replace(/\s/g, ""));
  if (counter === null) throw new HttpError(400, "That authenticator code didn't match.");
  await sql`update accounts set totp_secret_enc = totp_pending_enc, totp_pending_enc = null, totp_enabled = true,
            totp_last_counter = ${counter} where id = ${viewer.accountId}`;
  // Upgrade the current session to full administrator strength (12 hours).
  await sql`update sessions set auth_level = 'strong', expires_at = least(expires_at, now() + interval '12 hours') where id = ${viewer.sessionId}`;
  await logActivity({ accountId: viewer.accountId, action: "auth.admin_enrolled", summary: "Set up administrator password and authenticator" });
  return { ok: true };
});
