import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { getViewer, type Viewer } from "./session";

export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export type AccessLevel = "public" | "member" | "contributor" | "editor" | "admin";

type Ctx<B> = {
  req: NextRequest;
  viewer: Viewer;
  body: B;
  params: Record<string, string>;
};
type PublicCtx<B> = Omit<Ctx<B>, "viewer"> & { viewer: Viewer | null };

export function clientIp(req: Request): string {
  // On Vercel `x-real-ip` is set by the platform and cannot be spoofed by the
  // client, so prefer it for throttling; fall back to the left-most
  // `x-forwarded-for` entry on other hosts.
  const real = req.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return "unknown";
}

/** Reject cross-site state-changing requests (defence in depth on top of SameSite cookies). */
function assertSameOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin) {
    let o: URL;
    try {
      o = new URL(origin);
    } catch {
      throw new HttpError(403, "Bad origin");
    }
    if (o.host !== host) throw new HttpError(403, "Cross-site request blocked");
    return;
  }
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new HttpError(403, "Cross-site request blocked");
}

function levelAllows(viewer: Viewer, level: AccessLevel): boolean {
  switch (level) {
    case "public":
    case "member":
      return true;
    case "contributor":
      return viewer.canContribute;
    case "editor":
      return viewer.canEditTree;
    case "admin":
      return viewer.isAdmin;
  }
}

export function api<S extends z.ZodTypeAny | undefined = undefined>(
  opts: { level: Exclude<AccessLevel, "public">; body?: S },
  fn: (ctx: Ctx<S extends z.ZodTypeAny ? z.infer<S> : undefined>) => Promise<unknown>,
): (req: NextRequest, ctx: { params: Promise<any> }) => Promise<Response>;
export function api<S extends z.ZodTypeAny | undefined = undefined>(
  opts: { level: "public"; body?: S },
  fn: (ctx: PublicCtx<S extends z.ZodTypeAny ? z.infer<S> : undefined>) => Promise<unknown>,
): (req: NextRequest, ctx: { params: Promise<any> }) => Promise<Response>;
export function api(
  opts: { level: AccessLevel; body?: z.ZodTypeAny },
  fn: (ctx: any) => Promise<unknown>,
) {
  return async (req: NextRequest, routeCtx: { params: Promise<any> }) => {
    try {
      assertSameOrigin(req);
      const viewer = await getViewer();
      if (opts.level !== "public") {
        if (!viewer) throw new HttpError(401, "Please sign in again.");
        if (!levelAllows(viewer, opts.level)) {
          throw new HttpError(403, opts.level === "admin"
            ? "Administrator access with full sign-in (password + authenticator) is required."
            : "You don't have permission to do that.");
        }
      }
      let body: unknown = undefined;
      if (opts.body) {
        let raw: unknown = {};
        const text = await req.text();
        if (text) {
          try {
            raw = JSON.parse(text);
          } catch {
            throw new HttpError(400, "Invalid JSON");
          }
        }
        body = opts.body.parse(raw);
      }
      const params = (await routeCtx?.params) ?? {};
      const result = await fn({ req, viewer, body, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return NextResponse.json(
          { error: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input" },
          { status: 400 },
        );
      }
      const pgCode = (err as { code?: string })?.code;
      if (pgCode === "23505") return NextResponse.json({ error: "That already exists." }, { status: 409 });
      if (pgCode === "23503") return NextResponse.json({ error: "A linked record no longer exists." }, { status: 409 });
      console.error("[api]", req.method, req.nextUrl.pathname, err);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

// Common validators
export const zUuid = z.string().uuid();
export const zDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));
export const zText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null));
