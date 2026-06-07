# Rubric — PR-CI-1: harden `pull-request.yml` against PR-field shell injection

**Title:** fix(ci): pass user-controlled PR fields through `env:` instead of inlining `${{ github.event.* }}` into `run:` shells (script-injection hardening).
**Branch:** `fix/ci-shell-injection-pr-ci-1`
**Base:** `main`
**App / Env:** CI / GitHub Actions. No app code, no deploy. Affects only `.github/workflows/pull-request.yml`.
**Effort:** LIGHT (single file + rubric; the change is mechanical env-indirection).

**Scope:** A PR title or branch name containing a double-quote breaks the `pr-info` step's shell quoting (observed on PR #348, where a gershayim ת"ז was typed as an ASCII `"`), and — more seriously — a crafted title/branch is an arbitrary-command **script-injection** vector, because `${{ … }}` is substituted into the script *source* before the shell parses it. This PR moves every user-controlled `${{ github.event.pull_request.* }}` value that feeds a `run:` block into a step-level `env:` map and references it as a quoted shell variable, so the runner never re-parses attacker-supplied text as shell code. Four `run:` steps are fixed (JOB 1 `pr-info`; JOB 2 `code-quality` ×2; JOB 4 `security` ×1). Reference: GitHub Docs — "Understanding the risk of script injections" / "Good practices for mitigating script injection attacks".

**Explicitly OUT of scope (documented, not dropped):**
- `ci-cd-production.yml` lines ~536/538 echo `github.ref_name` / `github.actor` in a `run:` block. Different event class (push, collaborator-controlled refs; `github.actor` login charset `[A-Za-z0-9-]` cannot carry shell metacharacters). Lower severity, not the `github.event.*`/`github.head_ref` pattern this task targets → recommended as a **separate defense-in-depth follow-up**, not bundled here.
- `nightly-tests.yml` — clean (only integer `github.run_number`). No action.
- Non-shell contexts in `pull-request.yml` left intentionally unchanged (NOT injection vectors): `concurrency.group: pr-${{ …number }}` (config, integer); `with: ref: ${{ …head.sha }}` (action input, 40-char hex SHA); `with: name: security-report-pr-${{ …number }}` (action input, integer).

## MUST criteria (block on FAIL)

### M1 — No user-controlled `github.event.*` inlined into any `run:` shell
**Rule:** After the change, no `${{ github.event.* }}` (or `${{ github.head_ref }}`) appears inside a `run:` block in `pull-request.yml`. Every such value reaches the shell only via a step-level `env:` map.
**Evidence:** grep of the file — the only `${{ github.event.* }}` occurrences are in `env:` maps (lines 71–77, 139, 149, 243), in `with:` action inputs (head.sha, artifact name), or in `concurrency.group`. Zero inside `run:`.

### M2 — Env values referenced as quoted shell variables
**Rule:** Each migrated value is referenced as `"${VAR}"` (echoes) or inside a quoted argument (`"origin/${PR_BASE_REF}...HEAD"`), so expansion is word-split-safe and never re-tokenized.
**Evidence:** the four `run:` blocks use `${PR_NUMBER}`, `${PR_TITLE}`, … and `"origin/${PR_BASE_REF}...HEAD"`.

### M3 — Injection neutralized
**Rule:** A PR title / head-branch containing `"`, `$(…)`, backticks, `;`, `|`, `&` is printed/used literally and cannot execute. This is the GitHub-recommended mitigation: env-var contents expanded within double quotes are not parsed as shell syntax.
**Evidence:** reasoning in PR body + security-agent review (G7). The previously-breaking `"` case now prints literally.

### M4 — No behavior change for benign input
**Rule:** The information echoed, the `git diff` ref-ranges, the TODO/secret grep logic, job graph, triggers, timeouts, and `needs:` are all unchanged. Only the substitution mechanism changed.
**Evidence:** `git diff` shows added `env:` blocks + `${{ }}`→`${VAR}` swaps only; no step removed/reordered.

