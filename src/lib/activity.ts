import "server-only";
import { sql } from "./db";

export async function logActivity(entry: {
  accountId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  details?: unknown;
  ip?: string;
}) {
  try {
    await sql`
      insert into activity_log (account_id, action, entity_type, entity_id, summary, details, ip)
      values (${entry.accountId}, ${entry.action}, ${entry.entityType ?? null}, ${entry.entityId ?? null},
              ${entry.summary ?? null}, ${entry.details === undefined ? null : sql.json(entry.details as never)},
              ${entry.ip ?? null})`;
  } catch (e) {
    console.error("[activity] failed to log", e);
  }
}

/** Small before/after diff for the activity log. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after)) {
    const a = before[k];
    const b = after[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[k] = { from: a ?? null, to: b ?? null };
  }
  return changes;
}
