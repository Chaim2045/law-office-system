# PR-NAV-4 Rubric — Visual Polish + Flyout + Toggle Fix

## Scope
Admin panel sidebar: visual polish (hover/active/press states, chrome depth), toggle button fix, flyout submenus for collapsed/tablet mode.

## Files
- `apps/admin-panel/css/design-system.css` — `--shadow-sidebar` token
- `apps/admin-panel/css/navigation.css` — hover/active/press, toggle fix, flyout CSS
- `apps/admin-panel/js/ui/Navigation.js` — flyout HTML in render()

## MUST criteria

1. **Toggle button NOT clipped**: Desktop breakpoint has `overflow: visible` on `.admin-navigation` (root cause was `overflow-x: hidden` from tablet not overridden)
2. **Toggle hover-reveal**: Toggle starts `opacity: 0`, becomes visible on `.admin-navigation:hover` or `:focus-visible`
3. **Flyout submenu CSS exists**: `.nav-flyout` positioned absolute, left of sidebar, with opacity/visibility transition
4. **Flyout hover guard**: `@media (hover: hover)` wraps the `.nav-group:hover .nav-flyout` rule (touch devices fall back to click-navigate)
5. **Flyout HTML rendered**: Each `.nav-group` in `render()` contains a `.nav-flyout` div with header + child links
6. **Flyout hidden when expanded**: Desktop expanded mode has `.nav-flyout { display: none }`, shown only when collapsed (`body.sidebar-collapsed .nav-flyout { display: block }`)
7. **Hover/active/press on nav items**: `translateY(-1px)` hover lift, `scale(0.97)` press, across tablet + desktop breakpoints for `.nav-item`, `.nav-group-header`, `.nav-sub-item`
8. **Design tokens used**: All new transitions use `var(--transition-*)`, all shadows use `var(--shadow-*)`, no hardcoded durations or shadows
9. **Tests pass**: All 6 navigation tests pass (`npm test`)
10. **No Font Awesome regression**: Zero `<i class="fas` tags in Navigation.js (PR-NAV-3 integrity)

## SHOULD criteria

1. **Desktop border-radius**: `.admin-navigation` has `border-radius: var(--radius-lg) 0 0 var(--radius-lg)` for soft left edge
2. **Bridge pseudo-element**: `.nav-flyout::after` creates hover bridge between group icon and flyout panel
3. **Focus-visible on flyout items**: `.nav-flyout-item:focus-visible` included in the global focus-visible selector list
4. **Sub-item hover lift**: `.nav-sub-item:hover` includes `transform: translateY(-1px)` with `transform` in transition
5. **Sidebar chrome**: Background `var(--gray-50)`, border `var(--gray-100)`, shadow `var(--shadow-sidebar)`
