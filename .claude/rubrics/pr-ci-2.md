# Rubric — PR-CI-2: harden `ci-cd-production.yml` against ref/actor shell injection

**Title:** fix(ci): pass `github.ref_name` / `github.actor` through `env:` instead of inlining `${{ … }}` into the `notify` `run:` shell (script-injection hardening).
**Branch:** `fix/ci-shell-injection-pr-ci-2`
**Base:** `main`
**App / Env:** CI / GitHub Actions. No app code, no deploy. Affects only `.github/workflows/ci-cd-production.yml`.
**Effort:** LIGHT (single file + rubric; the change is mechanical env-indirection — 2 inlined expressions migrated). Effort-scaler skipped — task is obviously LIGHT.

**Scope:** This is the spun-off defense-in-depth follow-up that PR #349 (`pr-ci-1`) explicitly deferred (see `pr-ci-1.md` "Explicitly OUT of scope" + MASTER_PLAN §8.2 deferred-list). The `notify` job's **📧 Deployment Status Summary** step inlined two ref/actor-controllable expressions directly into a `run:` shell: `echo "Branch: ${{ github.ref_name }}"` and `echo "Author: ${{ github.actor }}"`. `${{ … }}` is substituted into the script *source* before the shell parses it, so a pushed branch/tag name containing `$(…)`, backticks, `;`, `|`, or `&` would execute as code — the same script-injection class as the PR-title vector. This PR moves both values into a step-level `env:` map and references them as quoted shell variables (`"${PR_REF_NAME}"` / `"${PR_ACTOR}"`), so the runner never re-parses attacker-supplied text as shell code. Reference: GitHub Docs — "Understanding the risk of script injections" / "Good practices for mitigating script injection attacks".

**Severity (honest framing — lower than PR-CI-1, documented):** The `notify` job has `if: always()` and `needs: [health-check]`; because `if: always()` fires even when the needs chain is skipped, the job **does also run on `pull_request` events** (the `on:` block includes `pull_request: branches: [main]`). However, on a PR event the dangerous field is not attacker-controlled: `github.ref_name` resolves to the synthetic `<n>/merge` ref, and the attacker-controlled head-branch name surfaces only in `github.head_ref` — which this step never references. `github.actor`'s login charset `[A-Za-z0-9-]` cannot carry shell metacharacters at all (defense-in-depth only). The genuine injection class is therefore a **collaborator pushing a maliciously-named branch/tag**, where `github.ref_name` CAN contain `$`, backticks, and parens. Same mitigation, applied uniformly. _(Correction vs the original task brief + first draft, which stated the job "does not run on PRs" — it does; the security review caught this. The conclusion — collaborator-only, lower severity — is unchanged.)_

**Explicitly OUT of scope (documented, not dropped):**
- The safe, intentionally-untouched contexts in `ci-cd-production.yml`: `concurrency.group: ${{ github.workflow }}-${{ github.ref }}` (config, not a shell); every `if:` using `github.event_name` / `github.ref` (expression context, not a shell); `${{ secrets.FIREBASE_TOKEN }}` / `${{ secrets.GITHUB_TOKEN }}` (secrets, not user-controlled — already also surfaced via `env:`); and the values left inline in the same `run:` block — `${{ job.status }}` (enum), `${{ github.workflow }}` (repo-defined workflow name), `${{ github.sha }}` (40-char hex). None of these are user-/attacker-controllable shell-metacharacter carriers.
- `pull-request.yml` — already hardened in PR #349 (`pr-ci-1`). Not re-touched.
- `nightly-tests.yml` — re-swept this PR, confirmed clean (only integer `github.run_number`; zero risky `github.*` in any `run:`). No action.

## MUST criteria (block on FAIL)

### M1 — No user-/ref-controlled `github.*` inlined into any `run:` shell
**Rule:** After the change, no `${{ github.ref_name }}`, `${{ github.actor }}`, `${{ github.event.* }}`, or `${{ github.head_ref }}` appears inside a `run:` block in `ci-cd-production.yml`. Every migrated value reaches the shell only via a step-level `env:` map.
**Evidence:** Node `js-yaml` audit walks every step's `run:` string across all three workflow files and tokenizes every `${{ … }}` expression, classifying each `github.<name>` against an allowlist of risky contexts (`event`, `head_ref`, `ref`, `ref_name`, `ref_type`, `actor`, `triggering_actor`) → `ci-cd-production.yml` = **0 risky in `run:`** (only `github.workflow` + `github.sha` remain, both safe). Independently re-verified by the outcomes-grader with a trap-free scan. The only `github.ref_name` / `github.actor` occurrences in the file are now in the comment block (L530–547) and the `env:` map (L550–551). _(Note: the first-draft audit regex used `github.(…|ref|…)\b`, whose `\b` silently fails before the `_` in `ref_name` — it would not have caught an inlined `github.ref_name`; the tokenizing scan above replaces it and is the cited authority.)_

