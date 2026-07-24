# Rubric — PR: lower query cap 20000 → 10000 (Firestore hard max)

**Branch:** `fix/prod-timesheet-limit-10k` · **Target:** `production-stable` (PROD)
**App:** admin-panel (frontend only) · **Size:** TRIVIAL (one value in two places + cache-bust)
**Nature:** REGRESSION FIX for a live production outage.

---

## Intent

PR #462 raised the `timesheet_entries` / `budget_tasks` query cap from 5,000 to 20,000 to avoid silent truncation, and it was deployed to PROD today. **20,000 exceeds Firestore's hard maximum of 10,000 for a single query's `limit()`.** The query throws `FirebaseError: Limit value in the structured query is over the maximum value of 10000`. Because `loadAllData` only rethrows on the clients load, the failure is silent: clients render, `this.timesheetEntries` stays `[]`, and **every client report shows "no records" for every client.** Confirmed from a live PROD console.

This PR lowers both caps to 10,000 — Firestore's maximum — which is still ~5,000 above today's ~4,983 entries.

---

## MUST (all required for PASS)

| # | Criterion | Verification |
|---|---|---|
| M1 | Both caps are ≤ 10,000. | grep `= 20000` returns nothing; `timesheetLimit`/`budgetTasksLimit` both `10000`. |
| M2 | The value is the only behavioural change — no new code path, no logic change. | diff is two constant values + two comments + two cache-bust strings. |
| M3 | Cache-bust bumped on every HTML that loads the file. | Both `clients.html` and `clients-fluent.html` `?v=` changed; grep confirms no other loader. |
| M4 | The comment states plainly that 10,000 is Firestore's hard ceiling, so a future session does not re-raise it. | read the comment. |
| M5 | No PII, no new log line. | diff carries no client data. |

## SHOULD

| # | Criterion |
|---|---|
| S1 | The commit body names the exact FirebaseError and the silent-failure mechanism, so the regression is diagnosable from history alone. |
| S2 | The residual structural issue (unbounded client-side download; 10,000 is a wall not a runway) is stated, not hidden. |

---

## PRODUCT-GRADE GATES

- **G1 — PASS.** No new user-visible string. The change removes an error state (the throw); the existing Hebrew truncation warning is unchanged.
- **G2 — PASS.** Rollback: `git revert` this commit + redeploy. Noted in PR body that the pre-revert state (20,000) is itself broken, so a true rollback goes to the pre-#462 `limit(5000)`.
- **G3 — N/A.** Read-only query path; no data mutation.
- **G4 — PASS.** The customer scenario (open any client report → records appear) is verified live in the browser after deploy; there is no unit test for this file (pre-existing gap, noted).
- **G5 — PASS.** No new user-facing string; existing Hebrew preserved.
- **G6 — PASS.** No breaking change — this restores prior working behaviour by correcting an out-of-range value.
- **G7 — N/A.** No auth, rules, permissions, or PII surface touched.

VERDICT: PASS
