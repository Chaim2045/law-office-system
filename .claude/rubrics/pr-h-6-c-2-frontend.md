# PR H.6.c-2-frontend — teach the two client-consuming UIs about pending_signature

**Scope:** The frontend half of c-2. `#424` (already on main) taught the backend
(Forecast job + unlinked lister) about `pending_signature`. This PR teaches the two
remaining `clients`-reading surfaces: the admin ClientsTable badge and a user-app
selectability guard — so the moment a pending client can exist (c-3/c-4), no UI
mishandles it. No pending client can exist yet (create button disabled in c-1), so
this is a pre-positioned safety layer. Pure frontend: every changed/added file is
root-vitest-testable; no `functions/` build or ts-jest touched.

## MUST criteria

### M1 — Admin badge, no regression
`ClientsTable.js` `getStatusBadge` renders an explicit Hebrew "ממתין לחתימה" badge for
`pending_signature` (escape-safe), placed as the FIRST branch so the lifecycle status
wins over the derived "no hours" (isBlocked) badge — a 0-service pending client would
otherwise render "חסום (אין שעות)", the wrong story. NO existing status's badge changes
(exact-string equality on a new status value; additive branch only).

### M2 — Admin badge test
A vitest suite pins the new badge: pending_signature → warning class + "ממתין לחתימה" +
hourglass icon, precedence over isOnHold/isBlocked, and that no other status's badge
output changed.

### M3 — User-App selectability guard (test)
A vitest guard pins the pre-existing `status=='active'` query + `.filter` in
`client-case-selector.js`, proving a `pending_signature` client is NOT selectable for
time entry. (Test-only forward-constraint; the RUNTIME defense-in-depth exclusion is a
c-3 requirement — see S1.)

### M4 — Green, no backend churn
Root vitest green (incl. the two new suites + no regression across the admin-panel
suite); `apps/`/`tests/` are the only tracked changes; NO `functions/`, NO `lib/`, NO
`node_modules` staged.

## SHOULD criteria

### S1 — Forward-constraints captured
The PR body records: (a) **c-3 MUST add a RUNTIME `pending_signature` exclusion at the
user-app selector** (the `clients` rule is world-readable, so a test alone is not
sufficient once pending clients are creatable); (b) **c-3 MUST close the
`recomputeProfitabilityForCase` pending-skip gap** that `#424` left (its on-demand
recompute skips pending only in the loop, not in the callable path) — deferred here
because it is backend (needs functions ts-jest, absent in this worktree) and low-reach
(a pending client has activeServices:0 → an empty forecast doc, not corruption).

### S2 — Provenance disclosed
The PR body names that this PR supersedes #425 (which carried a divergent duplicate of
#424's backend and conflicted with main); the three files here are the byte-identical
unique frontend delta from that branch, re-based clean on current main.
