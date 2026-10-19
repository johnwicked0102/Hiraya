"use client";
import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useViewer } from "@/components/shell/viewer-context";
import { PeoplePicker } from "@/components/media/people-picker";
import { uploadFile } from "@/lib/uploader";
import { api, ApiError } from "@/lib/client";
import { mediaUrl } from "@/lib/utils";
import type { PersonLite } from "@/lib/types";

export type EventValue = {
  id?: string;
  title: string;
  description: string | null;
  kind: string;
  eventDate: string;
  datePrecision: "day" | "month" | "year";
  location: string | null;
  recurring: boolean;
  mediaId: string | null;
  people: string[];
};

export const EVENT_KINDS: Record<string, string> = {
  milestone: "Milestone",
  reunion: "Family reunion",
  achievement: "Achievement",
  celebration: "Celebration",
  historical: "Historical moment",
  memorial: "Memorial",
  custom: "Other",
};

export function EventForm({ open, onOpenChange, people, initial, defaults, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  people: PersonLite[];
  initial?: EventValue | null;
  defaults?: Partial<EventValue>;
  onSaved: () => void;
}) {
  const viewer = useViewer();
  const toast = useToast();
  const blank: EventValue = { title: "", description: "", kind: "milestone", eventDate: "", datePrecision: "day", location: "", recurring: false, mediaId: null, people: [] };
  const [f, setF] = useState<EventValue>(blank);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);

  useEffect(() => {
    if (open) setF(initial ? { ...initial } : { ...blank, ...defaults });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const date = f.datePrecision === "year" ? `${f.eventDate.slice(0, 4)}-01-01` : f.datePrecision === "month" ? `${f.eventDate.slice(0, 7)}-01` : f.eventDate;
    const body = { ...f, eventDate: date, description: f.description || null, location: f.location || null };
    try {
      if (f.id) await api(`/api/events/${f.id}`, { method: "PATCH", body });
      else await api("/api/events", { body });
      toast(f.id ? "Event updated" : "Added to the family story");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!f.id || !confirm("Remove this event?")) return;
    try {
      await api(`/api/events/${f.id}`, { method: "DELETE" });
      toast("Event removed");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't remove", "error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={f.id ? "Edit event" : "Add a moment"} description="Reunions, milestones, achievements, or moments in history that touched the family." wide>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
          <Field label="What happened?"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required autoFocus placeholder="e.g. First family reunion in Tagaytay" /></Field>
          <Field label="Kind">
            <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              {Object.entries(EVENT_KINDS).filter(([k]) => viewer.canEditTree || !["historical", "memorial"].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="When">
            {f.datePrecision === "year" ? (
              <Input inputMode="numeric" maxLength={4} placeholder="YYYY" value={f.eventDate.slice(0, 4)} onChange={(e) => setF({ ...f, eventDate: e.target.value.replace(/\D/g, "") })} required />
            ) : (
              <Input type={f.datePrecision === "month" ? "month" : "date"} value={f.datePrecision === "month" ? f.eventDate.slice(0, 7) : f.eventDate} onChange={(e) => setF({ ...f, eventDate: e.target.value })} required />
            )}
          </Field>
          <Field label="How exact?">
            <Select value={f.datePrecision} onChange={(e) => setF({ ...f, datePrecision: e.target.value as EventValue["datePrecision"], recurring: e.target.value === "day" && f.recurring })}>
              <option value="day">Exact day</option><option value="month">Month</option><option value="year">Year</option>
            </Select>
          </Field>
          <Field label="Where"><Input value={f.location ?? ""} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
        </div>
        <Field label="The story"><Textarea value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {f.datePrecision === "day" && <Checkbox label="Celebrate this every year on the family calendar" checked={f.recurring} onChange={(e) => setF({ ...f, recurring: e.target.checked })} />}
        <PeoplePicker people={people} value={f.people} onChange={(v) => setF({ ...f, people: v })} label="Who was part of it?" />
        <div className="flex items-center gap-3">
          {f.mediaId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(f.mediaId, { thumb: 200 })} alt="" className="size-16 rounded-2xl object-cover" />
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-bold text-ink-soft hover:bg-surface-2">
            <ImagePlus className="size-4" /> {uploading !== null ? `Uploading ${Math.round(uploading * 100)}%` : f.mediaId ? "Change photo" : "Add a photo"}
            <input type="file" accept="image/*" className="hidden" disabled={!viewer.driveConnected || uploading !== null} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(0);
              try {
                const r = await uploadFile(file, { purpose: "memory", people: f.people, caption: f.title, onProgress: (x) => setUploading(x) });
                setF((x) => ({ ...x, mediaId: r.mediaId }));
              } catch (err) { toast(err instanceof ApiError ? err.message : "Upload failed", "error"); }
              finally { setUploading(null); }
            }} />
          </label>
        </div>
        <div className="flex justify-between gap-2 pt-2">
          {f.id ? <Button type="button" variant="ghost" className="text-danger" onClick={remove}>Remove</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" loading={busy}>Save</Button></div>
        </div>
      </form>
    </Dialog>
  );
}
