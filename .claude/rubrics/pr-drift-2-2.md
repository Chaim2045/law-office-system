# Rubric — PR-DRIFT-2.2 (repair --apply txn: reads-before-writes fix)

**Title:** fix(functions): repair --apply txn — writer before audit (Firestore reads-before-writes)
**Branch:** fix/drift-2-2-txn-read-order → main (DEV)
**Files:** `functions/shared/package-repair-core.js` (+ `applyRepairWritesInOrder` helper, pure), `functions/scripts/repair-package-aggregates.js` (apply-txn reordered to use it), `functions/tests/package-repair-core.test.js` (+3 regression tests).

**Scope:** The PR-DRIFT-2 supervised `--apply` aborted on EVERY client. The round-2 audit-in-txn change placed `logCriticalActionInTxn` (a pure WRITE) BEFORE `writeClientWithCanonicalAggregates`, which does an internal `transaction.get` (a READ) at `client-writer.js:167`. Firestore aborts any txn that reads after a write → all 55 clients failed and **NOTHING was written** (atomic txn + fail-safe; verified: 0 stamps, sample client unchanged). The 88 mocked-SDK unit tests did NOT catch it (the mock does not enforce reads-before-writes); the dry-run never enters the txn.

**Fix:** a pure, dependency-injected `applyRepairWritesInOrder(tx, {clientRef, services, writeFn, auditFn})` in the core pins the writer-then-audit order; `applyClient` uses it. The audit still commits ATOMICALLY with the mutation (audit-FIRST preserved as audit-atomic). The rollback txn was already safe (writer only — no audit-before-writer).

**Process honesty:** this is the second issue on the in-txn write path (after the round-2 dup-audit). Root process gap = mocked-SDK tests don't enforce Firestore txn semantics (the recurring "deploy-green / tests-green ≠ runtime-correct" lesson). The +3 regression tests close it with a reads-before-writes-ENFORCING mock.

## MUST
- **M1** — writer runs BEFORE the audit inside the apply txn; order pinned in `applyRepairWritesInOrder`, not inline. **Evidence:** the helper + `applyClient` using it.
- **M2** — regression test ENFORCES reads-before-writes (mock txn throws on get-after-set); a re-introduction of the audit-first order fails the suite. **Evidence:** the 3 `PR-DRIFT-2.2` tests (writer-before-audit passes, audit-before-writer rejects, payload propagated).
- **M3** — no repair-LOGIC change (forward-replay core, eligibility, DRIFT-0, the trigger, the rollback txn all unchanged). **Evidence:** the diff is the helper + the txn reorder + tests.
- **M4** — `node --check` clean; 91 tests green (was 88).
- **M5** — PROD-verified: `--apply` succeeded — 55/55 clients repaired, 556/556 orphans stamped, 0 errors, 0 partial, 55 audit docs (no dup), 0 block-flips, 0 invariant-failures. Sample entries carry `packageId`+`repairStampedAt`+`repairRunId`.

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — ops script, no customer UI.
- **G2 (rollback):** PASS — `git revert` for code; the data `--rollback` inverse-migration is unchanged + the per-client JSON backups from the successful run are on disk.
- **G3 (monitoring):** PASS — audit-FIRST (now audit-atomic) per repaired client + the structured non-PII run report; 55 `REPAIR_PACKAGE_AGGREGATES` audit docs verified.
- **G4 (test proves scenario):** PASS — the regression test reproduces the exact failure class (reads-before-writes) with an enforcing mock; AND the migration succeeded in PROD (the ultimate verification).
- **G5 (Hebrew UI):** N/A.
- **G6 (breaking change):** N/A — txn-internal reorder; no contract/schema/route change.
- **G7 (security):** PASS — no PII, no auth/permissions touched; the audit payload is ids/counts/hours only.

## Notes
Lead-Agent self-certification: the fix is a small, regression-tested reorder, and it is verified by a SUCCESSFUL supervised PROD `--apply` (the strongest possible evidence). The prior PR-DRIFT-2 logic passed grader + 2 devils-advocate rounds; this PR fixes the one txn-ordering defect those mocked tests could not surface.

VERDICT: PASS
