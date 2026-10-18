import { requireViewer } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { computeGenerations, loadTree } from "@/lib/family";
import { listMedia } from "@/lib/queries";
import { upcoming } from "@/lib/celebrations";
import { sql } from "@/lib/db";
import { Dashboard } from "./dashboard";

export const metadata = { title: "Home" };

function greetingFor(tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(new Date()));
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function HomePage() {
  const viewer = await requireViewer();
  const [settings, tree, media, soon, stats] = await Promise.all([
    getSettings(),
    loadTree(),
    listMedia(new URLSearchParams({ limit: "8" }), viewer.accountId),
    upcoming(45),
    sql<{ media: number; stories: number; capsules: number }[]>`
      select (select count(*)::int from media where deleted_at is null and purpose in ('memory','story')) as media,
             (select count(*)::int from stories) as stories,
             (select count(*)::int from time_capsules where unlock_at > now()) as capsules`,
  ]);
  const gens = computeGenerations(tree);
  const generationCount = tree.persons.length ? Math.max(...gens.values()) + 1 : 0;
  // Only honour the chosen featured photo while it still exists; otherwise fall back to the latest image.
  const featuredAlive = settings.featuredMediaId
    ? (await sql<{ id: string }[]>`select id from media where id = ${settings.featuredMediaId} and deleted_at is null`)[0]?.id ?? null
    : null;
  const featured = featuredAlive ?? media.items.find((m) => m.kind === "image")?.id ?? null;
  const recent = [...tree.persons].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")).slice(0, 6);
  const me = viewer.personId ? tree.persons.find((p) => p.id === viewer.personId) : null;
  return (
    <Dashboard
      familyName={settings.familyName}
      motto={settings.familyMotto}
      greeting={greetingFor(process.env.FAMILY_TIMEZONE || "Asia/Manila")}
      name={me?.nickname ?? me?.firstName ?? viewer.displayName.split(" ")[0]!}
      tree={tree}
      generations={Object.fromEntries(gens)}
      generationCount={generationCount}
      latest={media.items}
      upcoming={soon}
      featuredMediaId={featured}
      recent={recent}
      stats={stats[0] ?? { media: 0, stories: 0, capsules: 0 }}
    />
  );
}
