"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronLeft, ChevronRight, X, Download, Pencil, Play, Pause, MapPin, CalendarDays, Music, FileText, Film, Trash2, Info,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useViewer } from "@/components/shell/viewer-context";
import { Portrait } from "@/components/portrait";
import { PeoplePicker } from "./people-picker";
import { api, ApiError } from "@/lib/client";
import { cn, formatDate, mediaUrl, shortName } from "@/lib/utils";
import type { Album, MediaItem, PersonLite } from "@/lib/types";

const TILTS = ["-rotate-[1.2deg]", "rotate-[0.8deg]", "-rotate-[0.4deg]", "rotate-[1.4deg]", "rotate-0", "-rotate-[0.9deg]"];

function Thumb({ m, className }: { m: MediaItem; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (m.kind === "audio") {
    return <div className={cn("grid aspect-[4/3] place-items-center bg-gradient-to-br from-sky/50 to-meadow/40", className)}><Music className="size-10 text-forest" /></div>;
  }
  if (m.kind === "document") {
    return <div className={cn("grid aspect-[4/3] place-items-center bg-gradient-to-br from-sun/40 to-surface-2", className)}><FileText className="size-10 text-gold" /></div>;
  }
  if (failed) {
    return <div className={cn("grid aspect-[4/3] place-items-center bg-surface-2 text-ink-faint", className)}>{m.kind === "video" ? <Film className="size-10" /> : "Preview soon"}</div>;
  }
  const ratio = m.width && m.height ? `${m.width} / ${m.height}` : "4 / 3";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mediaUrl(m.id, { thumb: 640 })} alt={m.title ?? m.caption ?? m.fileName} loading="lazy" decoding="async"
      onError={() => setFailed(true)} className={cn("w-full bg-surface-2 object-cover", className)} style={{ aspectRatio: ratio }} />
  );
}

/** Scrapbook-style grid with lightbox, slideshow and editing. */
export function MediaGallery({ items, people, albums, onChanged, emptyText = "No memories here yet." }: {
  items: MediaItem[];
  people: PersonLite[];
  albums: Album[];
  onChanged?: () => void;
  emptyText?: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [slideshow, setSlideshow] = useState(false);
  if (!items.length) {
    return <div className="card grid place-items-center p-12 text-center text-ink-soft">{emptyText}</div>;
  }
  return (
    <>
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
        {items.map((m, i) => (
          <motion.button
            key={m.id}
            type="button"
            onClick={() => setIndex(i)}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "80px" }}
            transition={{ duration: 0.45, delay: (i % 8) * 0.03 }}
            className={cn("group relative block w-full break-inside-avoid rounded-md bg-[#fffdf7] p-2 pb-3 text-left shadow-[0_10px_24px_-14px_rgb(var(--shadow)/.55)] transition hover:z-10 hover:rotate-0 hover:scale-[1.02] dark:bg-surface-2", TILTS[i % TILTS.length])}
          >
            <span className="absolute -top-2 left-1/2 z-10 h-4 w-14 -translate-x-1/2 rotate-[-3deg] rounded-sm bg-sun/60 opacity-80 dark:bg-gold/30" aria-hidden />
            <div className="relative overflow-hidden rounded-sm">
              <Thumb m={m} />
              {m.kind === "video" && <span className="absolute inset-0 grid place-items-center"><span className="grid size-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur"><Play className="ml-0.5 size-6" /></span></span>}
            </div>
            {(m.title || m.caption || m.takenOn) && (
              <div className="px-1 pt-2">
                {(m.title || m.caption) && <p className="line-clamp-2 font-display text-[0.98rem] leading-snug text-[#3a3226] dark:text-ink">{m.title ?? m.caption}</p>}
                {m.takenOn && <p className="mt-0.5 text-xs font-semibold text-[#8a7f6a] dark:text-ink-faint">{formatDate(m.takenOn, "day", "short")}</p>}
              </div>
            )}
          </motion.button>
        ))}
      </div>
      <AnimatePresence>
        {index !== null && (
          <Lightbox items={items} index={index} setIndex={setIndex} people={people} albums={albums} onChanged={onChanged}
            slideshow={slideshow} setSlideshow={setSlideshow} />
        )}
      </AnimatePresence>
    </>
  );
}

