"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Hourglass, Lock, MailOpen, Plus, Paperclip, Trash2, Users } from "lucide-react";
import { Page, PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useViewer } from "@/components/shell/viewer-context";
import { PeoplePicker } from "@/components/media/people-picker";
import { Portrait } from "@/components/portrait";
import { uploadFile } from "@/lib/uploader";
import { api, ApiError } from "@/lib/client";
import { mediaUrl, shortName } from "@/lib/utils";
import type { PersonLite } from "@/lib/types";

export type Capsule = {
  id: string; title: string; unlockAt: string; audience: "family" | "people"; authorId: string | null; authorName: string | null;
  createdAt: string; isOpen: boolean; message: string | null; recipients: string[]; media: string[]; mediaCount: number;
};

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(to).getTime() - now);
  const d = Math.floor(ms / 86400000);
  const y = Math.floor(d / 365);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return (
    <span className="font-mono text-sm font-bold tabular-nums" suppressHydrationWarning>
      {y > 0 ? `${y}y ${d % 365}d` : `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`}
    </span>
  );
}

export function CapsulesView({ capsules, people }: { capsules: Capsule[]; people: PersonLite[] }) {
  const viewer = useViewer();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState<Capsule | null>(null);
  const byId = new Map(people.map((p) => [p.id, p]));
  const sealed = capsules.filter((c) => !c.isOpen);
  const opened = capsules.filter((c) => c.isOpen).reverse();

  async function remove(c: Capsule) {
    if (!confirm(`Remove the capsule “${c.title}”? This can't be undone.`)) return;
    try { await api(`/api/capsules/${c.id}`, { method: "DELETE" }); toast("Capsule removed"); router.refresh(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't remove", "error"); }
  }

  return (
    <Page>
      <PageHeader eyebrow="Digital Time Capsules" title="Letters to the future"
        subtitle="Seal a message, photo or recording today. It stays locked — even from admins — until the day you choose."
        actions={<Button onClick={() => setOpen(true)}><Plus /> Seal a capsule</Button>} />

      <section className="mb-12">
        <h2 className="h-display mb-4 flex items-center gap-2 text-2xl"><Hourglass className="size-5 text-gold" /> Waiting to be opened</h2>
        {sealed.length === 0 ? <div className="card p-8 text-center text-ink-soft">No sealed capsules yet. Write to your grandchildren, your future self, or the next reunion.</div> : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sealed.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="relative overflow-hidden rounded-[1.6rem] border border-line bg-[linear-gradient(160deg,#f4e3bd,#e9d3a0)] p-6 text-[#3b3122] shadow-[0_18px_30px_-18px_rgb(var(--shadow)/.6)] dark:bg-[linear-gradient(160deg,#4a4030,#2f2a20)] dark:text-[#f3e9cf]">
                <div className="absolute -right-6 -top-6 size-24 rounded-full bg-[#b4513c]/80 shadow-inner" aria-hidden />
                <Lock className="absolute right-4 top-4 size-5 text-[#fff3dc]" />
                <p className="text-xs font-extrabold uppercase tracking-wider opacity-70">Opens {new Date(c.unlockAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
                <h3 className="h-display mt-2 pr-10 text-xl">{c.title}</h3>
                <p className="mt-1 text-sm opacity-75">From {c.authorName ?? "a family member"}</p>
                <div className="mt-4 flex items-center gap-2 text-sm"><Hourglass className="size-4" /> <Countdown to={c.unlockAt} /></div>
                {c.audience === "people" && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm opacity-80"><Users className="size-4" /> For {c.recipients.map((r) => byId.get(r) ? shortName(byId.get(r)!) : "").filter(Boolean).join(", ")}</p>
                )}
                {c.mediaCount > 0 && <p className="mt-1 flex items-center gap-1.5 text-sm opacity-80"><Paperclip className="size-4" /> {c.mediaCount} attachment{c.mediaCount === 1 ? "" : "s"} inside</p>}
                <div className="mt-4 flex gap-2">
                  {c.authorId === viewer.accountId && c.message && <Button size="sm" variant="secondary" onClick={() => setReading(c)}>Re-read (only you can)</Button>}
                  {(c.authorId === viewer.accountId || viewer.isAdmin) && <Button size="sm" variant="ghost" onClick={() => remove(c)} aria-label="Remove capsule"><Trash2 /></Button>}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="h-display mb-4 flex items-center gap-2 text-2xl"><MailOpen className="size-5 text-forest" /> Opened capsules</h2>
        {opened.length === 0 ? <div className="card p-8 text-center text-ink-soft">When a capsule&apos;s day arrives, it will open here for the family.</div> : (
          <div className="grid gap-5 sm:grid-cols-2">
            {opened.map((c) => (
              <button key={c.id} onClick={() => setReading(c)} className="card p-6 text-left transition hover:-translate-y-1">
                <p className="text-xs font-extrabold uppercase tracking-wider text-moss">Opened {new Date(c.unlockAt).toLocaleDateString()}</p>
                <h3 className="h-display mt-1 text-xl">{c.title}</h3>
                <p className="mt-2 line-clamp-3 font-display text-ink-soft">{c.message}</p>
                <p className="mt-3 text-sm text-ink-faint">Sealed by {c.authorName ?? "a family member"} on {new Date(c.createdAt).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!reading} onOpenChange={(o) => !o && setReading(null)} title={reading?.title ?? ""} description={reading ? `From ${reading.authorName ?? "a family member"} · sealed ${new Date(reading.createdAt).toLocaleDateString()}` : undefined} wide>
        {reading && (
          <div className="space-y-5">
            <div className="rounded-3xl bg-[linear-gradient(160deg,#fbf3df,#f2e5c4)] p-6 font-display text-lg leading-relaxed text-[#3b3122] dark:bg-[linear-gradient(160deg,#3d3628,#2c271d)] dark:text-[#f3e9cf]">
              {reading.message?.split(/\n{2,}/).map((p, i) => <p key={i} className="mb-4 whitespace-pre-line last:mb-0">{p}</p>)}
            </div>
            {reading.media.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {reading.media.map((id) => (
                  <a key={id} href={mediaUrl(id)} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(id, { thumb: 400 })} alt="Attachment" className="aspect-square w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createElement("div"), { className: "grid aspect-square place-items-center text-sm font-bold", textContent: "Open attachment" })); }} />
                  </a>
                ))}
              </div>
            )}
            {reading.audience === "people" && (
              <div className="flex flex-wrap gap-2">
                {reading.recipients.map((r) => byId.get(r) && <span key={r} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-sm font-bold"><Portrait person={byId.get(r)!} size={26} thumb={64} frame="round" className="!shadow-none" />{shortName(byId.get(r)!)}</span>)}
              </div>
            )}
          </div>
        )}
      </Dialog>

      <NewCapsule open={open} onOpenChange={setOpen} people={people} onSealed={() => router.refresh()} />
    </Page>
  );
}

function NewCapsule({ open, onOpenChange, people, onSealed }: { open: boolean; onOpenChange: (o: boolean) => void; people: PersonLite[]; onSealed: () => void }) {
  const viewer = useViewer();
  const toast = useToast();
  const [f, setF] = useState({ title: "", message: "", date: "", audience: "family" });
  const [recipients, setRecipients] = useState<string[]>([]);
  const [media, setMedia] = useState<{ id: string; name: string }[]>([]);
  const [uploading, setUploading] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const preset = (years: number) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + years);
    setF((x) => ({ ...x, date: d.toISOString().slice(0, 10) }));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Seal a time capsule" description="Nobody — not even the admin — can read it before the opening day." wide>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const unlockAt = new Date(`${f.date}T08:00:00`).toISOString();
          await api("/api/capsules", { body: { title: f.title, message: f.message, unlockAt, audience: f.audience, recipients, media: media.map((m) => m.id) } });
          toast("Sealed with love. See you in the future ⏳");
          setF({ title: "", message: "", date: "", audience: "family" });
          setRecipients([]);
          setMedia([]);
          onOpenChange(false);
          onSealed();
        } catch (err) { toast(err instanceof ApiError ? err.message : "Couldn't seal the capsule", "error"); }
        finally { setBusy(false); }
      }}>
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required placeholder="e.g. For my granddaughter on her 18th birthday" /></Field>
        <Field label="Your message"><Textarea value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} required className="min-h-48 font-display text-lg" placeholder="Dear future family…" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opening day" hint={<span className="flex flex-wrap gap-2">{[1, 5, 10, 25].map((y) => <button key={y} type="button" onClick={() => preset(y)} className="font-bold text-forest hover:underline">In {y} year{y > 1 ? "s" : ""}</button>)}</span>}>
            <Input type="date" value={f.date} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, date: e.target.value })} required />
          </Field>
          <Field label="Who can open it?">
            <Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
              <option value="family">The whole family</option>
              <option value="people">Only certain people</option>
            </Select>
          </Field>
        </div>
        {f.audience === "people" && <PeoplePicker people={people} value={recipients} onChange={setRecipients} label="Who may open it?" />}
        {viewer.driveConnected && (
          <div className="space-y-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-line px-4 py-2.5 font-bold text-ink-soft hover:bg-surface-2">
              <Paperclip className="size-4" /> {uploading !== null ? `Uploading ${Math.round(uploading * 100)}%` : "Tuck in a photo, video or recording"}
              <input type="file" multiple accept="image/*,video/*,audio/*,application/pdf" className="hidden" disabled={uploading !== null} onChange={async (e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = "";
                for (const file of files) {
                  setUploading(0);
                  try { const r = await uploadFile(file, { purpose: "capsule", onProgress: (p) => setUploading(p) }); setMedia((m) => [...m, { id: r.mediaId, name: file.name }]); }
                  catch (err) { toast(err instanceof ApiError ? err.message : "Upload failed", "error"); }
                  finally { setUploading(null); }
                }
              }} />
            </label>
            {media.length > 0 && <p className="text-sm text-ink-soft">Inside: {media.map((m) => m.name).join(", ")}</p>}
          </div>
        )}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" loading={busy} disabled={uploading !== null}><Lock /> Seal capsule</Button></div>
      </form>
    </Dialog>
  );
}
