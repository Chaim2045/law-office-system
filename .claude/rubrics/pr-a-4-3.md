# Rubric — PR-A.4.3 (RETROACTIVE — gate skipped at PR time)

**Title:** fix(admin-modal): bump status-change dialog z-index above ClientManagementModal
**Branch:** fix/status-modal-zindex-pr-a-4-3 (already merged into main)
**Base:** main
**Scope:** UI-only fix. The new status-change dialog from PR-A.4 used inline z-index 10000. ClientManagementModal uses z-index 10200 (clients-modals.css:53, "highest in app"). When the dialog was triggered from inside the management modal, it rendered behind it. Fix bumps the dialog overlay to z-index 10500. Plus the cache-bust string was updated.

**NOTE TO GRADER:** This rubric is written AFTER the PR was merged. CLAUDE.md OUTCOMES GRADER RULE was violated: the original commit went out without a rubric or grader run. This retroactive evaluation produces an audit record + verifies the landed state is safe. It does NOT undo the gate-skip — that requires a process commitment to prevent recurrence.

## MUST criteria (block on FAIL — even retroactively informative)

### M1 — Inline z-index bumped to a value strictly greater than 10200
**Rule:** `apps/admin-panel/js/ui/ClientManagementModal.js` overlay `z-index` is at least 10201, with explicit comment naming the cause.
**Evidence required:** Grep on the file shows `z-index:10500` (or any value > 10200) on the status-change overlay. Comment block names ClientManagementModal's 10200 baseline.

### M2 — z-index value does NOT exceed reserved high stacks
**Rule:** Value chosen does not collide with reserved stacks documented elsewhere in CSS (e.g., 11000 for QuickMessage in components.css:2933). 10500 is acceptable (below 11000, above 10200).
**Evidence required:** Reading `apps/admin-panel/css/components.css` for high-z-index reservations.

### M3 — Cache-bust string updated on at least one HTML entry that loads the file
**Rule:** The cache-bust query string on `ClientManagementModal.js` in any admin HTML referencing it is bumped from the prior value so browsers re-fetch.
**Evidence required:** Diff of `apps/admin-panel/clients.html` (or `clients-fluent.html` if it loads ClientManagementModal.js) shows new `?v=` value.

### M4 — No data-path changes
**Rule:** Diff confined to one inline-style number + one comment + one cache-bust line. No CF, no User App, no Firestore writes.
**Evidence required:** `git show <merge-commit> --stat` confined to expected files.

### M5 — All existing tests still pass
**Rule:** `npm test` (root Vitest) and `cd functions && npm test` (Jest) pass with no regression after the merge.
**Evidence required:** Test runner output post-merge.

### M6 — Lint zero errors
**Rule:** `npm run lint` returns 0 errors.
**Evidence required:** Lint output.

## SHOULD criteria

### S1 — Comment explains the stacking trap for the next maintainer
**Rule:** Inline comment in the changed file names: (a) the prior wrong value, (b) ClientManagementModal's 10200 baseline, (c) the symptom (dialog rendered behind / invisible).
**Evidence required:** Comment block reading.

### S2 — clients-fluent.html cache-bust also bumped (if it loads ClientManagementModal)
**Rule:** If `clients-fluent.html` references ClientManagementModal.js, its cache-bust should also be bumped. Otherwise — N/A.
**Evidence required:** Grep on clients-fluent.html.

## Process gap — recorded for next time

This PR landed without:
- `work-session-gatekeeper` invocation (was a new task from smoke findings)
- A rubric written upfront
- `outcomes-grader` evaluation before opening the PR

The gap is now documented. Going forward, every PR — including small UI fixes — gets the full gate. CLAUDE.md says "No exceptions" for the OUTCOMES GRADER RULE.

## Rollback

`git revert <merge-commit>` → CI redeploys. Dialog returns to z-index 10000 (the prior misrender). No data effect.
