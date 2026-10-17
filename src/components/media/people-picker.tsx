"use client";
import { useMemo, useState } from "react";
import { X, Tag } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Portrait } from "@/components/portrait";
import { fullName, shortName } from "@/lib/utils";
import type { PersonLite } from "@/lib/types";

/** Tag family members (searchable chips). */
export function PeoplePicker({ people, value, onChange, label = "Who's in it?" }: {
  people: PersonLite[];
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return people.filter((p) => !value.includes(p.id) && fullName(p).toLowerCase().concat(" ", (p.nickname ?? "").toLowerCase()).includes(s)).slice(0, 6);
  }, [q, people, value]);
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-2 text-sm font-bold tracking-wide text-ink-soft"><Tag className="size-4" /> {label}</p>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {value.map((id) => {
            const p = byId.get(id);
            if (!p) return null;
            return (
              <span key={id} className="flex items-center gap-1.5 rounded-full bg-meadow/30 py-1 pl-1 pr-2 text-sm font-bold text-forest-deep">
                <Portrait person={p} size={24} thumb={64} frame="round" className="!shadow-none" />
                {shortName(p)}
                <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} aria-label={`Remove ${shortName(p)}`} className="rounded-full p-0.5 hover:bg-surface"><X className="size-3.5" /></button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name to tag…" />
        {matches.length > 0 && (
          <ul className="card absolute inset-x-0 top-14 z-30 p-1.5">
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-surface-2" onClick={() => { onChange([...value, p.id]); setQ(""); }}>
                  <Portrait person={p} size={32} thumb={64} frame="round" />
                  <span className="font-bold">{fullName(p)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
