# Rubric — PR-ESCAPEHTML-SSOT-PR1

**Title:** escapeHtml SSOT consolidation — PR1: the shared `window.escapeHtml` util + the string-replace → innerHTML family
**App:** Admin Panel · **Env:** DEV · **Frontend-only, refactor (SSOT-preserving), admin-critical**

**Scope:** PR1 of the Haim-approved 3-PR escapeHtml-dedup (checkpoint 2026-06-17). Create ONE canonical escaper `apps/admin-panel/js/core/escape-html.js` → `window.escapeHtml` (5-entity `& < > " '` → `&amp; &lt; &gt; &quot; &#039;`, `null`/`undefined`→`''`, classic IIFE + `module.exports` guard, alongside `js/core/csv-safe.js`), and ROUTE the **string-replace → innerHTML** escaper family to delegate to it: `client-case-selector.js`, `EmployeeCostsPage.js`, `ProfitabilityPage.js`, `AuditTrailPage.js`, `SystemSettingsPage.js`, `client-type-display.js`. Add the `<script>` on the 6 host pages + cache-bust. **NOT** the textContent family (PR2) or `WorkloadCard.sanitize` (PR3).

## MUST (block on FAIL)
- **M1** — SSOT created: `js/core/escape-html.js` defines the canonical 5-entity escaper (`&#039;` 3-digit, matching `ReportGenerator`/`WhatsApp` pinned by `report-generator-escaping.test.ts`), `null`/`undefined`→`''` guard, `window.escapeHtml` + `module.exports`. No new inline escape logic added anywhere.
- **M2** — the 6 escapers DELEGATE to `window.escapeHtml` (`return window.escapeHtml(...)`); the duplicated `.replace(...)` regex/map logic is REMOVED from each. "Route, never copy."
- **M3** — scope discipline / MUST-EXCLUDE: `ClientsTable.js` `data-tooltip-html` (2-entity `&`+`"`, packs already-rendered HTML) is NOT touched; the ~16 textContent copies (PR2) + `WorkloadCard.sanitize` (PR3) are NOT touched.
- **M4** — behavior changes DECLARED (G6): AuditTrailPage + SystemSettingsPage now also escape `'`→`&#039;` (4-entity → 5-entity, a security improvement); EmployeeCostsPage + ProfitabilityPage shift `&#39;`→`&#039;` (entity-equivalent, same render); the null-guard tightens from `!str` to `null`/`undefined`-only (a literal `0`/`false` stringifies instead of blanking). Benign string output otherwise unchanged.
- **M5** — tests: `escape-html.test.ts` pins the 5-entity shape + each char + the `null`/`undefined` guard + the `0`/`false` stringify; `client-type-display.test.ts` imports `escape-html.js` so `renderTypeTooltip`'s delegated escaper resolves; full admin-panel suite green.
- **M6** — cache-bust: the new `escape-html.js` `<script>` loads BEFORE consumers (after `constants.js`) on all 6 pages, and the 6 changed consumer files get a bumped `?v=` so browsers reload them.

## SHOULD
- **S1** — the routed wrappers carry a one-line comment pointing to the SSOT + (where applicable) the byte-change note.
- **S2** — `client-type-display.js` (#6, coupled to the excluded ClientsTable tooltip) escapes leaf text only — documented in the wrapper comment; its existing test stays green.

## Test plan
`tests/unit/admin-panel/escape-html.test.ts` (8 tests: load contract, 5-entity canonical shape, per-char, script payload, null/undefined guard, 0/false stringify, benign Hebrew unchanged, global/repeat). Affected suites green: `client-type-display.test.ts` (renderTypeTooltip output unchanged — byte-identical escaper), `employee-costs-pii-guard.test.ts` + `profitability-pii-guard.test.ts` (static source guards, unaffected). Full admin-panel suite **151/151** (143 prior + 8). (The 1 failing file in the full root run — `user-app/israeli-id-drift-guard.test.ts`, `Failed to resolve "zod"` — is a worktree partial-node_modules artifact unrelated to this admin-panel-only PR; passes in CI with full deps.)

## Rollback
`git revert <merge-commit>` + redeploy (frontend; Netlify). No data migration, no schema/rule change. Reverting restores the 6 local escapers + removes `escape-html.js` + the 6 `<script>` tags.

## PRODUCT-GRADE GATES
- **G1 PASS** — the SSOT guard returns `''` for null/undefined; no `undefined`/`null`/`[object Object]` reaches output.
- **G2 PASS** — `git revert` rollback (code-only).
- **G3 N/A** — no data mutation (pure display-string escaping refactor).
- **G4 PASS** — `escape-html.test.ts` proves the escaper output + the integration via `client-type-display.test.ts` (renderTypeTooltip).
- **G5 PASS** — escaper maps only `& < > " '`; Hebrew + all other text passes through unchanged.
- **G6 PASS (declared)** — behavior change: AuditTrail/SystemSettings now escape `'` (security improvement, not a break); apostrophe-entity + null-guard shifts are entity-equivalent/safer. No customer-visible regression for benign input.
- **G7 PASS** — XSS hardening (consolidates escapers, upgrades 2 to full 5-entity), security-access-expert lens; the URL/CSS-unsafe caveat is documented in the util header; ClientsTable pre-built-HTML tooltip correctly excluded.

VERDICT: PASS
