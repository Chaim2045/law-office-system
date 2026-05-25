# Rubric — PR-META-3: PRODUCT-GRADE quality gates infrastructure

**Scope:** infrastructure-only. Define 7 commercial-grade gates as global rubric extension. Wire into outcomes-grader + pre-PR hook + CLAUDE.md so EVERY new chat session knows the standard. No application code changes.

**Origin:** Tommy 2026-05-25 — system being prepared for commercial sale. Internal-tool standards (manual smoke, "we'll add monitoring later", English error messages) won't survive a paying customer. Need standard enforced in every agent session, not just remembered.

**Inspiration:** [Anthropic Claude Code Auto Mode](https://www.anthropic.com/engineering/claude-code-auto-mode) (2026-03) — two-layer safety classifier pattern. Our implementation: hooks (layer 1) + grader gates (layer 2).

## MUST (7) — blocking

1. **`.claude/rubrics/_PRODUCT-GRADE-GATES.md` created.** Documents all 7 gates (G1-G7) with: question, criteria, required content, verifiable check. *Evidence:* file exists at exact path; contains all 7 gate sections.

2. **CLAUDE.md `PRODUCT-GRADE RULE` section added.** Lists 7 gates by ID + 1-line description. References full spec file. References Anthropic Auto Mode inspiration. *Evidence:* `grep -E "PRODUCT-GRADE RULE|G[1-7] —" CLAUDE.md` finds the section + all 7 gate references.

3. **`outcomes-grader.md` agent spec updated.** Adds step 3.5 (evaluate gates), updates step 4 verdict rules (any Gate FAIL = overall FAIL), adds PRODUCT-GRADE Gates table to output template. *Evidence:* spec file contains "_PRODUCT-GRADE-GATES.md" reference + step 3.5 + Gates table.

4. **`require-outcomes-pass.sh` hook extended.** Adds Check 3 (PR body has PRODUCT-GRADE GATES section) + Check 4 (no gate marked FAIL). Uses regex on command string (same approach as existing VERDICT check). *Evidence:* hook script contains new checks; tested against synthetic PR body inputs.

5. **All 7 gates are specific + verifiable.** Not "be professional" but "no stack traces in customer-facing strings". Each gate names what to grep / what to check. *Evidence:* read each gate in `_PRODUCT-GRADE-GATES.md` — confirm "Verifiable:" sub-section explains how grader checks it.

6. **This PR's own body demonstrates compliance.** PR body includes `PRODUCT-GRADE GATES` section with G1-G7 statuses. Since this is infra-only, most will be N/A — but the SECTION must exist + each gate evaluated. *Evidence:* PR body grep.

7. **Hook tested locally with synthetic input.** Verified that: (a) hook blocks PR body missing PRODUCT-GRADE GATES section, (b) hook blocks when any gate is FAIL, (c) hook allows when all PASS / N/A. *Evidence:* test command shown in PR body.

## SHOULD (3) — non-blocking

1. **Gates inspired by but tailored to project.** Not a generic checklist — references Hebrew language, IL TZ, Firebase, WhatsApp bot specifics where relevant. *Evidence:* G1 mentions Hebrew error text; G5 mentions Hebrew customer-facing; G7 mentions Firebase auth + WhatsApp signature.

2. **Migration guidance for existing PRs.** Brief note in CLAUDE.md or `_PRODUCT-GRADE-GATES.md` explaining that PRs opened BEFORE this rule was added are grandfathered (rule applies to new PRs). *Evidence:* note present.

3. **Reference to Anthropic Auto Mode pattern documented.** So future maintainers understand the architectural inspiration + can switch to native Auto Mode if/when team plan adopted. *Evidence:* link to Anthropic engineering blog in CLAUDE.md + in `_PRODUCT-GRADE-GATES.md`.

## Out of scope (deferred)

- Native Anthropic Auto Mode integration (requires Team plan; future migration when adopted)
- Statusline reminder showing `[PRODUCT-GRADE MODE]` (cosmetic — not enforced)
- Auto-fix for common gate violations (separate PR — first establish, then automate)
- Backfilling gates onto already-merged PRs (sunk cost — apply going forward)

## Test outputs required

- No code/test changes — infrastructure-only PR
- Lint: 0 errors (no JS/TS changes)
- Hook test: synthetic PR body inputs verified:
  - Missing GATES section → DENY
  - GATES section with all PASS/N/A → ALLOW
  - GATES section with any FAIL → DENY
  - GATES section missing G3 → DENY (incomplete coverage)

## PRODUCT-GRADE GATES self-evaluation

| Gate | Status | Justification |
|------|--------|---------------|
| G1 Customer-visible errors | N/A | Infrastructure-only — no customer-facing code paths |
| G2 Rollback path | PASS | `git revert <commit>` reverts hook + grader + CLAUDE.md changes. No data, no migration. |
| G3 Monitoring touched if data-mutating | N/A | No data writes |
| G4 Test proves customer scenario | PASS | Hook tested with synthetic inputs (Test outputs section); behavior verified |
| G5 Hebrew customer-facing text | N/A | No UI strings touched |
| G6 No breaking change without migration | PASS | New gates apply going forward; existing merged PRs grandfathered (documented) |
| G7 Security agent reviewed | N/A | No PII / auth / permissions touched |
