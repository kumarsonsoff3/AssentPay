import { isIP } from "node:net";

export function requestSource(headers: Headers) {
  // ngrok appends the actual client address. Earlier entries are supplied by
  // callers and must never become a rate-limit identity. The origin must remain
  // behind a trusted ingress; other proxy topologies need their own policy.
  const address = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return address && isIP(address) ? address.toLowerCase() : "unknown";
}
