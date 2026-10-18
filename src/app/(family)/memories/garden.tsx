"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Upload, FolderPlus, Search, Images, X, Flower2 } from "lucide-react";
import { Page, PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useViewer } from "@/components/shell/viewer-context";
import { MediaGallery, SlideshowButton } from "@/components/media/media-gallery";
import { UploaderDialog } from "@/components/media/uploader-dialog";
import { api, ApiError } from "@/lib/client";
import { cn, formatDate, fullName, mediaUrl } from "@/lib/utils";
import type { Album, MediaItem, PersonLite } from "@/lib/types";

type Filters = { album?: string; person?: string; kind?: string; year?: string; q?: string };

export function MemoryGarden({ initial, albums: initialAlbums, people, initialFilters }: {
  initial: { items: MediaItem[]; hasMore: boolean };
  albums: Album[];
  people: PersonLite[];
  initialFilters: Filters;
}) {
  const viewer = useViewer();
  const router = useRouter();
  const toast = useToast();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [items, setItems] = useState(initial.items);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [albums, setAlbums] = useState(initialAlbums);
  const [loading, setLoading] = useState(false);
  const [upload, setUpload] = useState(false);
  const [albumForm, setAlbumForm] = useState(false);
  const [q, setQ] = useState(initialFilters.q ?? "");

  const qs = useCallback((f: Filters, offset = 0) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
    if (offset) p.set("offset", String(offset));
    return p.toString();
  }, []);

  const load = useCallback(async (f: Filters) => {
    setLoading(true);
    try {
      const r = await api<{ items: MediaItem[]; hasMore: boolean }>(`/api/media?${qs(f)}`);
      setItems(r.items);
      setHasMore(r.hasMore);
      window.history.replaceState(null, "", `/memories${qs(f) ? `?${qs(f)}` : ""}`);
    } finally {
      setLoading(false);
    }
  }, [qs]);

  const apply = (patch: Filters) => {
    const f = { ...filters, ...patch };
    setFilters(f);
    load(f);
  };

  useEffect(() => {
    const t = setTimeout(() => { if ((filters.q ?? "") !== q) apply({ q: q || undefined }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function more() {
    setLoading(true);
    try {
      const r = await api<{ items: MediaItem[]; hasMore: boolean }>(`/api/media?${qs(filters, items.length)}`);
      setItems((x) => [...x, ...r.items]);
      setHasMore(r.hasMore);
    } finally {
      setLoading(false);
    }
  }

  const refresh = useCallback(async () => {
    await load(filters);
    setAlbums((await api<{ albums: Album[] }>("/api/albums")).albums);
    router.refresh();
  }, [filters, load, router]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 120 }, (_, i) => now - i);
  }, []);
  const activeAlbum = albums.find((a) => a.id === filters.album);
  const activePerson = people.find((p) => p.id === filters.person);

  return (
    <Page>
      <PageHeader
        eyebrow="Memory Garden"
        title={activeAlbum ? activeAlbum.title : "Where memories bloom"}
        subtitle={activeAlbum?.description ?? "Photos, videos and voices from every generation — safely kept in the family's private archive."}
        actions={
          <>
            <SlideshowButton items={items} people={people} albums={albums} />
            {viewer.canContribute && <Button variant="secondary" onClick={() => setAlbumForm(true)}><FolderPlus /> New album</Button>}
            {viewer.canContribute && <Button onClick={() => setUpload(true)}><Upload /> Share memories</Button>}
          </>
        }
      />

      {albums.length > 0 && !filters.album && (
        <section className="mb-8" aria-label="Albums">
          <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3">
            {albums.map((a, i) => (
              <motion.button key={a.id} type="button" onClick={() => apply({ album: a.id })}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="group relative w-48 shrink-0 snap-start text-left">
                <div className="relative aspect-[4/3]">
                  <div className="absolute inset-0 translate-x-2 translate-y-1 rotate-3 rounded-2xl bg-sun/50" />
                  <div className="absolute inset-0 -translate-x-1 -rotate-2 rounded-2xl bg-meadow/50" />
                  <div className="absolute inset-0 overflow-hidden rounded-2xl border-4 border-[#fffdf7] bg-surface-2 shadow-lg transition group-hover:-translate-y-1 dark:border-surface-2">
                    {a.coverMediaId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl(a.coverMediaId, { thumb: 400 })} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : <div className="grid h-full place-items-center text-moss"><Images className="size-8" /></div>}
                  </div>
                </div>
                <p className="mt-3 truncate font-display text-lg font-semibold">{a.title}</p>
                <p className="text-sm text-ink-faint">{a.mediaCount} {a.mediaCount === 1 ? "memory" : "memories"}{a.eventDate ? ` · ${formatDate(a.eventDate, "year")}` : ""}</p>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      <div className="card mb-6 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 z-10 size-5 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search captions, places…" className="pl-12" aria-label="Search memories" />
        </div>
        <Select value={filters.kind ?? ""} onChange={(e) => apply({ kind: e.target.value || undefined })} className="w-auto" aria-label="Type">
          <option value="">Everything</option><option value="image">Photos</option><option value="video">Videos</option><option value="audio">Voices</option><option value="document">Documents</option>
        </Select>
        <Select value={filters.person ?? ""} onChange={(e) => apply({ person: e.target.value || undefined })} className="w-auto max-w-56" aria-label="Person">
          <option value="">Anyone</option>
          {[...people].sort((a, b) => fullName(a).localeCompare(fullName(b))).map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
        </Select>
        <Select value={filters.year ?? ""} onChange={(e) => apply({ year: e.target.value || undefined })} className="w-auto" aria-label="Year">
          <option value="">Any year</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        {(activeAlbum || activePerson || filters.kind || filters.year || filters.q) && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); const f = {}; setFilters(f); load(f); }}><X /> Clear</Button>
        )}
      </div>

      {activeAlbum && (
        <div className="mb-4 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => apply({ album: undefined })}>← All memories</Button>
          {viewer.canEditTree && (
            <Button variant="ghost" size="sm" className="text-danger" onClick={async () => {
              if (!confirm(`Remove the album “${activeAlbum.title}” and its ${activeAlbum.mediaCount} ${activeAlbum.mediaCount === 1 ? "memory" : "memories"}? They leave the garden, but the originals stay in Google Drive's trash for 30 days where an admin can recover them.`)) return;
              try { await api(`/api/albums/${activeAlbum.id}`, { method: "DELETE" }); toast("Album and its memories removed"); apply({ album: undefined }); refresh(); }
              catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't remove album", "error"); }
            }}>Remove album</Button>
          )}
        </div>
      )}

      <div className={cn("transition-opacity", loading && "opacity-60")}>
        <MediaGallery items={items} people={people} albums={albums} onChanged={refresh}
          emptyText={viewer.canContribute ? "Nothing has bloomed here yet — share the first memory!" : "Nothing has bloomed here yet."} />
      </div>
      {hasMore && <div className="mt-8 text-center"><Button variant="secondary" onClick={more} loading={loading}><Flower2 /> Show more memories</Button></div>}

      <UploaderDialog open={upload} onOpenChange={setUpload} people={people} albums={albums}
        defaults={{ albumId: filters.album ?? null, people: filters.person ? [filters.person] : [] }} onDone={refresh} />
      <AlbumDialog open={albumForm} onOpenChange={setAlbumForm} onCreated={(id) => { refresh(); apply({ album: id }); }} />
    </Page>
  );
}

function AlbumDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ title: "", description: "", eventDate: "" });
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New album" description="Group memories from a reunion, a wedding, a summer at the province…">
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api<{ id: string }>("/api/albums", { body: { ...f, eventDate: f.eventDate || null } });
          toast("Album created");
          onOpenChange(false);
          setF({ title: "", description: "", eventDate: "" });
          onCreated(r.id);
        } catch (err) { toast(err instanceof ApiError ? err.message : "Couldn't create album", "error"); }
        finally { setBusy(false); }
      }}>
        <Field label="Album name"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required autoFocus placeholder="e.g. Christmas Reunion 2025" /></Field>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="min-h-20" /></Field>
        <Field label="Date of the event"><Input type="date" value={f.eventDate} onChange={(e) => setF({ ...f, eventDate: e.target.value })} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" loading={busy}>Create album</Button></div>
      </form>
    </Dialog>
  );
}
