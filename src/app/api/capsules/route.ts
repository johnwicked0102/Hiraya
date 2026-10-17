import { z } from "zod";
import { api, HttpError, zUuid } from "@/lib/http";
import { sql } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const POST = api(
  {
    level: "member",
    body: z.object({
      title: z.string().trim().min(1).max(200),
      message: z.string().trim().min(1).max(50_000),
      unlockAt: z.string().datetime({ offset: true }),
      audience: z.enum(["family", "people"]).default("family"),
      recipients: z.array(zUuid).max(200).default([]),
      media: z.array(zUuid).max(50).default([]),
    }),
  },
  async ({ viewer, body }) => {
    const unlock = new Date(body.unlockAt);
    if (unlock.getTime() < Date.now() + 60 * 60 * 1000) throw new HttpError(400, "Choose an opening date at least an hour from now.");
    if (unlock.getFullYear() > 2200) throw new HttpError(400, "Please choose a date before the year 2200.");
    if (body.audience === "people" && !body.recipients.length) throw new HttpError(400, "Choose who may open this capsule.");
    const id = await sql.begin(async (tx) => {
      const [c] = await tx<{ id: string }[]>`
        insert into time_capsules (title, message, unlock_at, audience, author_id)
        values (${body.title}, ${body.message}, ${unlock.toISOString()}, ${body.audience}, ${viewer.accountId}) returning id`;
      if (body.audience === "people") await tx`insert into capsule_recipients ${tx(body.recipients.map((p) => ({ capsuleId: c!.id, personId: p })))} on conflict do nothing`;
      if (body.media.length) await tx`insert into capsule_media ${tx(body.media.map((m) => ({ capsuleId: c!.id, mediaId: m })))} on conflict do nothing`;
      return c!.id;
    });
    await logActivity({ accountId: viewer.accountId, action: "capsule.sealed", entityType: "capsule", entityId: id, summary: `Sealed a time capsule until ${unlock.toDateString()}` });
    return { id };
  },
);
