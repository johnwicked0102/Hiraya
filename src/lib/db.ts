import "server-only";
import postgres from "postgres";

/** Normalize Postgres timestamp text into an ISO-8601 string. */
function isoFromPg(x: string): string {
  const s = x.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? x : d.toISOString();
}

function createClient() {
  const url = process.env.DATABASE_URL;
  const ssl = process.env.DATABASE_SSL === "disable" ? false : ("require" as const);
  return postgres(url ?? "postgres://localhost:5432/hiraya", {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false, // required for Supabase / PgBouncer transaction pooling
    ssl,
    transform: postgres.camel,
    types: {
      // timestamps → ISO strings; `date` columns stay as plain 'YYYY-MM-DD' strings
      date: {
        to: 1184,
        from: [1114, 1184],
        serialize: (x: Date | string) => (x instanceof Date ? x : new Date(x)).toISOString(),
        parse: (x: string) => isoFromPg(x),
      },
      // Calendar dates stay as plain 'YYYY-MM-DD' strings (no timezone drift).
      dateOnly: {
        to: 1082,
        from: [1082],
        serialize: (x: string) => x,
        parse: (x: string) => x,
      },
    },
    onnotice: () => {},
  });
}

const g = globalThis as unknown as { __hirayaSql?: ReturnType<typeof createClient> };
export const sql = g.__hirayaSql ?? createClient();
if (process.env.NODE_ENV !== "production") g.__hirayaSql = sql;

export type Sql = typeof sql;
