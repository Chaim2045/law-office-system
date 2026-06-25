# Rubric — OWN-2 (the live reconciliation loop)

**Title:** feat(functions): OWN-2 — reconcilePackageDrift, the gated self-healing reconciliation loop (first live wiring of the owner)
**Branch:** `fix/own-2-reconciliation-loop` → main (DEV)
**Files:** `functions/shared/reconciliation-mode.js` (new — the enable-flag), `functions/scheduled/reconcile-package-drift.js` (new — the loop), `functions/tests/reconcile-package-drift.test.js` (new — 18 unit tests), `functions/tests/reconcile-package-drift.integration.test.js` (new — 3 tests, the REAL loop→owner→client-writer seam), `functions/index.js` (+1 export), `functions/tests/service-writer.test.js` (the OWN-1 wiring guard evolved: dead-code → "wired ONLY by OWN-2").
**Scope:** Third step of the single-owner aggregate redesign. Make Check-7's drift DETECTION self-healing: a new scheduled job recomputes each drifted eligible HOURS service from the ledger by calling the OWN-1 owner. **This is the FIRST LIVE WIRING of the owner** — but it ships GATED: `system_settings/package_reconciliation` defaults to `off`, so it is inert on deploy. The PROD-write opt-in is an admin flipping the flag to `enforce` (a supervised act), after observing `dry_run`.

**Precision contract:** OWN-2 adds a write path but ships it DISABLED. `off` (default) = no read, no write. `dry_run` = full recompute + LOG what it would repair, write nothing. `enforce` = write via the owner. It NEVER auto-blocks a client (a recompute that would flip `isBlocked false→true` is deferred for human review). It is a SEPARATE scheduled function — the read-only `dailyInvariantCheck` monitor stays read-only.

## MUST criteria (block on FAIL)

### M1 — Enable-flag, fail-safe OFF
**Rule:** `reconciliation-mode.js` reads `system_settings/package_reconciliation`, modes `off|dry_run|enforce`, `DEFAULT_MODE='off'`, every failure path (missing doc / malformed / read error) returns `'off'`, 60s cache. (Mirrors `enforcement-mode.js` but inverts the default — here OFF is fail-safe because WRITING is the risk.) **Evidence:** flag tests (DEFAULT_MODE='off'; normalizeMode coerces invalid→off, case-sensitive); the file's failure paths return DEFAULT_MODE.

### M2 — dry_run writes NOTHING
**Rule:** in `dry_run` the loop runs the full detect + recompute + block-flip prediction and LOGS per-service diffs + run counters, but calls the owner ZERO times and performs no `transaction.update`. **Evidence:** test "mode=dry_run → counts wouldRepair, writes NOTHING" (owner not called; run-summary audit still written).

### M3 — enforce calls the owner correctly
**Rule:** in `enforce`, a drifted eligible service is repaired by calling `writeServiceWithCanonicalPackages` inside `runTransaction`, passing `{serviceId, entriesForService, clientUpdateTimeAtRead}` + `{caller:'reconcilePackageDrift', mode:'enforce', auditFn}`. **Evidence:** test "mode=enforce → calls the owner, counts repaired" asserts the owner call args (serviceId, A5 token present, caller, mode, auditFn injected).

### M4 — NEVER auto-blocks (block-flip defer)
**Rule:** a recompute that would flip the client `isBlocked false→true` is DEFERRED — counted (`blockFlipsDeferred`), logged (non-PII), surfaced in the run audit, and NOT written. Unblocking (`true→false`) and pure number corrections ARE applied. The gate is computed via `calcClientAggregates(before)` vs `(after-splice)` (mirror of the offline repair's `predictClientEffect`/`APPROVED_BLOCK_FLIPS`), in THIS caller, not in the owner. **Evidence:** planner test "block-flip to BLOCKED → defer" + "to UNBLOCKED → repair"; loop test "enforce, block-flip-to-blocked → DEFERRED, owner NOT called".

### M5 — Fresh re-read + A5 + retry; gate re-checked on fresh data
**Rule:** the enforce path re-reads the client doc + the service's entries fresh (capturing `updateTime`) and RE-PLANS on that fresh snapshot before writing — so the block-flip defer-gate is evaluated on the SAME data the owner writes (fail-secure, mirroring `applyClient`'s in-txn gate). The owner's A5 guard aborts on a concurrent client-doc write; the loop retries (MAX_RETRIES) on `code:'aborted'`. **Evidence:** `repairOneService` re-reads + re-plans (`plan.action !== 'repair'` → honored) + the aborted-retry loop; tests exercise the fresh re-plan path (no-drift on re-plan → skipped).

