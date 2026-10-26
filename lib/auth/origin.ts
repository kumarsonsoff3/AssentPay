import { InputError } from "../workspaces/validation";
export function assertAppOrigin(request: Request, configuredOrigin: string) {
  if (request.headers.get("origin") !== configuredOrigin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new InputError(
      `Open AssentPay at ${configuredOrigin} and sign in there to continue. This page is using a different address.`,
      403,
      "APP_ORIGIN_MISMATCH",
      `${configuredOrigin}/workspaces`,
    );
  }
}
export function stripCredentialQuery(url: URL) {
  if (
    !url.searchParams.has("password") &&
    !url.searchParams.has("confirmPassword")
  )
    return false;
  for (const key of ["password", "confirmPassword", "email", "name", "terms"])
    url.searchParams.delete(key);
  return true;
}
export function canonicalPageUrl(
  requestUrl: string,
  host: string | null,
  appUrl: string,
) {
  const canonical = new URL(appUrl),
    incoming = new URL(requestUrl);
  stripCredentialQuery(incoming);
  if (host?.toLowerCase() === canonical.host.toLowerCase()) return null;
  // Redirect local browser visits only. Never trust forwarded-host headers.
  if (
    !host ||
    !["localhost", "127.0.0.1", "[::1]"].some(
      (local) => host === local || host.startsWith(`${local}:`),
    )
  )
    return null;
  if (incoming.origin === canonical.origin) return null;
  return new URL(`${incoming.pathname}${incoming.search}`, canonical.origin);
}
