import { api, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";
import { logActivity } from "@/lib/activity";

/** Authors can withdraw their capsule; admins can remove any (contents are never shown to them early). */
export const DELETE = api({ level: "member" }, async ({ viewer, params }) => {
  const r = viewer.isAdmin
    ? await sql<{ title: string }[]>`delete from time_capsules where id = ${params.id!} returning title`
    : await sql<{ title: string }[]>`delete from time_capsules where id = ${params.id!} and author_id = ${viewer.accountId} returning title`;
  if (!r.length) throw new HttpError(404, "Capsule not found.");
  await logActivity({ accountId: viewer.accountId, action: "capsule.removed", entityType: "capsule", entityId: params.id, summary: `Removed a time capsule` });
  return { ok: true };
});
