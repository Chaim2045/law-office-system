# Rubric — PR-B.2

**Title:** refactor(functions): migrate setServiceOverdraftResolved to canonical helper
**Branch:** feat/migrate-set-service-overdraft-resolved-pr-b-2
**Base:** main
**Scope:** Twin of PR-B.1. Replace `transaction.update(clientRef, { services + 6 aggregate fields + lastModified })` in `setServiceOverdraftResolved` (functions/clients/index.js:1325) with the canonical helper call. Same pattern, same behavior, identical risk profile.

## Risk profile

**Low.** Same shape as PR-B.1. Admin-only, low traffic. The function toggles a single service's `overdraftResolved` field; aggregate computation is unchanged.

## MUST criteria (block on FAIL)

### M1 — setServiceOverdraftResolved uses writeClientWithCanonicalAggregates
**Rule:** The body of `setServiceOverdraftResolved` calls `writeClientWithCanonicalAggregates(transaction, clientRef, { services: updatedServices }, { caller: 'setServiceOverdraftResolved', auditMeta: { uid: user.uid, username: user.username } })`. The prior manual aggregate-block is removed.
**Evidence required:** Grep + diff.

### M2 — All pre-helper validations preserved (order matters)
**Rule:** auth → admin role → arg shape (`clientId, serviceId, resolved`) → client exists → service exists. No silent removal or reordering.
**Evidence required:** Reading the new code.

### M3 — Toggle logic preserved for both branches
**Rule:** `resolved=true` writes the full `overdraftResolved` object (isResolved/resolvedAt/resolvedBy/resolvedByName/note). `resolved=false` REMOVES the `overdraftResolved` field via destructuring (`const { overdraftResolved, ...rest } = service`). This is a non-trivial branch — must NOT collapse to a single shape.
**Evidence required:** Reading the new code confirms both branches.

### M4 — logAction preserved
**Rule:** `logAction('RESOLVE_SERVICE_OVERDRAFT' | 'UNRESOLVE_SERVICE_OVERDRAFT', user.uid, user.username, { clientId, serviceId, resolved, note })` STILL called outside the transaction with the same payload.
**Evidence required:** Reading the code.

### M5 — Return value unchanged
**Rule:** `{ success: true, serviceId, resolved }`.
**Evidence required:** Reading the code.

### M6 — Tests for migrated path
**Rule:** New test file `functions/tests/set-service-overdraft-resolved.test.js` covering at minimum:
- Auth: non-admin → permission-denied
- Validation: missing args
- Lookup: client / service not found
- Happy path `resolved=true`: helper called, services array carries `overdraftResolved` object, aggregates re-derived. Importantly: I2 path (overdraftResolved → isBlocked=false even if depleted).
- Happy path `resolved=false`: helper called, services array NO LONGER has `overdraftResolved` field, aggregates re-derived (depleted without resolution → back to isBlocked=true).
- Audit log: both action names emitted with correct payload.
**Evidence required:** New test file + Jest output.

### M7 — All other tests pass
**Rule:** Functions Jest + root Vitest both green. No regression.
**Evidence required:** Test runner output.

### M8 — Lint zero errors
**Rule:** `npm run lint` returns 0 errors.
**Evidence required:** Lint output.

## SHOULD criteria

### S1 — Migration comment tagged PR-B.2
**Rule:** Inline comment near the helper call references PR-B.2 + cites the same pattern as PR-B.1 (without duplicating the full essay — short backreference is fine).
**Evidence required:** Reading the comment.

### S2 — auditMeta carries username
**Rule:** `auditMeta: { uid: user.uid, username: user.username }`.
**Evidence required:** Reading the code.

### S3 — PR description references PR-B.1 as the pattern source
**Rule:** PR description names PR-B.1 / #283 as the pattern source and notes this is the second of 13 migrations.
**Evidence required:** PR description.

## Out of scope

- Other 11 callsites — each its own sub-PR
- Changing the toggle semantics (resolved=true → write object; resolved=false → remove field)
- Removing logAction
- Changing return value

## Rollback

`git revert <merge-commit>` on main → CI redeploys. Function reverts to prior block. No data corruption possible.

## Notes for grader

- M3 is the only NON-TRIVIAL difference from PR-B.1: this function has a `resolved=false` branch that REMOVES a service field via destructuring. The migration must preserve this exactly — the canonical helper writes `services: updatedServices` as wholesale replacement, so the destructured `service` (without `overdraftResolved`) lands in the array intact. Verify in the test that the helper write payload's `services[i]` has no `overdraftResolved` key when `resolved=false`.
- I2 (override-active OR overdraft-resolved → isBlocked=false) is the canonical aggregator's job. Test the `resolved=true` happy path against a depleted client to prove I2 fires through this CF.
