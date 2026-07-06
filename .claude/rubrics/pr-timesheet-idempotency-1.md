# Rubric — PR-1: addTimeToTask exactly-once + offline guard

**Scope:** Prevent duplicate time entries on weak/no network for the `addTimeToTask` path. User App + Functions.

## MUST (blocking)
1. **Atomic exactly-once (backend).** `addTimeToTaskWithTransaction` reads `processed_operations/{key}` inside the SAME transaction (Phase-1, before any write) and returns the stored `result` if present — NO task update / cost write / arrayUnion on a duplicate. The register uses `transaction.create()` (not `.set()`) in Phase-3. Reads-before-writes preserved (no Firestore ordering error).
2. **Per-submission key (frontend).** `submitTimeEntry` mints ONE idempotency key BEFORE the retry closure and sends it verbatim on all 3 retries. Not content-derived (a real 2nd identical entry must NOT be deduped).
3. **No-key backward-compat.** Absent/empty key → behaves exactly as before (no idempotency, no crash). Malformed key → clean Hebrew `invalid-argument`.
4. **Offline guard (frontend).** When `navigator.onLine === false`, `submitTimeEntry` blocks the submit and shows a Hebrew popup — NO CF call, no retry, no queue.
5. **Tests prove the scenario.** Backend: replay-with-existing-key → returns stored result + performs no writes; first-call → writes + creates the idempotency doc; no-key → still writes. Frontend: key minted once/stable across retries; offline blocks.
6. **Scope discipline.** ONLY the addTimeToTask path + its caller + the shared `alert()` icon-override. `createTimesheetEntry_v2`/`createQuickLogEntry` untouched (PR-2). No `functions/lib/**`, no `test/setup.js`.

## SHOULD
- `_idempotencyKey` stamped on the entry for a forensic trail.
- Offline popup is calm (gray cloud, not an alarmist error).
- Reuses existing `processed_operations` convention (helpers.js), not a new collection.

## PRODUCT-GRADE GATES
- **G1** errors: malformed key → Hebrew `invalid-argument`; offline → Hebrew popup. No stack traces/undefined to user.
- **G2** rollback: `git revert <commit>` + redeploy (code-only). Idempotency docs are additive/self-expiring (24h TTL) — safe to leave.
- **G3** monitoring: `console.log` on idempotent-replay + on idempotency-record-create (non-PII — key is a UUID).
- **G4** tests: backend 9 + frontend 10 (see MUST-5).
- **G5** Hebrew: popup + error strings Hebrew.
- **G6** breaking change: offline-submit now BLOCKED (behavioral change, declared); UUID key removes accidental same-day dedup for this path (correct). Additive `alert()` options — no caller affected.
- **G7** security: no auth/PII/rules change; idempotency key is a UUID (no PII in logs). N/A for security-agent deep review, but devils-advocate MANDATORY (Firestore transaction change).
