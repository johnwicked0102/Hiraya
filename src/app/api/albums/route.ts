import { z } from "zod";
import { api, zDate, zText } from "@/lib/http";
import { sql } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { listAlbums } from "@/lib/queries";

export const GET = api({ level: "member" }, async () => ({ albums: await listAlbums() }));

export const POST = api(
  { level: "contributor", body: z.object({ title: z.string().trim().min(1).max(120), description: zText(1000), eventDate: zDate }) },
  async ({ viewer, body }) => {
    const [a] = await sql<{ id: string }[]>`
      insert into albums (title, description, event_date, created_by) values (${body.title}, ${body.description}, ${body.eventDate}, ${viewer.accountId})
      returning id`;
    await logActivity({ accountId: viewer.accountId, action: "album.created", entityType: "album", entityId: a!.id, summary: `Created album “${body.title}”` });
    return { id: a!.id };
  },
);
