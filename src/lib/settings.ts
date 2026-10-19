import "server-only";
import { cache } from "react";
import { sql } from "./db";

export interface FamilySettings {
  familyName: string;
  familyMotto: string;
  logoMediaId: string | null;
  featuredMediaId: string | null;
  viewersCanContribute: boolean;
  membersCanDownload: boolean;
  rootPersonId: string | null;
}

const DEFAULTS: FamilySettings = {
  familyName: "Our Family",
  familyMotto: "Every branch tells a story. Every memory keeps us together.",
  logoMediaId: null,
  featuredMediaId: null,
  viewersCanContribute: true,
  membersCanDownload: true,
  rootPersonId: null,
};

const KEY_MAP: Record<string, keyof FamilySettings> = {
  family_name: "familyName",
  family_motto: "familyMotto",
  logo_media_id: "logoMediaId",
  featured_media_id: "featuredMediaId",
  viewers_can_contribute: "viewersCanContribute",
  members_can_download: "membersCanDownload",
  root_person_id: "rootPersonId",
};

/**
 * Values saved by setSetting in commit 08b9dd8 were JSON-encoded twice (e.g. the jsonb
 * string "\"<uuid>\"" or "null"); decode those so they read as intended.
 */
function unwrap(v: unknown): unknown {
  if (typeof v !== "string" || !/^(".*"|null|true|false)$/s.test(v)) return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

export const getSettings = cache(async (): Promise<FamilySettings> => {
  const rows = await sql<{ key: string; value: unknown }[]>`select key, value from settings`;
  const out: FamilySettings = { ...DEFAULTS };
  for (const r of rows) {
    const k = KEY_MAP[r.key];
    if (k) (out as unknown as Record<string, unknown>)[k] = unwrap(r.value);
  }
  return out;
});

export async function setSetting(key: keyof typeof KEY_MAP, value: unknown) {
  await sql`
    insert into settings (key, value, updated_at) values (${key}, ${JSON.stringify(value ?? null)}::text::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}
