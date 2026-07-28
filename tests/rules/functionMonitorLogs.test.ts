/**
 * function_monitor_logs — firestore.rules CF-only lockdown tests (PR-S1)
 * ─────────────────────────────────────────────────────────────────────────────
 * The `function_monitor_logs/{logId}` collection was an unwired client-side POC
 * that exposed function stack traces to ANY authenticated user (read + write).
 * PR-S1 killed it: its rule is now `allow read, write: if false` — fully CF-only.
 * NO client context may read or write it, INCLUDING admins (if monitoring is ever
 * revived it writes via the Admin SDK, whose privileges bypass rules).
 *
 * This suite proves the lockdown holds for every auth context. It also asserts
 * default-deny for the two blocks PR-S1 REMOVED entirely — `sessions` (orphan,
 * presence migrated to Realtime DB) and `function_monitor_errors` (phantom, no
 * code path) — a plain authenticated user can no longer read or write them.
 *
 * Runs against the Firestore Emulator via the Pre-H.0.0.D infrastructure
 * (firestore.rules.test + tests/rules/setup.ts HARD GUARD).
 *
 * Coverage:
 *   function_monitor_logs — 8 scenarios (4 contexts × {read, write}):
 *     unauthenticated  → read DENY, write DENY
 *     employee         → read DENY, write DENY
 *     admin            → read DENY, write DENY  (even an admin client token
 *                        cannot read; only the Admin SDK can)
 *     partner          → read DENY, write DENY
 *   sessions / function_monitor_errors — default-deny (authenticated read+write DENY)
 */
import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { FIXTURES, makeTestEnv } from './setup';

let env: RulesTestEnvironment;

const LOG_DOC_PATH = 'function_monitor_logs/log-fixture-001';
const SESSION_DOC_PATH = 'sessions/session-fixture-001';
const MONITOR_ERROR_DOC_PATH = 'function_monitor_errors/error-fixture-001';

beforeAll(async () => {
  env = await makeTestEnv();
});

afterAll(async () => {
  if (env) {
    await env.cleanup();
  }
});

beforeEach(async () => {
  if (env) {
    await env.clearFirestore();
  }
});

type DocCtx = {
  firestore: () => {
    doc: (p: string) => {
      get: () => Promise<unknown>;
      set: (data: Record<string, unknown>) => Promise<unknown>;
    };
  };
};

function readDoc(ctx: DocCtx, path: string): Promise<unknown> {
  return ctx.firestore().doc(path).get();
}

function writeDoc(ctx: DocCtx, path: string): Promise<unknown> {
  return ctx.firestore().doc(path).set({ stack: 'at fn (file.js:1:1)' });
}

describe('function_monitor_logs — fully CF-only (allow read, write: if false)', () => {
  it('DENIES unauthenticated read', async () => {
    await assertFails(readDoc(env.unauthenticatedContext() as never, LOG_DOC_PATH));
  });

  it('DENIES unauthenticated write', async () => {
    await assertFails(writeDoc(env.unauthenticatedContext() as never, LOG_DOC_PATH));
  });

  it('DENIES employee read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(readDoc(ctx as never, LOG_DOC_PATH));
  });

  it('DENIES employee write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(writeDoc(ctx as never, LOG_DOC_PATH));
  });

  it('DENIES admin read (client SDK — even admin cannot read; only the Admin SDK can)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(readDoc(ctx as never, LOG_DOC_PATH));
  });

  it('DENIES admin write (client SDK — monitoring writes go through the Admin SDK)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(writeDoc(ctx as never, LOG_DOC_PATH));
  });

  it('DENIES partner read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertFails(readDoc(ctx as never, LOG_DOC_PATH));
  });

  it('DENIES partner write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertFails(writeDoc(ctx as never, LOG_DOC_PATH));
  });
});

describe('sessions — removed block falls to default-deny (PR-S1)', () => {
  it('DENIES authenticated read (block removed — orphan, presence in Realtime DB)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(readDoc(ctx as never, SESSION_DOC_PATH));
  });

  it('DENIES authenticated write (block removed — orphan, presence in Realtime DB)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(writeDoc(ctx as never, SESSION_DOC_PATH));
  });
});

describe('function_monitor_errors — removed block falls to default-deny (PR-S1)', () => {
  it('DENIES authenticated read (block removed — phantom, no code path)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(readDoc(ctx as never, MONITOR_ERROR_DOC_PATH));
  });

  it('DENIES authenticated write (block removed — phantom, no code path)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(writeDoc(ctx as never, MONITOR_ERROR_DOC_PATH));
  });
});
