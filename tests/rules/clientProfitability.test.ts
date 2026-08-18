/**
 * client_profitability — firestore.rules read-gate tests (Phase 2 H.3 PR3)
 * ─────────────────────────────────────────────────────────────────────────────
 * The `client_profitability/{caseNumber}` collection holds the per-case Forecast
 * cost/profit aggregate (actualCost/actualHours/coverage). Its rule is
 *   `allow read: if isAdmin() || isPartner(); allow write: if false;`
 * — the FIRST production isPartner() consumer (dormant + fail-secure: resolves
 * admin-only today since no user holds role=='partner'). The admin||partner READ
 * (vs a fully-locked `if false`) is what permits the real-time onSnapshot
 * dashboard (PR4) WITHOUT leaking cost to employees. Writes are CF-only (the
 * Admin SDK aggregation job bypasses rules).
 *
 * ─── Why this is NOT a copy of timesheetEntryCosts.test.ts ───────────────────
 * That collection is `read, write: if false` (deny EVERYONE). This one ALLOWS
 * admin + partner READ — so the suite asserts the POSITIVES too, not just denials.
 * A blind copy-paste of the deny-all template would wrongly assert admin/partner
 * read denied and mask a broken gate.
 *
 * Coverage — 9 scenarios:
 *   unauthenticated → read DENY,  write DENY
 *   employee        → read DENY (the §7.6 crux),  write DENY
 *   no-role authed  → read DENY (belt-and-suspenders)
 *   admin           → read ALLOW (the live dashboard path),  write DENY (client SDK)
 *   partner         → read ALLOW (dormant gate resolves true under a partner token),  write DENY
 */
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { FIXTURES, makeTestEnv } from './setup';

let env: RulesTestEnvironment;

const PROFITABILITY_DOC_PATH = 'client_profitability/2025724';

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

function readProfitability(ctx: DocCtx): Promise<unknown> {
  return ctx.firestore().doc(PROFITABILITY_DOC_PATH).get();
}

function writeProfitability(ctx: DocCtx): Promise<unknown> {
  return ctx
    .firestore()
    .doc(PROFITABILITY_DOC_PATH)
    .set({ caseNumber: '2025724', actualCost: 123 });
}

describe('client_profitability — read: isAdmin()||isPartner(), write: if false', () => {
  // ─── DENY: unauthenticated ─────────────────────────────────────────────────
  it('DENIES unauthenticated read', async () => {
    await assertFails(readProfitability(env.unauthenticatedContext() as never));
  });

  it('DENIES unauthenticated write', async () => {
    await assertFails(writeProfitability(env.unauthenticatedContext() as never));
  });

  // ─── DENY: regular employee (the §7.6 crux — must NOT onSnapshot cost) ──────
  it('DENIES employee read (the §7.6 leak this gate prevents)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(readProfitability(ctx as never));
  });

  it('DENIES employee write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(writeProfitability(ctx as never));
  });

  // ─── DENY: authenticated but NO role claim (belt-and-suspenders) ───────────
  it('DENIES authenticated no-role read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.anonUid, {});
    await assertFails(readProfitability(ctx as never));
  });

  // ─── ALLOW: admin read (the live dashboard path) ───────────────────────────
  it('ALLOWS admin read (the real-time dashboard listener)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertSucceeds(readProfitability(ctx as never));
  });

  it('DENIES admin write (client SDK — only the CF Admin SDK may write)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(writeProfitability(ctx as never));
  });

  // ─── ALLOW: partner read (dormant gate resolves true under a partner token) ─
  it('ALLOWS partner read (first production isPartner() consumer)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertSucceeds(readProfitability(ctx as never));
  });

  it('DENIES partner write (CF-only)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertFails(writeProfitability(ctx as never));
  });
});
