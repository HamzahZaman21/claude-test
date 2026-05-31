import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Unit/logic tests only. Playwright e2e lives in e2e/ and runs separately.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
    // The forge engine runs the full suite per task in an isolated worktree. Tasks
    // that add no unit tests (e.g. UI components, tested via Playwright in Phase E)
    // must not fail the runner before the engine test file is merged.
    passWithNoTests: true,
  },
});
