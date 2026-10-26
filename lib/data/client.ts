import { Client, TablesDB } from "node-appwrite";
import { dataApiKey } from "./config";
import { AuthConfigurationError } from "../errors";
import { AsyncLocalStorage } from "node:async_hooks";
const executionClient = new AsyncLocalStorage<Client>();
export const withDataClient = <T>(client: Client, run: () => Promise<T>) =>
  executionClient.run(client, run);
export function dataClient() {
  const injected = executionClient.getStore();
  if (injected) return injected;
  const endpoint = process.env.APPWRITE_ENDPOINT,
    project = process.env.APPWRITE_PROJECT_ID;
  if (!endpoint || !project)
    throw new AuthConfigurationError("Appwrite data access is not configured.");
  return new Client()
    .setEndpoint(endpoint)
    .setProject(project)
    .setKey(dataApiKey());
}
export const databaseId = () => process.env.APPWRITE_DATABASE_ID || "assentpay";
export const dataDatabase = () => new TablesDB(dataClient());
