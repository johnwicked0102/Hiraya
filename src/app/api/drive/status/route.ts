import { api } from "@/lib/http";
import { sql } from "@/lib/db";
import { getConnection, rootFolderLink, storageQuota } from "@/lib/drive";

export const GET = api({ level: "admin" }, async () => {
  const conn = await getConnection();
  const [stats] = await sql<{ files: number; bytes: string }[]>`
    select count(*)::int as files, coalesce(sum(size_bytes), 0)::text as bytes from media where deleted_at is null`;
  if (!conn) return { connected: false, files: stats?.files ?? 0, archiveBytes: stats?.bytes ?? "0" };
  let quota: { limit?: string; usage?: string } | null = null;
  try {
    quota = (await storageQuota()).storageQuota;
  } catch {
    quota = null;
  }
  return {
    connected: true,
    status: conn.status,
    email: conn.googleEmail,
    folderUrl: conn.rootFolderId ? rootFolderLink(conn.rootFolderId) : null,
    quota,
    files: stats?.files ?? 0,
    archiveBytes: stats?.bytes ?? "0",
    configured: !!process.env.GOOGLE_CLIENT_ID,
  };
});
