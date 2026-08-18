# Rubric — PR-SEC-A2-frontend · Hide the case-creation buttons from non-admins

**Scope:** `apps/user-app` — frontend, security-UX. The **declared fast-follow of #537**. #537 made
`createClient` + `addServiceToClient` admin-only on the BACKEND; the user-app sidebar still showed
"פתח תיק"/"הוסף לתיק קיים" to the 10 non-admin lawyers → they clicked and hit a Hebrew
permission-denied error (a dead-end button). Haim-approved (checkpoint): **hide the buttons entirely**.

**Files:** `js/modules/components/sidebar/sidebar-config.js` (`requiresAdmin` flag on the `new-case`
item), `js/modules/components/sidebar/sidebar.js` (render gate + admin check + auth-subscribe +
click-guard), + 1 new vitest. **No** backend / CF / rules / data change. No `?v=` bump — user-app module
change (matches the #539/C1 precedent: no manual `?v=` needed).

## MUST
- **M1 — the case-creation entry is hidden from non-admins.** The `new-case` nav item (which carries
  BOTH flyout options — new-client + existing-client) is gated; a non-admin lawyer no longer sees it.
  **Live-scope (verified against LIVE code — TWO live entry points, both gated):** three OTHER surfaces also
  open `new CaseCreationDialog().open()` via `eval`, so they were all checked for reachability:
  - **Sidebar `new-case` item** — LIVE → gated by this PR (render-hide + click-guard, M2-M4).
  - **Knowledge Base (`kb-data.js:674` → `knowledge-base.js:626` `eval`)** — **LIVE**: lazy-loaded on the
    first help-trigger click via `authentication.js:350` `lazyLoader.loadScriptsSequentially([… 'kb-data.js',
    'knowledge-base.js'])`, reachable by every logged-in user incl. the 10 lawyers. **Gated by this PR:** the
    `create_case` actionButton carries `requiresAdmin: true` (`kb-data.js`) and `knowledge-base.js`'s render
    only emits the button for a Firestore-role admin (`window.manager.currentEmployee.role === 'admin'`),
    fail-closed — the SAME source the sidebar + backend use. The other two KB action buttons (open-task,
    open-timesheet) are benign (non-admins do those) and stay ungated.
  - **Virtual Assistant (`virtual-assistant-complete.js:1007`) + smart-faq-bot** — genuinely **dead**: their
    `<script>` tags are commented out (`index.html:1366`/`:1369`) AND they appear in no dynamic loader.
  **⚠️ Grader catch (first pass mislabeled the KB "dead"):** an earlier reachability grep checked only
  `<script>` tags + `import()` and MISSED the runtime `lazyLoader.loadScriptsSequentially` injection → wrongly
  called the KB dead. outcomes-grader FAIL caught it; the KB is now correctly gated. Lesson: verify against
  LIVE load paths (incl. dynamic script injection), not just static `<script>`/`import`.
  **Tripwire:** the test asserts (a) VA + smart-faq-bot stay out of BOTH live `<script>` tags AND the
  lazy-loader list, and (b) the KB `create_case` action keeps its `requiresAdmin` flag + render guard.
  The backend (#537) is the hard gate regardless — this is a UX-completeness guard, not a security one.
- **M2 — fail-closed, authoritative role source.** `requiresAdmin` items render **hidden by default**
  (`gh-sidebar-admin-only` + `display:none`) and are revealed ONLY when `window.manager.currentEmployee.role
  === 'admin'` — the **Firestore `employees` doc the backend #537 reads** (`functions/shared/auth.js`
  `checkUserPermissions` → `employee.role`), NOT the ID-token claim (a separate store that can lag → a
  Firestore-admin without the claim would wrongly LOSE the button; the office-manager is exactly such a
  case per the red-team's 5-Firestore-admins vs 4-claimed gap). Read LIVE (sync), so the UI cannot drift.
  Any error / employee-not-loaded → stays hidden. **[devils-advocate GO-WITH-CHANGES: the first pass gated
  on the token claim — corrected to the Firestore source + a main.js reveal-hook + a LIVE click-guard.]**
- **M3 — re-applied when the role is known.** The sidebar renders BEFORE the employee-doc load, so
  `applyRoleVisibility()` runs at init, on `firebase.auth().onAuthStateChanged` (logout → re-hide; unsubscribed
  in `destroy`), AND `Auth.showApp()` (`authentication.js`) — which EVERY live login path (email/pw,
  Google, Apple, SMS-OTP) calls after assigning `manager.currentEmployee` — calls
  `window.sidebarInstance.applyRoleVisibility()`, the reliable reveal trigger. (The first attempt put
  the hook in `main.js`'s `handleAuthenticatedUser`, which is DEAD code / 0 callers → the reveal never
  fired → admins lost the button; devils re-verify NO-GO → moved to `Auth.showApp`.) The click-guard
  reads the role LIVE (`_isAdminNow()`), so security holds even if a visibility trigger is missed.
- **M4 — defense-in-depth click-guard.** `_handleAction` refuses to open the dialog for `new-client`/
  `existing-client` unless `this._isAdmin` (fail-closed). The backend (#537) remains the hard gate.
- **M5 — test.** Source lock (config flag, render hidden, **Firestore-role** check, showApp-reveal wiring,
  click-guard, the VA/smart-faq-bot dead-surface tripwire, the KB `requiresAdmin`+render-guard lock) +
  behavioral (jsdom: fail-closed hidden with no auth; revealed when the role resolves admin; the click-guard
  opens the dialog for an admin and refuses for a non-admin). Full `user-app` vitest suite green; ESLint 0.
  **KB gate coverage — G4/§2.3 note (auditable):** the KB `create_case` render-gate is **source-locked, not
  behaviorally jsdom-tested**, and that is §2.3-COMPLIANT (not a gap): `knowledge-base.js` is a
  self-instantiating classic-script module (`new KnowledgeBase()` at load, `knowledge-base.js:767`) whose
  constructor hard-depends on sibling-script globals (`KB_ARTICLES`/`KB_CATEGORIES`/`KBSearch`/`Logger`/
  `kbAnalytics`) — so a faithful render test needs the whole 5-script graph, and a fully-stubbed harness would
  be the §2.3-forbidden "can't fail in production" test. §2.3 permits manual smoke when integration is
  impractical. The gate's **fail-closed predicate is itself behaviorally proven** by the sidebar tests (same
  `currentEmployee.role === 'admin'`, undefined→hidden), the source-lock proves the KB render *applies* it, and
  the PR body carries the exact manual-smoke steps. (outcomes-grader flagged the missing KB behavioral test as
  a SHOULD; the behavioral test is the right hardening once the KB gets a testable/shared-web module treatment.)

## Gate notes
- **G1:** PASS — the (rare) deny path shows a Hebrew toast ("רק מנהל יכול לפתוח תיק חדש"); no stack/English.
- **G2:** PASS — frontend-only, no data: `git revert <sha>` + supervised Netlify redeploy.
- **G3:** N/A — no write path; visibility only.
- **G4:** PASS — behavioral jsdom test of the hide/reveal + click-guard.
- **G5:** PASS — Hebrew; no UI copy changed except the (best-effort) Hebrew deny toast.
- **G6 — BREAKING (DECLARED):** the 10 non-admin lawyers can no longer SEE the case-creation buttons
  (they already couldn't USE them since #537). Haim-approved (this is the declared fast-follow). Migration:
  none (no data); admins are unaffected. This completes the G6 interim-UX gap declared in #537.
- **G7 — SECURITY-UX follow-up:** completes the #537 authz change at the UI; **devils-advocate MANDATORY**.

## Next
PR-B (hours-locked frontend) — hide renew/add-hours/next-stage/delete on archived/completed services in
the admin card (backend #535 already live). Then the roadmap (H.8).
