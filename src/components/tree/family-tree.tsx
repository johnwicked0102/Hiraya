"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow, useUpdateNodeInternals,
  getNodesBounds, getViewportForBounds,
  type Node, type NodeMouseHandler,
} from "@xyflow/react";
import { AnimatePresence, motion } from "motion/react";
import {
  Search, UserPlus, FileImage, FileText, Crosshair, ChevronsDownUp, ChevronsUpDown, X, BookUser,
  ArrowUpFromLine, ArrowDownToLine, Heart, Users, Link2, Pencil, Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Portrait } from "@/components/portrait";
import { PersonForm, type Relation } from "@/components/people/person-form";
import { useViewer } from "@/components/shell/viewer-context";
import { PersonNode, UnionNode } from "./nodes";
import { applyCollapse, buildIndexes, layoutTree, selectView, type ViewMode } from "./layout";
import { api, ApiError } from "@/lib/client";
import { cn, formatDate, fullName, lifespan, shortName } from "@/lib/utils";
import type { PersonFull, PersonLite, TreeData } from "@/lib/types";

const nodeTypes = { person: PersonNode, union: UnionNode };

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "all", label: "Whole family" },
  { id: "ancestors", label: "Ancestors" },
  { id: "descendants", label: "Descendants" },
  { id: "maternal", label: "Mother's side" },
  { id: "paternal", label: "Father's side" },
];

function generationsOf(tree: TreeData) {
  const parentsOf = new Map<string, string[]>();
  for (const l of tree.parents) parentsOf.set(l.childId, [...(parentsOf.get(l.childId) ?? []), l.parentId]);
  const memo = new Map<string, number>();
  const seen = new Set<string>();
  const gen = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const ps = parentsOf.get(id) ?? [];
    const g = ps.length ? Math.max(...ps.map(gen)) + 1 : 0;
    memo.set(id, g);
    return g;
  };
  tree.persons.forEach((p) => gen(p.id));
  return memo;
}

