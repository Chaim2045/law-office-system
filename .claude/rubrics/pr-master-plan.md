# Rubric — MASTER_PLAN anchor PR

**Title:** Anchor multi-phase initiative plan in repo
**Branch:** `docs/master-plan-anchor`
**Base:** `main`
**Scope:** Docs-only PR. Creates `docs/MASTER_PLAN.md` as the canonical single source of truth for the AI Management Layer initiative and adds it to `CLAUDE.md` imports so it loads every session.

**Why this PR exists:** the multi-phase plan (Phase 0 done / Phase 1 in progress / Phase 2 waiting) lived only in the Lead Agent's session memory. When a session ended or was compacted, the plan had to be reconstructed from chat history. This PR makes the plan a durable artifact.

## MUST criteria (block on FAIL)

### M1 — `docs/MASTER_PLAN.md` exists with all three phases
**Rule:** The file enumerates Phase 0 (Meta Infrastructure), Phase 1 (Pre-H.0.0 A–G Foundational Safety), Phase 2 (H.0–H.9 AI Management Layer). Each phase has a status table per PR.
**Evidence required:** File exists at `docs/MASTER_PLAN.md`. Grep finds headers for "Phase 0", "Phase 1", "Phase 2". 7 rows under Pre-H.0.0 (A–G). 10 rows under H.0–H.9.

### M2 — Phase 0 status accurately reflects merged PRs
**Rule:** Rows 0.1, 0.2, 0.3 (verifyClaims #336, META-6 #337, META-7 #338) all marked ✅ merged with PR links pointing at the actual GitHub PR numbers.
**Evidence required:** Status column shows ✅ for all three; PR links present and correctly numbered.

### M3 — Phase 1 status accurately reflects merged PRs
**Rule:** Row A (verifyClaims, in Phase 0.1) and Row B (Pre-H.0.0.B, #339) marked ✅ merged. Rows C–G marked ⏸️ pending. Row B has the actual PR link #339.
**Evidence required:** A and B show ✅; C–G show ⏸️; B's row links to #339.

### M4 — Hard constraints listed
**Rule:** The "Hard constraints" section lists the cross-cutting rules (PUBLIC repo, production live, branch protection, Opus agents, Feature Protocol, PRODUCT-GRADE Gates, audit-FIRST/mutation-SECOND pattern, partner claim not yet existing, tofes-mecher accountant-verified).
**Evidence required:** All listed.

### M5 — Recovery instructions present
**Rule:** A "What happens if the session crashes mid-PR?" section describes how a new Lead Agent reconciles the file vs. repo state and which to trust.
**Evidence required:** Section exists with concrete steps (read CLAUDE.md → read MASTER_PLAN → git status → gh pr list → ask Haim if ambiguous).

### M6 — CLAUDE.md import added
**Rule:** `CLAUDE.md` has `@docs/MASTER_PLAN.md` in the Imports section so the plan auto-loads every session.
**Evidence required:** Diff against `main` shows the import line added.

### M7 — CLAUDE.md MASTER PLAN section added
**Rule:** `CLAUDE.md` has a "MASTER PLAN" section near the top that points at the file and tells the Lead Agent when to read it.
**Evidence required:** Diff against `main` shows the new section.

### M8 — Update rules documented
**Rule:** A section explains when and how this file should be updated (status flips on merge, new rows require Haim approval, plan revisions logged at bottom).
**Evidence required:** Section exists.

## SHOULD criteria (warning on FAIL, doesn't block)

### S1 — Cross-references to related docs
**Rule:** "Related references" table links to `feature-protocol.md`, `agent-rules.md`, `decision-point.md`, `_PRODUCT-GRADE-GATES.md`, `ENGINEERING_BAR.md`, `DESIGN_BAR.md`, `PARTNER_CLAIM_DIAGNOSTIC.md`, `ADMIN_CLAIMS_RECOVERY.md`.
**Evidence required:** Table exists with each path.

### S2 — Phase 2 architectural decisions recorded
**Rule:** Phase 2 section lists the locked decisions (Pattern A + D hybrid, cost stamping with `costPerHourAtEntry` snapshot, Plan + Forecast model, exception modal as "open debt", hybrid task budgeting, read-only AI chat).
**Evidence required:** All decisions listed in Phase 2 preamble.

### S3 — Plan revisions log seeded
**Rule:** "Plan revisions" section at the bottom has the initial 2026-05-28 entry documenting the anchor.
**Evidence required:** Entry exists.

## PRODUCT-GRADE GATES

- **G1** Customer-visible errors: **N/A** — docs-only, no runtime paths.
- **G2** Rollback: **PASS** — `git revert <commit>` removes the doc and the CLAUDE.md import. Trivial.
- **G3** Monitoring: **N/A** — no data writes.
- **G4** Customer-scenario test: **N/A** — no behavior to test. Manual review of the doc IS the test.
- **G5** Hebrew UI: **N/A** — internal planning doc, English (matches other internal docs like ENGINEERING_BAR).
- **G6** Breaking change: **PASS** — no existing behavior changes. Pure addition.
- **G7** Security agent: **N/A** — no auth/PII/permissions touched.

## Out of scope

- Updating `docs/ENGINEERING_BAR.md` with the "must-run before PR" check that the Pre-H.0.0.B CI failure exposed — separate MICRO PR.
- Migrating the SYSTEM_STATUS.md / SYSTEM_MAP.md to reference MASTER_PLAN — those are different docs with different lifecycles.
- Documenting Phase 3 / post-MVP backlog — premature; Phase 2 hasn't started.

## Rollback

```bash
git revert <merge-commit>
git push origin main
```

The file is purely additive. Reverting removes the doc and the CLAUDE.md import line. No data, no runtime, no users affected.

## Test plan

1. Read the file end-to-end. Verify phase tables match reality.
2. `git diff main..HEAD -- CLAUDE.md` shows import line added.
3. After merge, on a NEW Claude Code session: the Lead Agent should mention `docs/MASTER_PLAN.md` in its orientation. (Manual smoke — confirm in the next session start.)

## Notes for grader

This PR is intentionally small. Its value is durability of the plan, not new functionality. The most important MUST items are M2 and M3 — accuracy of the status. A grader who sees Row B without #339, or any of Phase 0 marked anything other than ✅, must FAIL.
