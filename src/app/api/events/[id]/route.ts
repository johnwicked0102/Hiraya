import { api, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { EventInput } from "@/lib/event-input";
import { logActivity } from "@/lib/activity";
import type { Viewer } from "@/lib/session";

async function assertCanEdit(id: string, viewer: Viewer) {
  const [e] = await sql<{ createdBy: string | null; title: string }[]>`select created_by, title from events where id = ${id}`;
  if (!e) throw new HttpError(404, "Event not found.");
  if (!viewer.canEditTree && e.createdBy !== viewer.accountId) throw new HttpError(403, "Only editors or the person who added this can change it.");
  return e;
}

export const PATCH = api({ level: "contributor", body: EventInput }, async ({ viewer, body, params }) => {
  await assertCanEdit(params.id!, viewer);
  await sql.begin(async (tx) => {
    await tx`update events set title = ${body.title}, description = ${body.description}, kind = ${body.kind}, event_date = ${body.eventDate},
             date_precision = ${body.datePrecision}, location = ${body.location}, recurring = ${body.recurring}, media_id = ${body.mediaId ?? null}
             where id = ${params.id!}`;
    await tx`delete from event_people where event_id = ${params.id!}`;
    if (body.people.length) await tx`insert into event_people ${tx(body.people.map((p) => ({ eventId: params.id!, personId: p })))} on conflict do nothing`;
  });
  await logActivity({ accountId: viewer.accountId, action: "event.updated", entityType: "event", entityId: params.id, summary: `Edited “${body.title}”` });
  return { ok: true };
});

export const DELETE = api({ level: "contributor" }, async ({ viewer, params }) => {
  const e = await assertCanEdit(params.id!, viewer);
  await sql`delete from events where id = ${params.id!}`;
  await logActivity({ accountId: viewer.accountId, action: "event.deleted", entityType: "event", entityId: params.id, summary: `Removed “${e.title}” from the timeline` });
  return { ok: true };
});
