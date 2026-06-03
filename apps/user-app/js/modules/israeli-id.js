/**
 * ═══════════════════════════════════════════════════════════════
 * Israeli ID (ת"ז) check-digit validator — frontend (Pre-H.1.0b)
 * ═══════════════════════════════════════════════════════════════
 *
 * The single frontend source of truth for ת"ז validation. It is an
 * EXACT behavioral mirror of the backend `isValidIsraeliId()`
 * (`functions/shared/validators.js`, merged in PR #348). The cross-system
 * join key to tofes-mecher (MASTER_PLAN §8.2.5) is the ת"ז, so the
 * frontend pre-check MUST agree with the backend bit-for-bit.
 *
 * SSOT note: backend is CJS (Cloud Functions); this is an ES module served
 * directly to the browser (NOT compiled to dist). Cross-runtime sync is
 * manual — if you change one, change the other. The agreement is PINNED by
 * `tests/unit/user-app/israeli-id-drift-guard.test.ts`, which runs the same
 * 11 canonical vectors as `functions/tests/israeli-id-validator.test.js`
 * against BOTH sides and fails CI on any divergence.
 *
 * PII discipline (repo is PUBLIC): this module NEVER logs the value it
 * validates. Callers must never pass a ת"ז into a raw `console.*`.
 *
 * Algorithm (official Israeli ת"ז / Luhn-like, weights 1,2,1,2…):
 *   - non-string                → invalid
 *   - not 1–9 digits after trim → invalid
 *   - zero-pad to 9             → leading zeros are significant
 *   - all-zeros                 → invalid (passes the raw checksum, not a real ID)
 *   - Σ(folded digit*weight) mod 10 === 0 → valid
 */

/**
 * @param {*} id - candidate ת"ז (string expected)
 * @returns {boolean} true iff `id` is a valid Israeli ID number
 */
export function isValidIsraeliId(id) {
  if (typeof id !== 'string') {
    return false;
  }
  const digits = id.trim();
  if (!/^\d{1,9}$/.test(digits)) {
    return false;
  }
  const padded = digits.padStart(9, '0');
  if (padded === '000000000') {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let inc = Number(padded[i]) * ((i % 2) + 1);
    if (inc > 9) {
      inc -= 9;
    }
    sum += inc;
  }
  return sum % 10 === 0;
}

// ─────────────────────────────────────────────────────────────────
// Window mirror — for non-module (classic <script defer>) consumers
// such as case-creation-dialog.js. Mirrors the tz-helper.js pattern.
// ─────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.IsraeliId = { isValidIsraeliId };
}
