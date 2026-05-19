# Rubric — PR-B.14

**Title:** refactor(functions): migrate closeCase to canonical helper + fix latent ReferenceError
**Branch:** feat/migrate-close-case-pr-b-14
**Base:** main
**File:** `functions/clients/index.js`
**Scope:** Migration 14 of 14 (final). closeCase callable — archives client + completes all services. Special-case PR: also fixes a latent ReferenceError bug at lines 857-859 (`clientHoursUsed`/`clientHoursRemaining`/`clientMinutesRemaining` are undefined — function would throw on every call). Migration target lines = bug lines, so fix is co-located with migration.

## Risk profile

**Medium-high.** Two distinct changes in one PR:

1. **Bug fix** — `closeCase` cannot currently complete successfully (transaction commits then function throws ReferenceError; caller sees `HttpsError 'internal'`). No tests existed; bug has been latent. Fix uses helperResult.aggregates.
2. **Migration** — Phase 3 client write goes through `writeClientWithCanonicalAggregates`.

## Behavioral change (must document)

**Pre-PR-B.14:** archive forced `isBlocked: false` and `isCritical: false` regardless of canonical aggregates.
**Post-PR-B.14:** helper computes both from `calcClientAggregates(services, totalHours)`. For archived clients with overdraft (`hoursRemaining <= 0` and no active override), `isBlocked` will now be `true` after archive. Most archived clients are not in overdraft and behavior is unchanged for them.

**Impact analysis:**
- UI: archived-client views filter by `status: 'inactive'` / `isArchived: true`, not `isBlocked`. No UI regression.
- Invariants (I1): pre-migration forced-false violated I1 for overdraft archives. Migration makes archive consistent with I1.
- Analytics: `isBlocked` post-archive now reflects historical reality at closure time rather than an artificial zero.

This is a behavioral change per CLAUDE.md and MUST be called out in the PR description.

## Equivalence analysis — verified before migration

- Source `clientTotalHours` (line 826): `updatedServices.reduce((sum, s) => sum + (s.totalHours || 0), 0)` — sums ALL services including FIXED.
- Helper `recomputeTotalHours`: excludes `ST.FIXED` + `legal_procedure` with `pricingType=fixed`.
- For canonical clients (FIXED services with `totalHours=0`) identical. Helper corrects drift on touch.
- `calcClientAggregates(updatedServices, totalHours)` identical input/output (aside from totalHours-from-DB vs totalHours-from-services).
- The forced-false override is what differs (documented above).

## MUST criteria (block on FAIL)

### M1 — Client write replaced by helper
**Rule:** `transaction.update(clientRef, {...})` at lines 832-847 replaced by:
```js
const helperResult = await writeClientWithCanonicalAggregates(
  transaction, clientRef,
  {
    status: 'inactive',
    isArchived: true,
    archivedAt: now,
    services: updatedServices,
    totalServices,
    activeServices
  },
  {
    caller: 'closeCase',
    auditMeta: { uid: user.uid, username: user.username }
  }
);
```
Manual aggregate fields removed from caller payload. `lastModifiedAt`/`lastModifiedBy` via auditMeta. Forced `isBlocked: false` and `isCritical: false` REMOVED — helper derives both canonically.

**Evidence required:** Diff.

### M2 — ReferenceError bug fixed
**Rule:** Lines 857-859 reference `clientHoursUsed`/`clientHoursRemaining`/`clientMinutesRemaining` which are not defined anywhere in the function. After fix, return block sources values from `helperResult.aggregates`:
```js
aggregates: {
  totalHours: helperResult.aggregates.totalHours ?? helperResult.written.totalHours,
  hoursUsed: helperResult.aggregates.hoursUsed,
  hoursRemaining: helperResult.aggregates.hoursRemaining,
  minutesRemaining: helperResult.aggregates.minutesRemaining,
  isBlocked: helperResult.aggregates.isBlocked,
  isCritical: helperResult.aggregates.isCritical,
  totalServices,
  activeServices
}
```
**Evidence required:** Diff confirms variables now reference defined values; test exercises full happy path without ReferenceError.

### M3 — All input validation preserved
**Rule:**
- Auth (`checkUserPermissions` — admin-only enforced upstream)
- `clientId` required, string
- `note` trimmed, max 500 chars (optional)

**Evidence required:** Reading the code.

### M4 — Same-state guard preserved
**Rule:** Lines 797-802: throw `failed-precondition` when already `status: 'inactive' && isArchived: true`. Unchanged.
**Evidence required:** Reading the code.

