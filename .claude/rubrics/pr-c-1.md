# Rubric — PR-C.1

**Title:** feat(functions): add I1-I4 aggregate drift check to dailyInvariantCheck (PR-C.1)
**Branch:** feat/add-i1-i4-to-daily-invariant-check-pr-c-1
**Base:** main
**File:** `functions/scheduled/index.js`
**Scope:** Extend the existing `dailyInvariantCheck` (cron at 06:00 Asia/Jerusalem) to include a sixth check: per-client comparison of stored client-aggregate fields vs canonical (`recomputeTotalHours` + `calcClientAggregates`). Drift entries written to `system_health_checks` alongside the existing 5 checks. **Automation companion** to PR-D's on-demand audit — same comparison logic, same tolerance, but runs nightly without manual trigger.

## Why this is small

- `dailyInvariantCheck` already iterates `clientsSnapshot.docs`. Sixth check piggybacks on the existing loop (or runs as its own loop — minor stylistic choice).
- Same `clients` collection read used by checks 1, 2, 5. No new query.
- Discrepancy format mirrors the existing 5 — `discrepancies.push({ type: 'aggregate_drift', clientId, clientName, driftFields })`.
- No new dependencies, no new modules, no new scheduled jobs.

## Risk profile

**Low.** Read-only addition to an existing read-only cron. New `type: 'aggregate_drift'` entries appear in `system_health_checks`. Failure mode: false positives if `calcClientAggregates` ever diverges from the helper's internal use — same risk PR-D already carries.

## MUST criteria (block on FAIL)

### M1 — New imports
**Rule:** `functions/scheduled/index.js` imports `calcClientAggregates` from `../shared/aggregates` and `_recomputeTotalHours` from `../shared/client-writer`. Same pattern PR-D uses.
**Evidence required:** Diff.

### M2 — Check 6 added to `dailyInvariantCheck`
**Rule:** New block inside `dailyInvariantCheck` that, for each client doc not in `SKIP_CLIENTS`, computes canonical aggregates (recomputeTotalHours + calcClientAggregates) and compares against stored fields. Drift entries pushed to `discrepancies` with `type: 'aggregate_drift'`.
**Evidence required:** Code block.

### M3 — Tolerance + fields covered
**Rule:** Numeric fields (`totalHours`, `hoursUsed`, `hoursRemaining`, `minutesUsed`, `minutesRemaining`) compared with tolerance 0.02 (matches PR-D + the existing `TOLERANCE` constant in the cron). Boolean fields (`isBlocked`, `isCritical`) strict equality.
**Evidence required:** Reading the code; same constant reused (`TOLERANCE`).

### M4 — SKIP_CLIENTS respected
**Rule:** Sixth check skips the same clients as the rest of the cron (`SKIP_CLIENTS` defined locally — currently `['2025003']`). No new exemption list.
**Evidence required:** Reading the code.

### M5 — Discrepancy shape compatible with existing 5
**Rule:** Each drift entry has `type: 'aggregate_drift'` plus `clientId`, `clientName`, `driftFields: [{ field, current, canonical, diff? }]`. Pattern mirrors `package_drift` and `task_actualHours_actualMinutes_drift`.
**Evidence required:** Reading the code; test asserts shape.

### M6 — Empty-services clients skipped
**Rule:** Clients with `services.length === 0` should NOT be flagged (canonical aggregates for empty services = all zeros / isBlocked=false; if the doc happens to have stale non-zero values for some legacy reason, that's a different bug class). Match the existing cron pattern (Check 1 skips clients with zero services).
**Evidence required:** Reading the code.

### M7 — Tests cover Check 6
**Rule:** New test file `functions/tests/daily-invariant-check-i1-i4.test.js`:
- Drifted client → drift entry pushed with correct fields
- Clean client → no drift entry
- Multiple drift fields → all reported in `driftFields` array
- Empty-services client → no drift entry
- SKIP_CLIENTS exempted

Note: existing dailyInvariantCheck has no dedicated test file — the structure makes it hard to unit-test the whole cron in isolation. To keep the test surface narrow, expose the new Check 6 logic as a pure function (`detectAggregateDrift(clientData)`) exported via `module.exports._test` (mirror the pattern used in `timesheet-trigger.js`). Tests target the pure function.

**Evidence required:** Test file + Jest output.

### M8 — Cron still runs end-to-end
**Rule:** Adding Check 6 must not break existing cron flow. Existing 5 checks unchanged. `system_health_checks` write at the end aggregates all discrepancies (existing + new).
**Evidence required:** Code diff is purely additive to the discrepancies array; status/save logic untouched.

### M9 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Inline comment tagged PR-C.1
**Evidence required:** Comment block above the new check.

### S2 — Comment explains relationship to PR-D
**Rule:** Inline comment notes: "Companion to PR-D's on-demand audit. Same logic, nightly automation. Drift entries surface in `system_health_checks` for review."
**Evidence required:** Comment.

### S3 — PR description names PR-D predecessor + monitoring narrative
**Evidence required:** PR body.

### S4 — Output sample shown in PR description
**Rule:** PR body shows what a drifted-client entry looks like inside the resulting `system_health_checks` document.
**Evidence required:** PR body.

## Out of scope

- WhatsApp alert on drift (PR-C.2)
- Admin dashboard for `system_health_checks` (PR-C.3)
- Promoting `_recomputeTotalHours` to a public name (separate cleanup PR)
- New cron job dedicated to I1-I4 (this PR piggybacks on the existing 06:00 cron)
- Auto-repair on detection (out of scope; admin runs `repairClientAggregates` from PR-D on review)
- Twilio SMS on drift (TODO in existing cron, separate concern)

## Rollback

`git revert <merge-commit>` → CI redeploys. Sixth check disappears. The other 5 checks unchanged. No data corruption.

## Notes for grader

- This PR is intentionally tiny. The cron infrastructure was already built (5 checks running daily). PR-C.1 only adds a sixth check using the same patterns.
- After this merges + 24h elapses, the next 06:00 cron run will produce the first nightly drift report. Haim sees it under `system_health_checks` (most recent doc).
- PR-C.2 (WhatsApp alert) is the next natural step — but only valuable once C.1 has produced a few clean reports and Haim understands the baseline.
- After PR-D + PR-C.1, the original 23-victim incident is fully addressed: detection (nightly + on-demand), repair (on-demand), and prevention (PR-A + PR-B closed the architectural gap).
