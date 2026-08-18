# Rubric — PR-B · A closed service hides add-hours / stage-advance in the admin management card

**Scope:** `apps/admin-panel` — frontend, admin-critical, display. The **frontend follow-up of #535** (backend
"closed services refuse new hours", `functions/shared/service-status.js`). Until now the management card still
SHOWED "חדש שעות" / injected "הוסף שעות" / "עבור לשלב הבא" on a CLOSED (archived/completed) service → a dead-end
(click → raw permission error from #535). Haim-approved checkpoint (2026-08-16).

**Files:** `js/ui/UnifiedServiceCard.js` (`buildActions` gate + `serviceIsClosed` mirror + `buildActions` test
seam), `js/features/AddPackageToStage.js` (injector: explicit per-service identity + closed gate + mirror),
`clients.html` (`?v=` bump ×2), + 1 new vitest. **No** backend / CF / rules / data change.

## MUST
- **M1 — a CLOSED service hides add-hours + stage-advance; keeps the reopen path.** On a service whose
  `status ∈ ['archived','completed']`, the management card no longer offers: `buildActions` "חדש שעות" (renew,
  hours), `buildActions` "עבור לשלב הבא" (next-stage, legal), and the injected "הוסף שעות" (AddPackageToStage).
  **"שנה סטטוס" (the ONLY reopen path, per service-status.js) and "מחק" STAY visible.** "סמן כהושלם" already
  showed only for `status==='active'` (unchanged).
- **M2 — SSOT mirror, fail-open-to-active-by-DEFAULT.** The frontend gate mirrors the backend
  `HOURS_LOCKED_STATUSES = ['archived','completed']` (`functions/shared/service-status.js`) — NOT re-deriving a
  different set. `on_hold` stays OPEN; `completed` is hours-locked yet still aggregates (do NOT reuse the
  aggregation set). A service with no `status` defaults to `'active'` → open (mirrors `svc?.status||'active'`).
  A cross-file **drift-guard test** pins BOTH frontend mirrors to the backend literal.
- **M3 — the injector uses EXPLICIT per-service identity (PR #544 principle), not first-match.** Each
  `.management-stage` resolves ITS OWN service via the parent `.management-service-card[data-service-id]`
  (= `service.id`, per `ServiceCardModel`), NOT `client.services.find(s => s.type==='legal_procedure')` (which
  processed only the FIRST legal procedure → a 2nd/3rd active service got NO button; a CLOSED first service got
  one). It REFUSES to guess when the owning service can't be identified (no cross-service contamination), gates
  hourly + closed PER service, and passes the CORRECT `service.id` to `openDialog` (not the first procedure's).
- **M4 — frontend-only; backend is the hard gate.** No backend/CF/firestore-rules/data change. The backend
  #535 (`assertServiceAcceptsHours`) remains the enforcement; this PR only removes the dead-end button so the
  admin never reaches a raw error. No `?v=`-less deploy: `clients.html` bumps both changed scripts.
- **M5 — test.** Behavioral (jsdom): `buildActions` — a closed (archived + completed) service hides
  renew/next-stage but keeps change-status/delete; an open service shows them; no-status → open. Injector —
  the live מידר-אלעד shape (client 2025364: [0] archived+hourly / [1]+[2] active+hourly) → exactly 2 buttons,
  NONE on the archived service, one on each active service (proves both bugs). + the cross-file
  `HOURS_LOCKED_STATUSES` drift-guard. Full `admin-panel` vitest suite green; ESLint 0 errors.

## Gate notes
- **G1:** PASS — no new customer-facing error text. The injector's skip paths are dev `console.log` only; the
  (rare) real deny stays the backend #535 Hebrew message. No stack/English added.
- **G2:** PASS — Rollback: `git revert <sha>` + supervised Netlify redeploy. Frontend-only, no data/schema.
- **G3:** N/A — visibility only; no write path (the injector's WRITE is `addHoursPackageToStage`, unchanged +
  backend-gated).
- **G4:** PASS — behavioral jsdom tests of the render gate (buildActions) + the injector (real DOM, real
  addButtonsToStages, the live מידר shape) + drift-guard. Manual DEV smoke in the PR body.
- **G5:** PASS — Hebrew; no UI copy changed (buttons are removed on closed services, not relabeled).
- **G6 — BREAKING (DECLARED):** on a CLOSED service the admin no longer SEES add-hours / next-stage in the
  management card (they were un-usable dead-ends since #535). Haim-approved at the checkpoint (hide add-hours +
  next-stage; keep change-status + delete). Migration: none (no data). Admins reopen via "שנה סטטוס".
- **G7:** N/A — no auth/PII/permissions/rules change; frontend display only. The authz for these actions is
  #535/#536 (unchanged). Injector identity fix is a correctness change, not an authorization change.

## Out of scope (flagged, NOT touched)
- **Stage-status-on-archived data issue** — a closed service can still carry an `active` stage (closing never
  resets stage statuses; live in מידר srv_0). Data/aggregate concern → OWN-*/single-owner track (chip spawned).
- **Dead `ClientManagementModal.getServiceActions:944`** (duplicate renew/next-stage, unwired per `:426`) —
  left as-is; flagged for the dead-code cleanup track (deleting it risks the test-coupled `getServiceInfo`).

## Next
Resume MASTER_PLAN H.8 (AI chat) or Haim's choice.
