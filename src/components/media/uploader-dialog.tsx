"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, CheckCircle2, CircleAlert, Copy, RotateCcw, Film, Image as ImageIcon, Music, FileText } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useViewer } from "@/components/shell/viewer-context";
import { PeoplePicker } from "./people-picker";
import { uploadFile } from "@/lib/uploader";
import { ApiError } from "@/lib/client";
import { bytes, cn } from "@/lib/utils";
import type { Album, PersonLite } from "@/lib/types";

type Item = {
  key: string;
  file: File;
  progress: number;
  phase: string;
  state: "queued" | "uploading" | "done" | "duplicate" | "error";
  error?: string;
  preview?: string;
};

const CONCURRENCY = 2;

function KindIcon({ type }: { type: string }) {
  if (type.startsWith("video")) return <Film className="size-5" />;
  if (type.startsWith("audio")) return <Music className="size-5" />;
  if (type.startsWith("image")) return <ImageIcon className="size-5" />;
  return <FileText className="size-5" />;
}

/**
 * Multi-file uploader: drag & drop or pick, shared details (album, date, caption,
 * people), per-file progress, duplicate detection and retry.
 */
export function UploaderDialog({
  open, onOpenChange, people, albums, defaults, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  people: PersonLite[];
  albums: Album[];
  defaults?: { people?: string[]; albumId?: string | null };
  onDone: () => void;
}) {
  const viewer = useViewer();
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState({ albumId: "", takenOn: "", location: "", caption: "" });
  const [tags, setTags] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setItems([]);
      setTags(defaults?.people ?? []);
      setMeta({ albumId: defaults?.albumId ?? "", takenOn: "", location: "", caption: "" });
    } else {
      abortRef.current?.abort();
    }
  }, [open, defaults?.people, defaults?.albumId]);

  useEffect(() => () => items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)), [items]);

  const add = (files: FileList | File[]) => {
    const next = [...files].map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      progress: 0,
      phase: "",
      state: "queued" as const,
      preview: file.type.startsWith("image/") && file.size < 25e6 ? URL.createObjectURL(file) : undefined,
    }));
    setItems((x) => [...x, ...next]);
  };

  const patch = (key: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const run = useCallback(async (list: Item[]) => {
    setRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const queue = [...list];
    const worker = async () => {
      while (queue.length && !ctrl.signal.aborted) {
        const it = queue.shift()!;
        patch(it.key, { state: "uploading", error: undefined, progress: 0 });
        try {
          const r = await uploadFile(it.file, {
            purpose: "memory",
            albumId: meta.albumId || null,
            takenOn: meta.takenOn || null,
            location: meta.location || null,
            caption: meta.caption || null,
            people: tags,
            signal: ctrl.signal,
            onProgress: (f, phase) => patch(it.key, { progress: f, phase }),
          });
          patch(it.key, { state: r.duplicate ? "duplicate" : "done", progress: 1 });
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
          patch(it.key, { state: "error", error: e instanceof ApiError ? e.message : "Upload failed" });
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
    onDone();
  }, [meta, tags, onDone]);

  const queued = items.filter((i) => i.state === "queued" || i.state === "error");
  const finished = items.length > 0 && items.every((i) => i.state === "done" || i.state === "duplicate");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!running || !o) onOpenChange(o); }} title="Share memories" description="Original quality is kept — files go straight to the family's private Google Drive archive." wide>
      {!viewer.driveConnected ? (
        <div className="rounded-3xl bg-sun/25 p-6 text-center">
          <p className="font-bold">Google Drive isn&apos;t connected yet.</p>
          <p className="mt-1 text-ink-soft">The family admin connects it once from the Admin dashboard, and then everyone can share photos and videos.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) add(e.dataTransfer.files); }}
            className={cn("grid place-items-center rounded-3xl border-2 border-dashed p-8 text-center transition", drag ? "border-gold bg-sun/20" : "border-line bg-surface-2/50")}
          >
            <UploadCloud className="size-10 text-moss" />
            <p className="mt-2 font-bold">Drop photos, videos, voice recordings or PDFs here</p>
            <p className="text-sm text-ink-faint">Up to 5 GB each</p>
            <input ref={inputRef} type="file" multiple accept="image/*,video/*,audio/*,application/pdf" className="hidden"
              onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
            <Button type="button" variant="secondary" className="mt-4" onClick={() => inputRef.current?.click()}>Choose files</Button>
          </div>

          {items.length > 0 && (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {items.map((i) => (
                <li key={i.key} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5">
                  <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 text-ink-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {i.preview ? <img src={i.preview} alt="" className="h-full w-full object-cover" /> : <KindIcon type={i.file.type} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{i.file.name}</p>
                    <p className="text-xs text-ink-faint">
                      {bytes(i.file.size)}
                      {i.state === "uploading" && ` · ${i.phase === "hashing" ? "checking for duplicates…" : i.phase === "finishing" ? "saving…" : `${Math.round(i.progress * 100)}%`}`}
                      {i.state === "duplicate" && " · already in the garden — skipped"}
                      {i.state === "error" && ` · ${i.error}`}
                    </p>
                    {(i.state === "uploading" || i.state === "queued") && (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-forest transition-[width]" style={{ width: `${Math.round(i.progress * 100)}%` }} />
                      </div>
                    )}
                  </div>
                  {i.state === "done" && <CheckCircle2 className="size-5 text-forest" aria-label="Uploaded" />}
                  {i.state === "duplicate" && <Copy className="size-5 text-gold" aria-label="Duplicate" />}
                  {i.state === "error" && <CircleAlert className="size-5 text-danger" aria-label="Failed" />}
                  {i.state === "queued" && !running && (
                    <button type="button" className="text-sm font-bold text-ink-faint hover:text-danger" onClick={() => setItems((x) => x.filter((y) => y.key !== i.key))}>Remove</button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Album">
              <Select value={meta.albumId} onChange={(e) => setMeta({ ...meta, albumId: e.target.value })}>
                <option value="">No album</option>
                {albums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </Select>
            </Field>
            <Field label="When was this?" hint="Leave blank to use the photo's own date"><Input type="date" value={meta.takenOn} onChange={(e) => setMeta({ ...meta, takenOn: e.target.value })} /></Field>
            <Field label="Where?"><Input value={meta.location} onChange={(e) => setMeta({ ...meta, location: e.target.value })} placeholder="e.g. Lola's house, Batangas" /></Field>
          </div>
          <Field label="Caption"><Textarea value={meta.caption} onChange={(e) => setMeta({ ...meta, caption: e.target.value })} className="min-h-20" placeholder="What was happening? Who took it?" /></Field>
          <PeoplePicker people={people} value={tags} onChange={setTags} />

          <div className="flex flex-wrap justify-end gap-2">
            {items.some((i) => i.state === "error") && !running && (
              <Button type="button" variant="secondary" onClick={() => run(items.filter((i) => i.state === "error"))}><RotateCcw /> Retry failed</Button>
            )}
            {finished ? (
              <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>
            ) : (
              <Button type="button" loading={running} disabled={!queued.length} onClick={() => run(items.filter((i) => i.state === "queued"))}>
                <UploadCloud /> Upload {queued.filter((q) => q.state === "queued").length || ""}
              </Button>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
