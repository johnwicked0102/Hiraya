import { api } from "@/lib/http";
import { sql } from "@/lib/db";

export const GET = api({ level: "admin" }, async () => ({
  requests: await sql`select id, full_name, relationship, contact, message, status, created_at, handled_at
                      from access_requests order by status = 'pending' desc, created_at desc limit 200`,
}));
