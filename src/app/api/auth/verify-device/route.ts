import { z } from "zod";
import { headers } from "next/headers";
import { api, clientIp, HttpError } from "@/lib/http";
import { answerLoginChallenge, assertIpNotThrottled, recordFailure, rememberDevice } from "@/lib/auth";
import { createSession, getOrCreateDeviceId } from "@/lib/session";
import { sha256 } from "@/lib/crypto";
import { logActivity } from "@/lib/activity";

export const POST = api(
  { level: "public", body: z.object({ challenge: z.string().min(20).max(100), answer: z.string().min(1).max(200) }) },
  async ({ req, body }) => {
    const ip = clientIp(req);
    await assertIpNotThrottled(ip);
    const deviceHash = sha256(await getOrCreateDeviceId());
    const accountId = await answerLoginChallenge(body.challenge, body.answer, deviceHash);
    if (!accountId) {
      await recordFailure(`ip:${ip}`);
      throw new HttpError(401, "That answer didn't match. After 5 tries you'll need a new code from your admin.");
    }
    await rememberDevice(accountId, deviceHash, (await headers()).get("user-agent"));
    await createSession(accountId, "code", deviceHash);
    await logActivity({ accountId, action: "auth.device_enrolled", summary: "Signed in on a new device", ip });
    return { step: "done" };
  },
);
