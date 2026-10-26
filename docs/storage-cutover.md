# Storage operations and recovery

## What schema_migrations contains

`schema_migrations` is a private operational journal, not application content or
credential storage. It records immutable migration checksums/readiness, runner
locks, backfill source checksums and target fingerprints, the shared storage
mode/epoch, and temporary operation leases. These prevent duplicate migrations,
blind overwrites and writes from obsolete workers. It contains no provider tokens,
credential envelopes, OAuth codes or PKCE verifiers. Do not delete this table as
cleanup: doing so disables guarded writes and removes migration lineage.

Migration `001_normalized_core` is unchanged. `002_storage_runtime` adds the
journal status index. `003_encrypted_secrets` adds native encrypted columns
without deleting or modifying the original column definitions.

## Operations and recovery

All mutating commands require `--apply --project=PROJECT_ID --database=assentpay`.
Omitting `--apply` is read-only. Never combine `--apply` and `--dry-run`.

```sh
npm run db:migrate -- --cli --dry-run
npm run db:cutover -- status
npm run db:cutover -- snapshot --apply --project=PROJECT_ID --database=assentpay
npm run db:cutover -- drain --apply --project=PROJECT_ID --database=assentpay
npm run db:cutover -- freeze --apply --project=PROJECT_ID --database=assentpay --processes-verified=storage-v1
npm run db:cutover -- plan
npm run db:cutover -- reconcile --apply --project=PROJECT_ID --database=assentpay --digest=REVIEWED_DIFF
npm run db:cutover -- plan
npm run db:cutover -- activate --apply --project=PROJECT_ID --database=assentpay --digest=CLEAN_DIFF
```

The mode is shared between web, worker and Function, never selected by a browser
cookie. New mutations/check requests are rejected during draining; existing
operations and legacy OAuth callbacks may finish. Freezing requires zero active
leases and no unexpired legacy OAuth states. Leases last 180 seconds and heartbeat
every 30 seconds. Admission and final writes touch the coordinator in their
Appwrite transaction, so a mode change conflicts with an in-flight commit.
Browsing, authentication and workspace selection remain available.

Paused writes return `503` with `code: STORAGE_MAINTENANCE` and `Retry-After: 30`.
Revision conflicts return `409`. A disconnect leaves a tombstone, invalidates its
generation, deletes the normalized secret copy and clears the provider account
label, external IDs, channel details and scopes. Tombstones retain internal
workspace/provider, audit and concurrency fields only; no legacy fallback
resurrects a connection. An idempotent disconnect also cleans up an orphan secret
when its metadata row is absent. Legacy OAuth states are never duplicated into
the normalized claim store. Encrypted recovery archives are retained separately
and are not rewritten by disconnect.

Reconciliation checks all sources before writing. It only changes migration-owned
shadow rows with proven lineage. A changed source, deleted integration, new source
and unexpected target edit are distinct cases. Missing secret pairs, orphan
references and unowned target edits stop the operation. Legacy marker upgrades use
the authenticated pre-backfill snapshot to prove older target contents. A reviewed
plan digest binds the target project, storage epoch, source/target inventory and
lineage; a changed diff requires review again. This initial transaction runner
refuses datasets requiring more than 80 staged operations; larger cutovers need
reviewed batching rather than an unsafe partial application.

Before activation, `restore-legacy` may resume paused legacy storage. Once activated,
legacy rollback and legacy reconciliation are prohibited, including if no operator
can prove whether a new write occurred. Freeze normalized writes and repair
forward; any reverse reconciliation requires a separate reviewed procedure.
Expired leases also block freezing: expiration alone does not prove an external
request stopped. Verify its process and external outcome before an operator removes
that specific stale lease. Never delete all journal rows or change the storage epoch
manually to bypass the guard.

Recovery snapshots are encrypted under ignored `.local-backups/`, mode 0600 in a
0700 directory. Keep the old envelope key as long as historical rows or backups
reference it. Keyring changes are explicit deployment configuration, not automatic
rotation or bulk rewriting. Restoring a snapshot must not overwrite newer data.

## Function deployment

```sh
npm run function:build
npm run function:deploy -- --dry-run
npm run function:deploy -- --apply --project=PROJECT_ID --database=assentpay
npm run function:deploy -- --status
```

Build output is ignored under `.function-build/`. Deployment uploads only the
bundled handler and its minimal package manifest. Configure the same APP_URL,
database, original encryption key and Gmail/Slack app credentials in secret
Function variables. The deployment command sets those from the existing server
environment without printing them or extracting CLI credentials. It never uploads
an API key; the Function uses Appwrite's scoped execution key instead.

## Recovery archives

Keep encrypted `.local-backups/` archives and every encryption key still referenced
by stored rows or backups. When a legacy table has been retired, use its
`schema_migrations/retired_onboarding` receipt to locate and verify the archive.
Authenticate the envelope with its recorded key ID and
`recovery:PROJECT_ID:DATABASE_ID` context before inspecting it in a separate
environment. Do not restore the old table as runtime authority or overwrite newer
normalized rows. Freeze writes and repair forward; reverse reconciliation requires
a separately reviewed plan. Local archives do not replace managed off-device
backups and a retention policy.
