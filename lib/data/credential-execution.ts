import { AsyncLocalStorage } from "node:async_hooks";
const execution = new AsyncLocalStorage<boolean>();
/** Set by the private Function or dedicated server worker, never browser/API routes. */
export const withCredentialExecution = <T>(run: () => Promise<T>) =>
  execution.run(true, run);
export function assertCredentialExecution() {
  if (!execution.getStore())
    throw new Error(
      "Credential execution is restricted to the private background runtime.",
    );
}
