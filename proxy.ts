import { NextResponse, type NextRequest } from "next/server";
import { canonicalPageUrl, stripCredentialQuery } from "./lib/auth/origin";
export function proxy(request: NextRequest) {
  const configured = process.env.APP_URL;
  if (!configured || !["GET", "HEAD"].includes(request.method))
    return NextResponse.next();
  const sanitized = request.nextUrl.clone();
  const hadCredentials = stripCredentialQuery(sanitized);
  const destination =
    canonicalPageUrl(
      sanitized.toString(),
      request.headers.get("host"),
      configured,
    ) ||
    (hadCredentials
      ? new URL(
          sanitized.pathname + sanitized.search,
          new URL(configured).origin,
        )
      : null);
  if (!destination) return NextResponse.next();
  const response = NextResponse.redirect(destination, 307);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export const config = {
  matcher: [
    "/",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/email-verification",
    "/dashboard/:path*",
    "/account/:path*",
    "/onboarding",
    "/workspaces/:path*",
    "/invitations/:path*",
  ],
};
