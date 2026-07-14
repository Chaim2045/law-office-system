# Rubric — PR perf/admin-quick-wins

## Scope
3 performance quick wins for the admin panel (+ user-app cache headers):
1. **QW-1**: Cache-Control headers `no-cache` → `immutable` for JS/CSS (both netlify.toml files)
2. **QW-2**: Login form early guard preventing native submit before JS loads
3. **QW-3**: `defer` attribute on all `<script src>` tags across 15 admin-panel HTML pages

## MUST criteria

| # | Criterion | How to verify |
|---|-----------|---------------|
| M1 | Cache-Control for JS/CSS = `public, max-age=31536000, immutable` in admin netlify.toml | grep the file |
| M2 | Cache-Control for JS/CSS/dist = `public, max-age=31536000, immutable` in root netlify.toml | grep the file |
| M3 | HTML Cache-Control unchanged (no-cache/no-store) | grep the file |
| M4 | Login form early guard blocks native submit before `window.AuthSystem` exists | read index.html |
| M5 | Login form early guard shows Hebrew loading text "טוען מערכת..." | read index.html |
| M6 | Every `<script src>` in all 15 admin HTML pages has `defer` | grep all HTML files |
| M7 | Inline `<script>` blocks do NOT have `defer` | grep all HTML files |
| M8 | `type="module"` scripts do NOT get redundant `defer` | grep all HTML files |
| M9 | All tests pass (865+) | npm test output |
| M10 | No double-defer (`defer defer`) anywhere | grep all HTML files |

## SHOULD criteria

| # | Criterion |
|---|-----------|
| S1 | Test fixes for load-order assertions are minimal and preserve the original invariant |
| S2 | QW-2 inline script is self-contained (no dependencies on other scripts) |