### M2 — Env values referenced as quoted shell variables
**Rule:** Each migrated value is referenced as `"${VAR}"` so expansion is word-split-safe and never re-tokenized.
**Evidence:** `echo "Branch: ${PR_REF_NAME}"` and `echo "Author: ${PR_ACTOR}"` — both expansions occur inside double quotes.

### M3 — Injection neutralized
**Rule:** A branch/tag name (or actor login) containing `"`, `$(…)`, backticks, `;`, `|`, `&` is printed literally and cannot execute. This is the GitHub-recommended mitigation: env-var contents expanded within double quotes are not parsed as shell syntax.
**Evidence:** reasoning in PR body + security review (G7). A tag named `` $(touch pwned) `` would previously have run the substitution at script-assembly time; via `env:` it is assigned as the literal string and echoed verbatim.

### M4 — No behavior change for benign input
**Rule:** The information echoed is identical for normal branch names / actors. Job graph, triggers, timeouts, `needs:`, `if:` conditions, and every other step are unchanged. Only the substitution mechanism of two echo values changed.
**Evidence:** `git diff main..HEAD` shows only the added comment block + `env:` block + two `${{ }}`→`${VAR}` swaps in one step; no step removed/reordered; `job.status` / `github.workflow` / `github.sha` left inline.

### M5 — Workflow remains valid
**Rule:** `ci-cd-production.yml` is valid YAML and valid Actions syntax after the change.
**Evidence:** `js-yaml` parse of all three workflow files clean (actionlint not installed in this environment → YAML-parse is the sanctioned static evidence, per `pr-ci-1` M5). Structure preserved: `env:` is a valid step key alongside `run:`.

### M6 — Scope discipline
**Rule:** The diff touches ONLY `.github/workflows/ci-cd-production.yml` and this rubric. No other workflow, no app code, no `dist/` artifacts.
**Evidence:** `git diff --stat main..HEAD` — exactly two files. (Unrelated local `dist/` build-artifact drift was parked in `git stash` before branching, never entering this branch.)

## SHOULD criteria (warning on FAIL)

