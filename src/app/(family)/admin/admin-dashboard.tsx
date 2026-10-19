"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Users, KeyRound, Inbox, HardDrive, ScrollText, Archive, Settings2, UserPlus, Copy, Share2, ShieldCheck, Ban, RotateCcw, Trash2,
  CheckCircle2, XCircle, ExternalLink, Download, Upload, CloudUpload, Pencil, LogOut, CircleAlert,
} from "lucide-react";
import { Page, PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Badge, Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Portrait } from "@/components/portrait";
import { uploadFile } from "@/lib/uploader";
import { api, ApiError } from "@/lib/client";
import { bytes, cn, fullName, mediaUrl, timeAgo } from "@/lib/utils";
import type { PersonLite } from "@/lib/types";

type Account = {
  id: string; displayName: string; loginName: string; role: "admin" | "editor" | "viewer"; status: "active" | "suspended";
  personId: string | null; email: string | null; totpEnabled: boolean; hasQuestion: boolean; verifyQuestion: string | null;
  lastLoginAt: string | null; createdAt: string; sessions: number; devices: number; codeExpiresAt: string | null;
};
type Req = { id: string; fullName: string; relationship: string | null; contact: string | null; message: string | null; status: string; createdAt: string };
type Settings = { familyName: string; familyMotto: string; logoMediaId: string | null; featuredMediaId: string | null; viewersCanContribute: boolean; membersCanDownload: boolean; rootPersonId: string | null };

const TABS = [
  { id: "members", label: "Members", icon: Users },
  { id: "requests", label: "Requests", icon: Inbox },
  { id: "drive", label: "Google Drive", icon: HardDrive },
  { id: "activity", label: "Activity", icon: ScrollText },
  { id: "backup", label: "Backup & export", icon: Archive },
  { id: "settings", label: "Family settings", icon: Settings2 },
];

const ROLE_INFO: Record<string, string> = {
  viewer: "Can explore, and (if allowed) share memories and stories",
  editor: "Can also edit the tree, profiles and relationships",
  admin: "Full control — requires password + authenticator",
};

