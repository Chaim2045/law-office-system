# Rubric — PR-META-7

**Title:** Design Bar Elevation — Documentation + `prefers-reduced-motion` Safety Net + PR Template a11y items
**Branch:** `feat/design-bar-pr-meta-7`
**Base:** `main`
**Scope:** Frontend counterpart to PR-META-6. Pure documentation + one 3-line CSS safety net + targeted amendment to existing PR template. ZERO behavioral changes. Existing UI surface (11 admin pages, 50+ CSS files) is grandfathered.

## MUST criteria (block on FAIL)

### M1 — Zero impact on existing UI behavior
**Rule:** No `.html` file is modified. No existing CSS rule is changed. The only CSS modification is an ADDITIVE `@media (prefers-reduced-motion: reduce)` block at the end of `apps/admin-panel/css/design-system.css` after the `:root` closes. No JS file is modified.
**Evidence required:** `git diff main..HEAD --stat` shows only: new docs in `docs/`, new rubric, `apps/admin-panel/css/design-system.css` modified (additive only), `apps/admin-panel/CLAUDE.md` modified (additive section), `.github/PULL_REQUEST_TEMPLATE.md` modified.

### M2 — `prefers-reduced-motion` safety net is correct CSS
**Rule:** The new block appears AFTER the `:root { ... }` closes (not nested inside). The block sets `--transition-fast: 0ms`, `--transition-smooth: 0ms`, `--transition-slow: 0ms` inside `@media (prefers-reduced-motion: reduce) { :root { ... } }`. The block is preceded by a comment explaining its purpose.
**Evidence required:** Read the diff section of `design-system.css` and confirm the structure.

### M3 — Fluent CSS is NOT marked deprecated
**Rule:** Per devils-advocate #1, `apps/admin-panel/css/fluent-design.css` is FROZEN, not deprecated. NO banner is added to `fluent-design.css`. NO banner is added to `clients-fluent.html`. The DESIGN_SYSTEM.md and DESIGN_BAR.md documents describe Fluent as "FROZEN" (not "deprecated") and explicitly say "removal is a deliberate separate PR".
**Evidence required:** `git diff main..HEAD -- apps/admin-panel/css/fluent-design.css apps/admin-panel/clients-fluent.html` returns empty. Grep the new docs for `FROZEN` and `deprecated` — Fluent is mentioned only with `FROZEN`.

### M4 — `docs/DESIGN_BAR.md` explicitly grandfathers the existing 11 admin pages
**Rule:** The Scope section lists by name the 11 existing HTML pages as OUT of scope. The Known a11y debt section documents the existing surface's gaps (0 skip-link, 0 aria-live, 1 aria-label etc.) so contributors don't try to use the existing pages as a template.
**Evidence required:** Read `docs/DESIGN_BAR.md` and confirm both sections.

### M5 — `docs/DESIGN_BAR.md` mirrors `docs/ENGINEERING_BAR.md` structure
**Rule:** Sections mirror ENGINEERING_BAR.md (just merged in META-6): "Why this exists" → "Scope (IN / OUT / grandfathered)" → "The bar (mandatory)" → "What's NOT required (yet)" → "How META-7 itself enforces this" → "When the bar gets RAISED". Terminology consistent ("the bar", "mandatory for new code", "existing code stays as-is").
**Evidence required:** Section headers in both documents.

### M6 — `docs/DESIGN_SYSTEM.md` covers all token categories
**Rule:** The document maps every token category from `apps/admin-panel/css/design-system.css`: grayscale (50-900), accents (4 hues × 3 shades), spacing (4px grid), typography (sizes/weights/tracking), radii, transitions (with the reduced-motion safety net cited), shadows, z-index (14 named layers), utility classes, base components.
**Evidence required:** Read the doc and cross-reference against `design-system.css`.

### M7 — PR template a11y section is split into "grader-verifiable" + "aspirational"
**Rule:** Per devils-advocate #5 defense, the new accessibility section has TWO subsections: items the grader can verify with `grep` (focus-visible, alt attribute, label for) and items that are aspirational (keyboard nav, screen reader, contrast etc.). The aspirational items reference `docs/DESIGN_BAR.md` "Aspirational guidance" section.
**Evidence required:** Read the PR template diff.

### M8 — PR template stale references fixed
**Rule:** `@tech-lead` and `@senior-engineer` placeholders replaced with `@Chaim2045`. `develop` branch reference removed (this repo uses `main`/`production-stable`). "Approved by tech lead" + "Code reviewed by at least 2 engineers" replaced with `outcomes-grader` verdict requirement.
**Evidence required:** Grep the template for `@tech-lead`, `@senior-engineer`, `develop`, `tech lead` — all should be absent.

