// Pure helpers, safe on both server and client.

export type Celebration = {
  key: string;
  date: string; // YYYY-MM-DD of this occurrence
  type: "birthday" | "anniversary" | "memorial" | "event";
  title: string;
  personIds: string[];
  years: number | null; // age / years married / years since
  eventKind?: string;
  sourceDate: string;
  recurring: boolean;
  eventId?: string;
};

export type Source = Omit<Celebration, "key" | "date" | "years"> & { id: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Expand sources into dated occurrences between two YYYY-MM-DD dates (inclusive). */
export function occurrences(sources: Source[], from: string, to: string): Celebration[] {
  const fy = Number(from.slice(0, 4));
  const ty = Number(to.slice(0, 4));
  const out: Celebration[] = [];
  for (const s of sources) {
    const [sy, sm, sd] = s.sourceDate.split("-").map(Number) as [number, number, number];
    if (!s.recurring) {
      if (s.sourceDate >= from && s.sourceDate <= to) out.push({ ...s, key: s.id, date: s.sourceDate, years: null });
      continue;
    }
    for (let y = fy; y <= ty; y++) {
      if (y < sy) continue;
      let d = sd;
      if (sm === 2 && sd === 29 && !isLeap(y)) d = 28;
      const date = `${y}-${pad(sm)}-${pad(d)}`;
      if (date < from || date > to) continue;
      out.push({ ...s, key: `${s.id}-${y}`, date, years: y - sy });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

