import { createHash } from "node:crypto";
import type { Table } from "./schema";
export type MigrationManifest = {
  id: string;
  tables: Table[];
  manifest?: Table | Table[];
};
export type MigrationReceipt = {
  checksum: string;
  status: string;
  checkpoint?: string;
};
export const checksumManifest = (tables: Table | Table[]) =>
  createHash("sha256").update(JSON.stringify(tables)).digest("hex");
/** Reject drift and incomplete history before deciding which additive migrations run. */
export function pendingMigrations(
  manifests: MigrationManifest[],
  receipts: ReadonlyMap<string, MigrationReceipt | null>,
): MigrationManifest[] {
  let pending = false;
  const selected: MigrationManifest[] = [];
  for (const manifest of manifests) {
    const receipt = receipts.get(manifest.id);
    const expected = checksumManifest(manifest.manifest ?? manifest.tables);
    if (receipt) {
      if (receipt.checksum !== expected || receipt.status !== "applied")
        throw new Error(
          `Migration receipt drift or incomplete state: ${manifest.id}`,
        );
      if (pending)
        throw new Error(
          `Migration history has a gap before applied receipt: ${manifest.id}`,
        );
      continue;
    }
    pending = true;
    selected.push(manifest);
  }
  return selected;
}
