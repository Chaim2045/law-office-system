# Rubric — H.4 PR-b: Worker overrun-toast + threshold alignment + dead-gate cleanup (User App)

**Scope:** User App (`apps/user-app/`) + docs. Frontend-only. Part of H.4 "Model A: smart
budget meter" (MASTER_PLAN §8.6). Closes H.4.

**What this PR does:**
1. NEW pure helper `apps/user-app/js/modules/budget-crossing.js` — `detectBudgetCrossing(before, after, est)`
   → `'over'|'approaching'|null` at the canonical 85% / 100% thresholds (dual-export ESM + `window`),
   the worker-side mirror of PR-a's `apps/admin-panel/js/core/budget-status.js`.
2. A moment-of-overrun **toast** in `main.js submitTimeEntry` — fires once per crossing the moment a
   time entry pushes a task across 85% / 100%, via the existing `window.NotificationSystem`.
3. Aligns the one disagreeing per-task threshold (`budget-tasks.js levelForPercent` 80→85).
4. Deletes the dead `apps/user-app/components/task-approval-system/` folder (the user-app twin of the
   approval gate PR-a retired in the admin app).
5. Doc sweep: `SYSTEM_MAP.md`, `.claude/NOTIFICATION-SYSTEM.md`, `apps/admin-panel/components/README.md`.

**No devils-advocate** — no new gating write path, no `firestore.rules` / claims / auth / schema change
(confirmed §3.8.4). All reads use data already on the client.

---

## MUST (all required for PASS)

- **M1 — Stateless once-per-crossing correctness.** The toast fires exactly once when an entry newly
  crosses 85% and once when it newly crosses 100%; a later entry that stays above the line fires
  nothing. Achieved by `before < threshold ≤ after` (no persistent per-task flag). The BEFORE is the
  authoritative post-entry actual (`result.newActualMinutes`) minus this entry's minutes — captured
  before `loadData()` overwrites the in-memory task.
  *Verify:* `budget-crossing.test.ts` once-per-crossing scenarios; the capture-before-loadData wiring.

- **M2 — Canonical thresholds, no third fork.** `budget-crossing.js` uses 85 / 100 identical to
  `budget-status.js`, pinned by a drift-guard test. `levelForPercent` is aligned 80→85. No new
  parallel threshold literal is introduced.
  *Verify:* `budget-crossing-drift-guard.test.ts` passes (thresholds + labels + transitions pinned to
  `budgetStatus`).

- **M3 — The save path is never broken by the toast.** Notification logic is wrapped so any failure
  (missing helper, missing message, throw) is swallowed — a worker who logged time always sees the
  success result regardless of the budget toast.
  *Verify:* the `try/catch` in `_notifyBudgetCrossing`; the toast runs in `onSuccess`, after the save.

- **M4 — Dead code fully removed, live code untouched.** The entire `task-approval-system/` folder is
  deleted (zero live wiring confirmed). `notification-bell.js` (the separate, live `notifications`
  `type=='task_approval'` flag) is NOT touched.
  *Verify:* `grep task-approval-system apps/user-app` returns nothing; `notification-bell.js` unchanged.

- **M5 — Hebrew, no emojis, no PII/values logged.** New toast copy is Hebrew (G5). No emojis in new
  source (root §3.2). The helper logs nothing; budget figures / client names never reach a raw
  `console.*`.
  *Verify:* grep the new files for emojis + `console.` with values.

- **M6 — Tests prove the customer scenario + no regression.** A `.test.ts` (NOT `.test.js` — vitest
  include is `tests/unit/**/*.test.ts` only) covers: cross 85 → one signal; cross 100 → one; re-log
  above → none; no-budget → none. The full `tests/unit/user-app/` suite stays green. ESLint 0 errors.
  *Verify:* `npx vitest run tests/unit/user-app/`; `npx eslint <changed user-app JS>`.

## SHOULD

- **S1** — The toast reuses the canonical Hebrew labels' wording ("מתקרב לתקציב" / "חריגת תקציב") so
  the toast, the admin feed, and the card speak one language.
- **S2** — Consume the backend's authoritative `newActualMinutes` rather than recompute from
  possibly-stale client `task.actualMinutes`.
- **S3** — The doc sweep corrects (not just deletes) the stale claims that `approveTaskBudget` /
  `rejectTaskBudget` are live Cloud Functions.

---

## PRODUCT-GRADE GATES

- **G1 — errors:** PASS. Removes a latent error class (the dead approve/reject path is gone with the
  folder). The toast helper guards non-finite / no-budget inputs (never NaN/undefined surfaced); the
  notification call is wrapped so it cannot break the save.
- **G2 — rollback:** PASS. Pure `git revert <merge commit>` + redeploy (frontend/Netlify). No CF, rule,
  collection, or schema touched. The deleted folder is restored by the revert.
- **G3 — monitoring:** N/A. No new write path — the toast is read-only (reads data already on the
  client). The deleted `createApprovalRequest` writer was dead (never invoked). The live time-entry
  write path (`addTimeToTask`) is unchanged.
- **G4 — customer test:** PASS. `budget-crossing.test.ts` (23) proves the crossing scenarios; the
  drift-guard (104) pins thresholds to the admin helper; documented supervised live-smoke for the
  Firebase/DOM-gated toast.
- **G5 — Hebrew UI:** PASS. New toast copy Hebrew, RTL, no emojis.
- **G6 — breaking change:** PASS (declared behavioral change, no contract break). NEW worker toast
  surface + the `levelForPercent` 80→85 row-bar shift. No data field / callable / route / collection /
  token removed. The deleted folder had zero runtime wiring.
- **G7 — security:** N/A. No auth / rules / claims / PII change. `budget_tasks` data is already on the
  client; nothing new is exposed. devils-advocate not required (§3.8.4).

---

## Test plan (for PR body)

- `npx vitest run tests/unit/user-app/budget-crossing.test.ts` → 23/23.
- `npx vitest run tests/unit/user-app/budget-crossing-drift-guard.test.ts` → 104/104 (thresholds +
  labels pinned to `budget-status.js`).
- `npx vitest run tests/unit/user-app/` → 243/243 (no regression).
- `npx eslint <changed user-app JS>` → 0 errors.
- **Supervised live-smoke (Haim's hands — Firebase login + DOM gated, not locally observable):** a
  worker logs time that crosses 85% of a task estimate → sees one "מתקרבים לתקציב" toast after the
  success toast; a further entry crossing 100% → one "חריגת תקציב" toast; logging more while already
  over → no repeat toast.
