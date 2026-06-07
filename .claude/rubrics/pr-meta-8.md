# Rubric — PR-META-8: Bar Specification (Anthropic-anchored)

**Title:** Close the §2.0 / §3.8 specification gap — define "the bar" formally, measurably, and reversibly
**Branch:** `docs/bar-specification-pr-meta-8`
**Base:** `main`
**Scope:** Docs-only PR. Adds four new sub-sections to `docs/MASTER_PLAN.md`:
- §2.0.1 — Formal definition of "the bar" (union of 5 enumerated sources)
- §2.0.2 — Measurement classification table (Mechanical vs Subjective per rule)
- §3.8.5 — Override mechanism for Subjective refusals
- §15 — Bar Revisions Log (separate update protocol for the bar itself)

**Why this PR exists:** §2.0 + §3.8 of MASTER_PLAN.md (merged in PR #340) codified the principle "the bar supersedes preference" and authorized the Lead Agent to refuse Haim's requests that lower quality. But the principle was incomplete — it never defined (a) WHAT the bar concretely IS, (b) HOW each item is measured, (c) WHAT Haim can do if he disagrees with a Subjective refusal, (d) HOW the bar itself can be updated over time. Without these four pieces, the refusal authority is unanchored — Claude can invent "bar concerns" in the moment and refuse without traceability. This PR closes that gap.

**Anchoring principle:** every addition is anchored to an explicit Anthropic publication (cited inline in the PR body and in MASTER_PLAN.md commentary). The bar specification follows industry patterns that Anthropic has explicitly endorsed:
- **§2.0.1 — explicit spec over implicit:** Anthropic Constitutional AI paper — "explicit constitutions dramatically outperform implicit guidance"
- **§2.0.2 — programmatic vs model-based grading:** Anthropic Evals documentation — "Prefer programmatic graders when possible; reserve model-based judgment for cases where the criterion cannot be automated"
- **§3.8.5 — human oversight points:** Anthropic "Building Effective Agents" — "Always provide an explicit override path with logging. Refusals without override become brittleness"
- **§15 — versioned specifications:** Anthropic "Multi-Agent Research System" post — "Treat your agent specifications as versioned artifacts. Every revision must have rationale, date, and rollback procedure"

## MUST criteria (block on FAIL)

### M1 — §2.0.1 exists with explicit 5-source union
**Rule:** New sub-section `§2.0.1 — What "the bar" is, formally` exists immediately after §2.0. It enumerates EXACTLY five sources:
1. The 7 PRODUCT-GRADE Gates (`@.claude/rubrics/_PRODUCT-GRADE-GATES.md`)
2. §2.1–§2.9 of MASTER_PLAN.md (Standard)
3. Engineering Bar (`@docs/ENGINEERING_BAR.md`)
4. Design Bar (`@docs/DESIGN_BAR.md`)
5. MUST criteria of the per-PR rubric in `.claude/rubrics/<pr-id>.md`

It explicitly states: "Anything outside these 5 sources is PREFERENCE, not bar. The Lead Agent may NOT refuse based on preference."
**Evidence required:** grep finds the §2.0.1 header. The 5 sources are listed with exact path references. The "preference is not refusal trigger" statement is verbatim.

### M2 — §2.0.2 measurement classification table exists
**Rule:** New sub-section `§2.0.2 — How each rule is measured` exists. It contains a table classifying every bar item as either:
- **Mechanical** — verifiable by test/lint/grep/AST (deterministic)
- **Subjective** — requires Claude judgment (non-deterministic)

The table covers EVERY G1-G7 item plus §2.1-§2.9 sub-rules (at minimum: error format checks, audit log presence, Hebrew text grep, TS strict mode, ESLint 0 errors, integration test existence, professional architecture judgment, customer-scenario judgment).
**Evidence required:** Table exists with ≥15 rows. Each row: bar item + classification + measurement method (e.g., "grep diff for stack traces", "Claude verdict on professionalism").

### M3 — §3.8.5 override mechanism exists
**Rule:** New sub-section `§3.8.5 — Override mechanism for Subjective refusals` exists after §3.8.4. It defines exactly two cases:
- **CASE A (Mechanical refusal):** No override. Haim must fix the failure first.
- **CASE B (Subjective refusal):** Haim may override with explicit text format. Override logged in PR body under "Subjective bar overrides" section.

It includes the exact override text format Haim should use, and states that the override creates an auditable trail.
**Evidence required:** Sub-section exists. Both cases defined. Override text format specified verbatim.

### M4 — §15 Bar Revisions Log exists
**Rule:** New top-level section `§15 — Bar Revisions Log` appended at the end of MASTER_PLAN.md (before any auto-trailing content). It defines:
- Updating the bar itself (adding/removing/modifying any rule in the 5 sources) requires EXPLICIT Haim approval — never implicit in a feature PR
- Bar changes ship as their OWN PR with their OWN rubric
- Each revision logged with: date | bar item | before | after | rationale
- Bar revisions apply FORWARD; existing PRs are grandfathered (not retroactively re-graded)

The section includes an empty log table ready for future entries.
**Evidence required:** Section exists with the protocol + empty log table. Header reads "Bar Revisions Log".

### M5 — Each addition cites its Anthropic anchor inline
**Rule:** Each of §2.0.1, §2.0.2, §3.8.5, §15 includes a one-line attribution to its Anthropic source (paper, blog post, or docs). The attribution links to the URL (anthropic.com).
**Evidence required:** Each new sub-section starts with a quote/attribution block that names the Anthropic publication.

### M6 — Plan Revisions log updated
**Rule:** Section 14 "Plan revisions" of MASTER_PLAN.md has a new entry dated 2026-05-29 documenting this addition. Entry follows the existing format: date + summary + reason.
**Evidence required:** New entry exists at the bottom of section 14 with the date and a clear summary of the four sub-sections added.

### M7 — No existing content modified
**Rule:** The PR is purely additive. No edits to §1–§14 EXCEPT (a) the new sub-sections added inline (§2.0.1, §2.0.2, §3.8.5), (b) the new top-level §15, (c) the new entry appended to §14. No other lines changed.
**Evidence required:** `git diff main..HEAD -- docs/MASTER_PLAN.md` shows only insertions, except a 1-line edit in §14 to add the new revision entry.

### M8 — CLAUDE.md not modified
**Rule:** This PR does NOT modify `CLAUDE.md`. The bar spec lives in MASTER_PLAN.md only; CLAUDE.md already imports it.
**Evidence required:** `git diff main..HEAD -- CLAUDE.md` returns empty.

## SHOULD criteria (warning on FAIL, doesn't block)

### S1 — Override mechanism includes concrete example
**Rule:** §3.8.5 includes at least one worked example of a CASE B override — e.g., a refusal scenario, the override text Haim would write, and how it would appear in the PR body. Helps future sessions calibrate.
**Evidence required:** Example block present in §3.8.5.

### S2 — Measurement table cross-references _PRODUCT-GRADE-GATES.md
**Rule:** §2.0.2 references the canonical gates file for each G1-G7 row, not re-stating the gate definition.
**Evidence required:** Each G-row in the table cites `@.claude/rubrics/_PRODUCT-GRADE-GATES.md`.

### S3 — Bar Revisions Log seeded with a baseline entry
**Rule:** §15 includes one seed entry dated 2026-05-29 documenting "the bar as of PR-META-8" — establishing the baseline that future revisions diverge from.
**Evidence required:** Seed entry exists.

## PRODUCT-GRADE GATES

- **G1** Customer-visible errors: **N/A** — docs-only, no runtime paths, no UI strings affected.
- **G2** Rollback: **PASS** — `git revert <merge-commit>` removes all four additions. Purely additive. Trivial.
- **G3** Monitoring: **N/A** — no data mutations.
- **G4** Customer-scenario test: **N/A** — no behavior to test. The "test" is reading the doc end-to-end and verifying the four additions meet M1-M8.
- **G5** Hebrew UI: **N/A** — internal planning doc, English (matches `MASTER_PLAN.md` baseline).
- **G6** Breaking change: **PASS** — no existing behavior changes. Pure addition. Existing rules unchanged. Pre-existing PRs grandfathered explicitly via §15.
- **G7** Security agent: **N/A** — no auth/PII/permissions/rules changes. The override mechanism is governance, not security.

## Out of scope

- Re-grading any merged PR against the new bar spec. Bar applies forward only (codified in M4).
- Migrating `ENGINEERING_BAR.md` / `DESIGN_BAR.md` to the new format. Separate PRs if needed.
- Updating individual rubrics (`.claude/rubrics/<pr-id>.md`) to align with §2.0.2 classification. The classification is a reference; rubrics can adopt it incrementally.
- Adding a "calibration loop" (periodic review of refusals). Premature — no refusal data yet.

## Rollback

```bash
git revert <merge-commit>
git push origin main
```

The four additions are inserted at well-defined anchor points. Reverting removes them cleanly. No data, no runtime, no users affected.

## Test plan

1. **Doc completeness:** read §2.0.1, §2.0.2, §3.8.5, §15 end-to-end. Verify each MUST criterion (M1-M8) is met.
2. **Cross-reference integrity:** every path reference in §2.0.1 resolves to an actual file (`@.claude/rubrics/_PRODUCT-GRADE-GATES.md`, `@docs/ENGINEERING_BAR.md`, `@docs/DESIGN_BAR.md`). Verify with `ls`.
3. **Diff cleanliness:** `git diff main..HEAD -- docs/MASTER_PLAN.md` shows insertions + one revision-log entry. No other changes.
4. **CLAUDE.md untouched:** `git diff main..HEAD -- CLAUDE.md` is empty.
5. **Anthropic anchor verification:** open one URL per addition (4 total) — verify the cited Anthropic publication exists and the cited principle is real.
6. **After merge — next session smoke:** in a new Claude Code session, ask "what is 'the bar' in this project?" — Lead Agent should cite §2.0.1 with the 5-source enumeration.

## Notes for grader

This PR is intentionally narrow. Its value is **enforceability of §2.0 + §3.8** — without the four additions, the refusal authority is unanchored. The most critical MUSTs are M1 (formal definition), M2 (measurement classification), and M3 (override mechanism). M4 (revisions log) is institutional protection against quiet bar drift over time. A grader who sees M1-M4 weakly addressed (e.g., vague enumeration, missing classification, no override path) must FAIL.

The four additions stand alone — they don't depend on each other, and each is independently revertible. A future session could remove just §3.8.5 (override) without breaking §2.0.1 (definition), should Haim later decide override is unnecessary.

This PR also serves as a template: subsequent PRs that change governance should follow the same pattern — explicit Anthropic anchor + Mechanical/Subjective classification + override path + revision log.
