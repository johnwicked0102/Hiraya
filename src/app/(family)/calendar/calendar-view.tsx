"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Cake, Heart, Flower, Sparkles, Plus, CalendarPlus, Copy, Gift } from "lucide-react";
import { Page, PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useViewer } from "@/components/shell/viewer-context";
import { Portrait } from "@/components/portrait";
import { EventForm } from "@/components/heritage/event-form";
import { GreetingComposer } from "@/components/people/greetings";
import { addDays, occurrences, type Celebration, type Source } from "@/lib/celebrations-core";
import { api, ApiError } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { PersonLite } from "@/lib/types";

const META = {
  birthday: { icon: Cake, color: "var(--gold)", label: "Birthday" },
  anniversary: { icon: Heart, color: "var(--rose)", label: "Anniversary" },
  memorial: { icon: Flower, color: "var(--dusk)", label: "Remembrance" },
  event: { icon: Sparkles, color: "var(--forest)", label: "Family event" },
} as const;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describe(c: Celebration) {
  if (c.years === null || c.years <= 0) return null;
  if (c.type === "birthday") return `turns ${c.years}`;
  if (c.type === "anniversary") return `${c.years} year${c.years === 1 ? "" : "s"} together`;
  if (c.type === "memorial") return `${c.years} year${c.years === 1 ? "" : "s"} remembered`;
  return `${c.years} year${c.years === 1 ? "" : "s"} ago`;
}

