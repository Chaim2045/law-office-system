/**
 * Package-Reconciliation Mode — the enable-flag for the OWN-2 live reconciliation
 * loop (`reconcilePackageDrift`).
 *
 * Reads `system_settings/package_reconciliation` from Firestore and caches the
 * result for `CACHE_TTL_MS` (default 60 seconds) per CF instance. Mirrors
 * `shared/enforcement-mode.js` — BUT the fail-safe default is **'off'**, not
 * 'enforce', because here the risky action is WRITING (a live recompute that
 * mutates client docs). A misconfiguration must never silently turn the writer ON.
 *
 * Three modes:
 *   - `off`      — the loop is inert. It does NOT read clients/entries and writes
 *                  nothing. This is the DEFAULT (fail-safe): until an admin
 *                  deliberately enables it, OWN-2 is dead-on-deploy.
 *   - `dry_run`  — the loop runs the FULL detect + recompute + block-flip
 *                  prediction and LOGS per-service `{serviceBefore, serviceAfter,
 *                  ledgerTruth, wouldBlockFlip}` + run counters, but writes
 *                  NOTHING. The "observe nightly cycles before enabling" mode.
 *   - `enforce`  — the loop calls the live owner inside a transaction; the owner
 *                  writes via the canonical client writer. A recompute that would
 *                  FLIP a client to `isBlocked` is STILL deferred (never
 *                  auto-blocks) — see reconcile-package-drift.js.
 *
 * SAFETY DEFAULTS
 *   Every failure path (missing doc, malformed mode field, Firestore read error)
 *   returns `'off'`. A noisy Cloud Logging warning records the fallback.
 *
 * HOW TO TOGGLE (admin — supervised, this is the PROD-write opt-in)
 *   1. Firebase Console -> Firestore -> `system_settings` collection
 *   2. Open document `package_reconciliation` (create if missing)
 *   3. Set `mode` field to `off` | `dry_run` | `enforce`
 *      (recommend also setting `enabledBy` + `enabledAt` for an audit trail when
 *      flipping to `dry_run`/`enforce` — flipping to `enforce` is the moment the
 *      loop is permitted to write to PROD; treat it as a supervised act.)
 *   4. Effect takes hold across CF instances within `CACHE_TTL_MS` (60s).
 *
 * @module functions/shared/reconciliation-mode
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');

const VALID_MODES = Object.freeze(['off', 'dry_run', 'enforce']);
const DEFAULT_MODE = 'off'; // fail-safe: the writer is OFF unless deliberately enabled
const CACHE_TTL_MS = parseInt(
  process.env.PACKAGE_RECONCILIATION_CACHE_TTL_MS || '60000',
  10
);

const DOC_PATH = {
  collection: 'system_settings',
  document: 'package_reconciliation'
};

// Module-level cache. Reset to null on cold start.
let cachedMode = null;
let cachedAt = 0;

/**
 * Validate and coerce a raw mode value. Invalid -> DEFAULT_MODE (with warn).
 * @param {*} raw
 * @param {string} [reasonContext] diagnostic context for the warn log
 * @returns {string} a value from VALID_MODES
 */
function normalizeMode(raw, reasonContext = '') {
  if (typeof raw === 'string' && VALID_MODES.indexOf(raw) !== -1) {
    return raw;
  }
  functions.logger.warn('[reconciliation-mode] invalid mode -> defaulting to off', {
    raw,
    context: reasonContext,
    validModes: VALID_MODES.slice()
  });
  return DEFAULT_MODE;
}

/**
 * Read the mode document from Firestore. Bypasses cache.
 * On any failure, returns DEFAULT_MODE ('off') with a warn.
 * @returns {Promise<string>} a value from VALID_MODES
 */
async function readModeFromFirestore() {
  try {
    const doc = await admin.firestore()
      .collection(DOC_PATH.collection)
      .doc(DOC_PATH.document)
      .get();
    if (!doc.exists) {
      // Missing doc is acceptable — never configured. Default to OFF (fail-safe).
      return DEFAULT_MODE;
    }
    const data = doc.data() || {};
    return normalizeMode(data.mode, `${DOC_PATH.collection}/${DOC_PATH.document}`);
  } catch (err) {
    functions.logger.warn('[reconciliation-mode] read failed -> defaulting to off', {
      error: err.message
    });
    return DEFAULT_MODE;
  }
}

/**
 * Get the current reconciliation mode, using cache when fresh.
 * Cache is per-CF-instance and TTL-bounded.
 * @returns {Promise<string>} a value from VALID_MODES
 */
async function getReconciliationMode() {
  const now = Date.now();
  if (cachedMode !== null && (now - cachedAt) < CACHE_TTL_MS) {
    return cachedMode;
  }
  const mode = await readModeFromFirestore();
  cachedMode = mode;
  cachedAt = now;
  return mode;
}

/** Test-only: clear cache between tests. */
function _resetCacheForTests() {
  cachedMode = null;
  cachedAt = 0;
}

module.exports = {
  getReconciliationMode,
  VALID_MODES,
  DEFAULT_MODE,
  CACHE_TTL_MS,
  _test: {
    resetCache: _resetCacheForTests,
    readModeFromFirestore,
    normalizeMode
  }
};
