# Rubric — PR-NOW-1: detect-only stage anomaly observability

**Branch:** `feat/now-1-stage-detect` · **Commit:** `4907731`
**Plan:** `docs/PLAN-HOURS-STAGE-INTEGRITY-2026-07.md` (Track NOW, PR-NOW-1)
**App:** Functions · **Environment:** DEV (`main`) · **Size:** LIGHT

---

## Intent

Make two currently-invisible conditions VISIBLE on every legal_procedure time-entry
write, **without changing any behaviour**:

1. hours being deducted against a stage whose `status === 'completed'`;
2. the hardcoded first-stage (`stage_a`) fallback firing because nothing resolved.

A read-only production measurement (2026-07-21) found **75 entries / 101.60 hours
across 6 clients** logged against an already-completed stage. No mechanism reports
either condition today. This PR buys a real measurement before any enforcement is
designed.

**Explicitly NOT in scope:** blocking, throwing, changing a deduction target,
touching `service.currentStage`, or removing the fallback. Each is a separate,
higher-risk increment.

---

## MUST (all required for PASS)

| # | Criterion | How to verify |
|---|---|---|
| M1 | **Zero behavioural change.** No deduction target, return value, thrown error, or control-flow branch is altered on any path. | Read the diff at all 3 call sites: the helper call sits between the existing `const stage = …` and the existing `if (stage) {`. Nothing else moved. |
| M2 | **Cannot break a time entry.** The helper never throws, even on hostile input or a failing `console`. | `tests/stage-detect.test.js` — "NEVER THROWS" + "even a throwing console does not propagate". Confirm the `try/catch` wraps the whole body of `reportStageResolution`. |
| M3 | **Single SSOT — no copied logic.** One helper; the three write paths call it. No per-file re-implementation. | grep for `classifyStageResolution` / duplicated status checks. Exactly one definition in `functions/shared/stage-detect.js`. |
| M4 | **Wiring guard exists and would actually fail.** A test proves all three paths call the detector — the guard must not be able to silently pass while a path is unwired. | `tests/stage-detect.test.js` → "WIRING GUARD". Mentally delete one call site and confirm the corresponding `test.each` row fails. |
| M5 | **No PII in emitted logs.** Case/service/stage identifiers only — never a client name, employee email, description, or hours amount. Repo is PUBLIC; CI logs are world-readable (§2.8). | The PII-guard test asserts the exact key set of the payload. Verify by reading the `console.warn` payload literal. |
| M6 | **`completed` only.** A `pending` stage must NOT be reported — reporting it creates noise the owner learns to ignore, defeating the purpose. | Test: "a PENDING stage is not reported". |
| M7 | **No regression.** Full functions suite green, ESLint 0 errors. | `npx jest` → 1355/1355 (77 suites). `npx eslint <4 files>` → exit 0. |

## SHOULD

| # | Criterion |
|---|---|
| S1 | The module docblock states WHY detect-only (the `internal_office` billing-leak precedent) so a future session does not "helpfully" turn it into a block. |
| S2 | Anomaly names are greppable constants, not inline strings, so the later enforcement increment can reuse them. |
| S3 | The log line carries `stageCompletedAt`, enabling "how long has this been closed" analysis without a second query. |

---

## PRODUCT-GRADE GATES

| Gate | Status | Justification |
|---|---|---|
| **G1** — customer-visible errors | **N/A** | No customer-visible surface. No error is raised, no message reaches a user. |
| **G2** — rollback | **PASS** | Pure `git revert 4907731` + redeploy. Additive only; no data written, no schema, no CF added or deleted, no Cloud Scheduler job. Under 5 minutes. |
| **G3** — monitoring | **PASS** | This PR *is* monitoring. Structured single-line `[STAGE-DETECT]` payloads, parseable by log search, carrying anomaly + path + case/service/stage + resolution source. |
| **G4** — test proves the customer scenario | **PASS** | "THE 2025006 CASE" reproduces the real production shape (a lawyer logging onto a stage closed months earlier). Plus the wiring guard, which is the scenario that actually protects the feature over time. |
| **G5** — Hebrew customer-facing text | **N/A** | No user-facing string. Log lines are developer-facing (English), which §2.4 permits explicitly. |
| **G6** — breaking change | **PASS** | None. Purely additive: one new module, one new test file, and a non-mutating call inserted at 3 sites. No contract, field, route, or default changed. |
| **G7** — security review | **N/A** | No auth, permissions, rules, or PII surface touched. The PII *guard* is a hardening measure, not a new exposure — verified by M5. |

---

## Anti-premature-closure check

- Does this PR claim to FIX the drift? **No.** It measures it. The plan is explicit that enforcement ships later, after the escape route exists.
- Is any number in the docblock unverified? All figures (75 / 101.60h / 6 clients) come from the read-only measurement recorded in the plan, which itself notes two earlier measurements were wrong and how the correct one was derived.
- Known-open and deliberately untouched: `service.currentStage` being frozen (changing it moves where live money is deducted — full protocol + devils-advocate required); the 2-vs-4 open-task measurement discrepancy; `updateTimesheetEntry` re-deduction (unproven, tracked as PR-NOW-4).
