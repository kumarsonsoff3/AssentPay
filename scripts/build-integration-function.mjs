import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";
const out = ".function-build/integration-runtime";
await mkdir(out, { recursive: true });
const options = {
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  external: ["node-appwrite", "pdf-parse", "fflate", "saxes"],
  sourcemap: false,
  logLevel: "warning",
};
await build({
  ...options,
  entryPoints: ["functions/integration-runtime/index.ts"],
  outfile: `${out}/index.js`,
});
await build({
  ...options,
  entryPoints: ["scripts/verify-integration-runtime.mts"],
  outfile: `${out}/verify-runtime.mjs`,
});
for (const file of ["package.json", "package-lock.json"])
  await copyFile(`functions/integration-runtime/${file}`, `${out}/${file}`);
console.log(
  "Private integration Function bundle, locked dependencies and offline runtime verifier built (no environment values included).",
);
