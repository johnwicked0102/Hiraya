import Link from "next/link";
import { Countryside } from "@/components/scene/countryside";

export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-6">
      <Countryside variant="subtle" />
      <div className="card relative z-10 max-w-md p-8 text-center">
        <h1 className="h-display text-3xl">This path leads nowhere</h1>
        <p className="mt-3 text-ink-soft">The page you were looking for has wandered off into the fields.</p>
        <Link href="/home" className="mt-6 inline-flex h-12 items-center rounded-2xl bg-forest px-6 font-bold text-[#fffaf0]">Back home</Link>
      </div>
    </main>
  );
}
