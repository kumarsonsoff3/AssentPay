import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["components/icons.tsx", "components/integration-mark.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{ name: "lucide-react", message: "Use the shared Phosphor icons from @/components/icons." }],
        patterns: [{ group: ["react-icons", "react-icons/*"], message: "Use @/components/icons or @/components/integration-mark for consistent sizing, colors and accessibility." }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".trigger/**",
    ".function-build/**",
    "bin/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
