import { InputError } from "../workspaces/validation";
import { gmailMessageId } from "./financial-safety";
import { Query } from "node-appwrite";
import { RuntimeStore } from "../data/runtime";
import { dataClient, dataDatabase, databaseId } from "../data/client";
import { openCredentials, sealCredentials } from "../integrations/credentials";
import { refreshGmail } from "../integrations/providers";
import { workerAuthorization } from "../integrations/health";
import {
  attachments,
  emailAddress,
  financialIntent,
  GmailError,
  gmailRequest,
  header,
  messageText,
  type GmailMessage,
} from "./gmail-client";
import { enqueue, params, optionalRow, stableId, type Job } from "./store";
import type { TablesDB } from "node-appwrite";
export type GuardedCommit = <T>(
  write: (db: TablesDB, tx: string) => Promise<T>,
) => Promise<T>;
type SyncState = {
  phase: "full" | "history";
  historyId: string;
  baseline: string;
  pageToken: string;
  pending: string[];
  nextToken: string;
  targetHistory: string;
  pageLoaded: boolean;
  watchExpires: number;
};
export async function gmailCredentials(job: Job) {
  if (process.env.GMAIL_OAUTH_ENABLED !== "true") throw new InputError("Gmail is disabled for this deployment.", 403);
  const store = new RuntimeStore(
    dataDatabase(),
    databaseId(),
    job.requestedBy,
    workerAuthorization(dataClient(), job.requestedBy),
  );
  const current = await store.execution(job.workspaceId, "gmail");
  if (!current || current.record.version !== job.connectionVersion)
    throw new Error("Obsolete connection");
  let credentials = openCredentials(
    job.workspaceId,
    "gmail",
    current.record.credentials,
  );
  if (!credentials.expiresAt || credentials.expiresAt < Date.now() + 60000) {
    credentials = await refreshGmail(credentials);
    await store.saveIntegration(
      job.workspaceId,
      {
        ...current.record,
        credentials: sealCredentials(job.workspaceId, "gmail", credentials),
      },
      current.revision,
    );
  }
  if (!credentials.accessToken) throw new GmailError(401);
  return {
    token: credentials.accessToken,
    mailbox: current.record.externalId || current.record.label,
  };
}
export async function syncGmail(
  job: Job,
  commit: GuardedCommit,
): Promise<boolean> {
  const deadline = Date.now() + 45000;
  const { token, mailbox } = await gmailCredentials(job),
    stateId = stableId(job.workspaceId, job.connectionVersion, "sync");
  const stored = await optionalRow("mailbox_sync", stateId);
  let state: SyncState = stored
    ? JSON.parse(stored.stateJson)
    : {
        phase: "full",
        historyId: "",
        baseline: "",
        pageToken: "",
        pending: [],
        nextToken: "",
        targetHistory: "",
        pageLoaded: false,
        watchExpires: 0,
      };
  const save = async (db: TablesDB, tx: string) =>
    db.upsertRow({
      ...params("mailbox_sync", stateId, tx),
      permissions: [],
      data: {
        workspaceId: job.workspaceId,
        connectionVersion: job.connectionVersion,
        stateJson: JSON.stringify(state),
      },
    });
  if (!state.baseline && state.phase === "full") {
    const profile = await gmailRequest<{
      historyId: string;
      emailAddress: string;
    }>(token, "profile");
    if (
      profile.emailAddress.toLowerCase() !== mailbox.toLowerCase() ||
      !/^\d+$/.test(profile.historyId)
    )
      throw new GmailError(401);
    state.baseline = profile.historyId;
    await commit(save);
  }
  if (!state.pageLoaded) {
    if (state.phase === "full") {
      const page = await gmailRequest<{
        messages?: { id: string }[];
        nextPageToken?: string;
      }>(token, "messages", {
        maxResults: "20",
        q: "newer_than:90d -in:spam -in:trash -category:promotions -category:social",
        pageToken: state.pageToken,
      });
      state.pending = (page.messages || []).map((m) => m.id);
      state.nextToken = page.nextPageToken || "";
      state.targetHistory = state.baseline;
    } else {
      try {
        const page = await gmailRequest<{
          history?: {
            messages?: { id: string }[];
            messagesAdded?: { message: { id: string } }[];
            messagesDeleted?: { message: { id: string } }[];
            labelsAdded?: { message: { id: string } }[];
            labelsRemoved?: { message: { id: string } }[];
          }[];
          nextPageToken?: string;
          historyId: string;
        }>(token, "history", {
          startHistoryId: state.historyId,
          maxResults: "20",
          pageToken: state.pageToken,
        });
        state.pending = [
          ...new Set(
            (page.history || []).flatMap((h) => [
              ...(h.messages || []).map((m) => m.id),
              ...[
                ...(h.messagesAdded || []),
                ...(h.messagesDeleted || []),
                ...(h.labelsAdded || []),
                ...(h.labelsRemoved || []),
              ].map((x) => x.message.id),
            ]),
          ),
        ];
        state.nextToken = page.nextPageToken || "";
        state.targetHistory = page.historyId;
        if (state.pending.length > 2000)
          throw new Error("History batch exceeds safe limit");
      } catch (e) {
        if (!(e instanceof GmailError) || e.status !== 404) throw e;
        state = {
          ...state,
          phase: "full",
          baseline: "",
          historyId: "",
          pageToken: "",
          pending: [],
          pageLoaded: false,
        };
        await commit(save);
        return true;
      }
    }
    state.pageLoaded = true;
    await commit(save);
  }
  // Checkpoints advance only in the transaction that persisted or removed a message.
  for (const providerId of state.pending.slice(0, 20)) {
    if (Date.now() > deadline) return true;
    let message: GmailMessage | null = null;
    try {
      message = await gmailRequest<GmailMessage>(
        token,
        `messages/${encodeURIComponent(providerId)}`,
        { format: "full" },
      );
    } catch (e) {
      if (!(e instanceof GmailError) || e.status !== 404) throw e;
    }
    const id = gmailMessageId(job.workspaceId, mailbox, providerId);
    const ignored = message?.labelIds?.some((l) =>
      ["SPAM", "TRASH", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL"].includes(l),
    );
    const subject = message ? header(message, "subject").slice(0, 998) : "",
      body = messageText(message?.payload).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, 5000),
      financial = financialIntent(`${subject}\n${body}`);
    const newsletter =
      message && header(message, "list-unsubscribe") && !financial;
    await commit(async (db, tx) => {
      if (!message || ignored || newsletter) {
        if (await optionalRow("mail_messages", id, db, tx))
          await db.deleteRow(params("mail_messages", id, tx));
      } else {
        const receivedAt = new Date(Number(message.internalDate));
        if (!Number.isFinite(receivedAt.getTime()))
          throw new Error("Invalid message date");
        const priorAnalysis = await optionalRow("message_analyses", id, db, tx);
        const priorMessage = priorAnalysis ? await optionalRow("mail_messages", id, db, tx) : null;
        await db.upsertRow({
          ...params("mail_messages", id, tx),
          permissions: [],
          data: {
            workspaceId: job.workspaceId,
            connectionVersion: job.connectionVersion,
            providerId,
            threadId: message.threadId,
            sender: header(message, "from").slice(0, 512),
            subject,
            receivedAt: receivedAt.toISOString(),
            unread: message.labelIds?.includes("UNREAD") || false,
            financial: priorMessage?.financial === true,
            contentJson: JSON.stringify({
              text: body,
              source: "gmail", bodyTruncated: messageText(message.payload).length > 5000,
              snippet: message.snippet?.slice(0, 1000) || "",
              to: header(message, "to").slice(0, 2000),
              labels: message.labelIds || [],
            }),
          },
        });
        // Import supported attachments before classification; discovered content cannot be evidence.
        let imports = 0;
        for (const address of [
          header(message, "from"),
          ...header(message, "to").split(",").slice(0, 10),
        ]) {
          const email = emailAddress(address);
          if (!email || email === mailbox.toLowerCase()) continue;
          const contactId = stableId(
              job.workspaceId,
              job.connectionVersion,
              email,
            ),
            prior = await optionalRow("contacts", contactId, db, tx);
          if (!prior || prior.lastSeenAt < receivedAt.toISOString())
            await db.upsertRow({
              ...params("contacts", contactId, tx),
              permissions: [],
              data: {
                workspaceId: job.workspaceId,
                connectionVersion: job.connectionVersion,
                email,
                displayName:
                  address
                    .replace(/<[^>]*>/g, "")
                    .replace(/"/g, "")
                    .trim()
                    .slice(0, 320) || email,
                lastSeenAt: receivedAt.toISOString(),
              },
            });
        }
        for (const attachment of attachments(message.payload).slice(0, 10)) {
          const documentId = stableId(
            job.workspaceId,
            job.connectionVersion,
            providerId,
            attachment.body!.attachmentId!,
          );
          if (!(await optionalRow("documents", documentId, db, tx)))
            await db.createRow({
              ...params("documents", documentId, tx),
              permissions: [],
              data: {
                workspaceId: job.workspaceId,
                connectionVersion: job.connectionVersion,
                messageId: providerId,
                attachmentId: attachment.body!.attachmentId!,
                filename: attachment
                  .filename!.replace(/[\u0000-\u001f/\\]/g, "_")
                  .slice(0, 255),
                mimeType: (
                  attachment.mimeType || "application/octet-stream"
                ).slice(0, 128),
                size: attachment.body!.size || 0,
                fileId: "",
                status: "discovered",
              },
            });
          if (/\.(pdf|txt|docx|xlsx)$/i.test(attachment.filename || "") && (attachment.body?.size || 0) > 0 && (attachment.body?.size || 0) <= 5 * 1024 * 1024) {
            imports++;
            if (!priorAnalysis) await enqueue({ ...job, kind: "document-import", key: documentId, payload: { documentId, analysisMessageId: id } }, db, tx);
          }
        }
        if (!priorAnalysis && !imports) await enqueue({ ...job, kind: "financial-analyze", key: id, payload: { messageId: id } }, db, tx);
      }
      state.pending = state.pending.filter((p) => p !== providerId);
      await save(db, tx);
    });
  }
  if (state.pending.length) return true;
  state.pageToken = state.nextToken;
  state.pageLoaded = false;
  if (!state.pageToken) {
    state.historyId = state.targetHistory;
    state.phase = "history";
    state.baseline = "";
  }
  // Renew well before Google's seven-day expiry. A watch cursor never replaces the sync cursor.
  const topic = process.env.GMAIL_PUBSUB_TOPIC;
  if (topic && state.watchExpires < Date.now() + 24 * 60 * 60 * 1000) {
    const watch = await gmailRequest<{ expiration: string }>(
      token,
      "watch",
      {},
      { topicName: topic },
    );
    state.watchExpires = Number(watch.expiration);
  }
  await commit(save);
  return Boolean(state.pageToken);
}
export async function currentMailVersion(workspaceId: string) {
  const page = await dataDatabase().listRows({
    ...params("integrations"),
    queries: [
      Query.equal("workspaceId", workspaceId),
      Query.equal("provider", "gmail"),
      Query.isNull("disconnectedAt"),
      Query.limit(1),
    ],
  });
  return page.rows[0]?.connectionVersion as string | undefined;
}
