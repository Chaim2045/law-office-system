# Rubric — PR-SHARE-4: parameterize logger (גל-3ג)

**Scope:** Unifies the drifted `modules/logger.js` pair into the shared mechanism via the APP_CONTEXT injection introduced in PR-SHARE-3. USER was the superset (a trailing PROD-Console-Override block admin lacks). Behavior-parity (not byte-identity). **devils-advocate SKIPPED (noted):** logging plumbing, non-admin-trusted; reuses the SAME APP_CONTEXT mechanism already devils-advocate=GO in SHARE-3; fail-secure default mechanically enforced (check-6); the crux (no admin console-silencing regression) independently verified. Per plan §5 = recommended-not-mandatory. Grader is the gate.

## MUST
- **M1 — one canonical, logger registered.** `shared-web/src/modules/logger.js` created (base + sentinel + gated block); added to `emit.js` MODULES. No other pair touched.
- **M2 — ADMIN behavior preserved (the crux — no regression).** The PROD-Console-Override block is gated `if (APP_CONTEXT === 'user' && loggerInstance.isProduction)`. Admin copy is injected `'admin'` → the guard is permanently false → **admin NEVER silences console.log/info/debug in production** (exactly today's admin behavior; admin never had the block). Verified from the admin `git diff HEAD` + check-7 behavior smoke (admin: console.log native, `window.enableDebug` undefined).
- **M3 — USER behavior preserved.** User copy injected `'user'` → the block runs exactly as today: silences console.log/info/debug in prod + installs `window.enableDebug()`/`disableDebug()`; console.warn/error stay. Block body byte-unchanged; only the guard tightened (`isProduction` → `APP_CONTEXT==='user' && isProduction`). Verified by check-7 (user prod: console.log replaced + doors installed; user non-prod: dormant).
- **M4 — fail-secure default.** Canonical sentinel default = `'user'` (non-privileged; check-6 enforces). A no-op injection keeps `'user'` → for logger that means "prod-silencing ON" (harmless), never a privileged leak. (Logger has no confidentiality surface; the fail-secure invariant is upheld uniformly for the mechanism.)
- **M5 — per-target token invariant.** Each emitted copy's `?v=sh-<8>` == sha256-first8 of ITS LF git-blob: admin `sh-4b704219`, user `sh-36bf79e8` (different by design). `.gitattributes` pins eol=lf on both. All 4 referencing pages retokenized (admin ×3: index/clients/workload; user ×1: index) — no cross-stamp.
- **M6 — drift-guard green + logger behavior asserted.** `node shared-web/emit.js --check` exits 0 (proven to fail on drift then restore); the generic check-5 auto-covers logger's per-target injection; a new check-7 asserts the admin-no-override / user-has-override behavior. 141 tests pass.
- **M7 — exec-log maintained.** `docs/HEALTH-MAP` exec-log gains the PR-SHARE-4 row (+ flips PR-SHARE-3 #489 to ✅ merged). Additive.

## PRODUCT-GRADE GATES
- **G1** N/A — logging plumbing; no customer-facing output/error path.
- **G2 (rollback):** single-commit `git revert` restores the 2 hand copies + hand tokens + removes the canonical. Trivial, no data/CF.
- **G3** N/A — no data-mutating path.
- **G4** — the drift-guard (141 tests: per-target byte-parity + token + check-5 injection + check-6 fail-secure + check-7 logger-behavior) IS the customer-scenario proof; proven to fail on drift.
- **G5** N/A — no customer-facing strings.
- **G6** — no data/API/route/behavior contract change. Admin behavior byte-equivalent (block gated off); user behavior byte-equivalent (block runs). Tokens = one-time re-fetch. Declared, not breaking.
- **G7** N/A — no auth/PII/rules. (Logger's prod-console-silencing is a hardening the user app already had; unchanged.)

## Anti-premature-closure
- CI green on Linux — per-target LF invariant (M5) `git cat-file`-verified for both apps.
- The crux regression risk (admin newly silencing console.log in prod) was the one real danger — independently verified NOT present (admin guard is permanently false under `'admin'`).
- devils-advocate skip is logged (M-scope note) — safe because the mechanism it rides was already adversarially validated in SHARE-3 and logger adds no new admin-trusted/confidentiality surface.
- Remaining גל-3ג: PR-SHARE-5 investigation + PR-SHARE-6 service-card (**devils-advocate + PO H2 decision** — the confidentiality flag rides SHARE-3's fail-secure default) → PR-SHARE-7/8 client-case-selector (own investigation).
