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

/**
 * postgres.js has no query timeout, so a stalled connection (e.g. a dead socket
 * left behind by a frozen Vercel instance) would hang the page until the 300s
 * function limit. We wrap every query so it can't hang indefinitely AND so it
 * recovers on its own instead of just failing:
 *
 *   1. Watchdog — if a query runs past QUERY_TIMEOUT_MS, stop waiting on it.
 *   2. Retry — on a connection failure or a (read) timeout, retire the bad
 *      client and run the query once more on a freshly opened connection.
 *
 * The stale-client recycle in `current()` catches most freezes before a query
 * is even issued; the retry here is the safety net for the gap where the pooler
 * drops the idle connection faster than STALE_AFTER_MS, so the socket looks
 * fresh to us but is already dead.
 */
const QUERY_TIMEOUT_MS = Number(process.env.DATABASE_QUERY_TIMEOUT_MS ?? 15_000);
// Reads normally finish well under a second, so a read stuck this long is on a
// dead connection: give up early and replay it, instead of making the page
// wait the full QUERY_TIMEOUT_MS first. The replay gets the full timeout.
const READ_FIRST_TIMEOUT_MS = Number(process.env.DATABASE_READ_TIMEOUT_MS ?? 4_000);
const QUERY_RETRIES = Number(process.env.DATABASE_QUERY_RETRIES ?? 1);

const TIMED_OUT = Symbol("db-timeout");

// Errors meaning the statement never reached the server, so re-running it is
// always safe (no risk of a duplicated write). These are postgres.js connection
// codes plus the raw socket errors it surfaces.
const CONNECTION_ERROR_CODES = new Set([
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
  "CONNECT_TIMEOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
]);

function isConnectionError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" && CONNECTION_ERROR_CODES.has(code);
}

/** Drop the current client so the next `current()` opens fresh connections. */
function retireClient() {
  if (holder.__hirayaDb) holder.__hirayaDb.lastUsed = 0;
}

function guard<Q extends PromiseLike<unknown>>(q0: Q, args: unknown[]): Q {
  const strings = args[0];
  const label = Array.isArray(strings) ? strings.join("$").replace(/\s+/g, " ").trim().slice(0, 140) : "?";
  // A timeout may fire after the server already ran the statement, so only
  // reads are safe to replay on a timeout; writes replay on connection errors
  // only (where we know nothing executed). `with` is treated as a read.
  const isRead = /^\s*(select|with)\b/i.test(label);

  // The first attempt reuses the already-built query; retries build a fresh one
  // on a recycled client. Fragments (`sql`...`` nested in another query) never
  // reach this code because they are interpolated, not awaited.
  const run0 = q0.then.bind(q0) as (res: (v: unknown) => void, rej: (e: unknown) => void) => void;

  const attempt = (n: number): Promise<unknown> => {
    const t0 = Date.now();
    const exec = (res: (v: unknown) => void, rej: (e: unknown) => void) => {
      if (n === 0) return run0(res, rej);
      const fresh = (current() as unknown as (...a: unknown[]) => PromiseLike<unknown>)(...args);
      fresh.then(res, rej);
    };
    const limit = isRead && n < QUERY_RETRIES ? Math.min(READ_FIRST_TIMEOUT_MS, QUERY_TIMEOUT_MS) : QUERY_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(TIMED_OUT), limit);
    });
    return Promise.race([new Promise(exec), timeout])
      .finally(() => {
        clearTimeout(timer);
        const ms = Date.now() - t0;
        if (ms > 3_000 && ms < limit) console.warn(`[db] slow query ${ms}ms: ${label}`);
      })
      .catch((e) => {
        const timedOut = e === TIMED_OUT;
        const canRetry = (isConnectionError(e) || (timedOut && isRead)) && n < QUERY_RETRIES;
        if (canRetry) {
          retireClient(); // next current() opens a fresh connection for the replay
          console.warn(`[db] retry ${n + 1}/${QUERY_RETRIES} after ${timedOut ? "timeout" : "connection error"}: ${label}`);
          return attempt(n + 1);
        }
        if (timedOut) {
          retireClient();
          console.error(`[db] query timed out after ${limit / 1000}s: ${label}`);
          throw new Error("The database took too long to respond. Please try again.");
        }
        throw e;
      });
  };

  (q0 as { then: unknown }).then = (onOk?: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) =>
    attempt(0).then(onOk, onErr);
  return q0;
}

/** Tagged-template SQL client; always delegates to a live postgres.js client. */
export const sql = new Proxy(function () {} as unknown as Client, {
  apply: (_t, _this, args) => {
    const q = (current() as unknown as (...a: unknown[]) => unknown)(...args);
    return q && typeof (q as PromiseLike<unknown>).then === "function" ? guard(q as PromiseLike<unknown>, args) : q;
  },
  get: (_t, prop) => {
    const c = current();
    const v = Reflect.get(c, prop, c);
    return typeof v === "function" ? v.bind(c) : v;
  },
}) as Client;

export type Sql = Client;
