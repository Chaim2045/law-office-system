# Design Bar — Admin Panel UI

**Introduced by:** PR-META-7 (2026-05)
**Applies to:** All new UI added to `apps/admin-panel/` from PR-META-7 onwards.
**Does NOT apply to:** The 11 existing Admin Panel HTML pages (grandfathered — see Scope below).
**Companion document:** `docs/ENGINEERING_BAR.md` (backend code in `functions/src-ts/`).

---

## Why this exists

The law-office-system is being prepared for commercial sale (PRODUCT-GRADE Rule, PR-META-3). The existing Admin Panel UI was built quickly during 6 months of feature work — it has a beautiful base ("Ultra Minimal Hi-Tech" design system) but inconsistent application: focus styles vary, accessibility hooks are sparse, motion preferences are unhandled in admin-panel (though user-app already respects them), and two parallel design systems coexist (Ultra Minimal + Fluent).

Rather than retrofit 12,500 lines of legacy CSS (see `docs/CSS_CLEANUP_GUIDE.md`), we set a higher bar for code that doesn't exist yet. New UI ships polished, accessible, motion-respecting. Existing UI is grandfathered with known debt documented.

---

## Scope (read this carefully — it's the point of META-7)

### IN scope — new UI must clear this bar
- New HTML pages added to `apps/admin-panel/` (e.g. profitability dashboard, PDF approval screen, AI chat surface)
- New CSS files added to `apps/admin-panel/css/`
- New JavaScript UI components in `apps/admin-panel/js/ui/`
- Substantial rewrites (>100 lines) of existing UI that are deliberately modernizing it

### OUT of scope — these are grandfathered, document don't enforce
- The 11 existing `.html` pages: `index.html`, `clients.html`, `tasks.html`, `workload.html`, `timesheet.html`, `audit-trail.html`, `settings.html`, `system-announcements.html`, `feature-flags.html`, `clients-fluent.html`, `client-edit.html`
- The 50+ existing CSS files (the legacy `style.css` is documented in `docs/CSS_CLEANUP_GUIDE.md` as ~12,500 lines with 273 duplicate selectors — known debt)
- The Microsoft Fluent design system at `apps/admin-panel/css/fluent-design.css` — **FROZEN, not deprecated**: actively used by `clients-fluent.html` + the Fluent JS managers; removal is a deliberate separate PR after usage investigation
- The `apps/user-app/` design system (separate scope, separate PR)

### Known a11y debt in the grandfathered surface
The existing 11 admin pages have approximately:
- 0 `skip-link` patterns
- 0 `aria-live` regions
- 0 explicit `alt=""` on decorative images
- 0 `tabindex` overrides (which is good — but also no positive use)
- 1 `aria-label` (only on `index.html`)
- 58 uses of `--transition-*` tokens (now reduced-motion-safe via the token override added in this PR)
- Mixed `:focus` style coverage: `.input-minimal` has a ring; `.btn-minimal` doesn't

Tackling each is a separate PR series. Do not block new work on the legacy debt.

---

## The bar (mandatory for new UI)

### 1. Tokens, not literals

- Use the existing `--space-*`, `--gray-*`, `--accent-*`, `--text-*`, `--radius-*`, `--transition-*`, `--shadow-*`, `--z-*` tokens from `apps/admin-panel/css/design-system.css`.
- **Forbidden:** hardcoded hex colors (`#3b82f6`), literal spacing (`padding: 16px`), literal transitions (`transition: 200ms ease`).
- If a token doesn't exist for what you need, ADD it to `design-system.css` — don't introduce a parallel token file.

### 2. Motion respects `prefers-reduced-motion`

- The safety net in `design-system.css` makes `--transition-fast/smooth/slow` collapse to `0ms` when the user requests reduced motion.
- **All you need to do:** use the tokens (`transition: var(--transition-smooth)`), never the literals.
- For JavaScript animations (springs, scroll-driven reveals, etc.), check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and disable the animation when true.

### 3. RTL Hebrew first

- Every new page sets `<html lang="he" dir="rtl">`.
- Directional icons (chevrons, arrows, back/forward) must be RTL-aware. Either use icons that visually flip when mirrored, or apply CSS transform: `[dir="rtl"] .icon-back { transform: scaleX(-1); }`.
- Numeric columns / code blocks may use `direction: ltr` selectively. Document why in a CSS comment.

### 4. Accessibility minimum (WCAG AA)

- **Focus visibility:** every interactive element has a visible `:focus-visible` style (use the `--blue` accent for the ring, like `.input-minimal` does).
- **Contrast:** text + background contrast ≥ 4.5:1 (normal text), ≥ 3:1 (large text + UI components). Note: `--blue` #3b82f6 on white is 3.7:1 → FAILS for normal text; only use as background-with-white-text.
- **Names:** every interactive element has an accessible name. Button has visible text, or `aria-label` if icon-only. Form input has `<label for="...">` (or `aria-labelledby`).
- **Heading hierarchy:** one `<h1>` per page; descend without skipping (no `<h2>` followed by `<h4>`).
- **Empty states:** include a visible message + an action when applicable. Don't show a blank screen.

