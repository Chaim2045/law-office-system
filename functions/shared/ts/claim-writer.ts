/**
 * claim-writer.ts — read-merge-write primitives for Auth custom-claim role edits
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-H.0.0.F · migrated to TypeScript in גל-3ה TS-2 (2026-07-30).
 *
 * `admin.auth().setCustomUserClaims(uid, claims)` REPLACES the entire claims
 * object — it is not a merge. So writing `{role:'admin'}` to a user who also
 * holds another claim field silently DROPS that other field. Pre-H.0.0.E proved
 * this hazard for the v1 revoke (`{}` wiped everything) and §7.5 made
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
 * ─── Build mechanism (A′, in-place — see functions/shared/tsconfig.json) ──────
 * This `.ts` is the SOURCE OF TRUTH; it compiles in place to
 * `functions/shared/claim-writer.js` (+ generated `.d.ts`) at the IDENTICAL path,
 * so the legacy `require('../shared/claim-writer')` + TS `import` consumers resolve
 * unchanged. The old hand-written `.d.ts` "keep in lockstep" burden is GONE — the
 * declaration is now generated from this file.
 *
 * Public-repo safety: pure data transform, no logging, no PII, no network.
 */

export type ClaimMap = Record<string, unknown>;

/**
 * Read-merge-write a role grant: keep every existing claim field, set `role`.
 * @param existingClaims - the user's current customClaims (may be null/undefined)
 * @param role - the role to set (e.g. 'admin', 'partner')
 * @returns the next claims object to write
 */
export function mergeRoleClaim(existingClaims: ClaimMap | null | undefined, role: string): ClaimMap {
  if (typeof role !== 'string' || role.length === 0) {
    throw new Error('mergeRoleClaim: role must be a non-empty string');
  }
  return { ...(existingClaims || {}), role };
}

/**
 * Read-merge-write a role removal (targeted field delete): drop ONLY the `role`
 * key, preserve every other claim field. Replaces the legacy blanket-`{}` revoke.
 * @param existingClaims - the user's current customClaims (may be null/undefined)
 * @returns the next claims object to write (role-free)
 */
export function removeRoleClaim(existingClaims: ClaimMap | null | undefined): ClaimMap {
  const next: ClaimMap = { ...(existingClaims || {}) };
  delete next.role;
  return next;
}
