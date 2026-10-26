import { InputError } from "../workspaces/validation";
export class GmailError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter = 0,
  ) {
    super(`Gmail request failed (${status}).`);
  }
}
function gmailBase() {
  return process.env.ASSENTPAY_SIMULATION === "true" &&
    process.env.NODE_ENV !== "production" &&
    !process.env.APPWRITE_FUNCTION_ID &&
    process.env.SIMULATION_GMAIL_URL
    ? process.env.SIMULATION_GMAIL_URL
    : "https://gmail.googleapis.com";
}
export async function gmailRequest<T>(
  token: string,
  path: string,
  query: Record<string, string> = {},
  body?: unknown,
): Promise<T> {
  const url = new URL(`${gmailBase()}/gmail/v1/users/me/${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok)
    throw new GmailError(
      response.status,
      Math.min(3600, Number(response.headers.get("retry-after")) || 0),
    );
  // Gmail full messages are bounded by provider limits; refuse oversized responses.
  const reader = response.body?.getReader();
  if (!reader) throw new InputError("Gmail returned an empty response.", 502);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 8 * 1024 * 1024) {
        await reader.cancel();
        throw new InputError("Gmail response exceeds the import limit.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}
export type MessagePart = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: MessagePart[];
};
export type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  historyId?: string;
  internalDate: string;
  labelIds?: string[];
  payload?: MessagePart;
};
export const header = (m: GmailMessage, name: string) =>
  (
    m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())
      ?.value || ""
  ).replace(/[\u0000-\u001f\u007f]/g, " ");
export function messageText(part?: MessagePart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data)
    return Buffer.from(part.body.data, "base64url")
      .toString("utf8")
      .slice(0, 48000);
  return (part.parts || [])
    .map(messageText)
    .filter(Boolean)
    .join("\n")
    .slice(0, 48000);
}
export function attachments(part?: MessagePart): MessagePart[] {
  if (!part) return [];
  return [
    ...(part.filename && part.body?.attachmentId ? [part] : []),
    ...(part.parts || []).flatMap(attachments),
  ].slice(0, 50);
}
export function emailAddress(value: string) {
  const match = value.match(
    /<?([A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/i,
  );
  return match?.[1]?.toLowerCase().slice(0, 320) || null;
}
export const financialIntent = (text: string) =>
  /\b(invoice|quotation|quote|payment|purchase order|contract|agreement|refund|installment|milestone|receipt|pricing)\b/i.test(
    text,
  );
