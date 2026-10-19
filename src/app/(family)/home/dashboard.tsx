"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { UserPlus, Upload, PenLine, Hourglass, Cake, Heart, Flower, Sparkles, ArrowRight, Images, Users, Layers, BookOpen, ShieldAlert } from "lucide-react";
import { Countryside } from "@/components/scene/countryside";
import { Ambient } from "@/components/scene/ambient";
import { Portrait } from "@/components/portrait";
import { Button } from "@/components/ui/button";
import { useViewer } from "@/components/shell/viewer-context";
import { cn, formatDate, mediaUrl, shortName } from "@/lib/utils";
import type { Celebration } from "@/lib/celebrations-core";
import type { MediaItem, PersonLite, TreeData } from "@/lib/types";

const CMETA = {
  birthday: { icon: Cake, color: "var(--gold)" },
  anniversary: { icon: Heart, color: "var(--rose)" },
  memorial: { icon: Flower, color: "var(--dusk)" },
  event: { icon: Sparkles, color: "var(--forest)" },
} as const;

const W = 520, H = 360; // TreePreview's drawing space; portraits are placed in these units

function TreePreview({ tree, generations }: { tree: TreeData; generations: Record<string, number> }) {
  // Oldest generations become the roots and trunk; the youngest fill the canopy.
  const rows = useMemo(() => {
    const m = new Map<number, PersonLite[]>();
    for (const p of tree.persons) m.set(generations[p.id] ?? 0, [...(m.get(generations[p.id] ?? 0) ?? []), p]);
    return [...m.entries()].sort((a, b) => a[0] - b[0]).slice(-4).map(([, ps]) => ps.slice(0, 6));
  }, [tree, generations]);
  // Portraits are sized in px, so shrink them with the box on narrow screens to keep the composition intact.
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setScale(Math.min(1, e.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const placed: { p: PersonLite; x: number; y: number; r: number }[] = [];
  rows.forEach((ps, ri) => {
    const y = H - 70 - ri * ((H - 120) / Math.max(1, rows.length - 1 || 1));
    const r = ri === 0 ? 30 : 26;
    // Keep every portrait fully inside the drawing (the uncapped spread reached past both edges).
    const spread = Math.min(120 + ri * 70, W / 2 - r - 4);
    ps.forEach((p, i) => {
      const x = W / 2 + (ps.length === 1 ? 0 : (i / (ps.length - 1) - 0.5) * spread * 2 * (ri === 0 ? 0.6 : 1));
      placed.push({ p, x, y: y + (i % 2 ? -10 : 8), r });
    });
  });
  return (
    <div ref={box} className="relative mx-auto aspect-[52/36] w-full max-w-[520px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
        <ellipse cx={W / 2} cy={H - 20} rx="200" ry="18" fill="var(--moss)" opacity="0.35" />
        <path d={`M${W / 2 - 22} ${H - 20} C ${W / 2 - 16} ${H - 120}, ${W / 2 - 30} ${H - 170}, ${W / 2 - 90} ${H - 230} M${W / 2 + 22} ${H - 20} C ${W / 2 + 16} ${H - 120}, ${W / 2 + 30} ${H - 170}, ${W / 2 + 100} ${H - 240} M${W / 2} ${H - 20} C ${W / 2} ${H - 140}, ${W / 2 + 4} ${H - 220}, ${W / 2} ${H - 300}`}
          stroke="var(--trunk, #6b4b35)" strokeWidth="18" strokeLinecap="round" fill="none" opacity="0.75" />
        <g opacity="0.5">
          <circle cx={W / 2 - 120} cy={110} r="80" fill="var(--tree-light)" />
          <circle cx={W / 2 + 120} cy={100} r="86" fill="var(--tree-mid)" />
          <circle cx={W / 2} cy={70} r="96" fill="var(--tree-light)" />
        </g>
      </svg>
      {placed.map(({ p, x, y, r }, i) => (
        <motion.div key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
          initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 140, delay: 0.3 + i * 0.06 }}>
          <Link href={`/people/${p.id}`} title={shortName(p)} className="block transition hover:scale-110">
            <Portrait person={p} size={Math.round(r * 2 * scale)} thumb={160} frame="round" />
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

export function Dashboard(props: {
  familyName: string; motto: string; greeting: string; name: string; tree: TreeData; generations: Record<string, number>;
  generationCount: number; latest: MediaItem[]; upcoming: Celebration[]; featuredMediaId: string | null; recent: PersonLite[];
  stats: { media: number; stories: number; capsules: number };
}) {
  const viewer = useViewer();
  const byId = useMemo(() => new Map(props.tree.persons.map((p) => [p.id, p])), [props.tree]);
  const quick = [
    viewer.canEditTree && { href: "/tree", label: "Add a relative", icon: UserPlus, tone: "bg-meadow/35" },
    viewer.canContribute && { href: "/memories", label: "Share memories", icon: Upload, tone: "bg-sky/40" },
    viewer.canContribute && { href: "/stories/new", label: "Write a story", icon: PenLine, tone: "bg-sun/40" },
    { href: "/capsules", label: "Seal a time capsule", icon: Hourglass, tone: "bg-rose/25" },
  ].filter(Boolean) as { href: string; label: string; icon: typeof UserPlus; tone: string }[];

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <Countryside variant="home" />
        <Ambient leaves={6} butterflies={2} fireflies={20} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:pt-20">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
            <p className="inline-block rounded-full bg-surface/80 px-4 py-1.5 text-sm font-bold text-forest-deep backdrop-blur">{props.greeting}, {props.name} 🌿</p>
            <h1 className="h-display mt-4 text-5xl text-ink drop-shadow-[0_1px_0_rgb(255_255_255/.4)] sm:text-6xl">The {props.familyName} Family</h1>
            <p className="mt-4 max-w-xl font-display text-2xl italic leading-snug text-ink-soft">{props.motto}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild><Link href="/tree">Explore the family tree <ArrowRight /></Link></Button>
              <Button size="lg" variant="secondary" asChild><Link href="/memories"><Images /> Memory Garden</Link></Button>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 0.15 }}
            className="card bg-surface/80 p-4 backdrop-blur-md">
            {props.tree.persons.length ? <TreePreview tree={props.tree} generations={props.generations} /> : (
              <div className="grid aspect-[52/36] place-items-center text-center text-ink-soft"><p>Your family tree will grow here.<br />{viewer.canEditTree && <Link className="font-bold text-forest" href="/tree">Plant the first seed →</Link>}</p></div>
            )}
          </motion.div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-10 max-w-7xl space-y-10 px-4 pb-16 sm:px-6">
        {viewer.role === "admin" && !viewer.isAdmin && (
          <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-gold/20 p-4 font-semibold">
            <ShieldAlert className="size-5 shrink-0 text-gold" />
            <span>You&apos;re signed in with a family code. Admin tools need your password and authenticator.</span>
            <Button size="sm" className="ml-auto" asChild><Link href="/admin-login?next=/admin">Admin sign-in</Link></Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Family members", value: props.tree.persons.length, icon: Users },
            { label: "Generations", value: props.generationCount, icon: Layers },
            { label: "Memories kept", value: props.stats.media, icon: Images },
            { label: "Stories told", value: props.stats.stories, icon: BookOpen },
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }} className="card p-5">
              <s.icon className="size-5 text-moss" />
              <p className="h-display mt-2 text-4xl">{s.value}</p>
              <p className="text-sm font-bold text-ink-soft">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quick.map((q) => (
            <Link key={q.label} href={q.href} className={cn("group flex flex-col items-start gap-2 rounded-3xl p-4 font-bold leading-snug transition hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-3 sm:p-5", q.tone)}>
              <span className="grid size-11 place-items-center rounded-2xl bg-surface/80"><q.icon className="size-5 text-forest" /></span>
              {q.label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Featured photo */}
          <section className="card overflow-hidden">
            {props.featuredMediaId ? (
              <Link href="/memories" className="group relative block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(props.featuredMediaId, { thumb: 1400 })} alt="Featured family photograph" className="aspect-[16/10] w-full object-cover transition duration-700 group-hover:scale-[1.02]" />
                <span className="absolute bottom-4 left-4 rounded-full bg-surface/85 px-4 py-1.5 text-sm font-bold backdrop-blur">Featured memory</span>
              </Link>
            ) : (
              <div className="grid h-full min-h-56 place-items-center bg-gradient-to-br from-meadow/30 to-sky/30 p-8 text-center text-ink-soft">
                The first photo you share will be featured here.
              </div>
            )}
          </section>

          {/* Upcoming */}
          <section className="card p-6">
            <div className="mb-4 flex items-center justify-between"><h2 className="h-display text-2xl">Coming up</h2><Link href="/calendar" className="text-sm font-bold text-forest hover:underline">Calendar →</Link></div>
            {props.upcoming.length === 0 ? <p className="text-ink-soft">No celebrations in the next few weeks.</p> : (
              <ul className="space-y-2">
                {props.upcoming.slice(0, 6).map((c) => {
                  const M = CMETA[c.type];
                  const p = c.personIds[0] ? byId.get(c.personIds[0]) : undefined;
                  const isToday = c.date === new Date().toISOString().slice(0, 10);
                  return (
                    <li key={c.key}>
                      <Link href={p ? `/people/${p.id}` : "/calendar"} className={cn("flex items-center gap-3 rounded-2xl p-2.5 hover:bg-surface-2", isToday && "bg-sun/30")}>
                        {p ? <Portrait person={p} size={44} thumb={128} frame="round" /> : <span className="grid size-11 place-items-center rounded-full" style={{ background: M.color }}><M.icon className="size-5 text-white" /></span>}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{c.title}</p>
                          <p className="text-sm text-ink-faint">{new Date(`${c.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}{c.type === "birthday" && c.years ? ` · turns ${c.years}` : ""}</p>
                        </div>
                        <M.icon className="size-5" style={{ color: M.color }} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Latest memories */}
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1"><h2 className="h-display text-2xl sm:text-3xl">Freshly bloomed</h2><Link href="/memories" className="whitespace-nowrap font-bold text-forest hover:underline">Memory Garden →</Link></div>
          {props.latest.length === 0 ? <div className="card p-10 text-center text-ink-soft">Photos and videos the family shares will appear here.</div> : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {props.latest.slice(0, 8).map((m, i) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }}>
                  <Link href="/memories" className={cn("block rounded-md bg-[#fffdf7] p-2 pb-3 shadow-[0_10px_24px_-14px_rgb(var(--shadow)/.55)] transition hover:rotate-0 hover:scale-[1.03] dark:bg-surface-2", i % 2 ? "rotate-[1deg]" : "-rotate-[1deg]")}>
                    {m.kind === "image" || m.kind === "video" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(m.id, { thumb: 400 })} alt={m.title ?? ""} loading="lazy" className="aspect-square w-full rounded-sm object-cover" />
                    ) : <div className="grid aspect-square place-items-center rounded-sm bg-surface-2 text-ink-soft">{m.kind === "audio" ? "🎙️" : "📄"}</div>}
                    <p className="mt-2 truncate px-1 font-display text-sm text-[#3a3226] dark:text-ink">{m.title ?? m.caption ?? (m.takenOn ? formatDate(m.takenOn, "day", "short") : m.fileName)}</p>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Recently added */}
        {props.recent.length > 0 && (
          <section>
            <h2 className="h-display mb-4 text-2xl sm:text-3xl">New branches</h2>
            <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
              {props.recent.map((p) => (
                <Link key={p.id} href={`/people/${p.id}`} className="card flex w-40 shrink-0 flex-col items-center p-4 text-center transition hover:-translate-y-1">
                  <Portrait person={p} size={84} thumb={240} />
                  <p className="mt-3 font-display font-semibold leading-tight">{shortName(p)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="pt-4 text-center font-display text-xl italic text-ink-soft">“Every branch tells a story. Every memory keeps us together.”</p>
      </div>
    </div>
  );
}
