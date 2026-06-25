# Rubric — FIX: OWN-2 `unresolved` silent under-count (the P0 from the independent audit)

**Title:** fix(functions): close the `unresolved` silent under-count — ledger truth must include unresolvable entries so the reconciliation owner/loop refuse to write
**Branch:** `fix/own-2-unresolved-undercount` → main (DEV)
**Files:** `functions/shared/package-repair-core.js` (the engine — `computeRepairedService`), `functions/tests/package-repair-core.test.js` (+2 tests), `functions/tests/reconcile-package-drift.test.js` (+1 end-to-end loop test). **Engine-only** — does NOT touch `reconcile-package-drift.js` (the file the parallel OWN-3 building session is editing) → zero merge collision.
**Scope:** The independent audit (38-agent, read-only) found ONE high-severity defect in the SHIPPED OWN-1/OWN-2 code: `assignEntriesForwardReplay` can leave entries `unresolved` (an overdrawn HOURS service past the −10h floor, no override — entries that cannot be attributed to any package). `computeRepairedService` computed `ledgerTruth = Σ assigned minutes` and `serviceAfter = Σ attributable` — BOTH excluded the unresolved minutes, so `invariantOk` was (wrongly) TRUE, and the OWN-2 loop reads `replay.unresolved` 0 times. Net: when the reconciliation flag is flipped to `enforce`, the owner would write `service.hoursUsed` LOWER than the true ledger total for an overdrawn service, **silently passing a clean invariant** — the exact silent-under-count class this whole initiative exists to eliminate, now produced by the owner itself. **This blocks any `enforce` rollout.**

**The fix (one place, engine):** `ledgerTruth` now = `Σ (assigned + unresolved) minutes / 60` = the TRUE total. So when entries are unresolved, `serviceAfter (Σ attributable) < ledgerTruth (true total)` → `invariantOk = FALSE`. The existing consumers then do the right thing WITHOUT any change: the OWN-2 loop already skips on `!invariantOk` (`reconcile-package-drift.js:104`, reason `invariant_failed`), and the OWN-1 owner already throws `invariant_violation` on `!invariantOk` (`service-writer.js:274`). The offline repair script (`repair-package-aggregates.js`) only REPORTS `invariantOk` (it does not gate its write on it) and already surfaces the unresolved tail for operator review — so its behavior is unchanged except its report is now honest.

## MUST criteria (block on FAIL)

### M1 — ledgerTruth includes unresolved; invariant flips FALSE on unresolved
**Rule:** `computeRepairedService` adds the `replay.unresolved` minutes into `ledgerTruth`, so a service with any unresolved entry has `serviceAfter < ledgerTruth` → `invariantOk === false`. **Evidence:** `package-repair-core.js` ledgerTruth computation (`unresolvedMinutes` summed in); test "UNDER-COUNT GUARD: unresolved entries push ledgerTruth above serviceAfter → invariantOk FALSE" (serviceAfter 11, ledgerTruth 12, unresolvedMinutes 60, invariantOk false).

### M2 — the consumers REFUSE the under-count (end-to-end), unchanged
**Rule:** the OWN-2 loop SKIPS such a service (`invariant_failed`) and the OWN-1 owner THROWS — both via the EXISTING `!invariantOk` checks (no consumer code changed). **Evidence:** test "REAL engine: overdrawn service with unresolved entries → skip(invariant_failed)" (the loop's `planServiceReconciliation` on the real engine); `service-writer.js:274` throw + `reconcile-package-drift.js:104` skip are preserved (diff does not touch them).

### M3 — no regression on the happy path; full suite green
**Rule:** a service with NO unresolved entries has `ledgerTruth`/`invariantOk` IDENTICAL to before (the drift-correction path is untouched). The offline script's WRITE behavior is unchanged (it never gated on `invariantOk`). **Evidence:** test "no unresolved → ledgerTruth unchanged, invariantOk TRUE"; every pre-existing `computeRepairedService` test (none use unresolved) still passes; full legacy-js suite 856/856 (52 suites). No `repair-aggregates.test.js` assertion changed.

### M4 — engine-only; observability surfaced; collision-free
**Rule:** the change is confined to `computeRepairedService` (+ its 2 test files); `reconcile-package-drift.js` is NOT modified (the parallel OWN-3 branch owns it). `unresolvedMinutes` is added to the return for the loop/script to surface a counter later. **Evidence:** `git diff --stat origin/main` = only `package-repair-core.js` + the 2 test files; the return object now carries `unresolvedMinutes`.

## SHOULD
- **S1** — devils-advocate review — MANDATORY (a change to a financial-calculation invariant on a live-PROD shared module consumed by the owner, the loop, and the offline repair). Verdict cited in the PR body.
- **S2** — coordinate: this lands on main FIRST as the `enforce` prerequisite; the OWN-3 building branch must rebase onto the new main (different file → clean). The follow-up observability (loop reads `unresolvedMinutes` → a dedicated `unresolved`/skip counter) is the OWN-3 building session's to add.

## Out of scope (deferred — declared)
- The loop surfacing a dedicated `unresolved` counter / distinct skip reason — belongs to the OWN-3 building session (it owns `reconcile-package-drift.js`); the return now exposes `unresolvedMinutes` for it.
- The offline script gating its write on `invariantOk` — it is supervised + already surfaces unresolved; out of scope here.
- The other audit findings (legal-stage orphan, the mode-flag I/O tests, the emulator test, the doc-precision/OWN-3-decision items) — separate, lower-severity, for the building session.

## Rollback (G2)
Pure `git revert <merge-commit>` + redeploy. Engine-only logic change, additive `unresolvedMinutes` return field, no CF add/delete, no secret, no schema, no migration. Reverting restores the prior (buggy-but-currently-harmless-because-enforce-is-off) behavior.

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — no customer-facing strings; the engine returns data + the existing consumers throw internal codes.
- **G2 (rollback):** PASS — pure `git revert` (engine-only, no CF/secret/migration).
- **G3 (monitoring):** N/A — this PR PREVENTS a bad write; it adds no new write path. The reconciliation flag is still `off` by default, so nothing executes live. The added `unresolvedMinutes` return field is the observability hook the loop will use.
- **G4 (test proves scenario):** PASS — the exact customer scenario (an overdrawn service whose entries can't be fully attributed) is exercised through the REAL engine at both the unit level (invariant flips false) and the loop level (the reconciliation refuses to write the under-count). 3 new tests; 856/856.
- **G5 (Hebrew UI):** N/A — backend only.
- **G6 (breaking change):** N/A — the return GAINS a field (`unresolvedMinutes`) — additive; `ledgerTruth`/`invariantOk` semantics are CORRECTED for the unresolved case only (previously a latent bug, harmless while `enforce` is off). No schema/route/contract break; the happy path is byte-identical.
- **G7 (security):** N/A — no auth/permissions/rules/PII. (devils-advocate run anyway — MANDATORY for the invariant change.)

## Notes for grader
- Why the bug was missed by the per-PR self-review: it spans three regions — the engine PRODUCES unresolved, the engine's invariant EXCLUDED it (so OWN-1's self-review saw a clean invariant), and the live consumer IGNORES `replay.unresolved` (OWN-2). Each PR passed its own rubric; only a cross-module pass caught it. The offline script (`repair-package-aggregates.js:698`) already warns on unresolved — the live path dropped it silently. This fix aligns the live path with the offline script's honesty.
- The fix deliberately lives in the engine (not the loop) so it is collision-free with the parallel OWN-3 building session AND is defense-in-depth (both the owner and the loop refuse, via their existing `!invariantOk` checks).
