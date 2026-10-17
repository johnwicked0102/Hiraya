"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { Gift, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { PersonLite } from "@/lib/types";

export type Greeting = { id: string; message: string; cardStyle: string; occasion: string; year: number; createdAt: string; authorName: string | null; authorId: string | null };

export const CARD_STYLES: Record<string, { bg: string; label: string; emoji: string }> = {
  meadow: { bg: "linear-gradient(135deg,#dfeec5,#a9c47f)", label: "Meadow", emoji: "🌼" },
  lantern: { bg: "linear-gradient(135deg,#fde7b5,#e3a740)", label: "Lantern", emoji: "🏮" },
  sunflower: { bg: "linear-gradient(135deg,#fff3c4,#f6cf72)", label: "Sunflower", emoji: "🌻" },
  starlight: { bg: "linear-gradient(135deg,#3b4a6b,#7b6a9b)", label: "Starlight", emoji: "✨" },
};

export function GreetingCardView({ g, i, canDelete, onDeleted }: { g: Greeting; i: number; canDelete: boolean; onDeleted: () => void }) {
  const toast = useToast();
  const s = CARD_STYLES[g.cardStyle] ?? CARD_STYLES.meadow!;
  const dark = g.cardStyle === "starlight";
  return (
    <motion.div initial={{ opacity: 0, rotate: i % 2 ? 2 : -2, y: 10 }} animate={{ opacity: 1, rotate: i % 2 ? 1 : -1, y: 0 }}
      className={cn("relative rounded-[1.6rem] p-6 shadow-[0_18px_30px_-18px_rgb(var(--shadow)/.6)]", dark ? "text-[#f6efdc]" : "text-[#2c3a2e]")} style={{ background: s.bg }}>
      <div className="text-3xl">{s.emoji}</div>
      <p className="mt-3 whitespace-pre-line font-display text-lg leading-snug">{g.message}</p>
      <p className="mt-4 text-sm font-bold opacity-75">— {g.authorName ?? "A family member"}, {g.year}</p>
      {canDelete && (
        <button className="absolute right-3 top-3 rounded-full p-1.5 opacity-60 hover:bg-black/10 hover:opacity-100" aria-label="Delete card"
          onClick={async () => { if (!confirm("Delete this card?")) return; try { await api(`/api/greetings/${g.id}`, { method: "DELETE" }); onDeleted(); } catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't delete", "error"); } }}>
          <Trash2 className="size-4" />
        </button>
      )}
    </motion.div>
  );
}

export function GreetingComposer({ open, onOpenChange, person, defaultOccasion, onSent }: {
  open: boolean; onOpenChange: (o: boolean) => void; person: Pick<PersonLite, "id" | "firstName">; defaultOccasion: string; onSent: () => void;
}) {
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [style, setStyle] = useState("meadow");
  const [occasion, setOccasion] = useState(defaultOccasion);
  const [busy, setBusy] = useState(false);
  const s = CARD_STYLES[style]!;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`A card for ${person.firstName}`}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/api/greetings", { body: { personId: person.id, message, cardStyle: style, occasion } });
          toast("Card delivered 💌");
          setMessage("");
          onOpenChange(false);
          onSent();
        } catch (err) { toast(err instanceof ApiError ? err.message : "Couldn't send", "error"); }
        finally { setBusy(false); }
      }}>
        <div className="rounded-[1.6rem] p-5" style={{ background: s.bg }}>
          <div className="text-3xl">{s.emoji}</div>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={2000}
            className="mt-2 border-none bg-white/60 font-display text-lg" placeholder={occasion === "memorial" ? "A memory, a prayer, a thank-you…" : `Happy birthday, ${person.firstName}!`} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Card style">
            <Select value={style} onChange={(e) => setStyle(e.target.value)}>
              {Object.entries(CARD_STYLES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
            </Select>
          </Field>
          <Field label="Occasion">
            <Select value={occasion} onChange={(e) => setOccasion(e.target.value)}>
              <option value="birthday">Birthday</option><option value="anniversary">Anniversary</option><option value="memorial">Remembrance</option><option value="congrats">Congratulations</option>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="gold" loading={busy}><Gift /> Send card</Button></div>
      </form>
    </Dialog>
  );
}
