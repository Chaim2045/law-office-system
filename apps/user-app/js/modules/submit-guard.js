/**
 * ═══════════════════════════════════════════════════════════════
 * submit-guard.js — time-entry submit guards (PR-1: duplicate-timesheet fix)
 * ═══════════════════════════════════════════════════════════════
 *
 * Two tiny pure helpers for `submitTimeEntry` (apps/user-app/js/main.js), kept
 * out of that 6k-line file so they are unit-testable in isolation (same
 * extraction pattern as budget-crossing.js / israeli-id.js):
 *
 *   1. mintIdempotencyKey() — ONE key per submission, reused across the 3 auto
 *      retries. On a slow network FirebaseService.call('addTimeToTask') times
 *      out at 15s and retries; if the server's first (slow) call already
 *      succeeded, the retry re-runs the write → a DUPLICATE time entry. The
 *      server short-circuits duplicates by this key (see
 *      functions/addTimeToTask_v2.js). The key MUST be minted ONCE, before the
 *      call, so every retry carries the SAME key.
 *
 *   2. isOffline() — is there currently no network connection? When true,
 *      submitTimeEntry blocks the submit and shows a popup instead of firing a
 *      call that would only time out + retry against an unreachable server.
 *
 * PII discipline (repo is PUBLIC): no logging here. The key is a random UUID —
 * it carries no user data.
 */

/**
 * Mint one idempotency key for a single time-entry submission.
 * Prefers crypto.randomUUID(); falls back to a timestamp+random token whose
 * alphabet matches the server-side validator (/^[A-Za-z0-9_-]+$/, ≤200 chars).
 * @param {{ randomUUID?: () => string }} [cryptoObj] - injectable for tests;
 *        defaults to the ambient `crypto` when present.
 * @returns {string}
 */
export function mintIdempotencyKey(cryptoObj) {
  const c = cryptoObj || (typeof crypto !== 'undefined' ? crypto : undefined);
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return 'addtime_' + Date.now() + '_' + Math.random().toString(36).slice(2);
}

/**
 * True when the browser reports no network connection.
 * `navigator.onLine === false` is the only definitive "offline" signal; a
 * missing navigator (non-browser) or `true` is treated as online.
 * @param {{ onLine?: boolean }} [nav] - injectable for tests; defaults to the
 *        ambient `navigator` when present.
 * @returns {boolean}
 */
export function isOffline(nav) {
  const n = nav || (typeof navigator !== 'undefined' ? navigator : undefined);
  return !!n && n.onLine === false;
}

// ─────────────────────────────────────────────────────────────────
// Window mirror — for any non-module (classic <script>) consumer, mirroring
// the budget-crossing.js / israeli-id.js dual-export pattern.
// ─────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.SubmitGuard = { mintIdempotencyKey, isOffline };
}
