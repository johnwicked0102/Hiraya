"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Baby, Flower, Heart, Sparkles, Images, BookOpen, Plus, MapPin, Pencil } from "lucide-react";
import { Page, PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Portrait } from "@/components/portrait";
import { useViewer } from "@/components/shell/viewer-context";
import { EventForm, EVENT_KINDS, type EventValue } from "@/components/heritage/event-form";
import { cn, formatDate, fullName, mediaUrl, shortName } from "@/lib/utils";
import type { TimelineItem } from "@/lib/timeline";
import type { TreeData } from "@/lib/types";

const TYPE_META: Record<TimelineItem["type"], { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  birth: { label: "Births", icon: Baby, color: "var(--sky-deep)" },
  marriage: { label: "Marriages", icon: Heart, color: "var(--rose)" },
  event: { label: "Milestones", icon: Sparkles, color: "var(--gold)" },
  album: { label: "Gatherings", icon: Images, color: "var(--moss)" },
  story: { label: "Stories", icon: BookOpen, color: "var(--forest)" },
  death: { label: "Remembrances", icon: Flower, color: "var(--dusk)" },
};

export function TimelineView({ items, tree, generations }: { items: TimelineItem[]; tree: TreeData; generations: Record<string, number> }) {
  const viewer = useViewer();
  const router = useRouter();
  const [person, setPerson] = useState("");
  const [gen, setGen] = useState("");
  const [types, setTypes] = useState<Set<string>>(new Set(Object.keys(TYPE_META)));
  const [form, setForm] = useState<{ open: boolean; initial?: EventValue | null }>({ open: false });
  const byId = useMemo(() => new Map(tree.persons.map((p) => [p.id, p])), [tree]);
  const maxGen = Math.max(0, ...Object.values(generations));

  const filtered = useMemo(() => items.filter((it) => {
    if (!types.has(it.type)) return false;
    if (person && !it.people.includes(person)) return false;
    if (gen !== "" && !it.people.some((p) => String(generations[p] ?? -1) === gen)) return false;
    return true;
  }), [items, types, person, gen, generations]);

  const decades = useMemo(() => {
    const m = new Map<number, TimelineItem[]>();
    for (const it of filtered) {
      const d = Math.floor(Number(it.date.slice(0, 4)) / 10) * 10;
      m.set(d, [...(m.get(d) ?? []), it]);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  return (
    <Page>
      <PageHeader eyebrow="Family Timeline" title="Our story, year by year"
        subtitle="Births and weddings, reunions and milestones, and the moments we remember together."
        actions={viewer.canContribute ? <Button onClick={() => setForm({ open: true, initial: null })}><Plus /> Add a moment</Button> : undefined} />

      <div className="card mb-8 space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {Object.entries(TYPE_META).map(([k, m]) => {
            const on = types.has(k);
            return (
              <button key={k} type="button" aria-pressed={on}
                onClick={() => setTypes((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold transition", on ? "border-transparent text-white" : "border-line text-ink-faint")}
                style={on ? { background: m.color } : undefined}>
                <m.icon className="size-4" /> {m.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={person} onChange={(e) => setPerson(e.target.value)} className="w-auto max-w-64" aria-label="Family member">
            <option value="">Everyone</option>
            {[...tree.persons].sort((a, b) => fullName(a).localeCompare(fullName(b))).map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
          </Select>
          <Select value={gen} onChange={(e) => setGen(e.target.value)} className="w-auto" aria-label="Generation">
            <option value="">All generations</option>
            {Array.from({ length: maxGen + 1 }, (_, i) => <option key={i} value={i}>Generation {i + 1}</option>)}
          </Select>
          {decades.length > 1 && (
            <div className="ml-auto flex flex-wrap gap-1">
              {decades.map(([d]) => <a key={d} href={`#decade-${d}`} className="rounded-lg px-2 py-1 text-sm font-bold text-ink-soft hover:bg-surface-2 hover:text-ink">{d}s</a>)}
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-ink-soft">The timeline grows as you add birthdays, weddings and milestones to the family tree.</div>
      ) : (
        <div className="relative overflow-x-clip">
          {/* overflow-x-clip: cards slide in sideways and would otherwise widen the page until scrolled into view (clip, unlike hidden, keeps the sticky decade labels working). */}
          <div className="absolute bottom-0 left-5 top-0 w-1 rounded-full bg-gradient-to-b from-meadow via-moss to-forest md:left-1/2 md:-translate-x-1/2" aria-hidden />
          {decades.map(([decade, list]) => (
            <section key={decade} id={`decade-${decade}`} className="relative scroll-mt-24 pb-6">
              <div className="sticky top-20 z-10 mb-6 flex md:justify-center">
                <span className="ml-0 rounded-full bg-forest px-5 py-2 font-display text-xl font-semibold text-[#fffaf0] shadow-lg dark:text-[#14211a]">{decade}s</span>
              </div>
              <ol className="space-y-6">
                {list.map((it, i) => {
                  const m = TYPE_META[it.type];
                  const left = i % 2 === 0;
                  const canEdit = it.type === "event" && (viewer.canEditTree || it.createdBy === viewer.accountId);
                  const card = (
                    <motion.div
                      initial={{ opacity: 0, x: left ? -30 : 30, y: 10 }}
                      whileInView={{ opacity: 1, x: 0, y: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ type: "spring", stiffness: 120, damping: 18 }}
                      className={cn("card overflow-hidden", it.type === "death" && "memorial")}
                    >
                      {it.mediaId && it.type !== "birth" && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(it.mediaId, { thumb: 800 })} alt="" loading="lazy" className="h-44 w-full object-cover" />
                      )}
                      <div className="p-5">
                        <p className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider" style={{ color: m.color }}>
                          <m.icon className="size-4" /> {formatDate(it.date, it.precision)}
                          {it.kind && it.type === "event" && <span className="font-bold normal-case tracking-normal text-ink-faint">· {EVENT_KINDS[it.kind] ?? it.kind}</span>}
                        </p>
                        <h3 className="h-display mt-1 text-xl">{it.href ? <Link href={it.href} className="hover:text-forest">{it.title}</Link> : it.title}</h3>
                        {it.location && <p className="mt-1 flex items-center gap-1 text-sm text-ink-faint"><MapPin className="size-3.5" /> {it.location}</p>}
                        {it.description && <p className="mt-2 line-clamp-4 whitespace-pre-line text-ink-soft">{it.description}</p>}
                        {it.people.length > 0 && it.type !== "birth" && it.type !== "death" && (
                          <div className="mt-3 flex -space-x-2">
                            {it.people.slice(0, 8).map((pid) => {
                              const p = byId.get(pid);
                              return p ? <Link key={pid} href={`/people/${pid}`} title={shortName(p)}><Portrait person={p} size={34} thumb={96} frame="round" className="!shadow-[0_0_0_2px_var(--surface)]" /></Link> : null;
                            })}
                          </div>
                        )}
                        {(it.type === "birth" || it.type === "death") && byId.get(it.people[0]!) && (
                          <Link href={`/people/${it.people[0]}`} className="mt-3 flex items-center gap-3">
                            <Portrait person={byId.get(it.people[0]!)!} size={44} thumb={128} />
                            <span className="text-sm font-bold text-forest">Visit their story →</span>
                          </Link>
                        )}
                        {canEdit && (
                          <button className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-ink-faint hover:text-ink" onClick={() => {
                            const ev = it;
                            setForm({ open: true, initial: { id: ev.eventId, title: ev.title, description: ev.description, kind: ev.kind ?? "milestone", eventDate: ev.date, datePrecision: ev.precision, location: ev.location, recurring: !!ev.recurring, mediaId: ev.mediaId, people: ev.people } });
                          }}><Pencil className="size-3.5" /> Edit</button>
                        )}
                      </div>
                    </motion.div>
                  );
                  return (
                    <li key={it.id} className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)]">
                      <div className={cn("hidden md:block", left ? "pr-2" : "")}>{left && card}</div>
                      <div className="flex justify-center pt-6">
                        <span className="z-[1] grid size-6 place-items-center rounded-full border-4 border-bg" style={{ background: m.color }} />
                      </div>
                      <div className="md:hidden">{card}</div>
                      <div className={cn("hidden md:block", !left ? "pl-2" : "")}>{!left && card}</div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
      <EventForm open={form.open} onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))} people={tree.persons} initial={form.initial} onSaved={() => router.refresh()} />
    </Page>
  );
}
