# Rubric — PR-B-2: re-point open budget_tasks on stage advance

**Branch:** `feat/b-2-repoint-tasks-on-advance` · **Commit:** `63ee20f`
**Plan:** `docs/PLAN-HOURS-STAGE-INTEGRITY-2026-07.md` (PR-B-2)
**App:** Functions · **Environment:** DEV (`main`) · **Size:** MEDIUM
**High-stakes:** YES — modifies a write path inside a live Firestore transaction. `devils-advocate` is MANDATORY (`CLAUDE.md` §3.8.4).

---

## Intent

**The root-cause fix.** A `legal_procedure` task stamps its stage into `budget_tasks.serviceId` once at creation (`functions/budget-tasks/index.js:175-178`) and **nothing ever refreshes it**. `moveToNextStage` never touches `budget_tasks` at all. So an open task created during stage א keeps deducting every future hour from stage א's package — months after stage א closed.

Measured in production 2026-07-21 (read-only): **75 entries / 101.60 hours across 6 clients** landed on an already-completed stage. Current blast radius: **2–4 open tasks**, zero hours logged on them since closure.

This PR makes `moveToNextStage` re-point those tasks, in the same transaction.

**Re-point, never close** — product-owner decision. `completeTask` is irreversible (no reopen callable exists) and refuses when `actualMinutes === 0` (`functions/budget-tasks/index.js:521-534`), so auto-closing would destroy in-flight work and fail outright on untouched tasks.

**Explicitly NOT in scope:** `service.currentStage` (frozen at `services/index.js:147`, read by the deduction path at `addTimeToTask_v2.js:287` — changing it moves where live money is deducted; quarantined to its own PR), historical entries, and the blocking gate.

---

## MUST (all required for PASS)

| # | Criterion | How to verify |
|---|---|---|
| M1 | **Transaction ordering is correct.** All reads precede all writes across the whole callback, including `writeClientWithCanonicalAggregates`'s own internal `transaction.get` → `transaction.update`. Firestore rejects a violation at runtime and the mock harness cannot reproduce that error. | Trace the callback order against `functions/shared/client-writer.js`. The `budget_tasks` query must sit after the client read and before the helper call; the task writes must sit **after** the helper returns. A dedicated ordering test must assert mock call order. |
| M2 | **Only the stage pointer is written.** `serviceId` (+ `lastModifiedAt`/`lastModifiedBy`). Never `actualMinutes`, `estimatedMinutes`, `status`, `timeEntries`, or any budget/completion field. Historical entries stay where they are. | Read the `transaction.update` payload. A payload-shape test must pin the exact key set. |
| M3 | **Task selection is precise.** Same client + same `parentServiceId` + `serviceId` == the closing stage + still open. Completed / cancelled / other-service / later-stage tasks untouched. | Verify the filter and its tests. Critically: verify `budget_tasks.clientId` really holds the same value as `data.clientId` — if not, the feature silently does nothing forever and every test still passes. |
| M4 | **Every re-point is audited atomically.** `logCriticalActionInTxn` inside the transaction — audit commits or aborts with the mutation. No fire-and-forget fallback. | `functions/CLAUDE.md` audit-FIRST. Verify the compiled `functions/lib/audit-critical.js` exists, is committed, its signature matches, and it allocates the doc ref synchronously (async inside a transaction is unsafe). |
| M5 | **No PII in the audit payload.** Repo is PUBLIC; CI logs are world-readable (§2.8). | Read the payload literal: ids only — no client name, employee email, or task description. |
| M6 | **Zero writes when nothing matches.** The common case today. Transaction must be byte-identical to pre-PR behaviour. | A test asserting an exact call count, not merely "no error". |
| M7 | **`service.currentStage` untouched.** | grep the diff. |
| M8 | **Client-document writes only via `writeClientWithCanonicalAggregates`.** Its RESTRICTED_KEYS mechanism silently strips direct aggregate writes — bypassing it produces writes that appear to succeed and do nothing. | Verify no direct `transaction.update(clientRef, …)` was added. `budget_tasks` written directly is correct. |
| M9 | **Failure semantics decided and documented**, not silently chosen. | The commit body must state the choice and its reasoning. |
| M10 | **No regression.** Full functions suite green, ESLint 0. Existing `moveToNextStage` tests still pass. | `cd functions && npx jest` (baseline 1355/77). `npx eslint` on the changed files. |

## SHOULD

| # | Criterion |
|---|---|
| S1 | Observability (G3): the number of re-pointed tasks is surfaced in the return value and the audit trail, so the effect is measurable in production without a query. |
| S2 | The reasoning for each non-obvious constraint lives in a code comment, so a future refactor does not silently undo it. |
| S3 | The query avoids composite-index risk. |

---

## PRODUCT-GRADE GATES (to be assessed by the grader — claims below are the author's)

| Gate | Claim | Justification |
|---|---|---|
| **G1** | N/A | No new customer-visible error path. Existing Hebrew errors unchanged. |
| **G2** | PASS | `git revert 63ee20f` + redeploy. No schema, no data migration, no CF added or deleted. Already-re-pointed tasks stay re-pointed — that is the correct state, not something to undo. |
| **G3** | PASS | Audit doc per re-pointed task + count in the return value + count in the existing `logAction` + console line. |
| **G4** | PASS | 11 new cases incl. every exclusion path, the no-op case, payload shape, and read-before-write ordering. |
| **G5** | N/A | No new user-facing string. |
| **G6** | PASS | Additive. No contract, field, route or default removed. `repointedTaskCount` added to the return value — additive, no consumer breaks. |
| **G7** | **Assess** | Touches no auth/rules/permissions, but WRITES to a collection it previously never touched and adds an audit surface. Grader should judge whether N/A is honest here rather than accept it. |

---

## Anti-premature-closure

- Does this fix the historical 101.60h? **No.** It stops new occurrences. The historical correction was cancelled by the owner except for client 2026057 (fixed-price, ~₪90,000 turns on stage attribution).
- Known-open and deliberately untouched: the `service.currentStage` divergence; the blocking gate; `reopenStage` (re-specification required after the plan review found it must also MOVE hours, which collides with an existing transfer trigger).
- The measured figure (2–4 open tasks) is from 2026-07-21 and may have moved. It bounds the blast radius, not correctness.
