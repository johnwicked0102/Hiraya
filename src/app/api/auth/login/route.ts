import { z } from "zod";
import { headers } from "next/headers";
import { api, clientIp, HttpError } from "@/lib/http";
import {
  assertIpNotThrottled, consumeAccessCode, createLoginChallenge, findActiveAccountByLoginName,
  isKnownDevice, recordFailure, rememberDevice,
} from "@/lib/auth";
import { createSession, getOrCreateDeviceId } from "@/lib/session";
import { sha256 } from "@/lib/crypto";
import { logActivity } from "@/lib/activity";

const GENERIC = "That name and code don't match an active invitation. Codes last 3 minutes and work once — ask your family admin for a new one.";

export const POST = api(
  {
    level: "public",
    body: z.object({
      name: z.string().min(1).max(120),
      code: z.string().max(20),
    }),
  },
  async ({ req, body }) => {
    const ip = clientIp(req);
    await assertIpNotThrottled(ip);
    const code = body.code.replace(/\D/g, "");
    const account = await findActiveAccountByLoginName(body.name);
    if (!account || code.length !== 6) {
      await recordFailure(`ip:${ip}`);
      throw new HttpError(401, GENERIC);
    }
    const ok = await consumeAccessCode(account.id, code);
    if (!ok) {
      await recordFailure(`ip:${ip}`);
      await logActivity({ accountId: account.id, action: "auth.code_failed", entityType: "account", entityId: account.id, ip });
      throw new HttpError(401, GENERIC);
    }

    const deviceHash = sha256(await getOrCreateDeviceId());
    const known = await isKnownDevice(account.id, deviceHash);

    // New device + identity question configured → second step before a session exists.
    if (!known && account.verifyAnswerHash) {
      const challenge = await createLoginChallenge(account.id, deviceHash);
      return { step: "verify", challenge, question: account.verifyQuestion };
    }

    const ua = (await headers()).get("user-agent");
    await rememberDevice(account.id, deviceHash, ua);
    await createSession(account.id, "code", deviceHash);
    await logActivity({ accountId: account.id, action: "auth.signed_in", summary: "Signed in with access code", ip });
    return { step: "done" };
  },
);
