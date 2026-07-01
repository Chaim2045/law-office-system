# Rubric — H.8.0 follow-up PR2 — admin-panel messaging decommission

**Title:** H.8.0 follow-up (PR2) — retire the admin-panel half of the dead admin↔employee `user_messages` messaging
**App:** Admin Panel · **Env:** DEV · **frontend-only deletion (no firestore.rules / CF / claims / auth-logic / schema) → devils-advocate NOT triggered (§3.8.4); the rules + indexes change is PR4 (which DOES carry devils-advocate + a deny-suite).**

**Scope:** PR2 of the Haim-approved 4-PR retirement of the obsolete admin↔employee `user_messages` messaging. The investigation overturned #411's "read by nothing" premise — `user_messages` was live on the **admin** side (admin bell wired on login, `AlertCommunicationManager`, `UserDetailsModal`, `getUserFullDetails`). PR2 removes every **client-side** reader/writer of `user_messages` in the admin panel (the backend `getUserFullDetails` read + the dead WhatsApp writes are PR3; the `firestore.rules` block + indexes are PR4). Haim approved "full + G6" at the checkpoint (one atomic PR — the components cross-reference via `window.alertCommManager`/`window.adminThreadView` globals, so splitting would ship a dangling-ref mid-state).

**In this PR:**
- **DELETE 8 files:** `js/managers/AlertCommunicationManager.js`, `js/ui/AdminThreadView.js`, `js/ui/QuickMessageDialog.js`, `js/ui/MessagesFullscreenModal.js`, `js/config/message-categories.js`, `css/admin-thread-view.css`, **`css/message-categories.css`** (the map missed this one — found in the head links), `js/modules/notification-bell.js` (the admin copy — a loaded-but-invisible `onSnapshot` listener that rendered to non-existent DOM).
- **`index.html`** — remove the 5 messaging `<script>` tags + 2 messaging CSS `<link>`s + the notification-bell tag/presence-check + the `alertCommManager` init/`listenToResponses` block (which fed `UsersTable.loadResponseCounts`). **KEEP** `UserAlertsPanel.js` (unrelated).
- **`js/core/auth.js`** — remove the 2 NotificationBell wiring blocks (logout cleanup + the `startListeningToAdminMessages` start on dashboard-ready).
- **`js/ui/UsersTable.js`** — remove the **"הודעות" column** (`{ key:'messages' … }`) + `responseCounts`/`loadResponseCounts`/`refreshMessageBadges`/`renderMessageBadge`/`handleMessageBadgeClick` + the per-row `<td>` + the badge click binding.
- **`js/ui/UserDetailsModal.js`** — surgical excision of the messaging slice: 18 messaging-only methods deleted + fragments in kept methods. **The crux** = `loadFromFirestore`'s `Promise.all` re-indexed from 5→4 elements (dropped the `user_messages` query + `messagesSnapshot` destructure + the "Process messages" block + the `messages` field in `this.userData`), done by the Lead Agent and independently verified. The 6 non-messaging tabs (general/clients/tasks/hours/performance/activity) + shared helpers (`escapeHtml`/`renderInfoRow`/`renderStatCard`) are intact. File shrank ~1210 lines.
- **Tests:** update the two escapeHtml-SSOT routing guards (`escapehtml-ssot-pr2-routing` count 16→14 + drop the 2 deleted files from the consumer lists; `escapehtml-ssot-pr3a-routing` drop the deleted-notification-bell block) since they asserted on now-deleted files; ADD `tests/unit/admin-panel/messaging-decommission-removed.test.ts` (the PR2 regression guard).

**KEPT (intentional — separate dead-component decision):** `UserAlertsPanel.js` — a dead, never-instantiated alerts panel whose **guarded** `window.quickMessageDialog` ref (`:260` `if (window.quickMessageDialog)` → `else { showError('דיאלוג הודעות לא זמין') }`) degrades by design now that QuickMessageDialog is gone; the method (`handleSendMessage`) never runs (class never instantiated). The map originally claimed QuickMessageDialog's only consumer was a dead `UserDetailsModal` method — it MISSED this dead `UserAlertsPanel` consumer; corrected here. Whole-component fate is a separate decision (with the disabled FAQ-bot/VA from PR1b).

