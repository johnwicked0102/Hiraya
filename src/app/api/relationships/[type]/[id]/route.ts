import { z } from "zod";
import { api, HttpError, zDate, zText } from "@/lib/http";
import { sql } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const PATCH = api(
  {
    level: "editor",
    body: z.object({
      kind: z.string().max(20),
      status: z.enum(["current", "divorced", "separated", "widowed"]).optional(),
      startDate: zDate,
      endDate: zDate,
      place: zText(200),
    }),
  },
  async ({ viewer, body, params }) => {
    if (params.type === "parent") {
      if (!["biological", "adopted", "step", "foster", "guardian"].includes(body.kind)) throw new HttpError(400, "Unknown kind.");
      const r = await sql`update parent_child set kind = ${body.kind} where id = ${params.id!} returning id`;
      if (!r.length) throw new HttpError(404, "Link not found.");
    } else if (params.type === "partner") {
      if (!["married", "partner", "engaged"].includes(body.kind)) throw new HttpError(400, "Unknown kind.");
      const r = await sql`update partnerships set kind = ${body.kind}, status = ${body.status ?? "current"},
                          start_date = ${body.startDate}, end_date = ${body.endDate}, place = ${body.place}
                          where id = ${params.id!} returning id`;
      if (!r.length) throw new HttpError(404, "Partnership not found.");
    } else throw new HttpError(404, "Unknown relationship type.");
    await logActivity({ accountId: viewer.accountId, action: "relationship.updated", entityType: params.type, entityId: params.id, summary: `Updated a ${params.type} relationship` });
    return { ok: true };
  },
);

export const DELETE = api({ level: "editor" }, async ({ viewer, params }) => {
  let r;
  if (params.type === "parent") r = await sql`delete from parent_child where id = ${params.id!} returning id`;
  else if (params.type === "partner") r = await sql`delete from partnerships where id = ${params.id!} returning id`;
  else throw new HttpError(404, "Unknown relationship type.");
  if (!r.length) throw new HttpError(404, "Relationship not found.");
  await logActivity({ accountId: viewer.accountId, action: "relationship.removed", entityType: params.type, entityId: params.id, summary: `Removed a ${params.type} relationship` });
  return { ok: true };
});
