import "server-only";
import { sql } from "./db";
import { addDays, occurrences, type Source } from "./celebrations-core";

export type { Celebration } from "./celebrations-core";
export { occurrences, addDays };

export async function celebrationSources(): Promise<Source[]> {
  const [persons, partnerships, events] = await Promise.all([
    sql<{ id: string; firstName: string; lastName: string | null; nickname: string | null; birthDate: string | null; birthDatePrecision: string; isDeceased: boolean; deathDate: string | null; deathDatePrecision: string }[]>`
      select id, first_name, last_name, nickname, birth_date, birth_date_precision, is_deceased, death_date, death_date_precision
      from persons where deleted_at is null`,
    sql<{ id: string; personA: string; personB: string; startDate: string; aName: string; bName: string }[]>`
      select p.id, p.person_a, p.person_b, p.start_date, a.first_name as a_name, b.first_name as b_name
      from partnerships p join persons a on a.id = p.person_a and a.deleted_at is null
      join persons b on b.id = p.person_b and b.deleted_at is null
      where p.kind = 'married' and p.status = 'current' and p.start_date is not null
        and not a.is_deceased and not b.is_deceased`,
    sql<{ id: string; title: string; eventDate: string; recurring: boolean; kind: string; datePrecision: string; people: string[] }[]>`
      select e.id, e.title, e.event_date, e.recurring, e.kind, e.date_precision,
        coalesce((select array_agg(ep.person_id::text) from event_people ep where ep.event_id = e.id), '{}') as people
      from events e where e.date_precision = 'day'`,
  ]);
  const out: Source[] = [];
  for (const p of persons) {
    const name = p.nickname ?? p.firstName;
    if (!p.isDeceased && p.birthDate && p.birthDatePrecision === "day") {
      out.push({ id: `b-${p.id}`, type: "birthday", title: `${name}'s birthday`, personIds: [p.id], sourceDate: p.birthDate, recurring: true });
    }
    if (p.isDeceased && p.deathDate && p.deathDatePrecision === "day") {
      out.push({ id: `m-${p.id}`, type: "memorial", title: `Remembering ${name}`, personIds: [p.id], sourceDate: p.deathDate, recurring: true });
    }
  }
  for (const m of partnerships) {
    out.push({ id: `a-${m.id}`, type: "anniversary", title: `${m.aName} & ${m.bName}'s anniversary`, personIds: [m.personA, m.personB], sourceDate: m.startDate, recurring: true });
  }
  for (const e of events) {
    out.push({ id: `e-${e.id}`, type: "event", title: e.title, personIds: e.people, sourceDate: e.eventDate, recurring: e.recurring, eventKind: e.kind, eventId: e.id });
  }
  return out;
}

export function todayLocal(tz = process.env.FAMILY_TIMEZONE || "Asia/Manila") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parts; // en-CA → YYYY-MM-DD
}

export async function upcoming(days = 60) {
  const from = todayLocal();
  return occurrences(await celebrationSources(), from, addDays(from, days));
}
