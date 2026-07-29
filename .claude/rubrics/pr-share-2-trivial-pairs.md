# Rubric — PR-SHARE-2: adopt the 5 trivial identical pairs into the shared mechanism (גל-3ג)

**Scope:** Adopts the 5 byte-identical/comment-only cross-app duplicated pairs into the PR-SHARE-1 shared-code mechanism (canonical + committed emit + drift-guard). Byte-preserving; non-admin-trusted (session/calc/constants plumbing). Per plan §5, **no devils-advocate** (no admin count/status/financial display, no rules/claims/migration). Grader only.

## MUST
- **M1 — the 5 pairs adopted, nothing else.** Canonical sources created under `shared-web/src/` for: `modules/work-hours-calculator.js`, `shared/business-rules-adapter.js`, `shared/holidays-cache.js`, `shared/work-hours-constants.js`, `core/system-constants.js`. Added to `emit.js` registry. NO other pair touched (idle-timeout already done; config-loader/logger/service-card/client-case-selector are later PRs).
- **M2 — pairs 1-4: ZERO served-byte change.** `git diff HEAD` on the 8 emitted copies (4 modules × 2 apps) is EMPTY — the git blobs are already LF and identical to canonical. Only the `?v=` tokens in HTML change (verified).
- **M3 — system-constants: comment-only, display-invisible.** The ONLY code change is the header banner (lines 2-3) normalized ("Admin Panel Adapter"/"User App Adapter" → neutral "Adapter"), so both apps emit the SAME blob. Zero executable-line change → zero behavior; the comment is never rendered (not an admin-display change).
- **M4 — LF/token invariant holds (the SHARE-1 CI crux).** For every adopted module, the `?v=sh-<8>` token in every referencing page equals the sha256-first8 of the LF git-blob (verified via `git cat-file blob`). `.gitattributes` pins `eol=lf` on the 10 new emitted-copy paths.
- **M5 — drift-guard extended + green.** `tests/unit/shared/shared-web-emit.sync.test.ts` now covers all 6 modules (byte-parity + token==hash + behavior-smoke); `node shared-web/emit.js --check` exits 0 and was proven to exit 1 on a deliberately drifted copy. The redundant admin-vs-user byte assertion in `business-rules.sync.test.ts` was folded out per plan §3.1 (the drift-guard proves admin==canonical==user transitively); its behavior-parity matrix is retained.
- **M6 — all referencing pages retokenized.** Every `<script src="js/<module>...?v=">` across both apps (22 refs / 12 pages) carries the `sh-` content-hash token; none left un-tokenized (verified).
- **M7 — exec-log maintained.** `docs/HEALTH-MAP` exec-log gains the PR-SHARE-2 row (+ flips PR-SHARE-1 to ✅ merged). Additive.

## PRODUCT-GRADE GATES
- **G1** N/A — no customer-facing output/error path (calc/constants/session plumbing, bytes unchanged).
- **G2 (rollback):** single-commit `git revert` restores the hand tokens + removes the 5 canonicals + registry rows. Trivial, no data/CF.
- **G3** N/A — no data-mutating path (bytes unchanged; system-constants is a comment).
- **G4** — the drift-guard (now 6 modules, byte-parity + token + smoke) IS the customer-scenario proof; full suite 923 pass / 2 skipped.
- **G5** N/A — no customer-facing strings changed (the system-constants edit is an English code comment).
- **G6** — no data/API/route/behavior contract change. Tokens = re-fetch of identical bytes (pairs 1-4) / a comment (system-constants). Declared, not breaking.
- **G7** N/A — no auth/PII/rules.

## Anti-premature-closure
- CI must be green on Linux — the LF invariant (M4) is the exact thing that would fail there; independently `git cat-file`-verified for the adopted modules.
- system-constants touches admin page files (index/clients/etc.) via a JS comment only — NOT an admin count/status/display change (admin CLAUDE.md): the comment is never rendered, no aggregate/filter/count moves.
- Remaining גל-3ג: PR-SHARE-3/4 (config-loader/logger — parameterized `APP_CONTEXT`) → PR-SHARE-5 investigation + PR-SHARE-6 service-card (devils-advocate + PO H2 decision) → PR-SHARE-7/8 client-case-selector (own investigation).
- One pre-existing unrelated flake surfaced (`holidays-cache-merge.test.ts` stray boot-poller `setTimeout` after teardown; passes 20/20 in isolation; byte-unchanged file, not in this diff) — noted, out of scope.
