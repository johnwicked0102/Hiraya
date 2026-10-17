import { api } from "@/lib/http";
import { destroyCurrentSession } from "@/lib/session";

export const POST = api({ level: "public" }, async () => {
  await destroyCurrentSession();
  return { ok: true };
});
