/**
 * Rules-test environment setup (Pre-H.0.0.D, 2026-05-29)
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared test-environment factory for all `tests/rules/*.test.ts` suites.
 *
 * ─── HARD GUARDS (devils-advocate Attack #2 — fixture leak to PROD) ─────────
 * 1. Refuses to boot without `FIRESTORE_EMULATOR_HOST` env var. If a developer
 *    runs `npm run test:rules` outside `firebase emulators:exec`, an explicit
 *    error tells them how to start the emulator. Prevents accidental writes
 *    to production Firestore.
 *
 * 2. Hardcoded `projectId: 'demo-rules-test'`. Firebase reserves the `demo-`
 *    prefix for emulator-only projects — production endpoints REFUSE to serve
 *    requests for such projects. Belt-and-suspenders defense against accidental
 *    PROD connection.
 *
 * ─── PUBLIC-repo discipline ──────────────────────────────────────────────────
 * Fixtures use synthetic ids/emails. NEVER real user identities.
 *   - UIDs:    `test-{role}-uid-NNN`
 *   - Emails:  `{role}-fixture@example.com`
 */
import * as fs from 'fs';
import * as path from 'path';

import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

/**
 * Test-only project id. Firebase reserves the `demo-` prefix for emulator
 * use; production endpoints refuse to serve this id.
 */
export const TEST_PROJECT_ID = 'demo-rules-test';

const TEST_RULES_PATH = path.resolve(__dirname, '../../firestore.rules.test');

/**
 * Initializes a test environment connected to the local Firestore emulator.
 *
 * @throws if FIRESTORE_EMULATOR_HOST is not set — fail-loud rather than
 *         silently attempt a PROD connection (devils-advocate Attack #2).
 */
export async function makeTestEnv(): Promise<RulesTestEnvironment> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      'Rules tests require the Firestore Emulator. Run via:\n' +
      '  npx firebase emulators:exec --only firestore,auth "npm run test:rules"\n' +
      'OR set FIRESTORE_EMULATOR_HOST=localhost:8080 + FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 manually.'
    );
  }

  const rules = fs.readFileSync(TEST_RULES_PATH, 'utf8');

  return initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: { rules }
  });
}

/**
 * Synthetic fixture UIDs — PUBLIC-repo safe. NEVER use real identities.
 */
export const FIXTURES = {
  partnerUid: 'test-partner-uid-001',
  adminUid: 'test-admin-uid-001',
  employeeUid: 'test-employee-uid-001',
  anonUid: 'test-anon-uid-001'
} as const;
