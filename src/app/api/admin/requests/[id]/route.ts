import { z } from "zod";
import { api, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const PATCH = api({ level: "admin", body: z.object({ status: z.enum(["approved", "declined", "pending"]) }) }, async ({ viewer, body, params }) => {
  const [r] = await sql<{ fullName: string }[]>`update access_requests set status = ${body.status}, handled_by = ${viewer.accountId}, handled_at = now()
                      where id = ${params.id!} returning full_name`;
  if (!r) throw new HttpError(404, "Request not found.");
  await logActivity({ accountId: viewer.accountId, action: `request.${body.status}`, entityType: "access_request", entityId: params.id, summary: `Marked ${r.fullName}'s request as ${body.status}` });
  return { ok: true };
});

export const DELETE = api({ level: "admin" }, async ({ params }) => {
  await sql`delete from access_requests where id = ${params.id!}`;
  return { ok: true };
});
