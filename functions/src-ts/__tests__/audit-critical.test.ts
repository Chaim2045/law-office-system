/**
 * audit-critical — runtime + static guards (Pre-H.0.0.C)
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for the canonical `logCriticalAction` audit primitive:
 *
 *   (a) Static AST guards — invariants the source MUST hold (no error.message
 *       in logger payloads per devils-advocate Attack #4; both exports present;
 *       schema version literal present).
 *
 *   (b) Runtime — handler invocation with mocked firebase-admin:
 *       - success path returns auto-generated doc id
 *       - Firestore failure rethrows + logger.error('audit_critical.write_failed')
 *       - actorUid validation rejects empty / wrong format / over-length
 *       - actorUid validation ACCEPTS sys:<name> system actors
 *       - transactional variant uses txn.set with pre-allocated doc id
 *       - schemaVersion: 1 present in every written doc
 */
import * as fs from 'fs';
import * as path from 'path';

import type { firestore } from 'firebase-admin';

// ─── Mocks must be declared BEFORE importing the handler ────────────────────
const mockAuditAdd = jest.fn();
const mockTxnSet = jest.fn();
const mockDocFn = jest.fn();

jest.mock('firebase-admin', () => {
  const firestoreFn: jest.Mock & { FieldValue?: unknown } = jest.fn(() => ({
    collection: jest.fn(() => ({
      add: mockAuditAdd,
      // doc() called WITHOUT args returns a ref with auto-allocated id —
      // used by the transactional variant
      doc: mockDocFn
    }))
  }));
  firestoreFn.FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP_SENTINEL')
  };
  return {
    firestore: firestoreFn
  };
});

import { logCriticalAction, logCriticalActionInTxn } from '../audit-critical';

// ─── Fixtures ───────────────────────────────────────────────────────────────
const HUMAN_UID = 'admin-uid-test-fixture-xx';        // 26 chars, matches /^[\w-]{6,128}$/
const SYS_ACTOR = 'sys:cron-sync-role-claims';
const TEST_AUDIT_DOC_ID = 'audit-doc-id-fixture';

beforeEach(() => {
  mockAuditAdd.mockReset().mockResolvedValue({ id: TEST_AUDIT_DOC_ID });
  mockTxnSet.mockReset();
  mockDocFn.mockReset().mockReturnValue({ id: 'pre-alloc-id-fixture' });
});

