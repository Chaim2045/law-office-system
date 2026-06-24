# Rubric — OWN-0 (stop minting new orphans)

**Title:** fix(functions): OWN-0 — stop minting package-counted-null orphans (trigger stamp + overage bucket + neutralize addPackageToService reseed + Check-7 detection)
**Branch:** `fix/own-0-stop-orphans` → main (DEV)
**Files:** `functions/triggers/timesheet-trigger.js` (a), `functions/addTimeToTask_v2.js` (b), `functions/services/index.js` (c), `functions/scheduled/index.js` (d) + tests (`addtimetotask-packageid-stamp.test.js` rewritten, `add-time-to-task-canonical-helper.test.js`, `add-package-to-service.test.js`, `package-and-guard.test.js`, `pr-drift-1-check7.test.js`).
**Scope:** Prerequisite to the single-owner aggregate redesign. STOP minting new `packageId:null` orphans on HOURS-services-with-packages, so the future owner can attribute new entries by packageId (forward-replay only needed for the legacy tail). Four coupled parts:
- **(a)** Trigger CREATE-fallback persists the resolved `packageId` + `deductedInTransaction:true` in Write-2 (closes the Write-2 leak + the event-coalescing re-CREATE hole; self-write guard extended).
- **(b)** `addTimeToTask_v2` stamps the actual deduction-target package id (incl. an overdraft package going negative) instead of DRIFT-0's fresh-only null — eliminates the package-counted-null orphan at source.
- **(c)** `addPackageToService` no longer scans/reseeds orphan entries or backfills their packageId (the +874h detonator); a new package starts EMPTY and `service.hoursUsed` is PRESERVED (no PR #174 under-count).
- **(d)** Check-7 detects the two classes OWN-0 deliberately leaves uncovered (0-package HOURS orphans + legal_procedure hourly-stage orphans) so the "no new orphans" claim is MEASURED, not assumed.

**Precision contract:** OWN-0 is go-forward prevention + detection only. It does NOT migrate or re-attribute existing data (that is the supervised forward-replay repair, already applied). `service.hoursUsed` is preserved **at the moment of `addPackageToService`** (no consumption gained/double-counted by this PR). NOTE — preservation of *service-only* hours is point-in-time, not invariant: the next `applyHoursDelta` recomputes `service.hoursUsed = Σpackages` and drops any hours not in a package. This is a PRE-EXISTING property of `applyHoursDelta`, not introduced by OWN-0; the durable fix is the forward-replay repair stamping service-only orphans onto packages (so Σpackages catches up) + the OWN-1 ledger-truth owner. OWN-0(c) removes #174's buggy ad-hoc durability (which double-counted package-counted-null orphans) and relies on the proper mechanism.

## MUST criteria (block on FAIL)

### M1 — (a) Trigger stamp is CREATE-fallback-scoped + carries deductedInTransaction
**Rule:** Write-2 stamps `{ packageId: resolvedPackageId, deductedInTransaction: true }` ONLY when `eventType==='CREATE' && !entry.packageId && resolvedPackageId` (the CREATE-fallback path) — NOT on UPDATE overage-flag refreshes. The stamp leaves `minutes` unchanged. **Evidence:** the `createFallbackStampPackageId` guard + Write-2 conditional; test "CREATE with no packageId → entry stamped {packageId, deductedInTransaction:true}".

### M2 — (a) Re-fire is a no-op (coalescing + zero-delta + self-write guard)
**Rule:** a coalesced re-CREATE is skipped by the `deductedInTransaction` CREATE guard; the stamp's UPDATE re-fire (minutes unchanged) is skipped by BOTH the zero-delta guard and the extended self-write guard (`triggerFields` ⊇ {packageId, deductedInTransaction}). A real minutes change still processes (minutes ∉ triggerFields). **Evidence:** self-write-guard test (packageId+deductedInTransaction-only UPDATE skipped), retained zero-delta no-op pin, delta-based control test.

### M3 — (b) addTimeToTask stamps the deduction target (HOURS), null only for genuine service-only
**Rule:** for HOURS, `entry.packageId` = the package `applyHoursDelta` deducted into (incl. an overdraft/depleted package within the floor or under override); `null` ONLY when the deduction fell to `applyHoursDeltaServiceOnly` (0 packages / all beyond floor). Non-HOURS unchanged (`serviceIds.packageId`). `resolveFreshStampPackageId` removed. **Evidence:** the `entryStampPackageId` capture + tests (overage-on-depleted override → p_dep; fresh → active pkg; zero-package → null).

### M4 — (c) No orphan re-count, no backfill, service.hoursUsed PRESERVED (point-in-time)
**Rule:** `addPackageToService` removes the orphan query + reseed + the packageId-backfill batch; the new package starts `hoursUsed:0`; `service.hoursUsed` is preserved at write-time (NOT recomputed from Σpackages → no #174 under-count AT add-package). The `totalHours` vs Σ(packages.hours) capacity invariant guard is retained. The preservation is point-in-time (see Precision contract); the code comment states the durable mechanism (repair stamps orphans → Σpackages catches up). **Evidence:** tests — no-detonation (orphans ignored, no batch), #174 service-only-preserved (hoursUsed=5 kept, not dropped to Σpackages=2), happy path unchanged; the `services/index.js` comment documents point-in-time + durable fix.

### M5 — (d) Check-7 detects the uncovered classes without false positives
**Rule:** new signals `orphan_entries_on_packageless_service` (HOURS, 0 packages, orphan minutes) and `orphan_entries_on_legal_procedure_stage` (hourly stage WITH packages, orphan stage-minutes). FIXED stages and zero-package hourly stages are NOT flagged. Detection is read-only; the 4th param is optional (backward compatible). **Evidence:** detector tests (packageless fires; packaged fires existing signal not packageless; legal hourly-with-packages fires; FIXED/zero-package stage no signal; 3-arg backward compat).

### M6 — No data migration; preservation is exact; full suite green
**Rule:** OWN-0 writes no migration and changes no existing entry/package value retroactively; `service.hoursUsed` math is preserved for the no-orphan case (Σpackages unchanged when a 0-used package is added). Full functions jest suite green; `node --check` clean on all 4 source files. **Evidence:** `npx jest` = 1137/1137 pass (66 suites, 2 projects); node --check OK ×4.

## SHOULD
- **S1** — devils-advocate re-review on the FINAL diff (MANDATORY for a core write-path change per §3.8.4) before merge.
- **S2** — after deploy, a Check-7 "Run now" smoke confirms the new (d) signals report the expected (small, known) uncovered surface and HOURS-with-packages orphan-minting trends to zero on new entries.
- **S3** — DEV manual smoke: log time on an overage (override) HOURS service → the new entry carries the overdraft package id (not null); add a package to a service → new package is empty, client hoursUsed unchanged.

## Out of scope (deferred — declared)
- **0-package HOURS services** (e.g. legacy `2025724/736935`): no package to stamp → entries stay service-level by design; (d) MEASURES them; the supervised repair owns recovery.
- **legal_procedure stages** (HOURS-only PR): orphan-minting on hourly stages is NOT stopped here — (d) MEASURES it; DRIFT-3 stops + repairs it.
- **Existing orphan backlog**: handled by the already-applied forward-replay repair, not this PR.
- The single-owner live recompute owner (OWN-1) + Check-7 repair-half (OWN-2).

## Rollback (G2)
Pure `git revert <merge-commit>` + redeploy. OWN-0 writes NO data migration — reverting restores the prior go-forward behavior with no data to undo. (Entries stamped under (a)/(b) between deploy and revert keep correct package ids; reverting just resumes the prior stamping logic.)

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — no new customer-facing strings/error paths; the one existing Hebrew block-message (`חסום — נגמרה יתרת השעות`) is unchanged.
- **G2 (rollback):** PASS — pure `git revert` (no data migration). See Rollback.
- **G3 (monitoring):** PASS — data-mutating write paths retain their existing structured logs; OWN-0(d) ADDS detection signals (Check-7) for the uncovered classes (net-positive monitoring). The trigger's `TRIGGER_FALLBACK_WITH_TASK` warning still fires on first occurrence.
- **G4 (test proves scenario):** PASS — integration tests mirror real flows: overage-on-depleted (override) entry → overdraft package stamped; add-package → empty package + preserved consumption; trigger CREATE-fallback → stamped + re-fire no-op; Check-7 detects uncovered classes. 1137 tests green.
- **G5 (Hebrew UI):** N/A — backend only, no UI/customer strings added.
- **G6 (breaking change):** Declared behavioral change (no schema/contract break). (a)/(b) change WHICH package id new HOURS entries carry (overdraft target instead of null) — net-positive on all `package.hoursUsed`/`service.hoursUsed` readers (card stays in lockstep with the deduction). (c) changes addPackageToService so a new package starts empty (correct UX) instead of absorbing orphans (the double-count). No existing data rewritten.
- **G7 (security):** N/A — does not touch auth, permissions, Firestore rules, or PII. (devils-advocate is run anyway — MANDATORY for the core write-path change, not for G7.)

## Notes for grader
- Investigation was code-grounded + verified by 3 specialists (backend mechanics / data-investigator blast-radius / devils-advocate). Key resolution: the DRIFT-2 "trigger re-stamp rejected" concern is closed here by `deductedInTransaction:true` (coalescing) + the zero-delta/self-write guards (UPDATE re-fire), and (c) removes the only other packageId-only entry updater (addPackageToService backfill), making the self-write-guard extension safe.
- The single highest-risk seam (backend risk #2) — Write-2 runs on CREATE+UPDATE — is handled by scoping the stamp to the CREATE-fallback (`createFallbackStampPackageId`), never on UPDATE refreshes.
- (c) is the one behavioral change on a live billing write path (functions/CLAUDE.md BEHAVIORAL CHANGE RULE): preserve-not-reseed avoids BOTH the +874h double-count (old reseed) and the PR #174 under-count (naive Σpackages recompute).