export function CalendarView({ sources, people, today }: { sources: Source[]; people: PersonLite[]; today: string }) {
  const viewer = useViewer();
  const router = useRouter();
  const toast = useToast();
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));
  const [selected, setSelected] = useState<string>(today);
  const [eventOpen, setEventOpen] = useState(false);
  const [feed, setFeed] = useState<string | null>(null);
  const [feedOpen, setFeedOpen] = useState(false);
  const [card, setCard] = useState<PersonLite | null>(null);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const first = `${ym.y}-${String(ym.m).padStart(2, "0")}-01`;
  const daysInMonth = new Date(ym.y, ym.m, 0).getDate();
  const last = `${ym.y}-${String(ym.m).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const monthItems = useMemo(() => occurrences(sources, first, last), [sources, first, last]);
  const upcoming = useMemo(() => occurrences(sources, today, addDays(today, 60)), [sources, today]);
  const byDay = useMemo(() => {
    const m = new Map<string, Celebration[]>();
    for (const c of monthItems) m.set(c.date, [...(m.get(c.date) ?? []), c]);
    return m;
  }, [monthItems]);
  const startWeekday = new Date(ym.y, ym.m - 1, 1).getDay();
  const cells = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthName = new Date(ym.y, ym.m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedItems = byDay.get(selected) ?? occurrences(sources, selected, selected);
  const move = (d: number) => setYm(({ y, m }) => { const n = m + d; return n < 1 ? { y: y - 1, m: 12 } : n > 12 ? { y: y + 1, m: 1 } : { y, m: n }; });

  async function makeFeed() {
    try {
      const r = await api<{ url: string }>("/api/account/calendar-token", { method: "POST" });
      setFeed(r.url);
      setFeedOpen(true);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't create the calendar link", "error");
    }
  }

  const Item = ({ c, compact }: { c: Celebration; compact?: boolean }) => {
    const M = META[c.type];
    const firstPerson = c.personIds[0] ? byId.get(c.personIds[0]) : undefined;
    return (
      <div className={cn("flex items-center gap-3 rounded-2xl p-2.5", !compact && "bg-surface-2/70")}>
        {firstPerson ? <Portrait person={firstPerson} size={compact ? 36 : 44} thumb={128} frame="round" /> : <span className="grid size-11 place-items-center rounded-full" style={{ background: M.color }}><M.icon className="size-5 text-white" /></span>}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{c.title}</p>
          <p className="flex items-center gap-1.5 text-sm text-ink-faint">
            <M.icon className="size-3.5" style={{ color: M.color }} />
            {new Date(`${c.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            {describe(c) && <> · {describe(c)}</>}
          </p>
        </div>
        {(c.type === "birthday" || c.type === "memorial") && firstPerson && (
          <Button size="sm" variant="ghost" onClick={() => setCard(firstPerson)} aria-label="Send a card"><Gift /></Button>
        )}
      </div>
    );
  };

  return (
    <Page>
      <PageHeader eyebrow="Family Celebrations" title="Days worth gathering for"
        subtitle="Birthdays, anniversaries, remembrance days and reunions — never miss one."
        actions={<>
          <Button variant="secondary" onClick={makeFeed}><CalendarPlus /> Add to my phone calendar</Button>
          {viewer.canContribute && <Button onClick={() => setEventOpen(true)}><Plus /> Add an event</Button>}
        </>} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="card p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Previous month"><ChevronLeft /></Button>
            <h2 className="h-display text-2xl">{monthName}</h2>
            <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Next month"><ChevronRight /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-extrabold uppercase tracking-wider text-ink-faint">
            {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={`e${i}`} />;
              const date = `${ym.y}-${String(ym.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const items = byDay.get(date) ?? [];
              return (
                <button key={date} onClick={() => setSelected(date)}
                  className={cn("flex aspect-square flex-col items-center justify-start rounded-2xl p-1 text-sm transition sm:aspect-[1/0.9] sm:p-2",
                    selected === date ? "bg-forest text-[#fffaf0] dark:text-[#14211a]" : date === today ? "bg-sun/40 font-extrabold" : "hover:bg-surface-2")}
                  aria-label={`${date}${items.length ? `, ${items.length} celebration${items.length > 1 ? "s" : ""}` : ""}`}>
                  <span className="font-bold">{d}</span>
                  <span className="mt-auto flex flex-wrap justify-center gap-0.5">
                    {items.slice(0, 4).map((c) => <span key={c.key} className="size-2 rounded-full" style={{ background: selected === date ? "#fffaf0" : META[c.type].color }} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 font-bold">{new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
            {selectedItems.length === 0 ? <p className="text-sm text-ink-faint">Nothing on this day.</p> : <div className="space-y-2">{selectedItems.map((c) => <Item key={c.key} c={c} />)}</div>}
          </div>
        </div>

        <aside className="card p-5">
          <h2 className="h-display mb-3 text-xl">Coming up</h2>
          {upcoming.length === 0 ? <p className="text-ink-soft">Add birthdays to family profiles and they&apos;ll appear here.</p> : (
            <div className="space-y-1">
              {upcoming.slice(0, 14).map((c) => <Item key={c.key} c={c} compact />)}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4 text-sm">
            {Object.values(META).map((m) => <span key={m.label} className="flex items-center gap-1.5 text-ink-soft"><span className="size-2.5 rounded-full" style={{ background: m.color }} />{m.label}</span>)}
          </div>
        </aside>
      </div>

      <EventForm open={eventOpen} onOpenChange={setEventOpen} people={people} defaults={{ kind: "celebration", eventDate: selected, recurring: false }} onSaved={() => router.refresh()} />
      {card && <GreetingComposer open={!!card} onOpenChange={(o) => !o && setCard(null)} person={card} defaultOccasion={card.isDeceased ? "memorial" : "birthday"} onSent={() => router.push(`/people/${card.id}`)} />}
      <Dialog open={feedOpen} onOpenChange={setFeedOpen} title="Birthday reminders on your phone" description="Subscribe to this private link in Google Calendar, Apple Calendar or Outlook. You'll get a reminder the evening before each celebration.">
        <div className="space-y-4">
          <div className="flex gap-2"><Input readOnly value={feed ?? ""} onFocus={(e) => e.target.select()} /><Button variant="secondary" size="icon" aria-label="Copy" onClick={() => { navigator.clipboard.writeText(feed ?? ""); toast("Link copied"); }}><Copy /></Button></div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li><b>iPhone:</b> Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar.</li>
            <li><b>Google Calendar (computer):</b> Other calendars → + → From URL.</li>
            <li>Keep this link private — anyone with it can see family dates. Making a new link turns the old one off.</li>
          </ul>
          <p className="text-sm"><Link href="/account" className="font-bold text-forest hover:underline">Manage in My settings</Link></p>
        </div>
      </Dialog>
    </Page>
  );
}