export function AdminDashboard(props: {
  me: string; accounts: Account[]; people: PersonLite[]; settings: Settings; requests: Req[]; recentImages: string[];
  initialTab: string; driveNotice: string | null; welcome: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState(props.initialTab);
  const pending = props.requests.filter((r) => r.status === "pending").length;

  useEffect(() => {
    const msgs: Record<string, [string, "ok" | "error"]> = {
      connected: ["Google Drive connected — the family archive folder is ready.", "ok"],
      cancelled: ["Google Drive connection was cancelled.", "error"],
      invalid: ["That Google sign-in link expired. Please try again.", "error"],
      failed: ["Couldn't connect Google Drive. Check the server's Google settings.", "error"],
    };
    if (props.driveNotice && msgs[props.driveNotice]) toast(...msgs[props.driveNotice]!);
    if (props.welcome) toast("Welcome! Hiraya is ready. Next: connect Google Drive and register your family.");
  }, [props.driveNotice, props.welcome, toast]);

  return (
    <Page>
      <PageHeader eyebrow="Administrator" title="Family gatekeeper" subtitle="Invite relatives, send sign-in codes, look after the archive and keep everything safe." />
      <div className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn("flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 font-bold transition", tab === t.id ? "bg-forest text-[#fffaf0] dark:text-[#14211a]" : "bg-surface-2 text-ink-soft hover:text-ink")}>
            <t.icon className="size-4" /> {t.label}
            {t.id === "requests" && pending > 0 && <span className="rounded-full bg-gold px-2 text-xs text-[#2c2310]">{pending}</span>}
          </button>
        ))}
      </div>
      {tab === "members" && <Members {...props} onChanged={() => router.refresh()} />}
      {tab === "requests" && <Requests requests={props.requests} people={props.people} onChanged={() => router.refresh()} />}
      {tab === "drive" && <DriveTab />}
      {tab === "activity" && <Activity />}
      {tab === "backup" && <Backup onChanged={() => router.refresh()} />}
      {tab === "settings" && <SettingsTab settings={props.settings} people={props.people} recentImages={props.recentImages} onChanged={() => router.refresh()} />}
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Members & codes
// ---------------------------------------------------------------------------
function Members({ me, accounts, people, onChanged, requests }: { me: string; accounts: Account[]; people: PersonLite[]; onChanged: () => void; requests: Req[] }) {
  const toast = useToast();
  const [form, setForm] = useState<{ open: boolean; account?: Account | null; request?: Req | null }>({ open: false });
  const [code, setCode] = useState<{ account: Account; code: string; expiresAt: string; skew: number } | null>(null);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  void requests;

  async function genCode(a: Account) {
    try {
      const r = await api<{ code: string; expiresAt: string; serverNow: string }>(`/api/admin/accounts/${a.id}/code`, { method: "POST" });
      setCode({ account: a, code: r.code, expiresAt: r.expiresAt, skew: Date.now() - new Date(r.serverNow).getTime() });
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't create a code", "error");
    }
  }
  async function patch(a: Account, body: Record<string, unknown>, msg: string) {
    try { await api(`/api/admin/accounts/${a.id}`, { method: "PATCH", body }); toast(msg); onChanged(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Failed", "error"); }
  }
  async function revoke(a: Account) {
    const forget = confirm(`Sign ${a.displayName} out of every device?\n\nOK = also forget their devices (they must answer their security question again).\nCancel = keep it as is.`);
    try { await api(`/api/admin/accounts/${a.id}/revoke`, { body: { forgetDevices: forget } }); toast(`${a.displayName} has been signed out everywhere`); onChanged(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Failed", "error"); }
  }
  async function remove(a: Account) {
    if (!confirm(`Remove ${a.displayName}'s access entirely? Their family profile and memories stay.`)) return;
    try { await api(`/api/admin/accounts/${a.id}`, { method: "DELETE" }); toast("Access removed"); onChanged(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Failed", "error"); }
  }

  const noQuestion = accounts.filter((a) => a.role !== "admin" && !a.hasQuestion).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">{accounts.length} registered · {accounts.filter((a) => a.sessions > 0).length} signed in on at least one device</p>
        <Button onClick={() => setForm({ open: true, account: null })}><UserPlus /> Register a family member</Button>
      </div>
      {noQuestion > 0 && (
        <div className="flex items-start gap-3 rounded-3xl bg-sun/25 p-4 text-sm">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-gold" />
          <p>{noQuestion} member{noQuestion > 1 ? "s have" : " has"} no new-device security question. A code alone will let anyone holding it in on a new phone — add a question you agree on with them in person.</p>
        </div>
      )}
      <div className="card divide-y divide-line overflow-hidden">
        {accounts.map((a) => {
          const p = a.personId ? byId.get(a.personId) : undefined;
          return (
            <div key={a.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", a.status === "suspended" && "opacity-60")}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {p ? <Portrait person={p} size={48} thumb={128} frame="round" /> : <span className="grid size-12 place-items-center rounded-full bg-surface-2 font-display text-lg font-bold">{a.displayName[0]}</span>}
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-bold">
                    {a.displayName}
                    <Badge tone={a.role === "admin" ? "gold" : a.role === "editor" ? "sky" : "moss"}>{a.role}</Badge>
                    {a.status === "suspended" && <Badge tone="rose">suspended</Badge>}
                    {a.role === "admin" && !a.totpEnabled && <Badge tone="rose">needs authenticator</Badge>}
                    {a.role !== "admin" && !a.hasQuestion && <Badge tone="ink">no security question</Badge>}
                    {a.id === me && <Badge tone="ink">you</Badge>}
                  </p>
                  <p className="truncate text-sm text-ink-faint">
                    Signs in as “{a.loginName}” · {a.lastLoginAt ? `last visit ${timeAgo(a.lastLoginAt)}` : "never signed in"} · {a.sessions} active session{a.sessions === 1 ? "" : "s"}
                    {!p && " · not linked to a tree profile"}
                  </p>
                  {a.codeExpiresAt && <p className="text-sm font-bold text-forest">A code is waiting to be used</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {a.status === "active" && <Button size="sm" variant="gold" onClick={() => genCode(a)}><KeyRound /> Send code</Button>}
                <Button size="sm" variant="secondary" onClick={() => setForm({ open: true, account: a })} aria-label="Edit"><Pencil /></Button>
                {a.sessions > 0 && <Button size="sm" variant="secondary" onClick={() => revoke(a)} title="Sign out everywhere" aria-label="Sign out everywhere"><LogOut /></Button>}
                {a.id !== me && (a.status === "active"
                  ? <Button size="sm" variant="ghost" onClick={() => patch(a, { status: "suspended" }, `${a.displayName}'s access is paused`)} title="Suspend" aria-label="Suspend"><Ban /></Button>
                  : <Button size="sm" variant="ghost" onClick={() => patch(a, { status: "active" }, `${a.displayName} can sign in again`)} title="Reactivate" aria-label="Reactivate"><RotateCcw /></Button>)}
                {a.id !== me && <Button size="sm" variant="ghost" className="text-danger" onClick={() => remove(a)} aria-label="Remove access"><Trash2 /></Button>}
              </div>
            </div>
          );
        })}
      </div>
      <AccountForm open={form.open} onOpenChange={(o) => setForm((f) => ({ ...f, open: o }))} account={form.account} request={form.request} people={people} accounts={accounts} onSaved={onChanged} />
      {code && <CodeDialog data={code} onClose={() => { setCode(null); onChanged(); }} />}
    </div>
  );
}

function CodeDialog({ data, onClose }: { data: { account: Account; code: string; expiresAt: string; skew: number }; onClose: () => void }) {
  const toast = useToast();
  const [left, setLeft] = useState(180);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.round((new Date(data.expiresAt).getTime() - (Date.now() - data.skew)) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [data]);
  const url = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
  const message = `Hi ${data.account.displayName.split(" ")[0]}! 🌿 Your Hiraya family code is ${data.code}.\nOpen ${url}, type your name “${data.account.loginName}” and this code within 3 minutes. It works only once — please don't share it.`;
  const pct = left / 180;
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: message }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(message);
      toast("Message copied — paste it into Messenger or Viber");
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Code for ${data.account.displayName}`} description="Send it privately. It expires in 3 minutes and works only once.">
      <div className="space-y-5 text-center">
        <div className="relative mx-auto grid size-52 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--line)" strokeWidth="6" />
            <circle cx="50" cy="50" r="45" fill="none" stroke={left > 30 ? "var(--forest)" : "var(--danger)"} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 45} strokeDashoffset={2 * Math.PI * 45 * (1 - pct)} style={{ transition: "stroke-dashoffset .25s linear" }} />
          </svg>
          <div>
            <p className={cn("font-display text-5xl font-semibold tracking-[0.12em] tabular-nums", left === 0 && "text-ink-faint line-through")}>{data.code.slice(0, 3)} {data.code.slice(3)}</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-ink-soft">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</p>
          </div>
        </div>
        {left === 0 ? (
          <p className="rounded-2xl bg-danger/10 p-3 font-bold text-danger">This code has expired. Generate a new one when they&apos;re ready.</p>
        ) : (
          <>
            <p className="text-sm text-ink-soft">They sign in with the name <b className="text-ink">“{data.account.loginName}”</b>.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(data.code); toast("Code copied"); }}><Copy /> Copy code</Button>
              <Button onClick={share}><Share2 /> Share message</Button>
              <Button variant="secondary" asChild><a href={`viber://forward?text=${encodeURIComponent(message)}`}>Viber</a></Button>
              <Button variant="secondary" asChild><a href={`sms:?&body=${encodeURIComponent(message)}`}>Text message</a></Button>
            </div>
          </>
        )}
        <Button variant="ghost" onClick={onClose}>Done</Button>
      </div>
    </Dialog>
  );
}

function AccountForm({ open, onOpenChange, account, request, people, accounts, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; account?: Account | null; request?: Req | null; people: PersonLite[]; accounts: Account[]; onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({ displayName: "", loginName: "", role: "viewer", personId: "", verifyQuestion: "", verifyAnswer: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (account) setF({ displayName: account.displayName, loginName: account.loginName, role: account.role, personId: account.personId ?? "", verifyQuestion: account.verifyQuestion ?? "", verifyAnswer: "" });
    else setF({ displayName: request?.fullName ?? "", loginName: request?.fullName ?? "", role: "viewer", personId: "", verifyQuestion: "", verifyAnswer: "" });
  }, [open, account, request]);
  const linked = new Set(accounts.filter((a) => a.personId && a.id !== account?.id).map((a) => a.personId));
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={account ? `Edit ${account.displayName}` : "Register a family member"} description={account ? undefined : "They'll sign in with this name plus a code you send them."}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const body: Record<string, unknown> = { displayName: f.displayName, loginName: f.loginName, role: f.role, personId: f.personId || null };
        if (!account || f.verifyAnswer || !f.verifyQuestion) { body.verifyQuestion = f.verifyQuestion || null; body.verifyAnswer = f.verifyAnswer || null; }
        if (account && f.verifyQuestion && !f.verifyAnswer && account.hasQuestion) { delete body.verifyQuestion; delete body.verifyAnswer; }
        try {
          if (account) await api(`/api/admin/accounts/${account.id}`, { method: "PATCH", body });
          else await api("/api/admin/accounts", { body: { ...body, requestId: request?.id ?? null } });
          toast(account ? "Saved" : `${f.displayName} is registered. Send them a code when they're ready.`);
          onOpenChange(false);
          onSaved();
        } catch (err) { toast(err instanceof ApiError ? err.message : "Couldn't save", "error"); }
        finally { setBusy(false); }
      }}>
        <Field label="Name shown in Hiraya"><Input value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} required /></Field>
        <Field label="Sign-in name" hint="What they'll type at the gate — e.g. “Lola Remedios”. Not case-sensitive."><Input value={f.loginName} onChange={(e) => setF({ ...f, loginName: e.target.value })} required /></Field>
        <Field label="Role" hint={ROLE_INFO[f.role]}>
          <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Administrator</option>
          </Select>
        </Field>
        <Field label="Their profile in the tree" hint="Lets them edit their own profile and see their private details">
          <Select value={f.personId} onChange={(e) => setF({ ...f, personId: e.target.value })}>
            <option value="">Not linked</option>
            {[...people].sort((a, b) => fullName(a).localeCompare(fullName(b))).map((p) => <option key={p.id} value={p.id} disabled={linked.has(p.id)}>{fullName(p)}{linked.has(p.id) ? " (already linked)" : ""}</option>)}
          </Select>
        </Field>
        <div className="space-y-3 rounded-3xl border border-line bg-surface-2/50 p-4">
          <p className="flex items-center gap-2 font-bold"><ShieldCheck className="size-4 text-forest" /> New-device security question</p>
          <p className="text-sm text-ink-soft">Asked the first time they sign in on a new phone or computer. Agree on it together in person or by phone — something only they would know.</p>
          <Field label="Question"><Input value={f.verifyQuestion} onChange={(e) => setF({ ...f, verifyQuestion: e.target.value })} placeholder="e.g. What was the name of our first dog?" /></Field>
          <Field label={account?.hasQuestion ? "New answer (leave blank to keep the current one)" : "Answer"} hint="Not case-sensitive; punctuation ignored. Stored scrambled — even admins can't read it back.">
            <Input value={f.verifyAnswer} onChange={(e) => setF({ ...f, verifyAnswer: e.target.value })} autoComplete="off" />
          </Field>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" loading={busy}>{account ? "Save" : "Register"}</Button></div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Access requests
// ---------------------------------------------------------------------------
function Requests({ requests, people, onChanged }: { requests: Req[]; people: PersonLite[]; onChanged: () => void }) {
  const toast = useToast();
  const [reg, setReg] = useState<Req | null>(null);
  const set = async (r: Req, status: string) => {
    try { await api(`/api/admin/requests/${r.id}`, { method: "PATCH", body: { status } }); onChanged(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Failed", "error"); }
  };
  if (!requests.length) return <div className="card p-10 text-center text-ink-soft">No one has knocked on the gate yet.</div>;
  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <div key={r.id} className={cn("card flex flex-col gap-3 p-5 sm:flex-row sm:items-start", r.status !== "pending" && "opacity-70")}>
          <div className="flex-1">
            <p className="flex items-center gap-2 text-lg font-bold">{r.fullName} <Badge tone={r.status === "pending" ? "gold" : r.status === "approved" ? "moss" : "rose"}>{r.status}</Badge></p>
            {r.relationship && <p className="text-ink-soft">{r.relationship}</p>}
            {r.contact && <p className="text-sm text-ink-faint">Contact: {r.contact}</p>}
            {r.message && <p className="mt-2 whitespace-pre-line rounded-2xl bg-surface-2 p-3 text-sm">{r.message}</p>}
            <p className="mt-1 text-xs text-ink-faint">{timeAgo(r.createdAt)}</p>
          </div>
          {r.status === "pending" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setReg(r)}><CheckCircle2 /> Approve & register</Button>
              <Button size="sm" variant="ghost" onClick={() => set(r, "declined")}><XCircle /> Decline</Button>
            </div>
          )}
        </div>
      ))}
      <AccountForm open={!!reg} onOpenChange={(o) => !o && setReg(null)} request={reg} people={people} accounts={[]} onSaved={onChanged} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Google Drive
