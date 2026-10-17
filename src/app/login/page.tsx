import { redirect } from "next/navigation";
import { getViewer } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { Countryside } from "@/components/scene/countryside";
import { Ambient } from "@/components/scene/ambient";
import { LoginGate } from "./login-gate";

export const metadata = { title: "Welcome home" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  if (await getViewer()) redirect("/home");
  const settings = await getSettings().catch(() => null);
  const sp = await searchParams;
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <Countryside variant="gate" />
      <Ambient leaves={8} butterflies={2} fireflies={22} />
      <LoginGate familyName={settings?.familyName ?? "Our Family"} expired={sp.expired === "1"} />
    </main>
  );
}
