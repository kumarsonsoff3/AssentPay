import { createHash } from "node:crypto";
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const recordId = (kind: string, ...parts: string[]) =>
  `${kind}_${hash(JSON.stringify(parts)).slice(0, 32)}`;
