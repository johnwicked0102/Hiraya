import "server-only";
import { sql } from "./db";
import type { MediaItem, ParentLink, Partnership, PersonFull, PersonLite, TreeData } from "./types";
import type { Viewer } from "./session";

const LITE = sql`
  id, first_name, middle_name, last_name, nickname, gender, birth_date, birth_date_precision,
  is_deceased, death_date, death_date_precision, photo_media_id, photo_crop, photo_frame, created_at`;

export async function loadTree(): Promise<TreeData> {
  const [persons, parents, partnerships] = await Promise.all([
    sql<PersonLite[]>`select ${LITE} from persons where deleted_at is null order by birth_date nulls last, created_at`,
    sql<ParentLink[]>`select pc.id, pc.parent_id, pc.child_id, pc.kind from parent_child pc
                      join persons a on a.id = pc.parent_id and a.deleted_at is null
                      join persons b on b.id = pc.child_id and b.deleted_at is null`,
    sql<Partnership[]>`select p.id, p.person_a, p.person_b, p.kind, p.status, p.start_date, p.end_date, p.place
                       from partnerships p
                       join persons a on a.id = p.person_a and a.deleted_at is null
                       join persons b on b.id = p.person_b and b.deleted_at is null
                       order by p.start_date nulls last`,
  ]);
  return { persons, parents, partnerships };
}

export async function getPerson(id: string, viewer: Viewer): Promise<PersonFull | null> {
  const [p] = await sql<(PersonFull & { sensitive: PersonFull["sensitive"] })[]>`
    select ${LITE}, maiden_name, birth_place, death_place, resting_place, occupation, hobbies, achievements,
           biography, memorial_message, cover_media_id, sensitive, updated_at
    from persons where id = ${id} and deleted_at is null`;
  if (!p) return null;
  // Private details are visible only to admins and the person themself.
  const mayView = viewer.isAdmin || viewer.personId === p.id;
  return { ...p, sensitive: mayView ? p.sensitive : null };
}

export async function mediaForPerson(personId: string, limit = 60): Promise<MediaItem[]> {
  return sql<MediaItem[]>`
    select m.*, a.display_name as uploader_name,
      coalesce((select array_agg(mp2.person_id::text) from media_people mp2 where mp2.media_id = m.id), '{}') as people
    from media m
    join media_people mp on mp.media_id = m.id and mp.person_id = ${personId}
    left join accounts a on a.id = m.uploaded_by
    where m.deleted_at is null
    order by m.taken_on desc nulls last, m.created_at desc
    limit ${limit}`;
}

/** True when `ancestorId` is already an ancestor of (or equal to) `personId`. Prevents cycles. */
export async function isAncestorOrSelf(ancestorId: string, personId: string): Promise<boolean> {
  if (ancestorId === personId) return true;
  const [r] = await sql<{ found: boolean }[]>`
    with recursive up(id) as (
      select parent_id from parent_child where child_id = ${personId}
      union
      select pc.parent_id from parent_child pc join up on pc.child_id = up.id
    )
    select exists(select 1 from up where id = ${ancestorId}) as found`;
  return !!r?.found;
}

/** Generation number for every person (0 = oldest known roots). */
export function computeGenerations(tree: TreeData): Map<string, number> {
  const parentsOf = new Map<string, string[]>();
  for (const l of tree.parents) {
    parentsOf.set(l.childId, [...(parentsOf.get(l.childId) ?? []), l.parentId]);
  }
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const gen = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const ps = parentsOf.get(id) ?? [];
    const g = ps.length ? Math.max(...ps.map(gen)) + 1 : 0;
    visiting.delete(id);
    memo.set(id, g);
    return g;
  };
  for (const p of tree.persons) gen(p.id);
  // Partners without parents in the tree take their partner's generation.
  for (const pr of tree.partnerships) {
    const a = memo.get(pr.personA) ?? 0;
    const b = memo.get(pr.personB) ?? 0;
    if (!parentsOf.has(pr.personA) && b > a) memo.set(pr.personA, b);
    if (!parentsOf.has(pr.personB) && a > b) memo.set(pr.personB, a);
  }
  return memo;
}