// ---------------------------------------------------------------------------
type DriveStatus = { connected: boolean; status?: string; email?: string | null; folderUrl?: string | null; quota?: { limit?: string; usage?: string } | null; files: number; archiveBytes: string; configured?: boolean };

function DriveTab() {
  const toast = useToast();
  const [s, setS] = useState<DriveStatus | null>(null);
  const load = useCallback(() => api<DriveStatus>("/api/drive/status").then(setS).catch(() => setS({ connected: false, files: 0, archiveBytes: "0" })), []);
  useEffect(() => { load(); }, [load]);
  if (!s) return <div className="card skeleton h-48" />;
  const used = Number(s.quota?.usage ?? 0);
  const limit = Number(s.quota?.limit ?? 0);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <h2 className="h-display mb-2 text-2xl">Family archive</h2>
        {s.connected ? (
          <div className="space-y-4">
            <p className="flex items-center gap-2 font-bold">
              {s.status === "ok" ? <CheckCircle2 className="size-5 text-forest" /> : <CircleAlert className="size-5 text-danger" />}
              {s.status === "ok" ? "Connected" : "Needs reconnecting"} {s.email && <span className="font-normal text-ink-soft">as {s.email}</span>}
            </p>
            <p className="text-ink-soft">Hiraya can only see the files it creates in its own folder — never the rest of this Google Drive. Family members never need this Google account.</p>
            <div className="flex flex-wrap gap-2">
              {s.folderUrl && <Button variant="secondary" asChild><a href={s.folderUrl} target="_blank" rel="noreferrer"><ExternalLink /> Open archive folder</a></Button>}
              <Button variant="secondary" asChild><a href="/api/drive/connect"><RotateCcw /> Reconnect</a></Button>
              <Button variant="ghost" className="text-danger" onClick={async () => {
                if (!confirm("Disconnect Google Drive? Files stay safely in Drive, but photos won't load in Hiraya until you reconnect the same account.")) return;
                await api("/api/drive/disconnect", { method: "POST" }); toast("Disconnected"); load();
              }}>Disconnect</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-ink-soft">Connect the Google account that will hold the family&apos;s photos and videos. Hiraya creates a <b>Hiraya Family Archive</b> folder and keeps every original there, privately.</p>
            {s.configured === false && <p className="rounded-2xl bg-danger/10 p-3 text-sm font-semibold text-danger">GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET aren&apos;t set on the server yet — see the deployment guide.</p>}
            <Button size="lg" asChild><a href="/api/drive/connect"><HardDrive /> Connect Google Drive</a></Button>
          </div>
        )}
      </div>
      <div className="card p-6">
        <h2 className="h-display mb-4 text-2xl">Storage</h2>
        <p className="text-4xl font-display">{bytes(s.archiveBytes)}</p>
        <p className="text-ink-soft">in {s.files} family files</p>
        {limit > 0 && (
          <div className="mt-6">
            <div className="h-3 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-forest" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} /></div>
            <p className="mt-2 text-sm text-ink-soft">Google account: {bytes(used)} of {bytes(limit)} used</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------
type Log = { id: string; action: string; entityType: string | null; entityId: string | null; summary: string | null; details: Record<string, { from: unknown; to: unknown }> | null; ip: string | null; createdAt: string; actor: string | null };

function Activity() {
  const [items, setItems] = useState<Log[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async (offset: number, f: string) => {
    const r = await api<{ items: Log[]; hasMore: boolean }>(`/api/admin/activity?offset=${offset}${f ? `&action=${f}` : ""}`);
    setItems((x) => (offset ? [...x, ...r.items] : r.items));
    setHasMore(r.hasMore);
  }, []);
  useEffect(() => { load(0, filter); }, [load, filter]);
  return (
    <div className="space-y-4">
      <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-auto">
        <option value="">All activity</option><option value="auth">Sign-ins & codes</option><option value="person">Family tree</option>
        <option value="relationship">Relationships</option><option value="media">Memories</option><option value="account">Accounts</option>
        <option value="story">Stories</option><option value="archive">Backups</option><option value="drive">Google Drive</option>
      </Select>
      <div className="card divide-y divide-line">
        {items.length === 0 && <p className="p-6 text-ink-soft">Nothing yet.</p>}
        {items.map((l) => (
          <div key={l.id} className="p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 break-words">
              <span className="font-bold">{l.actor ?? "System"}</span>
              <span className="flex-1 text-ink-soft">{l.summary ?? l.action}</span>
              <span className="text-xs text-ink-faint" title={new Date(l.createdAt).toLocaleString()}>{timeAgo(l.createdAt)}{l.ip ? ` · ${l.ip}` : ""}</span>
            </div>
            {l.details && Object.keys(l.details).length > 0 && (
              <>
                <button className="mt-1 text-sm font-bold text-forest" onClick={() => setOpen(open === l.id ? null : l.id)}>{open === l.id ? "Hide changes" : "Review changes"}</button>
                {open === l.id && (
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      {Object.entries(l.details).map(([k, v]) => (
                        <tr key={k} className="border-t border-line align-top">
                          <td className="whitespace-nowrap py-1.5 pr-3 font-bold text-ink-soft">{k}</td>
                          {/* Raw JSON values (ids, URLs) have no spaces; let them break so the table fits a phone. */}
                          <td className="py-1.5 pr-3 text-danger line-through wrap-anywhere">{typeof v === "object" && v && "from" in v ? String(JSON.stringify(v.from) ?? "") : ""}</td>
                          <td className="py-1.5 text-forest wrap-anywhere">{typeof v === "object" && v && "to" in v ? String(JSON.stringify(v.to) ?? "") : JSON.stringify(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {hasMore && <Button variant="secondary" onClick={() => load(items.length, filter)}>Load more</Button>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backup & export
// ---------------------------------------------------------------------------
function Backup({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-4 p-6">
        <h2 className="h-display text-2xl">Download</h2>
        <p className="text-ink-soft">Keep copies somewhere safe — a USB drive, another cloud. These files let the family move Hiraya to a new server or another genealogy app at any time.</p>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" asChild className="justify-start"><a href="/api/admin/export?format=json"><Download /> Complete archive (.json)</a></Button>
          <Button variant="secondary" asChild className="justify-start"><a href="/api/admin/export?format=gedcom"><Download /> Family tree for other apps (.ged / GEDCOM)</a></Button>
          <Button variant="secondary" asChild className="justify-start"><a href="/api/admin/export?format=media-csv"><Download /> List of every photo & video file (.csv)</a></Button>
        </div>
        <p className="text-sm text-ink-faint">For a full offline copy including every original photo and video, run <code>npm run backup</code> on any computer (see the README).</p>
      </div>
      <div className="card space-y-4 p-6">
        <h2 className="h-display text-2xl">Back up to Google Drive</h2>
        <p className="text-ink-soft">Saves a dated archive and GEDCOM file into the <b>Backups</b> folder of the family archive.</p>
        <Button loading={busy === "drive"} onClick={async () => {
          setBusy("drive");
          try { const r = await api<{ files: string[] }>("/api/admin/backup", { method: "POST" }); toast(`Saved ${r.files.join(" and ")}`); }
          catch (e) { toast(e instanceof ApiError ? e.message : "Backup failed", "error"); }
          finally { setBusy(null); }
        }}><CloudUpload /> Back up now</Button>
        <div className="border-t border-line pt-4">
          <h3 className="font-bold">Restore from an archive</h3>
          <p className="mb-3 text-sm text-ink-soft">Adds anything from the archive that isn&apos;t already here. Nothing existing is overwritten. Member accounts aren&apos;t imported — re-register people after a move.</p>
          <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-line px-4 py-2.5 font-bold text-ink-soft hover:bg-surface-2", busy === "import" && "opacity-60")}>
            <Upload className="size-4" /> {busy === "import" ? "Importing…" : "Choose archive file"}
            <input type="file" accept="application/json,.json" className="hidden" disabled={busy !== null} onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file || !confirm(`Import “${file.name}” into this family archive?`)) return;
              setBusy("import");
              try {
                const res = await fetch("/api/admin/import", { method: "POST", body: await file.text(), headers: { "Content-Type": "application/json" } });
                const j = await res.json();
                if (!res.ok) throw new Error(j.error);
                const total = Object.values(j.counts as Record<string, number>).reduce((a, b) => a + b, 0);
                toast(`Imported ${total} records`);
                onChanged();
              } catch (err) { toast((err as Error).message || "Import failed", "error"); }
              finally { setBusy(null); }
            }} />
          </label>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Family settings
// ---------------------------------------------------------------------------
function SettingsTab({ settings, people, recentImages, onChanged }: { settings: Settings; people: PersonLite[]; recentImages: string[]; onChanged: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const save = async (patch: Partial<Settings>) => {
    setBusy(true);
    try { await api("/api/admin/settings", { method: "PATCH", body: patch }); toast("Saved"); onChanged(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't save", "error"); }
    finally { setBusy(false); }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form className="card space-y-4 p-6" onSubmit={(e) => { e.preventDefault(); save({ familyName: f.familyName, familyMotto: f.familyMotto, rootPersonId: f.rootPersonId }); }}>
        <h2 className="h-display text-2xl">Family identity</h2>
        <Field label="Family name"><Input value={f.familyName} onChange={(e) => setF({ ...f, familyName: e.target.value })} required /></Field>
        <Field label="Family motto"><Input value={f.familyMotto} onChange={(e) => setF({ ...f, familyMotto: e.target.value })} /></Field>
        <Field label="Start the tree from" hint="Who the tree centers on for members not linked to a profile">
          <Select value={f.rootPersonId ?? ""} onChange={(e) => setF({ ...f, rootPersonId: e.target.value || null })}>
            <option value="">Automatic</option>
            {[...people].sort((a, b) => fullName(a).localeCompare(fullName(b))).map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
          </Select>
        </Field>
        <Button type="submit" loading={busy}>Save</Button>
      </form>
      <div className="card space-y-5 p-6">
        <h2 className="h-display text-2xl">Look & permissions</h2>
        <div className="flex items-center gap-4">
          {f.logoMediaId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(f.logoMediaId, { thumb: 160 })} alt="Family logo" className="size-16 rounded-full border-2 border-gold object-cover" />
          ) : <span className="grid size-16 place-items-center rounded-full bg-surface-2 text-sm text-ink-faint">Logo</span>}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-line px-4 py-2 font-bold text-ink-soft hover:bg-surface-2">
            <Upload className="size-4" /> {logoBusy ? "Uploading…" : "Upload family logo"}
            <input type="file" accept="image/*" className="hidden" disabled={logoBusy} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setLogoBusy(true);
              try { const r = await uploadFile(file, { purpose: "logo" }); setF({ ...f, logoMediaId: r.mediaId }); await save({ logoMediaId: r.mediaId }); }
              catch (err) { toast(err instanceof ApiError ? err.message : "Upload failed", "error"); }
              finally { setLogoBusy(false); }
            }} />
          </label>
          {f.logoMediaId && <Button variant="ghost" size="sm" onClick={() => { setF({ ...f, logoMediaId: null }); save({ logoMediaId: null }); }}>Use Hiraya emblem</Button>}
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-ink-soft">Featured photograph on the home page</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {recentImages.slice(0, 15).map((id) => (
              <button key={id} type="button" onClick={() => { setF({ ...f, featuredMediaId: id }); save({ featuredMediaId: id }); }}
                className={cn("overflow-hidden rounded-xl ring-gold", f.featuredMediaId === id && "ring-4")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(id, { thumb: 160 })} alt="" className="aspect-square w-full object-cover" loading="lazy" />
              </button>
            ))}
            {!recentImages.length && <p className="col-span-3 text-sm text-ink-faint sm:col-span-5">Share photos in the Memory Garden first.</p>}
          </div>
          {f.featuredMediaId && <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setF({ ...f, featuredMediaId: null }); save({ featuredMediaId: null }); }}>Use the latest photo automatically</Button>}
        </div>
        <div className="space-y-2 border-t border-line pt-4">
          <Checkbox label="Viewers may share memories, stories and events" checked={f.viewersCanContribute} onChange={(e) => { setF({ ...f, viewersCanContribute: e.target.checked }); save({ viewersCanContribute: e.target.checked }); }} />
          <Checkbox label="Everyone may download original photos and videos" checked={f.membersCanDownload} onChange={(e) => { setF({ ...f, membersCanDownload: e.target.checked }); save({ membersCanDownload: e.target.checked }); }} />
        </div>
      </div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-ink-faint lg:col-span-2">
        Tip: invite at least one more trusted relative as an administrator, so the family is never locked out.
      </motion.p>
    </div>
  );
}
