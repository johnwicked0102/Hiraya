"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { KeyRound, ShieldCheck, DoorOpen, Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { LogoMark } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/preferences";
import { api, ApiError } from "@/lib/client";

type Step = "code" | "verify" | "request" | "requested" | "welcome";

function CodeBoxes({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");
  const setAt = (i: number, d: string) => {
    const arr = value.padEnd(6, " ").split("");
    arr[i] = d;
    onChange(arr.join("").replace(/\s+$/g, "").replace(/ /g, ""));
  };
  return (
    <div className="flex justify-between gap-2" role="group" aria-label="6-digit access code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          disabled={disabled}
          value={d.trim()}
          maxLength={6}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (v.length > 1) {
              onChange(v.slice(0, 6));
              refs.current[Math.min(v.length, 5)]?.focus();
              return;
            }
            setAt(i, v);
            if (v && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d.trim() && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          className="h-16 w-full min-w-0 rounded-2xl border-2 border-line bg-surface text-center font-display text-3xl font-semibold text-ink shadow-inner transition focus:border-gold focus:outline-none focus:ring-4 focus:ring-[var(--ring)]"
        />
      ))}
    </div>
  );
}

export function LoginGate({ familyName, expired }: { familyName: string; expired: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("code");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [challenge, setChallenge] = useState("");
  const [error, setError] = useState<string | null>(expired ? "Your visit timed out. Please come in again." : null);
  const [busy, setBusy] = useState(false);
  const [req, setReq] = useState({ fullName: "", relationship: "", contact: "", message: "", website: "" });

  const welcome = () => {
    setStep("welcome");
    setTimeout(() => {
      router.replace("/home");
      router.refresh();
    }, 1300);
  };

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) return setError("Please enter all 6 digits of your code.");
    setBusy(true);
    try {
      const r = await api<{ step: "done" | "verify"; challenge?: string; question?: string }>("/api/auth/login", {
        body: { name, code },
      });
      if (r.step === "verify") {
        setChallenge(r.challenge!);
        setQuestion(r.question ?? "Your family security question");
        setStep("verify");
      } else welcome();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach Hiraya. Check your internet connection.");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/api/auth/verify-device", { body: { challenge, answer } });
      welcome();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach Hiraya.");
    } finally {
      setBusy(false);
    }
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/api/access-requests", { body: req });
      setStep("requested");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send your request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 w-full max-w-md">
      <div className="fixed right-4 top-4 z-50"><ThemeToggle className="bg-surface/70 backdrop-blur" /></div>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="card relative overflow-hidden p-7 sm:p-9"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="size-16" />
          <h1 className="h-display mt-3 text-4xl text-ink">Hiraya</h1>
          <p className="mt-1 font-display text-lg italic text-ink-soft">Where Family Stories Live Forever</p>
          <p className="mt-3 rounded-full bg-meadow/25 px-4 py-1 text-sm font-bold text-forest-deep">The {familyName} family home</p>
        </div>

        <AnimatePresence mode="wait">
          {step === "code" && (
            <motion.form key="code" onSubmit={submitCode} className="space-y-5"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Field label="Your name, as your admin registered it">
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" placeholder="e.g. Lola Remedios" required autoFocus />
              </Field>
              <div>
                <p className="mb-1.5 text-sm font-bold tracking-wide text-ink-soft">Your 6-digit access code</p>
                <CodeBoxes value={code} onChange={setCode} disabled={busy} />
                <p className="mt-2 text-sm text-ink-faint">Codes are sent privately by your family admin and last 3 minutes.</p>
              </div>
              {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                <DoorOpen /> Open the gate
              </Button>
              <div className="flex flex-col items-center gap-2 pt-1 text-sm">
                <button type="button" onClick={() => { setError(null); setStep("request"); }} className="font-bold text-forest underline-offset-4 hover:underline">
                  New here? Knock on the gate
                </button>
                <Link href="/admin-login" className="text-ink-faint hover:text-ink">Administrator sign-in</Link>
              </div>
            </motion.form>
          )}

          {step === "verify" && (
            <motion.form key="verify" onSubmit={submitAnswer} className="space-y-5"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex items-start gap-3 rounded-2xl bg-sky/25 p-4">
                <ShieldCheck className="mt-0.5 size-6 shrink-0 text-sky-deep" />
                <p className="text-sm text-ink">This looks like a new phone or computer. To keep the family safe, please answer the question you agreed on with your admin.</p>
              </div>
              <Field label={question ?? "Security question"}>
                <Input value={answer} onChange={(e) => setAnswer(e.target.value)} autoFocus required autoComplete="off" />
              </Field>
              {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
              <Button type="submit" size="lg" className="w-full" loading={busy}><KeyRound /> Confirm it&apos;s me</Button>
            </motion.form>
          )}

          {step === "request" && (
            <motion.form key="request" onSubmit={submitRequest} className="space-y-4"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <p className="text-ink-soft">Tell the family admin who you are. They&apos;ll register you and send you a code privately.</p>
              <Field label="Full name"><Input value={req.fullName} onChange={(e) => setReq({ ...req, fullName: e.target.value })} required /></Field>
              <Field label="How are you related?"><Input value={req.relationship} onChange={(e) => setReq({ ...req, relationship: e.target.value })} placeholder="e.g. Grandson of Lolo Ben" /></Field>
              <Field label="How can the admin reach you?"><Input value={req.contact} onChange={(e) => setReq({ ...req, contact: e.target.value })} placeholder="Messenger, Viber or phone" /></Field>
              <Field label="Message (optional)"><Textarea value={req.message} onChange={(e) => setReq({ ...req, message: e.target.value })} className="min-h-20" /></Field>
              <input tabIndex={-1} autoComplete="off" className="hidden" value={req.website} onChange={(e) => setReq({ ...req, website: e.target.value })} aria-hidden />
              {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setStep("code")}><ArrowLeft /> Back</Button>
                <Button type="submit" className="flex-1" loading={busy}><Send /> Send request</Button>
              </div>
            </motion.form>
          )}

          {step === "requested" && (
            <motion.div key="requested" className="space-y-4 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="h-display text-2xl">Your knock was heard 🌿</p>
              <p className="text-ink-soft">The family admin will review your request and send you a code privately.</p>
              <Button variant="secondary" onClick={() => setStep("code")}>Back to the gate</Button>
            </motion.div>
          )}

          {step === "welcome" && (
            <motion.div key="welcome" className="py-6 text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 160 }}>
                <LogoMark className="mx-auto size-20" />
              </motion.div>
              <p className="h-display mt-4 text-3xl">Welcome home</p>
              <p className="text-ink-soft">The gate swings open…</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
