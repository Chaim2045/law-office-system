# Rubric — PR-SHARE-3: parameterize config-loader + introduce APP_CONTEXT injection (גל-3ג)

**Scope:** Introduces the `APP_CONTEXT` emit-time injection capability into the shared-code mechanism (§2.1) and uses it to unify the drifted `core/config-loader.js` pair (admin was a strict superset of user). Behavior-parity (NOT byte-identity) via per-target injection + gating. **devils-advocate DONE = GO**; its 2 hardening recommendations were FOLDED IN (the injection is the security foundation the later PR-SHARE-6 §7.6 confidentiality flag depends on).

## MUST
- **M1 — APP_CONTEXT injection introduced correctly.** `emit.js` `injectAppContext` replaces the canonical sentinel `const APP_CONTEXT = /*__APP_CONTEXT__*/ 'user';` per target ('admin' into admin tree, 'user' into user tree); tokens computed AFTER injection (per-target). Modules WITHOUT the sentinel stay byte-identical (untouched).
- **M2 — fail-secure default (the security crux).** The canonical default literal is the NON-PRIVILEGED `'user'` — so a broken/no-op injection degrades to "admin-surface OFF", NEVER "privileged data ON the user surface". Verified: `shared-web/src/core/config-loader.js` default = `'user'`. This is the invariant PR-SHARE-6's `SHOW_FINANCIALS = APP_CONTEXT==='admin'` will ride.
- **M3 — ADMIN behavior preserved.** The admin emitted copy reproduces today's behavior exactly: `version` tracking, `get()`/`getVersion()`, the 2 load-logs + the "ready" log all run (all gated `if (APP_CONTEXT==='admin')`, always true for admin). `version` set synchronously at load before any `getVersion()` call → `SystemSettingsPage.js:489` `getVersion()` returns the same `null` at the same time (verified by devils-advocate + behavior smoke). The admin `git diff HEAD` = header comment + APP_CONTEXT const + gate wrappers only, no behavioral-line change.
- **M4 — USER behavior preserved.** With `APP_CONTEXT==='user'` all admin gates OFF: no `version` field, no load-time console output (test asserts `logs.length===0`), `load()` still returns `doc.data()`. `get`/`getVersion` present-but-dormant (verified 0 user callers — the `_version` greps are an unrelated Firestore field). No NEW observable behavior.
- **M5 — hardening guards added (folded devils-advocate 🟡×2).** The drift-guard now has: **check-5** — a GENERIC per-target injection assertion (every canonical module with the sentinel: admin copy carries `'admin'` not `'user'`, user copy carries `'user'` not `'admin'`) → auto-covers SHARE-6 with no new hand-written test; **check-6** — asserts every canonical parameterized module's DEFAULT literal is the non-privileged `'user'` with a LEAK-RISK failure message. Both proven to FAIL on injected regressions (flipped literal / flipped default) then restored.
- **M6 — per-target token invariant + no cross-stamp.** Each emitted copy's `?v=sh-<8>` == sha256-first8 of ITS LF git-blob (admin `sh-b6871918`, user `sh-d09ed9a4` — different by design); `.gitattributes` pins eol=lf on both. Retokenizer scopes by each app's disjoint publish root → admin pages get only the admin token, user only user (no cross-stamp; verified all 12 pages). `update-cache-busting.js` (skips `sh-`) leaves both alone.
- **M7 — exec-log maintained.** `docs/HEALTH-MAP` exec-log gains the PR-SHARE-3 row (+ flips PR-SHARE-2 to ✅ merged). Additive.

## PRODUCT-GRADE GATES
- **G1** N/A — config plumbing; no customer-facing output/error path.
- **G2 (rollback):** single-commit `git revert` restores the 2 hand copies + hand tokens + removes the canonical + the emit injection capability. Trivial, no data/CF.
- **G3** N/A — no data-mutating path.
- **G4** — the extended drift-guard (127 tests: byte-parity + per-target token + behavior-smoke + generic-injection check-5 + fail-secure-default check-6) IS the customer-scenario proof; proven to fail on regressions.
- **G5** N/A — no customer-facing strings changed (comments are dev-facing).
- **G6** — no data/API/route contract change. Admin behavior byte-equivalent; user gains dormant methods (no observable change). Tokens = one-time re-fetch. Declared, not breaking.
- **G7 (security):** PASS — the introduced injection is fail-secure by construction (M2) + mechanically guarded (M5); no auth/PII/rules touched. The confidentiality LEVERAGE (SHOW_FINANCIALS) is PR-SHARE-6, but its foundation is proven safe here.

## Anti-premature-closure
- CI green on Linux — per-target LF invariant (M6) `git cat-file`-verified for both apps.
- The 2 devils-advocate 🟡 items were NOT deferred — folded into this PR (M5) because the injection they harden is introduced here.
- Remaining גל-3ג: PR-SHARE-4 (logger — same APP_CONTEXT, `'user'`-gated prod-console-silence) → PR-SHARE-5 investigation + PR-SHARE-6 service-card (**devils-advocate + PO H2 decision** — the confidentiality flag rides M2's fail-secure default + M5's guards) → PR-SHARE-7/8 client-case-selector.
