/**
 * timesheet_entry_costs — firestore.rules CF-only lockdown tests (Phase 2 H.2)
 * ─────────────────────────────────────────────────────────────────────────────
 * The `timesheet_entry_costs/{entryId}` collection holds the per-entry cost
 * snapshot ({ entryId, employee, costPerHour, costSource }) — the employee's
 * confidential cost-per-hour. It is stored HERE rather than on the timesheet entry
 * doc precisely because the owning employee can read their own entry (and would
 * otherwise see their own cost). Its rule is `allow read, write: if false` — fully
 * CF-only; the write paths + the H.3 forecast aggregation use the Admin SDK (which
 * bypasses rules). NO client context — employee, admin, or partner — may read it
 * (§7.6 "NOT exposed to employee self" / §10 Option A).
 *
 * Coverage — 8 scenarios (4 contexts × {read, write}):
 *   unauthenticated → read DENY, write DENY
 *   employee        → read DENY, write DENY  (the leak this design prevents)
 *   admin           → read DENY, write DENY  (client SDK — only the CF can)
 *   partner         → read DENY, write DENY
 */
import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { FIXTURES, makeTestEnv } from './setup';

let env: RulesTestEnvironment;

const COST_DOC_PATH = 'timesheet_entry_costs/entry-fixture-id-0001';

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
  return ctx.firestore().doc(COST_DOC_PATH).set({ entryId: 'entry-fixture-id-0001', costPerHour: 100 });
}

describe('timesheet_entry_costs — fully CF-only (allow read, write: if false)', () => {
  it('DENIES unauthenticated read', async () => {
    await assertFails(readCost(env.unauthenticatedContext() as never));
  });

  it('DENIES unauthenticated write', async () => {
    await assertFails(writeCost(env.unauthenticatedContext() as never));
  });

  it('DENIES employee read (the leak this design prevents — employee can read their entry, NOT its cost)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(readCost(ctx as never));
  });

  it('DENIES employee write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(writeCost(ctx as never));
  });

  it('DENIES admin read (client SDK — only the CF Admin SDK can)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(readCost(ctx as never));
  });

  it('DENIES admin write (client SDK)', async () => {
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
