"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { ImagePlus, Images, ZoomIn, Check } from "lucide-react";
import { Portrait } from "@/components/portrait";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useViewer } from "@/components/shell/viewer-context";
import { uploadFile } from "@/lib/uploader";
import { api, ApiError } from "@/lib/client";
import { cn, mediaUrl } from "@/lib/utils";
import type { Crop, Frame, MediaItem, PersonLite } from "@/lib/types";

const FRAMES: { id: Frame; label: string }[] = [
  { id: "round", label: "Golden circle" },
  { id: "storybook", label: "Storybook arch" },
  { id: "oval", label: "Heirloom oval" },
  { id: "leaf", label: "Leaf" },
  { id: "polaroid", label: "Snapshot" },
];

export interface PortraitValue {
  photoMediaId: string | null;
  photoCrop: Crop | null;
  photoFrame: Frame;
}

/**
 * Upload or pick a portrait, then crop / zoom / reposition and choose a frame.
 * Only the crop rectangle is saved — the original photo is never altered.
 */
export function PortraitEditor({
  person, value, onChange,
}: {
  person: Pick<PersonLite, "firstName" | "lastName" | "gender" | "isDeceased">;
  value: PortraitValue;
  onChange: (v: PortraitValue) => void;
}) {
  const toast = useToast();
  const viewer = useViewer();
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Please choose a photo.", "error");
    setProgress(0);
    try {
      const r = await uploadFile(f, { purpose: "portrait", onProgress: (x) => setProgress(x) });
      onChange({ ...value, photoMediaId: r.mediaId, photoCrop: null });
      setCropOpen(true);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Upload failed.", "error");
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="grid place-items-center rounded-3xl bg-surface-2 p-6">
        <Portrait person={person} mediaId={value.photoMediaId} crop={value.photoCrop} frame={value.photoFrame} size={120} />
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={!viewer.driveConnected || progress !== null}
            title={viewer.driveConnected ? undefined : "Google Drive isn't connected yet"}>
            <ImagePlus /> {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : "Upload photo"}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setPickOpen(true)}><Images /> From Memory Garden</Button>
          {value.photoMediaId && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setCropOpen(true)}><ZoomIn /> Adjust</Button>
          )}
          {value.photoMediaId && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, photoMediaId: null, photoCrop: null })}>Remove</Button>
          )}
        </div>
        {!viewer.driveConnected && <p className="text-sm text-ink-faint">Photo uploads start once the family admin connects Google Drive.</p>}
        <div>
          <p className="mb-2 text-sm font-bold text-ink-soft">Frame</p>
          <div className="flex flex-wrap gap-2">
            {FRAMES.map((f) => (
              <button key={f.id} type="button" onClick={() => onChange({ ...value, photoFrame: f.id })}
                className={cn("rounded-xl border px-3 py-1.5 text-sm font-bold transition", value.photoFrame === f.id ? "border-gold bg-sun/30 text-ink" : "border-line text-ink-soft hover:bg-surface-2")}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {value.photoMediaId && (
        <CropDialog open={cropOpen} onOpenChange={setCropOpen} mediaId={value.photoMediaId} frame={value.photoFrame} initial={value.photoCrop}
          onSave={(c) => onChange({ ...value, photoCrop: c })} />
      )}
      <PickPhotoDialog open={pickOpen} onOpenChange={setPickOpen} onPick={(id) => { onChange({ ...value, photoMediaId: id, photoCrop: null }); setPickOpen(false); setCropOpen(true); }} />
    </div>
  );
}

function CropDialog({ open, onOpenChange, mediaId, frame, initial, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; mediaId: string; frame: Frame; initial: Crop | null; onSave: (c: Crop) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const aspect = frame === "storybook" || frame === "oval" ? 1 / 1.18 : 1;
  const onComplete = useCallback((a: Area) => setArea(a), []);
  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Frame the portrait" description="Drag to reposition, pinch or use the slider to zoom. The original photo stays untouched." wide>
      <div className="relative h-[55dvh] min-h-72 overflow-hidden rounded-3xl bg-[#1d2620]">
        <Cropper
          image={mediaUrl(mediaId, { thumb: 1600 })}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          maxZoom={5}
          cropShape={frame === "round" ? "round" : "rect"}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onComplete}
          initialCroppedAreaPercentages={initial ?? undefined}
        />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <ZoomIn className="size-5 text-ink-soft" />
        <input type="range" min={1} max={5} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[var(--forest)]" aria-label="Zoom" />
        <Button type="button" onClick={() => { if (area) onSave({ x: area.x, y: area.y, width: area.width, height: area.height }); onOpenChange(false); }}>
          <Check /> Use this framing
        </Button>
      </div>
    </Dialog>
  );
}

function PickPhotoDialog({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (id: string) => void }) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setItems(null);
    api<{ items: MediaItem[] }>("/api/media?kind=image&limit=60").then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Choose a photo" description="Pick any photo from the Memory Garden." wide>
      {items === null ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton aspect-square rounded-2xl" />)}</div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-ink-soft">No photos in the garden yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {items.map((m) => (
            <button key={m.id} type="button" onClick={() => onPick(m.id)} className="overflow-hidden rounded-2xl ring-gold transition hover:ring-4 focus-visible:ring-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(m.id, { thumb: 300 })} alt={m.title ?? m.fileName} loading="lazy" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}
