# Rubric — PR #282 (UI Backlog doc)

**Title:** docs(ui): UI-BACKLOG.md for deferred UX/polish items
**Branch:** docs/ui-backlog (PR open, NOT YET merged — rubric written before merge as required)
**Base:** main
**Scope:** Pure documentation. Adds `docs/UI-BACKLOG.md` to capture UX/UI improvement requests that surface during structural work but aren't blocking. Establishes format, rule, and "when to address" policy. Initial entry: the two "שינוי סטטוס לקוח" entry points pending decision.

**NOTE TO GRADER:** Like PR-A.4.3, this PR was opened without a rubric (gate skipped). This rubric is being written before merge to restore the standard. Evaluate the doc on its merits.

## MUST criteria (block on FAIL)

### M1 — File exists at the right path
**Rule:** `docs/UI-BACKLOG.md` exists.
**Evidence required:** Diff of the PR shows the new file.

### M2 — Format clearly defined
**Rule:** The doc establishes a consistent entry format (scope / symptom / severity / proposed change / decision) so future entries are searchable + comparable.
**Evidence required:** Reading the file.

### M3 — Inclusion rule documented
**Rule:** Doc states the rule for what BELONGS in the backlog (aesthetic / redundancy / "could be cleaner") vs what does NOT (misleading-info bugs → fix inline). Prevents the backlog from becoming a dumping ground for real bugs.
**Evidence required:** Reading the file.

### M4 — At least one initial entry in the documented format
**Rule:** First entry exists (the two "שינוי סטטוס" buttons) and follows the documented format. Proves the format is usable.
**Evidence required:** Reading the file.

### M5 — Policy for when to address
**Rule:** Doc names when these items get tackled (after PR-A-E + deep audit, in a dedicated UI phase). Otherwise backlog grows without bounds.
**Evidence required:** Reading the file.

### M6 — No code changes
**Rule:** Diff confined to `docs/UI-BACKLOG.md` only. No CF, no User App, no admin-panel, no tests.
**Evidence required:** `git diff main..HEAD --stat`.

## SHOULD criteria

### S1 — Hebrew + English mix is consistent with repo style
**Rule:** Doc uses the same blend of Hebrew (for product/UX terminology) and English (for technical terms) as other docs in the repo (e.g. CLIENTS_SYSTEM_REPORT.md, SERVICE_TYPES.md).
**Evidence required:** Quick scan vs sibling docs.

### S2 — Closed section exists for historical record
**Rule:** Doc has a "Closed" section (even empty initially) so resolved items don't get deleted but get moved. Prevents loss of decision history.
**Evidence required:** Section present.

## Out of scope

- Migrating existing UI items from other tracking systems
- Designing the actual UI changes proposed in the entries
- Setting a deadline for the UI phase

## Rollback

`git revert <merge-commit>` → doc removed. No code or data effect. Trivial.

## Process gap — recorded

This PR was opened before a rubric existed (CLAUDE.md OUTCOMES GRADER RULE: "No exceptions"). Rubric written before merge to restore the standard. Future docs PRs get rubric+grader BEFORE opening, even for trivial content.
