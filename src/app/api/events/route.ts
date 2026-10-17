import { api } from "@/lib/http";
import { sql } from "@/lib/db";
import { EventInput } from "@/lib/event-input";
import { logActivity } from "@/lib/activity";

export const POST = api({ level: "contributor", body: EventInput }, async ({ viewer, body }) => {
  // Viewers may add celebrations; historical and memorial records need an editor.
  const kind = !viewer.canEditTree && ["historical", "memorial"].includes(body.kind) ? "custom" : body.kind;
  const id = await sql.begin(async (tx) => {
    const [e] = await tx<{ id: string }[]>`
      insert into events (title, description, kind, event_date, date_precision, location, recurring, media_id, created_by)
      values (${body.title}, ${body.description}, ${kind}, ${body.eventDate}, ${body.datePrecision}, ${body.location},
              ${body.recurring}, ${body.mediaId ?? null}, ${viewer.accountId})
      returning id`;
    if (body.people.length) await tx`insert into event_people ${tx(body.people.map((p) => ({ eventId: e!.id, personId: p })))} on conflict do nothing`;
    return e!.id;
  });
  await logActivity({ accountId: viewer.accountId, action: "event.created", entityType: "event", entityId: id, summary: `Added “${body.title}” to the timeline` });
  return { id };
});
