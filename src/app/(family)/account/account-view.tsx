"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Smartphone, CalendarPlus, LogOut, Copy, Sparkles } from "lucide-react";
import { Page, PageHeader } from "@/components/shell/app-shell";
import { PreferencePanel } from "@/components/shell/preferences";
import { Button } from "@/components/ui/button";
import { Badge, Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useViewer } from "@/components/shell/viewer-context";
import { api, ApiError } from "@/lib/client";
import { timeAgo } from "@/lib/utils";

type Sess = { id: string; userAgent: string | null; ip: string | null; createdAt: string; lastSeenAt: string; authLevel: string };

function device(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /iPhone|iPad/.test(ua) ? "iPhone / iPad" : /Android/.test(ua) ? "Android phone" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : "Computer";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

export function AccountView({ account, sessions, currentSessionId }: {
  account: { totpEnabled: boolean; email: string | null; hasCalendar: boolean; loginName: string };
  sessions: Sess[];
  currentSessionId: string;
}) {
  const viewer = useViewer();
  const toast = useToast();
  const router = useRouter();
  const [feed, setFeed] = useState<string | null>(null);
  const [sec, setSec] = useState({ email: account.email ?? "", password: "", code: "" });
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);

  const section = "card p-6";
  return (
    <Page className="max-w-3xl">
      <PageHeader eyebrow="My settings" title={`Hello, ${viewer.displayName.split(" ")[0]}`} subtitle={`You sign in as “${account.loginName}”. Role: ${viewer.role}.`} />
      <div className="space-y-6">
        <section className={section}>
          <h2 className="h-display mb-4 flex items-center gap-2 text-2xl"><Sparkles className="size-5 text-gold" /> Comfort</h2>
          <PreferencePanel />
        </section>

        <section className={section}>
          <h2 className="h-display mb-2 flex items-center gap-2 text-2xl"><CalendarPlus className="size-5 text-forest" /> Birthday reminders</h2>
          <p className="mb-4 text-ink-soft">Get every family birthday, anniversary and remembrance day in your phone&apos;s calendar, with a reminder the evening before.</p>
          {feed ? (
            <div className="flex gap-2"><Input readOnly value={feed} onFocus={(e) => e.target.select()} /><Button variant="secondary" size="icon" aria-label="Copy" onClick={() => { navigator.clipboard.writeText(feed); toast("Link copied"); }}><Copy /></Button></div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={async () => { try { setFeed((await api<{ url: string }>("/api/account/calendar-token", { method: "POST" })).url); } catch (e) { toast(e instanceof ApiError ? e.message : "Failed", "error"); } }}>
                {account.hasCalendar ? "Make a new private link" : "Create my private calendar link"}
              </Button>
              {account.hasCalendar && <Button variant="ghost" onClick={async () => { await api("/api/account/calendar-token", { method: "DELETE" }); toast("Calendar link turned off"); router.refresh(); }}>Turn off</Button>}
            </div>
          )}
        </section>

        <section className={section}>
          <h2 className="h-display mb-2 flex items-center gap-2 text-2xl"><Smartphone className="size-5 text-sky-deep" /> Where you&apos;re signed in</h2>
          <ul className="mb-4 divide-y divide-line">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{device(s.userAgent)} {s.id === currentSessionId && <Badge tone="moss">This device</Badge>} {s.authLevel === "strong" && <Badge tone="gold">Admin</Badge>}</p>
                  <p className="text-sm text-ink-faint">Signed in {timeAgo(s.createdAt)} · active {timeAgo(s.lastSeenAt)}</p>
                </div>
              </li>
            ))}
          </ul>
          {sessions.length > 1 && (
            <Button variant="secondary" onClick={async () => { await api("/api/account/sessions", { body: { action: "sign_out_others" } }); toast("Signed out everywhere else"); router.refresh(); }}>
              <LogOut /> Sign out of other devices
            </Button>
          )}
        </section>

        {viewer.role === "admin" && !account.totpEnabled && (
          <section className={`${section} border-gold`}>
            <h2 className="h-display mb-2 flex items-center gap-2 text-2xl"><ShieldCheck className="size-5 text-gold" /> Activate administrator access</h2>
            <p className="mb-4 text-ink-soft">You&apos;ve been made an administrator. To protect the family, admin tools require a password and an authenticator app. Ask another admin for a fresh 6-digit code to confirm.</p>
            {!qr ? (
              <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault(); setBusy(true);
                try { setQr(await api<{ qr: string; secret: string }>("/api/account/security", { body: { step: "begin", ...sec } })); }
                catch (err) { toast(err instanceof ApiError ? err.message : "Failed", "error"); } finally { setBusy(false); }
              }}>
                <Field label="Email"><Input type="email" value={sec.email} onChange={(e) => setSec({ ...sec, email: e.target.value })} required autoComplete="username" /></Field>
                <Field label="New password" hint="12+ characters mixing letters, numbers and symbols"><Input type="password" value={sec.password} onChange={(e) => setSec({ ...sec, password: e.target.value })} required autoComplete="new-password" /></Field>
                <Field label="Confirmation code from another admin"><Input inputMode="numeric" value={sec.code} onChange={(e) => setSec({ ...sec, code: e.target.value })} required /></Field>
                <Button type="submit" loading={busy}>Continue</Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault(); setBusy(true);
                try { await api("/api/account/security", { body: { step: "confirm", totp } }); toast("Administrator access activated"); router.push("/admin"); router.refresh(); }
                catch (err) { toast(err instanceof ApiError ? err.message : "Failed", "error"); } finally { setBusy(false); }
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr.qr} alt="Authenticator QR code" width={220} height={220} className="rounded-2xl border border-line bg-white p-2" />
                <p className="text-sm text-ink-faint">Key: <code className="break-all font-mono text-ink">{qr.secret}</code></p>
                <Field label="6-digit code from your authenticator"><Input inputMode="numeric" value={totp} onChange={(e) => setTotp(e.target.value)} required /></Field>
                <Button type="submit" loading={busy}>Activate</Button>
              </form>
            )}
          </section>
        )}
      </div>
    </Page>
  );
}
