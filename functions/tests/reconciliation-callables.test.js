/**
 * Tests for the OWN-3 admin control callables (functions/reconciliation/index.js):
 *   setReconciliationMode + runReconciliationNow. Mocks the SDK boundary + the
 *   loop + the flag; exercises the admin gate, strict validation, the enforce
 *   confirm-token, the ATOMIC audit-in-txn flip (fail-secure rollback), cache
 *   invalidation, and the run invocation.
 */

let mockSettings = null;     // current system_settings/package_reconciliation doc data, or null
let mockCapturedSet = null;  // the payload passed to tx.set()

jest.mock('firebase-admin', () => {
  const FieldValue = { serverTimestamp: () => 'TS' };
  const settingsRef = { _id: 'package_reconciliation' };
  const firestore = () => ({
    collection: () => ({ doc: () => settingsRef }),
    // setReconciliationMode flips inside a transaction (atomic read+audit+write).
    runTransaction: async (fn) => {
      const tx = {
        get: async () => (mockSettings ? { exists: true, data: () => mockSettings } : { exists: false }),
        set: (_ref, payload, opts) => { mockCapturedSet = { payload, opts }; }
      };
      return fn(tx);
    }
  });
  firestore.FieldValue = FieldValue;
  return { firestore: Object.assign(firestore, { FieldValue }) };
});

jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  // onCall passthrough — the unit tests call the exported *Handler directly.
  return { onCall: (_opts, handler) => handler, HttpsError };
});

jest.mock('../shared/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../lib/audit-critical', () => ({
  logCriticalAction: jest.fn().mockResolvedValue('audit-id'),       // run-now (non-txn)
  logCriticalActionInTxn: jest.fn().mockReturnValue('audit-id')     // set-mode (in-txn, sync)
}));
jest.mock('../shared/reconciliation-mode', () => {
  const actual = jest.requireActual('../shared/reconciliation-mode');
  return { VALID_MODES: actual.VALID_MODES, invalidateReconciliationModeCache: jest.fn() };
});
jest.mock('../scheduled/reconcile-package-drift', () => ({ runReconciliation: jest.fn() }));

const {
  setReconciliationModeHandler,
  runReconciliationNowHandler
} = require('../reconciliation');
const { logCriticalAction, logCriticalActionInTxn } = require('../lib/audit-critical');
const { invalidateReconciliationModeCache } = require('../shared/reconciliation-mode');
const { runReconciliation } = require('../scheduled/reconcile-package-drift');

const adminReq = (data) => ({ auth: { uid: 'admin-uid-1', token: { role: 'admin' } }, data });

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings = null;
  mockCapturedSet = null;
  logCriticalAction.mockResolvedValue('audit-id');
  logCriticalActionInTxn.mockReturnValue('audit-id');
  runReconciliation.mockResolvedValue({ mode: 'dry_run', repaired: 0, wouldRepair: 2, failed: 0 });
});

// ═══════════════════════════════════════════════════════════════
// A. setReconciliationMode — gate + validation
// ═══════════════════════════════════════════════════════════════

