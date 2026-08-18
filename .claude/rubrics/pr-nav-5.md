# PR-NAV-5 Rubric — Sidebar Behavior Matching (User-App Parity)

## Scope
Admin panel sidebar: match 5 behavioral patterns from user-app sidebar. CSS + 1 JS line. No color/theme changes — light theme preserved.

## Files
- `apps/admin-panel/css/navigation.css` — press scale, flyout indent/active, active bar position
- `apps/admin-panel/js/ui/Navigation.js` — remove click-navigate on flyout parent

## MUST criteria

1. **Press scale = 0.95**: All `:active { transform: scale(...) }` rules use `0.95` (not `0.97`). Applies to `.nav-item`, `.nav-group-header` across tablet + desktop breakpoints.
2. **Flyout item hover indent**: `.nav-flyout-item:hover` includes `padding-right: 20px` (shifted from default 16px `var(--space-4)`).
3. **Flyout item :active state**: `.nav-flyout-item:active` has a background color rule.
4. **Flyout indent transition**: `.nav-flyout-item` transition property includes `padding-right`.
5. **Active bar inner edge (tablet)**: Tablet breakpoint `.nav-item.active::before` uses `left` (not `right`) for positioning — bar appears on the content-facing side.
6. **Active bar inner edge (desktop)**: Desktop breakpoint `.nav-item.active::before`, `.nav-group.group-active .nav-group-header::before`, `.nav-sub-item.active::before` all use `left` positioning.
7. **Active bar border-radius flipped**: All active bars use `border-radius: 0 3px 3px 0` (rounded on the right = away from sidebar edge).
8. **No-navigate on flyout parent click**: In `setupGroupToggle()`, collapsed/tablet click on group header does NOT call `window.location.href`. The handler returns early.
9. **Mobile active indicator preserved**: Mobile breakpoint `.nav-item.active::before` still uses `top: 0; left: 25%; right: 25%` (horizontal top bar, not side bar).
10. **Tests pass**: All navigation tests pass (`npm test`).

## SHOULD criteria

1. **No scale(0.97) anywhere**: Zero occurrences of `0.97` in navigation.css.
2. **Consistent flyout item UX**: Hover indent + active press + transition all work together for smooth flyout interaction.
3. **No breaking change to desktop expanded**: Desktop expanded sidebar group expand/collapse still works (not affected by the collapsed/tablet JS change).
