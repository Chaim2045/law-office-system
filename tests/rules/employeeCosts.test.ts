/**
 * employee_costs — firestore.rules CF-only lockdown tests (Pre-H.0.0.G)
 * ─────────────────────────────────────────────────────────────────────────────
 * The `employee_costs/{email}` collection is the most sensitive in the system
 * (per-employee cost-per-hour — salary-adjacent PII). Its rule is
 * `allow read, write: if false` — fully CF-only. NO client context may read or
 * write it, INCLUDING admins (admins access via the getEmployeeCost callable,
 * which runs with Admin SDK privileges that bypass rules).
 *
 * This suite proves the lockdown holds for every auth context. Runs against the
 * Firestore Emulator via the Pre-H.0.0.D infrastructure (firestore.rules.test +
 * tests/rules/setup.ts HARD GUARD).
 *
 * Coverage — 8 scenarios (4 contexts × {read, write}):
 *   unauthenticated  → read DENY, write DENY
 *   employee         → read DENY, write DENY
 *   admin            → read DENY, write DENY  (the key non-obvious one — even
 *                      an admin client token cannot read; only the callable can)
 *   partner          → read DENY, write DENY
 */
import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { FIXTURES, makeTestEnv } from './setup';

let env: RulesTestEnvironment;

const COST_DOC_PATH = 'employee_costs/employee-fixture@example.com';

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

function readCost(ctx: DocCtx): Promise<unknown> {
  return ctx.firestore().doc(COST_DOC_PATH).get();
}

function writeCost(ctx: DocCtx): Promise<unknown> {
  return ctx.firestore().doc(COST_DOC_PATH).set({ costPerHour: 100 });
}

describe('employee_costs — fully CF-only (allow read, write: if false)', () => {
  it('DENIES unauthenticated read', async () => {
    await assertFails(readCost(env.unauthenticatedContext() as never));
  });

  it('DENIES unauthenticated write', async () => {
    await assertFails(writeCost(env.unauthenticatedContext() as never));
  });

  it('DENIES employee read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(readCost(ctx as never));
  });

  it('DENIES employee write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(writeCost(ctx as never));
  });

  it('DENIES admin read (client SDK — even admin cannot read; only the callable can)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(readCost(ctx as never));
  });

  it('DENIES admin write (client SDK — writes go through setEmployeeCost callable)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(writeCost(ctx as never));
  });

  it('DENIES partner read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertFails(readCost(ctx as never));
  });

  it('DENIES partner write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertFails(writeCost(ctx as never));
  });
});
