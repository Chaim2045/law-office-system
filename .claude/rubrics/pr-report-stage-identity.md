# Rubric — PR: report stage identity (wrong-matter figures in a client report)

**Branch:** `fix/report-stage-identity`
**Scope:** `apps/admin-panel/js/managers/ReportGenerator.js` (2 functions) + 1 new test file
**Type:** correctness fix on a CLIENT-FACING document. Frontend-only. No backend, no rules, no schema, no migration.

---

## The defect being fixed

`resolveServiceHours` branch (a) located a legal-procedure stage by **stage id alone**, ignoring
`formData.serviceId`. Stage ids (`stage_a`/`stage_b`/`stage_c`) are position labels that EVERY
legal procedure reuses — they are not unique within a client. The loop took the first service in
`services[]` owning a matching id.

**Live consequence (case 2025009, verified against the production document 2026-08-11):** a report on
stage B of `הליך בוררות` (pricingType **hourly**) rendered "שירות פיקס" + ₪40,000 + 2.2h — the figures
of `הליך משפטי דיני עבודה` (pricingType **fixed**), a different matter of the same client, because the
employment service was created three minutes earlier and therefore came first in the array.

`findServiceByFormData` (used by `renderPackagesBreakdown`) carried the same stage-id clause.

**Measured exposure:** 150 non-internal clients → 39 with ≥1 legal procedure → **9 with 2+ procedures
sharing stage ids** → 2 of those with mixed pricing types (2025009, 2026032) where the label visibly
flips. In the other 7 the pricing type matches, so **no label betrays the swap — only the numbers are
wrong**, which is strictly worse. 2026066 has two procedures with byte-identical names.

---

## MUST (any FAIL blocks the PR)

| # | Criterion | How to verify |
|---|---|---|
| **M1** | A stage report on the ARBITRATION service returns the arbitration stage's own numbers (`totalHours` 59.5, `usedHours` 67.74, `remainingHours` -8.24) and `isFixed === false` | `report-generator-stage-identity.test.ts` — "THE BUG" case |
| **M2** | A stage report on the EMPLOYMENT (fixed) service still returns `isFixed === true` + `fixedPrice` 40000 when it is the selected service — the fix must not break the fixed path | same file |
| **M3** | The fixed-price classifier is LIVE in the test environment. `_isFixedService` delegates to `window.ClientTypeDisplay`, which is absent in happy-dom and returns false for everything — an `isFixed === false` assertion is **vacuous** without a stub | a harness self-check test that FAILS if the classifier is not live |
| **M4** | Ambiguous stage id + no `serviceId` → **refuses to guess**. Returns the pre-existing safe `matchType: 'none'` (zeros, `isFixed:false`, `fixedPrice:null`) and warns. Never picks the first owner | same file |
| **M5** | NO REGRESSION: a client with a single legal procedure still resolves a stage without a `serviceId` (both functions) | 3 no-regression tests |
| **M6** | `findServiceByFormData` clause ORDER is unchanged — only the ambiguous stage-id case is dropped. The name/`s.stage` clauses keep their existing precedence | read the diff: the `.find()` predicate keeps its clause sequence; only the last clause is gated |
| **M7** | No behavior change for hour-package services or top-level (non-staged) service matching — branch (b) untouched | diff scope + existing `report-generator-service-hours.test.ts` still green |
| **M8** | Full admin-panel suite green, zero regressions | `node node_modules/vitest/vitest.mjs run tests/unit/admin-panel/` → 47 files / 560 tests |
| **M9** | Diff touches ONLY the two functions + the new test file. No unrelated edits, no `dist/` churn, no backend files | `git status --porcelain` + `git diff main...HEAD --stat` |

## SHOULD

| # | Criterion |
|---|---|
| S1 | Each edit carries a comment naming WHY (stage ids are position labels, not identifiers) so a future reader does not "simplify" it back |
| S2 | The warn message is actionable and carries no PII (stage id + owner count only, never client name or amounts) |
| S3 | The test fixtures mirror the real 2025009 shape (two procedures, fixed created first, both owning `stage_b`) rather than a synthetic minimal case |

---

## Limit of the claim — "refuses to guess" is scoped to the stage-id clause

Raised by the grader (finding #4) and recorded so a future session does not read the claim as
absolute: in the ambiguous case `resolveServiceHours` falls through to branch (b), where
`findServiceByFormData`'s **`(s.stage && target.includes(s.stage))`** clause can still match a
service by substring containment (e.g. `s.stage === 'ב'` against `formData.service === "שלב ב'"`)
and return `matchType:'service'` — i.e. the WHOLE procedure's totals rather than the stage's.
M6 requires preserving that clause's precedence, so this PR deliberately does not touch it. No
fixture in the suite carries a `.stage` field, so the path is untested. **Not a defect introduced
here; a pre-existing guess path that survives this fix.**

## Explicitly OUT of scope (do NOT grade as missing)

- **The `38.00` client-level figure in the report.** It comes from `client.hoursRemaining` (a
  separate defect: capacity treats separate funds as one pool). Fixing it requires
  `functions/shared/client-writer.js` + `aggregates.js`, which another session currently owns
  (1 session = 1 writer). Tracked separately.
- **CSV export** (`ClientsTable.js:718,755`) — same "leaves the building" class, separate PR.
- **The `service.id`-may-be-a-stage-id ambiguity** at `service-card-renderer.js:238` — flagged,
  unverified, not touched.

## Known gap, declared

**ESLint was NOT run locally.** This worktree carries only the partially-tracked `node_modules`
(no eslint binary). ESLint 0 errors is a Mechanical bar item and is **not claimed as passing** —
CI enforces it on PR open. `node --check` passes on the edited file.

---

## PRODUCT-GRADE GATES (expected)

| Gate | Expected | Why |
|---|---|---|
| G1 errors | PASS | No new customer-facing error path. The refuse-branch reuses the existing `matchType:'none'` handling, which already renders without crashing |
| G2 rollback | PASS | `git revert <sha>` — frontend-only, no data written, no CF deployed |
| G3 monitoring | N/A | Read-only display path; nothing is written |
| G4 test | PASS | 10 tests on the real client shape, including the harness self-check (M3) and 3 no-regression cases |
| G5 Hebrew | N/A | No user-facing string added or changed; the warn is a developer console message |
| G6 breaking | **DECLARE** | Behavioral change on a client-facing report: an ambiguous stage with no `serviceId` now yields `matchType:'none'` instead of another matter's figures. In the live flow `ReportTab._setStageSelection` always supplies `serviceId`, so no live path loses data — the change only removes the wrong-matter fallback |
| G7 security | N/A | No auth, PII, or permission surface touched |
