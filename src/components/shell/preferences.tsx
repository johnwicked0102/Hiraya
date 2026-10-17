"use client";
import { useEffect, useState } from "react";
import { Moon, Sun, Wind, Type } from "lucide-react";
import { cn } from "@/lib/utils";

type Prefs = { theme?: "light" | "dark" | "system"; motion?: "full" | "reduce"; text?: "normal" | "large" };

function read(): Prefs {
  try {
    return JSON.parse(localStorage.getItem("hiraya:prefs") || "{}");
  } catch {
    return {};
  }
}
function write(p: Prefs) {
  try {
    localStorage.setItem("hiraya:prefs", JSON.stringify(p));
  } catch {
    /* private mode */
  }
}
function apply(p: Prefs) {
  const d = document.documentElement;
  const dark = p.theme === "dark" || (p.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  d.classList.toggle("dark", dark);
  d.classList.toggle("reduce-motion", p.motion === "reduce");
  d.classList.toggle("text-large", p.text === "large");
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>({});
  useEffect(() => setPrefs(read()), []);
  const update = (patch: Prefs) => {
    const next = { ...read(), ...patch };
    write(next);
    apply(next);
    setPrefs(next);
  };
  return { prefs, update };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { update } = usePrefs();
  return (
    <button
      type="button"
      onClick={() => update({ theme: document.documentElement.classList.contains("dark") ? "light" : "dark" })}
      className={cn("grid size-11 place-items-center rounded-2xl text-ink-soft transition hover:bg-surface-2 hover:text-ink", className)}
      aria-label="Switch between day and night"
      title="Day / night"
    >
      <Sun className="size-5 dark:hidden" />
      <Moon className="hidden size-5 dark:block" />
    </button>
  );
}

export function PreferencePanel() {
  const { prefs, update } = usePrefs();
  const row = "flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-2/60 p-4";
  const seg = (active: boolean) =>
    cn("rounded-xl px-3.5 py-2 text-sm font-bold transition", active ? "bg-forest text-[#fffaf0] dark:text-[#14211a]" : "text-ink-soft hover:bg-surface");
  return (
    <div className="space-y-3">
      <div className={row}>
        <span className="flex items-center gap-3 font-semibold"><Sun className="size-5 text-gold" /> Theme</span>
        <div className="flex gap-1">
          {(["light", "dark", "system"] as const).map((t) => (
            <button key={t} type="button" className={seg((prefs.theme ?? "system") === t)} onClick={() => update({ theme: t })}>
              {t === "light" ? "Day" : t === "dark" ? "Night" : "Auto"}
            </button>
          ))}
        </div>
      </div>
      <div className={row}>
        <span className="flex items-center gap-3 font-semibold"><Wind className="size-5 text-sky-deep" /> Animations</span>
        <div className="flex gap-1">
          <button type="button" className={seg(prefs.motion !== "reduce")} onClick={() => update({ motion: "full" })}>Gentle</button>
          <button type="button" className={seg(prefs.motion === "reduce")} onClick={() => update({ motion: "reduce" })}>Still</button>
        </div>
      </div>
      <div className={row}>
        <span className="flex items-center gap-3 font-semibold"><Type className="size-5 text-forest" /> Text size</span>
        <div className="flex gap-1">
          <button type="button" className={seg(prefs.text !== "large")} onClick={() => update({ text: "normal" })}>Regular</button>
          <button type="button" className={seg(prefs.text === "large")} onClick={() => update({ text: "large" })}>Larger</button>
        </div>
      </div>
    </div>
  );
}
