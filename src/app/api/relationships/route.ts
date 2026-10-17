import { z } from "zod";
import { api, HttpError, zDate, zText, zUuid } from "@/lib/http";
import { sql } from "@/lib/db";
import { isAncestorOrSelf } from "@/lib/family";
import { logActivity } from "@/lib/activity";

const Body = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("parent"),
    parentId: zUuid,
    childId: zUuid,
    kind: z.enum(["biological", "adopted", "step", "foster", "guardian"]).default("biological"),
  }),
  z.object({
    type: z.literal("partner"),
    personA: zUuid,
    personB: zUuid,
    kind: z.enum(["married", "partner", "engaged"]).default("married"),
    status: z.enum(["current", "divorced", "separated", "widowed"]).default("current"),
    startDate: zDate,
    endDate: zDate,
    place: zText(200),
  }),
]);

export const POST = api({ level: "editor", body: Body }, async ({ viewer, body }) => {
  if (body.type === "parent") {
    if (await isAncestorOrSelf(body.childId, body.parentId)) {
      throw new HttpError(400, "That would make someone their own ancestor — check who is the parent and who is the child.");
    }
    const [n] = await sql<{ n: number }[]>`select count(*)::int as n from parent_child where child_id = ${body.childId}`;
    if ((n?.n ?? 0) >= 6) throw new HttpError(400, "That person already has six parents recorded.");
    const [r] = await sql<{ id: string }[]>`
      insert into parent_child (parent_id, child_id, kind) values (${body.parentId}, ${body.childId}, ${body.kind})
      on conflict (parent_id, child_id) do update set kind = excluded.kind returning id`;
    await logActivity({ accountId: viewer.accountId, action: "relationship.parent_added", entityType: "parent_child", entityId: r!.id, summary: `Linked a ${body.kind} parent and child` });
    return { id: r!.id };
  }
  if (body.personA === body.personB) throw new HttpError(400, "Choose two different people.");
  const [r] = await sql<{ id: string }[]>`
    insert into partnerships (person_a, person_b, kind, status, start_date, end_date, place)
    values (${body.personA}, ${body.personB}, ${body.kind}, ${body.status}, ${body.startDate}, ${body.endDate}, ${body.place})
    returning id`;
  await logActivity({ accountId: viewer.accountId, action: "relationship.partner_added", entityType: "partnership", entityId: r!.id, summary: `Recorded a ${body.kind} partnership` });
  return { id: r!.id };
});
