import { api, HttpError } from "@/lib/http";
import { sql } from "@/lib/db";

export const DELETE = api({ level: "member" }, async ({ viewer, params }) => {
  const r = viewer.isAdmin
    ? await sql`delete from greetings where id = ${params.id!} returning id`
    : await sql`delete from greetings where id = ${params.id!} and author_id = ${viewer.accountId} returning id`;
  if (!r.length) throw new HttpError(404, "Card not found.");
  return { ok: true };
});
