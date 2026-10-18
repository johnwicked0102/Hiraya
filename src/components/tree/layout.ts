import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { ParentLink, Partnership, PersonLite, TreeData } from "@/lib/types";

export type ViewMode = "all" | "ancestors" | "descendants" | "maternal" | "paternal";

export const PERSON_W = 190;
export const PERSON_H = 232;
const UNION = 18;
const PAIR_GAP = 32; // horizontal space between two partners kept side by side

export interface PersonNodeData extends Record<string, unknown> {
  person: PersonLite;
  childCount: number;
  collapsed: boolean;
  isFocus: boolean;
  isSelf: boolean;
  generation: number;
}

export interface Indexes {
  byId: Map<string, PersonLite>;
  parentsOf: Map<string, ParentLink[]>;
  childrenOf: Map<string, ParentLink[]>;
  partnersOf: Map<string, Partnership[]>;
}

export function buildIndexes(tree: TreeData): Indexes {
  const byId = new Map(tree.persons.map((p) => [p.id, p]));
  const parentsOf = new Map<string, ParentLink[]>();
  const childrenOf = new Map<string, ParentLink[]>();
  const partnersOf = new Map<string, Partnership[]>();
  for (const l of tree.parents) {
    if (!byId.has(l.parentId) || !byId.has(l.childId)) continue;
    parentsOf.set(l.childId, [...(parentsOf.get(l.childId) ?? []), l]);
    childrenOf.set(l.parentId, [...(childrenOf.get(l.parentId) ?? []), l]);
  }
  for (const p of tree.partnerships) {
    if (!byId.has(p.personA) || !byId.has(p.personB)) continue;
    partnersOf.set(p.personA, [...(partnersOf.get(p.personA) ?? []), p]);
    partnersOf.set(p.personB, [...(partnersOf.get(p.personB) ?? []), p]);
  }
  return { byId, parentsOf, childrenOf, partnersOf };
}

export function partnerIdOf(p: Partnership, self: string) {
  return p.personA === self ? p.personB : p.personA;
}

export function ancestors(ix: Indexes, id: string, out = new Set<string>()): Set<string> {
  for (const l of ix.parentsOf.get(id) ?? []) {
    if (!out.has(l.parentId)) {
      out.add(l.parentId);
      ancestors(ix, l.parentId, out);
    }
  }
  return out;
}

export function descendants(ix: Indexes, id: string, out = new Set<string>()): Set<string> {
  for (const l of ix.childrenOf.get(id) ?? []) {
    if (!out.has(l.childId)) {
      out.add(l.childId);
      descendants(ix, l.childId, out);
    }
  }
  return out;
}

function withPartners(ix: Indexes, set: Set<string>) {
  for (const id of [...set]) {
    for (const p of ix.partnersOf.get(id) ?? []) set.add(partnerIdOf(p, id));
    // co-parents of children in the set
    for (const l of ix.childrenOf.get(id) ?? []) {
      if (set.has(l.childId)) for (const pl of ix.parentsOf.get(l.childId) ?? []) set.add(pl.parentId);
    }
  }
  return set;
}

function sideParent(ix: Indexes, id: string, gender: "female" | "male"): string | null {
  const ps = (ix.parentsOf.get(id) ?? []).map((l) => ix.byId.get(l.parentId)!).filter(Boolean);
  const exact = ps.find((p) => p.gender === gender);
  if (exact) return exact.id;
  const unknown = ps.filter((p) => p.gender !== (gender === "female" ? "male" : "female"));
  return unknown[0]?.id ?? null;
}

/** Which people are in view for a given mode, before collapsing. */
export function selectView(ix: Indexes, mode: ViewMode, focus: string | null): Set<string> {
  if (mode === "all" || !focus || !ix.byId.has(focus)) return new Set(ix.byId.keys());
  if (mode === "ancestors") return new Set([focus, ...ancestors(ix, focus)]);
  if (mode === "descendants") return withPartners(ix, new Set([focus, ...descendants(ix, focus)]));
  const parent = sideParent(ix, focus, mode === "maternal" ? "female" : "male");
  if (!parent) return new Set([focus]);
  const tops = new Set([parent, ...ancestors(ix, parent)]);
  const set = new Set<string>([focus, ...tops]);
  for (const t of tops) for (const d of descendants(ix, t)) set.add(d);
  // Keep only the chosen side: drop the other parent's line unless they're on this side too.
  return withPartners(ix, set);
}