### M5 — Workflow remains valid
**Rule:** `pull-request.yml` is valid YAML and valid Actions syntax after the change.
**Evidence:** actionlint (if available) clean, OR YAML parse clean; the workflow self-executes on this very PR (the `pr-info` step runs the new env path live).

### M6 — Scope discipline
**Rule:** The diff touches ONLY `.github/workflows/pull-request.yml` and this rubric. No other workflow, no app code, no `dist/` artifacts.
**Evidence:** `git diff --stat main..HEAD`.

## SHOULD criteria (warning on FAIL)

### S1 — Rationale comment present
**Rule:** A comment in the workflow explains WHY (injection risk + PR #348 trigger + link to GitHub guidance) so a future editor does not "simplify" it back to inline `${{ }}`.
**Evidence:** comment block above the `pr-info` step + short pointers on the other three.

### S2 — Sibling workflows audited, out-of-scope findings enumerated
**Rule:** `ci-cd-production.yml` + `nightly-tests.yml` were swept; the `ci-cd-production.yml` `ref_name`/`actor` finding is recorded for follow-up, not silently dropped.
**Evidence:** "Out of scope" above + PR body completeness note.

## PRODUCT-GRADE GATES

- **G1 — Customer-visible errors:** N/A — output is CI run-log only (developer-facing), never reaches a customer code path.
- **G2 — Rollback:** PASS — `git revert <merge-commit>` + push; the change takes effect on the next PR run, no deploy/migration to undo. Documented in Rollback below.
- **G3 — Monitoring:** N/A — no data mutation; CI workflow definition only.
- **G4 — Test proves the scenario:** PASS — verification is the workflow executing on THIS PR: the `pr-info` step runs through the new `env:` indirection live, and (static) actionlint/YAML-parse confirms validity. There is no unit-test harness for workflow YAML in this repo; CI self-execution is the customer-equivalent test. Manual check: confirm the `📋 PR Information` job is green on this PR and prints Title/Author/branches correctly.
- **G5 — Hebrew UI:** N/A — CI logs are internal/developer-facing English (explicitly allowed by G5).
- **G6 — Breaking change:** PASS (none) — no schema/API/route/contract change; identical run-log output for benign input. Purely internal step mechanics.
- **G7 — Security review:** PASS — this PR IS a security hardening (removes a CI script-injection vector + the quote-breakage on PR #348). Reviewed by the `security` agent (verdict cited in PR body). Net attack surface strictly decreases; no new surface added.

VERDICT: PASS — outcomes-grader (2026-06-02): all MUST M1-M6 PASS, SHOULD S1-S2 PASS, gates G1-G7 PASS/N-A, zero blocking issues. Security review PASS (independently re-verified); completeness audit confirms full coverage, recommends merge.

## Rollback
```bash
git revert <merge-commit>
git push origin main
```
Code-only (a single workflow file). No data migration, no deploy. Effect applies to the next PR validation run.

## Test plan
**Static:** `actionlint .github/workflows/pull-request.yml` (or a YAML parse) — clean. grep confirms no `${{ github.event` inside any `run:`.
**Live (self-test):** this PR's own `📋 PR Information` job runs the rewritten `pr-info` step; it must be green and print PR Number/Title/Author/Base/Head correctly. A future PR with a `"` in its title will no longer fail the step.

## Notes for grader
- This is a **spun-off local task** (MASTER_PLAN §8.2 "deferred & tracked" list — "the latent `pull-request.yml` PR-title shell-injection"), NOT a numbered Phase-1/2 PR. No MASTER_PLAN row is added (§11 requires Haim approval for new rows); the deferred-item line in §8.2 already tracks it.
- `github.event.pull_request.base.ref` is repo-controlled (PR target = `main`), so its three sites are lower-risk than `title`/`head.ref`; they are migrated anyway for a single consistent rule ("no `github.event.*` in a shell") and because the user's instruction said to env every such value.
- devils-advocate was NOT invoked: this is not a §3.8.4 high-stakes trigger (no `firestore.rules`/schema/PROD-merge/>100-line refactor/migration). Flag if you disagree.
