# Admin Panel Design System

**Name:** Ultra Minimal Hi-Tech
**Canonical source:** `apps/admin-panel/css/design-system.css` (346 lines)
**Introduced:** Pre-existing (before META-7); formally documented in PR-META-7.
**Scope:** Admin Panel only. The User App has its own separate design system (out of META-7 scope).

---

## What this document is

This is the **reference** for every token, spacing unit, color, type scale, and named layer in the Admin Panel design system. It is not a tutorial; it is the map.

For the rules that govern HOW to apply these tokens to new UI, see `docs/DESIGN_BAR.md`.

---

## Color

### Grayscale (neutral foundation)

| Token | Value | Typical use |
|---|---|---|
| `--gray-50`  | `#fafafa` | Subtle background tint |
| `--gray-100` | `#f5f5f5` | Card background, hover state |
| `--gray-200` | `#e5e5e5` | Border, divider |
| `--gray-300` | `#d4d4d4` | Disabled border |
| `--gray-400` | `#a3a3a3` | Placeholder text |
| `--gray-500` | `#737373` | Secondary text (passes WCAG AA on white) |
| `--gray-600` | `#525252` | Primary text on cards |
| `--gray-700` | `#404040` | Default body text |
| `--gray-800` | `#262626` | Headings |
| `--gray-900` | `#171717` | Maximum contrast |

### Accent (functional color)

Each accent has three tones: base, `-light` (10% alpha tint for backgrounds), and `-dark` (deeper shade for hover/active).

| Family | Base | Use |
|---|---|---|
| Blue   | `--blue` `#3b82f6` | Primary action, link, info |
| Green  | `--green` `#10b981` | Success, positive, "go" |
| Orange | `--orange` `#f97316` | Warning, "warm" warning, attention |
| Red    | `--red` `#ef4444` | Error, destructive, danger |

**WCAG AA notes:**
- `--blue` `#3b82f6` on white = 3.7:1 → **FAILS** for normal text. Use as `background` color with white text only.
- `--gray-500` `#737373` on white = ~4.8:1 → passes AA for normal text.
- `--gray-700` `#404040` on white = ~10.4:1 → passes AAA.
- Always verify contrast for new pairs. See `docs/DESIGN_BAR.md` "Contrast" rule.

---

## Spacing (4px grid, 12 steps)

| Token | px | Use |
|---|---|---|
| `--space-1` | 4  | Tight padding, label gap |
| `--space-2` | 8  | Default inline gap |
| `--space-3` | 12 | Tight block padding |
| `--space-4` | 16 | Default block padding |
| `--space-5` | 20 | Card padding |
| `--space-6` | 24 | Section padding |
| `--space-8` | 32 | Page-block separation |
| `--space-10`| 40 | Hero spacing |
| `--space-12`| 48 | Large page-block separation |

(Steps 7, 9, 11 are intentionally absent — the 4px grid uses the major 4/8/12/16/20/24/32/40/48 sequence.)

---

## Typography

### Sizes

| Token | px | Use |
|---|---|---|
| `--text-xs`  | 11 | Smallest labels, captions |
| `--text-sm`  | 12 | Helper text, footnotes |
| `--text-base`| 14 | Body |
| `--text-lg`  | 16 | Lead text, emphasis |
| `--text-xl`  | 18 | Subhead |
| `--text-2xl` | 20 | Section header |
| `--text-3xl` | 24 | Page title |

### Weights

| Token | Weight | Use |
|---|---|---|
| `--weight-medium` | 500 | Body emphasis |
| `--weight-semibold` | 600 | Subhead, button label |
| `--weight-bold` | 700 | Page title |

### Letter spacing

| Token | Value | Use |
|---|---|---|
| `--tracking-tight`  | -0.01em | Large display type |
| `--tracking-normal` | 0       | Default |
| `--tracking-wide`   | 0.04em  | Uppercase / badge text |

### Font family

Defined elsewhere (currently the browser-default sans-serif stack with optional Heebo from Google Fonts). RTL Hebrew is well-supported by the system stack.

---

## Border radius

| Token | px | Use |
|---|---|---|
| `--radius-sm` | 8  | Tag, badge |
| `--radius-md` | 12 | Card, modal corner |
| `--radius-lg` | 16 | Hero element |
| `--radius-xl` | 20 | Side panel, prominent surface |

---

