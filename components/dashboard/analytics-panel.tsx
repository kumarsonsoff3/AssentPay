import { readAnalytics } from "@/lib/dashboard/analytics-server";
import { AnalyticsWorkspace } from "./analytics-workspace";
import styles from "./analytics-workspace.module.css";

export async function AnalyticsPanel({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const data = await readAnalytics(workspaceId).catch(() => null);
  return <div className={styles.route}><AnalyticsWorkspace key={workspaceId} workspaceId={workspaceId} userId={userId} data={data} /></div>;
}
