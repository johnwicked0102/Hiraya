import { api } from "@/lib/http";
import { sql } from "@/lib/db";

export const GET = api({ level: "admin" }, async ({ req }) => {
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0));
  const action = req.nextUrl.searchParams.get("action");
  const items = await sql`
    select l.id::text, l.action, l.entity_type, l.entity_id, l.summary, l.details, l.ip, l.created_at, a.display_name as actor
    from activity_log l left join accounts a on a.id = l.account_id
    ${action ? sql`where l.action like ${action.replace(/[%_]/g, "") + "%"}` : sql``}
    order by l.created_at desc limit 101 offset ${offset}`;
  return { items: items.slice(0, 100), hasMore: items.length > 100 };
});
