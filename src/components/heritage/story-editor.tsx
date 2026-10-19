"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Trash2, Music, FileText, Film } from "lucide-react";
import { Page, PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useViewer } from "@/components/shell/viewer-context";
import { PeoplePicker } from "@/components/media/people-picker";
import { Recorder } from "./recorder";
import { uploadFile } from "@/lib/uploader";
import { api, ApiError } from "@/lib/client";
import { mediaUrl } from "@/lib/utils";
import type { MediaItem, PersonLite } from "@/lib/types";
import { KIND_LABELS } from "@/lib/story-kinds";


type Attached = Pick<MediaItem, "id" | "kind" | "fileName" | "title">;

export function StoryEditor({ people, initial }: {
  people: PersonLite[];
  initial?: { id: string; title: string; kind: string; body: string; storyDate: string | null; coverMediaId: string | null; people: string[]; media: Attached[] } | null;
}) {
  const viewer = useViewer();
  const toast = useToast();
  const router = useRouter();
  const [f, setF] = useState({
    title: initial?.title ?? "",
    kind: initial?.kind ?? "story",
    body: initial?.body ?? "",
    storyDate: initial?.storyDate ?? "",
    coverMediaId: initial?.coverMediaId ?? null as string | null,
  });
  const [tags, setTags] = useState<string[]>(initial?.people ?? []);
  const [media, setMedia] = useState<Attached[]>(initial?.media ?? []);
  const [uploading, setUploading] = useState<{ name: string; p: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function attach(file: File) {
    setUploading({ name: file.name, p: 0 });
    try {
      const r = await uploadFile(file, { purpose: "story", people: tags, caption: f.title || null, onProgress: (p) => setUploading({ name: file.name, p }) });
      const kind = file.type.startsWith("image") ? "image" : file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "document";
      setMedia((m) => (m.some((x) => x.id === r.mediaId) ? m : [...m, { id: r.mediaId, kind, fileName: file.name, title: null }]));
      if (kind === "image" && !f.coverMediaId) setF((x) => ({ ...x, coverMediaId: r.mediaId }));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Upload failed", "error");
    } finally {
      setUploading(null);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = { ...f, storyDate: f.storyDate || null, people: tags, media: media.map((m) => m.id) };
    try {
      if (initial) {
        await api(`/api/stories/${initial.id}`, { method: "PATCH", body });
        toast("Story saved");
        router.push(`/stories/${initial.id}`);
      } else {
        const r = await api<{ id: string }>("/api/stories", { body });
        toast("Your story is now part of the family's legacy 🌱");
        router.push(`/stories/${r.id}`);
      }
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  }

  const k = KIND_LABELS[f.kind] ?? KIND_LABELS.story!;
  return (
    <Page className="max-w-4xl">
      <PageHeader eyebrow="Family Stories & Legacy" title={initial ? "Edit story" : "Write a story"} subtitle={k.hint} />
      <form onSubmit={save} className="space-y-6">
        <div className="card space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_240px]">
            <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required autoFocus placeholder="e.g. How Lolo Ben crossed the river in 1952" /></Field>
            <Field label="Kind">
              <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                {Object.entries(KIND_LABELS).map(([key, v]) => <option key={key} value={key}>{v.emoji} {v.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="When did this happen?" hint="Optional — dated stories also appear on the family timeline"><Input type="date" value={f.storyDate} onChange={(e) => setF({ ...f, storyDate: e.target.value })} className="sm:w-60" /></Field>
          <Field label={f.kind === "recipe" ? "Ingredients & steps" : "The story"}>
            <Textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="min-h-80 font-display text-lg leading-relaxed"
              placeholder={f.kind === "recipe" ? "Ingredients:\n- 1 kilo pork belly\n…\n\nSteps:\n1. …\n\nLola's secret: …" : "Start wherever the memory begins…"} />
          </Field>
          <PeoplePicker people={people} value={tags} onChange={setTags} label="Who is this story about?" />
        </div>

        <div className="card space-y-4 p-6">
          <h2 className="h-display text-xl">Photos, scans & recordings</h2>
          {viewer.driveConnected ? (
            <>
              <Recorder onRecorded={attach} />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-2.5 font-bold text-ink-soft hover:bg-surface-2">
                <Paperclip className="size-4" /> Attach photos, letters, audio or video
                <input type="file" multiple accept="image/*,video/*,audio/*,application/pdf" className="hidden"
                  onChange={async (e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; for (const file of files) await attach(file); }} />
              </label>
              {uploading && <p className="text-sm font-bold text-ink-soft">Uploading {uploading.name}… {Math.round(uploading.p * 100)}%</p>}
            </>
          ) : <p className="text-ink-soft">Attachments become available once the admin connects Google Drive.</p>}
          {media.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {media.map((m) => (
                <li key={m.id} className="relative overflow-hidden rounded-2xl border border-line bg-surface">
                  {m.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(m.id, { thumb: 300 })} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="grid aspect-square place-items-center text-ink-soft">{m.kind === "audio" ? <Music className="size-8" /> : m.kind === "video" ? <Film className="size-8" /> : <FileText className="size-8" />}</div>
                  )}
                  <div className="flex items-center gap-1 p-2 text-xs">
                    <span className="flex-1 truncate font-bold">{m.title ?? m.fileName}</span>
                    {m.kind === "image" && (
                      <button type="button" className={f.coverMediaId === m.id ? "font-extrabold text-gold" : "text-ink-faint hover:text-ink"} onClick={() => setF({ ...f, coverMediaId: m.id })}>{f.coverMediaId === m.id ? "Cover" : "Make cover"}</button>
                    )}
                    <button type="button" aria-label="Detach" className="p-1 text-ink-faint hover:text-danger" onClick={() => { setMedia(media.filter((x) => x.id !== m.id)); if (f.coverMediaId === m.id) setF({ ...f, coverMediaId: null }); }}><Trash2 className="size-3.5" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" size="lg" loading={busy} disabled={!!uploading}>{initial ? "Save story" : "Preserve this story"}</Button>
        </div>
      </form>
    </Page>
  );
}