### M9 — `apps/admin-panel/CLAUDE.md` has new "Design path for new UI" section
**Rule:** Section appended at the end (after STYLE), mirrors the "TYPESCRIPT PATH FOR NEW BACKEND CODE" section in `functions/CLAUDE.md` (added in META-6). References `docs/DESIGN_BAR.md` and `docs/DESIGN_SYSTEM.md`. Documents the Fluent FROZEN status.
**Evidence required:** Read the diff section.

### M10 — Hebrew + accessible developer-facing strings
**Rule:** No customer-facing strings introduced (PR is docs + meta only). Code comments in `design-system.css` are English (developer-only, per G5 explicit allowlist). Document text is English (developer documentation is acceptable English).
**Evidence required:** Grader confirms no new customer-facing strings exist.

## SHOULD criteria (warning on FAIL, doesn't block)

### S1 — Aspirational guidance section is short
**Rule:** The aspirational items list in DESIGN_BAR.md is ≤ 10 items. Long checklists train contributors to skim.

### S2 — Known debt is documented honestly
**Rule:** DESIGN_BAR.md "Known a11y debt" + DESIGN_SYSTEM.md "Known parallel systems" sections are honest about gaps and don't oversell the design system maturity.

### S3 — Cross-references are accurate
**Rule:** Every internal link (`docs/DESIGN_BAR.md`, `docs/DESIGN_SYSTEM.md`, `docs/ENGINEERING_BAR.md`, `apps/admin-panel/CLAUDE.md`, `apps/admin-panel/css/design-system.css`, `apps/admin-panel/js/ui/Modals.js`) points to a real file.

### S4 — META-6 terminology consistency
**Rule:** "the bar", "Engineering Bar", "Design Bar", "FROZEN", "Grandfathered", "mandatory for new code" — same usage as in META-6 documents.

## Out of scope

What this PR explicitly does NOT do (grader: do NOT downgrade for absence):

- New `ai-tokens.css` with semantic tokens for AI features — defer to first consumer PR (devils-advocate #4)
- New `design-prototypes.html` with reference components — defer to first feature PR (devils-advocate #3 — public Netlify leak risk)
- Mark Fluent as deprecated — explicit decision NOT to (devils-advocate #1 — still actively used)
- Fix the duplicate `.empty-state` in components.css — adjacent bug, NOT in scope (process violation if folded in)
- Refactor `feature-flags.html` to use the design system — separate PR
- @axe-core/playwright CI integration — defer until first real new UI ships
- Visual regression testing — defer (public-repo screenshot leak risk)
- Lighthouse CI — too slow, deferred indefinitely
- User-app design system documentation — separate scope, separate PR
- 12,500-line `style.css` cleanup — separate PR series
- SYSTEM_MAP.md regeneration — separate chore PR (requires Haim approval)

## Rollback

If this PR lands in DEV and breaks anything:

```bash
git revert <merge-commit>
git push origin main
```

The only behavior-affecting change is the 3-line `@media (prefers-reduced-motion: reduce)` block. If somehow it causes issues for ANY user (extremely unlikely — it only activates when the user opts INTO reduced motion in their OS settings), the revert above restores the prior behavior. No data rollback needed.

Documents in `docs/` are pure additive — revert removes them, nothing in the codebase imports them at runtime.

PR template change is also reverted by `git revert`.

## Test plan (G4)

Manual verification (no automated tests for documentation):

1. Open `apps/admin-panel/index.html` in Chrome → no console errors, no visual changes
2. In Chrome DevTools → Rendering tab → "Emulate CSS media feature prefers-reduced-motion" → set to "reduce"
3. Hover over any `.card` element → transitions should now be 0ms (instant) instead of 200ms
4. Set back to "no-preference" → transitions return to 200ms
5. Read `docs/DESIGN_BAR.md` end-to-end → verify it makes sense as a standalone document
6. Read `docs/DESIGN_SYSTEM.md` → cross-reference 5 random tokens against actual `design-system.css`
7. Open a test PR with a tiny CSS change → confirm the new PR template renders with the a11y subsections

## Notes for grader

- This PR is the design counterpart to PR-META-6 (engineering bar, merged earlier today). Structure, language, and scoping should mirror it.
- The repo is PUBLIC — public Netlify, public CI logs. The design prototypes page is INTENTIONALLY out of scope because hosting it publicly would leak AI Management Layer roadmap to competitors (devils-advocate #3 from META-7).
- The `prefers-reduced-motion` safety net at the token layer is the SAFEST way to comply with the new bar without rewriting any of the 58 existing transition call sites. Devils-advocate explicitly recommended this approach.
- This PR consciously declines to mark Fluent CSS as "deprecated" because the agent found active production usage (`clients-fluent.html`, FluentClientsManager.js, FluentDataGrid.js, 3 active rubrics reference the page).