function TreeCanvas({ initial, rootPersonId }: { initial: TreeData; rootPersonId: string | null }) {
  const viewer = useViewer();
  const toast = useToast();
  const router = useRouter();
  const rf = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);

  const [tree, setTree] = useState(initial);
  const defaultFocus = viewer.personId && initial.persons.some((p) => p.id === viewer.personId) ? viewer.personId : rootPersonId ?? initial.persons[0]?.id ?? null;
  const [focus, setFocus] = useState<string | null>(defaultFocus);
  const [mode, setMode] = useState<ViewMode>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [form, setForm] = useState<{ open: boolean; person?: PersonFull | null; relation?: Relation | null }>({ open: false });
  const [linkOpen, setLinkOpen] = useState(false);
  const [unlinkedOpen, setUnlinkedOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const ix = useMemo(() => buildIndexes(tree), [tree]);
  const generations = useMemo(() => generationsOf(tree), [tree]);

  // People who exist but aren't connected to anyone yet.
  const unlinked = useMemo(() => {
    const linked = new Set<string>();
    for (const l of tree.parents) { linked.add(l.parentId); linked.add(l.childId); }
    for (const p of tree.partnerships) { linked.add(p.personA); linked.add(p.personB); }
    return tree.persons.filter((p) => !linked.has(p.id));
  }, [tree]);
  const toggle = useCallback((id: string) => {
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const { nodes, edges } = useMemo(() => {
    const visible = applyCollapse(ix, selectView(ix, mode, focus), collapsed, focus);
    const out = layoutTree(tree, ix, visible, { collapsed, focus: mode === "all" ? null : focus, self: viewer.personId, generations });
    for (const n of out.nodes) if (n.type === "person") (n.data as Record<string, unknown>).onToggle = toggle;
    for (const n of out.nodes) if (n.id === selected) n.selected = true;
    return out;
  }, [tree, ix, mode, focus, collapsed, viewer.personId, generations, toggle, selected]);

  // Re-fit when the view changes.
  useEffect(() => {
    const t = setTimeout(() => rf.fitView({ padding: 0.18, duration: 650, maxZoom: 1.1 }), 60);
    return () => clearTimeout(t);
  }, [mode, focus, rf, collapsed.size]);

  // Nodes spring in from a smaller scale, so React Flow first measures their
  // handles mid-animation and edges attach to the wrong spots. Re-measure once
  // the entrance animation has settled so the connecting lines line up.
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    const ids = nodes.map((n) => n.id);
    const remeasure = () => ids.forEach((id) => updateNodeInternals(id));
    const timers = [120, 450, 800, 1300].map((ms) => setTimeout(remeasure, ms));
    return () => timers.forEach(clearTimeout);
  }, [nodes, updateNodeInternals]);

  const refresh = useCallback(async (selectId?: string) => {
    const t = await api<TreeData>("/api/persons");
    setTree(t);
    if (selectId) setSelected(selectId);
    router.refresh();
  }, [router]);

  const onNodeClick: NodeMouseHandler = useCallback((_, n: Node) => {
    if (n.type === "person") setSelected(n.id);
  }, []);

  const centerOn = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) {
      // Make sure the person is visible first.
      setMode("all");
      setCollapsed(new Set());
      setSelected(id);
      setTimeout(() => {
        const node = rf.getNode(id);
        if (node) rf.setCenter(node.position.x + 84, node.position.y + 98, { zoom: 1.05, duration: 700 });
      }, 120);
      return;
    }
    setSelected(id);
    rf.setCenter(n.position.x + 84, n.position.y + 98, { zoom: 1.05, duration: 700 });
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tree.persons
      .filter((p) => [p.firstName, p.middleName, p.lastName, p.nickname].filter(Boolean).join(" ").toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, tree.persons]);

  async function exportImage(kind: "png" | "pdf") {
    const el = wrapRef.current?.querySelector<HTMLElement>(".react-flow__viewport");
    if (!el) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const personNodes = rf.getNodes();
      const bounds = getNodesBounds(personNodes);
      const scale = 2;
      const w = Math.min(8000, Math.ceil(bounds.width + 160));
      const h = Math.min(8000, Math.ceil(bounds.height + 160));
      const vp = getViewportForBounds(bounds, w, h, 0.2, 2, 0.04);
      const bg = getComputedStyle(document.body).backgroundColor;
      const dataUrl = await toPng(el, {
        backgroundColor: bg,
        width: w,
        height: h,
        pixelRatio: scale,
        style: { width: `${w}px`, height: `${h}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
      });
      const name = `${viewer.familyName.replace(/[^\w]+/g, "-")}-family-tree`;
      if (kind === "png") {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${name}.png`;
        a.click();
      } else {
        const { jsPDF } = await import("jspdf");
        const landscape = w >= h;
        const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a3" });
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        pdf.setFont("times", "bold");
        pdf.setFontSize(22);
        pdf.text(`The ${viewer.familyName} Family Tree`, pw / 2, 40, { align: "center" });
        pdf.setFont("times", "italic");
        pdf.setFontSize(11);
        pdf.text(`Hiraya · Where Family Stories Live Forever · ${new Date().toLocaleDateString()}`, pw / 2, 58, { align: "center" });
        const maxW = pw - 60;
        const maxH = ph - 100;
        const ratio = Math.min(maxW / w, maxH / h);
        pdf.addImage(dataUrl, "PNG", (pw - w * ratio) / 2, 76, w * ratio, h * ratio);
        pdf.save(`${name}.pdf`);
      }
    } catch (e) {
      console.error(e);
      toast("Export failed. Try a smaller view (e.g. Descendants).", "error");
    } finally {
      setExporting(false);
    }
  }

  const sel = selected ? ix.byId.get(selected) ?? null : null;

  async function openEdit(id: string) {
    try {
      const p = await api<PersonFull>(`/api/persons/${id}`);
      setForm({ open: true, person: p });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't load profile.", "error");
    }
  }

  return (
    <div className="relative h-[calc(100dvh-4rem-5.5rem)] min-h-[520px] md:h-[calc(100dvh-4rem)]">
      {/* painted sky behind the canvas */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,var(--sky-mid),transparent_60%),linear-gradient(to_bottom,var(--bg),var(--bg-deep))]" />

      <div ref={wrapRef} className="hiraya-flow absolute inset-0">
        {tree.persons.length === 0 ? (
          <EmptyTree canEdit={viewer.canEditTree} onAdd={() => setForm({ open: true, person: null, relation: null })} />
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelected(null)}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            minZoom={0.08}
            maxZoom={2}
            fitView
            fitViewOptions={{ padding: 0.18, maxZoom: 1.1 }}
            proOptions={{ hideAttribution: true }}
            onlyRenderVisibleElements={nodes.length > 150}
          >
            <Background gap={28} size={1.4} color="var(--line)" />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap pannable zoomable position="bottom-right" className="!hidden md:!block"
              nodeColor={(n) => (n.type === "union" ? "transparent" : "var(--moss)")} maskColor="rgb(0 0 0 / .08)" />
          </ReactFlow>
        )}
      </div>

      {/* Toolbar */}
      <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap items-start gap-2 sm:inset-x-5 sm:top-5">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            placeholder="Find a relative…"
            className="bg-surface/95 pl-12 backdrop-blur"
            aria-label="Search the family tree"
          />
          {searchOpen && matches.length > 0 && (
            <ul className="card absolute inset-x-0 top-14 z-20 overflow-hidden p-1.5" role="listbox">
              {matches.map((p) => (
                <li key={p.id}>
                  <button type="button" className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface-2"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { centerOn(p.id); setQuery(""); setSearchOpen(false); }}>
                    <Portrait person={p} size={36} thumb={96} frame="round" />
                    <span>
                      <span className="block font-bold leading-tight">{fullName(p)}</span>
                      <span className="text-sm text-ink-faint">{lifespan(p)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Select value={mode} onChange={(e) => setMode(e.target.value as ViewMode)} className="w-auto bg-surface/95 backdrop-blur" aria-label="Tree view">
          {VIEWS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </Select>
        {mode !== "all" && focus && ix.byId.get(focus) && (
          <span className="flex h-12 items-center gap-2 rounded-2xl border border-line bg-surface/95 px-3 text-sm font-bold backdrop-blur">
            <Crosshair className="size-4 text-gold" /> {shortName(ix.byId.get(focus)!)}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="icon" title="Unfold all branches" aria-label="Unfold all" onClick={() => setCollapsed(new Set())}><ChevronsUpDown /></Button>
          <Button variant="secondary" size="icon" title="Fold to grandparents" aria-label="Fold branches"
            onClick={() => setCollapsed(new Set(tree.persons.filter((p) => (generations.get(p.id) ?? 0) === 1).map((p) => p.id)))}><ChevronsDownUp /></Button>
          <Button variant="secondary" size="icon" title="Save as image" aria-label="Save as image" onClick={() => exportImage("png")} disabled={exporting}><FileImage /></Button>
          <Button variant="secondary" size="icon" title="Save as PDF" aria-label="Save as PDF" onClick={() => exportImage("pdf")} disabled={exporting}><FileText /></Button>
          {unlinked.length > 0 && (
            <Button variant="secondary" size="icon" className="relative" title={`${unlinked.length} not yet connected`} aria-label={`${unlinked.length} people not yet connected`} onClick={() => setUnlinkedOpen(true)}>
              <Unlink />
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-extrabold leading-none text-[#2c2310]">{unlinked.length}</span>
            </Button>
          )}
          {viewer.canEditTree && (
            <Button onClick={() => setForm({ open: true, person: null, relation: null })}><UserPlus /> <span className="hidden sm:inline">Add member</span></Button>
          )}
        </div>
      </div>

      {/* Selected person panel */}
      <AnimatePresence>
        {sel && (
          <motion.aside
            key={sel.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="card absolute bottom-3 right-3 top-auto z-20 w-[calc(100%-1.5rem)] max-w-sm p-5 sm:bottom-auto sm:right-5 sm:top-24"
            aria-label={`${fullName(sel)} details`}
          >
            <button className="absolute right-3 top-3 rounded-full p-2 text-ink-soft hover:bg-surface-2" onClick={() => setSelected(null)} aria-label="Close"><X className="size-5" /></button>
            <div className={cn("flex items-center gap-4", sel.isDeceased && "memorial")}>
              <Portrait person={sel} size={76} thumb={240} />
              <div className="min-w-0">
                <p className="h-display text-xl leading-tight">{fullName(sel)}</p>
                {sel.nickname && <p className="text-sm italic text-ink-soft">“{sel.nickname}”</p>}
                <p className="text-sm text-ink-faint">
                  {sel.birthDate ? `Born ${formatDate(sel.birthDate, sel.birthDatePrecision, "short")}` : ""}
                  {sel.isDeceased ? ` · In loving memory${sel.deathDate ? ` ${formatDate(sel.deathDate, sel.deathDatePrecision, "short")}` : ""}` : ""}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button asChild size="sm" className="col-span-2"><Link href={`/people/${sel.id}`}><BookUser /> Open life story</Link></Button>
              <Button size="sm" variant="secondary" onClick={() => { setFocus(sel.id); if (mode === "all") setMode("descendants"); }}><Crosshair /> Focus here</Button>
              {(viewer.canEditTree || viewer.personId === sel.id) && (
                <Button size="sm" variant="secondary" onClick={() => openEdit(sel.id)}><Pencil /> Edit</Button>
              )}
            </div>
            {viewer.canEditTree && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-ink-faint">Grow the tree</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="ghost" className="justify-start" onClick={() => setForm({ open: true, person: null, relation: { type: "parent", personId: sel.id, personName: sel.firstName } })}><ArrowUpFromLine /> Parent</Button>
                  <Button size="sm" variant="ghost" className="justify-start" onClick={() => setForm({ open: true, person: null, relation: { type: "child", personId: sel.id, personName: sel.firstName } })}><ArrowDownToLine /> Child</Button>
                  <Button size="sm" variant="ghost" className="justify-start" onClick={() => setForm({ open: true, person: null, relation: { type: "partner", personId: sel.id, personName: sel.firstName } })}><Heart /> Partner</Button>
                  <Button size="sm" variant="ghost" className="justify-start" onClick={() => setForm({ open: true, person: null, relation: { type: "sibling", personId: sel.id, personName: sel.firstName } })}><Users /> Sibling</Button>
                  <Button size="sm" variant="ghost" className="col-span-2 justify-start" onClick={() => setLinkOpen(true)}><Link2 /> Connect to someone already in the tree</Button>
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      <Legend />

      <PersonForm
        open={form.open}
        onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))}
        person={form.person}
        relation={form.relation}
        canSeePrivate={viewer.isAdmin || (form.person ? viewer.personId === form.person.id : false)}
        onSaved={(id) => refresh(id)}
      />
      {sel && <LinkRelativeDialog open={linkOpen} onOpenChange={setLinkOpen} person={sel} people={tree.persons} onLinked={() => refresh(sel.id)} />}
      <UnlinkedPeopleDialog
        open={unlinkedOpen}
        onOpenChange={setUnlinkedOpen}
        people={unlinked}
        onPick={(id) => { setUnlinkedOpen(false); centerOn(id); }}
      />
    </div>
  );
}

function UnlinkedPeopleDialog({ open, onOpenChange, people, onPick }: {
  open: boolean; onOpenChange: (o: boolean) => void; people: PersonLite[]; onPick: (id: string) => void;
}) {
  const sorted = useMemo(() => [...people].sort((a, b) => fullName(a).localeCompare(fullName(b))), [people]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Not yet connected"
      description="These family members are in the tree but aren't linked to anyone yet. Pick one to find them, then add a relationship.">
      {sorted.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-soft">Everyone is connected. 🌳</p>
      ) : (
        <ul className="max-h-[22rem] space-y-1 overflow-y-auto">
          {sorted.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p.id)}
                className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface-2">
                <Portrait person={p} size={40} thumb={96} frame="round" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold leading-tight">{fullName(p)}</span>
                  <span className="text-sm text-ink-faint">{lifespan(p) || "No dates yet"}</span>
                </span>
                <Crosshair className="size-4 shrink-0 text-gold" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function Legend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute bottom-3 left-16 z-10 hidden sm:block">
      <button onClick={() => setOpen(!open)} className="rounded-xl border border-line bg-surface/95 px-3 py-2 text-sm font-bold text-ink-soft backdrop-blur hover:text-ink">
        {open ? "Hide key" : "Key"}
      </button>
      {open && (
        <div className="card absolute bottom-12 left-0 w-60 space-y-2 p-4 text-sm">
          {[
            ["var(--forest)", undefined, "Birth parent"],
            ["var(--sky-deep)", "8 6", "Adopted"],
            ["var(--dusk)", "2 6", "Step-parent"],
            ["var(--gold)", "10 4 2 4", "Foster"],
            ["var(--gold)", undefined, "Partners"],
            ["var(--ink-faint)", "6 6", "Former partners"],
          ].map(([c, d, l]) => (
            <div key={l} className="flex items-center gap-3">
              <svg width="40" height="8"><line x1="0" y1="4" x2="40" y2="4" stroke={c} strokeWidth="2.5" strokeDasharray={d} /></svg>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyTree({ canEdit, onAdd }: { canEdit: boolean; onAdd: () => void }) {
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="card max-w-md p-8 text-center">
        <svg viewBox="0 0 120 120" className="mx-auto size-28" aria-hidden>
          <path d="M60 110 C 58 90, 60 76, 60 64" stroke="var(--trunk, #6b4b35)" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M60 70 C 46 66, 40 54, 44 44 C 54 48, 60 58, 60 70 Z" fill="var(--moss)" />
          <path d="M60 64 C 74 60, 82 48, 78 36 C 66 40, 60 52, 60 64 Z" fill="var(--forest)" />
          <ellipse cx="60" cy="110" rx="34" ry="6" fill="var(--line)" />
        </svg>
        <h2 className="h-display mt-2 text-3xl">Plant the first seed</h2>
        <p className="mt-2 text-ink-soft">Every family tree begins with one person. Start with yourself, or the eldest ancestor you know.</p>
        {canEdit ? <Button className="mt-6" size="lg" onClick={onAdd}><UserPlus /> Add the first family member</Button>
          : <p className="mt-4 text-sm text-ink-faint">An editor will add the first family members soon.</p>}
      </div>
    </div>
  );
}

function LinkRelativeDialog({ open, onOpenChange, person, people, onLinked }: {
  open: boolean; onOpenChange: (o: boolean) => void; person: PersonLite; people: PersonLite[]; onLinked: () => void;
}) {
  const toast = useToast();
  const [type, setType] = useState("parent");
  const [other, setOther] = useState("");
  const [kind, setKind] = useState("biological");
  const [status, setStatus] = useState("current");
  const [busy, setBusy] = useState(false);
  const options = people.filter((p) => p.id !== person.id).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!other) return;
    setBusy(true);
    try {
      if (type === "partner") {
        await api("/api/relationships", { body: { type: "partner", personA: person.id, personB: other, kind: kind === "biological" ? "married" : kind, status } });
      } else {
        const [parentId, childId] = type === "parent" ? [other, person.id] : [person.id, other];
        await api("/api/relationships", { body: { type: "parent", parentId, childId, kind } });
      }
      toast("Branches connected 🌿");
      onOpenChange(false);
      onLinked();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't connect them.", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Connect ${person.firstName}`} description="Link two people who are already in the tree.">
      <form onSubmit={submit} className="space-y-4">
        <Field label={`This person is ${person.firstName}'s…`}>
          <Select value={type} onChange={(e) => { setType(e.target.value); setKind(e.target.value === "partner" ? "married" : "biological"); }}>
            <option value="parent">Parent</option>
            <option value="child">Child</option>
            <option value="partner">Partner / spouse</option>
          </Select>
        </Field>
        <Field label="Family member">
          <Select value={other} onChange={(e) => setOther(e.target.value)} required>
            <option value="">Choose…</option>
            {options.map((p) => <option key={p.id} value={p.id}>{fullName(p)} {lifespan(p) ? `(${lifespan(p)})` : ""}</option>)}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kind">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              {type === "partner" ? (
                <><option value="married">Married</option><option value="partner">Partners</option><option value="engaged">Engaged</option></>
              ) : (
                <><option value="biological">Birth</option><option value="adopted">Adopted</option><option value="step">Step</option><option value="foster">Foster</option><option value="guardian">Guardian</option></>
              )}
            </Select>
          </Field>
          {type === "partner" && (
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="current">Together</option><option value="divorced">Divorced</option><option value="separated">Separated</option><option value="widowed">Widowed</option>
              </Select>
            </Field>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={busy}><Link2 /> Connect</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function FamilyTree(props: { initial: TreeData; rootPersonId: string | null }) {
  return (
    <ReactFlowProvider>
      <TreeCanvas {...props} />
    </ReactFlowProvider>
  );
}


