import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Non-application code: Node hook scripts, Playwright e2e, supabase functions.
    ".claude/**",
    "e2e/**",
    "supabase/**",
  ]),
  {
    // Async effects (session bootstrap, snapshot + realtime subscriptions) legitimately
    // setState after an await; this rule targets *synchronous* setState in effect bodies.
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
