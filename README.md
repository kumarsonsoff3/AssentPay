# AssentPay

Financial operations for business conversations, approvals, and payments.
Built with Next.js, Appwrite, and Trigger.dev. PayPal execution uses sandbox
credentials and requires workspace-owner approval.

## Development

Use Node.js 22.9 or newer and npm.

The checkout contains the application, workers, and tooling required to build
and release them. Local archives, generated bundles, backups and environment
files are ignored.

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
For a tunnel that stays open between edits, serve a local production build with
`npm run build:webpack` and `npm start` on the tunnel’s existing port. Stop the
development server on that port first. This avoids development hot reload on the
shared URL.

`.env.example` lists the server, integration, and worker settings. Keep credentials
in ignored environment files. Appwrite API keys, provider credentials, and encryption
keys must remain server-only. Generate `INTEGRATION_ENCRYPTION_KEY` once and retain
it: changing it makes existing integration credentials unreadable.

## Background processing

The web app receives updates and queues work; an active private worker processes
email imports, document analysis, notifications, and approved financial workflows.

Deploy the private Appwrite integration Function as the primary worker. New
automation jobs trigger the Function on creation. Its five-minute interval
handles due retries, expired leases and housekeeping. The Function deployment
includes an offline verifier for its bundled dependencies. Dashboard pages load
on navigation and on **Refresh dashboard**. Email setup checks are limited to an
open forwarding confirmation or delivery test.

```sh
npm run function:build
npm run function:deploy -- --dry-run
npm run function:deploy -- --apply --project=PROJECT_ID --database=assentpay
npm run function:deploy -- --status
```

If Activity shows **Receive forwarded email** as completed while **Review
financial details** is waiting or retrying, the email is already stored. Check
`npm run function:deploy -- --status` for the five-minute interval, job creation
subscriptions and presence of both OpenAI settings on the Function. A ready
deployment can still be missing these settings. Restoring the dispatcher picks
up queued jobs and scheduled retries; there is no need to resend the email.
The deployment apply command requires `OPENAI_API_KEY` and `OPENAI_MODEL` in the
local deployment environment before it changes the live Function.

## Deploy Trigger.dev to production

Use the same revision for the web app, the private Appwrite Function, and the
Trigger.dev tasks. Deploy the private Function before verifying the tasks. No
ngrok tunnel is needed for Trigger.dev; it calls Appwrite directly.

1. In Trigger.dev, open the intended project and select **PROD**. Confirm its
   project ref matches `project` in `trigger.config.ts`.
2. In the Trigger.dev project's **Environment variables** page, set these for
   **PROD** only:
   - `APPWRITE_ENDPOINT` and `APPWRITE_PROJECT_ID`: the production Appwrite target.
   - `APPWRITE_INTEGRATION_FUNCTION_ID=assentpay-integrations` (use the deployed
     Function's ID if customized).
   - `APPWRITE_DATA_API_KEY`: a dedicated Appwrite key with the
     [function execution scope](https://appwrite.io/docs/references/cloud/server-rest/functions#createExecution)
     (`executions.write`, also documented as `execution.write`).
     Store it as a secret. The tasks call the private Function; they do not need
     database or file scopes, OpenAI keys, or Slack, Resend and PayPal credentials.
   - `TRIGGER_AUTOMATION_FAILOVER_ENABLED=false`: Appwrite remains the primary
     dispatcher. The declared catch-up cron may still show Trigger.dev runs,
     but it returns without invoking Appwrite while this flag is false.
3. From a clean checkout of the release revision, use the CLI version that
   matches the SDK in `package-lock.json` (currently 4.7.4). If you export
   `TRIGGER_PROJECT_REF` in the shell or a local `.env`, confirm it also matches;
   the CLI can use it to override the config.

   ```sh
   npm ci
   npx trigger.dev@4.7.4 login
   npx trigger.dev@4.7.4 deploy --env prod
   ```

4. Set the production web host's server-only `TRIGGER_SECRET_KEY` to the
   **PROD** secret from the same Trigger.dev project. Set
   `TRIGGER_PROJECT_REF` to that project's ref and deploy the web app.
5. From the deployed web app, click **Check connection** on a configured
   integration. Confirm `check-workspace-connection` appears under **PROD →
   Runs** and that AssentPay shows the resulting connection status.

See the [Trigger.dev CLI deploy guide](https://trigger.dev/docs/cli-deploy-commands).
Enable Trigger failover only as part of a deliberate switch away from Appwrite's
interval dispatcher.

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
  webhook registered at `APP_URL/api/webhooks/paypal/WORKSPACE_ID`. Owners can also
  use **Check PayPal status** on an existing invoice. The connection
  check reads the Invoicing API after authenticating. To enable supplier payouts,
  grant the sandbox REST app Payouts access and set
  `PAYPAL_SANDBOX_PAYOUTS_ENABLED=true` in both the web app and Function.
  The reviewed currency must be supported by PayPal for the operation. INR is
  outside PayPal's published payment currency list.
- **AI:** configure `OPENAI_API_KEY` and a Responses API model with Structured Outputs
  in `OPENAI_MODEL`. Document vision is opt-in
  with `AI_DOCUMENT_VISION_ENABLED=true`.

Provider secrets and worker configuration must be present in the web app or
private Function as appropriate. Trigger tasks only need the Appwrite execution
settings listed above.

## Agreement and invoice review

The worker tracks a billing obligation by workspace, reported counterparty and
explicit source reference. An agreement can link to one later billing request
when the cited amount and currency agree. Other requests for that obligation link
to the existing workflow for review. Missing or conflicting evidence requires
manual review. The review shows payment confirmations, contract totals and
installments as separate sourced amounts. Owners can reanalyze an undecided
review and can prepare PayPal terms after confirming the open balance and stable
obligation reference. Saving terms requires a separate owner approval that
selects the exact recipient. A new conflict can hold an approved draft or send that has yet to
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
brief with a button to open secure review. Link an owner’s Slack identity first to use signed,
one-time decision cards.

- **Customer invoice.** Review source evidence and select the customer email.
  Approve a draft in Slack or the dashboard. Verify the provider draft and approve
  a separate send card in Slack or the dashboard. The customer pays on PayPal.
  Verified PayPal invoice events update AssentPay. When PayPal supplies the
  verified customer payment link, a Slack card opens the invoice through the
  workspace owner’s signed-in AssentPay session.
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

## Database prerequisites

This release targets an existing, normalized Appwrite database with the required
tables, indexes, buckets and migration receipts (001–008). Deploying the web
app, Function, or Trigger.dev tasks does not provision a blank database. A new
Appwrite project needs a separately reviewed provisioning procedure before release.
Keep the existing migration journal and encrypted recovery snapshots.

## Verification

```sh
npm run lint
npm run typecheck
npm run build
npm run function:build
```

Use dedicated sandbox recipients and a test Slack owner to verify email delivery,
financial review, and PayPal status updates after deployment.
