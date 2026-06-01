# Rubric — Pre-H.0.0.D-followup

**Title:** Exclude root config `*.ts` from root `tsconfig.json` (stop stray dist artifacts)
**Branch:** `chore/tsconfig-exclude-config-artifacts`
**Base:** `main`
**Effort:** LIGHT (single-file tsconfig change + removal of already-committed stray build artifacts). effort-scaler skipped — obviously LIGHT.

**Scope:** The root `tsconfig.json` `include: ["*.ts", ...]` glob is meant to pick up the few root `*.ts` utilities, but it also sweeps in root-level tool config files (`vitest.config.ts`, `vitest.rules.config.ts` [added in Pre-H.0.0.D / PR #343], `playwright.config.ts`). As a result `npm run compile-ts` emits stray `*.config.{js,d.ts,js.map,d.ts.map}` artifacts into `apps/user-app/dist/`. This PR adds `"*.config.ts"` to the `exclude` array and removes the already-committed stray artifacts from `apps/user-app/dist/`.

## MUST criteria (block on FAIL)

### M1 — `"*.config.ts"` added to root `tsconfig.json` `exclude`
**Rule:** The `exclude` array contains `"*.config.ts"`, with a comment explaining why (config files are tooling, not shipped code).
**Evidence required:** diff of `tsconfig.json` shows the added entry + comment.

### M2 — `compile-ts` no longer emits config-file artifacts
**Rule:** After the fix, a clean `npm run compile-ts` produces **zero** `apps/user-app/dist/*config*` files (`vitest.config.*`, `vitest.rules.config.*`, `playwright.config.*`). `tsc` still exits 0.
**Evidence required:** `rm -f apps/user-app/dist/*config* && npm run compile-ts && ls apps/user-app/dist/*config*` → no matches, exit 0. (Captured in this session — reproduced before AND after.)

### M3 — Already-committed stray config artifacts removed
**Rule:** The 8 tracked stray artifacts (`playwright.config.{d.ts,d.ts.map,js,js.map}` + `vitest.config.{d.ts,d.ts.map,js,js.map}`) are removed via `git rm`. No config artifact remains tracked under `apps/user-app/dist/`.
**Evidence required:** `git ls-files 'apps/user-app/dist/*config*'` → 0 hits after the change is staged/committed.

### M4 — No scope creep
**Rule:** The commit touches ONLY `tsconfig.json`, the 8 config-artifact deletions, and this rubric. Pre-existing working-tree noise (modified `node_modules/`, untracked diagnostic `scripts/`, the in-flight PR-META-9 `.claude/workflows/` work) is NOT included. The committed `apps/user-app/dist/` build-drift (regenerated `event-bus`/`schemas`/`firebase-service`/`types` outputs from a stale committed dist) is explicitly OUT OF SCOPE and restored to HEAD.
**Evidence required:** `git diff --cached --stat` shows exactly `tsconfig.json` + 8 deletions + 1 rubric, nothing else.

## SHOULD criteria (warning on FAIL)

### S1 — Comment names all three config files + the mechanism
**Rule:** The tsconfig comment names the affected configs and explains the `include: ["*.ts"]` sweep so a future reader understands why the exclude exists.
**Evidence required:** comment text in diff.

## PRODUCT-GRADE GATES

- **G1 — Customer errors**: N/A — build-tooling config only. No code path, no customer-visible output changed.
- **G2 — Rollback**: PASS — `git revert <merge-commit>` restores the previous `tsconfig.json` and re-adds the removed dist artifacts. Trivial, code-only, < 1 minute.
- **G3 — Monitoring**: N/A — no data write/update/delete. Pure build-config change.
- **G4 — Customer-scenario test**: PASS (proportionate) — the "customer scenario" here is the developer build. Verified by reproduction: `compile-ts` emitted `vitest.rules.config.*` BEFORE the fix and emits zero config artifacts AFTER. `tsc` exit 0 both runs. No automated test added — a tsconfig glob exclusion is verified by the build itself, not a unit test (documented in Test plan).
- **G5 — Hebrew UI**: N/A — no customer-facing strings touched.
- **G6 — Breaking change**: PASS — purely additive exclude. The excluded config files were never legitimately part of the root TS program's shipped output; removing their stray dist artifacts changes no runtime behavior. The real app bundle (`apps/user-app/dist/assets/*`, produced by Vite) is untouched.
- **G7 — Security review**: N/A — no auth, PII, permissions, or rules touched.

## Out of scope (do not downgrade for absence)

- The committed `apps/user-app/dist/` being stale vs. current source (regenerated `event-bus`/`schemas`/`firebase-service`/`types/index` outputs, new `types/services.*`). Pre-existing drift, unrelated to config exclusion — flagged to Haim, not fixed here.
- The double-nested `apps/user-app/dist/apps/user-app/...` output layout (missing `rootDir`). Separate pre-existing tsconfig concern.
- Whether `apps/user-app/dist/` should be committed at all / gitignored. Pre-existing decision, out of scope.
- The in-flight PR-META-9 workflows work present in the working tree. Not mine.

## Rollback

```bash
git revert <merge-commit>
git push origin main
```

Restores `tsconfig.json` and re-adds the 8 dist config artifacts. No data, no users, no PROD app artifact affected.

## Test plan

**Automated (this PR, reproduced in-session):**
1. BEFORE fix: `npm run compile-ts` → `apps/user-app/dist/vitest.rules.config.{js,d.ts,js.map,d.ts.map}` appear (bug reproduced), alongside pre-existing `playwright.config.*` + `vitest.config.*`.
2. AFTER fix: `rm -f apps/user-app/dist/*config* && npm run compile-ts` → zero `*config*` artifacts in dist, `tsc` exit 0.
3. `git ls-files 'apps/user-app/dist/*config*'` → 0 hits (no stray artifact tracked).
4. `git diff --cached --stat` → only `tsconfig.json` + 8 deletions + rubric.

**Manual:** none required — no deployable behavior change. The Vite-produced app bundle is unaffected; nothing reaches PROD differently.

## Notes for grader

- This is a follow-up cleanliness fix to Pre-H.0.0.D / PR #343, which introduced `vitest.rules.config.ts` at repo root — the third config file to get swept into the root TS program.
- The fix is the minimal correct one: exclude `*.config.ts` (covers all current + future root tool configs) rather than enumerating each file.
- The only root `*.ts` files are the three config files; excluding `*.config.ts` removes nothing legitimate from the program (confirmed: `tsc` exit 0, no missing-utility errors).
