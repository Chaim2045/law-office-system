# Rubric — Pre-H.0.0.D

**Title:** `isPartner()` rules helper + rules-test infrastructure
**Branch:** `feat/pre-h-0-0-d-is-partner-rule`
**Base:** `main`
**Scope:** Add `function isPartner()` to `firestore.rules` (read-side only — no writer yet, F is the future writer). Establish from-zero `@firebase/rules-unit-testing` infrastructure: `firestore.rules.test` (Strategy B), Vitest test setup with HARD GUARDS, 11 scenarios (7 string + 4 type-confusion), string-equality drift-guard between production + test rules files, CI emulator integration with JDK 17 + JOB 5 timeout bump. Also carries Pre-H.0.0.C status flip in MASTER_PLAN §7.1.

## MUST criteria (block on FAIL)

### M1 — `isPartner()` helper present in `firestore.rules` with canonical-shape comment
**Rule:** New `function isPartner()` returns `request.auth != null && request.auth.token.role == 'partner'`. Preceded by a comment block documenting: canonical lowercase ASCII literal only, F is the only authorized writer, cross-reference to wildcard at `firestore.rules:239`.
**Evidence required:** grep `function isPartner()` in `firestore.rules`. Comment block matches description.

### M2 — `firestore.rules` header docblock updated
**Rule:** Header docblock (lines 1-59) updated to mention 2026-05-29 change + canonical role list `'admin' | 'partner' | 'employee'`.
**Evidence required:** grep header for `2026-05-29` and `partner`.

### M3 — `firestore.rules.test` exists with mirrored helpers (Strategy B)
**Rule:** Separate test-only ruleset at repo root. Contains `isAuthenticated`, `isAdmin`, `isPartner` with bodies STRING-EQUAL to production. Contains test-only match paths (`/_test_partner_only`, `/_test_admin_only`, `/_test_authenticated_only`) guarded by the helpers + default-deny.
**Evidence required:** file exists. Drift-guard test passes.

### M4 — Drift-guard test catches helper divergence
**Rule:** `tests/unit/rules/rules-drift-guard.test.ts` extracts the bodies of `isAuthenticated`, `isAdmin`, `isPartner` from BOTH files and asserts string-equality. Runs without emulator (lives in `tests/unit/` so `npm test` runs it).
**Evidence required:** test file exists. `npm test` shows the 3 drift-guard assertions passing.

### M5 — 11 isPartner scenarios cover string + type-confusion
**Rule:** `tests/rules/isPartner.test.ts` covers exactly 11 scenarios: (1) unauth, (2) no-role, (3) admin cross-role, (4) canonical partner, (5) employee, (6) empty, (7) whitespace, (8) null, (9) array, (10) object, (11) numeric. All deny except scenario 4.
**Evidence required:** test file contains all 11 `it()` blocks with the stated expectations.

### M6 — HARD GUARD against accidental PROD connection (devils-advocate Attack #2)
**Rule:** `tests/rules/setup.ts` throws if `FIRESTORE_EMULATOR_HOST` is not set. Hardcodes `projectId: 'demo-rules-test'` (Firebase emulator-reserved `demo-*` prefix).
**Evidence required:** grep `setup.ts` for `FIRESTORE_EMULATOR_HOST` + `demo-rules-test`.

### M7 — `firebase.json` emulators block + zero deploy impact
**Rule:** New `emulators` block at root level with `firestore:8080`, `auth:9099`, `ui:disabled`, `singleProjectMode: true`. No existing `firestore`/`functions`/`hosting`/`storage` keys modified.
**Evidence required:** diff shows ONLY addition of `emulators` block.

### M8 — Root `package.json` dependencies + scripts added
**Rule:** Added: `@firebase/rules-unit-testing@3.0.4` (pinned), `firebase-tools@14.20.0` (pinned exact, NOT caret). Scripts: `test:rules` runs Vitest against `tests/rules/`, `test:rules:emulator` wraps in `firebase emulators:exec`.
**Evidence required:** diff shows both deps + both scripts + exact version pins.

