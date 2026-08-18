/**
 * user_messages + replies — retirement deny-suite (H.8.0 PR4)
 * ─────────────────────────────────────────────────────────────────────────────
 * The user_messages and replies collections are RETIRED as of H.8.0.
 * Their firestore.rules block was removed in PR4. This suite proves that ALL
 * auth contexts are denied on both collections under the test ruleset.
 *
 * ⚠️  RUNS AGAINST firestore.rules.TEST — not the production firestore.rules.
 *     The production-file removal is proven by the NEGATIVE assertion in
 *     tests/unit/rules/rules-drift-guard.test.ts:
 *       expect(prodSource).not.toContain('match /user_messages/')
 *     (DA Attack #1 + #4 defenses, H.8.0 PR4 devils-advocate review)
 *
 * Coverage — 16 scenarios:
 *   4 contexts × {user_messages read, user_messages write,
 *                  replies read,      replies write}
 *   All 16 MUST DENY — no exception.
 */
import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { FIXTURES, makeTestEnv } from './setup';

let env: RulesTestEnvironment;

const MSG_DOC = 'user_messages/msg-fixture-001';
const REPLY_DOC = 'user_messages/msg-fixture-001/replies/reply-fixture-001';

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

function readMsg(ctx: DocCtx): Promise<unknown> {
  return ctx.firestore().doc(MSG_DOC).get();
}
function writeMsg(ctx: DocCtx): Promise<unknown> {
  return ctx.firestore().doc(MSG_DOC).set({ to: 'user@example.com', status: 'unread' });
}
function readReply(ctx: DocCtx): Promise<unknown> {
  return ctx.firestore().doc(REPLY_DOC).get();
}
function writeReply(ctx: DocCtx): Promise<unknown> {
  return ctx.firestore().doc(REPLY_DOC).set({ from: 'user@example.com', text: 'reply' });
}

describe('user_messages — RETIRED (H.8.0); all contexts denied', () => {
  it('DENIES unauthenticated read', async () => {
    await assertFails(readMsg(env.unauthenticatedContext() as never));
  });
  it('DENIES unauthenticated write', async () => {
    await assertFails(writeMsg(env.unauthenticatedContext() as never));
  });

  it('DENIES employee read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(readMsg(ctx as never));
  });
  it('DENIES employee write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(writeMsg(ctx as never));
  });

  it('DENIES admin read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(readMsg(ctx as never));
  });
  it('DENIES admin write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(writeMsg(ctx as never));
  });

  it('DENIES partner read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertFails(readMsg(ctx as never));
  });
  it('DENIES partner write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertFails(writeMsg(ctx as never));
  });
});

describe('user_messages/replies — RETIRED (H.8.0); all contexts denied', () => {
  it('DENIES unauthenticated read', async () => {
    await assertFails(readReply(env.unauthenticatedContext() as never));
  });
  it('DENIES unauthenticated write', async () => {
    await assertFails(writeReply(env.unauthenticatedContext() as never));
  });

  it('DENIES employee read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(readReply(ctx as never));
  });
  it('DENIES employee write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.employeeUid, { role: 'employee' });
    await assertFails(writeReply(ctx as never));
  });

  it('DENIES admin read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(readReply(ctx as never));
  });
  it('DENIES admin write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.adminUid, { role: 'admin' });
    await assertFails(writeReply(ctx as never));
  });

  it('DENIES partner read', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertFails(readReply(ctx as never));
  });
  it('DENIES partner write', async () => {
    const ctx = env.authenticatedContext(FIXTURES.partnerUid, { role: 'partner' });
    await assertFails(writeReply(ctx as never));
  });
});
