import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { Query, type TablesDB } from "node-appwrite";
import { dataDatabase, databaseId } from "./client";
import { isTransactionConflict } from "../errors";

export const STORAGE_PROTOCOL = "storage-v1";
export const CONTROL_ID = "runtime_storage";
export const JOURNAL = "schema_migrations";
export const CLEANUP_ID = "runtime_cleanup";
export class CleanupBusyError extends Error {
  constructor() { super("Background work or another deletion is in progress. Please retry shortly."); }
}
export type StorageMode = "legacy" | "draining" | "frozen" | "normalized";
export type StorageState = {
  mode: StorageMode;
  storage: "legacy" | "normalized";
  epoch: string;
  activated: boolean;
};
export type OperationKind = "mutation" | "oauth_callback" | "worker" | "deletion";
export class StorageMaintenanceError extends Error {
  readonly code = "STORAGE_MAINTENANCE";
  constructor() {
    super(
      "Workspace changes are temporarily paused for storage maintenance. Please retry shortly.",
    );
  }
}
export class RevisionConflictError extends Error {
  constructor() {
    super("This record changed. Reload before trying again.");
  }
}
export const nonce = () => randomBytes(16).toString("hex");
export const rowMissing = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e && "type" in e &&
  e.code === 404 &&
  e.type === "row_not_found";
const local = new AsyncLocalStorage<StorageOperation>();
const processId = nonce();
const expiry = () => new Date(Date.now() + 180000).toISOString();
type JournalRow = Record<string, unknown>;

async function retryTransaction<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      // Appwrite rejected the transaction and transaction() has rolled it back.
      // A transport failure can mean the commit succeeded, so never retry it here.
      if (attempt === 2 || !isTransactionConflict(error)) throw error;
      await setTimeout(150 * 2 ** attempt + Math.random() * 150);
    }
  }
}

