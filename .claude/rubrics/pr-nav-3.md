# PR-NAV-3 Rubric — SVG Icon Migration

## Scope
Replace all Font Awesome `<i class="fas fa-*">` icons in the navigation component with inline SVG elements using `stroke="currentColor"` for color inheritance.

## Files Changed
- `apps/admin-panel/js/ui/Navigation.js` — SVG_ICONS map + _svgIcon helper + all `<i>` → `${_svgIcon(...)}`
- `apps/admin-panel/css/navigation.css` — `i` selectors → `.nav-icon`, `font-size` → `width`/`height`

## MUST (all required for PASS)

1. **M1 — Zero `<i>` tags**: No `<i class="fas ...">` remains in Navigation.js
2. **M2 — SVG_ICONS map complete**: All 14 icon keys mapped (`fa-users`, `fa-briefcase`, `fa-user-clock`, `fa-chart-line`, `fa-money-bill-trend-up`, `fa-scale-balanced`, `fa-bullhorn`, `fa-triangle-exclamation`, `fa-history`, `fa-cog`, `fa-chevron-down`, `fa-sign-out-alt`, `fa-ellipsis`, `fa-chevron-left`)
3. **M3 — currentColor inheritance**: All SVGs use `stroke="currentColor"` so active/hover/normal states inherit color from parent
4. **M4 — CSS selectors updated**: All `i` element selectors in navigation.css changed to `.nav-icon`
5. **M5 — SVG sizing**: CSS uses `width`/`height` instead of `font-size` for SVG sizing
6. **M6 — Test compatibility**: All 6 navigation tests pass unchanged (flat PRIMARY_NAV/UTILITY_NAV arrays preserved)
7. **M7 — nav-icon class**: All SVGs have `class="nav-icon"` for CSS targeting
8. **M8 — Chevron special class**: Group chevron SVG has both `nav-icon` and `nav-group-chevron` classes

## SHOULD (nice to have)

1. **S1 — Lucide-style consistency**: All SVGs use viewBox="0 0 24 24", fill="none", stroke-width="2", stroke-linecap="round", stroke-linejoin="round"
2. **S2 — Fallback graceful**: `_svgIcon()` returns empty string for unknown keys (no crash)

## PRODUCT-GRADE GATES

- G1: N/A — no error messages (cosmetic icon swap, no user input)
- G2: Rollback = `git revert <commit>` + redeploy (CSS + JS only, no data change)
- G3: N/A — read-only UI component, no data mutations
- G4: 6/6 existing tests pass; visual verification across 3 breakpoints
- G5: N/A — no text changes (icons only)
- G6: N/A — no breaking API/data change (flat arrays preserved for test compat)
- G7: N/A — no auth/PII/permissions touched
