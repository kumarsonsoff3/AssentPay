import { parseProfile, validId } from "../workspaces/validation";
import {
  isProvider,
  type BusinessProfile,
  type Provider,
} from "../workspaces/types";
import type { IntegrationRecord } from "../integrations/records";
import { envelopeKeyId } from "../integrations/crypto";

export type ProfileRecord = BusinessProfile & {
  profileSaved: boolean;
  onboardingComplete: boolean;
};
export type WorkspaceRow = Omit<
  ProfileRecord,
  "approvalThreshold" | "emailNotifications"
> & {
  schemaVersion: 1;
  revision: string;
  approvalThresholdMinor: string;
  currencyExponent: number;
  settingsJson: string;
};
export type IntegrationRow = Omit<
  IntegrationRecord,
  "credentials" | "version" | "scopes"
> & {
  workspaceId: string;
  schemaVersion: 1;
  connectionVersion: string;
  revision: string;
  scopes: string[];
  disconnectedAt?: string | null;
};
export type SecretRow = {
  workspaceId: string;
  provider: Provider;
  schemaVersion: 1;
  connectionVersion: string;
  revision: string;
  credentialEnvelope: "protected";
  protectedEnvelope: string;
  keyId: string;
};
export class StoredDataError extends Error {
  constructor() {
    super("Stored workspace data failed validation.");
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new StoredDataError();
  return value as Record<string, unknown>;
}
function string(value: unknown, max = 1024): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new StoredDataError();
}
export function parseStoredProfile(value: unknown): ProfileRecord {
  const p = object(value);
  string(p.industry, 128);
  // Unsaved workspaces intentionally have an empty industry.
  const profile = parseProfile({
    ...p,
    industry: p.industry || "Not specified",
  });
  if (
    typeof p.profileSaved !== "boolean" ||
    typeof p.onboardingComplete !== "boolean"
  )
    throw new StoredDataError();
  if (p.profileSaved && !p.industry) throw new StoredDataError();
  return {
    ...profile,
    industry: p.industry as string,
    profileSaved: p.profileSaved,
    onboardingComplete: p.onboardingComplete,
  };
}
export function parseIntegrationMetadata(
  value: unknown,
): Omit<IntegrationRecord, "credentials"> {
  const p = object(value);
  if (
    typeof p.provider !== "string" ||
    !isProvider(p.provider) ||
    !["connected", "needs_attention"].includes(String(p.status)) ||
    p.environment !== (p.provider === "paypal" ? "sandbox" : "production")
  )
    throw new StoredDataError();
  string(p.label, 320);
  string(p.scopes, 4096);
  if (typeof p.version !== "string" || !/^[a-f0-9]{32}$/.test(p.version))
    throw new StoredDataError();
  if (typeof p.connectedBy !== "string") throw new StoredDataError();
  validId(p.connectedBy);
  if (
    typeof p.checkedAt !== "string" ||
    !Number.isFinite(Date.parse(p.checkedAt))
  )
    throw new StoredDataError();
  for (const key of ["externalId", "channelId", "channel"] as const)
    if (p[key] !== undefined) string(p[key], 320);
  return {
    provider: p.provider,
    status: p.status as IntegrationRecord["status"],
    environment: p.environment as IntegrationRecord["environment"],
    label: p.label,
    scopes: p.scopes,
    connectedBy: p.connectedBy as string,
    version: p.version,
    checkedAt: p.checkedAt,
    ...(p.externalId === undefined
      ? {}
      : { externalId: p.externalId as string }),
    ...(p.channelId === undefined ? {} : { channelId: p.channelId as string }),
    ...(p.channel === undefined ? {} : { channel: p.channel as string }),
  };
}
export function parseStoredIntegration(value: unknown): IntegrationRecord {
  const p = object(value),
    metadata = parseIntegrationMetadata(p);
  string(p.credentials, 32000);
  try {
    envelopeKeyId(p.credentials);
  } catch {
    throw new StoredDataError();
  }
  return { ...metadata, credentials: p.credentials };
}
export function profileToRow(
  profile: ProfileRecord,
  revision: string,
): WorkspaceRow {
  const p = parseStoredProfile(profile);
  const exponent = new Intl.NumberFormat("en", {
    style: "currency",
    currency: p.currency,
  }).resolvedOptions().maximumFractionDigits!;
  // Existing API is limited to two decimals. Refuse currencies that cannot
  // represent the saved value, rather than quietly changing a business rule.
  const scaled = p.approvalThreshold * 10 ** exponent;
  if (
    Math.abs(scaled - Math.round(scaled)) > 0.00001 ||
    !Number.isSafeInteger(Math.round(scaled))
  )
    throw new StoredDataError();
  const { approvalThreshold: _threshold, emailNotifications, ...fields } = p;
  void _threshold;
  return {
    ...fields,
    schemaVersion: 1,
    revision,
    approvalThresholdMinor: String(Math.round(scaled)),
    currencyExponent: exponent,
    settingsJson: JSON.stringify({ emailNotifications }),
  };
}
export function profileFromRow(value: unknown): ProfileRecord {
  const p = object(value);
  if (
    p.schemaVersion !== 1 ||
    typeof p.approvalThresholdMinor !== "string" ||
    !/^\d{1,16}$/.test(p.approvalThresholdMinor) ||
    !Number.isInteger(p.currencyExponent) ||
    Number(p.currencyExponent) < 0 ||
    Number(p.currencyExponent) > 4 ||
    !Number.isSafeInteger(Number(p.approvalThresholdMinor))
  )
    throw new StoredDataError();
  const settings = object(JSON.parse(String(p.settingsJson)));
  const profile = parseStoredProfile({
    ...p,
    approvalThreshold:
      Number(p.approvalThresholdMinor) / 10 ** Number(p.currencyExponent),
    emailNotifications: settings.emailNotifications,
  });
  const canonical = profileToRow(profile, "validation");
  if (
    canonical.currencyExponent !== p.currencyExponent ||
    canonical.approvalThresholdMinor !== p.approvalThresholdMinor
  )
    throw new StoredDataError();
  return profile;
}
