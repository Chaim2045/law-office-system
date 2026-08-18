# Rubric — PR: caseOpenDate fix + client-report default range

**Scope:** Admin Panel, frontend-only. Two independent bug fixes surfaced live on client 2026042 (גבריאל טנא).

1. **caseOpenDate save bug** — `ClientManagementModal.js` called `FirebaseService.call('updateClient', …)`, but `FirebaseService` is not defined anywhere in the admin panel → every "עדכון תאריך פתיחת תיק" save threw `ReferenceError` (dead code that never worked). Fixed to the canonical `window.firebaseFunctions.httpsCallable('updateClient')(…)` pattern already used throughout the same file (e.g. `addPackageToService`). The `updateClient` CF already accepts + validates + writes `caseOpenDate` (`functions/clients/index.js:1125`) — backend unchanged.
2. **Client-report default range** — `ClientReportModal.open()` defaulted the quick date-range to `'thisMonth'`, so a client report showed only the current month and hid older time entries (staff perceived older logs as "missing"). Changed the default to `'all'` (= since `caseOpenDate`/`createdAt`) so the full client history is visible by default. Behavioral change (default value) — display-only, no data/count/aggregate change; the user can still pick any range.

Cache-bust `?v=` bumped on `clients.html` (both scripts) + `clients-fluent.html` (ClientReportModal) — mandatory so the browser serves the new JS.

## MUST

- **M1** — caseOpenDate save no longer references an undefined global; uses `window.firebaseFunctions.httpsCallable` (the proven in-file pattern). No `FirebaseService` reference remains.
- **M2** — the `updateClient` CF accepts `caseOpenDate` (verified `functions/clients/index.js:1125`); no backend change required.
- **M3** — the report default-range change is **display-only**: it alters which entries the report *shows*, never any stored count / aggregate / `hoursUsed` / filter key. (ADMIN SAFETY: no count or status moves.)
- **M4** — `?v=` cache-bust bumped on every HTML that loads the two changed JS files (`clients.html` ×2, `clients-fluent.html` ×1).
- **M5** — no PII, no secrets, no stack-trace/`undefined`/`NaN` introduced into customer-visible output; existing Hebrew error text preserved.

## SHOULD

- **S1** — the `'all'` default is commented with its rationale (why it replaced `'thisMonth'`).
- **S2** — a manual DEV smoke plan is documented in the PR body (the change is UI-interaction; no existing unit coverage, impractical to unit-test the inline DOM modal — manual smoke acceptable per Standard §2.3).

## Out of scope (tracked separately)

- The hours-reduction one-off for client 2026042 (separate worktree `lo-2026042-hours`).
- Any backend / `updateClient` change.
- The factual "חריגה" badges vocabulary (H.7.b deferred).