describe('A. setReconciliationMode gate + validation', () => {
  test('unauthenticated → unauthenticated', async () => {
    await expect(setReconciliationModeHandler({ data: { mode: 'off' } }))
      .rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('non-admin → permission-denied', async () => {
    await expect(setReconciliationModeHandler({ auth: { uid: 'u', token: { role: 'employee' } }, data: { mode: 'off' } }))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });

  test('invalid mode → invalid-argument, no write, no audit', async () => {
    await expect(setReconciliationModeHandler(adminReq({ mode: 'on' })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
    expect(mockCapturedSet).toBeNull();
    expect(logCriticalActionInTxn).not.toHaveBeenCalled();
  });

  test('enforce WITHOUT confirmToken → failed-precondition, no write, no audit', async () => {
    await expect(setReconciliationModeHandler(adminReq({ mode: 'enforce' })))
      .rejects.toMatchObject({ code: 'failed-precondition' });
    expect(mockCapturedSet).toBeNull();
    expect(logCriticalActionInTxn).not.toHaveBeenCalled();
  });

  test('enforce with WRONG confirmToken → failed-precondition', async () => {
    await expect(setReconciliationModeHandler(adminReq({ mode: 'enforce', confirmToken: 'yes' })))
      .rejects.toMatchObject({ code: 'failed-precondition' });
    expect(mockCapturedSet).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// B. setReconciliationMode — atomic write + audit-in-txn
// ═══════════════════════════════════════════════════════════════

describe('B. setReconciliationMode atomic flip', () => {
  test('off → audit-atomic + write {mode, enabledBy, enabledAt} merge; cache invalidated', async () => {
    mockSettings = { mode: 'dry_run' };
    const res = await setReconciliationModeHandler(adminReq({ mode: 'off' }));
    expect(res).toMatchObject({ success: true, mode: 'off', previousMode: 'dry_run', auditDocId: 'audit-id' });
    // audit-in-txn captured prev→new (atomic with the flag write)
    expect(logCriticalActionInTxn).toHaveBeenCalledWith(
      expect.anything(), 'SET_RECONCILIATION_MODE', 'admin-uid-1', { previousMode: 'dry_run', newMode: 'off' }
    );
    expect(mockCapturedSet.payload).toMatchObject({ mode: 'off', enabledBy: 'admin-uid-1', enabledAt: 'TS' });
    expect(mockCapturedSet.opts).toEqual({ merge: true });
    expect(invalidateReconciliationModeCache).toHaveBeenCalledTimes(1);
  });

  test('dry_run (no doc yet) → previousMode null, writes', async () => {
    mockSettings = null;
    const res = await setReconciliationModeHandler(adminReq({ mode: 'dry_run' }));
    expect(res).toMatchObject({ success: true, mode: 'dry_run', previousMode: null });
    expect(mockCapturedSet.payload.mode).toBe('dry_run');
  });

  test('enforce WITH correct confirmToken → writes', async () => {
    const res = await setReconciliationModeHandler(adminReq({ mode: 'enforce', confirmToken: 'enforce' }));
    expect(res).toMatchObject({ success: true, mode: 'enforce' });
    expect(mockCapturedSet.payload.mode).toBe('enforce');
    expect(logCriticalActionInTxn).toHaveBeenCalledWith(
      expect.anything(), 'SET_RECONCILIATION_MODE', 'admin-uid-1', expect.objectContaining({ newMode: 'enforce' })
    );
  });

  test('audit-in-txn THROWS → internal, flag NOT written (atomic rollback), cache untouched', async () => {
    logCriticalActionInTxn.mockImplementationOnce(() => { throw Object.assign(new Error('boom'), { code: 'unavailable' }); });
    await expect(setReconciliationModeHandler(adminReq({ mode: 'off' })))
      .rejects.toMatchObject({ code: 'internal' });
    expect(mockCapturedSet).toBeNull();          // the audit threw before tx.set → no write
    expect(invalidateReconciliationModeCache).not.toHaveBeenCalled();
  });

  test('transaction THROWS (flag write fails) → internal, no cache invalidate', async () => {
    const admin = require('firebase-admin');
    const orig = admin.firestore;
    // make runTransaction reject (simulating a commit failure / contention)
    admin.firestore = Object.assign(() => ({
      collection: () => ({ doc: () => ({}) }),
      runTransaction: async () => { throw Object.assign(new Error('aborted'), { code: 'aborted' }); }
    }), { FieldValue: orig.FieldValue });
    try {
      await expect(setReconciliationModeHandler(adminReq({ mode: 'off' })))
        .rejects.toMatchObject({ code: 'internal' });
      expect(invalidateReconciliationModeCache).not.toHaveBeenCalled();
    } finally {
      admin.firestore = orig;
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// C. runReconciliationNow
// ═══════════════════════════════════════════════════════════════

describe('C. runReconciliationNow', () => {
  test('unauthenticated → unauthenticated, loop NOT invoked', async () => {
    await expect(runReconciliationNowHandler({ data: {} }))
      .rejects.toMatchObject({ code: 'unauthenticated' });
    expect(runReconciliation).not.toHaveBeenCalled();
  });

  test('non-admin → permission-denied', async () => {
    await expect(runReconciliationNowHandler({ auth: { uid: 'u', token: { role: 'employee' } }, data: {} }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    expect(runReconciliation).not.toHaveBeenCalled();
  });

  test('admin → audit-FIRST, invokes the loop with NO mode arg, returns counters', async () => {
    runReconciliation.mockResolvedValueOnce({ mode: 'enforce', repaired: 3, failed: 0, blockFlipsDeferred: 1 });
    const res = await runReconciliationNowHandler(adminReq({ mode: 'enforce' /* must be ignored */ }));
    expect(logCriticalAction).toHaveBeenCalledWith('RECONCILIATION_RUN_NOW', 'admin-uid-1', { triggeredManually: true });
    expect(runReconciliation).toHaveBeenCalledTimes(1);
    expect(runReconciliation).toHaveBeenCalledWith(); // no args — can't sneak a mode
    expect(res).toMatchObject({ success: true, mode: 'enforce', repaired: 3, blockFlipsDeferred: 1 });
  });

  test('mode=off → loop returns skippedRun, surfaced honestly', async () => {
    runReconciliation.mockResolvedValueOnce({ mode: 'off', skippedRun: true });
    const res = await runReconciliationNowHandler(adminReq({}));
    expect(res).toMatchObject({ success: true, mode: 'off', skippedRun: true });
  });

  test('audit FAILS → internal, loop NOT invoked', async () => {
    logCriticalAction.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    await expect(runReconciliationNowHandler(adminReq({})))
      .rejects.toMatchObject({ code: 'internal' });
    expect(runReconciliation).not.toHaveBeenCalled();
  });

  test('loop THROWS → internal (run-table tells the real story)', async () => {
    runReconciliation.mockRejectedValueOnce(Object.assign(new Error('systemic'), { code: 'internal' }));
    await expect(runReconciliationNowHandler(adminReq({})))
      .rejects.toMatchObject({ code: 'internal' });
  });
});
