import { recordId } from "../workspaces/ids";
import type { Provider, IntegrationSummary } from "../workspaces/types";
export type IntegrationRecord = IntegrationSummary & {
  scopes: string;
  externalId?: string;
  channelId?: string;
  credentials: string;
  connectedBy: string;
  version: string;
};
export const connectionId = (id: string, provider: Provider) =>
  recordId("i", id, provider);
