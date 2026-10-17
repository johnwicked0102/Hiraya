import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { api } from "@/lib/http";
import { authorizationUrl } from "@/lib/drive";
import { randomToken } from "@/lib/crypto";

export const GET = api({ level: "admin" }, async () => {
  const state = randomToken(24);
  (await cookies()).set("hiraya_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/drive",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizationUrl(state));
});