export function SlideshowButton({ items, people, albums }: { items: MediaItem[]; people: PersonLite[]; albums: Album[] }) {
  const [on, setOn] = useState<number | null>(null);
  const [slideshow, setSlideshow] = useState(true);
  const images = useMemo(() => items.filter((m) => m.kind === "image"), [items]);
  return (
    <>
      <Button variant="secondary" disabled={!images.length} onClick={() => { setSlideshow(true); setOn(0); }}><Play /> Slideshow</Button>
      <AnimatePresence>
        {on !== null && <Lightbox items={images} index={on} setIndex={setOn} people={people} albums={albums} slideshow={slideshow} setSlideshow={setSlideshow} />}
      </AnimatePresence>
    </>
  );
}

function Lightbox({ items, index, setIndex, people, albums, onChanged, slideshow, setSlideshow }: {
  items: MediaItem[];
  index: number;
  setIndex: (i: number | null) => void;
  people: PersonLite[];
  albums: Album[];
  onChanged?: () => void;
  slideshow: boolean;
  setSlideshow: (b: boolean) => void;
}) {
  const viewer = useViewer();
  const m = items[index]!;
  const [info, setInfo] = useState(false);
  const [edit, setEdit] = useState(false);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const go = useCallback((d: number) => setIndex((index + d + items.length) % items.length), [index, items.length, setIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (edit) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") setIndex(null);
      if (e.key === " " && m.kind === "image") { e.preventDefault(); setSlideshow(!slideshow); }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [go, setIndex, edit, slideshow, setSlideshow, m.kind]);

  useEffect(() => {
    if (!slideshow || m.kind !== "image" || items.length < 2) return;
    const t = setTimeout(() => go(1), 5500);
    return () => clearTimeout(t);
  }, [slideshow, index, go, m.kind, items.length]);

  // Swipe on phones
  const [touchX, setTouchX] = useState<number | null>(null);
  const canEdit = viewer.canEditTree || m.uploadedBy === viewer.accountId;

  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col bg-[#0f1612]/95 text-[#f3ecd8]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      role="dialog" aria-modal="true" aria-label="Memory viewer"
      onTouchStart={(e) => setTouchX(e.touches[0]!.clientX)}
      onTouchEnd={(e) => { if (touchX !== null) { const dx = e.changedTouches[0]!.clientX - touchX; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); } setTouchX(null); }}>
      <div className="flex items-center gap-2 p-3 sm:p-4">
        <p className="min-w-0 flex-1 truncate font-display text-lg">{m.title ?? m.caption ?? m.fileName}</p>
        <span className="text-sm opacity-70">{index + 1} / {items.length}</span>
        {m.kind === "image" && items.length > 1 && (
          <button className="rounded-full p-2.5 hover:bg-white/10" onClick={() => setSlideshow(!slideshow)} aria-label={slideshow ? "Pause slideshow" : "Play slideshow"}>
            {slideshow ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
        )}
        <button className="rounded-full p-2.5 hover:bg-white/10" onClick={() => setInfo(!info)} aria-label="Details"><Info className="size-5" /></button>
        {viewer.canDownload && <a className="rounded-full p-2.5 hover:bg-white/10" href={mediaUrl(m.id, { download: true })} aria-label="Download original"><Download className="size-5" /></a>}
        {canEdit && <button className="rounded-full p-2.5 hover:bg-white/10" onClick={() => setEdit(true)} aria-label="Edit"><Pencil className="size-5" /></button>}
        <button className="rounded-full p-2.5 hover:bg-white/10" onClick={() => setIndex(null)} aria-label="Close"><X className="size-6" /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
        <AnimatePresence mode="wait">
          <motion.div key={m.id} className="flex h-full w-full items-center justify-center" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            {m.kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(m.id, { thumb: 1600 })} alt={m.title ?? m.caption ?? ""} className={cn("max-h-full max-w-full rounded-lg object-contain shadow-2xl", slideshow && "animate-[kenburns_6s_ease-out_both]")} />
            )}
            {m.kind === "video" && <video src={mediaUrl(m.id)} controls autoPlay playsInline className="max-h-full max-w-full rounded-lg" />}
            {m.kind === "audio" && (
              <div className="w-full max-w-lg rounded-3xl bg-white/5 p-8 text-center">
                <Music className="mx-auto size-14 opacity-80" />
                <p className="mt-3 font-display text-xl">{m.title ?? m.fileName}</p>
                <audio src={mediaUrl(m.id)} controls autoPlay className="mt-6 w-full" />
              </div>
            )}
            {m.kind === "document" && (
              <div className="w-full max-w-lg rounded-3xl bg-white/5 p-8 text-center">
                <FileText className="mx-auto size-14 opacity-80" />
                <p className="mt-3 font-display text-xl">{m.title ?? m.fileName}</p>
                <a href={mediaUrl(m.id)} target="_blank" rel="noreferrer" className="mt-6 inline-block rounded-2xl bg-white/15 px-5 py-3 font-bold hover:bg-white/25">Open document</a>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        {items.length > 1 && (
          <>
            <button onClick={() => go(-1)} className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 sm:block" aria-label="Previous"><ChevronLeft className="size-7" /></button>
            <button onClick={() => go(1)} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 sm:block" aria-label="Next"><ChevronRight className="size-7" /></button>
          </>
        )}
      </div>
      <AnimatePresence>
        {(info || m.caption || m.people.length > 0) && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="mx-auto w-full max-w-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {m.caption && m.title && <p className="mb-2 text-[0.98rem] opacity-90">{m.caption}</p>}
            {m.caption && !m.title && null}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm opacity-80">
              {m.takenOn && <span className="flex items-center gap-1.5"><CalendarDays className="size-4" /> {formatDate(m.takenOn)}</span>}
              {m.location && <span className="flex items-center gap-1.5"><MapPin className="size-4" /> {m.location}</span>}
              {info && m.uploaderName && <span>Shared by {m.uploaderName}</span>}
            </div>
            {m.people.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {m.people.map((pid) => {
                  const p = byId.get(pid);
                  return p ? (
                    <a key={pid} href={`/people/${pid}`} className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-sm font-bold hover:bg-white/20">
                      <Portrait person={p} size={26} thumb={64} frame="round" className="!shadow-none" /> {shortName(p)}
                    </a>
                  ) : null;
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {edit && <EditMediaDialog m={m} people={people} albums={albums} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); onChanged?.(); }} onDeleted={() => { setEdit(false); setIndex(null); onChanged?.(); }} />}
    </motion.div>
  );
}

function EditMediaDialog({ m, people, albums, onClose, onSaved, onDeleted }: {
  m: MediaItem; people: PersonLite[]; albums: Album[]; onClose: () => void; onSaved: () => void; onDeleted: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({ title: m.title ?? "", caption: m.caption ?? "", takenOn: m.takenOn ?? "", location: m.location ?? "", albumId: m.albumId ?? "" });
  const [tags, setTags] = useState<string[]>(m.people);
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/media/${m.id}`, { method: "PATCH", body: { ...f, albumId: f.albumId || null, takenOn: f.takenOn || null, people: tags } });
      toast("Memory updated");
      onSaved();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't save.", "error");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm("Remove this memory from Hiraya? The original moves to Google Drive's trash, where the admin can still recover it for 30 days.")) return;
    try {
      await api(`/api/media/${m.id}`, { method: "DELETE" });
      toast("Memory removed");
      onDeleted();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't remove.", "error");
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Edit memory" wide>
      <form onSubmit={save} className="space-y-4 text-ink">
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Caption"><Textarea value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date"><Input type="date" value={f.takenOn} onChange={(e) => setF({ ...f, takenOn: e.target.value })} /></Field>
          <Field label="Place"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
          <Field label="Album">
            <Select value={f.albumId} onChange={(e) => setF({ ...f, albumId: e.target.value })}>
              <option value="">No album</option>
              {albums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </Select>
          </Field>
        </div>
        <PeoplePicker people={people} value={tags} onChange={setTags} />
        <div className="flex justify-between gap-2 pt-2">
          <Button type="button" variant="ghost" className="text-danger" onClick={remove}><Trash2 /> Remove</Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={busy}>Save</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
