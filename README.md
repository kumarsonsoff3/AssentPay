# AssentPay

Financial operations for business conversations, approvals, and payments.
Built with Next.js, Appwrite, and Trigger.dev. PayPal execution uses sandbox
credentials and requires workspace-owner approval.

## Development

Use Node.js 22 or newer and npm.

Repository-owned scripts and regression tests are retained for reproducible builds.
Generated bundles, backups and environment files remain ignored.

```sh
npm ci
cp .env.example .env
# Configure the values described below before starting.
npm run dev
```

Set `APP_URL` to the exact origin used to sign in. Register that hostname as an
Appwrite Web platform, enable email/password authentication and email verification,
and configure email delivery for verification, password recovery, and invitations.
Use one HTTPS origin when testing Slack OAuth or incoming provider webhooks.

`.env.example` lists the server, integration, and worker settings. Keep credentials
in ignored environment files. Appwrite API keys, provider credentials, and encryption
keys must remain server-only. Generate `INTEGRATION_ENCRYPTION_KEY` once and retain
it: changing it makes existing integration credentials unreadable.

## Background processing

The web app receives updates and queues work; an active private worker processes
email imports, document analysis, notifications, and approved financial workflows.

```sh
# Uses .env; imports received email without AI analysis.
npm run worker:inbox
# Uses .env; requires OPENAI_API_KEY and OPENAI_MODEL.
npm run worker:analysis
# Uses .env; combines import, analysis, and Slack review alerts without financial execution.
npm run worker:triage
# Uses .env.worker; runs the complete dispatcher.
npm run worker:financial
```

Populate `.env.worker` with the relevant values from `.env.example`, including
Appwrite settings, the stable encryption key, integration credentials, and AI
configuration. A dedicated worker key needs `rows.read`, `rows.write`, `users.read`,
`teams.read`, `files.read`, and `files.write`.

Alternatively, deploy the private integration Function with its scheduled
dispatcher. Build locally before deployment:

```sh
npm run function:build
npm run function:deploy -- --dry-run
npm run function:deploy -- --apply --project=PROJECT_ID --database=assentpay
npm run function:deploy -- --status
```

Trigger.dev handles connection health and optional dispatcher failover. Keep its
project configuration and deployed environment aligned; run `npm run dev:trigger`
for local Trigger tasks. Use a single primary dispatcher.

If Activity shows **Receive forwarded email** as completed while **Review
financial details** is waiting or retrying, the email is already stored. Check
`npm run function:deploy -- --status` for the minute schedule, automation job
subscriptions and presence of both OpenAI settings on the Function. A ready
deployment can still be missing these settings. Restoring the dispatcher picks
up queued jobs and scheduled retries; there is no need to resend the email.
The deployment apply command requires `OPENAI_API_KEY` and `OPENAI_MODEL` in the
local deployment environment before it changes the live Function.

## Integration configuration

- **Resend forwarding:** verify a dedicated receiving subdomain without changing
  the primary mailbox domain's MX records. Set `RESEND_INBOUND_DOMAIN`,
  `RESEND_API_KEY`, and `RESEND_WEBHOOK_SECRET`. Register
  `APP_URL/api/webhooks/resend` for `email.received` and any delivery events in use.
  Set `RESEND_ATTACHMENT_HOSTS` to exact trusted HTTPS attachment hostnames; the
  default denies downloads. Configure `RESEND_FROM_EMAIL` for operational sending.
  Complete the delivery check in workspace setup.
- **Gmail OAuth:** optional, enabled with `GMAIL_OAUTH_ENABLED=true`. Configure the
  client credentials, enable Gmail API, and register
  `APP_URL/api/integrations/gmail/callback`. The connection requests `gmail.readonly`
  only, plus offline access. Appwrite Google sign-in is a separate flow.
- **Slack:** configure client credentials and
  `APP_URL/api/integrations/slack/callback`. Under **OAuth & Permissions → Bot Token Scopes**,
  add `chat:write` and `incoming-webhook`. The default owner DM mode also needs both
  `users:read` and `users:read.email` and a matching verified owner email. Reconnect
  the workspace in AssentPay after changing Slack's scopes. Use the same
  `SLACK_REVIEW_DESTINATION` on the web app and Appwrite Function.
  Explicit `SLACK_REVIEW_DESTINATION=channel` uses the selected
  review channel. Configure
  `SLACK_SIGNING_SECRET` for incoming events. Signed card interactions use
  `APP_URL/api/webhooks/slack/interactions`; cards open authenticated exact-proposal
  review. Direct decisions require an explicitly linked owner, a recipient-bound
  action token, and the same immutable proposal checks as dashboard decisions.
- **PayPal:** each workspace connects its own sandbox REST app credentials through
  workspace setup. Set `PAYPAL_WEBHOOK_IDS_JSON` for the workspace-specific sandbox
  webhook registered at `APP_URL/api/webhooks/paypal/WORKSPACE_ID`.
