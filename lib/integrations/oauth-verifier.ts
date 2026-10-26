import { encrypt, decrypt } from "./crypto";
const context = (id: string, workspaceId: string, provider: string) =>
  `oauth:${id}:${workspaceId}:${provider}`;
export function protectVerifier(
  verifier: string,
  id: string,
  workspaceId: string,
  provider: string,
) {
  return encrypt({ verifier }, context(id, workspaceId, provider));
}
export function resolveVerifier(
  value: string,
  id: string,
  workspaceId: string,
  provider: string,
) {
  // Legacy values are only read for already-issued, expiring callbacks.
  if (!value.startsWith("v1.") && !value.startsWith("v2.")) {
    if (!/^[A-Za-z0-9_-]{64}$/.test(value))
      throw new Error("Invalid connection request.");
    return value;
  }
  const decoded = decrypt<{ verifier: string }>(
    value,
    context(id, workspaceId, provider),
  );
  if (
    typeof decoded.verifier !== "string" ||
    !/^[A-Za-z0-9_-]{64}$/.test(decoded.verifier)
  )
    throw new Error("Invalid connection request.");
  return decoded.verifier;
}
