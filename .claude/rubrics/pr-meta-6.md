# Rubric — PR-META-6

**Title:** Engineering Bar Elevation — TypeScript / Vitest+Jest / Cloud Secrets / Structured Logger / CI Gate
**Branch:** `feat/eng-bar-pr-meta-6`
**Base:** `main`
**Scope:** Establish a professional engineering baseline for ALL new Cloud Functions backend code in the AI Management Layer initiative. Existing JS in `functions/` is NEVER migrated. This PR is pure infrastructure / tooling — zero business logic changes, zero user-facing behavior changes.

## MUST criteria (block on FAIL)

### M1 — Zero impact on existing JS code paths
**Rule:** No JS file under `functions/*.js` is modified by this PR EXCEPT `functions/whatsapp/index.js` (Twilio deprecated-API cleanup, scoped to lines that read `functions.config().twilio`). Every existing `module.exports`, every existing callable, every existing trigger signature is preserved.
**Evidence required:** `git diff main..HEAD -- functions/*.js functions/**/*.js | grep -E "^-(?!.*config\(\))"` — only deletion lines should be the deprecated config reads in whatsapp/index.js.

### M2 — `functions/src-ts/tsconfig.json` extends EXISTING root tsconfig
**Rule:** The new tsconfig MUST extend `../../tsconfig.json` (the file that already exists at repo root). It MUST NOT recreate or replace the root config.
**Evidence required:** `functions/src-ts/tsconfig.json:5` contains `"extends": "../../tsconfig.json"`.

### M3 — `functions/test/setup.js` UNCHANGED
**Rule:** The existing setup file that mocks `global.console` for the 38 legacy Jest tests stays exactly as it was on main. Devils-advocate #4: changing it would leak production-like test output to the PUBLIC CI log.
**Evidence required:** `git diff main..HEAD -- functions/test/setup.js` returns empty.

