# Rubric — PR-C.2-fns

**Title:** feat(functions): outbox trigger for system_health_checks → WhatsApp bot (PR-C.2-fns)
**Branch:** feat/system-reports-outbox-pr-c-2-fns
**Base:** main
**File:** new `functions/triggers/system-reports-outbox-trigger.js` + index.js export + tests
**Scope:** Half of PR-C.2 (the law-office-system side). Firestore trigger on `system_health_checks` document creation. If `status: 'FAIL'`, writes a `system_reports_outbox` doc that the existing hachnasovitz WhatsApp bot will consume in PR-C.2-bot. Decoupled via outbox pattern (Firestore as queue). No HTTP, no new ports, no new infrastructure.

## Architecture

```
dailyInvariantCheck (cron 06:00)
        ↓ writes
system_health_checks/{auto-id}                ← existing (PR-C.1)
        ↓ triggers
onSystemHealthCheckCreated                    ← NEW (this PR)
        ↓ if status === 'FAIL', writes
system_reports_outbox/{auto-id}               ← NEW collection
        ↓ listened by (PR-C.2-bot)
hachnasovitz bot → WhatsApp group
        ↓ updates status: 'sent'
system_reports_outbox/{auto-id}
```

## Why outbox pattern (not HTTP webhook)

- Bot already connects to law-office-system Firestore (read-only currently) via `daily-reports/law-office-key.json`. PR-C.2-bot upgrades that service account to read+write on `system_reports_outbox` only.
- No new HTTP port to expose, no firewall config, no auth-token rotation.
- Outbox is durable: bot restart? Pending docs remain. Out of memory? Pending docs remain. Retry via attempts counter.
- Auditable: full history of every alert ever sent.

## Risk profile

**Low.** New trigger on a low-volume collection (health checks fire ~daily). No mutation to existing docs. Empty outbox if no FAIL.

## MUST criteria (block on FAIL)

### M1 — New trigger `onSystemHealthCheckCreated`
**Rule:** Firestore v2 trigger on `onDocumentCreated('system_health_checks/{docId}', ...)`. Reads the new doc; if `status === 'FAIL'` and `discrepanciesCount > 0`, writes an outbox doc. If `status === 'PASS'` or empty, no write.
**Evidence required:** Reading the code.

### M2 — Outbox doc schema
**Rule:** Writes to `system_reports_outbox/{auto-id}` with:
```js
{
  type: 'system_health_check',
  severity: 'warning',  // future: 'critical' for security/data-loss
  source: 'dailyInvariantCheck',
  healthCheckDocId: <docId>,
  discrepanciesCount: <number>,
  discrepancies: [...],   // full array — bot formats
  status: 'pending',
  attempts: 0,
  createdAt: serverTimestamp(),
  sentAt: null,
  errorMessage: null
}
```
**Evidence required:** Reading the code; test asserts shape.

### M3 — No mutation of `system_health_checks`
**Rule:** Trigger only writes to `system_reports_outbox`. Does not modify the source `system_health_checks` doc (avoids self-write loops). Verified by code inspection — no `event.data.ref.update()` etc.
**Evidence required:** Reading the code.

### M4 — Idempotent on retries
**Rule:** Firestore Cloud Function triggers can fire more than once. Use the source doc ID as part of outbox-doc uniqueness check (or rely on Cloud Functions' at-least-once delivery + bot-side idempotency via `status: 'pending' → sent` check; this PR opts for the latter as the simpler approach).
**Evidence required:** Inline comment documents the at-least-once expectation + bot-side dedup.

### M5 — Trigger registered in index.js
**Rule:** `functions/index.js` exports the new trigger.
**Evidence required:** Diff.

### M6 — Logs on trigger fire
**Rule:** `console.log` (or `functions.logger.info`) on fire with summary: docId + status + discrepanciesCount. Helps prod debugging.
**Evidence required:** Reading the code.

### M7 — Tests cover the trigger
**Rule:** New test file `functions/tests/system-reports-outbox-trigger.test.js`:
- PASS health check (no discrepancies) → no outbox write
- FAIL health check (discrepancies > 0) → outbox doc written with full payload
- Outbox doc shape matches schema (status: 'pending', attempts: 0, etc.)
- Trigger does NOT update the source doc

**Evidence required:** Test file + Jest output.

### M8 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Inline comment tagged PR-C.2-fns
**Evidence required:** Comment block.

### S2 — Comment describes the bot's expected consumption pattern
**Rule:** Comment notes: bot listens on `system_reports_outbox` where `status == 'pending'`. After sending, bot updates to `status: 'sent'`, sets `sentAt`, increments `attempts`. On failure: `status: 'failed'`, sets `errorMessage`, can be retried.
**Evidence required:** Comment.

### S3 — PR description names PR-C.1 predecessor + companion PR (C.2-bot) + outbox-pattern rationale
**Evidence required:** PR body.

### S4 — Schema example included in PR description
**Evidence required:** PR body shows the expected outbox doc shape.

## Out of scope

- The bot side (separate PR — PR-C.2-bot in hachnasovitz repo)
- Severity escalation logic ('warning' vs 'critical')
- Slack/email backup channels
- Retry orchestration (bot owns retry counter)
- Admin UI for outbox monitoring (future)
- Cleanup of old `system_reports_outbox` docs (TTL via separate scheduled cleanup, future)

## Rollback

`git revert <merge-commit>` → CI redeploys. Trigger disappears. Bot continues to listen on `system_reports_outbox` but no new docs arrive. Pending docs delivered then queue stays empty. No data corruption.

## Notes for grader

- The outbox doc is intentionally generic. Future health-check sources (beyond `dailyInvariantCheck`) can write to `system_health_checks` and automatically flow through to WhatsApp.
- Bot side (PR-C.2-bot) will need this PR's outbox schema as a contract. PR-C.2-bot will be opened after this merges.
- The trigger does NOT format messages — bot owns Hebrew formatting. Decoupling rationale documented in code.
