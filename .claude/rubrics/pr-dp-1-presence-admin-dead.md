# Rubric — PR-DP-1: delete the dead admin presence-system copy (גל-3ג duplicates)

**Scope:** DEAD-CODE removal (admin-panel). The map flagged `presence-system.js` as the "most dangerous" cross-app duplicate (drifted Firestore writes). A read-only specialist investigation DISSOLVED the danger: the admin copy is **loaded-but-never-invoked** (0 callers in admin-panel), so its divergent write never executes. This PR deletes the dead admin copy + its 2 `<script>` loaders, KEEPING the live user-app copy. No rules/schema/migration → no devils-advocate.

## MUST
- **M1 — exactly the dead admin copy + its 2 loaders removed:** delete `apps/admin-panel/js/modules/presence-system.js` (452 lines) + the `<script defer src="js/modules/presence-system.js?v=…">` tags at `apps/admin-panel/index.html:229` and `apps/admin-panel/workload.html:84`. Diff = exactly these 3 changes + the exec-log doc.
- **M2 — admin genuinely never invokes it (behavior-preserving).** Verified: `grep PresenceSystem|listenToOnlineUsers|.connect(` over `apps/admin-panel/**/*.js` returns ONLY the deleted module — 0 callers. The divergent admin write (`lastLogin`/`loginCount`) never ran → deleting it is 0 behavior change.
- **M3 — KEEP the live user-app copy.** `apps/user-app/js/modules/presence-system.js` is the sole invoker path (`authentication.js` calls `connect()`/`disconnect()`) and MUST remain untouched (verified still tracked).
- **M4 — the fields the admin panel READS still get written.** `lastLogin`/`isOnline`/`lastSeen` (read by admin managers+tables) and `loginCount` (read by user `authentication.js`+functions) are all written by the user-app (`authentication.js:150` + the live `connect()`), NOT by the deleted admin copy. So no consumer loses its data source.
- **M5 — exec-log maintained (anti-drift).** `docs/HEALTH-MAP` exec-log gains the DP-1 row (+ flips DB-4 #485 to ✅ מוזג, closing גל-3ב). Additive only.

## PRODUCT-GRADE GATES
- **G1** N/A — removal only.
- **G2 (rollback):** `git revert <sha>` restores the file + the 2 `<script>` tags. Trivial, frontend-only.
- **G3** N/A — no data path added/changed (the deleted write never ran; the live user-app write is untouched).
- **G4** N/A — dead module with 0 admin callers; CI admin-panel build + vitest catch a stray reference.
- **G5** N/A — no customer strings (module never ran in admin).
- **G6** N/A — no live consumer transition (admin never invoked it; consumers read fields written by the user-app, unchanged).
- **G7 (security):** N/A — presence display/dead-code only; no auth/PII/rules change. (Firestore rules already allow all 4 fields for a self-write; not touched.)

## Anti-premature-closure
- CI (admin-panel build + vitest) must be green — removing a never-invoked module + its 2 loaders cannot break a live call path; verified 0 admin callers.
- **Reframe recorded:** the map's "most-dangerous drifted duplicate" was a LATENT divergence (admin copy inert). If admin is EVER wired to track its own presence, that is a NEW feature decision (parameterized SSOT + build-copy into both Netlify roots) — explicitly out of scope here.
- Remaining גל-3ג pairs (separate PRs): `service-card-renderer` (48-line diff), `client-case-selector` (107-line diff), `logger`, `system-constants` — each re-investigated before acting (a drifted copy may be live-live, unlike this one).
