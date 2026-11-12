// Operator-only recovery files. Ciphertext and identities never go to console output.
import { mkdir, readFile, writeFile, readdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import { createDecipheriv } from "node:crypto";
import { encrypt, decrypt } from "../integrations/crypto";
import type { LegacyRow } from "./backfill";
export type RecoverySnapshot = {
  projectId: string;
  databaseId: string;
  createdAt: string;
  rows: LegacyRow[];
  teams: { $id: string }[];
  [key: string]: unknown;
};
export async function saveSnapshot(snapshot: RecoverySnapshot) {
  await mkdir(".local-backups", { recursive: true, mode: 0o700 });
  await chmod(".local-backups", 0o700);
  const path = join(".local-backups", `cutover-${Date.now()}.enc`);
  await writeFile(
    path,
    encrypt(snapshot, `recovery:${snapshot.projectId}:${snapshot.databaseId}`),
    { mode: 0o600, flag: "wx" },
  );
  return path;
}
export async function recoverySources(projectId: string, databaseId: string) {
  const sources: LegacyRow[] = [];
  let files: string[];
  try {
    files = await readdir(".local-backups");
  } catch {
    return sources;
  }
  for (const file of files.filter((name) => name.endsWith(".enc")).sort()) {
    try {
      const raw = await readFile(join(".local-backups", file), "utf8");
      let snapshot: RecoverySnapshot;
      if (raw.startsWith("v2.") || raw.startsWith("v1."))
        snapshot = decrypt<RecoverySnapshot>(
          raw,
          `recovery:${projectId}:${databaseId}`,
        );
      else {
        // Original audit snapshot format, retained without rewriting it.
        const box = JSON.parse(raw),
          key = process.env.INTEGRATION_ENCRYPTION_KEY;
        if (!key || typeof box.context !== "string") throw new Error();
        const decipher = createDecipheriv(
          "aes-256-gcm",
          Buffer.from(key, "hex"),
          Buffer.from(box.iv, "base64url"),
        );
        decipher.setAAD(Buffer.from(box.context));
        decipher.setAuthTag(Buffer.from(box.tag, "base64url"));
        snapshot = JSON.parse(
          Buffer.concat([
            decipher.update(Buffer.from(box.data, "base64url")),
            decipher.final(),
          ]).toString(),
        );
      }
      if (
        snapshot.projectId === projectId &&
        snapshot.databaseId === databaseId &&
        Array.isArray(snapshot.rows)
      )
        sources.push(...snapshot.rows);
    } catch {
      throw new Error(
        "A recovery snapshot could not be authenticated. Restore its original key before reconciling.",
      );
    }
  }
  return sources;
}
