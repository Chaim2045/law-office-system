# Rubric — DOCS: sync SINGLE-OWNER-AGGREGATE-DESIGN.md to executed reality + commit it

**Title:** docs(design): sync the single-owner design doc to executed reality (re-scope + #402 + dry_run-live) + commit it
**Branch:** `docs/own-3-design-doc-sync` → main (DEV)
**Files:** `docs/SINGLE-OWNER-AGGREGATE-DESIGN.md` (now committed for the first time, with sync edits), `.claude/rubrics/pr-docs-own-3-design-doc-sync.md` (this file).
**Type:** Docs-only. App: Full System (planning doc). Environment: DEV. No code, no behavior, no schema, no rule, no CF.

**Scope:** The design doc was untracked + written BEFORE execution; its v1 body (§0/§4/§5 "Σ by packageId", §7 "open decisions", §8 "OWN-3 = reroute the 11 sites", line 3 "no code yet") drifted from what shipped. This PR (a) commits the doc, and (b) syncs it via the **SUPERSEDED-marker + reality-block discipline** (the same trail-preserving method as the doc's own BC-1..BC-5) — NOT a from-scratch rewrite. Authorized by §11 rule 3 + the examiner-session sync-brief (Haim-relayed, 2026-06-28: "אתה מאושר להמשיך עם #23") with 8 explicit line-edits.

## MUST criteria

### M1 — every stale v1 claim is marked SUPERSEDED, none silently rewritten
**Rule:** each of §0/§4/§5 "Σ by packageId", §5 "11 call-sites become callers", line-3 status, §7 title, §8 "OWN-3 = reroute" carries an explicit `SUPERSEDED`/`DECIDED`/`RE-SCOPED` marker pointing to BC-1 or the re-scope — the original line is PRESERVED (audit trail), not deleted. **Evidence:** 6 `SUPERSEDED` + 6 `DECIDED` markers; line count 296→335 (additive only); the raw Σ-by-packageId lines (57/164/197) each sit next to a SUPERSEDED note.

### M2 — the EXECUTION REALITY block is accurate (PR#s + state verified)
**Rule:** the new top block states the true current state: OWN-0 #398 / OWN-1 #399 / OWN-2 #400 / admin-backend #401 / P0 #402 all merged; #403 open; **dry_run LIVE + clean 2026-06-28** (the exact counters from the examiner's run: clientsScanned=140, servicesScanned=191, wouldRepair=0, failed=0, invariantFailures=0); OWN-4 deferred. **Evidence:** PR#s cross-checked via `gh pr view` this session; the dry_run counters are quoted verbatim from the sync-brief.

### M3 — the OWN-3 re-scope is documented as a Haim-approved divergence, reroute correctly DEFERRED
**Rule:** the doc states "single owner = OWN-1 owner + OWN-2 in enforce as owner-of-record"; the literal reroute = Option B DEFERRED; and `addPackageToService` + provisioning + legal-stage repair are OUT-OF-SCOPE BY DESIGN (re-detonates PR #174), not "not yet done". **Evidence:** the EXECUTION REALITY block + §7 D3 + §8 OUT-OF-SCOPE note.

### M4 — load-bearing invariants restated so a future rewrite can't drop them
**Rule:** forward-replay (not Σ-by-packageId) · fail-safe default OFF · never-auto-block · invariant fail-closed · H.3 fully decoupled · intake fields read-only · owner = sole backend writer. **Evidence:** the "Load-bearing invariants that must never regress" line in the reality block; §5.5 strengthened-by-#402 note.

## SHOULD
- **S1** — story-consistency with #403 (§14) and the Lead-Agent memory: same PR#s, same dry_run-live fact. (#403 §14 to be updated to mention dry_run-live in the same push-cycle.)

## Out of scope (deferred)
- The OWN-3 frontend page, the `dry_run→enforce` promotion, OWN-4 — tracked separately.

## Rollback (G2)
Pure `git revert <merge-commit>` (no redeploy — docs only). Reverting un-commits the doc + the sync edits.

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — docs-only, no customer code path.
- **G2 (rollback):** PASS — pure `git revert`, no deploy.
- **G3 (monitoring):** N/A — no data mutation (the doc DESCRIBES the gated loop; it changes nothing).
- **G4 (test proves scenario):** N/A — documentation, no executable behavior.
- **G5 (Hebrew UI):** N/A — internal planning doc, not a customer surface.
- **G6 (breaking change):** N/A — additive doc sync; no schema/route/contract.
- **G7 (security):** N/A — no auth/permissions/rules/PII (no PII in the doc; the dry_run counters are aggregate non-PII).

## VERDICT: PASS
Docs-only sync via the trail-preserving SUPERSEDED discipline; additive (296→335, zero deletions of v1 reasoning); accurate (PR#s + dry_run counters verified); Haim-approved with explicit 8-edit spec. All gates N/A or PASS. (Self-graded — docs-only change of pre-approved, examiner-specified edits; same posture as #403.)
