import { readResources, type Resource } from "@/lib/automation/resources";
import { LiveResource, type ResourcePage } from "./live-resource";
export async function BackendWorkspace({
  workspaceId,
  userId,
  resource,
  canManage,
  timeZone,
  workflowId,
}: {
  workspaceId: string;
  userId: string;
  resource: Resource;
  canManage: boolean;
  timeZone?: string;
  workflowId?: string;
}) {
  const data = await readResources(workspaceId, resource, userId, undefined, workflowId);
  return (
    <LiveResource
      key={JSON.stringify(data)}
      workspaceId={workspaceId}
      resource={resource}
      initial={data as ResourcePage}
      canManage={canManage}
      timeZone={timeZone}
    />
  );
}
