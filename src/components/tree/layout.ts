import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import type { ParentLink, Partnership, PersonLite, TreeData } from "@/lib/types";

export type ViewMode = "all" | "ancestors" | "descendants" | "maternal" | "paternal";

export const PERSON_W = 190;
export const PERSON_H = 232;
const UNION = 18;

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
  g.setGraph({ rankdir: "TB", nodesep: 36, ranksep: 46, edgesep: 12, marginx: 40, marginy: 40, ranker: "network-simplex" });
  g.setDefaultEdgeLabel(() => ({}));

  for (const id of visible) g.setNode(id, { width: PERSON_W, height: PERSON_H });

  const edges: Edge[] = [];
  const unions = new Map<string, { parents: string[]; partnership?: Partnership }>();

  // Group each child's visible parents into a "union" knot.
  for (const id of visible) {
    const links = (ix.parentsOf.get(id) ?? []).filter((l) => visible.has(l.parentId));
    if (!links.length) continue;
    const kind = links.find((l) => l.kind === "biological")?.kind ?? links[0]!.kind;
    if (links.length === 1) {
      const l = links[0]!;
      g.setEdge(l.parentId, id, { minlen: 2, weight: 2 }, l.id);
      edges.push(parentEdge(`pc-${l.id}`, l.parentId, id, l.kind));
      continue;
    }
    const parents = links.map((l) => l.parentId).sort();
    const key = `u-${parents.join("_")}`;
    if (!unions.has(key)) unions.set(key, { parents });
    g.setEdge(key, id, { minlen: 1, weight: 2 }, `${key}->${id}`);
    edges.push(parentEdge(`uc-${key}-${id}`, key, id, kind));
  }
  // Partnerships without visible shared children still sit side by side.
  for (const p of tree.partnerships) {
    if (!visible.has(p.personA) || !visible.has(p.personB)) continue;
    const key = `u-${[p.personA, p.personB].sort().join("_")}`;
    const u = unions.get(key);
    if (u) u.partnership = u.partnership ?? p;
    else unions.set(key, { parents: [p.personA, p.personB].sort(), partnership: p });
  }
  for (const [key, u] of unions) {
    g.setNode(key, { width: UNION, height: UNION });
    for (const pid of u.parents) {
      g.setEdge(pid, key, { minlen: 1, weight: 4 }, `${pid}->${key}`);
      const ended = u.partnership && u.partnership.status !== "current";
      edges.push({
        id: `pu-${pid}-${key}`,
        source: pid,
        target: key,
        type: "smoothstep",
        className: "grow-edge",
        style: {
          stroke: u.partnership ? (ended ? "var(--ink-faint)" : "var(--gold)") : "var(--forest)",
          strokeWidth: u.partnership ? 2.5 : 2,
          strokeDasharray: ended ? "6 6" : undefined,
        },
      });
    }
  }

  dagre.layout(g);

  const nodes: Node[] = [];
  for (const id of visible) {
    const n = g.node(id);
    const p = ix.byId.get(id)!;
    nodes.push({
      id,
      type: "person",
      position: { x: n.x - PERSON_W / 2, y: n.y - PERSON_H / 2 },
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
    nodes.push({
      id: key,
      type: "union",
      position: { x: n.x - UNION / 2, y: n.y - UNION / 2 },
      data: { partnership: u.partnership ?? null },
      width: UNION,
      height: UNION,
      selectable: false,
      draggable: false,
    });
  }
  return { nodes, edges };
}

function parentEdge(id: string, source: string, target: string, kind: string): Edge {
  return {
    id,
    source,
    target,
    type: "smoothstep",
    style: {
      stroke: EDGE_COLORS[kind as keyof typeof EDGE_COLORS] ?? "var(--forest)",
      strokeWidth: 2.25,
      strokeDasharray: DASH[kind],
    },
  };
}
