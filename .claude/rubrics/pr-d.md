# Rubric — PR-D

**Title:** feat(functions): audit + repair callables for client aggregate drift (PR-D)
**Branch:** feat/audit-and-repair-aggregates-pr-d
**Base:** main
**File:** new `functions/admin/repair-aggregates.js` + tests + index export
**Scope:** Two admin-only callables that close the loop on the original isBlocked corruption:
1. `auditClientAggregates` — read-only scan of all clients (or a filtered subset). For each client, compute canonical aggregates (helper logic, no write) and compare against current document fields. Report drift entries.
2. `repairClientAggregates` — single-client repair via canonical helper. Writes a "no-op touch" that triggers helper's recompute. Audit logged.

## Why now

- PR-B series complete (14/14 callsites migrated). Helper enforces invariants on every NEW write.
- Existing data may still contain drift from pre-migration writes (the original 23 victims + any others).
- `dailyInvariantCheck` exists but does NOT check I1-I4 (isBlocked/isCritical canonical-vs-stored). Adding it there is a separate concern (PR-C scope — monitoring).
- PR-D is the **on-demand** counterpart: admin invokes from UI, sees drifts, repairs.

## Risk profile

**Low for audit, medium for repair.**

- Audit: read-only Firestore queries. No writes. Safe.
- Repair: writes via canonical helper — same path proven across 14 PR-B migrations. Helper enforces I1-I4 on write. The only "new" thing is that the caller's intent is "recompute" rather than "modify".

## MUST criteria (block on FAIL)

### M1 — `auditClientAggregates` callable: admin-only, read-only
**Rule:** New callable in `functions/admin/repair-aggregates.js`:
```js
exports.auditClientAggregates = functions.https.onCall(async (data, context) => {
  // 1. Auth — admin role enforced
  // 2. Optional filter: data.clientIds (array) — if absent, scan all clients
  // 3. For each client: compute canonical (recomputeTotalHours + calcClientAggregates), compare to stored
  // 4. Return { totalChecked, totalDrifts, drifts: [...] }
  // 5. NO writes anywhere
});
```
**Evidence required:** Reading the code; no `.update()` / `.set()` / `.delete()` calls.

### M2 — Audit checks all canonical fields
**Rule:** For each client, compare stored vs canonical for: `totalHours`, `hoursUsed`, `hoursRemaining`, `minutesUsed`, `minutesRemaining`, `isBlocked`, `isCritical`. Tolerance 0.02 for floats (same as dailyInvariantCheck). Boolean fields: strict equality.
**Evidence required:** Reading the code; tolerance applied; all 7 fields compared.

### M3 — Audit response shape
**Rule:** Callable returns:
```js
{
  success: true,
  totalChecked: <number>,
  totalDrifts: <number>,
  drifts: [
    {
      clientId, clientName,
      driftFields: [
        { field: 'isBlocked', current: true, canonical: false },
        { field: 'hoursUsed', current: 102.5, canonical: 100.0, diff: 2.5 },
        ...
      ]
    },
    ...
  ],
  scannedAt: <ISO timestamp>
}
```
**Evidence required:** Reading the response code; test asserts shape.

### M4 — `repairClientAggregates` callable: admin-only, single client
**Rule:** New callable:
```js
exports.repairClientAggregates = functions.https.onCall(async (data, context) => {
  // 1. Auth — admin role enforced
  // 2. Validation: data.clientId required, string
  // 3. Inside transaction:
  //    - Read client (capture previousAggregates)
  //    - Call helper with empty partialUpdate (helper recomputes from current services)
  //    - Capture newAggregates from helperResult
  // 4. Audit log: REPAIR_CLIENT_AGGREGATES with before/after
  // 5. Return { success, clientId, before, after, changed: boolean }
});
```
**Evidence required:** Reading the code.

### M5 — Repair uses canonical helper
**Rule:** Repair calls `writeClientWithCanonicalAggregates` with `partialUpdate: {}` (or only audit-marker fields like `_lastCanonicalRepairAt`). `caller: 'repairClientAggregates'`. `auditMeta: { uid, username }`.
**Evidence required:** Reading the code; helper invocation matches.

### M6 — Repair preserves invariant-enforcement
**Rule:** Repair invocation uses default helper mode (no per-call override). If a client has unsalvageable state where invariants can't be satisfied even after canonical recompute, the helper assertion will fire and the repair aborts — preserving safety. (In practice this shouldn't happen — helper's recompute IS the canonical state, so invariants hold by construction. But the default-mode setting is the conservative choice.)
**Evidence required:** Reading the code.

