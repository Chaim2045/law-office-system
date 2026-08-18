# Rubric — H.1.a: re-enable `tofesMecherConnectivityCheck` + validate the live cross-project wiring

**Title:** Re-enable the H.0 connectivity-check Cloud Function (un-exported in #355 during the 2026-06-04 deploy-unblock incident) now that the `TOFES_MECHER_SA_KEY` secret exists, so a live admin call can prove the deployed cross-project wiring (Secret Manager → SA key → named app → one tofes-mecher Firestore read). De-stale the now-resolved `TOFES_SALES_COLLECTION` UNVERIFIED caveat. First slice of H.1 (3-PR split).
**Branch:** `feat/h-1-a-connectivity-reenable`
**Base:** `main`
**App / Env:** Functions (backend). DEV (`main`). **Read-only** — one `.limit(1).get()` against the tofes-mecher project; NO writes to either project, no trigger, no schedule.
**Effort:** LIGHT (Lead-Agent effort-scale of H.1-overall = HEAVY; this de-risking first slice is LIGHT). Investigation: backend (GO) + security (PASS) + ops (SAFE) + completeness (0🔴/3🟡) + devils-advocate (PROCEED WITH CAUTION, 2🔴 both mitigated).

**Context:** H.0 shipped the connectivity-check code + 24 tests but it was never successfully deployed — its top-level `defineSecret('TOFES_MECHER_SA_KEY')` aborted EVERY PROD functions deploy while the secret was unset, so #355 un-exported it to unblock. H.0 Console setup (2026-06-08) set the secret (`versions/1`), created the SA `cross-project-reader` (`roles/datastore.viewer`) + the empty BigQuery dataset. The landmine is now disarmed. H.1.a re-enables + validates the wiring before H.1.b (`validateSalesRecordExists`) and H.1.c (BigQuery export) build real logic on it. Haim checkpoint approved: 3-PR split, H.1.a first, re-enable + config de-stale.

## MUST criteria (block on FAIL)

### M1 — Re-enable is exactly the two existing lines, nothing else
**Rule:** `functions/index.js` uncomments ONLY the two lines that `require('./lib/tofes-mecher/connectivity-check')` and `exports.tofesMecherConnectivityCheck`. No other export added/removed/reordered. The function code itself (`connectivity-check.ts`/`app.ts`) is UNCHANGED from H.0 (already reviewed + 24-tested).
**Evidence:** `git diff functions/index.js` shows the two uncommented lines + the rewritten doc-comment block, nothing else; `git diff` touches no `.ts` under `tofes-mecher/`.

### M2 — Config de-stale is comment-only; const value intact
**Rule:** `functions/src-ts/config/index.ts` removes the `⚠️ UNVERIFIED` block and replaces it with the `✅ VERIFIED 2026-06-01` note. `export const TOFES_SALES_COLLECTION = 'sales_records'` is BYTE-unchanged. No other const touched. No behavior change.
**Evidence:** `git diff` on `config/index.ts` is comment-only; `grep "TOFES_SALES_COLLECTION = " ` shows `'sales_records'` unchanged.

### M3 — `lib/` recompiled + committed in sync with source
**Rule:** `removeComments:false`, so the config comment edit changes the compiled `lib/config/index.js` (+ `.map`). Those are rebuilt and committed; a fresh `npm run build:ts` produces ZERO further content diff. No OTHER `lib/` file has a content change (CRLF-only touches restored). `lib/tofes-mecher/connectivity-check.js` (the re-enabled module) is byte-identical to a fresh compile.
**Evidence:** `git diff --numstat functions/lib/` shows ONLY `config/index.js` (+`.map`); a post-build `git diff` is clean.

### M4 — No behavior change beyond re-export; strictly read-only
**Rule:** H.1.a adds NO write path, NO Firestore trigger, NO schedule, NO aggregate impact. The only data operation reachable is the pre-existing `.collection(TOFES_SALES_COLLECTION).limit(1).get()` against the tofes-mecher named app. The MAIN project's `firestore.rules` are untouched (the cross-project read bypasses rules by design).
**Evidence:** `connectivity-check.ts` read path unchanged; no diff under `firestore.rules`; ops/backend findings (no trigger/schedule references the function).

### M5 — Full suite green; stale test name corrected
**Rule:** Full `functions` Jest suite green (both projects). Re-enabling breaks NO test (no test imports root `functions/index.js`; verified). The config test that named the collection `UNVERIFIED` is updated to pin the VERIFIED exact value `'sales_records'` (consistent with the de-staled source).
**Evidence:** `npx jest` 810/810; `config.test.ts` asserts `toBe('sales_records')` under a verified test name.

### M6 — PII / secret discipline preserved (G7)
**Rule:** The re-enabled function is unchanged from H.0: admin-gated (`claims.role === 'admin'`, rejects unauth + non-admin + legacy `admin:true`-only), returns ONLY `{ok, reachable, sawAtLeastOneDoc}` (a boolean — no PII/sales data), logs `uid` + non-PII scalars only, sanitizes credential errors (no key fragment). The secret is referenced by NAME only; `functions/secrets/` is gitignored dir-scoped; no SA key file is committed.
**Evidence:** security findings (PASS); the existing static AST guard + runtime serialization scan in `connectivity-check.test.ts`; `git check-ignore functions/secrets/...`.

### M7 — Deploy safety + post-merge verification defined (the 6-day-incident lesson)
**Rule:** Re-introducing `defineSecret` is safe ONLY because the secret exists (`versions/1`, CLI-confirmed). PR body MUST state: after merge, verify the CI **jobs** (not the overall "cancelled" run) `🚀 Deploy to Production` + `🧪 Automated Tests` + `🏥 Health Check` = success; then Haim runs the live Admin-console call and confirms `{ok:true, reachable:true}` — and **that live `reachable:true` is the HARD merge-gate for H.1.b**, not deploy-green (closes devils-advocate 🔴-2: a green deploy does not prove the runtime SA can read the secret).
**Evidence:** PR body "PRODUCT-GRADE GATES" + "Verification" + "Rollback" sections present.

## SHOULD criteria (warn on FAIL)

### S1 — Stale-comment hygiene
**Rule:** The `🔴 TEMPORARILY DISABLED` block in `index.js` is rewritten to the `✅ RE-ENABLED in H.1.a` state; the `REPURPOSE-OR-DELETE` note is sharpened to point at H.1.b (where `validateSalesRecordExists` supersedes this diagnostic and the export is deleted).
**Evidence:** `git diff functions/index.js` comment block.

### S2 — Rollback documented
**Rule:** PR body documents the <5-min rollback: `git revert <merge-sha> && push` re-comments the two lines (back to `da18b32` behavior). Zero data impact (read-only).
**Evidence:** PR body "Rollback" section.

## PRODUCT-GRADE GATES (G1–G7)

- **G1 (errors):** N/A-PASS — no new error path; the re-enabled function already returns Hebrew, user-friendly errors (G1/G5 verified in H.0).
- **G2 (rollback):** PASS — `git revert` + redeploy; read-only, no data migration. Documented (S2).
- **G3 (monitoring):** N/A — read-only function, no data mutation. Success/failure already `logger.*`-logged (uid + scalar).
- **G4 (customer test):** PASS — full suite 810/810; the "customer scenario" is the admin live-call verification (`reachable:true`) documented as the H.1.b gate (M7).
- **G5 (Hebrew UI):** PASS — all customer-facing errors Hebrew (unchanged from H.0).
- **G6 (breaking change):** PASS — none. Adds back an export that was temporarily removed; no schema/API/route change. (Declared in PR body.)
- **G7 (security):** PASS — security-access-expert reviewed (verdict PASS): no PII returned, role-only admin gate, secret by-name-only, rules untouched, key custody gitignored. Forward must-haves for H.1.b/c recorded.

## VERDICT
`outcomes-grader` must return **PASS** / **PASS_WITH_WARNINGS** (all MUST satisfied + all gates PASS/N/A) before `gh pr create`.
