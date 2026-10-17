import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DatePrecision, PersonLite } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fullName(p: Pick<PersonLite, "firstName" | "middleName" | "lastName">) {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
}

export function shortName(p: Pick<PersonLite, "firstName" | "lastName" | "nickname">) {
  return p.nickname ? p.nickname : [p.firstName, p.lastName].filter(Boolean).join(" ");
}

export function initials(p: Pick<PersonLite, "firstName" | "lastName">) {
  return ((p.firstName?.[0] ?? "") + (p.lastName?.[0] ?? "")).toUpperCase();
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/** Format a 'YYYY-MM-DD' date string without timezone drift. */
export function formatDate(d: string | null | undefined, precision: DatePrecision = "day", style: "long" | "short" = "long") {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  if (!y) return "";
  if (precision === "year") return String(y);
  const month = MONTHS[(m ?? 1) - 1]!;
  const mo = style === "short" ? month.slice(0, 3) : month;
  if (precision === "month") return `${mo} ${y}`;
  return `${mo} ${day}, ${y}`;
}

export function yearOf(d: string | null | undefined): number | null {
  if (!d) return null;
  const y = Number(d.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export function lifespan(p: Pick<PersonLite, "birthDate" | "deathDate" | "isDeceased">) {
  const b = yearOf(p.birthDate);
  const d = yearOf(p.deathDate);
  if (p.isDeceased) return `${b ?? "?"} – ${d ?? "?"}`;
  return b ? `b. ${b}` : "";
}

export function ageOn(birth: string | null, on: Date = new Date()): number | null {
  if (!birth) return null;
  const [y, m, d] = birth.split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = on.getFullYear() - y;
  if (on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d)) age--;
  return age;
}

export function bytes(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  if (v < 1024) return `${v} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let x = v / 1024;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(x < 10 ? 1 : 0)} ${units[i]}`;
}

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function mediaUrl(id: string, opts: { thumb?: number; download?: boolean } = {}) {
  const q = new URLSearchParams();
  if (opts.thumb) q.set("thumb", String(opts.thumb));
  if (opts.download) q.set("download", "1");
  const qs = q.toString();
  return `/api/media/${id}/content${qs ? `?${qs}` : ""}`;
}
