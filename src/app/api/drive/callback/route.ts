import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/session";
import { appUrl, exchangeCode, saveConnection } from "@/lib/drive";
import { safeEqual } from "@/lib/crypto";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  const back = (status: string) => NextResponse.redirect(`${appUrl()}/admin?tab=drive&drive=${status}`);
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return NextResponse.redirect(`${appUrl()}/admin-login?next=/admin`);
  const jar = await cookies();
  const expected = jar.get("hiraya_oauth_state")?.value;
  jar.delete("hiraya_oauth_state");
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const code = req.nextUrl.searchParams.get("code");
  if (req.nextUrl.searchParams.get("error")) return back("cancelled");
  if (!expected || !code || !safeEqual(state, expected)) return back("invalid");
  try {
    const t = await exchangeCode(code);
    await saveConnection(t.refreshToken, t.email, viewer.accountId);
    await logActivity({ accountId: viewer.accountId, action: "drive.connected", summary: `Connected Google Drive (${t.email ?? "unknown"})` });
    return back("connected");
  } catch (e) {
    console.error("[drive] callback failed", e);
    return back("failed");
  }
}
