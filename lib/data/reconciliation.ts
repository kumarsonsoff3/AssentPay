import { createHash } from "node:crypto";
import { Query, type TablesDB, type Teams } from "node-appwrite";
import {
  mapLegacyRow,
  matchesTarget,
  type LegacyRow,
  type BackfillTarget,
} from "./backfill";
import { tables } from "./schema";
import { secretTables } from "./secret-schema";
import { recordId } from "../workspaces/ids";
import {
  decodeControl,
  CONTROL_ID,
  JOURNAL,
  type StorageCoordinator,
} from "./coordinator";
export const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function scanRows(
  db: TablesDB,
  databaseId: string,
  tableId: string,
  transactionId?: string,
) {
  const rows = [];
  let cursor: string | undefined;
  do {
    const page = await db.listRows({
      databaseId,
      tableId,
      transactionId,
      queries: [
        Query.orderAsc("$id"),
        Query.limit(100),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });
    rows.push(...page.rows);
    cursor = page.rows.length === 100 ? page.rows.at(-1)?.$id : undefined;
  } while (cursor);
  return rows;
}
export async function scanTeams(teams: Teams) {
  const rows = [];
  let cursor: string | undefined;
  do {
    const page = await teams.list({
      queries: [
        Query.orderAsc("$id"),
        Query.limit(100),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });
    rows.push(...page.teams);
    cursor = page.teams.length === 100 ? page.teams.at(-1)?.$id : undefined;
  } while (cursor);
  return rows;
}
function canonical(target: BackfillTarget) {
  const fields = [...secretTables, ...tables].find(
    (t) => t.id === target.tableId,
  )!.columns;
  const data = target.data as Record<string, unknown>;
  return {
    tableId: target.tableId,
    rowId: target.rowId,
    data: Object.fromEntries(
      fields.map((col) => {
        const value = data[col.key] ?? null;
        return [
          col.key,
          col.type === "datetime" && typeof value === "string"
            ? new Date(value).toISOString()
            : value,
        ];
      }),
    ),
  };
}
const fingerprint = (targets: BackfillTarget[]) =>
  hash(
    targets.map(canonical).sort((a, b) => a.tableId.localeCompare(b.tableId)),
  );
type Row = Record<string, unknown> & { $id: string };
type Entry = {
  sourceId: string;
  kind: "missing" | "unchanged" | "changed" | "deleted";
  digest: string;
  targets: BackfillTarget[];
  removeSecrets: boolean;
  markerChanged: boolean;
};
export async function reconciliationPlan(
  db: TablesDB,
  teams: Teams,
  databaseId: string,
  projectId: string,
  baseline: LegacyRow[],
  transactionId?: string,
) {
  const teamRows = await scanTeams(teams),
    teamIds = new Set(teamRows.map((t) => t.$id));
  const journal = await scanRows(db, databaseId, JOURNAL, transactionId);
  const controlRow = journal.find((r) => r.$id === CONTROL_ID);
  const control = controlRow
    ? decodeControl(controlRow)
    : {
        mode: "legacy",
        storage: "legacy",
        epoch: "uninitialized",
        activated: false,
      };
  if (control.activated || control.storage !== "legacy")
    throw new Error(
      "Legacy reconciliation is prohibited after normalized activation.",
    );
  const source = await scanRows(db, databaseId, "onboarding", transactionId);
  const targets: Record<string, Row[]> = {};
  for (const tableId of ["workspaces", "integrations", "integration_secrets"])
    targets[tableId] = await scanRows(db, databaseId, tableId, transactionId);
  const entries: Entry[] = [],
    seen = new Set<string>();
  const current = new Map(
    source.map((row) => [
      row.$id,
      {
        source: row,
        ...mapLegacyRow(row as unknown as LegacyRow, teamIds, true),
      },
    ]),
  );
  const markers = journal.filter((r) => r.$id.startsWith("b_"));
  const markerMap = new Map(
    markers.map((marker) => {
      const checkpoint = JSON.parse(marker.checkpoint);
      return [checkpoint.id as string, { marker, checkpoint }];
    }),
  );
  function existing(expected: BackfillTarget[]) {
    return expected.map((target) => {
      const row = targets[target.tableId].find((r) => r.$id === target.rowId);
      if (!row || !Array.isArray(row.$permissions) || row.$permissions.length)
        throw new Error(
          "Incomplete or unsafe shadow rows; no changes applied.",
        );
      seen.add(`${target.tableId}:${target.rowId}`);
      return { tableId: target.tableId, rowId: target.rowId, data: row };
    });
  }
  function prove(
    sourceId: string,
    marker: Row,
    checkpoint: Record<string, unknown>,
    actual: BackfillTarget[],
    same?: BackfillTarget[],
  ) {
    if (typeof checkpoint.t === "string") {
      if (fingerprint(actual) !== checkpoint.t)
        throw new Error("Shadow target drift detected.");
      return;
    }
    let previous = same;
    if (!previous) {
      const saved = baseline.find(
        (row) =>
          row.$id === sourceId &&
          mapLegacyRow(row, new Set([row.workspaceId])).digest ===
            marker.checksum,
      );
      if (saved)
        previous = mapLegacyRow(saved, new Set([saved.workspaceId])).targets;
    }
    if (
      !previous ||
      previous.length !== actual.length ||
      previous.some(
        (p) =>
          !matchesTarget(
            actual.find((a) => a.tableId === p.tableId)!.data as Record<
              string,
              unknown
            >,
            p.data,
          ),
      )
    )
      throw new Error(
        "Cannot prove shadow lineage. Supply the authentic pre-backfill recovery snapshot.",
      );
    if (fingerprint(previous) !== fingerprint(actual))
      throw new Error("Shadow target drift detected.");
  }
  for (const [id, mapped] of current) {
    if (!mapped.targets.length) continue;
    const owned = markerMap.get(id);
    if (!owned) {
      if (
        mapped.targets.some((t) =>
          targets[t.tableId].some((r) => r.$id === t.rowId),
        )
      )
        throw new Error("Unowned shadow target exists; refusing adoption.");
      for (const t of mapped.targets) seen.add(`${t.tableId}:${t.rowId}`);
      entries.push({
        sourceId: id,
        kind: "missing",
        digest: mapped.digest,
        targets: mapped.targets,
        removeSecrets: false,
        markerChanged: true,
      });
    } else {
      if (owned.marker.status !== "applied")
        throw new Error(
          "A deleted source reappeared; explicit reconciliation review is required.",
        );
      const actual = existing(mapped.targets),
        same = mapped.digest === owned.marker.checksum;
      prove(
        id,
        owned.marker,
        owned.checkpoint,
        actual,
        same
          ? mapLegacyRow(mapped.source as unknown as LegacyRow, teamIds).targets
          : undefined,
      );
      entries.push({
        sourceId: id,
        kind:
          same && fingerprint(actual) === fingerprint(mapped.targets)
            ? "unchanged"
            : "changed",
        digest: mapped.digest,
        targets: mapped.targets,
        removeSecrets: false,
        markerChanged:
          !same || owned.checkpoint.t !== fingerprint(mapped.targets),
      });
    }
  }
  for (const [id, owned] of markerMap) {
    if (current.has(id)) continue;
    if (!id.startsWith("i_"))
      throw new Error(
        "A workspace source was deleted; operator review is required.",
      );
    const meta = targets.integrations.find((r) => r.$id === id);
    if (!meta) throw new Error("Missing owned integration target.");
    const expected = [{ tableId: "integrations", rowId: id, data: meta }];
    if (owned.marker.status !== "deleted")
      expected.push({
        tableId: "integration_secrets",
        rowId: id,
        data: {} as Row,
      });
    const actual = existing(expected);
    prove(id, owned.marker, owned.checkpoint, actual);
    if (owned.marker.status === "deleted") {
      if (
        !meta.disconnectedAt ||
        targets.integration_secrets.some((r) => r.$id === id)
      )
        throw new Error("Disconnected shadow still has credentials.");
      entries.push({
        sourceId: id,
        kind: "unchanged",
        digest: String(owned.marker.checksum),
        targets: actual,
        removeSecrets: false,
        markerChanged: false,
      });
    } else {
      const revision = hash(["disconnected", owned.marker.checksum]).slice(
        0,
        32,
      );
      const data = {
        ...canonical(expected[0]).data,
        disconnectedAt: controlRow?.leaseUntil ?? owned.marker.$updatedAt,
        status: "needs_attention",
        revision,
        connectionVersion: revision,
      };
      entries.push({
        sourceId: id,
        kind: "deleted",
        digest: String(owned.marker.checksum),
        targets: [{ tableId: "integrations", rowId: id, data }],
        removeSecrets: true,
        markerChanged: true,
      });
    }
  }
  for (const [tableId, rows] of Object.entries(targets))
    for (const row of rows)
      if (!seen.has(`${tableId}:${row.$id}`))
        throw new Error("Unowned normalized row or orphan secret detected.");
  entries.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  const counts = Object.fromEntries(
    ["missing", "unchanged", "changed", "deleted"].map((kind) => [
      kind,
      entries.filter((e) => e.kind === kind).length,
    ]),
  );
  const digest = hash({
    projectId,
    databaseId,
    epoch: control.epoch,
    source: source.map((r) => [
      r.$id,
      r.$updatedAt,
      r.payload,
      r.version,
      r.$permissions,
    ]),
    targets: Object.entries(targets).map(([tableId, rows]) => [
      tableId,
      rows.map((r) => canonical({ tableId, rowId: r.$id, data: r })),
    ]),
    journal: markers.map((r) => [r.$id, r.checksum, r.status, r.checkpoint]),
    entries,
  });
  return { digest, counts, entries, control, source, teamRows };
}
export async function applyReconciliation(
  coordinator: StorageCoordinator,
  teams: Teams,
  project: string,
  baseline: LegacyRow[],
  expectedDigest: string,
) {
  return coordinator.transaction(async (tx) => {
    const state = await coordinator.state(tx);
    if (
      state.mode !== "frozen" ||
      state.storage !== "legacy" ||
      state.activated ||
      (await coordinator.leases(tx)).length
    )
      throw new Error("Freeze and drain all operations before reconciliation.");
    await coordinator.fence(tx);
    const plan = await reconciliationPlan(
      coordinator.db,
      teams,
      coordinator.database,
      project,
      baseline,
      tx,
    );
    if (plan.digest !== expectedDigest)
      throw new Error("Reconciliation diff changed; review a fresh plan.");
    if (plan.entries.reduce((n, e) => n + e.targets.length + 1, 0) > 80)
      throw new Error(
        "This dataset requires a reviewed batched reconciliation.",
      );
    for (const entry of plan.entries) {
      if (entry.kind !== "unchanged")
        for (const target of entry.targets) {
          const params = {
            databaseId: coordinator.database,
            tableId: target.tableId,
            rowId: target.rowId,
            transactionId: tx,
            data: target.data,
            permissions: [],
          };
          if (entry.kind === "missing") await coordinator.db.createRow(params);
          else await coordinator.db.updateRow(params);
        }
      if (entry.removeSecrets)
        await coordinator.db.deleteRow({
          databaseId: coordinator.database,
          tableId: "integration_secrets",
          rowId: entry.sourceId,
          transactionId: tx,
        });
      if (entry.markerChanged)
        await coordinator.db.upsertRow({
          databaseId: coordinator.database,
          tableId: JOURNAL,
          rowId: recordId("b", entry.sourceId),
          transactionId: tx,
          permissions: [],
          data: {
            checksum: entry.digest,
            status: entry.kind === "deleted" ? "deleted" : "applied",
            holder: CONTROL_ID,
            leaseUntil: new Date(0).toISOString(),
            checkpoint: JSON.stringify({
              id: entry.sourceId,
              t: fingerprint(entry.targets),
            }),
          },
        });
    }
    return { digest: plan.digest, counts: plan.counts };
  });
}
