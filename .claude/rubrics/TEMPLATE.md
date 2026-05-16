# PR Rubric Template

Copy this file when creating a new rubric. Replace placeholders. Keep it short — 5-10 MUST criteria + 3-5 SHOULD is the sweet spot.

---

# Rubric — <PR identifier, e.g. "PR-A.4">

**Title:** <PR title>
**Branch:** <branch name>
**Base:** main
**Scope:** <one-paragraph description of what this PR delivers>

## MUST criteria (block on FAIL)

### M1 — <short name>
**Rule:** <one-sentence rule, testable>
**Evidence required:** <file:line OR test output OR doc quote>

### M2 — ...
...

## SHOULD criteria (warning on FAIL, doesn't block)

### S1 — <short name>
**Rule:** ...
**Evidence required:** ...

## Out of scope

What this PR explicitly does NOT do (so grader doesn't downgrade for absence):

- ...
- ...

## Rollback

How to undo this PR if it lands in DEV and breaks something:

- ...

## Notes for grader

Anything subtle the grader should know (e.g. "this PR depends on PR-X being merged first").
