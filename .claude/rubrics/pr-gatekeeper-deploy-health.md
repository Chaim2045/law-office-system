# Rubric — Gatekeeper deploy-health check (incident follow-up)

**Title:** Teach `work-session-gatekeeper.sh` to surface a FAILING `ci-cd-production` run — close the process gap that hid the 2026-06-04 PROD-deploy incident (functions/rules frozen in PROD for 6 days, undetected).
**Branch:** `fix/gatekeeper-deploy-health-check`
**Base:** `main`
**App / Env:** Tooling (SessionStart hook) / DEV. No deploy-behavior change.
**Effort:** LIGHT (single hook file, ~20 added lines — effort-scaler skipped, marked obvious-LIGHT).

**Context:** The CI `deploy-production` job was RED on every push to `main` for 6 days (2026-05-28→06-04) on two stacked blockers, freezing ~6 days of Cloud Functions + `firestore.rules` out of PROD — while the gatekeeper's *commit-drift* check looked normal and no session noticed. The gatekeeper informed on uncommitted/stash/branches/PRs/commit-drift, but NOT on whether the deploy actually succeeded. This PR adds that signal.

**Scope:** `.claude/hooks/work-session-gatekeeper.sh` only — add a `DEPLOY_RUN_FAILED` probe (latest `ci-cd-production.yml` run conclusion via `gh`), include it in the clean-state guard, and emit a 🔴 alert line when the last PROD pipeline run failed. Plus this rubric.

## MUST criteria (block on FAIL)

### M1 — Detects a failed PROD pipeline run
**Rule:** The hook queries the latest `ci-cd-production.yml` run on `main` and sets `DEPLOY_RUN_FAILED=1` iff its conclusion is `failure`; it emits a 🔴 alert naming the incident class + the investigate command.
**Evidence:** local run of the hook (current state has a stale failed run) prints the `🔴 LAST PROD PIPELINE RUN FAILED` line. Verified 2026-06-04.

### M2 — A failed run breaks "clean state"
**Rule:** `DEPLOY_RUN_FAILED=1` excludes the "clean state — safe to start" path (added to the all-zero guard), so a broken PROD deploy can never read as "clean".
**Evidence:** `git diff` shows `&& [ "$DEPLOY_RUN_FAILED" = "0" ]` in the clean-state condition.

### M3 — Robust + non-blocking + no new failure mode
**Rule:** The probe is guarded by `command -v gh`; parse failures / empty results default to `DEPLOY_RUN_FAILED=0` (never error); the hook still emits valid JSON and exits 0 under `set -uo pipefail`. The hook continues to INFORM, never blocks (per its design).
**Evidence:** `bash -n` clean; the hook run emits VALID JSON; the `gh|node` pipe has `|| echo -n ""` + try/catch fallback.

### M4 — Honest about the manual-deploy limitation
**Rule:** A code comment documents that a manual `firebase deploy` is out-of-band (not a run) so a stale failed run can over-alert until the next code push — intentional (over-alert > under-alert); the Lead Agent verifies actual state.
**Evidence:** the comment block above `DEPLOY_RUN_FAILED`.

### M5 — No scope creep
**Rule:** Diff touches ONLY `.claude/hooks/work-session-gatekeeper.sh` + this rubric. No workflow change, no other hook, no app code.
**Evidence:** `git diff --stat main..HEAD`.

## SHOULD criteria

### S1 — Lead-Agent habit noted
**Rule:** PR body recommends the complementary behavior (Lead Agent verifies `deploy-production` went green after each merge within the session) — the hook catches it at next SessionStart; the habit catches it immediately. (Not in this PR's diff; recommended follow-up.)

## PRODUCT-GRADE GATES

- **G1 — Customer errors:** N/A — internal tooling (SessionStart hook), no customer-facing path.
- **G2 — Rollback:** PASS — `git revert <merge-commit>`; the hook reverts to the prior (commit-drift-only) behavior. Code-only.
- **G3 — Monitoring:** N/A — this IS monitoring (it adds a deploy-health signal); no data mutation.
- **G4 — Customer-scenario test:** PASS — the "scenario" is "a future session is alerted to a frozen PROD deploy"; verified by running the hook against the current stale-failed run (alert fires) + valid-JSON check. (Bash hook; manual-run evidence is the appropriate test layer.)
- **G5 — Hebrew UI:** N/A — developer-only hook output (English, like the rest of the hook).
- **G6 — Breaking change:** PASS (none) — purely additive signal; existing fields/behavior unchanged; the only behavioral delta is that a failed PROD run now (correctly) reads as not-clean.
- **G7 — Security review:** N/A — no auth/PII/permissions/rules touched; read-only `gh run list`.

VERDICT: (filled by grader)

## Rollback
```bash
git revert <merge-commit>
git push origin main
```
Code-only. No data, no deploy-behavior change.

## Test plan
**Automated/manual:** `bash -n` (syntax) + run the hook and assert valid JSON + the 🔴 line appears while a failed `ci-cd-production` run is latest. Both verified 2026-06-04.
**Self-validating:** merging this PR (a `.claude/` change — NOT path-ignored) triggers `ci-cd-production`, which now deploys green (both incident blockers cleared), so the latest run flips to success and the alert self-clears.

## Notes for grader
- Direct follow-up to the 2026-06-04 incident (recorded in MASTER_PLAN §8.2 banner). The hook is the durable automated guard; the Lead-Agent post-merge-verify habit (S1) is the complement.
- Adds one `gh run list` network call at SessionStart (~1-2s) — same class as the existing `gh pr list` call; acceptable.
