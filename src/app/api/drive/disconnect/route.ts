import { api } from "@/lib/http";
import { disconnect } from "@/lib/drive";
import { logActivity } from "@/lib/activity";

export const POST = api({ level: "admin" }, async ({ viewer }) => {
  await disconnect();
  await logActivity({ accountId: viewer.accountId, action: "drive.disconnected", summary: "Disconnected Google Drive (files stay in Drive)" });
  return { ok: true };
});
