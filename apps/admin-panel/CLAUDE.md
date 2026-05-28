# ADMIN PANEL — LOCAL WORKING RULES

## SCOPE
These rules apply only when working inside `apps/admin-panel/`.

They are added on top of the root CLAUDE.md.

## ROLE
This area is admin-critical.

Changes inside `apps/admin-panel/` may affect:
- management visibility
- workload screens
- approvals
- task states
- dashboards
- counts and filters
- business decisions based on displayed data
- operational trust in the system

Assume that wrong display can create wrong decisions.

## REQUIRED MENTAL MODEL
Before proposing or changing anything in `apps/admin-panel/`, explicitly check:

1. What data is shown?
2. Where does the data come from?
3. Is it raw data or derived/aggregated data?
4. What filters affect it?
5. What permissions affect it?
6. What states affect visibility?
7. Could the UI show stale or partial data?
8. Could the Admin Panel disagree with backend truth?

## ADMIN SAFETY RULE
Never treat an Admin Panel change as visual-only by default.

Any meaningful change here must consider:
- filtering logic
- sorting logic
- counts
- approval status
- hidden vs visible state
- stale state
- mismatch between UI and Firestore
- mismatch between Admin Panel and User App

If any of these were not checked:
say explicitly: "אין לי ודאות".

## AGGREGATE / DISPLAY RULE
When totals, balances, statuses, workload, or counts are displayed:
explicitly identify:
- what is source data
- what is derived display
- where mismatch may appear
- whether the screen is operationally trusted by staff

If this is unclear:
stop and state it clearly.

## BEHAVIORAL CHANGE RULE
If a change affects:
- what staff sees
- what staff can approve
- what appears as complete / pending / cancelled / blocked
- workload distribution
then explicitly call it a behavioral change.

Do not present it as a small UI tweak.

## VALIDATION MINIMUM FOR ADMIN PANEL
For meaningful admin changes, minimum validation thinking must include:
- happy path
- filtering and sorting behavior
- empty state
- loading state
- stale state / real-time update behavior
- permissions / visibility behavior
- cross-check against backend truth
- regression on existing admin workflows

## SYSTEM_STATUS RULE (LOCAL)
Never update SYSTEM_STATUS.md from work inside `apps/admin-panel/` unless Haim explicitly approved it.

The file path is:
`c:\Users\haim\Projects\law-office-system\SYSTEM_STATUS.md`

## STYLE
- Be exact
- Be skeptical of displayed truth
- Do not minimize operational risk
- Do not assume UI correctness means system correctness

## DESIGN PATH FOR NEW UI (PR-META-7, 2026-05)

**All new UI in the Admin Panel must clear the Design Bar.** Existing 11 pages are grandfathered — see `docs/DESIGN_BAR.md` "Scope" section.

### What this means in practice

- **New page or new component?** Read `docs/DESIGN_BAR.md` BEFORE you write CSS. The bar is short and concrete; ignoring it means re-work.
- **Extend `apps/admin-panel/css/design-system.css` tokens** — never introduce parallel token files (`fluent-design.css` is FROZEN, not a template). Never introduce parallel design systems.
- **Use `ModalManager` for modals** — inline `<div class="modal">` HTML is legacy and forbidden in new code. Spec: `apps/admin-panel/js/ui/Modals.js`.
- **`prefers-reduced-motion`** — declared MUST in the Design Bar. New CSS uses the `--transition-*` tokens (which already respect the user's preference via the safety net in `design-system.css`). Never hardcode literal durations like `transition: 200ms ease` — always `transition: var(--transition-smooth)`.
- **RTL Hebrew** — every new page declares `dir="rtl" lang="he"` at the `<html>` element. Icons that imply direction (chevrons, arrows) must be RTL-aware. See `docs/DESIGN_BAR.md` "RTL" section.
- **Accessibility** — `.input-minimal` already has a focus ring; `.btn-minimal` doesn't. New buttons MUST have a visible `:focus-visible` style. New interactive elements need accessible names (`aria-label` if not visually labeled).

### What NEVER changes in this directory by accident

- `apps/admin-panel/css/design-system.css` — base tokens. Changes here ripple to every page. Token additions are fine; renames or removals are breaking changes.
- `apps/admin-panel/css/fluent-design.css` — FROZEN (referenced by `clients-fluent.html` + Fluent JS managers; removal is a deliberate separate PR). Do not refactor opportunistically.
- `apps/admin-panel/index.html` and the other 10 page files — these are the grandfathered surface. Touching them for unrelated reasons risks "admin display change" (see ADMIN SAFETY RULE above).

### Where to find canonical references

- Design standard: `docs/DESIGN_BAR.md`
- Token documentation: `docs/DESIGN_SYSTEM.md`
- Engineering counterpart: `docs/ENGINEERING_BAR.md` (for backend code in `functions/src-ts/`)