### S1 — Rationale comment present
**Rule:** A comment in the workflow explains WHY (injection risk + the PR #349 precedent + link to GitHub guidance) and records the honest lower-severity framing, so a future editor does not "simplify" it back to inline `${{ }}`.
**Evidence:** the `PR-CI-2:` comment block above the step (L530–547).

### S2 — Sibling workflows re-audited
**Rule:** `pull-request.yml` and `nightly-tests.yml` were re-swept to confirm this is the last remaining `run:`-shell injection site of this class.
**Evidence:** the `js-yaml` audit reports both CLEAN (0 risky `github.*` in any `run:`). `pull-request.yml` is hardened (PR #349); `nightly-tests.yml` has no such vector.

## PRODUCT-GRADE GATES

- **G1 — Customer-visible errors:** N/A — output is CI run-log only (developer-facing), never reaches a customer code path.
- **G2 — Rollback:** PASS — `git revert <merge-commit>` + push; takes effect on the next push/dispatch run of the pipeline, no deploy/migration to undo. Documented in Rollback below.
- **G3 — Monitoring:** N/A — no data mutation; CI workflow definition only.
- **G4 — Test proves the scenario:** PASS — there is no unit-test harness for workflow YAML in this repo; the customer-equivalent verification is (a) the `js-yaml` run:-block audit proving 0 risky inlined `github.*`, and (b) the workflow self-executing — the `notify` job's Deployment Status Summary step runs the new `env:` path on the next push to `main` and must print Branch/Author correctly. Manual check listed in Test plan.
- **G5 — Hebrew UI:** N/A — CI logs are internal/developer-facing English (explicitly allowed by G5).
- **G6 — Breaking change:** PASS (none) — no schema/API/route/contract change; identical run-log output for benign input. Purely internal step mechanics.
- **G7 — Security review:** PASS — this PR IS a security hardening (removes the last CI script-injection vector of the PR #349 class). Reviewed by the security agent (spec: `.claude/agents/security.md`) → verdict **PASS_WITH_WARNINGS**: vector provably neutralized (`${{ }}` is spliced into the script source pre-parse; quoted env-var expansion is not re-tokenized), no new attack surface, no secret exposure, and confirmed the last such `run:`-shell site in the file. The single warning was the severity-framing inaccuracy (the job also runs on PRs) — now corrected in the comment + Severity paragraph above. Verdict cited in PR body. Net attack surface strictly decreases; no new surface added.

VERDICT: PASS_WITH_WARNINGS — outcomes-grader (2026-06-03): MUST M1–M6 all PASS, SHOULD S1–S2 PASS, Gates G1–G7 PASS/N-A (zero gate FAILs), Code Review 5/5 PASS-or-N/A, Anti-Premature-Closure severity = minor. Security review (`.claude/agents/security.md`): PASS_WITH_WARNINGS. The warnings were process/evidence items, both now resolved: (a) the first-draft audit regex `\b` blind spot (replaced with a tokenizing scan; re-verified 0 risky), and (b) the severity-framing inaccuracy (job runs on PRs too — corrected in the comment + rubric). Neither affects the artifact's correctness: the fix provably neutralizes the vector and benign-input output is byte-identical. Recommend merge.

## Rollback
```bash
git revert <merge-commit>
git push origin main
```
Code-only (a single workflow file). No data migration, no deploy. Effect applies to the next push/`workflow_dispatch` run of the production pipeline.

## Test plan
**Static:** `js-yaml` parse of `.github/workflows/*.yml` — clean. Programmatic audit (Node) tokenizes every `${{ … }}` in every step `run:` and classifies each `github.<name>` against a risky-context allowlist (`event`/`head_ref`/`ref`/`ref_name`/`ref_type`/`actor`/`triggering_actor`) — 0 risky in `ci-cd-production.yml` (only `github.workflow` + `github.sha` remain). (actionlint is not installed in this environment; YAML-parse + this tokenizing audit is the sanctioned static evidence per `pr-ci-1` M5. The naive `…|ref|…\b` regex is NOT used — its `\b` misses `ref_name`.)
**Live (self-test):** on the next push to `main`, the `notify` → 📧 Deployment Status Summary step runs the rewritten env path; it must print `Branch:` and `Author:` correctly. A future push of a branch/tag whose name contains shell metacharacters will print it literally instead of executing it.

## Notes for grader
- This is a **spun-off local task** — the defense-in-depth follow-up that `pr-ci-1.md` "Explicitly OUT of scope" deferred and MASTER_PLAN §8.2 tracks ("the latent `pull-request.yml` PR-title shell-injection" deferred list; this is its `ci-cd-production.yml` sibling). NOT a numbered Phase-1/2 PR. No MASTER_PLAN row added (§11 requires Haim approval for new rows).
- The diff is **workflow-YAML + this rubric markdown only** — no JS/TS/CSS. Source-code `npm run lint` / `npm test` are unaffected by this diff (N/A-unchanged); the relevant static check is the YAML parse + run:-block audit above, reproducible via the Node `js-yaml` snippet in the PR.
- Env var names `PR_REF_NAME` / `PR_ACTOR` intentionally mirror the `PR_*` convention established in `pull-request.yml` (PR #349) for cross-file consistency, even though this job runs on push/dispatch rather than PRs. This was the naming specified in the task brief.
- devils-advocate NOT invoked: a CI-workflow comment/`env:` edit is not a §3.8.4 high-stakes trigger (no `firestore.rules`/schema/PROD-merge/>100-line refactor/migration) — and this matches the `pr-ci-1` precedent, which shipped the identical change class to `main` without a devils-advocate pass. The security review noted that `security.md`'s own protocol suggests a `/פרקליט-שטן` pass for any security-touching change; the Lead Agent follows the enumerated §3.8.4 triggers + the `pr-ci-1` precedent here and surfaces the choice to Haim — he can request a devils-advocate pass before merge if he wants one.
- Interactive checkpoint (`AskUserQuestion`) skipped: per `decision-point.md`, tiny change (<50 lines, no architectural impact) + fully-specified scope handed down in the task brief. Documented here for audit.
