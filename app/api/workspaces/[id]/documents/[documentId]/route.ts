import { Storage } from "node-appwrite";
import {
  apiUser,
  workspaceAccess,
  workspaceStore,
} from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { InputError, validId } from "@/lib/workspaces/validation";
import { currentMailVersion } from "@/lib/automation/gmail-sync";
import { optionalRow, enqueue, stableId } from "@/lib/automation/store";
import { documentBucketId } from "@/lib/automation/schema";
import { validateDocument } from "@/lib/automation/documents";
import { dataClient } from "@/lib/data/client";
import { withStorageOperation } from "@/lib/data/coordinator";
import { connectionId } from "@/lib/integrations/records";
type Context = { params: Promise<{ id: string; documentId: string }> };
async function document(workspaceId: string, id: string) {
  validId(id);
  const row = await optionalRow("documents", id),
    version = await currentMailVersion(workspaceId);
  if (row?.workspaceId === workspaceId) {
    const message = await optionalRow("mail_messages", stableId(workspaceId, "resend", row.messageId));
    if (message?.workspaceId === workspaceId && message.connectionVersion === row.connectionVersion) return row;
  }
  if (
    !row ||
    row.workspaceId !== workspaceId ||
    !version ||
    row.connectionVersion !== version ||
    !(await optionalRow(
      "mail_messages",
      stableId(workspaceId, version, row.messageId),
    ))
  )
    throw new InputError("Document not found.", 404);
  return row;
}
export async function POST(request: Request, { params }: Context) {
  try {
    const { id, documentId } = await params;
    await inputBody(request);
    const user = await apiUser();
    await workspaceAccess(id, user.$id, ["owner", "admin"]);
    rateLimit("document-import", user.$id, 20);
    const doc = await document(id, documentId);
    validateDocument(doc.filename, doc.mimeType, doc.size);
    const connection = await workspaceStore(user.$id).integration(id, "gmail");
    if (!connection || connection.disconnected)
      throw new InputError("Connection unavailable.", 409);
    const jobId = await withStorageOperation("mutation", () =>
      enqueue({
        workspaceId: id,
        integrationId: connectionId(id, "gmail"),
        connectionVersion: doc.connectionVersion,
        requestedBy: connection.record.connectedBy,
        kind: "document-import",
        key: documentId,
        payload: { documentId },
        force: true,
      }),
    );
    return json({ jobId, status: "queued" }, 202);
  } catch (e) {
    return apiError(e);
  }
}
export async function GET(_request: Request, { params }: Context) {
  try {
    const { id, documentId } = await params,
      user = await apiUser();
    await workspaceAccess(id, user.$id);
    const doc = await document(id, documentId);
    if (doc.status !== "stored" || !doc.fileId)
      throw new InputError("Import this attachment first.", 409);
    const data = await new Storage(dataClient()).getFileDownload({
      bucketId: documentBucketId,
      fileId: doc.fileId,
    });
    return new Response(data, {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
