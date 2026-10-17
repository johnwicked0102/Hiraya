"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { PenLine, Paperclip } from "lucide-react";
import { Page, PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Portrait } from "@/components/portrait";
import { useViewer } from "@/components/shell/viewer-context";
import { KIND_LABELS } from "@/lib/story-kinds";
import { cn, mediaUrl, timeAgo } from "@/lib/utils";
import type { PersonLite } from "@/lib/types";
import type { StorySummary } from "@/lib/stories";

export function StoriesList({ stories, people }: { stories: StorySummary[]; people: PersonLite[] }) {
  const viewer = useViewer();
  const [kind, setKind] = useState<string | null>(null);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const list = kind ? stories.filter((s) => s.kind === kind) : stories;
  const counts = useMemo(() => stories.reduce<Record<string, number>>((a, s) => ({ ...a, [s.kind]: (a[s.kind] ?? 0) + 1 }), {}), [stories]);
  return (
    <Page>
      <PageHeader eyebrow="Family Stories & Legacy" title="The stories we carry"
        subtitle="Tales, recipes, traditions, letters and voices — so the next generation knows where they come from."
        actions={viewer.canContribute ? <Button asChild><Link href="/stories/new"><PenLine /> Write a story</Link></Button> : undefined} />
      <div className="mb-8 flex flex-wrap gap-2">
        <button onClick={() => setKind(null)} className={cn("rounded-full px-4 py-2 font-bold transition", !kind ? "bg-forest text-[#fffaf0] dark:text-[#14211a]" : "bg-surface-2 text-ink-soft hover:text-ink")}>All · {stories.length}</button>
        {Object.entries(KIND_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setKind(k)} className={cn("rounded-full px-4 py-2 font-bold transition", kind === k ? "bg-forest text-[#fffaf0] dark:text-[#14211a]" : "bg-surface-2 text-ink-soft hover:text-ink")}>
            {v.emoji} {v.label}{counts[k] ? ` · ${counts[k]}` : ""}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="h-display text-2xl">No stories here yet</p>
          <p className="mt-2 text-ink-soft">Ask Lola about her childhood. Write down Tito&apos;s adobo. Record Lolo singing. It all starts with one story.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s, i) => {
            const k = KIND_LABELS[s.kind] ?? KIND_LABELS.story!;
            return (
              <motion.article key={s.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 6) * 0.05 }}>
                <Link href={`/stories/${s.id}`} className="card group flex h-full flex-col overflow-hidden transition hover:-translate-y-1">
                  {s.coverMediaId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(s.coverMediaId, { thumb: 640 })} alt="" loading="lazy" className="h-44 w-full object-cover" />
                  ) : (
                    <div className="grid h-28 place-items-center bg-gradient-to-br from-meadow/40 via-sun/30 to-sky/40 text-5xl">{k.emoji}</div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-moss">{k.label}</p>
                    <h2 className="h-display mt-1 text-xl group-hover:text-forest">{s.title}</h2>
                    <p className="mt-2 line-clamp-3 flex-1 text-ink-soft">{s.body}</p>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {s.people.slice(0, 4).map((pid) => byId.get(pid) && <Portrait key={pid} person={byId.get(pid)!} size={28} thumb={64} frame="round" className="!shadow-[0_0_0_2px_var(--surface)]" />)}
                      </div>
                      <p className="ml-auto text-right text-xs text-ink-faint">
                        {s.mediaCount > 0 && <span className="mr-2 inline-flex items-center gap-0.5"><Paperclip className="size-3" />{s.mediaCount}</span>}
                        {s.authorName ?? "Family"} · {timeAgo(s.createdAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.article>
            );
          })}
        </div>
      )}
    </Page>
  );
}
