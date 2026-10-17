import { z } from "zod";
import { api, clientIp, HttpError, zText } from "@/lib/http";
import { sql } from "@/lib/db";
import { recentFailures, recordFailure } from "@/lib/auth";

export const POST = api(
  {
    level: "public",
    body: z.object({
      fullName: z.string().trim().min(2).max(120),
      relationship: zText(200),
      contact: zText(200),
      message: zText(1000),
      website: z.string().max(0).optional(), // honeypot: must stay empty
    }),
  },
  async ({ req, body }) => {
    const ip = clientIp(req);
    if ((await recentFailures(`req:${ip}`, 60)) >= 3) {
      throw new HttpError(429, "We've received your request already. Your family admin will be in touch.");
    }
    await recordFailure(`req:${ip}`); // counts requests per IP per hour
    await sql`insert into access_requests (full_name, relationship, contact, message, ip)
              values (${body.fullName}, ${body.relationship}, ${body.contact}, ${body.message}, ${ip})`;
    return { ok: true };
  },
);