### M7 — Audit log on repair
**Rule:** `logAction('REPAIR_CLIENT_AGGREGATES', uid, username, { clientId, before, after, changed })` post-transaction. Includes whether the repair actually changed anything (changed: false when client was already canonical — i.e., no drift).
**Evidence required:** Reading the code.

### M8 — Both callables enforce admin role
**Rule:** `checkUserPermissions` called first. If user role !== 'admin' → throw `permission-denied`.
**Evidence required:** Reading the code; test exercises non-admin → throws.

### M9 — Audit pagination / batch safety
**Rule:** Audit handles "scan all clients" safely:
- Firestore `.get()` on `clients` collection — limit considerations.
- If `clientIds` array supplied, scan only those (preferred path for targeted audits).
- Internal client (`internal_office` if applicable) — SKIP_CLIENTS list mirrors `dailyInvariantCheck` pattern. Default: `['internal_office']`.
**Evidence required:** Reading the code; SKIP_CLIENTS handled.

### M10 — Tests cover both callables
**Rule:** New test file `functions/tests/repair-aggregates.test.js`:
- Audit:
  - Auth: non-admin → permission-denied
  - Empty universe → totalChecked: 0, totalDrifts: 0
  - Clean client (no drift) → totalDrifts: 0, drift absent from response
  - Drifted client (isBlocked: true stored, false canonical) → drift reported with field details
  - Multiple drift fields → all reported
  - Filtered scan (clientIds supplied) → only those checked
  - No writes (verify transaction.update / .set never called)
- Repair:
  - Auth: non-admin → permission-denied
  - Missing clientId → invalid-argument
  - Client not found → not-found
  - Drifted client → helper called once with empty partialUpdate; before/after differ; changed: true; audit logged
  - Already-canonical client → helper still called; before/after equal; changed: false; audit logged

**Evidence required:** Test file + Jest output.

### M11 — Index.js exports both callables
**Rule:** `functions/index.js` exports both. Function names exactly match callable names.
**Evidence required:** Reading the diff.

### M12 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Comments document the canonical recompute semantics
**Rule:** Module-level docstring explains: repair = no-op touch via helper = canonical recompute. Why this works: helper's invariant is "after write, state matches canonical". So repair = "force a write" which forces canonicalization.
**Evidence required:** Inline comment.

### S2 — Repair returns a meaningful diff (not just booleans)
**Rule:** `before` and `after` blocks include the actual aggregate values. UI can show "fixed: isBlocked true→false, hoursUsed 102.5→100.0".
**Evidence required:** Response shape.

### S3 — PR description names PR-B.14 predecessor + use case (close 23-victim loop) + run order (audit → repair per drift → audit again)
**Evidence required:** PR description.

### S4 — No batch endpoint
**Rule:** No `repairAllDrifts` callable in this PR. Admin runs repair per client. If batch is needed later → PR-D.2.
**Evidence required:** Only two callables exported.

## Out of scope

- Batch / mass-repair endpoint
- Adding I1-I4 check to `dailyInvariantCheck` (PR-C scope — monitoring extension)
- Admin UI changes to expose the callables (separate PR; lawyers invoke from existing admin tools / dev tools console)
- Backfill of historical violations to `clientInvariantViolations` (orthogonal)
- Drift-correction strategies that don't go through helper (none allowed — helper IS the only canonical write path)
- Twilio SMS / WhatsApp alert on drift (PR-C scope)

## Rollback

`git revert <merge-commit>` → CI redeploys. Both callables disappear. No data corruption — neither callable changes data structure, only triggers canonical recompute that helper would do anyway on next write.

## Run order (for grader and Haim)

1. Deploy this PR.
2. Admin invokes `auditClientAggregates({})` from console / Admin Panel → receives drift list.
3. For each drifted client: admin invokes `repairClientAggregates({ clientId })` → before/after diff returned + audit logged.
4. Re-run audit → expect totalDrifts: 0.

## Notes for grader

- This PR closes the loop on the original 23-victim incident (2026-05-13 duplicate-`calcClientAggregates` bug fixed in PR #266; PR-A architectural gap fix; PR-B 14 migrations).
- After PR-D merges + Haim runs the repair flow, the system reaches a fully-canonical steady state. Any future drift would have to come from a NEW architectural bug, which PR-B made impossible.
- The audit response is the most important artifact: Haim sees, with his own eyes, which clients are still corrupted and chooses to repair each one (manual gate prevents mass-write incidents).
- Repair is idempotent — repairing an already-canonical client is a no-op (just re-writes the same values + audit log entry).
