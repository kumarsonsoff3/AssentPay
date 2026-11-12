import {
  apiUser,
  workspaceAccess,
  workspaceStore,
} from "@/lib/workspaces/server";
import { apiError, inputBody, json, rateLimit } from "@/lib/workspaces/http";
import { withStorageOperation } from "@/lib/data/coordinator";
import { enqueue, retryJob } from "@/lib/automation/store";
import { connectionId } from "@/lib/integrations/records";
import { InputError } from "@/lib/workspaces/validation";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params,
      input = await inputBody(request),
      user = await apiUser();
    await workspaceAccess(id, user.$id, ["owner", "admin"]);
    rateLimit("automation", user.$id, 20);
    return await withStorageOperation("mutation", async () => {
      let jobId: string;
      if (input.action === "retry")
        jobId = await retryJob(id, String(input.jobId));
      else if (input.action === "sync") {
        const connection = await workspaceStore(user.$id).integration(
          id,
          "gmail",
        );
        if (!connection || connection.disconnected)
          throw new InputError("Connect Gmail before synchronizing.", 409);
        jobId = await enqueue({
          workspaceId: id,
          integrationId: connectionId(id, "gmail"),
          connectionVersion: connection.record.version,
          requestedBy: connection.record.connectedBy,
          kind: "gmail-sync",
          key: "mailbox",
          force: true,
        });
      } else throw new InputError("Unknown automation action.");
      return json({ jobId, status: "queued" }, 202);
    });
  } catch (e) {
    return apiError(e);
  }
}
