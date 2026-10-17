import { api, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { getPerson } from "@/lib/family";
import { PersonInput } from "@/lib/person-input";
import { diff, logActivity } from "@/lib/activity";
import { fullName } from "@/lib/utils";

export const GET = api({ level: "member" }, async ({ viewer, params }) => {
  const p = await getPerson(params.id!, viewer);
  if (!p) throw new HttpError(404, "Family member not found.");
  return p;
});

export const PATCH = api({ level: "member", body: PersonInput.partial() }, async ({ viewer, body, params }) => {
  const id = params.id!;
  // Editors and admins can edit anyone; a member can edit their own profile.
  if (!viewer.canEditTree && viewer.personId !== id) throw new HttpError(403, "You can edit your own profile; ask an editor to change others.");
  const before = await getPerson(id, viewer);
  if (!before) throw new HttpError(404, "Family member not found.");
  if (body.sensitive && !(viewer.isAdmin || viewer.personId === id)) delete body.sensitive;

  const cols: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue;
    if (k === "photoCrop" || k === "sensitive") cols[k] = v === null ? null : sql.json(v as never);
    else cols[k] = v;
  }
  if (!Object.keys(cols).length) return { ok: true };
  await sql`update persons set ${sql(cols)}, updated_at = now() where id = ${id}`;

  const changes = diff(before as unknown as Record<string, unknown>, body as Record<string, unknown>);
  delete changes.sensitive; // never write private details into the log
  if (Object.keys(changes).length) {
    await logActivity({
      accountId: viewer.accountId, action: "person.updated", entityType: "person", entityId: id,
      summary: `Updated ${fullName(before)} (${Object.keys(changes).join(", ")})`, details: changes,
    });
  }
  return { ok: true };
});

export const DELETE = api({ level: "admin" }, async ({ viewer, params }) => {
  const [p] = await sql<{ firstName: string; middleName: string | null; lastName: string | null }[]>`
    update persons set deleted_at = now() where id = ${params.id!} and deleted_at is null
    returning first_name, middle_name, last_name`;
  if (!p) throw new HttpError(404, "Family member not found.");
  await logActivity({ accountId: viewer.accountId, action: "person.removed", entityType: "person", entityId: params.id, summary: `Removed ${fullName(p)} from the tree (restorable from backup)` });
  return { ok: true };
});
