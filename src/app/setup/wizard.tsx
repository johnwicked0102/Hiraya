"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { BrandLogo } from "@/components/shell/logo";
import { api, ApiError } from "@/lib/client";

export function SetupWizard() {
  const router = useRouter();
  const [f, setF] = useState({ setupToken: "", familyName: "", displayName: "", email: "", password: "" });
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function begin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setQr(await api<{ qr: string; secret: string }>("/api/auth/setup", { body: { step: "begin", ...f } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Setup failed.");
    } finally {
      setBusy(false);
    }
  }
  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/setup", { body: { step: "confirm", setupToken: f.setupToken, email: f.email, totp } });
      router.replace("/admin?welcome=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Setup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card relative z-10 w-full max-w-lg p-8">
      <div className="mb-6 flex items-center gap-3">
        <BrandLogo className="size-14" />
        <div>
          <h1 className="h-display text-3xl">Plant your family tree</h1>
          <p className="text-ink-soft">Create the first administrator for Hiraya.</p>
        </div>
      </div>
      {!qr ? (
        <form onSubmit={begin} className="space-y-4">
          <Field label="Setup token" hint="The SETUP_TOKEN value from your server configuration."><Input type="password" value={f.setupToken} onChange={(e) => setF({ ...f, setupToken: e.target.value })} required /></Field>
          <Field label="Family name" hint="Shown across the app, e.g. “Dela Cruz”."><Input value={f.familyName} onChange={(e) => setF({ ...f, familyName: e.target.value })} required /></Field>
          <Field label="Your name"><Input value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} required /></Field>
          <Field label="Email"><Input type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
          <Field label="Password" hint="At least 12 characters mixing letters, numbers and symbols."><Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
          {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>Continue</Button>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-4">
          <p className="text-ink-soft">Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…). You&apos;ll need it every time you sign in as administrator.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.qr} alt="Authenticator QR code" className="mx-auto rounded-2xl border border-line bg-white p-2" width={220} height={220} />
          <p className="text-center text-sm text-ink-faint">Can&apos;t scan? Enter this key: <code className="break-all font-mono text-ink">{qr.secret}</code></p>
          <Field label="6-digit code from the app"><Input inputMode="numeric" value={totp} onChange={(e) => setTotp(e.target.value)} required autoFocus /></Field>
          {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>Finish setup</Button>
        </form>
      )}
    </div>
  );
}
