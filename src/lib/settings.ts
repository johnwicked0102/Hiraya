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

export const getSettings = cache(async (): Promise<FamilySettings> => {
  const rows = await sql<{ key: string; value: unknown }[]>`select key, value from settings`;
  const out: FamilySettings = { ...DEFAULTS };
  for (const r of rows) {
    const k = KEY_MAP[r.key];
    if (k) (out as unknown as Record<string, unknown>)[k] = r.value;
  }
  return out;
});

export async function setSetting(key: keyof typeof KEY_MAP, value: unknown) {
  await sql`
    insert into settings (key, value, updated_at) values (${key}, ${sql.json(value as never)}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}
