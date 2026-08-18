# Rubric: H.6.c-3 — Wire H.5 signature verification into pending-client release

## Scope
- **App:** Functions (backend CF) + Admin Panel (frontend)
- **Environment:** DEV (main branch)
- **Branch:** `feat/h6-c-3-signature-release`

## Context
H.6.c-3 wires the H.5 `verifySignaturePresence` into the pending-client release flow. After c-1 created clients in `pending_signature` status, this CF verifies the uploaded signed fee-agreement via the shared `verifySignatureCore`, checks for fee drift against the live tofes sale, and atomically flips the client to `active` + writes the permanent `sales_record_links` doc. A Fable 5 security audit identified 11 findings (2 critical, 5 important, 4 moderate) — all incorporated before implementation.

## MUST criteria (all must PASS for verdict PASS)

| # | Criterion | Evidence |
|---|-----------|----------|
| M1 | Admin-only role gate (`claims.role === 'admin'`) — rejects unauth + non-admin | Test: `rejects unauthenticated` + `rejects non-admin` |
| M2 | Zod `.strict()` input with 20-char `[A-Za-z0-9]` regex — blocks path traversal | Test: `rejects invalid salesRecordId` |
| M3 | `verifySignatureCore` shared extraction — no `CallableRequest` fabrication | Code: `verify-signature-presence.ts` exports `verifySignatureCore` |
| M4 | `reasoning` NEVER returned or persisted — only booleans + confidence | Test: `never leaks reasoning`; code: response type has no `reasoning` |
| M5 | Fee-drift check with ₪1 tolerance BEFORE txn | Test: `aborts on fee drift` + `allows ₪1 tolerance` |
| M6 | TOCTOU guard: txn re-reads client + re-asserts `pending_signature` | Test: `idempotent when already released` + in-txn re-checks |
| M7 | `transaction.create()` for `sales_record_links` (not `.set()`) | Code: line 392 uses `transaction.create(linksRef, ...)` |
| M8 | `activeServices` computed from array, not hardcoded | Code: line 381 `updatedServices.filter(...)` |
| M9 | Audit-FIRST inside txn via `logCriticalActionInTxn` | Code: line 367 before status flip at line 383 |
| M10 | `maxInstances: 3` + `timeoutSeconds: 120` | Code: lines 449-452 |
| M11 | Both secrets declared (`ANTHROPIC_KEY` + `TOFES_KEY`) | Code: lines 79-80 |
| M12 | No PII in logger calls (no amounts, names, reasoning) | Code review: all `logger.*` use only uid/salesRecordId/caseNumber/errorCode |
| M13 | Hebrew user-facing error messages (G1+G5) | Code review: every `HttpsError` message is Hebrew |
| M14 | All 33 tests pass | `npm test` in functions/ |
| M15 | TypeScript compiles clean | `npx tsc --noEmit` in functions/ |
| M16 | ESLint 0 errors | `npx eslint` from repo root |
| M17 | Frontend escape-at-sink for all tofes/client data | Code: `pending-clients.js` uses `escapeHtml` on all innerHTML |

## SHOULD criteria

| # | Criterion |
|---|-----------|
| S1 | Service located by `serviceId` (not `services[0]` hardcode) |
| S2 | Last fee agreement used (most recently uploaded) |
| S3 | Idempotent already-released returns `{released:false, reason}` (not error) |
| S4 | Frontend loading state disables button during release call |
| S5 | Frontend success/failure toasts in Hebrew |