export function applyCollapse(ix: Indexes, visible: Set<string>, collapsed: Set<string>, focus: string | null) {
  const hidden = new Set<string>();
  for (const c of collapsed) {
    if (!visible.has(c)) continue;
    for (const d of descendants(ix, c)) if (d !== focus) hidden.add(d);
  }
  const out = new Set([...visible].filter((v) => !hidden.has(v)));
  // Remove partners who would be left floating alone.
  for (const id of [...out]) {
    const hasParent = (ix.parentsOf.get(id) ?? []).some((l) => out.has(l.parentId));
    const hasChild = (ix.childrenOf.get(id) ?? []).some((l) => out.has(l.childId));
    const partners = (ix.partnersOf.get(id) ?? []).map((p) => partnerIdOf(p, id));
    const anyPartner = partners.some((p) => out.has(p));
    if (!hasParent && !hasChild && partners.length && !anyPartner && id !== focus) out.delete(id);
  }
  return out;
}

const EDGE_COLORS = {
  biological: "var(--forest)",
  adopted: "var(--sky-deep)",
  step: "var(--dusk)",
  foster: "var(--gold)",
  guardian: "var(--ink-faint)",
} as const;

const DASH: Record<string, string | undefined> = { adopted: "8 6", step: "2 6", foster: "10 4 2 4", guardian: "4 4" };

