import { z } from "zod";
import { headers } from "next/headers";
import { api, clientIp, HttpError } from "@/lib/http";
import { assertIpNotThrottled, rememberDevice, verifyAdminCredentials } from "@/lib/auth";
import { createSession, getOrCreateDeviceId } from "@/lib/session";
import { sha256 } from "@/lib/crypto";
import { logActivity } from "@/lib/activity";

export const POST = api(
  {
    level: "public",
    body: z.object({
      email: z.string().email().max(200),
      password: z.string().min(1).max(200),
      totp: z.string().min(6).max(10),
    }),
  },
  async ({ req, body }) => {
    const ip = clientIp(req);
    await assertIpNotThrottled(ip);
    const accountId = await verifyAdminCredentials(body.email, body.password, body.totp, ip);
    if (!accountId) throw new HttpError(401, "Email, password or authenticator code is incorrect.");
    const deviceHash = sha256(await getOrCreateDeviceId());
    await rememberDevice(accountId, deviceHash, (await headers()).get("user-agent"));
    await createSession(accountId, "strong", deviceHash);
    await logActivity({ accountId, action: "auth.admin_signed_in", summary: "Administrator signed in", ip });
    return { ok: true };
  },
);
