/**
 * pending_signature_intents — firestore.rules CF-only lockdown tests (Phase 2 H.6.c-1)
 * ─────────────────────────────────────────────────────────────────────────────
 * The `pending_signature_intents/{salesRecordId}` collection is the CF-only idempotency
 * marker for the two-phase `pending_signature` cutover flow. `createClientFromSalesRecord`
 * `.create()`s one marker per source sale in the SAME transaction as the pending client —
 * the `.create()` is the race-safe backstop guaranteeing exactly one pending client per
 * sale. It holds ONLY non-PII business ids ({ salesRecordId, caseNumber, serviceId,
 * createdBy, createdAt, schemaVersion }) — no fee/amount/PII. Its rule is
 * `allow read, write: if false` — fully CF-only; the CF writes via the Admin SDK (which
 * bypasses rules). NO client context — employee, admin, or partner — may read OR write it.
 *
 * Coverage — 8 scenarios (4 contexts × {read, write}):
 *   unauthenticated → read DENY, write DENY
 *   employee        → read DENY, write DENY
 *   admin           → read DENY, write DENY  (client SDK — only the CF Admin SDK can)
 *   partner         → read DENY, write DENY
 *
 * ─── Why this is the deny-all template (like sales_record_links) ─────────────
 * `client_profitability` ALLOWS admin+partner READ (to drive the live dashboard), so its
 * suite asserts POSITIVES. pending_signature_intents is fully `if false` (like
 * sales_record_links / employee_costs / timesheet_entry_costs), so this suite asserts only
 * DENIALS.
 */
import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { FIXTURES, makeTestEnv } from './setup';

let env: RulesTestEnvironment;

const INTENT_DOC_PATH = 'pending_signature_intents/AbCdEf0123456789wxyz';

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

function readIntent(ctx: DocCtx): Promise<unknown> {
  return ctx.firestore().doc(INTENT_DOC_PATH).get();
}

function writeIntent(ctx: DocCtx): Promise<unknown> {
  return ctx
    .firestore()
    .doc(INTENT_DOC_PATH)
    .set({ salesRecordId: 'AbCdEf0123456789wxyz', caseNumber: '2026001', serviceId: 'srv_fixed_AbCdEf0123456789wxyz' });
}

describe('pending_signature_intents — fully CF-only (allow read, write: if false)', () => {
  it('DENIES unauthenticated read', async () => {
    await assertFails(readIntent(env.unauthenticatedContext() as never));
  });

  it('DENIES unauthenticated write', async () => {
    await assertFails(writeIntent(env.unauthenticatedContext() as never));
  });

  it('DENIES employee read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(readIntent(ctx as never));
  });

  it('DENIES employee write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(writeIntent(ctx as never));
  });

  it('DENIES admin read (client SDK — only the CF Admin SDK can)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(readIntent(ctx as never));
  });

  it('DENIES admin write (client SDK — only the CF Admin SDK can)', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(writeIntent(ctx as never));
  });

  it('DENIES partner read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertFails(readIntent(ctx as never));
  });

  it('DENIES partner write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertFails(writeIntent(ctx as never));
  });
});