export function layoutTree(
  tree: TreeData,
  ix: Indexes,
  visible: Set<string>,
  opts: { collapsed: Set<string>; focus: string | null; self: string | null; generations: Map<string, number> },
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: "TB", nodesep: 36, ranksep: 64, edgesep: 18, marginx: 40, marginy: 40, ranker: "network-simplex" });
  g.setDefaultEdgeLabel(() => ({}));

  const edges: Edge[] = [];
  const unions = new Map<string, { parents: string[]; partnership?: Partnership }>();

  // Collect the unions (knots) first so we know which people form a couple.
  for (const id of visible) {
    const links = (ix.parentsOf.get(id) ?? []).filter((l) => visible.has(l.parentId));
    if (links.length < 2) continue;
    const parents = links.map((l) => l.parentId).sort();
    const key = `u-${parents.join("_")}`;
    if (!unions.has(key)) unions.set(key, { parents });
  }
  for (const p of tree.partnerships) {
    if (!visible.has(p.personA) || !visible.has(p.personB)) continue;
    const key = `u-${[p.personA, p.personB].sort().join("_")}`;
    const u = unions.get(key);
    if (u) u.partnership = u.partnership ?? p;
    else unions.set(key, { parents: [p.personA, p.personB].sort(), partnership: p });
  }

  // Keep couples side by side: lay each pair out as one wide unit so nothing
  // can slip between them, then split it back into two people at render time.
  // Spouses/partners are grouped first, co-parents next; each person joins one unit.
  const unitOf = new Map<string, string>(); // personId -> unit node id
  const units = new Map<string, [string, string]>(); // unit id -> [left, right]
  const pairPasses = [
    [...unions.values()].filter((u) => u.partnership && u.parents.length === 2),
    [...unions.values()].filter((u) => !u.partnership && u.parents.length === 2),
  ];
  for (const pass of pairPasses) {
    for (const u of pass) {
      const [a, b] = u.parents as [string, string];
      if (unitOf.has(a) || unitOf.has(b)) continue;
      const uid = `pair-${a}_${b}`;
      unitOf.set(a, uid);
      unitOf.set(b, uid);
      units.set(uid, [a, b]);
    }
  }
  // Which dagre node represents a person: their couple unit, or themselves.
  const rep = (id: string) => unitOf.get(id) ?? id;

  for (const id of visible) if (!unitOf.has(id)) g.setNode(id, { width: PERSON_W, height: PERSON_H });
  for (const uid of units.keys()) g.setNode(uid, { width: PERSON_W * 2 + PAIR_GAP, height: PERSON_H });

  // Parent → child edges (ranking via unit reps; drawn edges use the real ids).
  for (const id of visible) {
    const links = (ix.parentsOf.get(id) ?? []).filter((l) => visible.has(l.parentId));
    if (!links.length) continue;
    const kind = links.find((l) => l.kind === "biological")?.kind ?? links[0]!.kind;
    if (links.length === 1) {
      const l = links[0]!;
      g.setEdge(rep(l.parentId), rep(id), { minlen: 2, weight: 2 }, `pc-${l.id}`);
      edges.push(parentEdge(`pc-${l.id}`, l.parentId, id, l.kind));
      continue;
    }
    const key = `u-${links.map((l) => l.parentId).sort().join("_")}`;
    g.setEdge(key, rep(id), { minlen: 1, weight: 2 }, `${key}->${id}`);
    edges.push(parentEdge(`uc-${key}-${id}`, key, id, kind));
  }

  for (const [key, u] of unions) {
    g.setNode(key, { width: UNION, height: UNION });
    for (const pr of new Set(u.parents.map(rep))) {
      g.setEdge(pr, key, { minlen: 1, weight: 4 }, `${pr}->${key}`);
    }
    for (const pid of u.parents) {
      const ended = u.partnership && u.partnership.status !== "current";
      edges.push({
        id: `pu-${pid}-${key}`,
        source: pid,
        target: key,
        type: "smoothstep",
        className: "grow-edge",
        pathOptions: { borderRadius: 18, offset: 22 },
        style: {
          stroke: u.partnership ? (ended ? "var(--ink-faint)" : "var(--gold)") : "var(--forest)",
          strokeWidth: u.partnership ? 2.5 : 2,
          strokeDasharray: ended ? "6 6" : undefined,
        },
      });
    }
  }

  dagre.layout(g);

  // Tidy pass: center each ancestor over the midpoint of its descendants, so the
  // root ancestor sits at the top middle with the family fanning out below it.
  const reps = new Set<string>();
  for (const id of visible) reps.add(rep(id));
  const repX = new Map<string, number>();
  const repY = new Map<string, number>();
  const repW = new Map<string, number>();
  for (const r of reps) {
    const n = g.node(r);
    repX.set(r, n.x);
    repY.set(r, n.y);
    repW.set(r, units.has(r) ? PERSON_W * 2 + PAIR_GAP : PERSON_W);
  }
  const childReps = new Map<string, string[]>();
  const seenRep = new Set<string>();
  for (const id of visible) {
    const rc = rep(id);
    const links = (ix.parentsOf.get(id) ?? []).filter((l) => visible.has(l.parentId));
    for (const pr of new Set(links.map((l) => rep(l.parentId)))) {
      if (pr === rc || seenRep.has(`${pr}>${rc}`)) continue;
      seenRep.add(`${pr}>${rc}`);
      (childReps.get(pr) ?? childReps.set(pr, []).get(pr)!).push(rc);
    }
  }
  const rows = new Map<number, string[]>();
  for (const [r, y] of repY) (rows.get(y) ?? rows.set(y, []).get(y)!).push(r);
  const ys = [...rows.keys()].sort((a, b) => a - b);
  for (let i = ys.length - 1; i >= 0; i--) {
    const row = rows.get(ys[i]!)!;
    for (const r of row) {
      const kids = childReps.get(r);
      if (kids?.length) repX.set(r, kids.reduce((s, k) => s + repX.get(k)!, 0) / kids.length);
    }
    spreadRow(row, repX, repW, 36);
  }

  const nodes: Node[] = [];
  for (const id of visible) {
    const p = ix.byId.get(id)!;
    const r = rep(id);
    const uid = unitOf.get(id);
    const offset = (PERSON_W + PAIR_GAP) / 2;
    const cx = uid ? repX.get(uid)! + (id === units.get(uid)![0] ? -offset : offset) : repX.get(r)!;
    const cy = repY.get(r)!;
    nodes.push({
      id,
      type: "person",
      position: { x: cx - PERSON_W / 2, y: cy - PERSON_H / 2 },
      data: {
        person: p,
        childCount: (ix.childrenOf.get(id) ?? []).length,
        collapsed: opts.collapsed.has(id),
        isFocus: opts.focus === id,
        isSelf: opts.self === id,
        generation: opts.generations.get(id) ?? 0,
      } satisfies PersonNodeData,
      width: PERSON_W,
      height: PERSON_H,
    });
  }
  for (const [key, u] of unions) {
    const n = g.node(key);
    const prs = [...new Set(u.parents.map(rep))];
    const ux = prs.reduce((s, r) => s + (repX.get(r) ?? n.x), 0) / prs.length;
    nodes.push({
      id: key,
      type: "union",
      position: { x: ux - UNION / 2, y: n.y - UNION / 2 },
      data: { partnership: u.partnership ?? null },
      width: UNION,
      height: UNION,
      selectable: false,
      draggable: false,
    });
  }
  return { nodes, edges };
}

/** Keep a row's left-to-right order and centroid while enforcing a minimum gap between neighbours. */
function spreadRow(row: string[], repX: Map<string, number>, repW: Map<string, number>, gap: number) {
  if (row.length < 2) return;
  const order = [...row].sort((a, b) => repX.get(a)! - repX.get(b)!);
  const desired = order.map((id) => repX.get(id)!);
  const half = order.map((id) => repW.get(id)! / 2);
  const pos = desired.slice();
  for (let i = 1; i < pos.length; i++) {
    const min = pos[i - 1]! + half[i - 1]! + gap + half[i]!;
    if (pos[i]! < min) pos[i] = min;
  }
  let shift = 0;
  for (let i = 0; i < pos.length; i++) shift += desired[i]! - pos[i]!;
  shift /= pos.length;
  for (let i = 0; i < pos.length; i++) repX.set(order[i]!, pos[i]! + shift);
}

function parentEdge(id: string, source: string, target: string, kind: string): Edge {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    pathOptions: { borderRadius: 18, offset: 22 },
    style: {
      stroke: EDGE_COLORS[kind as keyof typeof EDGE_COLORS] ?? "var(--forest)",
      strokeWidth: 2.25,
      strokeDasharray: DASH[kind],
    },
  };
}
