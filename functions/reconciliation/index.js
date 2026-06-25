/**
 * reconciliation/index.js — OWN-3 admin control callables for the package/service
 * hours reconciliation loop ("שומר-הלילה" / reconcilePackageDrift).
 * ─────────────────────────────────────────────────────────────────────────────
 * Two admin-gated v2 callables that let an admin operate the OWN-2 loop from the
 * Admin Panel instead of editing Firestore / Cloud Scheduler by hand:
 *   • setReconciliationMode(mode, confirmToken?) — flip off/dry_run/enforce.
 *   • runReconciliationNow()                     — invoke the loop on demand.
 * (The page READS the current mode + recent run summaries directly: the
 * `system_settings` doc is authed-readable and `audit_log` is admin-readable
 * per firestore.rules — no read callable is needed.)
 *
 * ─── Why JS, not src-ts/TS (deliberate, design-approved deviation) ───────────
 * These callables are thin wrappers tightly coupled to TWO JS modules — the loop
 * `scheduled/reconcile-package-drift.js` (runReconciliation) and the flag
 * `shared/reconciliation-mode.js` (VALID_MODES + cache invalidation). The repo has
 * NO production precedent for a src-ts TS file importing a JS module (allowJs:false
 * makes an ES-import-of-JS a type error; only test files use runtime require), and
 * a hand-maintained `.d.ts` bridge on a PROD-write enabler is a drift/risk surface.
 * This mirrors the OWN-1/OWN-2 precedent (new modules coupled to JS canonical
 * modules stay JS). Every bar-relevant property is preserved in JS: v2 onCall,
 * role-only admin gate, audit-FIRST, Hebrew errors, non-PII logging, and strict
 * manual input validation (the Zod-`.strict()` equivalent — reject unknown/invalid
 * mode; only the known fields are read).
 *
 * ─── Security contract (mirrors set-employee-cost.ts) ────────────────────────
 *  1. v2 onCall; handlers exported separately for direct unit testing.
 *  2. Role-only admin gate — `claims.role === 'admin'`. NOT admin||partner: these
 *     are CONTROL ops (enforce enables live PROD writes) → admins only.
 *  3. Strict input validation: mode ∈ {off,dry_run,enforce}; flipping to `enforce`
 *     additionally requires `confirmToken === 'enforce'` (the UI sends this only
 *     after the admin types the Hebrew confirmation word). off/dry_run need none.
 *  4. Audit-FIRST via logCriticalAction BEFORE the flag write / the run. If the
 *     audit fails, the mutation does NOT happen (fail-secure). Compensating audit
 *     on a write failure.
 *  5. Non-PII everywhere — modes/counts/uids only; never clientName.
 */
'use strict';

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const logger = require('../shared/logger');
const { logCriticalAction, logCriticalActionInTxn } = require('../lib/audit-critical');
const {
  VALID_MODES,
  invalidateReconciliationModeCache
} = require('../shared/reconciliation-mode');
const { runReconciliation } = require('../scheduled/reconcile-package-drift');

const RECONCILIATION_SETTINGS_DOC = { collection: 'system_settings', document: 'package_reconciliation' };
const REGION = 'us-central1';
// flipping to enforce = enabling live PROD writes → require this exact token, which
// the UI sends only after the admin types the Hebrew confirmation word "תיקון".
const ENFORCE_CONFIRM_TOKEN = 'enforce';

/** Shared admin gate — throws HttpsError on unauth / non-admin. Returns the uid. */
function requireAdmin(request) {
  if (!request || !request.auth) {
    throw new HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
  }
  const claims = request.auth.token || {};
  if (claims.role !== 'admin') {
    throw new HttpsError('permission-denied', 'רק מנהל מערכת רשאי לבצע פעולה זו.');
  }
  return request.auth.uid;
}

// ── Callable A — setReconciliationMode ───────────────────────────────────────

/**
 * Handler — exported for direct unit testing (no v2 wrapping / region routing).
 * @returns {Promise<{success:true, mode:string, previousMode:string|null, auditDocId:string}>}
 */
