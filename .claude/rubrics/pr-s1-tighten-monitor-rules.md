# Rubric — PR-S1: tighten over-broad monitor Firestore rules (גל-3א security)

**Scope:** `firestore.rules` only (+ tests). Retires 2 dead rule blocks + KILLs a dormant POC collection. All 3 were verified dead/dormant by a read-only investigation. DEV=PROD shared project → a rules change deploys to prod; the merge + `firebase deploy --only firestore:rules` are supervised (Haim's hands). Devils-advocate MANDATORY (rules change, §3.8.4).

## MUST
- **M1 — the 3 changes, nothing else.** `match /sessions/` DELETED (default-deny); `match /function_monitor_errors/` DELETED (default-deny); `match /function_monitor_logs/` → `allow read, write: if false;`. No other rule block in `firestore.rules` changed (diff scope = these 3 + tests).
- **M2 — no live path breaks.** Each of the 3 is dead/dormant with NO client SDK reader/writer: `sessions` orphaned (presence moved to Realtime DB `presence/{userId}`); `function_monitor_errors` phantom (zero code path); `function_monitor_logs` written only by the UNWIRED `function-monitor*.js` POC (not loaded by any live HTML; the write is try/catch-wrapped). Tightening breaks no live feature.
- **M3 — deny/drift coverage (house convention).** `tests/unit/rules/rules-drift-guard.test.ts` gains negative assertions (`not.toContain('match /sessions/')` + `'match /function_monitor_errors/'`) mirroring the retired-`user_messages` pattern. `tests/rules/functionMonitorLogs.test.ts` (new, modeled on `employeeCosts.test.ts`) proves unauth/employee/admin/partner all DENIED read+write on `function_monitor_logs`, + default-deny on the two removed collections. No test weakened/bypassed.
- **M4 — mirror consistency.** `firestore.rules.test` contained none of the 3 blocks (verified) → nothing to mirror; the drift-guard's GATED_COLLECTIONS list is unaffected (`function_monitor_logs` is fully-locked `if false`, not a gated onSnapshot collection).

## PRODUCT-GRADE GATES
- **G1** N/A — rules, no customer output.
- **G2 (rollback):** `git revert <sha>` + `firebase deploy --only firestore:rules` restores prior rules. Trivial.
- **G3** N/A — no write path added; removes open write surfaces.
- **G4 (test):** deny-suite + drift-guard added; CI runs the rules emulator suite (not runnable in worktree — partial node_modules). CI-green is the gate.
- **G5** N/A — no customer strings.
- **G6 (breaking change):** DECLARED — tightens 3 rules from open to locked/removed. All 3 dead/dormant → no live consumer transitions. If the unwired POC is ever revived, its writes now fail (silently, try/catch) until re-designed with a validated rule — acceptable, it's retired.
- **G7 (security):** PASS — THIS IS the security fix: closes open-read of diagnostic stack-traces/args to any authenticated user + open-write flooding/poisoning vectors. devils-advocate mandatory (rules change).

## Anti-premature-closure
- Rules emulator deny-suite + drift-guard must be GREEN in CI before merge — do NOT claim local pass.
- Supervised `firebase deploy --only firestore:rules` (Haim's hands) after merge; DEV=PROD → the rules hit prod on deploy. Verify with the emulator suite green as the gate.
- This is PR-S1 only; the unwired `function-monitor*.js` POC modules are retired separately in PR-S3 (dead-code).
