import { InputError, effectiveRole } from "./validation";
import type { WorkspaceRole } from "./types";

export function assertWorkspaceMembership(member: { teamId: string; userId: string; confirm: boolean; roles: string[] } | undefined, teamId: string, userId: string, allowedRoles?: WorkspaceRole[]) {
  if (!member || member.teamId !== teamId || member.userId !== userId || member.confirm !== true)
    throw new InputError("You do not have access to this workspace.", 403);
  const role = effectiveRole(member.roles);
  if (allowedRoles && !allowedRoles.includes(role))
    throw new InputError("Your workspace role does not permit this action.", 403);
  return role;
}
