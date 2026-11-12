import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { authConfig, SESSION_COOKIE } from "@/lib/auth/config";
import { recordId, hash } from "@/lib/workspaces/ids";
import { withStorageOperation } from "@/lib/data/coordinator";
import { workspaceAccess, workspaceStore } from "@/lib/workspaces/server";
import { InputError } from "@/lib/workspaces/validation";
import { invokeIntegrationFunction } from "./function-client";
import { GMAIL_SCOPES, slackBotScopes } from "./providers";
export type { IntegrationRecord } from "./records";
export { connectionId } from "./records";
export type OAuthState = {
  workspaceId: string;
  userId: string;
  provider: "gmail" | "slack";
  browserHash: string;
  sessionHash: string;
  verifier: string;
  expiresAt: number;
};

export async function integrationSummaries(
  workspaceId: string,
  userId: string,
) {
  return workspaceStore(userId).summaries(workspaceId);
}
function stateCookie(provider: string) {
  return `assentpay-connect-${provider}`;
}
export async function beginOAuth(
  workspaceId: string,
  userId: string,
  provider: "gmail" | "slack",
) {
  return withStorageOperation("mutation", async () => {
    await workspaceAccess(workspaceId, userId, ["owner", "admin"]);
    if (provider === "gmail" && process.env.GMAIL_OAUTH_ENABLED !== "true") throw new InputError("Gmail OAuth is restricted to controlled deployments. Use workspace email forwarding.", 403);
    const clientId =
      process.env[provider === "gmail" ? "GMAIL_CLIENT_ID" : "SLACK_CLIENT_ID"];
    if (!clientId)
      throw new InputError(
        "Configure this integration before connecting.",
        503,
      );
    const { origin, secure } = authConfig();
    if (provider === "slack" && !secure)
      throw new InputError(
        "Slack requires HTTPS. Configure APP_URL with your HTTPS development URL first.",
      );
    const state = randomBytes(32).toString("hex"),
      browser = randomBytes(32).toString("hex"),
      stateId = recordId("o", state);
    const cookieStore = await cookies();
    const result = await invokeIntegrationFunction({
      action: "oauth-begin",
      stateId,
      workspaceId,
      requestedBy: userId,
      provider,
      browserHash: hash(browser),
      sessionHash: hash(cookieStore.get(SESSION_COOKIE)?.value || ""),
    });
    cookieStore.set(stateCookie(provider), JSON.stringify({ state, browser }), {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    const redirectUri = `${origin}/api/integrations/${provider}/callback`;
    const url = new URL(
      provider === "gmail"
        ? "https://accounts.google.com/o/oauth2/v2/auth"
        : "https://slack.com/oauth/v2/authorize",
    );
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope:
        provider === "gmail" ? GMAIL_SCOPES.join(" ") : slackBotScopes().join(","),
      ...(provider === "gmail"
        ? {
            response_type: "code",
            access_type: "offline",
            prompt: "consent",
            code_challenge: result.codeChallenge!,
            code_challenge_method: "S256",
          }
        : {}),
    }).toString();
    return url.toString();
  });
}
export async function completeOAuth(
  state: string,
  provider: "gmail" | "slack",
  userId: string,
  code: string | null,
  cancelled: boolean,
) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(stateCookie(provider))?.value;
  cookieStore.delete(stateCookie(provider));
  if (!/^[a-f0-9]{64}$/.test(state) || !raw)
    throw new InputError("This connection request has expired. Start again.");
  const browser = JSON.parse(raw) as { state: string; browser: string };
  if (
    typeof browser.state !== "string" ||
    browser.state.length !== state.length ||
    !timingSafeEqual(Buffer.from(browser.state), Buffer.from(state)) ||
    typeof browser.browser !== "string"
  )
    throw new InputError("Invalid connection request.");
  return invokeIntegrationFunction({
    action: "oauth-complete",
    stateId: recordId("o", state),
    requestedBy: userId,
    provider,
    browserHash: hash(browser.browser),
    sessionHash: hash(cookieStore.get(SESSION_COOKIE)?.value || ""),
    cancelled,
    ...(cancelled ? {} : { code: code || "" }),
  });
}
