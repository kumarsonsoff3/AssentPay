import type { BusinessProfile, WorkspaceRole } from "./types";
export class InputError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: string,
    public redirect?: string,
  ) {
    super(message);
  }
}
export function text(
  input: Record<string, unknown>,
  key: string,
  max = 128,
  required = true,
) {
  const value = typeof input[key] === "string" ? input[key].trim() : "";
  if (
    (required && !value) ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new InputError(
      `Enter a valid ${key.replace(/([A-Z])/g, " $1").toLowerCase()}.`,
    );
  return value;
}
export function validId(value: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(value))
    throw new InputError("Invalid workspace or invitation.");
  return value;
}
export function assignableRole(
  value: unknown,
): Exclude<WorkspaceRole, "owner"> {
  if (value !== "admin" && value !== "member" && value !== "viewer")
    throw new InputError("Choose admin, member, or viewer.");
  return value;
}
export function effectiveRole(roles: string[]): WorkspaceRole {
  if (roles.includes("owner")) return "owner";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("member")) return "member";
  if (roles.includes("viewer")) return "viewer";
  throw new InputError("Your workspace membership has no recognized role.", 403);
}
export function parseProfile(input: Record<string, unknown>): BusinessProfile {
  const businessName = text(input, "businessName"),
    website = text(input, "website", 512, false),
    industry = text(input, "industry", 128);
  if (website) {
    try {
      const url = new URL(website);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error();
    } catch {
      throw new InputError("Enter a valid business website URL.");
    }
  }
  const country = text(input, "country", 2).toUpperCase(),
    currency = text(input, "currency", 3).toUpperCase(),
    timezone = text(input, "timezone", 64);
  if (!/^[A-Z]{2}$/.test(country))
    throw new InputError("Choose a two-letter country code.");
  if (!Intl.supportedValuesOf("currency").includes(currency))
    throw new InputError("Choose a supported currency.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw new InputError("Choose a valid timezone.");
  }
  if (
    typeof input.approvalThreshold !== "number" ||
    !Number.isFinite(input.approvalThreshold) ||
    input.approvalThreshold < 0 ||
    input.approvalThreshold > 1e9
  )
    throw new InputError(
      "Enter an approval threshold between 0 and 1,000,000,000.",
    );
  if (typeof input.emailNotifications !== "boolean")
    throw new InputError("Choose your notification preference.");
  return {
    businessName,
    website,
    industry,
    country,
    currency,
    timezone,
    approvalThreshold: Math.round(input.approvalThreshold * 100) / 100,
    emailNotifications: input.emailNotifications,
  };
}
