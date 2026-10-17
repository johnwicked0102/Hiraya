import "server-only";
import { sql } from "./db";
import { encrypt, decrypt } from "./crypto";

/**
 * Portable family archive. The JSON export contains everything needed to rebuild
 * Hiraya on a new database (and points to every original file by its Google Drive
 * id, name and checksum). It never contains passwords, authenticator secrets or
 * access codes. Sealed time-capsule messages are kept encrypted with the
 * deployment's ENCRYPTION_KEY so even an export can't be read early.
 */

export const ARCHIVE_VERSION = 1;

const TABLES = [
  "settings", "persons", "parent_child", "partnerships", "albums", "media", "media_people", "events", "event_people",
  "stories", "story_people", "story_media", "time_capsules", "capsule_recipients", "capsule_media", "greetings",
] as const;
type Table = (typeof TABLES)[number];

export async function buildExport() {
  const data: Record<string, unknown[]> = {};
  // Raw rows (snake_case) so the archive maps 1:1 onto db/schema.sql.
  const raw = sql.unsafe.bind(sql);
  for (const t of TABLES) {
    data[t] = (await raw(`select * from ${t}`)) as unknown[];
  }
  data.time_capsules = (data.time_capsules as Record<string, unknown>[]).map((c) => {
    const sealed = new Date(String(c.unlock_at ?? c.unlockAt)).getTime() > Date.now();
    if (!sealed) return c;
    const { message, ...rest } = c;
    return { ...rest, message: null, message_enc: encrypt(String(message)) };
  });
  const accounts = await raw(
    `select id, person_id, display_name, login_name, role, status, email, verify_question, created_at, last_login_at from accounts`,
  );
  const drive = await raw(`select google_email, root_folder_id, connected_at from drive_connection`);
  return {
    format: "hiraya-archive",
    version: ARCHIVE_VERSION,
    exportedAt: new Date().toISOString(),
    note: "Original photos and videos live in the Google Drive folder listed under drive. Each media row has its drive_file_id, file name, size and checksums.",
    drive: drive[0] ?? null,
    accounts,
    data,
  };
}

/** Rows are camel-cased by the client transform; convert back to snake_case columns. */
function snake(k: string) {
  return k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

export async function importArchive(archive: { format?: string; version?: number; data?: Record<string, unknown[]> }) {
  if (archive.format !== "hiraya-archive" || !archive.data) throw new Error("This file isn't a Hiraya archive.");
  if ((archive.version ?? 0) > ARCHIVE_VERSION) throw new Error("This archive was made by a newer version of Hiraya.");
  const counts: Record<string, number> = {};
  await sql.begin(async (tx) => {
    // persons first without media links, then media, then patch links (circular FKs)
    for (const t of TABLES) {
      const rows = (archive.data![t] ?? []) as Record<string, unknown>[];
      if (!rows.length || t === "settings") continue;
      let inserted = 0;
      for (const r0 of rows) {
        const r: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(r0)) r[snake(k)] = v;
        if (t === "persons") {
          r.photo_media_id = null;
          r.cover_media_id = null;
        }
        if (t === "albums") r.cover_media_id = null;
        if (t === "time_capsules" && r.message_enc) {
          r.message = decrypt(String(r.message_enc));
          delete r.message_enc;
        }
        for (const k of ["created_by", "uploaded_by", "author_id"]) if (k in r) r[k] = null; // accounts aren't imported
        for (const [k, v] of Object.entries(r)) if (v !== null && typeof v === "object" && !(v instanceof Date)) r[k] = JSON.stringify(v);
        const cols = Object.keys(r);
        const res = await tx.unsafe(
          `insert into ${t} (${cols.map((c) => `"${c}"`).join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")}) on conflict do nothing`,
          cols.map((c) => r[c] as never),
        );
        inserted += res.count;
      }
      counts[t] = inserted;
    }
    // restore portrait/cover links now that media exists
    for (const r0 of (archive.data!.persons ?? []) as Record<string, unknown>[]) {
      const photo = r0.photo_media_id ?? r0.photoMediaId;
      const cover = r0.cover_media_id ?? r0.coverMediaId;
      if (photo || cover) {
        await tx`update persons set photo_media_id = coalesce(photo_media_id, (select id from media where id = ${(photo as string) ?? null})),
                 cover_media_id = coalesce(cover_media_id, (select id from media where id = ${(cover as string) ?? null}))
                 where id = ${r0.id as string}`;
      }
    }
    for (const r0 of (archive.data!.albums ?? []) as Record<string, unknown>[]) {
      const cover = r0.cover_media_id ?? r0.coverMediaId;
      if (cover) await tx`update albums set cover_media_id = (select id from media where id = ${cover as string}) where id = ${r0.id as string} and cover_media_id is null`;
    }
  });
  return counts;
}

// ---------------------------------------------------------------------------
// GEDCOM 5.5.1 — the universal genealogy format (Ancestry, FamilySearch, MyHeritage…)
// ---------------------------------------------------------------------------
const GMONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function gdate(d: string | null, p: string) {
  if (!d) return null;
  const [y, m, day] = d.split("-").map(Number);
  if (p === "year") return String(y);
  if (p === "month") return `${GMONTHS[(m ?? 1) - 1]} ${y}`;
  return `${day} ${GMONTHS[(m ?? 1) - 1]} ${y}`;
}
function clean(s: string | null | undefined) {
  return (s ?? "").replace(/[\r\n]+/g, " ").replace(/@/g, "@@").trim();
}

