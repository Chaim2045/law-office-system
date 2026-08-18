# Rubric — PR-DRIFT-2.1 (dry-run report self-sufficiency)

**Title:** chore(functions): repair-script dry-run report — surface orphan/hours/package totals
**Branch:** chore/drift-2-1-dryrun-report → main (DEV)
**File:** `functions/scripts/repair-package-aggregates.js` (the PR-DRIFT-2 supervised repair script — NOT deployed; manual ops tool).
**Scope:** REPORT-ONLY. The dry-run rollup previously left the orphan/unresolved counters at 0 (they were filled only inside `applyClient`, which runs solely on `--apply`), and never surfaced the per-client/aggregate HOURS being corrected — the key billing-review number. This PR makes the dry-run report self-sufficient by aggregating, for EVERY scanned client:
- `orphansToStampTotal` / `orphansOnSkippedTotal` / `unresolvedTotal`
- `netHoursDelta` + `absHoursDelta` (service-level — the billing-review number)
- `packageCardReconcileAbs` (per-package-card movement — the dormant redistribution being reconciled)
plus the per-client `netHoursDelta` / `absHoursDelta` / `packageCardReconcileAbs` in `summarizeForReport`.

**NO change to the repair logic, the `--apply` mutation path, the forward-replay core, DRIFT-0, or the trigger.** Effort: obviously LIGHT (+26/-1, single ops script, non-deployed). Verified by running the dry-run against PROD 3× (read-only) — the new fields populate correctly.

## MUST
- **M1** — additive report fields only; `summarizeForReport` + the `main()` counts rollup; no edit to `applyClient`/`buildClientPlan`/the core. **Evidence:** the +26/-1 diff is confined to the two report sites.
- **M2** — `node --check` clean; the dry-run runs against PROD read-only and emits the new fields with sane values (orphansToStampTotal 280 / orphansOnSkippedTotal 275 / unresolvedTotal 0 / netHoursDelta ≈ 0 / absHoursDelta 0.30 / packageCardReconcileAbs 3.94, run 2026-06-22). **Evidence:** 3 PROD dry-runs.
- **M3** — no PII: the new fields are aggregate hours/counts only (no names/emails/ids beyond the existing non-PII report). **Evidence:** grep of the diff.

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — ops script + console report, no customer UI.
- **G2 (rollback):** PASS — `git revert` (report-only, trivially reversible; no data touched).
- **G3 (monitoring):** N/A — read-only report formatting; the `--apply` mutation/audit path is UNCHANGED.
- **G4 (test proves scenario):** PASS — manual smoke (3 PROD dry-runs) confirms the new fields populate; the repair core/logic is unchanged and already covered by the PR-DRIFT-2 suite (88 tests).
- **G5 (Hebrew UI):** N/A — no customer UI.
- **G6 (breaking change):** N/A — additive report fields; no contract/schema/route change.
- **G7 (security):** PASS — aggregate hours/counts only, no PII; no auth/permissions touched.

## Verdict
Lead-Agent self-certification under effort-scaling (obviously LIGHT: report-only, non-deployed ops script, +26/-1, verified by 3 read-only PROD dry-runs). The repair logic this report describes already passed grader + 2 devils-advocate rounds (PR-DRIFT-2).

VERDICT: PASS
