# Rubric — PR-SEC-A2 · Case management is admin-only (backend enforcement)

**Scope:** `functions/` — backend, security + product. Follows PR-SEC-A. Haim's decision
(2026-08-10, data-verified): **opening a case and adding a service are admin-only management
actions.** This (a) closes the `addServiceToClient` billing-IDOR the devils-advocate found (an
employee could add a service with an arbitrary `fixedPrice` to ANY client), and (b) implements
Haim's model: only the management group opens cases; lawyers do not.

**Data verification (Haim-mandated, done first via a read-only `list-management-group.js`/ADC probe):**
15 employees — **5 `role:'admin'`** (haim, guy, or, roi, **office@ = the office manager**), **10
`role:'lawyer'`**, **0 with the `isAdmin` boolean flag**. So `role==='admin'` is the sole live
"management" definition and already includes the office manager; a role-only gate locks NOBODY out.

**Files:** `functions/clients/index.js` (`createClient`), `functions/services/index.js`
(`addServiceToClient`), 5 re-anchored test files (incl. `admin-cf-role-gate.test.js` — see M3),
2 new rejection tests, + read-only `functions/scripts/list-management-group.js`. **No** rules/schema/claim change.

**Integration note (devils-advocate GO-WITH-CHANGES, applied):** the branch was cut in parallel to
PR-SEC-A (#536) and has been **rebased ONTO `origin/main`** so the graded artifact == the shipped
artifact (the 9 #536 gates are present in the integrated tree: services=8, clients=7 `role!=='admin'`
occurrences incl. A2's two). Full integrated suite **1637/1637**, ESLint 0.

## MUST

- **M1 — createClient + addServiceToClient are admin-gated.** `if (user.role !== 'admin') throw
  permission-denied` (Hebrew) immediately after `checkUserPermissions`, before any validation/mutation.
- **M2 — no over-reach / no broken flow (verified whole-system).** `createClient` has 0 internal/trigger
  callers (all references are comments); the admin-panel uses `createClientFromSalesRecord` (tofes), not raw
  `createClient`; the live user-app callers are the case-creation flow — admins (incl. office@) who create via
  the user-app dialog PASS the gate; lawyers are blocked (intended). `updateClient`/`deleteClient` stay
  owner-or-admin (unchanged). No other CF gated.
- **M3 — tests.** Non-admin → `permission-denied` (+ no write, fail-closed) for BOTH `createClient` and
  `addServiceToClient`; the pre-existing happy-path suites re-anchored `'manager'`→`'admin'` (legit caller).
  Integration additionally re-anchored `admin-cf-role-gate.test.js`: PR-SEC-A deliberately EXCLUDED
  `addServiceToClient` and LOCKED that exclusion ("a future change can't silently admin-gate it"); A2 is that
  change (Haim-approved) → `addServiceToClient` + `createClient` moved into the gated set, and the header
  rationale updated to record the reversal. Full integrated `functions/` suite green (1637/1637); ESLint 0.

## Gate notes
- **G1/G5:** PASS — Hebrew `permission-denied` ("רק מנהל יכול לפתוח תיק חדש" / "…להוסיף שירות לתיק").
- **G2:** PASS — `git revert` + supervised redeploy.
- **G3:** N/A — refusal before any mutation.
- **G4:** PASS — behavioral non-admin rejection on both CFs.
- **G6 — BREAKING (DECLARED):** the 10 lawyers can NO LONGER open cases / add services via the user app (they
  could before — deliberately built). Haim-approved workflow change (case management = admin function).
  Migration: none (data unchanged); the 5 admins (incl. the office manager) do case management.
  **UX fast-follow (declared, NOT in this PR):** hide the "open case" button in the user app for non-admins —
  today they still SEE it and get a clean Hebrew `permission-denied` on click (graceful; verified by the
  cross-component red-team). Needs a small user-app investigation (the button trigger + the client-side role
  source), tracked as PR-SEC-A2-frontend.
- **G7 — SECURITY (this IS the fix):** authz hardening; mirrors PR-SEC-A. **devils-advocate MANDATORY (§3.8.4).**