- **AI:** configure `OPENAI_API_KEY` and a Responses API model with Structured Outputs
  in `OPENAI_MODEL`. Document vision is opt-in
  with `AI_DOCUMENT_VISION_ENABLED=true`.

Provider secrets and worker configuration must be present in the environment
where the work runs, including a deployed private Function or Trigger task.

See [current implementation boundaries and rollout gates](docs/implementation-roadmap.md).

## Agreement and invoice review

The worker tracks a billing obligation by workspace, reported counterparty and
explicit source reference. An agreement can link to one later billing request
when the cited amount and currency agree. Other requests for that obligation link
to the existing workflow for review. Missing or conflicting evidence requires
manual review. A new conflict can hold an approved draft or send that has yet to
execute. Invoice sending still requires its own exact owner approval.

Approval also claims the quoted reference against the owner-selected billing
email. This catches a repeat request under another customer name when the billing
email stays the same. A new claim checks historical actions, including ambiguous
outcomes, before creating or sending an invoice. If an earlier action for that
recipient lacks a usable reference, approval is held for review. The history
check reads paginated workspace actions when establishing a claim. Use matching
web and worker versions when deploying the guard.

Owners and admins can correct, pause or forget AI memory. Forgetting context leaves
the underlying agreement, obligation claim and financial audit trail available for
review and duplicate checks. Changes to both the customer name and billing email,
reused references and installment arrangements can require human review.

## Email, Slack and PayPal sandbox flow

Resend verifies and queues received email. The worker analyzes the email and
supported documents with OpenAI. Nonfinancial messages produce no financial
proposal, Slack alert or new agent memory. Financial messages send a Slack review
brief and secure links. Link an owner’s Slack identity first to use signed,
one-time decision cards.

- **Customer invoice.** Review source evidence and select the customer email.
  Approve a draft in Slack or the dashboard. Verify the provider draft and approve
  a separate send card in Slack or the dashboard. The customer pays on PayPal.
  Verified PayPal invoice events update AssentPay.
- **Supplier payout.** Set `PAYPAL_SANDBOX_PAYOUTS_ENABLED=true` on matching web
  and private worker releases, and connect a Payouts-enabled sandbox account.
  Review the quoted reference, amount and currency and select the supplier's
  PayPal email. The exact payout requires owner approval. The worker uses the
  PayPal Server SDK for sandbox OAuth and the Payouts REST API for submission and
  verification. The worker checks the individual payout item before showing it
  as paid. Subscribe the workspace PayPal webhook to payout batch and item events
  for later changes such as refunds. Unknown submissions are held for read-only verification of an existing
  PayPal batch.
- **Other Slack actions.** Reject the proposal, save its context to Agent Memory,
  or request a reminder in 24 hours while the proposal remains open. Use the
  secure review link to change an amount supported by the quoted source. A saved
  revision requires a new approval card.

For provider-backed verification use dedicated sandbox recipients and a linked
test Slack owner. Set the Resend attachment host allowlist, workspace PayPal
webhook IDs, and the server-side OpenAI key/model. Verify a single current private
dispatcher with its schedule, row and file scopes and matching web release.

## AG Studio Agent

Open **Analytics Studio** and choose **Open AG Studio Agent**. In local
development Studio can be trialled. Production needs an AG Studio license with
Agent Framework entitlement in `NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY` at build time.
The workspace-authenticated adapter uses the server's OpenAI key and model.
Agent tools act on dashboard widgets and the workspace-scoped read-only dataset.

