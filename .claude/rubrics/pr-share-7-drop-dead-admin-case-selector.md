# Rubric — PR-SHARE-7: delete the dead admin client-case-selector (גל-3ג — CLOSES the wave)

**Scope:** DEAD-CODE removal (admin-panel). A thorough read-only investigation (Opus, SHARE-7 checkpoint) found the admin copy of `client-case-selector.js` is LOADED-BUT-NEVER-INSTANTIATED (0 `new ClientCaseSelector`, 0 container, 0 consumer of its globals) — the last cross-app duplicated pair is not a live-live unify, it's a fossil. Origin: copied 2025-10-18 (f15943d, "client→cases" refactor); had real admin use in 2025-11/12; orphaned when the admin creation dialogs (`SimpleClientDialog`/`case-creation-dialog`) were deleted in H.6.c #454. Haim-approved deletion. No rules/schema/migration → no devils-advocate (pure dead-code removal, mirrors DP-1 presence-system).

## MUST
- **M1 — exactly 2 changes:** delete `apps/admin-panel/js/modules/client-case-selector.js` + remove its `<script defer src=...>` tag at `apps/admin-panel/clients.html:619`. Diff = exactly these 2 + the exec-log doc.
- **M2 — admin copy genuinely dead (verified).** 0 `new ClientCaseSelector` in admin (only the doc-comment in the file itself); 0 external consumer of `window.ClientCaseSelector`/`clientCaseSelectorInstances`/`cleanupClientCaseCache`; no container element in `clients.html`; the module's only load-time side effects are 3 window-global assigns + a log (the Firestore clients listener attaches ONLY inside the constructor, which never runs). → deleting it is 0 behavior change on admin.
- **M3 — KEEP the live user-app copy.** `apps/user-app/js/modules/client-case-selector.js` is the sole live implementation (3 live instantiations: `selectors-init.js:42/80` budget+timesheet, `case-creation-dialog.js:1918`). MUST remain untouched (verified still tracked). No cross-app twin remains → nothing to drift against; this module never needs shared-emit coverage.
- **M4 — no dangling reference.** After the change, `grep client-case-selector|ClientCaseSelector` over `apps/admin-panel/**` (html+js, excluding the deleted file) returns 0.
- **M5 — the 189-diff feature gap is RECORDED (not silently lost).** The admin fossil lacked, vs user: the missing-`status` fallback, the `parentServiceId` unique-stage fix, fixed-service support, and the #471 wrong-service-prevention UI. Any FUTURE admin case-selector must be built from the USER copy, never revived from this fossil (noted in the exec-log row).
- **M6 — exec-log maintained (+ closes גל-3ג).** `docs/HEALTH-MAP` exec-log gains the SHARE-7 row (+ flips PR-SHARE-6 #491 to ✅ merged). Additive.

## PRODUCT-GRADE GATES
- **G1** N/A — removal only.
- **G2 (rollback):** `git revert <sha>` restores the file + the `<script>` tag. Trivial, frontend-only.
- **G3** N/A — no data path (the deleted module's Firestore listener never ran on admin).
- **G4** N/A — dead module, zero admin callers/tests; CI admin-panel build + vitest catch a stray reference.
- **G5** N/A — no customer strings (module never rendered in admin).
- **G6** N/A — no live consumer transition (admin never instantiated it).
- **G7 (security):** N/A — display/dead-code only; no auth/PII/rules. (Removes a loaded-but-unused Firestore-listening module from the admin surface — minor attack-surface reduction.)

## Anti-premature-closure
- CI (admin-panel build + vitest) must be green — removing a never-instantiated module + its loader cannot break a live call path; verified 0 admin instantiations/consumers.
- Stale docs mentioning the old admin case-selector (`CLIENT_CASE_DIALOG_ARCHITECTURE.md` + architecture docs) are doc-drift → folded into גל-3ד (docs wave), not this PR.
- **This CLOSES גל-3ג (duplicates).** The wave resolved: DP-1 (presence, delete-dead) · SHARE-1..2 (mechanism + 5 identical) · SHARE-3/4 (config-loader/logger parameterized) · SHARE-6 (service-card unified) · SHARE-7 (client-case-selector, delete-dead). NEXT wave = גל-3ד (docs) → גל-3ה (TS).
