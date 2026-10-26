import "server-only";
import { Query } from "node-appwrite";
import { dataDatabase } from "../data/client";
import { InputError, validId } from "../workspaces/validation";
import { currentMailVersion } from "./gmail-sync";
import { params } from "./store";
import { optionalRow } from "./store";
import { processingState } from "./processing-state";
const tables = {
  messages: "mail_messages",
  contacts: "contacts",
  documents: "documents",
  activity: "audit_events",
  jobs: "automation_jobs",
  notifications: "notifications",
  workflows: "financial_workflows",
  memory: "agent_memory",
  analyses: "message_analyses",
  deliveries: "notification_deliveries",
} as const;
export type Resource = keyof typeof tables;
export function isResource(value: string): value is Resource {
  return Object.hasOwn(tables, value);
}
export async function readResources(
  workspaceId: string,
  resource: Resource,
  userId: string,
  cursor?: string,
  workflowId?: string,
) {
  if (cursor) validId(cursor);
  if (workflowId) {
    validId(workflowId);
    if (resource !== "workflows") throw new InputError("Invalid review resource.");
  }
  const queries = [
    Query.limit(50),
    Query.orderDesc(
      resource === "messages"
        ? "receivedAt"
        : resource === "activity"
          ? "occurredAt"
          : "$updatedAt",
    ),
    ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ...(workflowId ? [Query.equal("$id", workflowId)] : []),
  ];
  if (resource === "contacts") {
    const version = await currentMailVersion(workspaceId);
    if (!version) return { items: [], nextCursor: null };
    queries.push(Query.equal("connectionVersion", version));
  }
  if (resource === "memory") {
    queries.push(Query.equal("status", "active"), Query.greaterThan("expiresAt", new Date().toISOString()));
  }
  if (resource === "messages") queries.push(Query.equal("financial", true));
  const page = await dataDatabase().listRows({
    ...params(tables[resource]),
    queries: [Query.equal("workspaceId", workspaceId), ...queries],
  });
  const items = await Promise.all(
    page.rows.map(async (row) => {
      const base = { id: row.$id, updatedAt: row.$updatedAt };
      switch (resource) {
        case "deliveries": return { ...base, channel: row.channel, status: row.status, workflowId: row.workflowId };
        case "workflows": return { ...base, messageId: row.messageId, status: row.status, action: row.action, counterparty: row.counterparty, amount: row.amount, currency: row.currency, providerId: row.providerId, proposal: JSON.parse(row.proposalJson), proposalHash: (await import("./intelligence")).proposalHash(row.proposalJson) };
        case "analyses": return { ...base, messageId: row.messageId, category: row.category, status: row.status, result: JSON.parse(row.resultJson) };
        case "memory": return { ...base, sourceId: row.sourceId, status: row.status, expiresAt: row.expiresAt, facts: JSON.parse(row.factsJson) };
        case "messages": {
          const content = JSON.parse(row.contentJson);
          return {
            ...base,
            threadId: row.threadId,
            sender: row.sender,
            subject: row.subject,
            receivedAt: row.receivedAt,
            unread: row.unread,
            financial: row.financial,
            text: content.text,
            snippet: content.snippet,
            to: content.to,
          };
        }
        case "contacts":
          return {
            ...base,
            email: row.email,
            displayName: row.displayName,
            lastSeenAt: row.lastSeenAt,
          };
        case "documents":
          return {
            ...base,
            filename: row.filename,
            mimeType: row.mimeType,
            size: row.size,
            status: row.status,
          };
        case "activity":
          return {
            ...base,
            action: row.action,
            actorId: row.actorId,
            entityId: row.entityId,
            occurredAt: row.occurredAt,
            details: JSON.parse(row.detailsJson),
          };
        case "jobs": {
          let subject: string | null = null;
          if (row.kind === "financial-analyze") {
            const payload = JSON.parse(row.payloadJson);
            const mail = typeof payload.messageId === "string" ? await optionalRow("mail_messages", payload.messageId) : null;
            if (mail?.workspaceId === workspaceId) subject = String(mail.subject);
          }
          const state = processingState({ kind: row.kind, status: row.status, attempts: Number(row.attempts), createdAt: row.$createdAt, errorCode: row.errorCode });
          return {
            ...base,
            kind: row.kind,
            status: row.status,
            attempts: row.attempts,
            nextAttemptAt: row.nextAttemptAt,
            errorCode: row.errorCode,
            createdAt: row.$createdAt,
            waitingTooLong: row.status === "queued" && Number(row.attempts) === 0 && Date.now() - Date.parse(row.$createdAt) > 5 * 60000,
            subject,
            processing: state,
          };
        }
        case "notifications": {
          const read = await dataDatabase().listRows({
            ...params("notification_reads"),
            queries: [
              Query.equal("workspaceId", workspaceId),
              Query.equal("userId", userId),
              Query.equal("notificationId", row.$id),
              Query.limit(1),
            ],
          });
          return {
            ...base,
            title: row.title,
            description: row.description,
            kind: row.kind,
            read: read.rows.length > 0,
          };
        }
      }
    }),
  );
  return {
    items,
    nextCursor: page.rows.length === 50 ? page.rows.at(-1)!.$id : null,
  };
}
export function requireResource(value: string) {
  if (!isResource(value)) throw new InputError("Not found.", 404);
  return value;
}
