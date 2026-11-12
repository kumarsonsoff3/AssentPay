import "server-only";

import { AuthConfigurationError } from "@/lib/errors";
export { AuthConfigurationError } from "@/lib/errors";

export function authConfig() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const project = process.env.APPWRITE_PROJECT_ID;
  const key = process.env.APPWRITE_API_KEY;
  const appUrl = process.env.APP_URL;
  if (!endpoint || !project || !key || !appUrl) {
    throw new AuthConfigurationError(
      "Authentication is not configured yet. Please try again later.",
    );
  }
  const origin = new URL(appUrl);
  const api = new URL(endpoint);
  const local = (url: URL) => ["localhost", "127.0.0.1"].includes(url.hostname);
  if (
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password ||
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    (origin.protocol !== "https:" &&
      !(origin.protocol === "http:" && local(origin))) ||
    (api.protocol !== "https:" &&
      !(
        api.protocol === "http:" &&
        local(api) &&
        process.env.NODE_ENV !== "production"
      ))
  ) {
    throw new AuthConfigurationError(
      "Authentication configuration is invalid.",
    );
  }
  return {
    endpoint,
    project,
    key,
    origin: origin.origin,
    secure: origin.protocol === "https:",
  };
}

export const SESSION_COOKIE = "assentpay-session";
export const OAUTH_COOKIE = "assentpay-oauth-state";
