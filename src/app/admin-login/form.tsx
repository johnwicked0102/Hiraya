"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { api, ApiError } from "@/lib/client";

export function AdminLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "", totp: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/admin-login", { body: f });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach Hiraya.");
      setF((x) => ({ ...x, totp: "" }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card relative z-10 w-full max-w-md space-y-5 p-8">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-forest/15 text-forest"><ShieldCheck /></span>
        <div>
          <h1 className="h-display text-2xl">Administrator sign-in</h1>
          <p className="text-sm text-ink-soft">Password and authenticator app required.</p>
        </div>
      </div>
      <Field label="Email"><Input type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoFocus /></Field>
      <Field label="Password"><Input type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
      <Field label="Authenticator code"><Input inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={f.totp} onChange={(e) => setF({ ...f, totp: e.target.value })} required placeholder="123 456" /></Field>
      {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in securely</Button>
      <p className="text-center text-sm"><Link href="/login" className="text-ink-faint hover:text-ink">Back to the family gate</Link></p>
    </form>
  );
}
