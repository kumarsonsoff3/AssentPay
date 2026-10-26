# AssentPay

Financial operations for business conversations, approvals, and payments.
Built with Next.js, Appwrite, and Trigger.dev. PayPal execution uses sandbox
credentials and requires workspace-owner approval.

## Development

Use Node.js 22 or newer and npm.

`scripts/` and `tests/` are local-only and excluded from Git. Worker, database,
Function build/deployment, and test commands require those local files.

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
# Uses .env; requires AI_PROVIDER and the selected provider's key and model.
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
  and `gmail.send`, plus offline access. Appwrite Google sign-in is a separate flow.
- **Slack:** configure client credentials and
  `APP_URL/api/integrations/slack/callback`. Required bot scopes are `chat:write`
  and `incoming-webhook`. Select the review channel during connection. Optional
  `SLACK_REVIEW_DESTINATION=owner_dm` also requires `users:read.email`. Configure
  `SLACK_SIGNING_SECRET` for incoming events.
- **PayPal:** each workspace connects its own sandbox REST app credentials through
  workspace setup. Set `PAYPAL_WEBHOOK_IDS_JSON` for the workspace-specific sandbox
  webhook registered at `APP_URL/api/webhooks/paypal/WORKSPACE_ID`.
- **AI:** select `AI_PROVIDER=openai` or `openrouter` and configure its API key,
  model, and output mode as described in `.env.example`. Document vision is opt-in
  with `AI_DOCUMENT_VISION_ENABLED=true`.

Provider secrets and worker configuration must be present in the environment
where the work runs, including a deployed private Function or Trigger task.

## Database operations

Schema scripts are additive and default to read-only planning. Start with:

```sh
npm run db:plan
npm run db:migrate -- --cli --dry-run
npm run db:cutover -- status
```

Apply schema changes only with explicit targets:

```sh
npm run db:migrate -- --cli --apply --project=PROJECT_ID --database=assentpay
```

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

The retained tests cover tenant access, role and input validation, origin checks,
deletion consent, and isolated cleanup. Live provider consent, email delivery,
and PayPal sandbox behavior require separate verification with configured accounts.
