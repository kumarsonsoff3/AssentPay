import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createAccount, saveSession } from "@/lib/auth/appwrite";
import { authConfig, OAUTH_COOKIE } from "@/lib/auth/config";
import { validToken } from "@/lib/auth/validation";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const config = authConfig();
  const params = request.nextUrl.searchParams;
  const expected = cookieStore.get(OAUTH_COOKIE)?.value;
  cookieStore.delete(OAUTH_COOKIE);
  const state = params.get("state") || "";
  const userId = params.get("userId") || "",
    secret = params.get("secret") || "";
  let destination = "/sign-in?oauth=failed";
  if (
    expected &&
    /^[a-f0-9]{64}$/.test(state) &&
    state.length === expected.length &&
    timingSafeEqual(Buffer.from(state), Buffer.from(expected)) &&
    !params.has("failure") &&
    validToken(userId, secret)
  ) {
    try {
      const session = await createAccount(undefined, true).createSession({
        userId,
        secret,
      });
      await saveSession(session);
      const user = await createAccount(session.secret).get();
      destination = user.emailVerification ? "/dashboard" : "/verify-email";
    } catch {
      /* Tokens are single use; offer a fresh sign-in on failure. */
    }
  }
  const response = NextResponse.redirect(
    new URL(destination, config.origin),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
