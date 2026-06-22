# Rubric — PR-DRIFT-2 (+ DRIFT-0)

**Title:** fix(functions): repair package-level drift (forward-replay) + addTimeToTask fresh-only stamp (PR-DRIFT-2/0)
**Branch:** audit/package-drift-fix → main (DEV)
**Files:** `functions/shared/package-repair-core.js` (NEW pure), `functions/scripts/repair-package-aggregates.js` (NEW supervised script), `functions/addTimeToTask_v2.js` (DRIFT-0 fresh-only stamp), `functions/tests/package-repair-core.test.js` + `functions/tests/addtimetotask-packageid-stamp.test.js` (NEW), `docs/PR-DRIFT-2-DESIGN.md` (the locked design).
**Scope:** Repair the 76 drifted packages + 613 historical orphan entries (net +874h over-count) so each `package.hoursUsed == Σ(entries by packageId)` and `service.hoursUsed == ledger truth`, via FORWARD-REPLAY (NOT FIFO-reconstruction). Stamp orphans → defuses the `addPackageToService` detonator. DRIFT-0 stops the one active leak (`addTimeToTask` fresh-only). **The repair is a SUPERVISED script (dry-run default, `--apply` = Haim's hands, off-hours), NOT a deployed CF.** The PR merges the code (no new CF deploy); the migration runs later, supervised.

**Precision contract:** totals (service→client→billing) become EXACTLY the ledger truth; per-package historical attribution is a current-logic-correct forward-replay (defensible, not bit-exact-historical — billing is service-grain).

## MUST criteria (block on FAIL)

### M1 — Forward-replay (NOT FIFO-reconstruction)
**Rule:** `assignEntriesForwardReplay` sorts entries createdAt ASC, restricts candidates to packages with `purchaseDate <= entry.createdAt` (time-aware), picks via the `getActivePackage`-equivalent (fresh-first by purchaseDate where running-remaining>0; else -10h fallback), emits per-entry `basis ∈ {replay,single_active,pre_package}` and `unresolved` (never auto-assigned). Mirrors `deduction-logic.js getActivePackage` priority. **Evidence:** core + tests (time-correctness, pre_package, unresolved, fresh-first).

### M2 — Service invariant + seeded-phantom reversal
**Rule:** `computeRepairedService` sets each `package.hoursUsed = round2(Σ assigned/60)`, `service.hoursUsed = Σ packages.hoursUsed`; seeded-phantom (hoursUsed>0, 0 entries) → 0; tolerance 0.05 (unify Check 7). **Evidence:** core + tests (phantom→0, invariantOk, status derivation).

### M3 — Eligibility = reconcile only safe services (devils-advocate 2-E)
**Rule:** `isEligibleService` includes ONLY `type===HOURS && !archived && packages.length>0 && !overrideActive && !overdraftResolved.isResolved`; everything else SKIPPED + reason flagged. **Evidence:** core + tests (override/archived/no-packages skipped).

### M4 — Block-flip surfacing + per-client approval (devils-advocate 2-D)
**Rule:** the script computes before/after `isBlocked`/`isCritical`/`plan` (via the SAME `calcClientAggregates`+`computeClientPlan` the writer uses) and `--apply` REFUSES any client whose `isBlocked` flips unless its id is in `--approve-block-flips`. **Evidence:** `predictClientEffect` + the `refused_block_flip` gate.

### M5 — In-txn rebuild (devils-advocate 2-G)
**Rule:** `--apply` re-reads the client INSIDE the transaction and REBUILDS `servicesAfter` from the txn-read services (never writes a snapshot built from a pre-txn read); retry-on-`aborted` with fresh read. **Evidence:** the `runTransaction` block rebuilds `txnPlan` from `doc.data()`.

### M6 — Stamp safety + trigger no-op (devils-advocate 2-C/X-2)
**Rule:** orphan entries get `packageId` + `repairStampedAt` + `repairRunId` (batched ≤450, conditional `if (!entry.packageId)`). A packageId-only UPDATE is a trigger zero-delta no-op — PINNED by a regression test. **Evidence:** the stamp loop + a trigger-no-op test.

### M7 — Inverse rollback + backup (G2, devils-advocate 2-H)
**Rule:** durable gitignored JSON backup (services-before + isBlocked-before + per-stamped-entry) BEFORE any `--apply` write; `--rollback <file> --apply` restores services-before (canonical writer) + un-stamps entries conditionally (`packageId == repaired && repairRunId == run`). **Evidence:** backup write + `rollback()`.

### M8 — Audit-FIRST, no PII
**Rule:** `logCriticalAction('REPAIR_PACKAGE_AGGREGATES', 'sys:repair-package-aggregates', {ids/counts/hours})` BEFORE each client mutation; NO client names / employee emails / PII in logs/audit/backup. **Evidence:** the audit call + grep diff for PII.

### M9 — DRIFT-0 fresh-only stamp
**Rule:** `addTimeToTask_v2.js` stamps the entry with the FRESH-resolved package id (`getActivePackage(svc, allowOverdraft=false)`), `null` on depleted/overdraft fallback; HOURS-only (non-HOURS keep today's `serviceIds.packageId`). **Evidence:** `resolveFreshStampPackageId` + 3 tests (fresh→stamped, depleted→null, non-HOURS→unchanged).

### M10 — Pure core + tests green, no regression
**Rule:** the core is pure (no Firestore/Date.now/Math.random); `package-repair-core.test.js` + `addtimetotask-packageid-stamp.test.js` green; the full legacy-js suite unchanged-green; `node --check` clean on all 3 source files. **Evidence:** Jest output (37 new pass) + full-suite run.

## SHOULD
- **S1** — run `--apply` in a maintenance window / off-hours (entries are dormant; minimizes the residual concurrent-write window the in-txn rebuild already mitigates).
- **S2** — review the dry-run report's `blockFlip` + `phantomReversalsOver20h` + `unresolved` lists with Haim BEFORE `--apply`.
- **S3** — after `--apply`, the next Check 7 cron run reports clean for the repaired clients.

## Out of scope (deferred)
- legal_procedure STAGE packages → PR-DRIFT-3 (their ids ARE catalogued so they're not mis-flagged, but not drift-checked/repaired here).
- `log_only` flip (PR-B.12.1) — orthogonal (client-level invariant; keep ON through the repair window, flip OFF after).
- The report-filter symptom → PR-REPORT-1.

## Rollback (G2)
`node scripts/repair-package-aggregates.js --rollback <backupFile> --apply` (restores services-before + un-stamps; tested on a sample first). DRIFT-0 + code: `git revert <merge-commit>`. NOT a pure git revert for the DATA — the `--rollback` inverse-migration is the data rollback.

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — admin/ops script + dry-run report; no customer-facing UI/strings.
- **G2 (rollback):** PASS — `--rollback` inverse-migration + JSON backup (M7); `git revert` for code.
- **G3 (monitoring):** PASS — audit-FIRST per client + structured counts report (M8); the repair feeds Check 7 (already live).
- **G4 (test proves scenario):** PASS — tests mirror the real bug (drifted/seeded-phantom/orphan client → repaired to ledger truth; DRIFT-0 fresh/depleted/non-HOURS) + the trigger-no-op pin.
- **G5 (Hebrew UI):** N/A — no customer UI.
- **G6 (breaking change):** N/A for the data (additive correction + forward-only `packageId` semantics); the script is new. DRIFT-0 changes WHEN `entry.packageId` is non-null for the addTimeToTask path (declared behavioral change — net-positive on all consumers per the consumer audit).
- **G7 (security):** PASS — admin/ADC-gated script, audit-FIRST, no-PII; security + devils-advocate consulted (devils-advocate MANDATORY for the migration — the FINAL re-review of the CODE runs before any `--apply`).

## Notes for grader
- Built by a backend worker from the LOCKED design (`docs/PR-DRIFT-2-DESIGN.md`), then Lead-Agent reviewed (trust-but-verify): found + fixed the 2-G in-txn-rebuild gap (M5). 37 unit tests green.
- The supervised `--apply` is Haim's hands AFTER: this PR merges + CI green → a PROD dry-run reviewed with Haim (block-flips + ≥20h reversals + unresolved) → per-client approvals → `--apply`.
- legacy JS (mirrors `backfill-cost-per-hour.js` / `repair-aggregates.js`) — the supervised-script convention; documented §12 of the design.
