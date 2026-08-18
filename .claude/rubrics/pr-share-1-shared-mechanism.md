# Rubric — PR-SHARE-1: shared-code mechanism introduction (גל-3ג)

**Scope:** BAR-LEVEL — introduces the cross-app SSOT mechanism (`docs/PLAN-SHARED-CODE-MECHANISM.md`) and proves it end-to-end on ONE byte-identical pair (`modules/idle-timeout-manager.js`). Two apps deploy to two disjoint Netlify roots → no shared-by-reference; mechanism = canonical source + committed emit + CI drift-guard. **devils-advocate MANDATORY (done — STOP→GO after the CRLF blocker fix).**

## MUST
- **M1 — zero user-visible change.** The served `idle-timeout-manager.js` bytes are unchanged: the git blob is byte-identical to HEAD (`git diff HEAD` on both emitted copies = empty). The ONLY runtime-affecting change is the `?v=` cache-bust token on 3 `<script>` tags → a one-time re-fetch of identical bytes.
- **M2 — the LF/token invariant holds on CI+prod (the devils-advocate blocker).** The content-hash token in all 3 HTML pages equals the sha256-first8 of the **LF** git-blob (`sh-f6669b20`). Enforced OS-deterministically: `emit.js` normalizes CRLF→LF before hashing+writing, AND `.gitattributes` pins `eol=lf` (scoped to `shared-web/**` + the 2 emitted copies, no repo-wide rule). Verified: `git cat-file blob :<path> | sha256 == token`.
- **M3 — the drift-guard is real and fails on drift.** `tests/unit/shared/shared-web-emit.sync.test.ts` asserts (1) each committed copy is byte-identical to a fresh emit, (2) each page's token == content-hash, (3) behavior smoke via `new Function('window','Logger',src)`. Proven to go RED on a deliberately drifted copy, GREEN when in sync. Rides `npm test` (no new CI job).
- **M4 — cache-bust coexistence.** `update-cache-busting.js` skips `?v=sh-` tokens (negative-lookahead `\?v=(?!sh-)`) so it never clobbers the mechanism's content-hash tokens; all non-`sh-` refs still rebust to git-hash exactly as before (a git short-hash / timestamp can never start with `sh-`). Verified on a real index.html dry-run: the `sh-` token survives, others rebust.
- **M5 — one canonical, committed emit.** Canonical at `shared-web/src/modules/idle-timeout-manager.js`; emit writes byte-identical committed copies into both app trees (matching the house `functions/lib/`-in-git model). `shared-web/README.md` documents the single workflow + the `js/<subpath>`-reference constraint. Only `idle-timeout-manager` is in the registry — no other pair touched.
- **M6 — atomic rollback.** `shared-web/` + the new test + the HTML/token/script changes are ONE commit; a whole-commit `git revert` restores the 3 hand tokens and removes the mechanism cleanly. Verified: nothing outside `shared-web/` + the new test depends on the mechanism.
- **M7 — exec-log maintained.** `docs/HEALTH-MAP` exec-log gains the PR-SHARE-1 row (opens גל-3ג's shared-mechanism track). Plan landed at `docs/PLAN-SHARED-CODE-MECHANISM.md`.

## PRODUCT-GRADE GATES
- **G1** N/A — no customer-facing output/error path (session-idle module, bytes unchanged).
- **G2 (rollback):** documented — single-commit `git revert` restores hand tokens + removes `shared-web/`; no data/CF/scheduler. Trivial.
- **G3** N/A — no data-mutating path (build/tooling + a session-UX module, bytes unchanged).
- **G4** — the drift-guard test (8/8) IS the customer-scenario proof: it exercises emit→both-copies→token and fails on drift. Full suite 899 pass / 2 skipped.
- **G5** N/A — no customer-facing strings (build tooling; Hebrew comments in scripts are dev-facing).
- **G6 (breaking change):** none to any data/API/route contract. The `?v=` token change is a cache-bust (re-fetch of identical bytes), declared. Build command NOT wired (reasoned: prod/main don't run the full build; CI drift-guard + committed-emit are the enforcement).
- **G7 (security):** N/A — no auth/PII/rules. (The §7.6 confidentiality flag belongs to PR-SHARE-6/service-card, not here.)

## Anti-premature-closure
- CI must be green on Linux — the LF invariant (M2) is exactly what would have failed there; independently verified `git cat-file` blob hash == token before merge.
- Netlify build wiring deliberately deferred (reasoned deviation from plan §5): production-stable serves committed (no build), main runs only compile-ts → wiring provides no runtime guarantee; the CI drift-guard does. Optional future hardening, flagged, not silently dropped.
- Only `idle-timeout-manager` proven. The other 9 in-scope pairs follow in PR-SHARE-2+ (trivial 5 → parameterized config-loader/logger → service-card [devils + PO H2 decision] → client-case-selector [own investigation]).
