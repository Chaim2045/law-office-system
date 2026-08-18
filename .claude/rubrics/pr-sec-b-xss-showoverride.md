# Rubric — PR-SEC-B · Stored XSS in the admin override modal (output-encoding fix)

**Scope:** `apps/admin-panel` — frontend, security. Follows PR-SEC-A/A2. A security red-team
(2026-08-10) found `ClientManagementModal.showOverrideModal` interpolating a **raw service name**
into `modal.innerHTML`. The `data-name` attribute escape is defeated by a dataset decode round-trip
(the click handler reads `btn.dataset.name` — browser HTML-decodes it — and passes the raw string to
the sink), so a service named `<img src=x onerror=…>` executed script in the admin's session.

**Severity reframe (verified against live code):** post-#537 every writer of `service.name` is
`role==='admin'`-gated, so the live exploit class is **admin→admin** (a rogue/compromised admin plants
the payload; it fires in another admin's session). Output-encoding at the sink is the correct fix
regardless of the writer surface, and CSP is **not** a backstop here (`script-src 'unsafe-inline'`).

**Files:** `apps/admin-panel/js/ui/ClientManagementModal.js` (`showOverrideModal` :283/:291),
`apps/admin-panel/js/features/ServiceOverdraftResolution.js` (`createOverdraftUI` id attrs),
`apps/admin-panel/clients.html` (`?v=` on both scripts), + 1 new jsdom test. **No** backend / CF /
rules / data change.

## MUST

- **M1 — the live sink is escaped.** Both `showOverrideModal` titles (active :283 + inactive :291)
  route the name through the SSOT escaper: `${this.escapeHtml(serviceName)}` (`this.escapeHtml` →
  `window.escapeHtml`, `js/core/escape-html.js`, 5-entity `& < > " '`, loaded first on `clients.html`).
- **M2 — overdraft ids escaped (defense-in-depth).** `data-service-id` / `data-client-id` in
  `createOverdraftUI` (:654/:655/:697/:698) wrapped in `this.escapeHtml(...)`. Zero behavior change:
  ids are backend-generated (`srv_<ts>` / Firestore auto-ids, no metachars) and the button handlers use
  **closures**, not `dataset` reads — so this is pure hardening.
- **M3 — cache-bust.** `?v=` bumped on BOTH `ClientManagementModal.js` and `ServiceOverdraftResolution.js`
  in `clients.html` (the `/js/*` assets are served `immutable`, 1-year — without a `?v=` bump returning
  admins never fetch the fix).
- **M4 — test proves the customer scenario.** A jsdom test drives `showOverrideModal` with a
  `<img onerror>` name and asserts an INERT render (escaped text, no live `<img>`, `onerror` never fires)
  in BOTH branches, plus a benign name unaffected (no over-escaping) + a source lock. Full `admin-panel`
  vitest suite green; ESLint 0 errors.

## Deferred (declared — NOT in this PR, so a reviewer sees they were found, not missed)
- **Dead-code deletion (out of scope after investigation).** The unwired `renderServiceCard` cluster
  contains its own latent (0-runtime-caller, non-exploitable) sinks. The completeness-checker cleared
  `renderServiceCard`/`renderStages`/`getServiceActions` as dead, but `getServiceInfo` is **exercised by
  8 unit tests** (the U1 stored-`hoursUsed` SSOT regression suite) → not cleanly dead. Deleting it needs a
  proper test migration (repoint U1 to the live `UnifiedServiceCard` renderer) — a separate cleanup PR,
  not this security fix.
- **The XSS class (PR-SEC-C program).** The sweep found ~8 more HIGH raw-`innerHTML` sinks (admin:
  `UserDetailsModal` avatar/username/activity/internal-clientName, `UsersTable` avatar,
  `DeleteDataSidePanel` header, the shared `Notifications.js` toast/confirm primitive; user-app:
  `client-case-selector` / `case-creation-dialog` client name). Several are potentially **non-admin→admin**
  (employee-settable displayName/photoURL rendered in an admin session) pending a reachability check —
  tracked as the PR-SEC-C program, sequenced after this PR.

## Gate notes
- **G1/G5:** PASS — no customer-facing string changes; the modal text is unchanged Hebrew, the name now
  renders as inert text.
- **G2:** PASS — `git revert <sha>` + supervised redeploy (frontend-only, no data).
- **G3:** N/A — display-only; no write path touched.
- **G4:** PASS — behavioral inert-render test (both branches) + benign-name control + source lock.
- **G6:** PASS — **no breaking change.** Escaping is display-only; a service name that legitimately
  contains `&`/`<`/`"` now renders correctly as text (innerHTML text context decodes entities back). The
  value reaches the sink raw (dataset-decoded), so a single escape is correct (no double-escape). No data,
  schema, contract, or count/filter change (ADMIN SAFETY RULE).
- **G7 — SECURITY (this IS the fix):** stored-XSS output-encoding; **devils-advocate MANDATORY**.
