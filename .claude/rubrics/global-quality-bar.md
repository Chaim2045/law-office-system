# Global Quality Bar

**Applies to:** every PR in this repo, regardless of scope.

This is the universal acceptance criteria checked by `outcomes-grader` in addition to PR-specific rubrics. Failing any of these = block.

## Code Quality

### Q1 — TDD or tested
**Rule:** Any new functional code (CFs, helpers, modules) must have tests covering:
- Happy path
- At least one negative path
- Edge cases relevant to the domain

**Exempted:** Pure documentation, schema-only changes, config tweaks, slash commands.

**Evidence:** Test file path + `npm test` output showing the new tests run + pass.

### Q2 — Lint zero errors
**Rule:** `npm run lint` returns 0 errors. Warnings acceptable (pre-existing accepted).

**Evidence:** Output of `npm run lint` showing `0 errors`.

### Q3 — Existing tests don't regress
**Rule:** All previously-passing tests still pass. Total test count does not drop.

**Evidence:** Test count before/after the PR (compare against `main`).

### Q4 — No vanilla / minimum-viable mindset
**Rule:** Code is solid, not "just enough to pass". Indicators of vanilla (FAIL):
- TODO comments without ticket reference
- `console.log` left in production code
- Magic numbers without named constants
- Missing error handling on async ops
- Catch blocks that swallow errors
- Hardcoded paths/IDs that should be config

**Evidence:** Grep for the anti-patterns above on changed files.

## Safety & Reversibility

### Q5 — Rollback path documented
**Rule:** PR description includes a "Rollback" section describing how to revert if something goes wrong in DEV/PROD.

For trivial PRs (test-only, doc-only) — `git revert` is sufficient as documented path.

**Evidence:** Quote from PR description.

### Q6 — Idempotent migrations / scripts
**Rule:** Any new script in `scripts/` must:
- Have a `--dry-run` default mode (no writes)
- Require explicit `--confirm` for live mode
- Be safe to re-run after success (idempotent)
- Write a backup before destructive ops

**Exempted:** Pure read scripts (check, audit, list).

**Evidence:** Script header + early `if (DRY_RUN)` branch + backup write call.

### Q7 — Audit log for state changes
**Rule:** Any CF/script that mutates production data writes an entry to `audit_log` collection.

**Exempted:** Reading, tests, schema-only.

**Evidence:** `logAction(...)` or `db.collection('audit_log').add(...)` call in changed code.

## Cleanliness

### Q8 — No dead code added
**Rule:** Don't introduce code paths that aren't reachable from production. Don't leave commented-out blocks.

**Anti-patterns (FAIL):**
- `// const old = ...` blocks
- Functions exported but never imported
- Files with no callers
- Branches gated on `false`

**Evidence:** Grep for callers of new exports; reading commented blocks.

### Q9 — Docs reflect reality
**Rule:** If the PR changes:
- A public API (CF signature) → update SYSTEM_MAP.md / relevant doc
- A workflow → update relevant `.md` in `docs/`
- A field in a collection → update SYSTEM_MAP.md

**Exempted:** Internal refactors, tests-only, schema-only with no semantic change.

**Evidence:** Diff of `docs/` or `SYSTEM_MAP.md` shows update.

### Q10 — Branch + PR naming consistency
**Rule:** Branch name matches PR title convention:
- `feat/...` → "feat(...)" PR title
- `fix/...` → "fix(...)" PR title
- `chore/...` → "chore(...)" PR title
- `test/...` → "test(...)" PR title

**Evidence:** `git branch --show-current` + `gh pr view`.

## Compliance

### Q11 — `functions/CLAUDE.md` checklist (if `functions/` touched)
**Rule:** PR description addresses all questions in `functions/CLAUDE.md` REQUIRED MENTAL MODEL:
- What writes data?
- What reads it?
- What recalculates aggregates?
- CREATE/UPDATE/DELETE paths?
- Fallback logic?
- Drift between truth levels?

**Evidence:** PR description contains a section addressing these.

### Q12 — `apps/admin-panel/CLAUDE.md` checklist (if admin-panel touched)
**Rule:** PR description addresses:
- What data is shown?
- Source vs derived?
- Filters affecting it?
- Could UI show stale/partial data?

**Evidence:** PR description contains a section addressing these.

### Q13 — No bypass of branch protection
**Rule:** No `--admin`, no `--force` to main/production-stable, no hooks skipped (`--no-verify`).

**Evidence:** Git log (no force-push), recent commands.

## Architectural

### Q14 — Single source of truth respected
**Rule:** If the change touches a SoT (calcClientAggregates, addTimeToTask_v2, client-writer.js):
- Doesn't introduce a duplicate computation
- Doesn't bypass the canonical helper

**Evidence:** Diff doesn't reintroduce known bypass patterns.

### Q15 — Backward compatibility unless explicitly breaking
**Rule:** Schema additions are additive (new fields default to safe values). API additions don't change existing signatures. If breaking, PR description has a **BREAKING CHANGE** section with migration steps.

**Evidence:** Diff inspection.
