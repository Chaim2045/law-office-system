# Rubric — Report: fixed-price awareness + null-aggregate guard

**Scope:** Admin Panel client report (`ReportGenerator.js`) crashed for fixed-price legal procedures with `Cannot read properties of null (reading 'toFixed')`. Root: the report had ZERO fixed-price awareness and read a stored-`null` `hoursRemaining` through a `!== undefined` guard (which doesn't catch `null`). A live scan found 24/152 clients (104 fields) with null `hoursRemaining`, **100% fixed-price**.

**Branch:** `fix/report-tofixed-null-aggregate` · **App:** Admin Panel · **Env:** DEV · frontend-only.

**Files:** `apps/admin-panel/js/managers/ReportGenerator.js` (core), `apps/admin-panel/js/ui/ClientManagementModal.js` (null-guard), `apps/admin-panel/js/modules/notification-bell.js` (null-guard, dormant), `tests/unit/admin-panel/report-generator-null-aggregate.test.ts` (new).

## MUST

- **M1 — No crash on a stored `null` aggregate.** Every report read of `hoursRemaining`/`hoursUsed` uses `Number.isFinite()` (not `!== undefined`); a present-and-`null` value falls through to the numeric fallback. Proven by tests (null stage + null package → no throw).
- **M2 — Fixed-price shows price + work-hours, NEVER an hours overdraft.** For a fixed-price legal procedure, `renderServiceInfo`/`renderFinalSummary` show the price (`fixedPrice`/`totalFixedPrice`) + internal work-hours; the timesheet running-balance columns AND their `<th>` headers are suppressed. No "שעות שנרכשו / נותרות / חריגה" for fixed-price. All 4 hours-fed sections branch consistently (no half-fixed table).
- **M3 — Fixed detection via the canonical predicate.** `window.ClientTypeDisplay.isFixedService` (shared/business-rules) — NO inline `type === 'fixed'` classification (eslint `no-restricted-syntax`); new code adds 0 new inline-classification warnings. Absent-helper fallback = treat as hourly (fail-safe, no crash).
- **M4 — Hourly path unchanged (regression).** An hourly stage is NOT flagged fixed and still renders the existing hours framing (purchased/used/remaining + running balance). Proven by regression test.
- **M5 — Payment status NOT shown.** `paid`/`paymentDate`/`totalPaid`/`remainingBalance` are NOT rendered — they have no live source (init-only). Aligns with MASTER_PLAN §8.5 D-C (paidRevenue deferred to H.6). No misleading "₪0 שולם".
- **M6 — Tests prove the customer scenario.** Integration-style tests exercise the real `resolveServiceHours`/`renderServiceInfo`/`renderFinalSummary`/`renderTimesheetRows` (the singleton, not mocks) for the fixed-price client that crashed, plus null-aggregate and hourly-regression cases. ESLint 0 errors.

## SHOULD

- **S1 — Defense-in-depth.** The admin `notification-bell.js` dormant `.toFixed()` sites (incl. one fully-unguarded) are hardened to the same `Number.isFinite` pattern.
- **S2 — Comments explain the why** (the `!== undefined`→`Number.isFinite` rationale; the H.6 payment seam).
- **S3 — Surgical, additive.** No change to the hourly business logic; no new `window.*` global / script-load dependency beyond the already-loaded `ClientTypeDisplay`.

## Out of scope (tracked separately)

- User-app `notification-bell.js` twin (2 dormant sites, different app) → follow-up chip.
- Data backfill of the null fields → NOT applicable for fixed-price (no valid hours-remaining; null is correct). Hourly drift = OWN-x.
- Payment display (paid/balance) → H.6.

## PRODUCT-GRADE GATES (expected)

- **G1** PASS — no crash; no `null`/`NaN`/`undefined` surfaced; Hebrew text.
- **G2** PASS — `git revert <sha>` (frontend-only, no data/schema).
- **G3** N/A — read-only display (no data mutation).
- **G4** PASS — 11 integration-style tests, customer scenario (fixed-price report renders).
- **G5** PASS — all new strings Hebrew ("מחיר קבוע (פיקס)", "שעות עבודה (מדידה פנימית)", "תמחור פיקס").
- **G6** PASS — behavioral display change for fixed-price reports (declared); no data/contract/route change; hourly unchanged.
- **G7** N/A — no auth/PII/permissions; fixedPrice is non-confidential client price on an admin-gated screen (NOT employee cost; §7.6 untouched).
