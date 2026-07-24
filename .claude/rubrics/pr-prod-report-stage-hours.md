# Rubric — PR: report stage-card hours SSOT + load-failure visibility (PROD port)

**Branch:** `fix/prod-report-stage-hours` · **Target:** `production-stable` (PROD)
**App:** admin-panel (frontend only) · **Size:** SMALL
**Nature:** hand-port of two ALREADY-REVIEWED (`main`-branch) commits onto `production-stable`, because a cherry-pick conflicts on the 158-commit divergence.

---

## Intent

Two billing-facing display defects on the client report modal:

1. **Stage cards read `0` for real hours.** A `legal_procedure` stage card recomputed used-hours from the client-side timesheet array (`entry.serviceId || entry.stageName` matched against `stage.id`). When the array was empty (a silent load failure) OR an entry's hours were recorded under a different `serviceId`, the card showed `0.0` while the management modal — reading the stored aggregate — showed the correct number. Bimodal by client. Confirmed live on a real client (management showed ~61.5h used, report card showed 0).

2. **A failed timesheet/budget-tasks load was silent.** `loadAllData` checked only `clientsResult.success`; a failed timesheet load left the array empty with no signal, so every stage card (and the report) read 0 as if genuinely zero.

The fix: the stage card reads the stored per-stage aggregate using the backend's canonical FIXED/hourly selection rule; a failed load now raises a non-auto-hiding Hebrew notification and sets a flag.

The two source commits (`e8af737` stage-hours SSOT, `e29aac7` load-failure visibility) received a full adversarial review on the `main` branch → **VERDICT: GO**. This PR ports that reviewed logic to `production-stable`'s files by hand.

---

## MUST (all required for PASS)

| # | Criterion | Verification |
|---|---|---|
| M1 | The stage card reads the stored aggregate with the backend's exact FIXED/hourly rule: `stage.pricingType === 'fixed' ? (stage.totalHoursWorked \|\| 0) : (stage.hoursUsed \|\| 0)`. | Mirrors `functions/src/modules/aggregation/index.js:170`. A naive `stage.hoursUsed`-only read would zero all 87 fixed stages — this avoids it. |
| M2 | The client-side timesheet recompute for the stage card is DELETED, not left beside the new read. | grep: the stage-card `getClientTimesheetEntries` call is gone; the unrelated call ~line 505 is out of scope and untouched. |
| M3 | The never-read `remainingHours` local is deleted (verified dead: `createServiceCard` recomputes `remaining = totalHours − usedHours` locally). | Confirmed on this file, not assumed from `main`. |
| M4 | A failed timesheet/budget-tasks load is now visible: a `timesheetLoadFailed`/`budgetTasksLoadFailed` flag, a loud `console.error`, and a non-auto-hiding Hebrew `notify.show({duration:0})`, `typeof`-guarded. It must NOT throw. Flags reset to false on the success path. | Read both catch blocks + the constructor + the success returns. |
| M5 | The query caps are UNTOUCHED at 10,000 (Firestore's hard max). | grep `= 20000` → empty; `= 10000` present on both loaders. |
| M6 | The port is FAITHFUL to the reviewed commits — no logic reinterpreted, only line-number/context shifts. | Compare the port hunks against `git show e8af737` / `git show e29aac7`. |
| M7 | No PII, no new customer-visible English, no stack trace in the new toast. | The Hebrew strings name a next action ("רענן את הדף או פנה לתמיכה הטכנית"). |
| M8 | `node --check` passes on both JS files. (No vitest in this partial worktree — syntax check only, NOT a behavioural test.) | stated honestly. |

## SHOULD

| # | Criterion |
|---|---|
| S1 | Cache-bust bumped on both HTML files for both scripts (else browsers pin the old copy under `production-stable`'s cache headers). |
| S2 | The comment names the backend rule it mirrors, so the two cannot silently drift. |

---

## PRODUCT-GRADE GATES

- **G1 — PASS.** One new Hebrew user-visible string (the load-failure toast), names a next action, no stack trace / `undefined` / raw FirebaseError. The stage-card change removes a wrong `0.0`, adds no error string.
- **G2 — PASS.** Rollback: `git revert 2797c84` + redeploy. Frontend only; no schema, no CF, no rule, no scheduler.
- **G3 — N/A.** Read-only display path; no data mutation.
- **G4 — PASS (with the honest caveat).** The customer scenario (open a client with a legal_procedure stage → the stage card shows the same used-hours as the management modal) is verified by matching the reviewed `main`-branch fix, which received a full adversarial GO, plus a live-smoke after deploy. No unit test exists for `ClientReportModal.js` (pre-existing gap) — this rests on code reasoning + the upstream review, stated plainly.
- **G5 — PASS.** The single new user-facing string is Hebrew.
- **G6 — PASS, declared.** Behavioural: stage cards that previously showed `0.0` now show real hours; a previously-silent load failure now raises a toast. No data/contract/route change. The report OUTPUT (printed PDF) still recomputes from the array — this PR fixes the selection cards, not the generated report body; declared so no one assumes otherwise.
- **G7 — N/A.** No auth, rules, permissions, or PII surface touched.

VERDICT: PASS