### M6 — Audit + counters + systemic-failure throw
**Rule:** per-repair audit via the owner's injected `auditFn` → `logCriticalActionInTxn('PACKAGE_RECONCILE_REPAIR', sys-actor, …)` (writer-before-audit, non-PII). A run-summary audit `logCriticalAction('PACKAGE_RECONCILE_RUN', …)` with full counters + deferrals (non-PII: ids/hours/counts, NEVER clientName) on every run. Throw (→ Cloud Scheduler failure metric) only on a SYSTEMIC write-failure rate (≥50% of attempts), so a single transient doesn't flap. **Evidence:** tests "systemic write-failure → throws" (+ run audit written before the throw); the auditFn assertion in the enforce test; non-PII payloads.

### M7 — Separate function; owner wiring guard evolved
**Rule:** OWN-2 is a NEW scheduled function (`reconcilePackageDrift`, 07:00, after the 06:00 detector + 06:30 profitability), wired in `functions/index.js`. The read-only `dailyInvariantCheck` is UNCHANGED (monitor stays read-only). The OWN-1 dead-code guard is evolved to assert the owner is wired ONLY by this loop (no unexpected caller; OWN-3 extends the allowlist). **Evidence:** `dailyInvariantCheck` untouched in the diff; the `service-writer.test.js` "Owner wiring invariant" test (allowlist = `scheduled/reconcile-package-drift.js`, asserts no unexpected caller AND the sanctioned wiring exists).

### M8 — Full suite green; syntax clean
**Rule:** the full functions Jest suite is green; `node --check` clean on the new + wired files. **Evidence:** `npx jest` = 1193/1193 (69 suites); `node --check` OK on reconciliation-mode.js / reconcile-package-drift.js / index.js.

