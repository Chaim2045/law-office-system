# Rubric — PR-2: timesheet idempotency SSOT (atomic exactly-once)

**Scope:** Extract the atomic exactly-once idempotency primitive introduced in PR-1
(`functions/addTimeToTask_v2.js`, #427) into a shared SSOT module
`functions/shared/idempotency.js`; apply it — atomically, inside the existing
Firestore transaction (read-before-writes + `transaction.create` + `already-exists`
replay) — to BOTH timesheet create paths in `functions/timesheet/index.js`
(`createQuickLogEntry`, `createTimesheetEntry_v2`); retire the NON-ATOMIC
`checkIdempotency`/`registerIdempotency` from `functions/timesheet/helpers.js`.
This closes the same weak-network double-write class PR-1 closed for
`addTimeToTask`, now for the two timesheet paths.

## MUST

1. **SSOT** — exactly ONE `processed_operations` implementation for the three
   targeted write paths. `addTimeToTask_v2` + both timesheet paths consume
   `functions/shared/idempotency.js`; no inline copy remains in those files.
2. **Atomic exactly-once** — in each of the two timesheet paths the idempotency
   lookup is a `transaction.get` performed as the LAST read before ANY write
   (Firestore reads-before-writes), and the record is written via
   `transaction.create` (NOT `.set()`) inside the SAME transaction as the mutation.
3. **Duplicate blocked** — a second call with the same key returns the stored
   result and performs NO client write / NO timesheet entry / NO cost write.
4. **Concurrent race handled** — a sibling that loses the `create()` race replays
   the stored result (no throw, no duplicate write); on exhausted retries the
   error surfaced is a Hebrew `HttpsError('aborted', …)` — never the raw SDK
   `already exists` string (G1) and never a false failure that would push a
   fresh-key re-submit.
5. **No duplicate side-effect trail** — on a replay of `createTimesheetEntry_v2`,
   the post-transaction event-sourcing / reservation-commit / audit-log steps
   are skipped (they run exactly once, on the call that actually wrote).
6. **Record-shape compatibility** — `writeProcessedOperation` writes the byte-identical
   record shape PR-1 wrote (`idempotencyKey/status/result/createdAt/expiresAt`), so
   historical records replay correctly. No migration.
7. **Retired helpers have ZERO live callers** — `checkIdempotency`/`registerIdempotency`
   removed from `helpers.js`; grep of `functions/` confirms no remaining production caller.
8. **Full suite green** — the complete functions test suite passes with new,
   assertion-level coverage of the duplicate-blocked + concurrent-replay +
   exhausted-retry-Hebrew-abort scenarios for BOTH timesheet paths.

## SHOULD

- Replay of `createTimesheetEntry_v2` rolls back its uncommitted reservation
  (no dangling `pending` reservation until TTL).
- Stale `checkIdempotency`/`registerIdempotency` mocks removed from sibling suites.

## Out of scope (tracked follow-ups)

- `functions/clients/index.js` `createClient` has a SEPARATE non-atomic
  `processed_operations` implementation with a different record shape → future PR.
- Idempotency-key FORMAT validation on the two timesheet paths (`addTimeToTask`
  validates; the timesheet paths never did — adding it would reject
  previously-accepted keys = a behavioral change outside this PR).

## PRODUCT-GRADE GATES

- **G1** errors — PASS. No stack traces / raw FirebaseError / mixed-language.
  Exhausted-retry now returns a clean Hebrew `aborted`.
- **G2** rollback — PASS. Code-only; `git revert` + redeploy. Record shape
  shared with PR-1 so a revert leaves no incompatible data.
- **G3** monitoring — PASS. The `transaction.create` idempotency write and every
  replay path log; the real-write path keeps its `logAction` audit.
- **G4** test proves scenario — PASS. Both paths have assertion-level tests that
  the weak-net duplicate does NOT double-write.
- **G5** Hebrew UI — PASS/N/A. No new user-facing strings except the Hebrew abort.
- **G6** breaking change — PASS. `processed_operations` shape unchanged; callable
  return shapes unchanged; helper retirement is internal.
- **G7** security/PII — PASS. Idempotency check still runs AFTER
  `checkUserPermissions`; no PII added to logs.
