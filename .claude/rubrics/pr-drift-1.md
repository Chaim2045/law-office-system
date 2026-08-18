# Rubric — PR-DRIFT-1

**Title:** feat(functions): Check 7 — package-level consumption drift in dailyInvariantCheck (PR-DRIFT-1)
**Branch:** audit/package-drift-fix
**Base:** main
**File:** `functions/scheduled/index.js` (+ `functions/tests/pr-drift-1-check7.test.js`, `docs/architecture/TIME-TRACKING-FLOW.md`)
**Scope:** Add **Check 7** to the existing nightly `dailyInvariantCheck` cron — the missing rung in the invariant ladder: `package.hoursUsed` vs `Σ(timesheet_entries by packageId)/60` (CONSUMPTION), which no check covered (Check 5 covers only CAPACITY: `totalHours` vs `Σpkg.hours`). Plus the **fixed-service Check-0 false-positive fix** (`type:'fixed'` services track hours in `work.totalMinutesWorked`, not `service.hoursUsed`). Read-only detection — drift entries written to `system_health_checks` alongside the existing checks.

## Why this is the right-sized first step (detect-first)

- Read-only; zero data mutation. The injector fix (PR-DRIFT-0) + repair (PR-DRIFT-2) are separate, later PRs.
- Piggybacks on the existing per-client loop in `dailyInvariantCheck` (which already reads all `timesheet_entries` per client) — **no new Firestore read**.
- Gives the precise repair worklist for PR-DRIFT-2 + a safety net BEFORE the risky injector fix (if PR-DRIFT-0 ever injects drift, Check 7 catches it within 24h).
- Verified PROD footprint this detects: 77 packages / ~1,056h package-level drift + 613 orphan entries (read-only audit 2026-06-21).

## Risk profile

**Low.** Additive to a read-only cron. New discrepancy `type`s appear in `system_health_checks` (no current consumer — PR-C.3 dashboard is still pending, so nothing breaks). Pure helpers (`detectPackageInvariants`, `computeCardHoursUsed`) are unit-tested; the cron loop is a thin wrapper. Behavioral change: the fixed-service Check-0 card calc now reads `work.totalMinutesWorked` (REDUCES false positives).

## MUST criteria (block on FAIL)

### M1 — Check 7 = package.hoursUsed vs Σ(entries by packageId)
**Rule:** For each non-archived HOURS service → each package, compare `pkg.hoursUsed` vs `(packageMinutes[pkg.id]||0)/60`; if `|drift| > 0.05` push `{type:'package_hoursUsed_drift', clientId, clientName, serviceId, packageId, card, entries, drift}`. `drift = card − entries` (signed: + = over-count). Grouping keyed on `entry.packageId` (NOT effectiveServiceId).
**Evidence:** code + test (over-count, under-count, zero-entries, tolerance boundary).

### M2 — Tolerance 0.05 (package grain)
**Rule:** `PKG_HOURSUSED_TOLERANCE = 0.05` — matches Check 5's `PKG_DRIFT_TOLERANCE` (round2 accumulates per-deduction; 0.02 service-grain would false-fire). Exact-0.05 NOT flagged, 0.06 flagged.
**Evidence:** constant + boundary test.

### M3 — Archived services SKIPPED
**Rule:** Check 7 skips `svc.status ∈ NON_AGGREGATING_STATUSES` (`['archived']`, imported from `shared/aggregates`) — consistent with billing aggregation; prevents the PR-G.3.14 false-positive flood (frozen card vs live entries). Archived drift is covered by the PR-DRIFT-2 repair full-scan.
**Evidence:** code + archived-service test (grossly-drifted archived service → nothing flagged).

### M4 — Fixed-service Check-0 false-positive fixed (Part C)
**Rule:** `computeCardHoursUsed(service)` returns `work.totalMinutesWorked/60` for `type===ST.FIXED` (was `service.hoursUsed`=0 → false drift on every fixed service with logged time). The `pricingType===PT.FIXED` (legal-fixed) branch is untouched. No NaN when `work` absent.
**Evidence:** pure helper + tests (fixed / fixed-no-work / legal-fixed / hours / legal-hourly).

### M5 — Orphan signal (desync early-warning)
**Rule:** For a non-archived HOURS service with `packages.length>0`, entries with no `packageId` (`orphanMinutesByService[svc.id]`) → `{type:'orphan_entries_on_packaged_service', ..., orphanMinutes, orphanHours}`. This is the leading indicator of the PR-DRIFT-0 desync (613 in PROD).
**Evidence:** code + test (flagged when packaged; NOT flagged when no packages).