async function setReconciliationModeHandler(request) {
  const callerUid = requireAdmin(request);

  // ─── Strict input validation ───────────────────────────────────────────────
  const data = (request && request.data) || {};
  const mode = data.mode;
  if (typeof mode !== 'string' || VALID_MODES.indexOf(mode) === -1) {
    logger.warn('reconciliation.set_mode.invalid_input', { actor: { uid: callerUid } });
    throw new HttpsError(
      'invalid-argument',
      'מצב לא תקין. ערכים אפשריים: כבוי / צפייה / תיקון. אנא נסה שוב.'
    );
  }
  // enforce (the PROD-write enabler) requires the explicit confirmation token.
  if (mode === 'enforce' && data.confirmToken !== ENFORCE_CONFIRM_TOKEN) {
    logger.warn('reconciliation.set_mode.enforce_unconfirmed', { actor: { uid: callerUid } });
    throw new HttpsError(
      'failed-precondition',
      'הפעלת מצב "תיקון" דורשת אישור מפורש. אנא הקלד את מילת האישור ונסה שוב.'
    );
  }

  const db = admin.firestore();
  const settingsRef = db.collection(RECONCILIATION_SETTINGS_DOC.collection).doc(RECONCILIATION_SETTINGS_DOC.document);

  // ─── Atomic flip — ONE transaction reads previousMode + writes the audit
  // (audit-atomic) + the flag. This serializes concurrent admin flips so a
  // last-write-wins can't silently swallow an emergency flip-to-off on the
  // on-switch to PROD writes, AND keeps the audit atomic with the flag write: if
  // either write fails, the whole txn rolls back and the flag is NOT changed
  // (audit-FIRST preserved as audit-atomic). `merge:true` never clobbers unrelated
  // fields; `enabledBy` = admin UID, never email.
  let previousMode = null;
  let auditDocId;
  try {
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(settingsRef); // READ — before any write
      const prev = snap.exists ? ((snap.data() || {}).mode || null) : null;
      // audit-atomic (in-txn, synchronous): commits with the flag write or rolls back.
      const aId = logCriticalActionInTxn(tx, 'SET_RECONCILIATION_MODE', callerUid, { previousMode: prev, newMode: mode });
      tx.set(settingsRef, {
        mode,
        enabledBy: callerUid,
        enabledAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return { prev, aId };
    });
    previousMode = out.prev;
    auditDocId = out.aId;
  } catch (err) {
    logger.error('reconciliation.set_mode.txn_failed', {
      actor: { uid: callerUid }, errorCode: (err && err.code) || 'unknown'
    });
    throw new HttpsError(
      'internal',
      'שגיאה בשמירת המצב. המצב לא שונה ונשאר כפי שהיה. אנא נסה שוב או פנה לתמיכה.'
    );
  }

  // Clear the per-instance cache so an immediate "Run now" sees the new mode.
  invalidateReconciliationModeCache();

  logger.info('reconciliation.set_mode.success', { actor: { uid: callerUid }, newMode: mode, auditDocId });
  return { success: true, mode, previousMode, auditDocId };
}

// ── Callable B — runReconciliationNow ────────────────────────────────────────

/**
 * Handler — invokes the loop on demand. The loop reads the CURRENT mode itself:
 * off → no-op (skippedRun), dry_run → logs (no write), enforce → writes via the
 * owner. Returns the run counters so the UI shows the result immediately.
 * @returns {Promise<{success:true, ...counters}>}
 */
async function runReconciliationNowHandler(request) {
  const callerUid = requireAdmin(request);

  // Audit FIRST — record WHO triggered a manual run, before invoking.
  try {
    await logCriticalAction('RECONCILIATION_RUN_NOW', callerUid, { triggeredManually: true });
  } catch (err) {
    logger.error('reconciliation.run_now.audit_write_failed', {
      actor: { uid: callerUid }, errorCode: (err && err.code) || 'unknown'
    });
    throw new HttpsError(
      'internal',
      'שגיאה בכתיבת לוג ביקורת. הריצה לא בוצעה. אנא נסה שוב מאוחר יותר או פנה לתמיכה.'
    );
  }

  // Read the freshest mode (a flip in this same instance just cleared the cache).
  invalidateReconciliationModeCache();

  try {
    const counters = await runReconciliation();
    logger.info('reconciliation.run_now.success', {
      actor: { uid: callerUid },
      mode: counters && counters.mode,
      repaired: counters && counters.repaired,
      failed: counters && counters.failed
    });
    return { success: true, ...counters };
  } catch (err) {
    logger.error('reconciliation.run_now.failed', {
      actor: { uid: callerUid }, errorCode: (err && err.code) || 'unknown'
    });
    throw new HttpsError(
      'internal',
      'הריצה נכשלה. ייתכן שחלק מהתיקונים בוצעו — בדוק את טבלת ההרצות. אנא נסה שוב או פנה לתמיכה.'
    );
  }
}

// ── v2 Cloud Function wrappers ───────────────────────────────────────────────

const setReconciliationMode = onCall({ region: REGION }, setReconciliationModeHandler);

// Run-now scans all clients → give it room. maxInstances:1 bounds THIS callable
// (two admins can't both trigger run-now at once). It does NOT serialize against
// the 07:00 `reconcilePackageDrift` cron (a separate function calling the same
// loop) — a manual run overlapping the cron is made safe by the owner's per-client
// A5 updateTime guard + idempotent recompute-from-ledger (a concurrent touch on a
// client aborts + retries to a no-op), NOT by this singleton.
const runReconciliationNow = onCall(
  { region: REGION, timeoutSeconds: 540, memory: '512MiB', maxInstances: 1 },
  runReconciliationNowHandler
);

module.exports = {
  setReconciliationMode,
  runReconciliationNow,
  // exported for unit tests
  setReconciliationModeHandler,
  runReconciliationNowHandler
};
