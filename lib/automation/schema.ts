import type { Column, Table } from "../data/schema";
const v = (key: string, size = 128, required = true): Column => ({
  key,
  type: "varchar",
  size,
  required,
});
const t = (key: string, encrypt = false): Column => ({
  key,
  type: "text",
  required: true,
  ...(encrypt ? { encrypt: true } : {}),
});
const date = (key: string): Column => ({
  key,
  type: "datetime",
  required: true,
});
const scoped = [v("workspaceId", 36)];
const index = (key: string, columns: string[]) => ({
  key,
  columns,
  type: "key" as const,
});
export const automationMigrationId = "004_automation";
export const automationTables: Table[] = [
  {
    id: "automation_jobs",
    columns: [
      ...scoped,
      v("integrationId", 36),
      v("connectionVersion", 32),
      v("kind", 32),
      v("requestedBy", 36),
      v("status", 24),
      { key: "attempts", type: "integer", required: true },
      date("nextAttemptAt"),
      date("leaseUntil"),
      v("leaseToken", 32),
      date("requestedAt"),
      v("errorCode", 64),
      t("payloadJson", true),
    ],
    indexes: [
      index("due_jobs", ["status", "nextAttemptAt"]),
      index("workspace_jobs", ["workspaceId", "$updatedAt"]),
    ],
  },
  {
    id: "mailbox_sync",
    columns: [...scoped, v("connectionVersion", 32), t("stateJson", true)],
    indexes: [],
  },
  {
    id: "mail_messages",
    columns: [
      ...scoped,
      v("connectionVersion", 32),
      v("providerId", 128),
      v("threadId", 128),
      v("sender", 512),
      v("subject", 998),
      date("receivedAt"),
      { key: "unread", type: "boolean", required: true },
      { key: "financial", type: "boolean", required: true },
      t("contentJson", true),
    ],
    indexes: [
      index("workspace_date", ["workspaceId", "receivedAt"]),
      index("workspace_thread", ["workspaceId", "threadId"]),
    ],
  },
  {
    id: "contacts",
    columns: [
      ...scoped,
      v("connectionVersion", 32),
      v("email", 320),
      v("displayName", 320),
      date("lastSeenAt"),
    ],
    indexes: [index("workspace_contacts", ["workspaceId", "lastSeenAt"])],
  },
  {
    id: "documents",
    columns: [
      ...scoped,
      v("connectionVersion", 32),
      v("messageId", 128),
      v("attachmentId", 1024),
      v("filename", 255),
      v("mimeType", 128),
      { key: "size", type: "integer", required: true },
      v("fileId", 36),
      v("status", 24),
    ],
    indexes: [index("workspace_documents", ["workspaceId", "$updatedAt"])],
  },
  {
    id: "audit_events",
    columns: [
      ...scoped,
      v("actorId", 36),
      v("action", 64),
      v("entityId", 128),
      v("correlationId", 64),
      date("occurredAt"),
      t("detailsJson"),
    ],
    indexes: [index("workspace_audit", ["workspaceId", "occurredAt"])],
  },
  {
    id: "webhook_events",
    columns: [
      ...scoped,
      v("provider", 16),
      v("eventId", 255),
      v("eventType", 128),
      v("status", 24),
      t("payloadJson", true),
    ],
    indexes: [index("workspace_webhooks", ["workspaceId", "$createdAt"])],
  },
  {
    id: "notifications",
    columns: [
      ...scoped,
      v("title", 255),
      v("description", 1024),
      v("kind", 32),
      v("entityId", 128),
    ],
    indexes: [index("workspace_notifications", ["workspaceId", "$createdAt"])],
  },
  {
    id: "notification_reads",
    columns: [...scoped, v("userId", 36), v("notificationId", 36)],
    indexes: [index("workspace_user", ["workspaceId", "userId"])],
  },
  {
    id: "workspace_events",
    columns: [...scoped, v("revision", 32), v("kind", 64)],
    indexes: [],
  },
];
export const documentBucketId = "workspace-documents";
export const maximumDocumentSize = 5 * 1024 * 1024;
