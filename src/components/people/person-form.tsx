"use client";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { PortraitEditor, type PortraitValue } from "./portrait-editor";
import { api, ApiError } from "@/lib/client";
import type { PersonFull } from "@/lib/types";

export type Relation = { type: "parent" | "child" | "partner" | "sibling"; personId: string; personName: string };

const EMPTY = {
  firstName: "", middleName: "", lastName: "", maidenName: "", nickname: "", gender: "unknown",
  birthDate: "", birthDatePrecision: "day", birthPlace: "", isDeceased: false, deathDate: "", deathDatePrecision: "day",
  deathPlace: "", restingPlace: "", occupation: "", hobbies: "", achievements: "", biography: "", memorialMessage: "",
  sensitive: { phone: "", email: "", address: "", notes: "" },
};
type FormState = typeof EMPTY;

function fromPerson(p: PersonFull): FormState {
  const s = (v: string | null | undefined) => v ?? "";
  return {
    firstName: p.firstName, middleName: s(p.middleName), lastName: s(p.lastName), maidenName: s(p.maidenName),
    nickname: s(p.nickname), gender: p.gender, birthDate: s(p.birthDate), birthDatePrecision: p.birthDatePrecision,
    birthPlace: s(p.birthPlace), isDeceased: p.isDeceased, deathDate: s(p.deathDate), deathDatePrecision: p.deathDatePrecision,
    deathPlace: s(p.deathPlace), restingPlace: s(p.restingPlace), occupation: s(p.occupation), hobbies: s(p.hobbies),
    achievements: s(p.achievements), biography: s(p.biography), memorialMessage: s(p.memorialMessage),
    sensitive: { phone: s(p.sensitive?.phone), email: s(p.sensitive?.email), address: s(p.sensitive?.address), notes: s(p.sensitive?.notes) },
  };
}

/** Normalizes a partial date from the precision selector into YYYY-MM-DD. */
function normDate(v: string, precision: string) {
  if (!v) return null;
  if (precision === "year") return /^\d{4}$/.test(v) ? `${v}-01-01` : v.length >= 4 ? `${v.slice(0, 4)}-01-01` : null;
  if (precision === "month") return /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : v.length >= 7 ? `${v.slice(0, 7)}-01` : null;
  return v;
}

function DateInput({ value, precision, onChange, onPrecision }: { value: string; precision: string; onChange: (v: string) => void; onPrecision: (p: string) => void }) {
  const display = precision === "year" ? value.slice(0, 4) : precision === "month" ? value.slice(0, 7) : value;
  return (
    // Browser date pickers won't shrink below ~9.5rem, so on narrow screens the
    // precision picker wraps under the date instead of pushing out of the dialog.
    <div className="flex flex-wrap gap-2">
      {precision === "year" ? (
        <Input inputMode="numeric" placeholder="YYYY" maxLength={4} value={display} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} className="min-w-[9.5rem] flex-1" />
      ) : (
        <Input type={precision === "month" ? "month" : "date"} value={display} onChange={(e) => onChange(e.target.value)} className="min-w-[9.5rem] flex-1" />
      )}
      <Select value={precision} onChange={(e) => onPrecision(e.target.value)} className="w-36 grow sm:grow-0" aria-label="How exact is this date?">
        <option value="day">Exact day</option>
        <option value="month">Month only</option>
        <option value="year">Year only</option>
      </Select>
    </div>
  );
}

