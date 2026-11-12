import { paypalApplicationIdentity } from './paypal-identity';
import { AuthConfigurationError } from "@/lib/errors";
import { InputError } from "@/lib/workspaces/validation";
import { assertEncryption } from "./crypto";
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;
export function hasGmailScopes(scope: string | undefined) {
  const granted = new Set(scope?.split(" ") || []);
  return GMAIL_SCOPES.every((required) => granted.has(required));
}
const slackOwnerLookupScopes = ["users:read", "users:read.email"] as const;

export function slackBotScopes(destination = process.env.SLACK_REVIEW_DESTINATION || "owner_dm") {
  const base = ["chat:write", "incoming-webhook"];
  // Slack requires the email scope to be requested together with users:read.
  return destination === "owner_dm" ? [...base, ...slackOwnerLookupScopes] : base;
}

export function hasSlackOwnerLookupScopes(scopes: string) {
  const granted = new Set(scopes.split(",").map(scope => scope.trim()));
  return slackOwnerLookupScopes.every(scope => granted.has(scope));
}
export type Credentials = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  clientId?: string;
  clientSecret?: string;
  webhookUrl?: string;
};
function base(
  provider: "google" | "gmail" | "slack" | "paypal",
  fallback: string,
) {
  const override = process.env[`SIMULATION_${provider.toUpperCase()}_URL`];
  if (
    override &&
    process.env.ASSENTPAY_SIMULATION === "true" &&
    process.env.NODE_ENV !== "production" &&
    !process.env.APPWRITE_FUNCTION_ID
  )
    return override;
  return fallback;
}
async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  invalidCredentials?: string,
) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok)
    throw new InputError(
      invalidCredentials && [400, 401].includes(response.status)
        ? invalidCredentials
        : response.status === 429
          ? "The provider is rate limiting requests. Wait a moment and try again."
          : "The provider could not verify this connection. Check permissions and try again.",
      invalidCredentials && [400, 401].includes(response.status) ? 400 : 502,
    );
  return (await response.json()) as T;
}
function required(name: string) {
  const value = process.env[name];
  if (!value)
    throw new AuthConfigurationError(
      `Set ${name} before connecting this integration.`,
    );
  return value;
}
export function oauthCredentials(provider: "gmail" | "slack") {
  return provider === "gmail"
    ? {
        clientId: required("GMAIL_CLIENT_ID"),
        clientSecret: required("GMAIL_CLIENT_SECRET"),
      }
    : {
        clientId: required("SLACK_CLIENT_ID"),
        clientSecret: required("SLACK_CLIENT_SECRET"),
      };
}
export function providerReady(provider: "gmail" | "slack" | "paypal") {
  try {
    assertEncryption();
  } catch {
    return false;
  }
  return (
    provider === "paypal" ||
    (provider === "gmail"
      ? Boolean(process.env.GMAIL_OAUTH_ENABLED === "true" && process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET)
      : Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET))
  );
}
function form(body: Record<string, string>): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  };
}
export async function gmailExchange(
  code: string,
  redirectUri: string,
  verifier: string,
) {
  const { clientId, clientSecret } = oauthCredentials("gmail");
  const token = await requestJson<{
    access_token: string;
    refresh_token?: string;
    scope: string;
    expires_in: number;
  }>(
    `${base("google", "https://oauth2.googleapis.com")}/token`,
    form({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      grant_type: "authorization_code",
    }),
  );
  if (
    !hasGmailScopes(token.scope) ||
    !token.access_token ||
    !token.refresh_token
  )
    throw new InputError(
      "Grant Gmail read and offline access, then connect again.",
    );
  const profile = await gmailProfile(token.access_token);
  return {
    label: profile.emailAddress,
    externalId: profile.emailAddress,
    scopes: token.scope,
    credentials: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    },
  };
}
export async function gmailProfile(accessToken: string) {
  const result = await requestJson<{ emailAddress: string }>(
    `${base("gmail", "https://gmail.googleapis.com")}/gmail/v1/users/me/profile`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!result.emailAddress)
    throw new InputError("Gmail did not return a mailbox identity.", 502);
  return result;
}
export async function refreshGmail(
  credentials: Credentials,
): Promise<Credentials> {
  const { clientId, clientSecret } = oauthCredentials("gmail");
  if (!credentials.refreshToken)
    throw new InputError("Reconnect Gmail to grant offline access.");
  const token = await requestJson<{ access_token: string; expires_in: number }>(
    `${base("google", "https://oauth2.googleapis.com")}/token`,
    form({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    }),
  );
  if (!token.access_token) throw new InputError("Reconnect Gmail.");
  return {
    ...credentials,
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };
}
type SlackToken = {
  ok: boolean;
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope: string;
  team?: { id: string; name: string };
  incoming_webhook?: { url: string; channel: string; channel_id: string };
};
export async function slackExchange(code: string, redirectUri: string) {
  const { clientId, clientSecret } = oauthCredentials("slack");
  const token = await requestJson<SlackToken>(
    `${base("slack", "https://slack.com")}/api/oauth.v2.access`,
    form({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  );
  if (
    !token.ok ||
    !token.access_token ||
    !token.team?.id ||
    !token.incoming_webhook?.channel_id ||
    !slackBotScopes().every((scope) => token.scope?.split(",").map(value => value.trim()).includes(scope))
  )
    throw new InputError(
      "Grant the requested Slack permissions and select a channel.",
    );
  return {
    label: token.team.name,
    externalId: token.team.id,
    channel: token.incoming_webhook.channel,
    channelId: token.incoming_webhook.channel_id,
    scopes: token.scope,
    credentials: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_in
        ? Date.now() + token.expires_in * 1000
        : undefined,
      webhookUrl: token.incoming_webhook.url,
    },
  };
}
export async function refreshSlack(credentials: Credentials) {
  let current = credentials;
  if (current.expiresAt && current.expiresAt < Date.now() + 60000) {
    const { clientId, clientSecret } = oauthCredentials("slack");
    if (!current.refreshToken) throw new InputError("Reconnect Slack.");
    const token = await requestJson<SlackToken>(
      `${base("slack", "https://slack.com")}/api/oauth.v2.access`,
      form({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: current.refreshToken,
      }),
    );
    if (!token.ok || !token.access_token || !token.refresh_token)
      throw new InputError("Reconnect Slack.");
    current = {
      ...current,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + (token.expires_in || 43200) * 1000,
    };
  }
  return current;
}
export async function slackHealth(credentials: Credentials) {
  const current = await refreshSlack(credentials);
  const result = await requestJson<{ ok: boolean }>(
    `${base("slack", "https://slack.com")}/api/auth.test`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${current.accessToken}` },
    },
  );
  if (!result.ok) throw new InputError("Reconnect Slack to restore access.");
  return current;
}
export async function paypalVerify(clientId: string, clientSecret: string): Promise<{ applicationIdentity: string; merchantIdentityVerified: false }> {
  const { paypalBase, paypalToken } = await import("../automation/paypal-client");
  const token = await paypalToken(clientId, clientSecret);
  const response = await fetch(`${paypalBase}/v2/invoicing/invoices?page_size=1`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  await response.body?.cancel();
  if (!response.ok) throw new InputError(
    "PayPal sandbox Invoicing API access could not be verified. Check the REST app's Invoicing permissions.",
    [401, 403].includes(response.status) ? 403 : 503,
  );
  return { applicationIdentity: paypalApplicationIdentity(clientId), merchantIdentityVerified: false };
}
