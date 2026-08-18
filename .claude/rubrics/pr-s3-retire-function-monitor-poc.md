# Rubric — PR-S3: retire unwired function-monitor POC modules (גל-3א / dead-code)

**Scope:** DEAD-CODE removal. Deletes the 3 unwired `function-monitor*.js` POC modules (client-side monitor whose init `<script>` was removed in PR #163; collection `function_monitor_logs` locked to `if false` in PR-S1). No rules/schema/migration → no devils-advocate. Complements S1 (S1 locked the rule; S3 removes the dead writer/UI).

## MUST
- **M1 — the removal.** `function-monitor.js`, `function-monitor-init.js`, `function-monitor-dashboard.js` deleted (whole files). Diff scope = exactly these 3 files.
- **M2 — proven dead.** No HTML `<script>` loads any of the 3 (verified); no live JS import/require/instantiation outside the 3 themselves (they form a self-contained island — `init` did `new FunctionMonitor()`/`new FunctionMonitorDashboard()` internally; no external consumer; no consumed `window.FunctionMonitor` global). The only `function_monitor_logs` writer was `function-monitor.js` itself.
- **M3 — S1 untouched.** `firestore.rules` (`function_monitor_logs` = `if false`) and the S1 deny-suite `tests/rules/functionMonitorLogs.test.ts` are NOT modified (the rule + its RULE test stay — they guard the now-locked collection regardless of the writer's removal).
- **M4 — no dangling references.** Zero live references to the 3 modules remain in `apps/` (excl. `dist/`) or `functions/`; no test imports them.

## PRODUCT-GRADE GATES
- **G1** N/A — removal only.
- **G2 (rollback):** `git revert <sha>` restores the 3 files. Trivial, code-only.
- **G3** N/A — removes a write path (to the already-locked collection), adds none.
- **G4** N/A — dead code, zero callers/tests; CI build + user-app suite catch a stray import.
- **G5** N/A — no customer strings.
- **G6** N/A — unwired modules, no live consumer transitions.
- **G7 (security):** PASS (minor) — removes the client-side writer/UI that motivated the S1 lockdown; net attack-surface reduction. No auth/rules/PII behavior changed.

## Anti-premature-closure
- CI (build + user-app vitest) must be green — a stray import of a deleted module would fail the build; confirm CI-green before merge.
- Doc-drift left for the docs wave: `docs/FUNCTION_MONITOR_README.md`, `ANALYTICS_DASHBOARD_GUIDE.md`, `SYSTEM_MAP.md`, `SYSTEM_STATUS.md`, `HEALTH-MAP-2026-07.md` still reference the retired POC — flagged, out of scope here.
- The stale `dist/` bundle may still embed the modules — orphan artifact, clears on rebuild, out of scope.