export function PersonForm({
  open, onOpenChange, person, relation, canSeePrivate, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  person?: PersonFull | null;
  relation?: Relation | null;
  canSeePrivate?: boolean;
  onSaved: (id: string) => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<FormState>(EMPTY);
  const [portrait, setPortrait] = useState<PortraitValue>({ photoMediaId: null, photoCrop: null, photoFrame: "round" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState("biological");

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (person) {
      setF(fromPerson(person));
      setPortrait({ photoMediaId: person.photoMediaId, photoCrop: person.photoCrop, photoFrame: person.photoFrame });
    } else {
      setF(EMPTY);
      setPortrait({ photoMediaId: null, photoCrop: null, photoFrame: "round" });
      setKind(relation?.type === "partner" ? "married" : "biological");
    }
  }, [open, person, relation]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const t = (v: string) => (v.trim() ? v.trim() : null);
    const payload = {
      firstName: f.firstName.trim(),
      middleName: t(f.middleName), lastName: t(f.lastName), maidenName: t(f.maidenName), nickname: t(f.nickname),
      gender: f.gender,
      birthDate: normDate(f.birthDate, f.birthDatePrecision), birthDatePrecision: f.birthDatePrecision, birthPlace: t(f.birthPlace),
      isDeceased: f.isDeceased,
      deathDate: f.isDeceased ? normDate(f.deathDate, f.deathDatePrecision) : null, deathDatePrecision: f.deathDatePrecision,
      deathPlace: f.isDeceased ? t(f.deathPlace) : null, restingPlace: f.isDeceased ? t(f.restingPlace) : null,
      occupation: t(f.occupation), hobbies: t(f.hobbies), achievements: t(f.achievements), biography: t(f.biography),
      memorialMessage: f.isDeceased ? t(f.memorialMessage) : null,
      ...portrait,
      ...(canSeePrivate ? { sensitive: { phone: t(f.sensitive.phone), email: t(f.sensitive.email), address: t(f.sensitive.address), notes: t(f.sensitive.notes) } } : {}),
    };
    try {
      if (person) {
        await api(`/api/persons/${person.id}`, { method: "PATCH", body: payload });
        toast("Profile saved");
        onSaved(person.id);
      } else {
        const r = await api<{ id: string }>("/api/persons", {
          body: { person: payload, relation: relation ? { type: relation.type, personId: relation.personId, kind } : undefined },
        });
        toast(`${payload.firstName} joined the family tree 🌱`);
        onSaved(r.id);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  const title = person
    ? `Edit ${person.firstName}`
    : relation
      ? `Add a ${relation.type} for ${relation.personName}`
      : "Add a family member";

  const section = "space-y-4 rounded-3xl border border-line bg-surface-2/50 p-4 sm:p-5";
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} wide>
      <form onSubmit={submit} className="space-y-5">
        {relation && relation.type !== "sibling" && (
          <Field label={relation.type === "partner" ? "Relationship" : "Kind of relationship"}>
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              {relation.type === "partner" ? (
                <>
                  <option value="married">Married</option>
                  <option value="partner">Partners</option>
                  <option value="engaged">Engaged</option>
                </>
              ) : (
                <>
                  <option value="biological">Birth</option>
                  <option value="adopted">Adopted</option>
                  <option value="step">Step</option>
                  <option value="foster">Foster</option>
                  <option value="guardian">Guardian</option>
                </>
              )}
            </Select>
          </Field>
        )}

        <div className={section}>
          <PortraitEditor person={{ firstName: f.firstName || "?", lastName: f.lastName, gender: f.gender as "unknown", isDeceased: f.isDeceased }} value={portrait} onChange={setPortrait} />
        </div>

        <div className={section}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="First name"><Input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} required autoFocus /></Field>
            <Field label="Middle name"><Input value={f.middleName} onChange={(e) => set("middleName", e.target.value)} /></Field>
            <Field label="Last name"><Input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nickname" hint="e.g. Lola Mering"><Input value={f.nickname} onChange={(e) => set("nickname", e.target.value)} /></Field>
            <Field label="Maiden name"><Input value={f.maidenName} onChange={(e) => set("maidenName", e.target.value)} /></Field>
            <Field label="Gender">
              <Select value={f.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="unknown">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Another identity</option>
              </Select>
            </Field>
          </div>
        </div>

        <div className={section}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Born"><DateInput value={f.birthDate} precision={f.birthDatePrecision} onChange={(v) => set("birthDate", v)} onPrecision={(p) => set("birthDatePrecision", p)} /></Field>
            <Field label="Birthplace"><Input value={f.birthPlace} onChange={(e) => set("birthPlace", e.target.value)} placeholder="Town, province, country" /></Field>
          </div>
          <Checkbox label="This family member has passed away" checked={f.isDeceased} onChange={(e) => set("isDeceased", e.target.checked)} />
          {f.isDeceased && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Passed away"><DateInput value={f.deathDate} precision={f.deathDatePrecision} onChange={(v) => set("deathDate", v)} onPrecision={(p) => set("deathDatePrecision", p)} /></Field>
                <Field label="Place"><Input value={f.deathPlace} onChange={(e) => set("deathPlace", e.target.value)} /></Field>
              </div>
              <Field label="Resting place"><Input value={f.restingPlace} onChange={(e) => set("restingPlace", e.target.value)} /></Field>
              <Field label="Words of remembrance"><Textarea value={f.memorialMessage} onChange={(e) => set("memorialMessage", e.target.value)} className="min-h-20" /></Field>
            </>
          )}
        </div>

        <div className={section}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Occupation"><Input value={f.occupation} onChange={(e) => set("occupation", e.target.value)} /></Field>
            <Field label="Hobbies & loves"><Input value={f.hobbies} onChange={(e) => set("hobbies", e.target.value)} /></Field>
          </div>
          <Field label="Achievements"><Textarea value={f.achievements} onChange={(e) => set("achievements", e.target.value)} className="min-h-20" /></Field>
          <Field label="Life story"><Textarea value={f.biography} onChange={(e) => set("biography", e.target.value)} className="min-h-40" placeholder="Where they grew up, what they loved, the stories everyone tells about them…" /></Field>
        </div>

        {canSeePrivate && (
          <div className={section}>
            <p className="flex items-center gap-2 font-bold text-ink"><Lock className="size-4 text-gold" /> Private details <span className="font-normal text-ink-faint">— only admins and this person can see these</span></p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone"><Input value={f.sensitive.phone} onChange={(e) => set("sensitive", { ...f.sensitive, phone: e.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={f.sensitive.email} onChange={(e) => set("sensitive", { ...f.sensitive, email: e.target.value })} /></Field>
            </div>
            <Field label="Address"><Input value={f.sensitive.address} onChange={(e) => set("sensitive", { ...f.sensitive, address: e.target.value })} /></Field>
            <Field label="Private notes"><Textarea value={f.sensitive.notes} onChange={(e) => set("sensitive", { ...f.sensitive, notes: e.target.value })} className="min-h-20" /></Field>
          </div>
        )}

        {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
        {/* Stick to the dialog's outer edge (through its p-6 / sm:p-8 padding) so fields don't show through below the buttons. */}
        <div className="sticky -bottom-6 -mx-1 -mb-6 flex justify-end gap-2 bg-gradient-to-t from-surface via-surface to-transparent px-1 pb-6 pt-4 sm:-bottom-8 sm:-mb-8 sm:pb-8">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={busy}>{person ? "Save changes" : "Add to the tree"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