## Transitions

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--transition-fast`   | 120ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Micro-interactions (hover state, focus ring) |
| `--transition-smooth` | 200ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard movement (modal open/close, panel slide) |
| `--transition-slow`   | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Complex motion (multi-step reveal) |

### `prefers-reduced-motion` safety net (PR-META-7)

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --transition-fast: 0ms;
    --transition-smooth: 0ms;
    --transition-slow: 0ms;
  }
}
```

This single block makes EVERY existing call site (58 across 6 CSS files) respect the user's a11y preference automatically. New code: always use the tokens, never literal durations.

---

## Shadows

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgb(0 0 0 / 5%)` | Subtle elevation (resting card) |
| `--shadow-md` | `0 4px 12px rgb(0 0 0 / 8%)` | Default elevation (hover card, dropdown) |
| `--shadow-lg` | `0 8px 24px rgb(0 0 0 / 12%)` | Prominent elevation (modal) |
| `--shadow-xl` | `0 16px 48px rgb(0 0 0 / 16%)` | Maximum elevation (side panel) |

---

## Z-index layers

14 named layers — `apps/admin-panel/css/design-system.css:121-143`:

| Token | Value | Use |
|---|---|---|
| `--z-base`         | 1     | Default stacking |
| `--z-card`         | 10    | Resting card surface |
| `--z-sticky`       | 100   | Sticky header / sidebar |
| `--z-dropdown`     | 500   | Dropdown menu, autocomplete |
| `--z-modal`        | 1000  | Modal overlay |
| `--z-toast`        | 2000  | Toast notification |
| `--z-tooltip`      | 3000  | Tooltip |
| `--z-notification` | 10000 | Persistent notification |
| `--z-critical`     | 99999 | Maximum (emergency interrupts only) |

(Intermediate values are reserved for future layers; do not introduce ad-hoc z-index numbers — use the named token.)

---

## Utility classes (Tailwind-style, ~130 lines)

The lower half of `design-system.css` exposes utility classes covering the same tokens:

- `.p-1` through `.p-12` (padding)
- `.m-1` through `.m-12` (margin)
- `.gap-1` through `.gap-12` (flex/grid gap)
- `.rounded-sm` through `.rounded-xl` (border-radius)
- `.text-xs` through `.text-3xl` (font-size)
- `.bg-gray-50` through `.bg-gray-900`
- `.shadow-sm` through `.shadow-xl`
- `.transition-fast`, `.transition-smooth`, `.transition-slow`

Use utilities for one-off layout; use semantic classes (`.card`, `.btn-minimal`, `.input-minimal`) when the pattern repeats.

---

## Base components

### `.card`

The atomic surface. White background, soft shadow, default padding, hover lift (`translateY(-1px)` + larger shadow).

### `.btn-minimal`

Minimal button. Subtle, no heavy chrome.
**Note:** currently does NOT have a `:focus-visible` style. New buttons MUST add one — see `docs/DESIGN_BAR.md`.

### `.input-minimal`

Minimal text input. White background, bottom-border accent on focus.
Has `:focus` ring at `--blue` 10% alpha — copy the pattern for new inputs.

### `.label-minimal`

Form label. Small, gray-600.

---

## Known parallel systems (FROZEN)

### Microsoft Fluent (`apps/admin-panel/css/fluent-design.css`)

A second design system used by `clients-fluent.html` + `apps/admin-panel/js/fluent/` managers. Defines its own tokens: `--fluent-accent`, `--fluent-neutral-*`, `--fluent-error`, etc.

**Status: FROZEN, not deprecated.** It actively ships in production. Removal is a deliberate separate PR after usage investigation. Do not introduce new Fluent surfaces. Do not refactor Fluent code opportunistically.

### Known token drift

40 hardcoded hex colors exist in `apps/admin-panel/css/components.css` per the design-system inventory. These predate the token discipline. Cleanup is a separate PR series.

### Two `.empty-state` definitions

Defined twice in `apps/admin-panel/css/components.css`: at line 552 (with `var(--space-12)` padding) and line 1916 (with `var(--space-8)` padding + different typography). The second wins by source order. This is a drift bug — cleanup is a separate small PR, not META-7's job.

---

## How this document stays accurate

When a new token is added to `design-system.css`, this document should be updated in the same PR. The Engineering Bar's "doc-as-you-go" principle applies (mirroring `docs/ENGINEERING_BAR.md` for backend code).

When a token is removed or renamed, this document is the canonical reference for which call sites need to be updated — search before you delete.