### M9 — `.npmrc` with legacy-peer-deps documented
**Rule:** `.npmrc` created with `legacy-peer-deps=true` and comment explaining: rules-unit-testing@3.0.4 peers `firebase@^10`, repo has firebase@9.23.0, removable when Dependabot PR #251 lands. No other npm config changes.
**Evidence required:** file exists with the documented rationale.

### M10 — CI workflow: JDK setup + emulator step + timeout bump
**Rule:** `.github/workflows/pull-request.yml` JOB 5 (test) gets: (a) `actions/setup-java@v4` with `java-version: '17'` BEFORE the test steps (devils-advocate Attack #4), (b) new step running `npm run test:rules:emulator` AFTER `npm ci` but BEFORE `npm test`, (c) timeout bumped 15→25min (Attack #3).
**Evidence required:** diff shows all three.

### M11 — `vitest.config.ts` excludes `tests/rules/**` from default `npm test` (HARD GUARD compat)
**Rule:** Include glob does NOT contain `tests/rules/**`. Comment explains: rules tests require emulator via HARD GUARD; only `npm run test:rules:emulator` runs them.
**Evidence required:** vitest.config.ts diff shows the comment + unchanged include.

### M12 — All existing tests still pass (regression)
**Rule:** `npm test` (root Vitest) — all pre-existing tests pass + new drift-guard passes. Functions Jest: `npm run test:ts` (72) + `npm run test:legacy` (600) unchanged. Total: 1042 tests across all suites + 11 future rules tests (CI only).
**Evidence required:** local test run output.

### M13 — Documentation updated
**Rule:** `docs/PARTNER_CLAIM_DIAGNOSTIC.md` appended with Pre-H.0.0.D section (canonical literal + "F is the writer" + 11-scenario list + test infrastructure summary).
**Evidence required:** diff shows the appended section.

### M14 — MASTER_PLAN status flips
**Rule:** §7.1 row C: 🟡 → ✅ merged + PR #342 link (carry from Pre-H.0.0.C merge). §7.1 row D: ⏸️ → 🟡 in progress. §7.3 scope description expanded to match implemented reality (Strategy B, HARD GUARD, JDK, etc.).
**Evidence required:** diff shows all three updates.

### M15 — Devils-advocate findings addressed
**Rule:** All 5 attacks demonstrably addressed in code OR explicitly deferred with rationale:
- Attack #1 (drift-guard catches divergence, not shared bug): drift-guard implemented; production-path sentinel deferred to first PR with real `isPartner()` consumer (documented in MASTER_PLAN §7.3 + this rubric).
- Attack #2 (fixture leak to PROD): HARD GUARD in setup.ts.
- Attack #3 (CI timeout): JOB 5 25min.
- Attack #4 (Java requirement): setup-java@v4 JDK 17.
- Attack #5 (type confusion): 4 type-confusion scenarios added (total 11).
**Evidence required:** rubric section per attack mapping.

### M16 — Hebrew customer-visible errors (G1, G5)
**Rule:** No customer-facing strings in this PR (rules + tests + infra are admin/dev surface only). N/A justified.
**Evidence required:** rubric N/A justification.

## SHOULD criteria (warning on FAIL)

### S1 — Production-path sentinel test deferral documented in rubric
**Rule:** This rubric explicitly states that Attack #1's production-path sentinel test is deferred to the first PR wiring `isPartner()` into a real production rule. Rationale: no production consumer exists yet; the helper itself + drift-guard are the maximum coverage achievable without polluting production rules.
**Evidence required:** §"Out of scope" section.

### S2 — CI runtime cost estimate
**Rule:** PR body or rubric estimates JOB 5 runtime increase due to emulator boot (~15-30s cold start). Acceptable within 25min budget.
**Evidence required:** PR body mention.

### S3 — Local-developer instructions
**Rule:** PR body documents how a contributor with Java installed can run rules tests locally (`npm run test:rules:emulator` from repo root) and what to do if Java is not installed (rely on CI; drift-guard + isPartner.test.ts can both run on CI).
**Evidence required:** PR body section.

## PRODUCT-GRADE GATES

- **G1 — Customer-visible errors**: **N/A** — rules + tests + infra; no customer-facing strings.
- **G2 — Rollback**: **PASS** — purely additive. `git revert <merge-commit>` removes `isPartner()`, `firestore.rules.test`, all test files, CI step, deps, `.npmrc`, doc additions. No existing rule depends on `isPartner()` yet; no users hold partner claims.
- **G3 — Monitoring**: **N/A** — no data writes, no Firestore mutations.
- **G4 — Customer-scenario test**: **PASS** — 11 scenarios + drift-guard test exhaustively cover the helper's evaluation semantics. Production-path sentinel deferred to first real consumer per Attack #1 defense.
- **G5 — Hebrew UI**: **N/A** — no UI strings.
- **G6 — Breaking change**: **PASS** — purely additive helper. No existing rule changed.
- **G7 — Security**: **PASS** — `security-access-expert` (Opus) consulted in investigation phase. 6 requirements adopted: rubric "no partner-gated rule activated" note, canonical lowercase comment, synthetic test fixtures (`test-{role}-uid-NNN`), this rubric+PR body reference, no `{partner:true}` legacy (grep confirmed no admin-panel consumer), PARTNER_CLAIM_DIAGNOSTIC.md update. `devils-advocate` (Opus) MANDATORY review per §3.8.4 — 5 attacks all addressed.

## Out of scope

- **Production-path sentinel test** (devils-advocate Attack #1 partial defense): the helper itself is covered by 11 scenarios in the test ruleset. A real test against `firestore.rules` (not `.test`) requires wiring `isPartner()` into a production rule, which would land in the first H.4/H.3 PR. Deferring keeps production rules free of test scaffolding (Strategy B principle).
- Modifying `firestore.rules:239` (the wildcard `request.auth.token.role in resource.data.toRoles`) to use `isPartner()` — not needed; the wildcard is generic by design. Once partner claims exist (post-F), the wildcard already accepts them.
- Migrating any existing rule from inline role check to `isPartner()` — separate refactor PR; out of D's scope.
- Adding `actions/cache@v4` for firebase-tools install — completeness-checker raised the cost concern; current ubuntu-latest `actions/setup-node@v4 with cache: 'npm'` covers npm registry tarballs. If real CI runtime becomes a problem, follow-up PR.
- ESLint coverage for `tests/rules/**` — current eslint.config.js applies to `tests/**` already via the default TS block; if Vitest typecheck (not eslint) raises issues, follow-up PR.

## Rollback

```bash
git revert <merge-commit>
git push origin main
```

The rollback removes: `isPartner()` from firestore.rules, `firestore.rules.test`, `tests/rules/`, `tests/unit/rules/`, the CI emulator step, the `emulators` block, `package.json` devDeps + scripts, `.npmrc`, doc additions. No data, no users, no production rule depends on `isPartner()` yet.

## Test plan

**Automated:**
1. `npm test` → all pre-existing Vitest tests + new drift-guard pass (drift-guard runs without emulator).
2. `npm run test:ts` (functions) → 72 tests pass (no regression on Pre-H.0.0.C).
3. `npm run test:legacy` (functions) → 600 tests pass.
4. CI JOB 5 → JDK 17 installed, `firebase emulators:exec` runs `npm run test:rules` against emulator, all 11 isPartner scenarios pass.

**Manual:** Local devs with Java installed can verify via `npm run test:rules:emulator` (requires `npm install` to fetch firebase-tools + `@firebase/rules-unit-testing`). Without Java, the CI run is the verification surface.

## Notes for grader

- D is purely **read-side**. No partner claim is written anywhere in this PR. The 11 tests verify the helper's evaluation semantics against synthetic fixtures; they do NOT verify any production wiring (none exists yet).
- The "production-path sentinel test" deferral (Attack #1) is a deliberate trade-off, NOT a quality compromise per §2.0.2. Production rules stay free of test scaffolding (per backend agent's Strategy B recommendation); the helper's evaluation is fully covered by the .rules.test variant. Production-path coverage lands with the first real consumer.
- The `--legacy-peer-deps` flag is required and documented in `.npmrc`. It will be removable once Dependabot PR #251 (firebase 9→12 upgrade) lands. Tracked.
