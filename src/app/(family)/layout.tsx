import { requireViewer, viewerInfo } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { sql } from "@/lib/db";
import { AppShell } from "@/components/shell/app-shell";
import { ViewerProvider } from "@/components/shell/viewer-context";

export const dynamic = "force-dynamic";

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const [settings, drive] = await Promise.all([
    getSettings(),
    sql<{ status: string }[]>`select status from drive_connection where id = 1`,
  ]);
  const value = { ...viewerInfo(viewer), familyName: settings.familyName, driveConnected: drive[0]?.status === "ok" };
  return (
    <ViewerProvider value={value}>
      <AppShell familyName={settings.familyName} logoMediaId={settings.logoMediaId}>{children}</AppShell>
    </ViewerProvider>
  );
}
