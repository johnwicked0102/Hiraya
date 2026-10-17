import { z } from "zod";
import { api, HttpError, zUuid } from "@/lib/http";
import { sql } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const POST = api(
  {
    level: "member",
    body: z.object({
      personId: zUuid,
      message: z.string().trim().min(1).max(2000),
      cardStyle: z.enum(["meadow", "lantern", "sunflower", "starlight"]).default("meadow"),
      occasion: z.enum(["birthday", "anniversary", "memorial", "congrats"]).default("birthday"),
    }),
  },
  async ({ viewer, body }) => {
    const [p] = await sql<{ firstName: string }[]>`select first_name from persons where id = ${body.personId} and deleted_at is null`;
    if (!p) throw new HttpError(404, "Family member not found.");
    const [recent] = await sql<{ n: number }[]>`select count(*)::int as n from greetings where author_id = ${viewer.accountId} and created_at > now() - interval '1 hour'`;
    if ((recent?.n ?? 0) > 30) throw new HttpError(429, "That's a lot of cards! Please wait a little.");
    const [g] = await sql<{ id: string }[]>`
      insert into greetings (person_id, author_id, occasion, year, message, card_style)
      values (${body.personId}, ${viewer.accountId}, ${body.occasion}, extract(year from now())::int, ${body.message}, ${body.cardStyle})
      returning id`;
    await logActivity({ accountId: viewer.accountId, action: "greeting.sent", entityType: "person", entityId: body.personId, summary: `Sent a ${body.occasion} card to ${p.firstName}` });
    return { id: g!.id };
  },
);
