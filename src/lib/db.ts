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
    // Serverless: a small pool per instance. With max=1, pages that run many
    // queries in parallel (e.g. /admin) queue everything on one socket.
    max: Number(process.env.DATABASE_POOL_SIZE ?? 3),
    // Supabase's transaction pooler (Supavisor/PgBouncer) can stall when several
    // queries are pipelined on one connection — send one at a time.
    // (Supported at runtime, missing from postgres.js' typings.)
    ...({ max_pipeline: 1 } as object),
    // Drop idle sockets quickly and recycle old ones: a frozen Vercel instance
    // can come back holding a dead TCP connection that would hang forever.
    idle_timeout: 10,
    max_lifetime: 60 * 5,
    keep_alive: 10,
    connect_timeout: 10,
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

type Client = ReturnType<typeof createClient>;

/**
 * Vercel freezes function instances between requests. While frozen, timers
 * (idle_timeout, keepalive) don't run, but Supabase's pooler drops the idle TCP
 * connection. The next request then writes into a dead socket and the query
 * hangs until the 300s function timeout. See:
 * https://supabase.com/docs/guides/troubleshooting/troubleshooting-connect_timeout-or-hanging-queries-in-vercel-serverless-functions-775f92
 *
 * So: when the client hasn't been touched for a few seconds (long enough that
 * the instance may have been frozen), retire it and open fresh connections.
 * Within a request, queries run back-to-back, so they share one client.
 */
const STALE_AFTER_MS = Number(process.env.DATABASE_STALE_MS ?? 3_000);

const holder = globalThis as unknown as { __hirayaDb?: { client: Client; lastUsed: number } };

function current(): Client {
  const now = Date.now();
  const h = holder.__hirayaDb;
  if (!h) {
    holder.__hirayaDb = { client: createClient(), lastUsed: now };
  } else if (now - h.lastUsed > STALE_AFTER_MS) {
    // Idle (possibly dead) sockets close now; in-flight work such as a long
    // backup gets up to the function limit to finish. Not awaited: a dead
    // socket must never block the new request.
    h.client.end({ timeout: 290 }).catch(() => {});
    h.client = createClient();
  }
  holder.__hirayaDb!.lastUsed = now;
  return holder.__hirayaDb!.client;
}

/** Tagged-template SQL client; always delegates to a live postgres.js client. */
export const sql = new Proxy(function () {} as unknown as Client, {
  apply: (_t, _this, args) => (current() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) => {
    const c = current();
    const v = Reflect.get(c, prop, c);
    return typeof v === "function" ? v.bind(c) : v;
  },
}) as Client;

export type Sql = Client;
