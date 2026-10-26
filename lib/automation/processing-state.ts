type JobState = { kind: string; status: string; attempts: number; createdAt: string; errorCode: string };
const failures: Record<string, [string, string]> = {
  AI_NOT_CONFIGURED: ["The AI provider key or model is not configured.", "Ask an admin to configure the analysis worker before retrying."],
  AI_DATA_POLICY_BLOCKED: ["The model rejected the request under the current data privacy policy.", "Ask an admin to configure a model/provider compatible with the workspace privacy policy."],
  AI_ACCESS_DENIED: ["The AI provider rejected the configured credentials or access.", "Ask an admin to check the provider key and model access."],
  AI_CREDITS_REQUIRED: ["The AI provider requires credits for this request.", "Ask an admin to check the provider balance or select an available model."],
  AI_MODEL_UNAVAILABLE: ["The configured model has no available endpoint.", "Ask an admin to check the selected model."],
  AI_RATE_LIMITED: ["The AI provider temporarily limited requests.", "Wait for the scheduled retry."],
  AI_PROVIDER_UNAVAILABLE: ["The AI provider could not complete the request.", "Wait for the scheduled retry, or retry a failed task after checking the provider."],
  AI_INVALID_OUTPUT: ["The model response was incomplete or failed the extraction checks.", "No financial proposal was accepted. Retry or review the source email manually."],
  RESEND_RECEIVING_ACCESS_DENIED: ["Resend denied access to the received email.", "Ask an admin to check receiving access before retrying."],
  RESEND_MESSAGE_UNAVAILABLE: ["The received message could not be retrieved from Resend.", "Ask an admin to check the original delivery before retrying."],
  SLACK_NOT_CONNECTED: ["Slack is not connected for this workspace.", "Connect Slack in workspace settings, then retry the alert."],
  SLACK_DESTINATION_REQUIRED: ["A valid Slack review destination has not been selected.", "Choose a review channel in workspace settings."],
  SLACK_OWNER_SCOPE_REQUIRED: ["Owner DMs require Slack email lookup permission.", "Use the configured review channel, or reconnect Slack for owner DMs."],
  SLACK_OWNER_MAPPING_REQUIRED: ["The owner could not be matched to a verified account in the connected Slack team.", "Check the owner’s verified email and Slack connection."],
  SLACK_RATE_LIMITED: ["Slack temporarily limited review alerts.", "Wait for the scheduled retry."],
  SLACK_DELIVERY_REJECTED: ["Slack rejected the review alert.", "Check the Slack connection and destination before retrying."],
  ACCESS_OR_CONNECTION_CHANGED: ["The workspace access or connection changed after this task was queued.", "Ask an owner or admin to review the connection and permissions."],
};
export function processingState(job: JobState, now = Date.now()) {
  const overdue = job.status === "queued" && job.attempts === 0 && now - Date.parse(job.createdAt) > 5 * 60000;
  const issue = failures[job.errorCode];
  if (job.status === "completed") return { label: "Completed", reason: "This task completed successfully.", nextStep: "", needsAttention: false };
  if (job.status === "running") return { label: "In progress", reason: "A worker has claimed this task and is processing it.", nextStep: "No action is needed while processing continues.", needsAttention: false };
  if (job.status === "cancelled") return { label: "Stopped", reason: issue?.[0] || "This task was cancelled before it could complete.", nextStep: issue?.[1] || "Ask an owner or admin to review why it was stopped before retrying.", needsAttention: true };

  if (job.status === "retry" || job.status === "failed") return { label: job.status === "retry" ? "Retry scheduled" : "Needs attention", reason: issue?.[0] || (job.errorCode ? "The last processing attempt failed. No more specific cause was recorded." : "This task could not complete; no service error was recorded."), nextStep: issue?.[1] || (job.status === "retry" ? "Wait for the next attempt; a worker must be running to pick it up." : "Review the technical details or ask an admin before retrying."), needsAttention: job.status === "failed" };
  if (job.status === "queued") return { label: overdue ? "Waiting for a worker" : "Waiting to start", reason: `${overdue ? "No worker has attempted this task in more than five minutes." : "The task is queued and has not yet been claimed by a worker."}`, nextStep: overdue ? "Ask an admin to check the background worker. Queue age alone cannot confirm whether it is offline or busy." : "The background worker will pick it up. Financial-action approval is separate.", needsAttention: overdue };
  return { label: "Status unavailable", reason: "The saved processing status is not recognized.", nextStep: "Ask an admin to inspect the task details.", needsAttention: true };
}