export function decodeControl(row: JournalRow): StorageState {
  let details;
  try {
    details = JSON.parse(String(row.checkpoint));
  } catch {
    throw new StorageMaintenanceError();
  }
  if (
    !details ||
    typeof details !== "object" ||
    Array.isArray(details) ||
    !Array.isArray(row.$permissions) ||
    row.$permissions.length ||
    !["legacy", "draining", "frozen", "normalized"].includes(
      String(row.status),
    ) ||
    !/^[a-f0-9]{64}$/.test(String(row.checksum)) ||
    details.protocol !== STORAGE_PROTOCOL ||
    !["legacy", "normalized"].includes(details.storage) ||
    typeof details.activated !== "boolean" ||
    (details.activated && details.storage !== "normalized") ||
    (row.status === "legacy" && details.storage !== "legacy") ||
    (row.status === "normalized" && details.storage !== "normalized")
  )
    throw new StorageMaintenanceError();
  return {
    mode: row.status as StorageMode,
    storage: details.storage,
    epoch: String(row.checksum),
    activated: details.activated,
  };
}
export class StorageCoordinator {
  constructor(
    readonly db: TablesDB,
    readonly database: string,
  ) {}
  params(rowId = CONTROL_ID, transactionId?: string) {
    return {
      databaseId: this.database,
      tableId: JOURNAL,
      rowId,
      ...(transactionId ? { transactionId } : {}),
    };
  }
  async state(transactionId?: string): Promise<StorageState> {
    try {
      return decodeControl(
        await this.db.getRow(this.params(CONTROL_ID, transactionId)),
      );
    } catch (e) {
      if (rowMissing(e)) throw new StorageMaintenanceError();
      throw e;
    }
  }
  async transaction<T>(run: (id: string) => Promise<T>): Promise<T> {
    const tx = await this.db.createTransaction({ ttl: 60 });
    try {
      const result = await run(tx.$id);
      await this.db.updateTransaction({ transactionId: tx.$id, commit: true });
      return result;
    } catch (e) {
      await this.db
        .updateTransaction({ transactionId: tx.$id, rollback: true })
        .catch(() => {});
      throw e;
    }
  }
  // Touch the control row in the same transaction: admission/commit and mode
  // transitions contend on a real write, not on an assumed read-set lock.
  async fence(transactionId: string) {
    await this.db.updateRow({
      ...this.params(CONTROL_ID, transactionId),
      data: { holder: nonce() },
    });
  }
  async cleanup(transactionId?: string) {
    try { return await this.db.getRow(this.params(CLEANUP_ID, transactionId)); }
    catch (error) { if (rowMissing(error)) return null; throw error; }
  }
  async begin(kind: OperationKind, retryConflicts = kind === "worker") {
    const id = `l_${nonce()}`;
    const state = await this.transaction(async (tx) => {
      let current = await this.state(tx);
      const cleanup = await this.cleanup(tx);
      // Recover a crashed cleanup only after its exclusive lease has expired.
      if (current.mode === "frozen" && cleanup?.status === "cleanup_lock" && cleanup.checksum === current.epoch && Date.parse(cleanup.leaseUntil) <= Date.now()) {
        const saved = JSON.parse(cleanup.checkpoint);
        if (!["legacy", "normalized"].includes(saved.mode)) throw new StorageMaintenanceError();
        await this.fence(tx);
        await this.db.updateRow({ ...this.params(CONTROL_ID, tx), data: { status: saved.mode } });
        current = { ...current, mode: saved.mode };
      }
      if (cleanup && Date.parse(cleanup.leaseUntil) > Date.now()) throw new CleanupBusyError();
      if (
        current.mode === "frozen" ||
        (current.mode === "draining" && kind !== "oauth_callback")
      )
        throw new StorageMaintenanceError();
      await this.fence(tx);
      if (cleanup && Date.parse(cleanup.leaseUntil) > Date.now()) throw new CleanupBusyError();
      if (kind === "deletion") {
        const leases = await this.leases(tx);
        if (leases.some((lease) => Date.parse(lease.leaseUntil) > Date.now())) throw new CleanupBusyError();
        await this.db.upsertRow({
          ...this.params(CLEANUP_ID, tx), permissions: [],
          data: { checksum: current.epoch, status: "cleanup_lock", holder: id.slice(2), leaseUntil: expiry(), checkpoint: JSON.stringify({ mode: current.mode }) },
        });
        // Older deployed workers already honor frozen mode; they cannot bypass cleanup.
        await this.db.updateRow({ ...this.params(CONTROL_ID, tx), data: { status: "frozen" } });
      }
      await this.db.createRow({
        ...this.params(id, tx),
        permissions: [],
        data: {
          checksum: current.epoch,
          status: "storage_lease",
          holder: processId,
          leaseUntil: expiry(),
          checkpoint: JSON.stringify({ kind, storage: current.storage }),
        },
      });
      return current;
    });
    return new StorageOperation(this, id, state, kind, retryConflicts);
  }
  async leases(transactionId?: string) {
    const rows = [];
    let cursor: string | undefined;
    do {
      const page = await this.db.listRows({
        databaseId: this.database,
        tableId: JOURNAL,
        transactionId,
        queries: [
          Query.equal("status", "storage_lease"),
          Query.limit(100),
          ...(cursor ? [Query.cursorAfter(cursor)] : []),
        ],
      });
      rows.push(...page.rows);
      cursor = page.rows.length === 100 ? page.rows.at(-1)?.$id : undefined;
    } while (cursor);
    return rows;
  }
}
export class StorageOperation {
  private heartbeat?: ReturnType<typeof setInterval>;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(
    readonly coordinator: StorageCoordinator,
    readonly id: string,
    readonly state: StorageState,
    readonly kind: OperationKind,
    private readonly retryConflicts = kind === "worker",
  ) {}
  get storage() {
    return this.state.storage;
  }
  async validate(transactionId: string) {
    const current = await this.coordinator.state(transactionId);
    const lease = await this.coordinator.db.getRow(
      this.coordinator.params(this.id, transactionId),
    );
    if (
      (current.mode === "frozen" && this.kind !== "deletion") ||
      current.epoch !== this.state.epoch ||
      current.storage !== this.storage ||
      lease.status !== "storage_lease" ||
      lease.holder !== processId ||
      lease.checksum !== current.epoch ||
      !Number.isFinite(Date.parse(lease.leaseUntil)) ||
      Date.parse(lease.leaseUntil) <= Date.now()
    )
      throw new StorageMaintenanceError();
    const cleanup = await this.coordinator.cleanup(transactionId);
    if (this.kind === "deletion") {
      if (!cleanup || cleanup.holder !== this.id.slice(2) || Date.parse(cleanup.leaseUntil) <= Date.now()) throw new CleanupBusyError();
    } else if (cleanup && Date.parse(cleanup.leaseUntil) > Date.now()) throw new CleanupBusyError();
    await this.coordinator.fence(transactionId);
  }
  // Heartbeats and commits within one operation are serialized to avoid a lease
  // refresh conflicting with its own transaction. Cross-operation conflicts fail closed.
  private serial<T>(run: () => Promise<T>): Promise<T> {
    const next = this.pending.then(run, run);
    this.pending = next.catch(() => {});
    return next;
  }
  commit<T>(
    run: (db: TablesDB, transactionId: string) => Promise<T>,
  ): Promise<T> {
    return this.serial(() => {
      // Callers that enable retries keep provider writes outside the transaction.
      const commit = () => this.coordinator.transaction(async (tx) => {
        await this.validate(tx);
        const result = await run(this.coordinator.db, tx);
        await this.validate(tx);
        return result;
      });
      return this.retryConflicts ? retryTransaction(commit) : commit();
    });
  }
  async check() {
    await this.commit(async () => {});
  }
  startHeartbeat() {
    this.heartbeat = setInterval(() => {
      void this.commit(async (db, tx) => {
        await db.updateRow({
          ...this.coordinator.params(this.id, tx),
          data: { leaseUntil: expiry() },
        });
        if (this.kind === "deletion") await db.updateRow({ ...this.coordinator.params(CLEANUP_ID, tx), data: { leaseUntil: expiry() } });
      }).catch(() => {});
    }, 30000);
    this.heartbeat.unref();
  }
  async close() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    await this.pending;
    if (this.kind === "deletion") await this.coordinator.transaction(async (tx) => {
      await this.coordinator.fence(tx);
      const cleanup = await this.coordinator.cleanup(tx);
      if (cleanup?.holder === this.id.slice(2)) {
        const current = await this.coordinator.state(tx);
        if (current.mode === "frozen" && current.epoch === this.state.epoch) await this.coordinator.db.updateRow({ ...this.coordinator.params(CONTROL_ID, tx), data: { status: this.state.mode } });
        await this.coordinator.db.deleteRow(this.coordinator.params(CLEANUP_ID, tx));
      }
    }).catch(() => {});
    await this.coordinator.db
      .deleteRow(this.coordinator.params(this.id))
      .catch(() => {});
  }
}
export const coordinator = () =>
  new StorageCoordinator(dataDatabase(), databaseId());
export function currentOperation() {
  const op = local.getStore();
  if (!op) throw new StorageMaintenanceError();
  return op;
}
export async function storageState() {
  return local.getStore()?.state ?? coordinator().state();
}
export async function withStorageOperation<T>(
  kind: OperationKind,
  run: (op: StorageOperation) => Promise<T>,
  { retryConflicts = kind === "worker" } = {},
) {
  const existing = local.getStore();
  if (existing) return run(existing);
  const begin = () => coordinator().begin(kind, retryConflicts);
  const op = await (retryConflicts ? retryTransaction(begin) : begin());
  op.startHeartbeat();
  try {
    return await local.run(op, () => run(op));
  } finally {
    await op.close();
  }
}
