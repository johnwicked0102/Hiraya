/**
 * Floating leaves (day), butterflies (day) and fireflies (night).
 * Positions are deterministic so server and client render identically.
 * Hidden automatically when reduced motion is requested.
 */
import { cn } from "@/lib/utils";

function seq(n: number, seed: number) {
  const out: number[] = [];
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (x * 9301 + 49297) % 233280;
    out.push(x / 233280);
  }
  return out;
}

export function Ambient({ leaves = 7, butterflies = 2, fireflies = 18, className }: { leaves?: number; butterflies?: number; fireflies?: number; className?: string }) {
  const r = seq(80, 7);
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <div className="dark:hidden">
        {Array.from({ length: leaves }).map((_, i) => (
          <svg
            key={`l${i}`}
            className="leaf absolute"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            style={{
              left: `${(r[i]! * 95).toFixed(2)}%`,
              top: "-5%",
              animationDuration: `${14 + r[i + 10]! * 12}s`,
              animationDelay: `${-r[i + 20]! * 20}s`,
            }}
          >
            <path d="M3 21C3 11 9 4 21 3c-1 12-8 18-18 18Z" fill={i % 3 === 0 ? "var(--gold)" : i % 3 === 1 ? "var(--moss)" : "var(--rose)"} opacity="0.85" />
            <path d="M3 21C9 15 13 11 18 6" stroke="#fffaf0" strokeWidth="1" opacity="0.7" />
          </svg>
        ))}
        {Array.from({ length: butterflies }).map((_, i) => (
          <div
            key={`b${i}`}
            className="butterfly absolute"
            style={{ left: `${5 + r[i + 30]! * 30}%`, top: `${30 + r[i + 40]! * 30}%`, animationDelay: `${-r[i + 50]! * 20}s` }}
          >
            <svg width="26" height="20" viewBox="0 0 26 20">
              <g className="wing">
                <path d="M13 10C9 0 1 1 2 7s8 4 11 3Z" fill={i % 2 ? "var(--sky-deep)" : "var(--gold)"} />
                <path d="M13 10C17 0 25 1 24 7s-8 4-11 3Z" fill={i % 2 ? "var(--sky-deep)" : "var(--gold)"} />
                <path d="M13 10C10 15 5 18 5 14s5-4 8-4Z" fill={i % 2 ? "var(--sky)" : "var(--sun)"} />
                <path d="M13 10C16 15 21 18 21 14s-5-4-8-4Z" fill={i % 2 ? "var(--sky)" : "var(--sun)"} />
              </g>
              <rect x="12.3" y="5" width="1.4" height="10" rx="0.7" fill="#3a2d1f" />
            </svg>
          </div>
        ))}
      </div>
      <div className="hidden dark:block">
        {Array.from({ length: fireflies }).map((_, i) => (
          <span
            key={`f${i}`}
            className="firefly absolute block rounded-full"
            style={{
              left: `${(r[i + 5]! * 100).toFixed(2)}%`,
              top: `${(45 + r[i + 25]! * 50).toFixed(2)}%`,
              width: 5,
              height: 5,
              background: "#ffe9a3",
              boxShadow: "0 0 10px 4px rgba(255, 220, 120, .55)",
              animationDuration: `${4 + r[i + 45]! * 5}s`,
              animationDelay: `${-r[i + 60]! * 6}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
