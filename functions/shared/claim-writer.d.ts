/**
 * Type declarations for `functions/shared/claim-writer.js` (Pre-H.0.0.F)
 * ─────────────────────────────────────────────────────────────────────────────
 * The impl is CommonJS JS (consumed by legacy JS writers: auth/index.js,
 * master-admin-wrappers.js). TypeScript callers in `functions/src-ts/`
 * (sync-role-claims.ts) need type-safety; this co-located .d.ts provides it
 * without enabling `allowJs`. Keep in lockstep with claim-writer.js.
 */

export type ClaimMap = Record<string, unknown>;

/** Read-merge-write a role grant: keep existing fields, set `role`. */
export declare function mergeRoleClaim(existingClaims: ClaimMap | null | undefined, role: string): ClaimMap;

/** Read-merge-write a role removal: drop ONLY the `role` key, keep the rest. */
export declare function removeRoleClaim(existingClaims: ClaimMap | null | undefined): ClaimMap;
