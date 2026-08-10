# Rubric — PR-A · Closed services refuse new hours (server-side gate)

**Scope:** `functions/` — backend, admin-critical + user-app-critical (both apps call these CFs). A service
whose `status` is CLOSED (`archived` or `completed`) must NOT accept new timesheet hours or new hour
packages, enforced SERVER-SIDE (the CFs use the Admin SDK and bypass firestore.rules → a frontend-only
gate is bypassable). Closes the server half of the "A1" bug (closed services still accept hours today).

**Locked product decisions (Haim, checkpoint 2026-08-10):**
1. Closed set = `HOURS_LOCKED_STATUSES = ['archived','completed']` — a NEW, SEPARATE constant, NOT
   `NON_AGGREGATING_STATUSES=['archived']` (aggregation-only). `on_hold` stays OPEN.
2. `overrideActive` does NOT bypass the status gate.

**Files:** NEW `functions/shared/service-status.js`; gate applied in `functions/addTimeToTask_v2.js`,
`functions/timesheet/index.js` (createQuickLogEntry / createTimesheetEntry_v2 / updateTimesheetEntry),
`functions/services/index.js` (addPackageToService / addHoursPackageToStage). 8 test files.
**No** firestore.rules / schema / aggregation / auth / claim change.

## MUST (any FAIL → grader FAIL)

- **M1 — SSOT helper.** `service-status.js` exports `HOURS_LOCKED_STATUSES=Object.freeze(['archived','completed'])`
  (SEPARATE from `NON_AGGREGATING_STATUSES`; the module comment forbids merging them) + `serviceAcceptsHours(service)`
  (default-active: missing status → accepts) + `assertServiceAcceptsHours(service[, makeError])` that throws
  `failed-precondition` with a Hebrew, user-friendly, **PII-free** message. The helper is override-INDEPENDENT.
- **M2 — every hour-admitting write path is gated, BEFORE any mutation.** The assert is placed at each
  deduction/package chokepoint AFTER the target service is resolved and BEFORE any write, in:
  `addTimeToTaskWithTransaction`, `createQuickLogEntry`, `createTimesheetEntry_v2`, `updateTimesheetEntry`,
  `addPackageToService`, `addHoursPackageToStage`. A throw aborts the transaction cleanly (no partial write).
- **M3 — override does NOT bypass.** The assert is NOT guarded by any `overrideActive` check — a closed +
  `overrideActive:true` service STILL throws (pinned by a test at each path). `overrideActive` continues to
  bypass ONLY the pre-existing `hoursRemaining<=0` gate.
- **M4 — addHoursPackageToStage gates the SERVICE only (stage-level DEFERRED — Q2).** The SERVICE
  (`legalProcedure`) is gated (the locked requirement). The target STAGE is DELIBERATELY NOT gated (a completed/
  archived stage in an ACTIVE service still tops up — the office does this legitimately + no reopen-STAGE path
  exists); the prior `console.warn`-and-proceed on a completed stage is preserved for observability. `updateTimesheetEntry`
  gates only on an hours INCREASE (`minutesDiff > 0`) — a reduction / text / date correction on a closed case is allowed (Q1).
- **M5 — no over-reach.** `addServiceToClient` is NOT gated (it creates a NEW service, not hours on a closed one).
  `NON_AGGREGATING_STATUSES` is neither reused nor modified (aggregation math unchanged). No firestore.rules /
  schema / auth / claim change.
- **M6 — tests + green.** Per gated path: archived→throws+no write, completed→throws, on_hold→allowed,
  active→allowed, override→still throws; + helper unit tests. Full `functions/` jest suite green; ESLint 0.

## SHOULD

- **S1** The helper + each call site carry a comment explaining the SSOT + the override-does-not-bypass rule.
- **S2** `stageWasCompleted` (retained for the audit/return payload) is documented as always-false past the assert.

## Gate notes

- **G1 (errors):** PASS — Hebrew, user-friendly, next-action ("שנה סטטוס לפעיל תחילה"), no PII, no stack trace.
- **G2 (rollback):** PASS — code-only → `git revert <merge-commit>` + redeploy (Haim's supervised deploy). No data migration.
- **G3 (monitoring):** N/A — the change is a REFUSAL before any mutation; it adds no new write. Existing success/failure
  logging on these paths is preserved.
- **G4 (test proves scenario):** PASS — integration-style tests drive each CF handler with a mocked Firestore txn and
  assert both the throw AND that no client write happened.
- **G5 (Hebrew):** PASS.
- **G6 (BREAKING / behavioral — DECLARED):** writes that currently SUCCEED (adding hours/packages to an
  `archived`/`completed` service, or to a `completed` stage) now THROW. This is the intended correctness tightening.
  Migration: none (no data changes); the path forward for a legitimate need is change-status→active first. The
  devils-advocate MUST probe whether any LEGITIMATE current flow (a correction, a backfill/migration script,
  an admin fix) relies on adding hours to a closed service/stage.
- **G7 (security):** N/A — no auth / claims / firestore.rules / PII change. This is data-state admission control,
  not actor-permission. The adversarial write-path angle is covered by the mandatory devils-advocate.

**devils-advocate: MANDATORY** (§3.8.4 — a write-path admission change on a live financial system that refuses
writes which currently succeed). **Ran → GO-WITH-CHANGES; all changes FOLDED (re-verified: 1621/1621, ESLint 0):**
- **Q1 (DA #1, Haim-approved):** `updateTimesheetEntry` now gates ONLY on an hours INCREASE (moved into the
  existing `minutesDiff>0` block) — a reduction/text/date correction on a closed case is allowed (the old
  unconditional block wrongly refused it + the "cannot add hours" message lied on a reduction).
- **Q2 (DA #2/#3, Haim-approved):** scope reduced to SERVICE-level only — the stage-level throw in
  `addHoursPackageToStage` was reverted to warn-and-proceed (deferred: the office tops up completed stages + no
  reopen-STAGE path exists → a hard throw would be a one-way lock). The 4 time-logging paths were already service-level.
- **Revive path (answered):** a closed SERVICE is un-closed via the `changeServiceStatus` ("שנה סטטוס") button →
  `active`; so "closed" is never a permanent lock — an admin revives then adds hours.
- **DA #5 (folded):** a v1-vs-v2 error-class warning comment added to `service-status.js`.
- **DA #4 (residual, Haim-supervised, non-blocking):** the default-active branch does NOT gate a legacy service that
  is closed but MISSING its `status` field. Modern writers always set `status`; verify PROD has 0 such docs
  (services with `completedAt` set + `status` missing) or accept as documented residual. Frontend PR-B locks
  `status||'active'` on the display side.

Grader ran on the pre-fold tree = **PASS_WITH_WARNINGS** (6/6 MUST, 7/7 gates, warnings = process only); the fold is
a DA-driven SCOPE REDUCTION (narrower, not broader) re-verified by the full green suite.
