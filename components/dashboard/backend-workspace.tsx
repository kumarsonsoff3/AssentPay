import { createHash } from "node:crypto";
import { readResources, type Resource } from "@/lib/automation/resources";
import { LiveResource, type ResourcePage, type WorkflowView } from "./live-resource";
import { Suspense, type ComponentProps } from "react";
import { ResourceLoading } from "./states";

export function BackendWorkspace(props: ComponentProps<typeof ResourceContent>) {
  return <Suspense fallback={<ResourceLoading title="Loading workspace records…" />}>
    <ResourceContent {...props} />
  </Suspense>;
}

async function ResourceContent({
  workspaceId,
  userId,
  resource,
  canManage,
  timeZone,
  workflowId,
  messageId,
  workflowView,
}: {
  workspaceId: string;
  userId: string;
  resource: Resource;
  canManage: boolean;
  timeZone?: string;
  workflowId?: string;
  messageId?: string;
  workflowView?: WorkflowView;
}) {
  const data = await readResources(workspaceId, resource, userId, undefined, workflowId, messageId);
  return (
    <LiveResource
      key={`${workspaceId}:${resource}:${workflowView ?? ""}:${workflowId ?? messageId ?? ""}`}
      revision={createHash("sha256").update(JSON.stringify(data)).digest("base64url")}
      workspaceId={workspaceId}
      resource={resource}
      workflowView={workflowView}
      focusedWorkflow={workflowId}
      initial={data as ResourcePage}
      canManage={canManage}
      canSyncGmail={resource === "messages" && process.env.GMAIL_OAUTH_ENABLED === "true"}
      timeZone={timeZone}
    />
  );
}