PayPal’s optional [local MCP server](https://developer.paypal.com/ai-tools/mcp-server#local-mcp-server)
requires a sandbox access token in the MCP host environment. Use its read tools
for diagnostics. AssentPay's worker uses workspace credentials independently.

## Database operations

The migration runner is pending-only for additive 007/008 on an existing, verified
001–006 installation. It defaults to read-only planning. Start with:

```sh
npm run db:plan
npm run db:migrate -- --cli --dry-run
npm run db:cutover -- status
```

For a different installation with independently verified missing 007/008, only after
explicit operator approval apply the pending suffix with all three matching
targets (the endpoint must match configured APPWRITE_ENDPOINT exactly):

```sh
npm run db:migrate -- --cli --apply --project=PROJECT_ID --database=assentpay --endpoint=https://REGION.cloud.appwrite.io/v1
```

The recorded AssentPay target already has 001–008 applied and independently read
back as of 29 October; see the local schema verification record. Deployment and provider checks are separate release gates.

`db:provision` is a legacy **offline-plan alias**, not fresh provisioning. The
current runner intentionally refuses missing historical tables/receipts and
running/partial receipts. Fresh bootstrap is unsupported by this entry point and
requires a separately reviewed, explicitly authorized provisioning procedure; do
not delete receipts, repair leases or replay 001–006 to bypass that refusal.

Retain `scripts/`, `appwrite.config.json`, the migration journal, and encrypted
recovery archives. See [storage operations and recovery](docs/storage-cutover.md)
for snapshots, reconciliation, activation, and recovery procedures.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
# Alternative production compiler when Turbopack IPC is restricted:
npm run build:webpack
```

The retained tests cover tenant access, role/input/origin checks, isolated cleanup,
AI obligation conflicts and memory suppression, immutable approval, concurrent decisions,
ambiguous payment writes, GET-only recovery, settlement reconciliation and Slack retries. Live provider consent, email delivery,
and PayPal sandbox behavior require separate verification with configured accounts.

## Overview dashboard audit — 31 October 2026

The app overview at `/dashboard` now reads sandbox invoice face values and active
memory highlights rather than permanently displaying empty placeholders. Values
are grouped by currency using exact decimal arithmetic; paid, open and unsent draft
values remain separate. Manual payment marks, partial/refunded invoices and uncertain
or unverified records are excluded, and a bounded 1,000-record summary is explicitly
labelled partial. This is not a cash ledger, bank balance or revenue forecast.
Memory highlights respect corrections and omit paused, forgotten and expired context.
Forwarding health uses the same receiving-status rules as inbox setup; recovery
reviews include uncertain invoice sends. Existing review deep links are preserved.

Local checks after reproducibility follow-up: **120 tests**, typecheck, lint,
production build, private Function bundle, compile-only Node22 financial-worker
bundle and diff whitespace validation passed. The retained isolation harness is
now part of `npm test`: actual signed ingress, analysis, approval and private
execution run with mocked storage/provider transports and real authority guards.
It also verifies that multiple invoice references and memory-only financial values
are held for manual review. Tests cover exact amounts, currency/tenant
isolation, memory suppression, actual overview query pagination and rendered widgets;
they do not establish deployed/provider-backed behavior. Browser navigation to
`http://localhost:3000/dashboard` was refused with `browser navigation blocked by
policy`, so authenticated browser interaction is unverified.

Configuration-presence inspection (no values printed or changed) found Appwrite,
encryption, the then-configured AI key/model, Resend and Slack keys present locally; this is not
credential-validity proof. `RESEND_ATTACHMENT_HOSTS` and `PAYPAL_WEBHOOK_IDS_JSON`
are unset; configure exact receiving attachment hosts and workspace sandbox webhook
IDs before those capabilities can be verified. `.env.worker` is absent locally;
confirm the chosen private worker's deployed environment rather than starting another
dispatcher. Provider consent/delivery, runtime/domain-row ACL validation (001–008 schema/receipt readiness was recorded
on 29 October),
matching web/worker deployment and isolated sandbox E2E remain operator gates.

The official [PayPal Agent Toolkit](https://github.com/paypal/agent-toolkit) guidance
was reviewed: explicit sandbox context and action allowlists are available, but an
LLM toolkit must not replace deterministic immutable owner approval/execution guards.
The existing SDK/REST workflow was retained; no toolkit dependency or additional
payment authority was introduced. PayPal MCP initialization timed out this run, so
no MCP-backed provider verification is claimed. No payments, migrations, provider
messages or deployments were performed during this audit.


## Runtime and cleanup follow-up — 31 October 2026

The generated private Function's import-time CommonJS/ESM startup failure is fixed.
Its production-only dependency graph is now locked, with an offline artifact verifier
for native PDF and bounded PDF/DOCX/XLSX workers plus private-ingress import. Build
and run it with `npm run function:build`, install the isolated dependencies using
`npm ci --omit=dev --include=optional --ignore-scripts --prefix .function-build/integration-runtime`,
then `npm run function:verify`. Verified on macOS arm64 with Node **22.23.4**;
Linux/Appwrite execution is still a release gate. The deployment source includes this
check before activation; no deployment or remote configuration was changed.

Full workers expose privacy-safe cleanup progress. `npm run retention:inspect -- --pages=4`
provides a bounded GET-only backlog sample; `npm run security:inspect` samples row
ACL metadata and anonymous visibility without printing row IDs or contents. Current
readback: no transient rows/backlog; 14 automation jobs have private row ACLs, with
none visible anonymously. Other inspected financial tables are empty, so populated
cross-tenant ACL/concurrency behavior remains unverified.

The existing deployed Function is ready/private/Node22 but **drifts from current source**:
file scopes are absent, schedule/automation subscriptions differ, and its build command
predates locked installation/artifact verification. `function:deploy -- --status` now
reports these comparisons. Do not interpret `ready` as matching-code/runtime proof.

Final local checks: **123 tests**, typecheck, lint, production build, Function build,
isolated native artifact verification and Node22 worker compilation passed. See the local financial retention and release verification record for details.
Browser policy refusal, deployment, real Appwrite concurrency/populated ACLs, consenting
provider E2E and operator-specific privacy disclosures still block release completion.
