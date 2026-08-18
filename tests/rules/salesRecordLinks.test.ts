/**
 * sales_record_links — firestore.rules CF-only lockdown tests (Phase 2 H.6)
 * ─────────────────────────────────────────────────────────────────────────────
 * The `sales_record_links/{linkId}` collection holds the agreed-fee SNAPSHOT for a
 * case created from a tofes-mecher sale ({ caseNumber, serviceId, agreedFeeSnapshot,
 * feeFieldUsed, salesRecordTimestampIso, snapshotAt, confirmedBy, state,
 * schemaVersion }). It is stored HERE rather than on the world-readable `clients` doc
 * precisely so the agreed fee never sits where any authenticated user can read it
 * (§7.6 / DLR §8.2.5 D-A). Its rule is `allow read, write: if false` — fully CF-only;
 * the createClientFromSalesRecord CF writes via the Admin SDK (which bypasses rules).
 * NO client context — employee, admin, or partner — may read OR write it (an admin
 * reads it via a future callable, never the client SDK).
 *
 * Coverage — 8 scenarios (4 contexts × {read, write}):
 *   unauthenticated → read DENY, write DENY
 *   employee        → read DENY, write DENY  (the §7.6 fee-leak this design prevents)
 *   admin           → read DENY, write DENY  (client SDK — only the CF can)
 *   partner         → read DENY, write DENY
 *
 * ─── Why this is the deny-all template (NOT clientProfitability) ─────────────
 * `client_profitability` ALLOWS admin+partner READ (to drive the live dashboard), so
 * its suite asserts POSITIVES. sales_record_links is fully `if false` (like
 * employee_costs / timesheet_entry_costs), so this suite asserts only DENIALS.
 */
import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { FIXTURES, makeTestEnv } from './setup';

let env: RulesTestEnvironment;

const LINK_DOC_PATH = 'sales_record_links/AbCdEf0123456789wxyz';

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

function readLink(ctx: DocCtx): Promise<unknown> {
  return ctx.firestore().doc(LINK_DOC_PATH).get();
}

function writeLink(ctx: DocCtx): Promise<unknown> {
  return ctx
    .firestore()
    .doc(LINK_DOC_PATH)
    .set({ salesRecordId: 'AbCdEf0123456789wxyz', caseNumber: '2026001', agreedFeeSnapshot: 1000 });
}

describe('sales_record_links — fully CF-only (allow read, write: if false)', () => {
  it('DENIES unauthenticated read', async () => {
    await assertFails(readLink(env.unauthenticatedContext() as never));
  });

  it('DENIES unauthenticated write', async () => {
    await assertFails(writeLink(env.unauthenticatedContext() as never));
  });

  it('DENIES employee read (the §7.6 agreed-fee leak this design prevents)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(readLink(ctx as never));
  });

  it('DENIES employee write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(writeLink(ctx as never));
  });

  it('DENIES admin read (client SDK — only the CF Admin SDK can)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(readLink(ctx as never));
  });

  it('DENIES admin write (client SDK — only the CF Admin SDK can)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(writeLink(ctx as never));
  });

  it('DENIES partner read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertFails(readLink(ctx as never));
  });

  it('DENIES partner write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertFails(writeLink(ctx as never));
  });
});