### M5 — Service-completion logic preserved
**Rule:** Immutable `services.map` setting `status: 'completed'` + `completedAt: now` on non-completed services. Counters `servicesCompleted` / `servicesAlreadyCompleted` accurate.
**Evidence required:** Reading the code.

### M6 — Active-budget-tasks query preserved (outside transaction)
**Rule:** Post-transaction count of `budget_tasks` where `clientId === data.clientId && status === 'פעיל'`. Result bubbles into audit log + return payload + message string.
**Evidence required:** Reading the code.

### M7 — Audit log preserved
**Rule:** `logAction('CLOSE_CASE', uid, username, { clientId, clientName, previousStatus, servicesCompleted, servicesAlreadyCompleted, activeBudgetTasksRemaining, note })` post-transaction. Unchanged.
**Evidence required:** Reading the code.

### M8 — auditMeta `{ uid, username }` passed to helper
**Rule:** Helper invocation includes `auditMeta: { uid: user.uid, username: user.username }`. Helper adds `lastModifiedAt: serverTimestamp()` + `lastModifiedBy`.
**Evidence required:** Reading the code.

### M9 — Default helper mode (no per-call override)
**Rule:** Helper invocation has no `mode` option — uses global config (default `enforce`). closeCase is admin-only, low-frequency, and the invariant assertion now passes naturally (no more forced-false violation of I1).
**Evidence required:** Reading the code.

### M10 — Tests cover migrated path + bug fix
**Rule:** New test file `functions/tests/close-case-canonical-helper.test.js`:
- Happy path: helper called once with caller + auditMeta + non-aggregate fields only; return payload contains canonical aggregates (no ReferenceError thrown).
- Service completion: completed-already vs newly-completed counters correct.
- Same-state guard: already-archived client throws `failed-precondition`; helper NOT called.
- Validation: missing clientId → throws `invalid-argument`; helper NOT called.
- Behavioral change: archived client with overdraft → helper computes `isBlocked: true` (was forced false pre-PR).
- Audit log: post-transaction `logAction` with full payload.

**Evidence required:** New test file + Jest output.

### M11 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Migration comment tagged PR-B.14 + bug-fix note + behavioral change note
**Evidence required:** Inline comment above helper call documenting (a) migration, (b) ReferenceError fix, (c) `isBlocked/isCritical` now canonical.

### S2 — PR description names PR-B.13 predecessor + final-batch label
**Rule:** PR body states "Migration 14 of 14 — final regular migration". Acknowledges PR-B.12.1 (log_only cleanup) still pending separately.
**Evidence required:** PR description.

### S3 — PR description calls out behavioral change explicitly
**Rule:** PR body has dedicated "Behavioral change" section explaining the `isBlocked`/`isCritical` semantic shift on archive + impact analysis (UI / invariants / analytics).
**Evidence required:** PR description.

### S4 — PR description calls out bug fix
**Rule:** PR body has dedicated "Bug fix" section explaining the ReferenceError, why it was latent (no tests), and that the fix is bundled because the bug lines == migration lines.
**Evidence required:** PR description.

## Out of scope

- B.12.1 log_only cleanup (separate)
- Other closeCase semantics (locking flow, archival of budget_tasks, notifications) — not touched
- Refactoring the active-budget-tasks query
- Adding `note` field validation (e.g., min length)
- Renaming `'פעיל'` Hebrew status enum

## Rollback

`git revert <merge-commit>` → CI redeploys. Function reverts to:
- Manual aggregate writes (incl. forced isBlocked/isCritical false)
- ReferenceError bug returns (latent — only triggered on actual call)

If forced-false-on-archive semantics is critical to a downstream consumer, the migration alone is reversible without re-introducing the bug — but that would require a separate hand-crafted revert.

## Notes for grader

- closeCase has TWO pre-existing characteristics worth treating as separate concerns: (1) latent ReferenceError bug, (2) forced isBlocked/isCritical false on archive. The bug fix is mandatory because the function is unusable otherwise; the behavioral change is the natural consequence of migration.
- No tests existed for closeCase before this PR — the bug was latent. The new test file is also the FIRST test coverage for closeCase.
- Admin-only callable. Low-traffic. UI: "Close case" button on client detail page (admin-only visible).
- After PR-B.14, all 14 client-write callsites are migrated. Only PR-B.12.1 (24h soak cleanup) remains in the PR-B series.
