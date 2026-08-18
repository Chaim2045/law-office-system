# PR H.6.3 — Pending Clients nav entry

**Scope:** One additive `navItems` entry in `apps/admin-panel/js/ui/Navigation.js` making the H.6 Pending Clients page (PR2) reachable from the admin menu. Mirrors H.3 PR5 (#375, the `רווחיות` nav tab). Frontend-only, additive.

## MUST criteria

### M1 — Additive-only
The change adds exactly ONE `navItems` entry. No existing entry (users/clients/workload/profitability/reconciliation/announcements) is modified, reordered, or removed.

### M2 — id matches the page's active-state contract
The new entry's `id` MUST equal the string the page passes to `Navigation.init(...)` — i.e. `id: 'pending-clients'` ↔ `Navigation.init('pending-clients')` in `pending-clients.html` — or the tab never renders active.

### M3 — href matches the real page
`href` MUST be `pending-clients.html`, the actual filename shipped in PR2.

### M4 — Hebrew label (G5)
The `label` MUST be Hebrew (`לקוחות ממתינים`).

### M5 — Static-scan guard test
A test MUST assert the entry exists (href + label + id), that the id equals the page's `Navigation.init` argument, and that the existing tabs are intact — mirroring `navigation-profitability-tab.test.ts`.

## SHOULD criteria

### S1 — Placement
The entry SHOULD sit logically near `clients` (client-intake grouping).

### S2 — Icon
The `icon` SHOULD be a valid Font Awesome class semantically fitting "pending" (e.g. `fa-user-clock`).