export async function buildGedcom(familyName: string) {
  const persons = await sql<{ id: string; firstName: string; middleName: string | null; lastName: string | null; nickname: string | null; gender: string; birthDate: string | null; birthDatePrecision: string; birthPlace: string | null; isDeceased: boolean; deathDate: string | null; deathDatePrecision: string; deathPlace: string | null; occupation: string | null; biography: string | null }[]>`
    select id, first_name, middle_name, last_name, nickname, gender, birth_date, birth_date_precision, birth_place, is_deceased,
           death_date, death_date_precision, death_place, occupation, biography from persons where deleted_at is null`;
  const links = await sql<{ parentId: string; childId: string; kind: string }[]>`select parent_id, child_id, kind from parent_child`;
  const parts = await sql<{ personA: string; personB: string; kind: string; status: string; startDate: string | null; place: string | null }[]>`select person_a, person_b, kind, status, start_date, place from partnerships`;

  const ids = new Map(persons.map((p, i) => [p.id, `@I${i + 1}@`]));
  const fams = new Map<string, { parents: string[]; children: { id: string; kind: string }[]; part?: (typeof parts)[number] }>();
  const famKey = (ps: string[]) => [...ps].sort().join("+");
  const parentsByChild = new Map<string, { id: string; kind: string }[]>();
  for (const l of links) if (ids.has(l.parentId) && ids.has(l.childId)) parentsByChild.set(l.childId, [...(parentsByChild.get(l.childId) ?? []), { id: l.parentId, kind: l.kind }]);
  for (const [child, ps] of parentsByChild) {
    const k = famKey(ps.map((p) => p.id).slice(0, 2));
    const f = fams.get(k) ?? { parents: ps.map((p) => p.id).slice(0, 2), children: [] };
    f.children.push({ id: child, kind: ps[0]!.kind });
    fams.set(k, f);
  }
  for (const pt of parts) {
    if (!ids.has(pt.personA) || !ids.has(pt.personB)) continue;
    const k = famKey([pt.personA, pt.personB]);
    const f = fams.get(k) ?? { parents: [pt.personA, pt.personB], children: [] };
    f.part = pt;
    fams.set(k, f);
  }
  const famIds = new Map([...fams.keys()].map((k, i) => [k, `@F${i + 1}@`]));
  const famsOf = new Map<string, string[]>();
  const famcOf = new Map<string, { fam: string; kind: string }[]>();
  for (const [k, f] of fams) {
    for (const p of f.parents) famsOf.set(p, [...(famsOf.get(p) ?? []), famIds.get(k)!]);
    for (const c of f.children) famcOf.set(c.id, [...(famcOf.get(c.id) ?? []), { fam: famIds.get(k)!, kind: c.kind }]);
  }

  const L: string[] = [
    "0 HEAD", "1 SOUR HIRAYA", "2 NAME Hiraya", "2 VERS 1.0", "1 GEDC", "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED", "1 CHAR UTF-8",
    `1 DATE ${gdate(new Date().toISOString().slice(0, 10), "day")}`, `1 NOTE ${clean(`The ${familyName} family — exported from Hiraya`)}`,
  ];
  for (const p of persons) {
    L.push(`0 ${ids.get(p.id)} INDI`);
    L.push(`1 NAME ${clean([p.firstName, p.middleName].filter(Boolean).join(" "))} /${clean(p.lastName)}/`);
    if (p.nickname) L.push(`2 NICK ${clean(p.nickname)}`);
    L.push(`1 SEX ${p.gender === "female" ? "F" : p.gender === "male" ? "M" : "U"}`);
    const bd = gdate(p.birthDate, p.birthDatePrecision);
    if (bd || p.birthPlace) {
      L.push("1 BIRT");
      if (bd) L.push(`2 DATE ${bd}`);
      if (p.birthPlace) L.push(`2 PLAC ${clean(p.birthPlace)}`);
    }
    if (p.isDeceased) {
      L.push("1 DEAT Y");
      const dd = gdate(p.deathDate, p.deathDatePrecision);
      if (dd) L.push(`2 DATE ${dd}`);
      if (p.deathPlace) L.push(`2 PLAC ${clean(p.deathPlace)}`);
    }
    if (p.occupation) L.push(`1 OCCU ${clean(p.occupation).slice(0, 240)}`);
    if (p.biography) L.push(`1 NOTE ${clean(p.biography).slice(0, 240)}`);
    for (const f of famcOf.get(p.id) ?? []) {
      L.push(`1 FAMC ${f.fam}`);
      if (f.kind !== "biological") L.push(`2 PEDI ${f.kind === "adopted" ? "adopted" : f.kind === "foster" ? "foster" : "birth"}`);
    }
    for (const f of famsOf.get(p.id) ?? []) L.push(`1 FAMS ${f}`);
  }
  for (const [k, f] of fams) {
    L.push(`0 ${famIds.get(k)} FAM`);
    const [a, b] = f.parents.map((id) => persons.find((p) => p.id === id)!);
    const husb = [a, b].find((x) => x?.gender === "male") ?? a;
    const wife = [a, b].find((x) => x && x !== husb);
    if (husb) L.push(`1 HUSB ${ids.get(husb.id)}`);
    if (wife) L.push(`1 WIFE ${ids.get(wife.id)}`);
    for (const c of f.children) L.push(`1 CHIL ${ids.get(c.id)}`);
    if (f.part?.kind === "married") {
      L.push("1 MARR");
      const md = gdate(f.part.startDate, "day");
      if (md) L.push(`2 DATE ${md}`);
      if (f.part.place) L.push(`2 PLAC ${clean(f.part.place)}`);
    }
    if (f.part?.status === "divorced") L.push("1 DIV Y");
  }
  L.push("0 TRLR");
  return L.join("\r\n") + "\r\n";
}