// ════════════════════════════════════════════════════════════════════════════
// (a) Static AST invariants
// ════════════════════════════════════════════════════════════════════════════
describe('audit-critical — static AST invariants', () => {
  let source: string;

  beforeAll(() => {
    const sourcePath = path.resolve(__dirname, '../audit-critical.ts');
    source = fs.readFileSync(sourcePath, 'utf8');
  });

  it('exports BOTH non-transactional and transactional variants (Attack #2 type-safety)', () => {
    expect(source).toMatch(/export\s+async\s+function\s+logCriticalAction\b/);
    expect(source).toMatch(/export\s+function\s+logCriticalActionInTxn\b/);
  });

  it('hardcodes AUDIT_COLLECTION = audit_log', () => {
    expect(source).toContain("const AUDIT_COLLECTION = 'audit_log'");
  });

  it('writes schemaVersion: 1 as forward-compat anchor (Attack #5)', () => {
    expect(source).toContain('SCHEMA_VERSION = 1');
    expect(source).toMatch(/schemaVersion:\s*SCHEMA_VERSION/);
  });

  it('NEVER logs error.message — only error.code (Attack #4 PUBLIC-repo PII)', () => {
    // The point: a future maintainer could "improve" logging by adding
    // error.message — that could leak rule paths (e.g. "PERMISSION_DENIED
    // on /audit_log/...") to Cloud Logging. Lock it at the source level.
    expect(source).not.toMatch(/logger\.(?:error|warn|info|debug)\([^)]*error\.message/);
    expect(source).not.toMatch(/logger\.(?:error|warn|info|debug)\([^)]*err\.message/);
  });

  it('logger.error tagged audit_critical.write_failed on Firestore failure', () => {
    expect(source).toContain("logger.error('audit_critical.write_failed'");
  });

  it('validates system-actor sys: prefix convention (Attack #3)', () => {
    expect(source).toContain('SYSTEM_ACTOR_PATTERN');
    expect(source).toMatch(/sys:[a-z]/);
  });

  it('does NOT auto-emit a success log (security recommendation)', () => {
    // Callers log success contextually. Helper should only log on FAILURE.
    expect(source).not.toContain("logger.info('audit_critical.write_succeeded'");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (b) Runtime — non-transactional variant
// ════════════════════════════════════════════════════════════════════════════
describe('logCriticalAction — happy path', () => {
  it('returns the auto-generated doc id on success', async () => {
    const id = await logCriticalAction('TEST_ACTION', HUMAN_UID, { foo: 'bar' });
    expect(id).toBe(TEST_AUDIT_DOC_ID);
    expect(mockAuditAdd).toHaveBeenCalledTimes(1);
  });

  it('writes the canonical schema including schemaVersion: 1', async () => {
    await logCriticalAction('TEST_ACTION', HUMAN_UID, { foo: 'bar' });
    const payload = mockAuditAdd.mock.calls[0][0];
    expect(payload).toEqual({
      action: 'TEST_ACTION',
      userId: HUMAN_UID,
      username: null,
      details: { foo: 'bar' },
      timestamp: 'SERVER_TIMESTAMP_SENTINEL',
      userAgent: null,
      ipAddress: null,
      schemaVersion: 1
    });
  });

  it('accepts sys:<name> system actors (e.g. cron jobs)', async () => {
    const id = await logCriticalAction('TRIGGER_RAN', SYS_ACTOR, { reason: 'test' });
    expect(id).toBe(TEST_AUDIT_DOC_ID);
    const payload = mockAuditAdd.mock.calls[0][0];
    expect(payload.userId).toBe(SYS_ACTOR);
  });
});

describe('logCriticalAction — actorUid validation (Attack #3)', () => {
  it('rejects empty string', async () => {
    await expect(logCriticalAction('X', '', {})).rejects.toThrow(/non-empty string/);
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only string', async () => {
    await expect(logCriticalAction('X', '   ', {})).rejects.toThrow(/non-empty string/);
  });

  it('rejects too-short human UID (<6 chars)', async () => {
    await expect(logCriticalAction('X', 'abc', {})).rejects.toThrow(/invalid actorUid/);
  });

  it('rejects invalid characters in human UID (colon, slash, space)', async () => {
    await expect(logCriticalAction('X', 'bad uid', {})).rejects.toThrow(/invalid actorUid/);
    await expect(logCriticalAction('X', 'bad/uid', {})).rejects.toThrow(/invalid actorUid/);
    await expect(logCriticalAction('X', 'bad:uid', {})).rejects.toThrow(/invalid actorUid/);
  });

  it('rejects malformed sys: actor (uppercase, special chars, too short)', async () => {
    await expect(logCriticalAction('X', 'sys:Bad', {})).rejects.toThrow(/invalid system actor/);
    await expect(logCriticalAction('X', 'sys:ab', {})).rejects.toThrow(/invalid system actor/);
    await expect(logCriticalAction('X', 'sys:has space', {})).rejects.toThrow(/invalid system actor/);
  });

  it('accepts canonical Firebase Auth-shape UID (28 chars, alphanumeric)', async () => {
    const realLikeUid = 'AbCdEfGhIjKlMnOpQrStUvWxYz12';
    await expect(logCriticalAction('X', realLikeUid, {})).resolves.toBeDefined();
  });
});

describe('logCriticalAction — Firestore failure (Attack #4 logger discipline)', () => {
  it('rethrows the original error AND logs without leaking error.message', async () => {
    const firestoreErr = Object.assign(new Error('PERMISSION_DENIED on /audit_log/...'), {
      code: 'permission-denied'
    });
    mockAuditAdd.mockRejectedValueOnce(firestoreErr);

    await expect(
      logCriticalAction('X', HUMAN_UID, { sensitive: 'data' })
    ).rejects.toBe(firestoreErr);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (c) Runtime — transactional variant
// ════════════════════════════════════════════════════════════════════════════
describe('logCriticalActionInTxn — happy path', () => {
  it('uses txn.set with pre-allocated doc ref and returns its id', () => {
    const mockTxn = { set: mockTxnSet } as unknown as firestore.Transaction;
    const id = logCriticalActionInTxn(mockTxn, 'TXN_ACTION', HUMAN_UID, { in: 'txn' });
    expect(id).toBe('pre-alloc-id-fixture');
    expect(mockTxnSet).toHaveBeenCalledTimes(1);
    // First arg is the docRef; second is the audit doc shape
    const [docRef, payload] = mockTxnSet.mock.calls[0];
    expect(docRef).toEqual({ id: 'pre-alloc-id-fixture' });
    expect(payload.schemaVersion).toBe(1);
    expect(payload.action).toBe('TXN_ACTION');
    expect(payload.userId).toBe(HUMAN_UID);
  });

  it('does NOT call collection.add (transactional path bypasses .add)', () => {
    const mockTxn = { set: mockTxnSet } as unknown as firestore.Transaction;
    logCriticalActionInTxn(mockTxn, 'X', HUMAN_UID, {});
    expect(mockAuditAdd).not.toHaveBeenCalled();
  });

  it('validates actorUid (same rules as non-txn variant)', () => {
    const mockTxn = { set: mockTxnSet } as unknown as firestore.Transaction;
    expect(() => logCriticalActionInTxn(mockTxn, 'X', '', {})).toThrow(/non-empty string/);
    expect(mockTxnSet).not.toHaveBeenCalled();
  });
});