### 5. Use the modal pattern

- New modals: `window.ModalManager.create({...})` — see `apps/admin-panel/js/ui/Modals.js`.
- **Forbidden in new code:** inline `<div class="modal">` HTML blocks (the legacy pattern that lives in `clients.html`).

### 6. Use the existing component patterns

- Tables: `data-table` + `filter-item` + `Pagination.js`. New tables follow this.
- Side panels: `TaskApprovalSidePanel.js` is the canonical slide-out pattern. AI Chat will follow the same shape.
- FAB: page-aware via `FloatingActionButton.js`. Extend the switch in `getButtonLabel()` for new pages.

### 7. Hebrew customer-facing strings

(Inherited from `_PRODUCT-GRADE-GATES.md` G5.) Every label, button, status, error message visible to the user is in Hebrew. English is acceptable only for code identifiers, internal log messages, and developer tooltips on admin-only screens.

### 8. No new parallel design systems

- One system: Ultra Minimal Hi-Tech (the existing `design-system.css`).
- Fluent is FROZEN — do not introduce more Fluent surfaces.
- Do not introduce Tailwind, shadcn, MUI, Bootstrap, or any other CSS framework.

### 9. Error states are professional (G1 inherited)

- No raw `Error: ...` or `undefined` or `[object Object]` shown to the user.
- Hebrew message + suggested next action ("נסה שוב" / "פנה למנהל").
- Tech detail goes to `console.error` for support, never to the user.

### 10. Cite the bar in PR body

- New UI PRs should reference this document in the summary so reviewers know the bar applies.

---

## What's NOT required (yet)

These are good practices for the future but not enforced in META-7:

- WCAG AAA (AA is the bar; AAA is luxury)
- Visual regression testing (defer until the surface is stable)
- @axe-core/playwright in CI (separate PR after the first real UI ships)
- Lighthouse in CI (too slow; nightly only if at all)
- 100% accessible-by-default component library (we have 10 daily users, not 10,000)
- Localization tooling (Hebrew-only system)
- Mobile-first responsive design (admin panel is desktop-primary)
- High-contrast / dark mode (no users have asked)
- `prefers-color-scheme` handling

---

## Aspirational guidance (RECOMMEND but not BLOCK)

These appear in the PR review template but are NOT auto-enforced by the grader. Reviewers may flag them; they don't block merge:

- **Keyboard navigation walkthrough** — Tab through the whole page; ESC closes modals; arrow keys work in tables/menus
- **Screen reader smoke test** — Open the page in NVDA + Chrome (Windows native), confirm each interactive element announces correctly in Hebrew voice
- **Zoom 200%** — Browser zoom to 200% should reflow without horizontal scroll or clipped content
- **Loading / empty / error states** — All three should have visible, accessible feedback
- **No console errors on page load**

For each of these, the manual checklist in `.github/PULL_REQUEST_TEMPLATE.md` exists to remind contributors. The grader does NOT mechanically verify them — it would degenerate into a check-box exercise. They're aspirational guidance, made explicit so contributors know to think about them.

---

## How META-7 itself enforces this

| Bar item | Enforcement |
|---|---|
| Tokens, not literals | Reviewer attention + PR template checkbox |
| `prefers-reduced-motion` | The 3-line `@media` block in `design-system.css` makes EXISTING tokens compliant automatically. Reviewer attention catches direct literals. |
| RTL Hebrew | PR template checkbox + Reviewer attention |
| Focus visibility | Reviewer attention + PR template checkbox (grader greps for `:focus-visible` or `:focus` in new CSS) |
| Contrast | Manual check in PR template (no auto-enforcement until @axe-core/playwright lands) |
| Modal pattern | PR template: "uses ModalManager? Yes/No" |
| Existing component patterns | Reviewer attention |
| Hebrew text | PRODUCT-GRADE Gate G5 (existing) |
| No new parallel systems | This document + Reviewer attention |
| Error states | PRODUCT-GRADE Gate G1 (existing) |

The bar is short, concrete, and addresses real risks. It's not a 50-item checklist that nobody reads.

---

## When the bar gets RAISED

Quarterly review:
- Look at what the actual UI PRs ship with. If contributors consistently get focus styles right without prompting, the rule is internalized — move it from MUST to SHOULD.
- If a class of bug isn't caught by the current bar (e.g., toast messages disappear too fast for screen readers), add the rule.
- If a tool becomes free + fast (e.g., @axe-core matures for RTL Hebrew), automate the rule.

The bar moves UP, never down.
