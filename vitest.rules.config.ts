/**
 * Vitest config for rules-emulator tests (Pre-H.0.0.D, 2026-05-29)
 * ─────────────────────────────────────────────────────────────────────────────
 * Run via: `npm run test:rules:emulator` (inside `firebase emulators:exec`).
 *
 * Why this is a SEPARATE config (not just `vitest run tests/rules/`):
 *   Vitest treats positional arguments as a FILTER on the `include` glob —
 *   not as an override. Since the main `vitest.config.ts` excludes
 *   `tests/rules/**` from `include` (HARD GUARD: rules tests require an
 *   emulator and would throw without one), passing `tests/rules/` as a
 *   positional arg returns "No test files found".
 *
 *   This config explicitly sets `include` to `tests/rules/**` so the
 *   emulator-only suite can run when invoked through the dedicated script.
 *   The default `npm test` flow is unaffected — it still uses the main
 *   `vitest.config.ts` which excludes rules tests.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],
    // Emulator boot + Firestore write/read can be slow on cold CI runners.
    // Bumped from the default 10s to account for first-test cold path.
    testTimeout: 20000,
    hookTimeout: 20000
  }
});
