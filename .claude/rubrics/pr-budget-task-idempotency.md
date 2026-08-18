# Rubric — PR-3a: budget-task idempotency (createBudgetTask + adjustTaskBudget)

**Scope:** Apply the shared atomic exactly-once idempotency primitive
(`functions/shared/idempotency.js`, shipped in PR-1/PR-2) to TWO budget-task
Cloud Functions in `functions/budget-tasks/index.js` — `createBudgetTask` and
`adjustTaskBudget` — closing the same weak-network double-write class already
fixed for `addTimeToTask` and the two timesheet paths. Frontend: mint+pass an
`idempotencyKey` at the 4 live call sites. `extendTaskDeadline` is deliberately
deferred to PR-3b (it needs a transaction-wrap first).

## MUST

1. **Atomic exactly-once, both functions** — the `processed_operations` lookup
   (`readProcessedOperation`) is a `transaction.get` performed as the LAST read
   before ANY write in each function; the record is written via
   `writeProcessedOperation` (`transaction.create`) inside the SAME transaction
   as the mutation; a 3-attempt `already-exists` retry loop wraps `db.runTransaction`.
2. **Duplicate blocked** — a second call with the same key returns the stored
   result and performs NO second task/approval write (createBudgetTask) and NO
   second `budgetAdjustments` arrayUnion entry (adjustTaskBudget).
3. **JSON-safe stored result** — the object passed to `writeProcessedOperation`
   (and returned) contains ONLY primitives — no `serverTimestamp()` / `Timestamp`
   sentinels — so `transaction.create` does not throw and the record replays verbatim.
4. **No duplicate side-effect trail** — the post-transaction `logAction`
   (`CREATE_TASK` / `ADJUST_BUDGET`) is guarded by `didWrite` and skipped on
   every replay route (Phase-1 short-circuit AND concurrent already-exists).
5. **Exhausted-retry is professional** — on 3 exhausted `already-exists`, a Hebrew
   `HttpsError('aborted', …)` is surfaced; the raw SDK `already exists` string
   never leaks (G1).
6. **Frontend mints ONE key per submission OUTSIDE the retry** — so all 3
   `FirebaseService.call` retries carry the same key. All 4 live sites covered
   (createBudgetTask ×3, adjustTaskBudget ×1). `extendTaskDeadline` untouched.
7. **Missing-key backward-compat** — a call without `idempotencyKey` behaves
   exactly as before (no processed_operations write).
8. **SSOT + green suite** — both functions consume the shared primitive (no
   inline copy); the full functions suite passes with new assertion-level
   coverage for BOTH functions.

## SHOULD

- Dead post-refactor variable (`savedTaskData`) removed.
- Result trim keeps the external success shape (`{success, taskId, task}` /
  `{success, taskId, oldEstimate, newEstimate, addedMinutes, message}`).

## Out of scope (tracked follow-ups)

- `extendTaskDeadline` — needs a transaction-wrap first → PR-3b.
- `functions/clients/index.js` `createClient` separate non-atomic
  `processed_operations` implementation (different shape) → future PR.
- Idempotency-key FORMAT validation on these paths (behavioral change).

## PRODUCT-GRADE GATES

- **G1** errors — PASS. Exhausted-retry → Hebrew `aborted`; no raw SDK leak.
- **G2** rollback — PASS. Code-only; `git revert` + redeploy. Shared
  `processed_operations` shape → a revert leaves no incompatible data.
- **G3** monitoring — PASS. The `transaction.create` idempotency writes and
  replay paths log; the real-write path keeps its `logAction` audit.
- **G4** test proves scenario — PASS. Assertion-level tests for BOTH functions.
- **G5** Hebrew UI — PASS/N/A. Only new user-facing string is the Hebrew abort.
- **G6** breaking change — PASS. Callable return keeps `{success, taskId, …}`;
  the echoed `task` is trimmed of sentinel-only fields (client re-reads the live
  doc). No contract a consumer depends on is removed.
- **G7** security/PII — PASS. Idempotency check runs AFTER `checkUserPermissions`;
  the stored result carries no salary/PII beyond the task metadata the caller
  already receives; no PII added to logs.
