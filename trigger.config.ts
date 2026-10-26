import { defineConfig } from "@trigger.dev/sdk";
export default defineConfig({
  project: "proj_cqxbynufijfqpzbaythz",
  runtime: "node",
  dirs: ["./src/trigger"],
  maxDuration: 120,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
