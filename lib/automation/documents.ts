import { Storage } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { dataClient } from "../data/client";
import { InputError } from "../workspaces/validation";
import { gmailRequest } from "./gmail-client";
import { gmailCredentials, type GuardedCommit } from "./gmail-sync";
import { documentBucketId, maximumDocumentSize } from "./schema";
import { enqueue, optionalRow, params, stableId, type Job } from "./store";
const extensions: Record<string, string[]> = {
  pdf: ["application/pdf"],
  txt: ["text/plain"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};
export function validateDocument(
  filename: string,
  mimeType: string,
  size: number,
) {
  const extension = filename.split(".").at(-1)?.toLowerCase() || "";
  if (
    !extensions[extension]?.includes(mimeType) ||
    size <= 0 ||
    size > maximumDocumentSize
  )
    throw new InputError(
      "Import a PDF, text, Word (.docx), or Excel (.xlsx) document up to 5 MiB.",
      400,
    );
}
export async function importDocument(job: Job, commit: GuardedCommit) {
  const { documentId, analysisMessageId } = JSON.parse(job.payloadJson),
    doc = await optionalRow("documents", documentId);
  if (
    !doc ||
    doc.workspaceId !== job.workspaceId ||
    doc.connectionVersion !== job.connectionVersion
  )
    throw new InputError("Document not found.", 404);
  if (doc.status === "stored") {
    if (analysisMessageId) await commit((db, tx) => enqueue({ ...job, kind: "financial-analyze", key: analysisMessageId, payload: { messageId: analysisMessageId } }, db, tx));
    return;
  }
  validateDocument(doc.filename, doc.mimeType, doc.size);
  const { token } = await gmailCredentials(job),
    attachment = await gmailRequest<{ data: string; size: number }>(
      token,
      `messages/${encodeURIComponent(doc.messageId)}/attachments/${encodeURIComponent(doc.attachmentId)}`,
    );
  const bytes = Buffer.from(attachment.data, "base64url");
  if (bytes.length !== doc.size || bytes.length !== attachment.size)
    throw new InputError("Attachment size changed.", 409);
  validateDocument(doc.filename, doc.mimeType, bytes.length);
  const extension = doc.filename.split(".").at(-1)?.toLowerCase();
  if (extension === "pdf" && !bytes.subarray(0, 5).equals(Buffer.from("%PDF-")))
    throw new InputError("Attachment is not a PDF document.");
  if (
    ["docx", "xlsx"].includes(extension || "") &&
    !bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  )
    throw new InputError("Attachment is not an Office document.");
  if (extension === "txt") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new InputError("Text documents must be UTF-8.");
    }
  }
  const fileId = stableId(job.workspaceId, job.connectionVersion, doc.$id),
    storage = new Storage(dataClient());
  const existing = await storage
    .getFile({ bucketId: documentBucketId, fileId })
    .catch((e) => {
      if (e?.code === 404) return null;
      throw e;
    });
  if (!existing)
    await storage.createFile({
      bucketId: documentBucketId,
      fileId,
      file: InputFile.fromBuffer(bytes, doc.filename),
      permissions: [],
    });
  else if (
    existing.sizeOriginal !== bytes.length ||
    existing.$permissions.length
  )
    throw new Error("Stored attachment failed validation");
  await commit(async (db, tx) => {
    await db.updateRow({
      ...params("documents", doc.$id, tx),
      data: { fileId, status: "stored" },
    });
    if (analysisMessageId) await enqueue({ ...job, kind: "financial-analyze", key: analysisMessageId, payload: { messageId: analysisMessageId } }, db, tx);
  });
}
