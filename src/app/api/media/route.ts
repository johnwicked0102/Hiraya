import { api } from "@/lib/http";
import { listMedia } from "@/lib/queries";

export const GET = api({ level: "member" }, async ({ req, viewer }) => listMedia(req.nextUrl.searchParams, viewer.accountId));

