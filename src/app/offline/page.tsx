import { Countryside } from "@/components/scene/countryside";

export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-6">
      <Countryside variant="subtle" />
      <div className="card relative z-10 max-w-md p-8 text-center">
        <h1 className="h-display text-3xl">The path is quiet right now</h1>
        <p className="mt-3 text-ink-soft">Hiraya needs an internet connection to open the family archive. Check your Wi-Fi or mobile data, then try again.</p>
        <a href="/home" className="mt-6 inline-flex h-12 items-center rounded-2xl bg-forest px-6 font-bold text-[#fffaf0]">Try again</a>
      </div>
    </main>
  );
}
