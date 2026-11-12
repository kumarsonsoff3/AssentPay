import "server-only";
import { createHash } from "node:crypto";

// Per-process defense in depth. Production must also enforce a shared edge/WAF
// rate limit; API-key requests bypass Appwrite's native limits.
const windows = new Map<string, { count: number; expires: number }>();
const WINDOW_MS = 15 * 60 * 1000;

export function allowAuthRequest(
  action: string,
  identifier: string,
  limit = 10,
) {
  const now = Date.now();
  for (const [key, value] of windows)
    if (value.expires <= now) windows.delete(key);
  const key = createHash("sha256")
    .update(`${action}:${identifier}`)
    .digest("hex");
  const existing = windows.get(key);
  if (existing) return ++existing.count <= limit;
  if (windows.size >= 10000) return false;
  windows.set(key, { count: 1, expires: now + WINDOW_MS });
  return true;
}
