# Rubric — PR-DB-4: delete orphaned SMSManagement.js + its lone test (גל-3ב dead-code)

**Scope:** DEAD-CODE removal (admin-panel). Deletes the orphaned `apps/admin-panel/js/ui/SMSManagement.js` together with the ONLY test that imports it (`tests/unit/admin-panel/sms-csv-injection.test.ts`, import at `:29`). KEEPS the `js/core/csv-safe.js` SSOT. Closes גל-3ב. Re-verified on current origin/main by a read-only investigation. No rules/schema/migration → no devils-advocate.

## MUST
- **M1 — exactly 2 deletions:** `apps/admin-panel/js/ui/SMSManagement.js` + `tests/unit/admin-panel/sms-csv-injection.test.ts`. Diff = exactly these 2 + the exec-log doc.
- **M2 — SMSManagement is genuinely orphaned.** 0 HTML `<script src=` loaders, 0 live-JS references (verified: the only non-self hit was inside its own test). The test file's own comment declares it "currently ORPHANED".
- **M3 — KEEP `js/core/csv-safe.js` (the SSOT).** It has 8 live consumers and MUST remain (verified still tracked + 8 refs after the deletion).
- **M4 — no SSOT coverage lost.** The deleted test only proved `SMSManagement.convertToCSV` routes through CsvSafe. The `csv-safe` encoder itself stays covered by 3 OTHER live tests that do NOT import SMSManagement: `clientstable-csv-injection.test.ts`, `datamanager-csv-injection.test.ts`, `report-generator-csv-injection.test.ts` (verified: 0 SMSManagement references in each). Net CsvSafe coverage after this PR = unchanged.
- **M5 — exec-log maintained (anti-drift).** `docs/HEALTH-MAP` exec-log gains the DB-4 row (+ flips DB-3 #484 to ✅ מוזג). Additive only.

## PRODUCT-GRADE GATES
- **G1** N/A — removal only.
- **G2 (rollback):** `git revert <sha>` restores both files. Trivial, code+test only.
- **G3** N/A — no data path.
- **G4** N/A — the deleted module had zero live callers; the deleted test only exercised it. The CsvSafe SSOT retains 3 live integration tests (M4).
- **G5** N/A — no customer strings (orphaned module never ran).
- **G6** N/A — orphan module, no live consumer transition.
- **G7 (security):** PASS (minor) — the orphaned SMS export path (a former CSV-injection sink) leaves the codebase entirely; the CsvSafe hardening + its 3 live-sink tests are untouched. No auth/PII/rules changed.

## Anti-premature-closure
- CI (admin-panel vitest + build) must be green — removing an orphaned module + its lone test cannot break a live import; the 3 remaining csv-injection tests still run.
- **Closes גל-3ב** (DB-1…DB-4 all merged). NEXT wave = 3ג duplicates (presence-system drift first). The messaging/errors cluster stays on the separate H.8.0 track.
