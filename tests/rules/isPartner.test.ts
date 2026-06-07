/**
 * isPartner() — firestore.rules helper unit tests (Pre-H.0.0.D)
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the partner-role gate against the test ruleset (firestore.rules.test).
 * The test ruleset mirrors the production helper bodies via
 * tests/rules/rules-drift-guard.test.ts (string-equality check between files).
 *
 * Coverage — 11 scenarios:
 *
 *   String-typed role values (7):
 *     (1) Unauthenticated request                  → DENY
 *     (2) Authenticated, no `role` claim            → DENY
 *     (3) Authenticated, role = 'admin' (cross)    → DENY
 *     (4) Authenticated, role = 'partner' (canon)  → ALLOW
 *     (5) Authenticated, role = 'employee'         → DENY
 *     (6) Authenticated, role = '' (empty)         → DENY
 *     (7) Authenticated, role = ' partner ' (ws)   → DENY (strict ==)
 *
 *   Type-confusion (devils-advocate Attack #5, 4 added):
 *     (8)  role = null                             → DENY
 *     (9)  role = ['partner'] (array)              → DENY (type mismatch)
 *     (10) role = { partner: true } (object)       → DENY (type mismatch)
 *     (11) role = 1 (number)                       → DENY (type mismatch)
 */
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { FIXTURES, makeTestEnv } from './setup';

let env: RulesTestEnvironment;

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

/**
 * Helper: attempt a read on the test-only `/_test_partner_only/{doc}` path
 * using the given auth context. Returns a promise the caller can pass to
 * assertSucceeds / assertFails.
 */
type DocReader = {
  firestore: () => { doc: (p: string) => { get: () => Promise<unknown> } };
};

function readPartnerOnly(ctx: DocReader): Promise<unknown> {
  return ctx.firestore().doc('_test_partner_only/sentinel').get();
}

describe('isPartner() — string-typed role values', () => {
  it('(1) DENIES unauthenticated read', async () => {
    const ctx = env.unauthenticatedContext();
    await assertFails(readPartnerOnly(ctx as never));
  });

  it('(2) DENIES authenticated user with no role claim', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, {});
    await assertFails(readPartnerOnly(ctx as never));
  });

  it('(3) DENIES admin (cross-role check)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(readPartnerOnly(ctx as never));
  });

  it('(4) ALLOWS canonical role:\'partner\'', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertSucceeds(readPartnerOnly(ctx as never));
  });

  it('(5) DENIES role:\'employee\'', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(readPartnerOnly(ctx as never));
  });

  it('(6) DENIES empty-string role', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: '' });
    await assertFails(readPartnerOnly(ctx as never));
  });

  it('(7) DENIES whitespace-padded \' partner \'', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: ' partner ' });
    await assertFails(readPartnerOnly(ctx as never));
  });
});

describe('isPartner() — type-confusion (devils-advocate Attack #5)', () => {
  it('(8) DENIES role:null', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: null });
    await assertFails(readPartnerOnly(ctx as never));
  });

  it('(9) DENIES role:[\'partner\'] (array)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: ['partner'] });
    await assertFails(readPartnerOnly(ctx as never));
  });

  it('(10) DENIES role:{partner:true} (object)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: { partner: true } });
    await assertFails(readPartnerOnly(ctx as never));
  });

  it('(11) DENIES role:1 (numeric)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 1 });
    await assertFails(readPartnerOnly(ctx as never));
  });
});
