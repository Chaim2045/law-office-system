/**
 * claim-writer.js — read-merge-write primitives for Auth custom-claim role edits
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-H.0.0.F. `admin.auth().setCustomUserClaims(uid, claims)` REPLACES the
 * entire claims object — it is not a merge. So writing `{role:'admin'}` to a user
 * who also holds another claim field silently DROPS that other field. Pre-H.0.0.E
 * proved this hazard for the v1 revoke (`{}` wiped everything) and §7.5 made
 * read-merge-write a HARD prerequisite before any partner/composite claim ships.
 *
 * These two PURE functions are the single canonical place that computes the next
 * claims object from the EXISTING claims, so every writer (syncRoleClaims, the v1
 * setAdminClaim grant/revoke, master-admin updateUser) edits ONLY the `role`
 * field and preserves any other claim a user legitimately holds. They do no I/O:
 * the caller reads `userRecord.customClaims` (which it already fetches) and passes
 * it in, then writes the returned object — avoiding a double `getUser`.
 *
 * NOTE: new-user creators (createUser / createAuthUser) intentionally do NOT use
 * these — a freshly-created user has no prior claims to preserve, so a direct
 * full write is correct there.
 *
 * Public-repo safety: pure data transform, no logging, no PII, no network.
 */
'use strict';

/**
 * Read-merge-write a role grant: keep every existing claim field, set `role`.
 * @param {Record<string, unknown>|null|undefined} existingClaims - the user's current customClaims
 * @param {string} role - the role to set (e.g. 'admin', 'partner')
 * @returns {Record<string, unknown>} the next claims object to write
 */
function mergeRoleClaim(existingClaims, role) {
  if (typeof role !== 'string' || role.length === 0) {
    throw new Error('mergeRoleClaim: role must be a non-empty string');
  }
  return { ...(existingClaims || {}), role };
}

/**
 * Read-merge-write a role removal (targeted field delete): drop ONLY the `role`
 * key, preserve every other claim field. Replaces the legacy blanket-`{}` revoke.
 * @param {Record<string, unknown>|null|undefined} existingClaims - the user's current customClaims
 * @returns {Record<string, unknown>} the next claims object to write (role-free)
 */
function removeRoleClaim(existingClaims) {
  const next = { ...(existingClaims || {}) };
  delete next.role;
  return next;
}

module.exports = { mergeRoleClaim, removeRoleClaim };