## MUST (block on FAIL)
- **M1** — the 8 files are deleted (the guard test asserts each); nothing in `apps/admin-panel` (excl. dist) still references `alertCommManager` / `AlertCommunicationManager` / `adminThreadView` / `AdminThreadView` / `messagesFullscreenModal` / `MessagesFullscreenModal` / `window.notificationBell` / `user_messages` / `MessageCategories` (whole-panel grep → ZERO; the ONLY surviving `quickMessageDialog` ref is the intentional guarded one in `UserAlertsPanel`).
- **M2** — **the `loadFromFirestore` Promise.all is re-indexed correctly to 4 elements** (`[clientsSnapshot, tasksSnapshot, timesheetSnapshot, activitySnapshot]`); no `messagesSnapshot`; the clients/tasks/hours/activity tabs still map to the right snapshot (ADMIN SAFETY — the single most error-prone edit).
- **M3** — the 6 non-messaging tabs + shared helpers survive in `UserDetailsModal`; the modal renders all tabs (manual smoke).
- **M4** — `node --check` passes on `UserDetailsModal.js`, `UsersTable.js`, `auth.js`; `index.html` stays valid.
- **M5** — ZERO behavioral change for **employees/users** (the feature was admin-only and end-to-end-broken since #411 — employees couldn't see/reply); the only behavioral change is **admin-visible** (G6 below) and removes an obsolete, near-unused feature (PROD: 3 `user_messages` docs, all Dec-2025).
- **M6** — the guard test (`messaging-decommission-removed.test.ts`) is GREEN; the full admin-panel unit suite is GREEN (284/284); the full root unit suite is GREEN (808 pass / 2 skip).
- **M7** — no dangling reference to a deleted file in a **loaded** script (the `UserAlertsPanel` ref is guarded + the component is never instantiated → inert; documented).

## SHOULD
- **S1** — the PR body declares the G6 admin-visible removals (the "הודעות" column + the send-message/view-conversation buttons) and lists the deferred PR3 (backend `getUserFullDetails` + the full dead WhatsApp flow) + PR4 (rules + indexes + devils-advocate + deny-suite).
- **S2** — the map-miss (the extra `css/message-categories.css` + the `UserAlertsPanel` QuickMessageDialog consumer) is surfaced, not silently swallowed.

## Test plan
`tests/unit/admin-panel/messaging-decommission-removed.test.ts` — source-contract guards: the 8 files deleted; `index.html` unwired (no messaging loads / no `alertCommManager` init / no `window.notificationBell`) while KEEPING `UserAlertsPanel.js`; `UserDetailsModal` free of the messaging symbols + the Promise.all re-indexed to 4 + the 6 tabs/helpers present; `UsersTable` free of the "הודעות" column + response-counts; `auth.js` free of bell wiring. Ran GREEN. Updated the 2 escapeHtml-SSOT routing guards (now GREEN, 28). Full admin-panel suite **284/284**; full root suite **808 pass / 2 skip**. `node --check` OK on the 3 edited JS files; whole-panel deleted-symbol grep = ZERO (excl. the intentional guarded `UserAlertsPanel` ref).
**Manual smoke (G4 — DEV, since the modal needs auth + Firestore, an integration test is impractical):** open the Admin Panel → Users page → confirm the table renders with NO "הודעות" column and no console error → open a user's details modal → click each of the 6 tabs (general/clients/tasks/hours/performance/activity) and confirm each renders its data → confirm the footer has "הפק דוח" + "סגור" and no "שלח הודעה" → log out/in (confirm no NotificationBell console error).

## Rollback
`git revert <merge-commit>` + redeploy (frontend; Netlify serves source). Restores the (dead/near-unused) admin messaging UI exactly. No data migration, no schema/rule/CF change (the `user_messages` collection + rules + `getUserFullDetails` are untouched by PR2).

## PRODUCT-GRADE GATES
- **G1 PASS** — no customer-facing error path changed; the deletion removes a loaded-but-invisible bell listener + an admin column. No stack-trace/undefined/English leak introduced. (The kept `UserAlertsPanel` guarded `else` shows a Hebrew "דיאלוג הודעות לא זמין" — but that method never runs.)
- **G2 PASS** — `git revert` rollback (code-only frontend deletion; no CF deleted → no `firebase functions:delete` step needed).
- **G3 N/A** — no data write/read path is added or changed; PR2 only removes client-side readers/writers. The `user_messages` collection is untouched (PR4).
- **G4 PASS** — for a deletion the customer-relevant proof is (a) the source-contract guard + 284/284 admin suite + 808 root suite, (b) `node --check` + the whole-panel ZERO grep, and (c) the documented manual 6-tab smoke. The riskiest edit (the Promise.all re-index) has a dedicated assertion.
- **G5 N/A** — no customer-facing strings added; the removed Hebrew belonged to the retired messaging UI.
- **G6 PASS (declared behavioral change)** — admin-visible: the UsersTable "הודעות" column + the UserDetailsModal "שלח הודעה"/"שלח הודעה ראשונה"/"צפה בשיחה" buttons disappear. No migration needed — the feature was admin-only, end-to-end-broken since #411, and near-unused (PROD 3 Dec-2025 docs). No data schema / API contract / route / default-behavior break (the `user_messages` collection + the `getUserFullDetails` return shape are UNCHANGED in PR2).
- **G7 N/A** — no auth/authorization logic, Firestore rules, PII-handling, or permissions changed; `auth.js` edits only remove a listener-start call. (Security review + devils-advocate apply at PR4, which removes the `user_messages` rules.) PR2 is security-neutral-to-positive: it removes a UI that displayed message content.

VERDICT: PASS
