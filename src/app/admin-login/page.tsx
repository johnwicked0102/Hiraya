import { Countryside } from "@/components/scene/countryside";
import { AdminLoginForm } from "./form";

export const metadata = { title: "Administrator sign-in" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/admin";
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <Countryside variant="subtle" />
      <AdminLoginForm next={next} />
    </main>
  );
}