### M4 — Twilio `functions.config()` calls REMOVED (not migrated to defineSecret)
**Rule:** `functions/whatsapp/index.js` lines 178 and 338 — the two `functions.config().twilio` reads — are replaced with `process.env.TWILIO_*` reads only. We are NOT migrating to `defineSecret` in this PR (devils-advocate #2: v1 callables cannot declare `secrets: [...]` runtime option).
**Evidence required:** `grep "functions.config()" functions/whatsapp/index.js` returns no matches.

### M5 — New ESLint block scopes to `functions/src-ts/**/*.ts` only
**Rule:** The new ESLint block does NOT cascade to existing JS in `functions/`. The `commonIgnores` at the top of `eslint.config.js` still excludes `functions/**` for the standard JS/TS blocks. New block opts in explicitly via `files: ['functions/src-ts/**/*.ts']`.
**Evidence required:** `eslint.config.js` contains a block with `files: ['functions/src-ts/**/*.ts']` and does NOT remove `'functions/**'` from `commonIgnores`.

### M6 — CI gate added INSIDE existing pull-request.yml jobs (no new workflow)
**Rule:** Per devils-advocate #3 (CI double-run risk), the new typecheck + lint steps are added as steps WITHIN the existing `typescript` and `code-quality` jobs in `.github/workflows/pull-request.yml`. No new `.yml` workflow file is created.
**Evidence required:** `ls .github/workflows/` shows the same files as on main (no new file added).

### M7 — Forbidden write APIs in `verifyClaims` body — static AST guard exists
**Rule:** `functions/src-ts/__tests__/verify-claims.test.ts` contains a `describe('(a) Static AST grep')` block with `it.each(FORBIDDEN_WRITE_PATTERNS)` covering at minimum: `.set(`, `.update(`, `.delete(`, `setCustomUserClaims`, `.add(`, `batch(`, `writeBatch`, `bulkWriter`, `runTransaction`, `createUser`, `updateUser`, `deleteUser`, `revokeRefreshTokens`.
**Evidence required:** Read the file and confirm the patterns array.

### M8 — Hebrew user-facing strings on whatsapp/index.js modifications
**Rule:** The new error messages in `whatsapp/index.js` (replacing the old `functions.config()` error messages) are Hebrew, actionable, and don't leak environment variable names beyond what's necessary for the admin to fix the issue.
**Evidence required:** Read the diff and confirm both replaced `HttpsError` messages are Hebrew.

### M9 — All new files have header comments documenting purpose + PR-META-6 reference
**Rule:** Each new file (`tsconfig.json`, `jest.config.js`, `setup-ts.js`, `logger.js`, `verify-claims.test.ts`, `ENGINEERING_BAR.md`) has a header that explains why it exists and references PR-META-6.
**Evidence required:** First 10 lines of each new file.

### M10 — Existing scripts (`npm test`, `npm run type-check`, etc.) still pass
**Rule:** The existing root `npm test` (Vitest) and `npm run type-check` (root tsc) and the existing `cd functions && npm test` (now via projects setup) all still pass without modification needed.
**Evidence required:** Manual verification in Test Plan + PR body declares pass.

## SHOULD criteria (warning on FAIL, doesn't block)

### S1 — Coverage threshold documented but not enforced yet
**Rule:** `docs/ENGINEERING_BAR.md` declares 60% line coverage target for new code, with growth path to 80%. No actual `coverageThreshold` is set in jest.config.js (yet — would block a PR with a single uncovered file).

### S2 — README in `functions/src-ts/` explains the directory's purpose
**Rule:** `functions/src-ts/README.md` exists and explains structure, compilation, deployment.

### S3 — Logger shim documents PII redaction policy
**Rule:** `functions/shared/logger.js` header documents what NOT to log (Twilio creds, auth tokens, full payloads) — given the public repo constraint.

### S4 — Per-test description of what each assertion catches
**Rule:** The verify-claims test documents which kinds of write-creep it catches (literal source matches) and which it misses (indirect wrappers).

## Out of scope

What this PR explicitly does NOT do (grader: do NOT downgrade for absence):

- TypeScript for frontend (`apps/admin-panel/`, `apps/user-app/`) — that's PR-META-7
- Migration of existing JS files to TS
- Migration of v1 callables to v2
- Migration to `defineSecret` (requires v2 callables first — separate future PR)
- Adding monitoring platform (Datadog, OpenTelemetry, Sentry)
- Setting up Anthropic SDK (lands with H.8 AI Chat)
- Flipping the new CI gate to `required-status-check` in branch protection — that's a manual GitHub Settings change by Haim, after 7-14 days of green runs
- Cleanup of stale apiKey in `apps/admin-panel/docs/PHASE1_REPORT.md:249` — chore follow-up PR
- Renaming `functions/src/` to avoid confusion with new `functions/src-ts/` — out of scope, existing patterns preserved

## Rollback

If this PR lands in DEV and breaks existing CI / tests / deploy:

1. `git revert <merge-commit>` on `main`
2. Push → existing `pull-request.yml` reverts to pre-META-6 state
3. No data rollback needed — this PR performs zero writes
4. `functions/lib/` may contain stale TS-compiled output — `rm -rf functions/lib/` if a future deploy is sensitive

If only the new TS code paths misbehave (existing JS works fine):
1. Comment out the `functions/src-ts/` typecheck step in `pull-request.yml` (single line)
2. PR can still merge with the legacy gate

## Test plan (G4 manual smoke + new automated tests)

### Local verification (before commit)
1. `cd functions && npm install` — succeeds without errors
2. `npm run typecheck:ts` — passes (no .ts files yet → tsc compiles 0 files → exit 0)
3. `npm test` — runs BOTH `legacy-js` and `src-ts` projects:
   - `legacy-js`: existing 38 tests pass (unchanged)
   - `src-ts`: 1 test file (verify-claims.test.ts) → AST grep block passes (verifyClaims source contains zero forbidden patterns); runtime harness block passes (documentation-only)
4. `npx eslint 'functions/src-ts/**/*.ts'` — 0 errors, 0 warnings (sample test only)
5. `cd .. && npm test` — root Vitest still passes (unaffected)
6. `npm run type-check` — root tsc passes (includes functions/**/*.ts which now includes src-ts/)

### CI verification (after push)
1. `pull-request.yml` runs all jobs
2. New `code-quality` step "🟦 Lint functions/src-ts" runs (passes — only sample test file)
3. New `typescript` step "📘 Typecheck functions/src-ts" runs (passes — sample test compiles)
4. `test` job runs `cd functions && npm test` which now has 2 projects — both pass
5. No new workflow file created

### Smoke after merge to DEV
1. Netlify auto-deploys main — unaffected by META-6 (no frontend changes)
2. Firebase functions deploy — unaffected (no exported function added; `functions/lib/` directory exists but empty)
3. WhatsApp broadcast (Haim sends a test message) — works (Twilio env vars set in Cloud Functions runtime config)

## Notes for grader

- The Twilio change in `whatsapp/index.js` is the highest-risk item. Verify the runtime config has `TWILIO_ACCOUNT_SID` etc. set in Firebase Console BEFORE merging to `production-stable`. The DEV deploy from main is safe because the runtime config is set per-environment.
- The CI gate is INFORMATIONAL on landing. The required-status-check flip is a manual GitHub Settings step by Haim, after 7-14 days of green runs. If the gate misfires immediately, no merges are blocked.
- The repo is PUBLIC — every assertion in this PR's CI logs is world-readable. The sample test deliberately does NOT log any data; the AST grep block fails LOUDLY with file names but no source content.
- This PR carries SOURCE for a future regression test pattern. Pre-H.0.0.B-G PRs will follow the pattern documented in the verify-claims test (dual: AST + runtime mock).
