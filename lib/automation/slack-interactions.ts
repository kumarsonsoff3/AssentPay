import { InputError } from "../workspaces/validation";
const tokenActions = ["assentpay_link", "assentpay_approve", "assentpay_reject", "assentpay_remind", "assentpay_save_memory"] as const;
export type SlackTokenAction = typeof tokenActions[number];
export function reviewAction(
  workspaceId: string,
  workflowId: string,
  proposalHash: string,
  connectionVersion: string,
  ownerId: string,
) {
  return JSON.stringify({
    workspaceId,
    workflowId,
    proposalHash,
    connectionVersion,
    ownerId,
  });
}
export function parseReviewInteraction(raw: string) {
  const form = new URLSearchParams(raw);
  if (form.getAll("payload").length !== 1)
    throw new InputError("Invalid Slack interaction.");
  let body;
  try {
    body = JSON.parse(form.get("payload")!);
  } catch {
    throw new InputError("Invalid Slack interaction.");
  }
  if (
    body.type !== "block_actions" ||
    !/^[A-Z0-9]+$/.test(body.team?.id || "") ||
    !/^[UW][A-Z0-9]+$/.test(body.user?.id || "") ||
    body.actions?.length !== 1
  )
    throw new InputError("Invalid Slack interaction.");
  const action = body.actions[0];
  if (
    tokenActions.includes(action.action_id)
  ) {
    if (
      typeof action.value !== "string" ||
      !/^[a-f0-9]{64}$/.test(action.value)
    )
      throw new InputError("Invalid Slack action token.");
    return {
      token: action.value as string,
      teamId: body.team.id as string,
      slackUserId: body.user.id as string,
      action: action.action_id as SlackTokenAction,
    } as {
      token: string;
      teamId: string;
      slackUserId: string;
      action: SlackTokenAction;
      workspaceId?: never;
    };
  }
  if (action.action_id !== "assentpay_review")
    throw new InputError("Unsupported review action.");
  let value;
  try {
    value = JSON.parse(action.value);
  } catch {
    throw new InputError("Invalid review binding.");
  }
  for (const key of ["workspaceId", "workflowId", "ownerId"])
    if (
      typeof value[key] !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(value[key])
    )
      throw new InputError("Invalid review binding.");
  if (
    !/^[a-f0-9]{64}$/.test(value.proposalHash) ||
    !/^[a-f0-9]{32}$/.test(value.connectionVersion)
  )
    throw new InputError("Invalid review binding.");
  return {
    ...value,
    teamId: body.team.id as string,
    slackUserId: body.user.id as string,
    action: action.action_id as string,
  } as {
    workspaceId: string;
    workflowId: string;
    ownerId: string;
    proposalHash: string;
    connectionVersion: string;
    teamId: string;
    slackUserId: string;
    action: string;
  };
}
