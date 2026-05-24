# Rubric — PR-G.3.6: defer holidays-cache Firestore subscription until auth ready

**Scope:** `apps/user-app/js/shared/holidays-cache.js` (+ byte-identical sibling at `apps/admin-panel/js/shared/holidays-cache.js`). Frontend-only fix for a bug discovered during PR-G.3.3 smoke (2026-05-20). No backend / functions changes.

**Bug:** `holidays-cache.js` boot calls `_init()` immediately after `firebase.apps.length > 0`, subscribing to `system_holidays/{year}` via `onSnapshot` before `firebase.auth().currentUser` resolves. Firestore rules require `isAuthenticated()` → silent permission-denied → 5s timeout → embedded fallback engages. Every cold-load user gets stale single-year embedded data instead of live multi-year Firestore.

**Fix:** wrap `_init()` invocation in `auth().onAuthStateChanged(user => ...)`. Handle null transitions (logout / pre-auth), idempotency on re-login, race between timeout and late auth resolve.

## MUST (10) — blocking

1. **No `onSnapshot` call before auth resolves to non-null user.** `_init()` invocation lives inside the `onAuthStateChanged(user => { if (user) { ... _init(); } })` handler. *Evidence:* grep `holidays-cache.js` shows `_init()` only invoked from `_bootWhenAuthReady` or `WORK_HOURS_HOLIDAYS_REFRESH`; unit test asserts no Firestore subscription before first auth event.

2. **Cold-load with cached session reads live Firestore.** When `auth.currentUser` resolves quickly (typical SESSION persistence path), holidays come from Firestore — not embedded fallback. *Evidence:* DEV smoke: cold-load + cache-bust + `window.WORK_HOURS_HOLIDAYS_FALLBACK_USED === false` within 3s.

3. **Re-login idempotency.** `onAuthStateChanged` firing twice with the same UID does not create duplicate Firestore subscriptions. *Evidence:* unit test triggers two auth events with identical UID; `_unsubs.length` stays constant; uid-guard skip path covered.

4. **Logout tears down subscriptions.** When `onAuthStateChanged` fires with `null` after a non-null user, every active `_unsubs` entry is invoked; `_yearsLoaded` cleared; `_holidaysByYear` cleared. *Evidence:* unit test asserts every unsub spy called exactly once on null transition; no permission-denied errors emitted post-logout.

5. **Race protection on null→user under timeout.** If `AUTH_WAIT_TIMEOUT_MS` fires before user resolves (engaging fallback), then user resolves later, `_init()` still runs cleanly. Fallback flag flips to false via `_rebuildMap` once real snapshot arrives. *Evidence:* unit test simulates user arrival post-timeout; asserts subscriptions register, no double-source, `WORK_HOURS_HOLIDAYS_FALLBACK_USED === false` after first snapshot.

6. **`WORK_HOURS_HOLIDAYS_READY` Promise resolves in all 4 paths.** (a) Firestore success, (b) embedded fallback after timeout, (c) firebase-init timeout, (d) auth() unavailable. None hang; none reject. *Evidence:* 4 unit tests, each `await window.WORK_HOURS_HOLIDAYS_READY` with explicit assertion.

7. **Logout resets the READY promise.** After logout, `window.WORK_HOURS_HOLIDAYS_READY` becomes a fresh unresolved promise so post-logout awaiters wait for re-login. *Evidence:* unit test reads promise reference pre/post logout, asserts they differ.

8. **Memory: `onAuthStateChanged` unsub captured.** `_authUnsub` is stored at module scope, not discarded. Prevents listener leak on SPA re-init. *Evidence:* grep shows `_authUnsub = auth.onAuthStateChanged(...)`.

9. **`AUTH_WAIT_TIMEOUT_MS` constant with inline rationale.** Value lives in the Configuration section near top of file with a comment explaining the 6000ms choice (covers slow IndexedDB session restore; under perceptual "broken" threshold). *Evidence:* `git diff` shows constant + comment in both copies.

10. **Both app copies byte-identical.** `diff -q apps/user-app/js/shared/holidays-cache.js apps/admin-panel/js/shared/holidays-cache.js` returns no output. *Evidence:* CI step or PR description showing diff output.

## SHOULD (4) — non-blocking

1. **`MAX_BOOT_POLL_ATTEMPTS` cap on firebase-init polling.** Prevents infinite retry if firebase never initializes. *Evidence:* constant + check in `_bootWhenAuthReady`.

2. **try/catch around `firebase.auth()` call.** Defensive against init errors. Engages fallback on throw. *Evidence:* grep shows `try { auth = window.firebase.auth(); } catch`.

3. **Same-user UID guard.** Skip re-init when `onAuthStateChanged` fires twice for the same uid (token refresh, etc). *Evidence:* `_lastUserUid` compare in handler.

4. **Inline JSDoc for `_bootWhenAuthReady`.** Explains lifecycle (poll → subscribe → user resolve → logout teardown → timeout fallback). *Evidence:* JSDoc block present.

## Out of scope (defer)

- Field-level rules to expose `holidaysAuto` publicly (PR-G.3.7 candidate)
- Moving `_overrideMeta` to admin-only audit subcollection (PR-G.3.7 candidate)
- Removing BC `data.holidays` fallback (PR-G.3.5 — after one cron cycle)
- Cron rewrite to populate `holidaysAuto` field on existing docs (admin trigger, separate task)

## Test outputs required

- Vitest: existing `tests/unit/user-app/holidays-cache-merge.test.ts` PASS (all current tests + new G.3.6 block).
- Jest: `functions/tests/*` PASS unchanged (no backend code touched).
- Lint: 0 errors.
- DEV smoke (after merge): cold-load fallback=false; logout → no permission-denied spam; re-login → fresh map.
