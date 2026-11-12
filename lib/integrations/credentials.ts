import { assertCredentialExecution } from "../data/credential-execution";
import type { Provider } from "../workspaces/types";
import type { Credentials } from "./providers";
import { object, StoredDataError } from "../data/model";
import { decrypt, encrypt } from "./crypto";
const allowed: Record<Provider, string[]> = {
  gmail: ["accessToken", "refreshToken", "expiresAt"],
  slack: ["accessToken", "refreshToken", "expiresAt", "webhookUrl"],
  paypal: ["clientId", "clientSecret"],
};
export function validateCredentials(
  provider: Provider,
  value: unknown,
): Credentials {
  const p = object(value),
    output: Record<string, unknown> = {};
  if (Object.keys(p).some((key) => !allowed[provider].includes(key)))
    throw new StoredDataError();
  for (const key of allowed[provider]) {
    const v = p[key];
    if (v === undefined) continue;
    if (key === "expiresAt") {
      if (
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v <= 0 ||
        v > 8640000000000000
      )
        throw new StoredDataError();
    } else if (
      typeof v !== "string" ||
      !v ||
      v.length > 12000 ||
      /[\u0000-\u0020\u007f]/.test(v)
    )
      throw new StoredDataError();
    output[key] = v;
  }
  if (
    provider === "paypal"
      ? !output.clientId ||
        !output.clientSecret ||
        String(output.clientId).includes(":")
      : !output.accessToken
  )
    throw new StoredDataError();
  if (provider === "gmail" && !output.refreshToken) throw new StoredDataError();
  if (output.webhookUrl) {
    let url;
    try {
      url = new URL(String(output.webhookUrl));
    } catch {
      throw new StoredDataError();
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== "hooks.slack.com" ||
      !url.pathname.startsWith("/services/") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.port
    )
      throw new StoredDataError();
  }
  return output;
}
export const sealCredentials = (
  workspaceId: string,
  provider: Provider,
  value: unknown,
) =>
  encrypt(validateCredentials(provider, value), `${workspaceId}:${provider}`);
/** Call only after current execution authorization; never use for UI summaries. */
const decodeCredentials = (
  workspaceId: string,
  provider: Provider,
  envelope: string,
) =>
  validateCredentials(
    provider,
    decrypt<unknown>(envelope, `${workspaceId}:${provider}`),
  );

export function openCredentials(
  workspaceId: string,
  provider: Provider,
  envelope: string,
) {
  assertCredentialExecution();
  return decodeCredentials(workspaceId, provider, envelope);
}