### M6 — Full-scope internal-consistency checks
**Rule:** Also emit (all zero-extra-cost): `package_hoursRemaining_arithmetic` (`hoursRemaining != hours − hoursUsed`), `package_status_incoherent` (depleted w/ remaining>0; active/pending below the −10h floor), `duplicate_package_id` (same `pkg_<ts>` on >1 service → skip value compare, the bucket is ambiguous), `dangling_packageId` (entry → packageId that exists NOWHERE on the client; legal-stage ids ARE catalogued so they're not mis-flagged).
**Evidence:** code + one test per type.

### M7 — SKIP_CLIENTS respected + no new read
**Rule:** Check 7 runs inside the per-client loop that already `continue`s on `SKIP_CLIENTS` (`['2025003']`) and already reads the entries; `packageMinutes`/`orphanMinutesByService` built from that same `forEach`. No new Firestore query.
**Evidence:** code (single read).

### M8 — Pure-helper + `_test` export (testability)
**Rule:** Logic in pure helpers `detectPackageInvariants(clientData, packageMinutes, orphanMinutesByService)` + `computeCardHoursUsed(service)`, exported via `module.exports._test` (mirror `detectAggregateDrift`). Cron loop is a thin wrapper that stamps `clientId`/`clientName` and pushes.
**Evidence:** export block + test file.

### M9 — Tests pass + no regression + read-only
**Rule:** New `functions/tests/pr-drift-1-check7.test.js` green; existing `daily-invariant-check-i1-i4.test.js` + `package-drift-invariant.test.js` + `system-reports-outbox-trigger.test.js` + `holidays-cron-merge.test.js` unchanged-green. No Firestore write added (only the existing `system_health_checks.add` at cron end).
**Evidence:** Jest output (57 passing across 5 suites) + diff.

## SHOULD criteria

### S1 — Comments tagged PR-DRIFT-1 + explain the ladder
**Rule:** Inline comments note Check 7 closes the CONSUMPTION rung (Check 5 = CAPACITY only) + why archived is skipped + why 0.05.
**Evidence:** comments.

### S2 — Doc updated (no "Check 6" staleness)
**Rule:** `docs/architecture/TIME-TRACKING-FLOW.md` Check-6 references updated to include Check 7 (lines ~19, ~394 changelog, ~508).
**Evidence:** diff.

### S3 — PR body shows a sample discrepancy + the detect-first rationale
**Evidence:** PR body.

## Out of scope (deferred — do NOT flag as missing)

- `legal_procedure` STAGE packages drift-check → **PR-DRIFT-3**.
- The injector fix (trigger packageId desync + addTimeToTask:565) → **PR-DRIFT-0**.
- `repairPackageAggregates` CF + the data repair → **PR-DRIFT-2**.
- Admin dashboard for `system_health_checks` → PR-C.3 (pending).
- WhatsApp/SMS alert on drift.

## Rollback

`git revert <merge-commit>` → CI redeploys. Check 7 + the fixed-service card fix disappear; Checks 0-6 unchanged. No data corruption (read-only).

## PRODUCT-GRADE GATES

- **G1 (customer errors):** N/A — no customer-facing UI; output is the internal `system_health_checks` doc (admin-only).
- **G2 (rollback):** PASS — `git revert` (code-only, read-only).
- **G3 (monitoring):** PASS — the feature IS monitoring; existing cron `console.log`/`system_health_checks` success/fail preserved.
- **G4 (test proves scenario):** PASS — tests mirror the real bug (card 100 vs entries 0.75 → flagged; fixed service not false-positived; archived skipped).
- **G5 (Hebrew UI):** N/A — no UI strings (the existing cron's Hebrew `message` is untouched).
- **G6 (breaking change):** N/A — purely additive discrepancy `type`s; no schema/contract/route change. The fixed-service card calc is a false-positive REDUCTION, not a contract change.
- **G7 (security):** N/A — no auth/PII/permissions/rules touched; read-only, no new field exposed.

## Notes for grader

- Detect-first ordering was Haim-approved (2026-06-21) on backend + devils-advocate verdicts; PR-DRIFT-0 (injector) + PR-DRIFT-2 (repair) follow, both devils-advocate-mandatory.
- Scope = "full" (Haim-approved): core 2 signals + the cheap internal-consistency checks. completeness-checker + backend both = GO-WITH-CHANGES; all 🔴 folded (archived-skip, part-C-as-helper, tolerance 0.05, duplicate-id guard, signed drift, NaN-coerce).
- Tests run via the worktree (partial `node_modules`) with `modulePaths` → main's `node_modules`; on CI the standard `functions/ npm test` runs them under the `legacy-js` Jest project.
