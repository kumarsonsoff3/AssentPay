import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AuthConfigurationError } from "@/lib/errors";
const keyName = /^[A-Za-z0-9_-]{1,32}$/;
const hexKey = /^[a-fA-F0-9]{64}$/;
function keys() {
  const legacy = process.env.INTEGRATION_ENCRYPTION_KEY;
  const active = process.env.INTEGRATION_ENCRYPTION_KEY_ID || "primary";
  let ring: Record<string, unknown> = {};
  try {
    if (process.env.INTEGRATION_ENCRYPTION_KEYS)
      ring = JSON.parse(process.env.INTEGRATION_ENCRYPTION_KEYS);
    if (
      !ring ||
      Array.isArray(ring) ||
      typeof ring !== "object" ||
      !keyName.test(active) ||
      active === "legacy-v1" ||
      Object.entries(ring).some(
        ([id, value]) =>
          !keyName.test(id) ||
          id === "legacy-v1" ||
          typeof value !== "string" ||
          !hexKey.test(value),
      ) ||
      (legacy !== undefined && !hexKey.test(legacy))
    )
      throw new Error();
    const selected = ring[active] ?? legacy;
    if (typeof selected !== "string" || !hexKey.test(selected))
      throw new Error();
    return {
      active,
      ring: {
        ...ring,
        [active]: selected,
        ...(legacy ? { "legacy-v1": legacy } : {}),
      } as Record<string, string>,
    };
  } catch {
    throw new AuthConfigurationError(
      "Integration encryption key configuration is invalid or missing.",
    );
  }
}
export function assertEncryption() {
  keys();
}
export function envelopeKeyId(value: string) {
  if (typeof value !== "string" || value.length > 48000)
    throw new Error("Invalid credential envelope");
  const parts = value.split(".");
  if (
    parts[0] === "v1" &&
    parts.length === 4 &&
    /^[A-Za-z0-9_-]{16}$/.test(parts[1]) &&
    /^[A-Za-z0-9_-]{22}$/.test(parts[2]) &&
    /^[A-Za-z0-9_-]+$/.test(parts[3])
  )
    return "legacy-v1";
  if (
    parts[0] === "v2" &&
    parts.length === 5 &&
    keyName.test(parts[1]) &&
    parts[1] !== "legacy-v1" &&
    /^[A-Za-z0-9_-]{16}$/.test(parts[2]) &&
    /^[A-Za-z0-9_-]{22}$/.test(parts[3]) &&
    /^[A-Za-z0-9_-]+$/.test(parts[4])
  )
    return parts[1];
  throw new Error("Invalid credential envelope");
}
export function encrypt(value: unknown, context: string) {
  const configured = keys(),
    id = configured.active,
    iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(configured.ring[id], "hex"),
    iv,
  );
  cipher.setAAD(Buffer.from(`v2:${id}:${context}`));
  const serialized = JSON.stringify(value);
  if (!serialized || Buffer.byteLength(serialized) > 32000)
    throw new Error("Credential data is invalid or too large");
  const data = Buffer.concat([
    cipher.update(serialized, "utf8"),
    cipher.final(),
  ]);
  return [
    "v2",
    id,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}
export function decrypt<T>(value: string, context: string): T {
  const id = envelopeKeyId(value),
    configured = keys();
  const material = configured.ring[id];
  if (!material) throw new Error("Credential key is unavailable");
  const parts = value.split("."),
    modern = parts[0] === "v2";
  const [iv, tag, data] = parts.slice(modern ? 2 : 1);
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(material, "hex"),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAAD(Buffer.from(modern ? `v2:${id}:${context}` : context));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(data, "base64url")),
        decipher.final(),
      ]).toString("utf8"),
    ) as T;
  } catch {
    throw new Error("Credential authentication failed");
  }
}
