# Rubric — PR: scope client work-hours report to the selected service/stage

**Title:** fix(admin): client work-hours report shows only the selected service/stage (stop summing all services/stages)
**Branch:** `fix/pr-report-stage-hours`
**Base:** `main`
**App / Env:** Admin Panel / DEV first. Frontend display only — no backend, no Firestore writes, no data migration.
**Effort:** LIGHT–MEDIUM (one source file: a new pure SSOT helper + 3 methods rewired, ~124 net lines removed; + one unit-test file + this rubric).

**Scope:** The Admin Panel client work-hours report over-counted hours. For a client with multiple services, or a `legal_procedure` with stages (שלב א/ב), `renderServiceInfo` (the purchased/used/remaining box) and `renderTimesheetRows` (the running-balance column) matched only top-level `client.services[]` and, on a miss, fell back to `client.totalHours` / `client.hoursRemaining` — the client-wide aggregate (the over-count). Only `renderFinalSummary` was stage-aware. This PR adds one pure SSOT helper `resolveServiceHours(client, formData)` and routes all three render methods through it, so every section shows only the selected service/stage, and the client-aggregate fallback is removed for single service/stage selection.

**OUT of scope (documented, not dropped):**
- Backend `functions/services/index.js:173` parent-service `totalHours = Σ stages` and `functions/shared/aggregates.js` service-level summation — not needed for the display fix; flagged for a possible separate PR.
- Optional defensive string-coercion of `formData.service` before `.includes()` — a pre-existing pattern across the file, not reachable from the validated UI caller (`ClientReportModal.getFormData` + `validateForm` block empty/undefined). Documented, not changed here, to keep the diff focused.

## MUST criteria (block on FAIL)
### M1 — A single service/stage never shows client-wide totals
For any selection other than "all", figures come only from the matched stage/service; `client.totalHours` / `client.hoursRemaining` are read ONLY inside the "all" branch when `services[]` is empty. Evidence: `resolveServiceHours` branches (a)/(b)/(c)/(d); 12 unit tests incl. explicit `not.toBe(client.*)` guards.
### M2 — The three report sections agree
`renderServiceInfo`, `renderTimesheetRows`, `renderFinalSummary` all delegate to `resolveServiceHours`. Evidence: git diff.
### M3 — No regression on existing paths
"all services" stays archived-aware (PR-G.3.14) with arithmetically identical used-hours math; hour packages resolve by name; the running balance is still gated on `client.type`; the no-match timesheet-derived fallback is preserved. Evidence: grader trace + 12 tests + full suite 410 pass.
### M4 — Scope discipline
Diff touches only `ReportGenerator.js` + the new test + this rubric. No `dist/` artifacts. Evidence: `git diff --stat`.

## SHOULD criteria (warning on FAIL)
### S1 — Tests prove the customer scenario
A multi-service stage-A report returns stage-only figures and explicitly does NOT equal the client aggregate. Evidence: test asserts `total=10, used=2, remaining=8` + `not.toBe(client.hoursRemaining)`.
### S2 — Manual DEV smoke before PROD
Verify in DEV: legal_procedure stage A + a separate service; a pure hour package; "all services"; an overdraft stage — the three report sections must match.

## PRODUCT-GRADE GATES
- G1 — Customer-visible errors: PASS — figures via `.toFixed` on numeric helper output; usage% guards divide-by-zero; overdraft renders Hebrew "חריגה"; no NaN/undefined/[object Object].
- G2 — Rollback: PASS — `git revert <commit>` + redeploy; single file, no data/migration.
- G3 — Monitoring: N/A — read-only report rendering, zero Firestore writes.
- G4 — Test proves scenario: PASS — 12 unit tests incl. the multi-service stage over-count + regression guards (report != client aggregate).
- G5 — Hebrew UI: PASS — no new user-facing strings; one dev-only `console.warn` (allowed by G5).
- G6 — Breaking change: PASS — no schema/contract change; the corrected display IS the intended fix; no migration.
- G7 — Security/PII: N/A — no auth/permissions/PII touched.

VERDICT: PASS_WITH_WARNINGS — outcomes-grader (2026-06-07): MUST M1-M4 PASS, SHOULD S1-S2 PASS, gates G1/G2/G4/G5/G6 PASS + G3/G7 N/A, zero MUST-fix items. Warnings (non-blocking): keep untracked `dist/` artifacts out of the commit; the optional `formData.service` coercion is deferred (unreachable from the UI). 12/12 new tests + 410 full-suite pass; ESLint 0 errors on changed files.

## Rollback
```bash
git revert <merge-commit>
git push origin main
```
Frontend-only; no data migration, no backend deploy.

## Test plan
**Automated:** `npx vitest run tests/unit/admin-panel/report-generator-service-hours.test.ts` (12 pass) + full `npx vitest run` (410 pass). `npx eslint` on changed files (0 errors).
**Manual (DEV, before PROD):** generate a report for a legal_procedure client in stage A who also has a separate service — the purchased/used/remaining box, the running-balance column, and the bottom summary must all show ONLY stage A. Repeat for a pure hour package and for "all services" (must be unchanged). Confirm an overdraft stage shows the correct negative balance + "חריגה".

## Notes for grader
- Frontend-only display fix; not a §3.8.4 high-stakes trigger (no `firestore.rules`/schema/PROD-merge/>100-line risky refactor/migration), so devils-advocate was not invoked. The change is a net-deletion refactor that consolidates triplicated matching into one tested helper.
- Independent validation (frontend/admin lens) confirmed the diagnosis before code; outcomes-grader reviewed the diff and returned PASS_WITH_WARNINGS.
