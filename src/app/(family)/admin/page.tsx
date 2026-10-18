import { requireAdminPage } from "@/lib/session";
import { listAccounts } from "@/lib/admin";
import { loadTree } from "@/lib/family";
import { getSettings } from "@/lib/settings";
import { sql } from "@/lib/db";
import { AdminDashboard } from "./admin-dashboard";

export const metadata = { title: "Admin" };

// TEMP diagnostics: log how long each step takes and fail fast (instead of the
// 300s Vercel timeout) so the function logs show which step stalls.
async function step<T>(label: string, p: PromiseLike<T>, ms = 20_000): Promise<T> {
  const t0 = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(p),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`[admin] "${label}" did not finish within ${ms / 1000}s`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    console.log(`[admin] ${label}: ${Date.now() - t0}ms`);
  }
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; drive?: string; welcome?: string }> }) {
  const viewer = await step("requireAdminPage", requireAdminPage());
  const sp = await step("searchParams", searchParams);
  const [accounts, tree, settings, requests, images] = await Promise.all([
    step("listAccounts", listAccounts()),
    step("loadTree", loadTree()),
    step("getSettings", getSettings()),
    step("access_requests", sql<{ id: string; fullName: string; relationship: string | null; contact: string | null; message: string | null; status: string; createdAt: string }[]>`
      select id, full_name, relationship, contact, message, status, created_at from access_requests order by status = 'pending' desc, created_at desc limit 200`),
    step("media", sql<{ id: string }[]>`select id from media where kind = 'image' and deleted_at is null and purpose in ('memory','logo') order by created_at desc limit 30`),
  ]);
  console.log(`[admin] data loaded: ${accounts.length} accounts, ${tree.persons.length} people, ${requests.length} requests`);
  return (
    <AdminDashboard
      me={viewer.accountId}
      accounts={accounts}
      people={tree.persons}
      settings={settings}
      requests={requests}
      recentImages={images.map((i) => i.id)}
      initialTab={sp.tab ?? "members"}
      driveNotice={sp.drive ?? null}
      welcome={sp.welcome === "1"}
    />
  );
}
