# Rubric — H.8.0 — Retire the dead user-app OpenAI chat + dormant admin↔user messaging stack

**Title:** H.8.0 — delete the confirmed-dead client-side OpenAI chat + its bundled dormant admin↔user messaging UI from the User App, and unwire the active loader
**App:** User App · **Env:** DEV · **Large deletion (~6,800 LOC), touches app bootstrap → devils-advocate MANDATORY (§3.8.4)**

**Scope:** H.8.0 — the Haim-approved first step of H.8 (§8.10). The User App shipped a client-side OpenAI chat (`apps/user-app/js/modules/ai-system/`) with a **browser-held OpenAI API key** + a "paste `sk-proj-…` into source" setup doc — a latent data-egress liability. A 3-Opus-agent verification proved: (a) the UI is **DEAD on the client** — it only loads behind `initAIChatSystem`'s empty-OpenAI-key gate (`ai-config.js` apiKey `''`, no runtime override), so it never renders for a user; (b) the bundled admin↔user messaging backend is wired but a **PROD `user_messages` read found exactly 3 docs, all Dec-2025, none since → unused** (Haim's "not used at all" confirmed). Haim approved deleting the whole dormant user-app stack now.

**In this PR:**
- DELETE 14 files: the whole `apps/user-app/js/modules/ai-system/` dir (ai-config / ai-engine / ai-context-builder / ai-chat-ui / ThreadView + ai-chat.css + README + SETUP-INSTRUCTIONS), `js/modules/notification-bell.js`, `js/modules/UserReplyModal.js` (+ `.README.md`), `js/modules/notification-realtime-bridge.js`, `js/config/message-categories.js`, `css/thread-view.css`.
- UNWIRE the active loader/lifecycle: `authentication.js` (remove the `initAIChatSystem` lazy-loader fn + its 3 call sites + the export); `main.js` (remove the `this.notificationBell` field, the eager-start block in the user-profile load — which today already spams a `console.error('⚠️ CRITICAL …')` on every login — the bell branch of the auth listener **renamed** `setupNotificationBellListener` → `setupServicesAuthListener` keeping the announcement-ticker/popup logic, the bell line in `cleanup()`, the bell `updateFromSystem` block, the `initAIChatSystem` wrapper method, and the global `window.notificationBell = manager.notificationBell` expose); `index.html` (remove the `ai-chat.css` + `thread-view.css` `<link>`s + a stale comment).
- ADD `tests/unit/user-app/openai-chat-removed.test.ts` (18 guards: files deleted + the active wiring unwired + the rename).

**Excluded (intentional — tracked follow-up chip `task_f92d50db`):** the CROSS-APP remnants (`AlertCommunicationManager` admin sender, the WhatsApp CF `task_approval` write, the `user_messages` Firestore rules); the peripheral GUARDED consumer no-ops (`navigation.js`, `client-validation.js`, the `index.html` `clearAllNotifications` helper + the orphaned `#notificationsDropdown` markup); the pre-existing unguarded ref in dead/never-instantiated `client-hours.js`; `dist/` (NOT served — Netlify serves source; repo convention is not to rebuild dist in source PRs).

