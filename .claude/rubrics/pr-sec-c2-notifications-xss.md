# Rubric — PR-SEC-C2 · Stored XSS via the shared toast/confirm primitive (admin-panel)

**Scope:** `apps/admin-panel` — frontend, security. Second PR of the PR-SEC-C program.
`Notifications.js` (`window.NotificationManager` / `window.notify`) is the SHARED toast + confirm layer;
it interpolated `title`/`message` (toast) and `title`/`message`/button labels (confirm) RAW into innerHTML.

**Live exploit (reachability, 2026-08-11):** the one live unsafe caller is `UserDetailsModal` delete-hour
→ `NotificationManager.confirm(…entry.action…)`, where `entry.action` is written UNSANITIZED by
`updateTimesheetEntry` (callable by any active employee). A non-admin lawyer stores `<img onerror=…>` in a
timesheet `action`; an admin clicks "delete hour"; it executes in the admin session — **non-admin→admin
escalation**. Fixing the shared primitive is the highest-leverage single fix (protects every current +
future caller); CSP is not a backstop (`script-src 'unsafe-inline'`).

**Files:** `apps/admin-panel/js/ui/Notifications.js` (escaper + sinks) + `?v=` on **all 10** admin pages
that load it (clients, index, clients-fluent, audit-trail, employee-costs, pending-clients, profitability,
reconciliation, settings, system-announcements) + 1 new vitest suite. **No** backend / CF / rules / data change.

## MUST
- **M1 — self-contained escaper.** A 5-entity `escapeHtml` (`& < > " '`) is added to `NotificationManager`.
  It is SELF-CONTAINED (a local map, NOT `window.escapeHtml`) — this component loads on admin pages that may
  not load `core/escape-html.js` first, so a load-order dependency would fail-open. null/undefined → `''`.
- **M2 — every sink escaped; `\n→<br>` preserved.** Toast `title`/`message` (`createNotificationHTML`) and
  confirm `title`/`message`/`confirmText`/`cancelText` route through `this.escapeHtml`. The confirm message
  keeps its intentional `\n→<br>` by escaping FIRST, then converting (`this.escapeHtml(message).replace(/\n/g,'<br>')`)
  — a naive blanket escape would render literal `<br>`. Type-derived FontAwesome icons are untouched (system-controlled).
- **M3 — cache-bust on ALL loaders.** `?v=20260811-pr-sec-c2` on all 10 admin pages loading `Notifications.js`
  (7 were previously UN-versioned → under the `/js/*` immutable cache, returning admins would never fetch the fix).
- **M4 — test.** jsdom: `createNotificationHTML` escapes a malicious title+message (inert, no live `<img>`);
  `confirm` escapes message/title/buttons AND preserves `\n→<br>` (a payload-with-newline is escaped while the
  `<br>` survives); benign input unaffected; source lock (self-contained escaper, every sink via `this.escapeHtml`).
  Full `admin-panel` vitest suite green; ESLint 0 errors.

## Deferred (declared)
- **C2b — the ROOT backend sanitize (separate functions PR).** `updateTimesheetEntry`
  (`functions/timesheet/index.js` :1193/:1562/:1585) writes `action` RAW (unlike the create paths :477/:1078
  which use `sanitizeString`). Closing it needs `sanitizeString` at 3 sites with null/idempotency care in a
  **hazardous** file (`reference_law_office_timesheet_hazards`) — its own focused functions PR (jest + CREATE/
  UPDATE/DELETE review + devils), not this frontend PR. The frontend escape already stops the live exploit at
  the sink; C2b is defense-in-depth for the root + any future sink.
- **🐛 Non-security bug (separate):** many admin toast callers route to an UNDEFINED global
  (`window.NotificationsUI`/`Notifications`/`showNotification`) → fall through to `alert`/no-op → **toasts
  silently don't display**. Real UX bug, unrelated to this fix; flagged for its own PR.
- **C3** — the admin `username` sink (admin→admin) + defense-in-depth batch.

## Gate notes
- **G1/G5:** PASS — no customer-facing string changed; toast/confirm copy unchanged; the escaped value renders
  as the same visible text.
- **G2:** PASS — frontend-only, no data: `git revert <sha>` + supervised Netlify redeploy.
- **G3:** N/A — display-only output-encoding; no write path touched (the backend write gap is C2b).
- **G4:** PASS — jsdom behavioral (toast + confirm inert) + `\n→<br>` preservation + benign control + source lock.
- **G6:** PASS — no breaking change; the intentional `<br>` formatting is preserved (verified by test), so
  multi-line confirms render identically; escaping is display-only. Shared-component behavior otherwise unchanged
  (ADMIN SAFETY RULE: no count/filter/aggregate touched).
- **G7 — SECURITY (this IS the fix):** stored-XSS output-encoding on the shared primitive; **devils-advocate MANDATORY**.
