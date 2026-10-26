import { AuthConfigurationError } from "../errors";
/** Shared by web repositories and workers. No secret is included in errors. */
export function dataApiKey() {
  const key = process.env.APPWRITE_DATA_API_KEY;
  const resolved = key || process.env.APPWRITE_API_KEY;
  if (!resolved)
    throw new AuthConfigurationError("Appwrite data access is not configured.");
  return resolved;
}
