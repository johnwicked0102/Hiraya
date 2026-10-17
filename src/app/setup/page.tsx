import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { Countryside } from "@/components/scene/countryside";
import { SetupWizard } from "./wizard";

export const metadata = { title: "Set up Hiraya" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [r] = await sql<{ n: number }[]>`select count(*)::int as n from accounts where role = 'admin' and totp_enabled`;
  if ((r?.n ?? 0) > 0) redirect("/login");
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <Countryside variant="home" />
      <SetupWizard />
    </main>
  );
}
