import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppwriteException, type TablesDB, type Storage } from "node-appwrite";
/** Optional operator transport. Uses the authenticated CLI without extracting its
 * credentials. Restricted to schema and migration-journal commands. */
export function cliSchemaClient(project: string, endpoint: string): TablesDB {
  return cliOperatorClient(project, endpoint, "tablesdb") as TablesDB;
}
export function cliStorageClient(project: string, endpoint: string): Storage {
  return cliOperatorClient(project, endpoint, "storage") as Storage;
}
function cliOperatorClient(
  project: string,
  endpoint: string,
  service: "tablesdb" | "storage",
) {
  const configFile = resolve("appwrite.config.json");
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  if (
    config.projectId !== project ||
    config.endpoint?.replace(/\/$/, "") !== endpoint.replace(/\/$/, "")
  )
    throw new Error("CLI configuration does not match the requested target.");
  const allowed = new Set([
    ...(service === "storage" ? ["getBucket", "createBucket"] : []),
    "getTable",
    "createTable",
    "createVarcharColumn",
    "createMediumtextColumn",
    "createTextColumn",
    "createBooleanColumn",
    "createDatetimeColumn",
    "createIntegerColumn",
    "createIndex",
    "createTransaction",
    "updateTransaction",
    "getRow",
    "createRow",
    "updateRow",
    "upsertRow",
  ]);
  return new Proxy(
    {},
    {
      get(_target, method) {
        if (typeof method !== "string" || !allowed.has(method))
          throw new Error("Unsupported schema CLI operation.");
        return async (params: Record<string, unknown>) => {
          if (method.endsWith("Row") && params.tableId !== "schema_migrations")
            throw new Error(
              "CLI transport can only mutate the migration journal, never domain records.",
            );
          const args = [
            service,
            method.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
            "--config-file",
            configFile,
            "--raw",
            "--force",
          ];
          for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            const flag = `--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
            if (Array.isArray(value)) {
              for (const item of value)
                args.push(
                  flag,
                  typeof item === "object"
                    ? JSON.stringify(item)
                    : String(item),
                );
            } else if (typeof value === "boolean")
              args.push(`${flag}=${value}`);
            else
              args.push(
                flag,
                typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value),
              );
          }
          const result = spawnSync("appwrite", args, {
            encoding: "utf8",
            timeout: 60000,
            maxBuffer: 2 * 1024 * 1024,
          });
          if (result.status !== 0) {
            const diagnostic = `${result.stderr}${result.stdout}`;
            if (/not found|404|could not be found/i.test(diagnostic))
              throw new AppwriteException(
                "Resource not found",
                404,
                "row_not_found",
              );
            if (/already exists|409/i.test(diagnostic))
              throw new AppwriteException("Resource exists", 409);
            if (
              /limit|quota|upgrade|plan.*allow|maximum.*table/i.test(diagnostic)
            )
              throw new Error(
                "Appwrite plan capacity does not permit these additive tables. No legacy records were changed; no automatic plan upgrade was attempted.",
              );
            throw new Error(
              `Appwrite CLI ${method} failed; check operator access and schema state.`,
            );
          }
          const value = JSON.parse(result.stdout || "{}");
          if (method === "getTable")
            return {
              ...value,
              $permissions: value.$permissions ?? [],
              columns: value.columns ?? [],
              indexes: value.indexes ?? [],
            };
          return value;
        };
      },
    },
  );
}
