import { createHmac, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { InputError } from "../workspaces/validation";
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
export async function verifyGooglePush(request: Request) {
  const audience = process.env.GMAIL_PUSH_AUDIENCE,
    email = process.env.GMAIL_PUSH_SERVICE_ACCOUNT;
  if (!audience || !email || !process.env.GMAIL_PUSH_SUBSCRIPTION)
    throw new InputError("Gmail push authentication is not configured.", 503);
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ") || bearer.length > 8192)
    throw new InputError("Invalid push authentication.", 401);
  try {
    const { payload } = await jwtVerify(bearer.slice(7), googleKeys, {
      algorithms: ["RS256"],
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience,
      maxTokenAge: "1h",
    });
    if (payload.email !== email || payload.email_verified !== true)
      throw new Error();
  } catch {
    throw new InputError("Invalid push authentication.", 401);
  }
}
export function verifySlack(
  raw: string,
  timestamp: string | null,
  signature: string | null,
  secret = process.env.SLACK_SIGNING_SECRET,
  now = Date.now(),
) {
  if (!secret)
    throw new InputError("Slack event authentication is not configured.", 503);
  if (
    !timestamp ||
    !/^\d{10,12}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    !signature ||
    !/^v0=[a-f0-9]{64}$/.test(signature)
  )
    throw new InputError("Invalid Slack event signature.", 401);
  const expected = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${raw}`).digest("hex")}`;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature)))
    throw new InputError("Invalid Slack event signature.", 401);
}
export async function readWebhookText(request: Request, limit = 65536) {
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("Missing event body.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new InputError("Event is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
