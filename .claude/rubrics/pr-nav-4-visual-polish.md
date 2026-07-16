# PR Rubric — PR-NAV-4: Visual Polish (Minimal)

## Scope

Apply the `--shadow-sidebar` design-system token + warm background (`--gray-50`) to the desktop sidebar. CSS-only, 3 lines changed.

## MUST (all required for PASS)

- M1: Desktop sidebar uses `var(--shadow-sidebar)` (not `box-shadow: none`)
- M2: Desktop sidebar background is `var(--gray-50)` (not `white`)
- M3: All existing admin-panel tests pass (338+)
- M4: ESLint 0 errors on modified file
- M5: No behavioral change — only visual

## SHOULD (nice-to-have)

- S1: Brand section border uses `--gray-200` for better visual separation
