import { NextResponse, type NextRequest } from "next/server";

// Fast gate: pages need a session cookie. The real session check happens on
// the server for every page and API call (see src/lib/session.ts).
const PUBLIC = ["/login", "/admin-login", "/setup", "/offline"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (!req.cookies.get("hiraya_session")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|icons|brand|icon.png|manifest.webmanifest|sw.js|favicon.ico|robots.txt|offline).*)"],
};