## MUST (block on FAIL)
- **M1** — all 14 stack files are deleted (the guard test asserts each).
- **M2** — the active loader is fully removed: `initAIChatSystem` no longer exists anywhere in `apps/user-app/js`, so the every-login `loadScript('…/ai-config.js')` (which ran BEFORE the key-gate) can no longer 404 on the now-deleted file. The export and all 3 call sites are gone.
- **M3** — NO dangling HARD (unguarded) reference to a deleted symbol on a path that ACTUALLY RUNS → no new ReferenceError/TypeError at runtime. (Remaining `window.notificationBell` refs are all `if (window.…)`/`?.`-guarded safe no-ops in peripheral/commented-out files — out of scope.)
- **M4** — `main.js` bootstrap is structurally + logically intact: the renamed `setupServicesAuthListener` preserves the announcement-ticker + popup init/cleanup; `await this.loadData()` / `showApp()` / `cleanup()` of other resources are untouched; both edited files pass `node --check`.
- **M5** — ZERO behavioral change for users: the deleted stack was dormant (gated behind the empty key; never loaded/rendered — verified) and the messaging feature is unused (PROD 3-doc check). Deleting it removes nothing a user currently sees. (Bonus: it also silences an existing per-login `console.error` spam.)
- **M6** — a guard test locks the removal (`openai-chat-removed.test.ts`, 18 assertions, GREEN) AND the full user-app unit suite is green apart from the pre-existing environmental `zod`-resolution artifact in `israeli-id-drift-guard.test.ts` (fresh-worktree partial node_modules; passes in CI — unrelated to this PR).
- **M7** — devils-advocate (MANDATORY for this >100-line bootstrap deletion) returned **GO** with 0 critical attacks; the 🟡/🟢 are pre-existing or the tracked follow-up.

## SHOULD
- **S1** — the renamed listener has an accurate name + comment (no stale "NotificationBell" naming left on the kept ticker/popup method).
- **S2** — the PR body explicitly lists the out-of-scope follow-up (cross-app sender/CF/rules + peripheral guarded consumers + orphaned markup + dist) so no future session thinks the feature is fully gone.
- **S3** — the security framing is stated: the removed liability was a browser-held OpenAI key + a "paste your key into source" doc.

## Test plan
`tests/unit/user-app/openai-chat-removed.test.ts` — **18 source-contract guards**: each of the 14 files is gone + the ai-system dir is gone; `authentication.js` has no `initAIChatSystem`/`ai-system/`/`NotificationBellSystem`; `main.js` has no `this.notificationBell`/`window.aiChat`/`window.AIChatUI`/global-bell-expose/`initAIChatSystem` and uses `setupServicesAuthListener` (not `setupNotificationBellListener`) with `announcementTicker` preserved; `index.html` no longer links `ai-chat.css`/`thread-view.css`. Ran GREEN (18/18). Full user-app suite: **215/215 tests pass** (1 file env-`zod` artifact, pre-existing). `node --check` OK on both edited JS files. Browser-preview verification N/A — the change removes dormant code that never rendered (no observable UI delta); correctness is proven by the dormancy verification + the source guards + `node --check`.

## Rollback
`git revert <merge-commit>` + redeploy (frontend; Netlify serves source). Restores the (dormant, inert) stack exactly. No data migration, no schema/rule/CF change (the cross-app backend + `user_messages` collection are untouched by this PR).

## PRODUCT-GRADE GATES
- **G1 PASS** — no customer-facing error path changed; in fact removes an existing per-login `console.error('⚠️ CRITICAL …')` dev-spam. No stack-trace/undefined/English leak introduced.
- **G2 PASS** — `git revert` rollback (code-only deletion).
- **G3 N/A** — no data mutation; read/write paths to `user_messages` (admin sender + CF) are UNCHANGED (out of scope). This PR only deletes a frontend reader that never ran.
- **G4 PASS** — for a deletion, the customer-relevant proof is (a) dormancy verification (the UI never loaded; PROD feature unused) and (b) the 18-assertion guard test locking the removal + 215/215 suite green. No live behavior to integration-test (nothing rendered).
- **G5 N/A** — no customer-facing strings added; deleted Hebrew strings belonged to a UI that never displayed.
- **G6 PASS (declared)** — no breaking change: the deleted stack was unreachable at runtime (empty-key gate); zero contract/data/route/default change for users. The kept-but-renamed `setupServicesAuthListener` is internal.
- **G7 PASS** — security-positive: removes a latent browser-held-OpenAI-key data-egress liability + the "paste `sk-proj-…` into source" instructions. No auth/rules/PII surface is *added* or loosened; the `user_messages` rules are untouched (out of scope).

VERDICT: PASS
