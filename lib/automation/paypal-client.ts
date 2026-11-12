import { Client, Environment, ApiError } from "@paypal/paypal-server-sdk";
import type { OAuthToken } from "@paypal/paypal-server-sdk";
import { createHash } from "node:crypto";
import { assertCredentialExecution } from "../data/credential-execution";
import { InputError } from "../workspaces/validation";
// The selected PayPal plugin's 2.5.0 SDK covers OAuth, orders and payments,
// but has no invoicing or webhook-verification controller. Those use REST with
// the SDK's authenticated token and the official Invoicing v2 contract.
const clients = new Map<string, Client>();
const tokens = new Map<string, OAuthToken>();
export const paypalBase = "https://api-m.sandbox.paypal.com";
export async function paypalToken(clientId: string, clientSecret: string) {
  assertCredentialExecution();
  if (process.env.ASSENTPAY_SIMULATION === "true") throw new InputError("PayPal SDK simulation transport is not configured; provider calls are disabled.", 503);
  const key = createHash("sha256").update(clientId).update("\0").update(clientSecret).digest("hex");
  let client = clients.get(key);
  if (!client) {
    client = new Client({ environment: Environment.Sandbox, timeout: 15000,
      clientCredentialsAuthCredentials: { oAuthClientId: clientId, oAuthClientSecret: clientSecret },
      httpClientOptions: { retryConfig: { maxNumberOfRetries: 0 } },
    });
    if (clients.size >= 50) { const oldest = clients.keys().next().value!; clients.delete(oldest); tokens.delete(oldest); }
    clients.set(key, client);
  }
  try { const token = await client.clientCredentialsAuthManager.updateToken(tokens.get(key)); tokens.set(key, token); return token.accessToken; }
  catch (e) { if (e instanceof ApiError) throw new InputError("PayPal authentication unavailable.", [400, 401, 403].includes(e.statusCode) ? 403 : 503); throw new Error("PayPal token exchange unavailable"); }
}
