import { cn } from "@/lib/utils";

/** Hiraya emblem: a sun rising behind a family tree on a hill. Original artwork. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-10", className)} aria-hidden>
      <circle cx="32" cy="32" r="30" fill="var(--surface)" stroke="var(--gold)" strokeWidth="2.5" />
      <circle cx="32" cy="30" r="14" fill="var(--sun)" opacity="0.85" />
      <path d="M6 44c8-5 16-6 26-4s18 1 26-4v6a27 27 0 0 1-52 2Z" fill="var(--moss)" />
      <path d="M30 44c1-6 0-10-3-14 3 2 4 3 5 5 1-3 3-5 6-6-3 4-4 8-4 15Z" fill="var(--trunk, #6b4b35)" />
      <circle cx="26" cy="25" r="7" fill="var(--forest)" />
      <circle cx="38" cy="24" r="7.5" fill="var(--forest)" />
      <circle cx="32" cy="19" r="8" fill="var(--moss)" />
    </svg>
  );
}

export function Wordmark({ className, tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="h-display text-2xl text-ink">Hiraya</span>
        {tagline && <span className="mt-1 text-xs font-semibold tracking-wide text-ink-soft">Where Family Stories Live Forever</span>}
      </span>
    </span>
  );
}
