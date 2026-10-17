"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Video, Square, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Record an audio or video interview right in the browser (e.g. with Lola and Lolo). */
export function Recorder({ onRecorded }: { onRecorded: (file: File) => void }) {
  const [mode, setMode] = useState<"audio" | "video" | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "review">("idle");
  const [seconds, setSeconds] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<File | null>(null);

  useEffect(() => () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  async function start(kind: "audio" | "video") {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia(kind === "video" ? { audio: true, video: { facingMode: "user" } } : { audio: true });
      stream.current = s;
      if (kind === "video" && preview.current) {
        preview.current.srcObject = s;
        preview.current.muted = true;
        await preview.current.play().catch(() => {});
      }
      const candidates = kind === "video" ? ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"] : ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];
      const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(s, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        const type = (r.mimeType || mimeType || (kind === "video" ? "video/webm" : "audio/webm")).split(";")[0]!;
        const blob = new Blob(chunks.current, { type });
        const ext = type.includes("mp4") ? (kind === "video" ? "mp4" : "m4a") : "webm";
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
        fileRef.current = new File([blob], `interview-${stamp}.${ext}`, { type });
        setBlobUrl(URL.createObjectURL(blob));
        setState("review");
        s.getTracks().forEach((t) => t.stop());
        if (preview.current) preview.current.srcObject = null;
      };
      rec.current = r;
      r.start(1000);
      setMode(kind);
      setSeconds(0);
      setState("recording");
    } catch {
      setError("Couldn't use the microphone/camera. Please allow access in your browser settings.");
    }
  }

  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <div className="rounded-3xl border border-line bg-surface-2/60 p-4">
      {state === "idle" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 font-bold text-ink-soft">Record an interview:</span>
          <Button type="button" variant="secondary" size="sm" onClick={() => start("audio")}><Mic /> Voice</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => start("video")}><Video /> Video</Button>
        </div>
      )}
      <video ref={preview} playsInline className={mode === "video" && state === "recording" ? "mb-3 max-h-64 w-full rounded-2xl bg-black object-cover" : "hidden"} />
      {state === "recording" && (
        <div className="flex items-center gap-3">
          <span className="size-3 animate-pulse rounded-full bg-danger" />
          <span className="font-mono font-bold">{mm}</span>
          <span className="text-ink-soft">Recording…</span>
          <Button type="button" variant="danger" size="sm" className="ml-auto" onClick={() => rec.current?.stop()}><Square /> Stop</Button>
        </div>
      )}
      {state === "review" && blobUrl && (
        <div className="space-y-3">
          {mode === "video" ? <video src={blobUrl} controls playsInline className="max-h-64 w-full rounded-2xl bg-black" /> : <audio src={blobUrl} controls className="w-full" />}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => { setState("idle"); setBlobUrl(null); }}><RotateCcw /> Record again</Button>
            <Button type="button" size="sm" onClick={() => { if (fileRef.current) onRecorded(fileRef.current); setState("idle"); setBlobUrl(null); }}><Check /> Keep this recording</Button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
