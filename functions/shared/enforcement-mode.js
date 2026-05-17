/**
 * Invariant Enforcement Mode — emergency kill-switch for the canonical
 * client-write helper's assertion behavior.
 *
 * Reads `system_settings/invariant_enforcement` from Firestore and caches
 * the result for `CACHE_TTL_MS` (default 60 seconds) per CF instance.
 *
 * Three modes (see `.claude/rubrics/pr-a-6.md` for rationale):
 *   - `enforce`   — current production behavior. Assertion throws on
 *                   violation, write aborted, violation logged.
 *   - `log_only`  — assertion failure does NOT throw. Write proceeds with
 *                   canonical aggregates. Violation logged with the mode
 *                   so post-hoc analysis distinguishes from `enforce`.
 *   - `disabled`  — assertion skipped entirely. No log, no throw. EMERGENCY
 *                   ONLY — leaves no observability of drift. Use only when
 *                   the assertion itself is buggy and producing false
 *                   positives in production.
 *
 * SAFETY DEFAULTS
 *   Every failure path (missing doc, malformed mode field, Firestore read
 *   error) returns `'enforce'`. Misconfiguration must never silently
 *   downgrade safety. A noisy Cloud Logging warning records the fallback.
 *
 * HOW TO TOGGLE (admin)
 *   1. Firebase Console → Firestore → `system_settings` collection
 *   2. Open document `invariant_enforcement` (create if missing)
 *   3. Set `mode` field to `enforce` | `log_only` | `disabled`
 *   4. Effect takes hold across CF instances within `CACHE_TTL_MS` (60s).
 *
 * @module functions/shared/enforcement-mode
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');

const VALID_MODES = Object.freeze(['enforce', 'log_only', 'disabled']);
const DEFAULT_MODE = 'enforce';
const CACHE_TTL_MS = parseInt(
  process.env.INVARIANT_ENFORCEMENT_CACHE_TTL_MS || '60000',
  10
);

const DOC_PATH = {
  collection: 'system_settings',
  document: 'invariant_enforcement'
};

// Module-level cache. Reset to null on cold start.
let cachedMode = null;
let cachedAt = 0;

/**
 * Validate and coerce a raw mode value. Invalid → DEFAULT_MODE (with warn).
 * @param {*} raw
 * @param {string} [reasonContext] — diagnostic context for the warn log
 * @returns {string} a value from VALID_MODES
 */
function normalizeMode(raw, reasonContext = '') {
  if (typeof raw === 'string' && VALID_MODES.indexOf(raw) !== -1) {
    return raw;
  }
  functions.logger.warn('[enforcement-mode] invalid mode → defaulting to enforce', {
    raw,
    context: reasonContext,
    validModes: VALID_MODES.slice()
  });
  return DEFAULT_MODE;
}

/**
 * Read the mode document from Firestore. Bypasses cache.
 * On any failure, returns DEFAULT_MODE (with warn).
 *
 * @returns {Promise<string>} a value from VALID_MODES
 */
async function readModeFromFirestore() {
  try {
    const doc = await admin.firestore()
      .collection(DOC_PATH.collection)
      .doc(DOC_PATH.document)
      .get();
    if (!doc.exists) {
      // Missing doc is acceptable — first deploy, never configured.
      // Default to enforce, but log once-per-cache-cycle for visibility.
      return DEFAULT_MODE;
    }
    const data = doc.data() || {};
    return normalizeMode(data.mode, `${DOC_PATH.collection}/${DOC_PATH.document}`);
  } catch (err) {
    functions.logger.warn('[enforcement-mode] read failed → defaulting to enforce', {
      error: err.message
    });
    return DEFAULT_MODE;
  }
}

/**
 * Get the current enforcement mode, using cache when fresh.
 *
 * Cache is per-CF-instance and TTL-bounded. After TTL expiry, the next call
 * re-reads from Firestore. Concurrent calls during a re-read MAY each issue
 * their own read (acceptable — small extra cost at cache turnover).
 *
 * @returns {Promise<string>} a value from VALID_MODES
 */
async function getEnforcementMode() {
  const now = Date.now();
  if (cachedMode !== null && (now - cachedAt) < CACHE_TTL_MS) {
    return cachedMode;
  }
  const mode = await readModeFromFirestore();
  cachedMode = mode;
  cachedAt = now;
  return mode;
}

/**
 * Test-only: clear cache between tests.
 * NOT exported by default — only accessible via the `_test` namespace.
 */
function _resetCacheForTests() {
  cachedMode = null;
  cachedAt = 0;
}

module.exports = {
  getEnforcementMode,
  // Constants for callers + tests
  VALID_MODES,
  DEFAULT_MODE,
  CACHE_TTL_MS,
  // Test-only namespace
  _test: {
    resetCache: _resetCacheForTests,
    readModeFromFirestore,
    normalizeMode
  }
};
