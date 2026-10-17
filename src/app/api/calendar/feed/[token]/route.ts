import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { celebrationSources } from "@/lib/celebrations";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const clean = token.replace(/\.ics$/, "");
  if (!/^hcal_[A-Za-z0-9_-]{20,64}$/.test(clean)) return new NextResponse("Not found", { status: 404 });
  const [acct] = await sql`select id from accounts where calendar_token_hash = ${sha256(clean)} and status = 'active'`;
  if (!acct) return new NextResponse("Not found", { status: 404 });

  const [sources, settings] = await Promise.all([celebrationSources(), getSettings()]);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hiraya//Family Celebrations//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(`${settings.familyName} family · Hiraya`)}`,
    "X-PUBLISHED-TTL:PT12H",
  ];
  const emoji = { birthday: "🎂 ", anniversary: "💍 ", memorial: "🕯️ ", event: "🌿 " } as const;
  for (const s of sources) {
    const d = s.sourceDate.replace(/-/g, "");
    const next = new Date(`${s.sourceDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@hiraya`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`,
      fold(`SUMMARY:${esc(emoji[s.type] + s.title)}`),
      ...(s.recurring ? ["RRULE:FREQ=YEARLY"] : []),
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${esc(`Tomorrow: ${s.title}`)}`),
      "TRIGGER:-PT15H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new NextResponse(lines.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=3600", "Content-Disposition": 'inline; filename="hiraya.ics"' },
  });
}
