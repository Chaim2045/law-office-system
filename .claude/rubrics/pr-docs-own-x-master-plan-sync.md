# Rubric — DOCS: §14 Plan-Revision sync for the OWN-x single-owner aggregate redesign

**Title:** docs(master-plan): §14 sync — OWN-x single-owner aggregate redesign (parallel data-integrity track)
**Branch:** `docs/own-x-master-plan-sync` → main (DEV)
**Files:** `docs/MASTER_PLAN.md` (+1 §14 entry), `.claude/rubrics/pr-docs-own-x-master-plan-sync.md` (this file).
**Type:** Docs-only. App: Full System (doc). Environment: DEV. No code, no behavior, no schema, no rule, no CF.

**Scope:** Append ONE §14 Plan-revision entry documenting the OWN-x track (OWN-0 #398 / OWN-1 #399 / OWN-2 #400 / OWN-3 backend #401 / the P0 fix #402) as a parallel data-integrity track that does NOT change the `H.5→H.9` MVP focus. Mirrors the precedent of the 2026-06-18 security-hardening §14 entry (a parallel-track sync). Authorized by §11 rule 3 (cross-phase/material plan change documented under "Plan revisions") + Haim's explicit approval ("אוקיי אני מאשר", 2026-06-25).

## MUST criteria

### M1 — accurate, code-grounded, no over-claim
**Rule:** every PR#/commit/state in the entry matches reality (OWN-0/1/2/#401 merged+live; #402 merged; frontend pending; flag default OFF). **Evidence:** the PR numbers + the "flag default OFF / harmless-in-prod" framing match the merged code + `gh pr view` state verified this session.

### M2 — correctly classified §14 (plan), NOT §15 (bar)
**Rule:** the entry is a Plan revision (scope/track documentation), not a Bar revision — it changes no acceptance-criteria source from §2.0.1. **Evidence:** the entry self-declares "NOT a §15 bar revision"; mirrors the 2026-06-18 precedent's classification.

### M3 — additive, no existing content altered
**Rule:** only an append; no prior §14 entry / decision row / section edited. **Evidence:** `git diff` = one added bullet at the §14 tail + this rubric; zero deletions/modifications of existing lines.

## SHOULD
- **S1** — keeps `H.5→H.9` framed as the primary focus (the data-integrity track is explicitly orthogonal). Met.

## Out of scope (deferred)
- The OWN-3 frontend page, the supervised `dry_run→enforce` promotion, OWN-4, and the design-doc §5 fix — tracked in the Lead-Agent memory, not this docs PR.

## Rollback (G2)
Pure `git revert <merge-commit>` + (no redeploy — docs only). Restores the prior §14 tail.

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — docs-only, no customer-facing code path.
- **G2 (rollback):** PASS — pure `git revert`, no deploy.
- **G3 (monitoring):** N/A — no data mutation.
- **G4 (test proves scenario):** N/A — documentation, no executable behavior.
- **G5 (Hebrew UI):** N/A — internal planning doc (English, with quoted Hebrew); not a customer surface.
- **G6 (breaking change):** N/A — additive doc entry; no schema/route/contract.
- **G7 (security):** N/A — no auth/permissions/rules/PII (no PII in the entry).

## VERDICT: PASS
Docs-only §14 sync, additive, accurate, correctly classified, Haim-approved. All gates N/A or PASS.
