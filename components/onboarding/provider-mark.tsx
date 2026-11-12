import type { Provider } from "@/lib/workspaces/types";
import { IntegrationMark } from "@/components/integration-mark";

export function ProviderMark({ provider, size = 28 }: { provider: Provider; size?: number }) {
  return <IntegrationMark provider={provider} size={size} />;
}
