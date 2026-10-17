import "server-only";
import { sql } from "./db";
import { computeGenerations, loadTree } from "./family";
import type { DatePrecision, TreeData } from "./types";

export type TimelineItem = {
  id: string;
  date: string;
  precision: DatePrecision;
  type: "birth" | "death" | "marriage" | "event" | "album" | "story";
  kind?: string;
  title: string;
  description: string | null;
  location: string | null;
  people: string[];
  mediaId: string | null;
  href: string | null;
  eventId?: string;
  createdBy?: string | null;
  recurring?: boolean;
};

export async function buildTimeline(): Promise<{ items: TimelineItem[]; tree: TreeData; generations: Record<string, number> }> {
  const tree = await loadTree();
  const [events, albums, stories, persons] = await Promise.all([
    sql<{ id: string; title: string; description: string | null; kind: string; eventDate: string; datePrecision: DatePrecision; location: string | null; mediaId: string | null; createdBy: string | null; recurring: boolean; people: string[] }[]>`
      select e.id, e.title, e.description, e.kind, e.event_date, e.date_precision, e.location, e.media_id, e.created_by, e.recurring,
        coalesce((select array_agg(ep.person_id::text) from event_people ep where ep.event_id = e.id), '{}') as people
      from events e order by e.event_date`,
    sql<{ id: string; title: string; description: string | null; eventDate: string; coverMediaId: string | null }[]>`
      select al.id, al.title, al.description, al.event_date,
        coalesce(al.cover_media_id, (select m.id from media m where m.album_id = al.id and m.kind = 'image' and m.deleted_at is null order by m.created_at limit 1)) as cover_media_id
      from albums al where al.event_date is not null`,
    sql<{ id: string; title: string; kind: string; storyDate: string; coverMediaId: string | null; people: string[] }[]>`
      select s.id, s.title, s.kind, s.story_date, s.cover_media_id,
        coalesce((select array_agg(sp.person_id::text) from story_people sp where sp.story_id = s.id), '{}') as people
      from stories s where s.story_date is not null`,
    sql<{ id: string; birthPlace: string | null; deathPlace: string | null }[]>`select id, birth_place, death_place from persons where deleted_at is null`,
  ]);
  const places = new Map(persons.map((p) => [p.id, p]));
  const byId = new Map(tree.persons.map((p) => [p.id, p]));
  const name = (id: string) => {
    const p = byId.get(id);
    return p ? p.nickname ?? [p.firstName, p.lastName].filter(Boolean).join(" ") : "Someone";
  };
  const items: TimelineItem[] = [];
  for (const p of tree.persons) {
    if (p.birthDate) {
      items.push({ id: `birth-${p.id}`, date: p.birthDate, precision: p.birthDatePrecision, type: "birth", title: `${name(p.id)} was born`, description: null, location: places.get(p.id)?.birthPlace ?? null, people: [p.id], mediaId: p.photoMediaId, href: `/people/${p.id}` });
    }
    if (p.isDeceased && p.deathDate) {
      items.push({ id: `death-${p.id}`, date: p.deathDate, precision: p.deathDatePrecision, type: "death", title: `${name(p.id)} passed away`, description: null, location: places.get(p.id)?.deathPlace ?? null, people: [p.id], mediaId: null, href: `/people/${p.id}` });
    }
  }
  for (const m of tree.partnerships) {
    if (!m.startDate) continue;
    items.push({ id: `marriage-${m.id}`, date: m.startDate, precision: "day", type: "marriage", title: `${name(m.personA)} & ${name(m.personB)} ${m.kind === "married" ? "were married" : m.kind === "engaged" ? "got engaged" : "became partners"}`, description: null, location: m.place, people: [m.personA, m.personB], mediaId: null, href: null });
  }
  for (const e of events) {
    items.push({ id: `event-${e.id}`, eventId: e.id, date: e.eventDate, precision: e.datePrecision, type: "event", kind: e.kind, title: e.title, description: e.description, location: e.location, people: e.people, mediaId: e.mediaId, href: null, createdBy: e.createdBy, recurring: e.recurring });
  }
  for (const a of albums) {
    items.push({ id: `album-${a.id}`, date: a.eventDate, precision: "day", type: "album", title: a.title, description: a.description, location: null, people: [], mediaId: a.coverMediaId, href: `/memories?album=${a.id}` });
  }
  for (const s of stories) {
    items.push({ id: `story-${s.id}`, date: s.storyDate, precision: "day", type: "story", kind: s.kind, title: s.title, description: null, location: null, people: s.people, mediaId: s.coverMediaId, href: `/stories/${s.id}` });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  return { items, tree, generations: Object.fromEntries(computeGenerations(tree)) };
}