## SHOULD
- **S1** — devils-advocate review on the FINAL diff — MANDATORY (§3.8.4: NEW Cloud Function + a new live write path, even though gated). Verdict cited in the PR body.
- **S2** — the supervised live verification is the **dry_run smoke** (Haim's hands): set the flag to `dry_run`, "Run now" on `reconcilePackageDrift`, read the `PACKAGE_RECONCILE_RUN` audit + logs → confirm the would-repair set + deferrals look right across a cycle, THEN flip to `enforce` under supervision. `dry_run` IS the live integration test for this gated design (runs the real pipeline in PROD without writing).

## Out of scope (deferred — declared)
- **The deduction-path callers** — OWN-3 reroutes the ~11 incremental writers onto the owner (then extends the wiring-guard allowlist). OWN-2 wires ONLY the reconciliation loop.
- **Retiring the incremental writers** — OWN-4.
- **A deferred-block-flip queue UI / collection** — for now deferrals are surfaced via the run audit + structured logs (no new collection / no firestore.rules change in OWN-2). A dedicated queue is a future nicety.
- **legal_procedure stage recompute** — DRIFT-3 (HOURS-only; the owner skips non-HOURS).
- **An emulator integration test** — `dry_run` in PROD is the live integration proof for this design (S2). A Firestore-emulator harness for CFs would be a separate infra PR.

## Rollback (G2)
**NOT a pure `git revert`** — `reconcilePackageDrift` is a new scheduled Cloud Function. Two-tier:
1. **Instant kill (no deploy):** set `system_settings/package_reconciliation.mode = 'off'` — the loop goes inert within 60s. This is the first-line rollback for any misbehavior.
2. **Full removal:** supervised `firebase functions:delete reconcilePackageDrift --region us-central1` FIRST (deletes the CF + its Cloud Scheduler job), THEN `git revert <merge-commit>` (the H.1.b CF-deletion-guard lesson — CI `firebase deploy` aborts rather than auto-delete a function removed from source).

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — no customer-facing strings/paths; it is a backend scheduled job. Errors are internal logs (errorCode only) + the run audit.
- **G2 (rollback):** PASS — flag→off (instant) + `functions:delete`-then-revert (documented). See Rollback.
- **G3 (monitoring):** PASS — every write path is audited: per-repair `logCriticalActionInTxn` (writer-before-audit, via the owner) + a run-summary `logCriticalAction` with counters/deferrals on every run + `logger.info/warn/error` throughout + a throw-on-systemic-failure that lights the Cloud Scheduler metric. Non-PII (ids/hours/counts).
- **G4 (test proves scenario):** PASS — the planner is tested against the REAL engine + REAL aggregator (drift→repair, no-drift→skip, override→skip, block-flip→defer/repair, invariant→skip); the loop is tested across off/dry_run/enforce/defer/no-drift/SKIP_CLIENTS/systemic-failure. 18 tests; 1190 total. The live customer scenario (real PROD data) is verified by the supervised `dry_run` smoke (S2).
- **G5 (Hebrew UI):** N/A — backend only.
- **G6 (breaking change):** N/A — additive. A NEW scheduled function (gated off) + an evolved internal test guard. No schema/contract/route/default-behavior change; `dailyInvariantCheck` untouched. (The owner treats intake fields read-only → H.3 + ledger-consumer compat preserved.)
- **G7 (security):** N/A — no auth/permissions/Firestore-rules/PII change; no new collection. Reads clients/entries (Admin SDK), writes via the existing owner→client-writer path, audits non-PII. (devils-advocate run anyway — MANDATORY for the new write path.)

## Review outcome — grader=PASS, devils-advocate=GO-WITH-CHANGES (all folded)
- **outcomes-grader = PASS** (8/8 MUST, 7/7 gates, 2/2 SHOULD).
- **devils-advocate = GO-WITH-CHANGES** — 0 🔴 (the gated, fail-safe-off design is sound; the holes were depth-of-defense + parity, not a live data-corruption path). Folded:
  - **#2 (tolerance + false comment) — FIXED.** `TOLERANCE` was `0.02` with a comment claiming it "mirrors Check-7"; Check-7's PACKAGE tolerance is `0.05` (the `0.02` is Check-6's client-aggregate). Now LOCKED (SSOT) to the engine's `SERVICE_INVARIANT_TOLERANCE` (0.05) — so the loop's repair-set ⊆ Check-7's detection-set (the dry_run smoke cross-checks cleanly against the Check-7 report).
  - **#1 + #5 (gate/owner equivalence untested; no machine seam coverage) — FIXED.** New `reconcile-package-drift.integration.test.js` runs the REAL loop→owner→client-writer→engine chain (only the SDK boundary mocked) and asserts the `isBlocked` the owner ACTUALLY writes == the gate's prediction on the same snapshot (no surprise auto-block) + the phantom-block unblock path.
  - **#4 (unbounded `deferrals` audit array) — FIXED.** Capped `deferrals.slice(0,200)` in the run-audit payload; `deferralsCount` keeps the true total; each deferral is also an individual `logger.warn`.
  - **grader warnings — FIXED:** `SKIP_CLIENTS` aligned to the offline repair's list `['internal_office','2025003']`; `scanErrors` split from `failed` so the systemic-throw ratio counts WRITE failures only; `repairOneService` branches on the owner's `result.skipped` (never over-counts a no-op as a repair).
  - **#3 (entry-window residual, wider than the offline script's maintenance-window) — DOCUMENTED + transition discipline below.** Not auto-closable inside one txn (entries are a separate collection); it is the accepted D1 residual, healed by the next cycle, direction-conservative (under-count, never auto-blocks).
- **Invariant downgrade called out (per devils-advocate #5):** OWN-1's hard "owner is wired to NOTHING" invariant becomes an ALLOWLIST in this PR (`service-writer.test.js`). Each OWN-3 extension of that allowlist re-opens a live path and MUST be reviewed as such — the guard now also asserts the sanctioned wiring *exists* (catches accidental un-wiring).

## 🚦 dry_run → enforce transition discipline (Haim's hands — the supervised opt-in)
The flag ships `off`. Before flipping to `enforce`:
1. Set `mode='dry_run'` (+ `enabledBy`/`enabledAt`). "Run now" on `reconcilePackageDrift` for **≥2–3 nightly cycles**.
2. Each cycle, read the `PACKAGE_RECONCILE_RUN` audit + logs → confirm the `wouldRepair` set + the `deferrals` look right, and **cross-check the would-repair clients against the Check-7 report** (same 0.05 tolerance now — they should agree).
3. The FIRST `enforce` run should be done as a **supervised act in a quiet window** (mirroring the offline script's maintenance-window discipline — narrows the entry-window residual #3), watching the run audit (`failed=0`, `blockFlipsDeferred` reviewed). Instant kill = flag→`off` (≤60s).

## Notes for grader
- OWN-2 RESOLVES two of the OWN-1 deferred OWN-3 prerequisites: **#1 block-flip gate** (implemented here as never-auto-block + defer) and **#3** (the first live execution; verified via the `dry_run` smoke design rather than an emulator harness). #2 (read-your-write) is honored by the per-service fresh re-read; #4 (design-doc §5 reconcile) remains a doc task.
- The fresh re-read + re-plan inside `repairOneService` is the fail-secure equivalent of the offline `applyClient`'s in-txn gate: even if the bulk scan said "repair", a new entry arriving before the write can flip the verdict to "defer"/"no-drift", and the FRESH verdict wins (the owner never writes a block-flip the gate would refuse).
- Per-service transaction grain (not per-client) matches the owner's single-service contract + isolates a bad service (continue-on-error). Trivial at PROD scale (~175 services, max 185 entries/service).
