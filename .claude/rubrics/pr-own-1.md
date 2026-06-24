# Rubric — OWN-1 (the live service single-owner)

**Title:** feat(functions): OWN-1 — writeServiceWithCanonicalPackages, the live recompute-from-ledger service owner (dead code)
**Branch:** `fix/own-1-service-owner` → main (DEV)
**Files:** `functions/shared/service-writer.js` (new), `functions/tests/service-writer.test.js` (new). No other file changes.
**Scope:** Second step of the single-owner aggregate redesign (after OWN-0). Introduce the LIVE single canonical owner for a HOURS service's package aggregates — the only level of the hours hierarchy that lacks one (`package.hoursUsed` is written incrementally by ≥6 paths = the drift origin). The owner recomputes a service's per-package consumption from the LEDGER (timesheet entries) — never `+=Δ` — exactly like the offline DRIFT-2 repair, but live in one transaction, then delegates the client roll-up to the existing client owner. **It ships as DEAD CODE: wired to nothing, executes in no production path, zero live-write risk.** The reroute of the ~11 incremental writers (OWN-3) and the Check-7 repair-half that calls it (OWN-2) are later PRs.

**Precision contract:** OWN-1 adds a capability; it changes NO behavior (no live caller). It writes no data, runs no migration. The owner's correctness is proven in isolation against the real engine + the real client owner. The known residual — a pure entry-INSERT in the read→write window is not caught by the client-doc `updateTime` guard — is consciously accepted (D1) and is healed by OWN-2's reconciliation loop ("eventual ledger-truth, not per-write linearizability"). This IS the approved single-owner + reconciliation architecture; no Firestore alternative exists (transactions cannot run collection queries).

**Deliberate JS (not src-ts) exception:** the owner mirrors `client-writer.js` (JS) and lifts `package-repair-core.js` (JS) — both canonical, both in `functions/shared/`. functions/CLAUDE.md preserves existing-JS modules; this owner is one continuous thought with two of them. A TS module would have to model the loosely-typed engine surface or escape-hatch around it and would sit apart from its two siblings. The approved OWN-1 design locks JS in `functions/shared/`. This is a documented, design-approved deviation from the src-ts default, not an oversight.

## MUST criteria (block on FAIL)

### M1 — Lifts the engine AS-IS (zero engine changes)
**Rule:** the owner reuses `assignEntriesForwardReplay` + `computeRepairedService` + `isEligibleService` + `applyRepairWritesInOrder` from `package-repair-core.js` unchanged; it does NOT reimplement attribution, status derivation, or the invariant. `package-repair-core.js` is not modified by this PR. **Evidence:** `git diff` touches only the 2 new files; the owner `require`s the four engine exports; the full engine suite (`package-repair-core.test.js`) is untouched and green.

### M2 — Recompute-from-ledger, never incremental
**Rule:** on the recompute path the owner attributes EVERY passed entry (including `packageId:null` orphans) via the engine's forward-replay and writes `package.hoursUsed = Σ assigned-minutes/60` / `service.hoursUsed = Σ packages` — never `+=Δ`. A drifted stored `package.hoursUsed` is replaced by the ledger truth. **Evidence:** test "corrects the drifted package.hoursUsed (8h → 3h)" + "orphan (packageId:null) is counted (ledgerTruth=3, not 2)".

### M3 — One in-txn read; entries supplied from outside
**Rule:** the ONLY in-transaction read is `transaction.get(clientRef)`. The service's entries are received via `data.entriesForService` (read OUTSIDE the txn by the caller — Firestore txns cannot query). The owner does not query any collection. **Evidence:** the single `transaction.get`; the entries param; test "reads the client via transaction.get(clientRef)".

### M4 — A5 optimistic-concurrency guard
**Rule:** when `data.clientUpdateTimeAtRead` is supplied, the owner aborts (`code:'aborted'`, retryable) if `doc.updateTime` no longer matches — so the caller's externally-read entries still match the doc the owner writes. Omitting it proceeds without the guard (opt-in). **Evidence:** tests — mismatch → aborted + no write; match → proceeds; omitted → proceeds.

### M5 — D2 override/overdraft-resolved are SKIPPED (no write)
**Rule:** the owner REFUSES to recompute a service with `overrideActive===true` or `overdraftResolved.isResolved===true` (via `isEligibleService`) — the partner's intentional override/resolution is preserved, returning `{written:false, skipped:true, reason}` with no `transaction.update`. Structural non-applicable services (not_hours / archived / no_packages) are likewise skipped, not thrown. The `overrideServicePolicy:'recompute'` escape hatch defaults to 'skip' (the D2 behavior) and never resurrects a structural skip. **Evidence:** D-block tests (override / overdraft-resolved / not_hours / archived / no_packages all skip with no write; force-recompute only affects frozen reasons).

### M6 — Delegates the write to the client owner; writer-before-audit
**Rule:** the owner writes NOTHING on the client directly — it splices the repaired service back into `services[]` (other services byte-identical) and delegates the single `transaction.update` to `writeClientWithCanonicalAggregates({services, ...extraClientFields})` (which strips RESTRICTED_KEYS, recomputes client aggregates + Plan, asserts). The injected `auditFn` runs AFTER the write, via `applyRepairWritesInOrder` (reads-before-writes / the DRIFT-2.2 lesson). **Evidence:** tests — single update through the client owner; other services untouched; auditFn after update; STRICT-txn `ops==['get','get','update','set']` (no read-after-write abort).

### M7 — Read-only intake + BC-2 nested lock + invariant fail-safe + DEAD CODE
**Rule:** (a) the owner writes ONLY consumption aggregates — `totalHours/ratePerHour/fixedPrice/pricingType/status` pass through untouched (Q4, via the engine's spread). (b) BC-2: the repaired service is reconstructed by `computeRepairedService` (recomputed fields last) so any drifted nested aggregate is unconditionally overwritten, never trusted. (c) fail-safe: if `computeRepairedService` reports `invariantOk===false` (serviceAfter ≠ ledgerTruth) the owner throws `invariant_violation` and writes NOTHING. (d) the module is wired to nothing — no live functions module `require`s it. **Evidence:** tests — Q4 pass-through; BC-2 (999 → ledger truth); invariant fail-safe (forced `invariantOk:false` → throw + no write); the dead-code static scan (no live `require('…service-writer')`).

### M8 — Full suite green; syntax clean
**Rule:** the full functions Jest suite (legacy-js + src-ts) is green with the new tests; `node --check` clean on both new files. **Evidence:** `npx jest` = 1171/1171 (67 suites); `node --check` OK ×2.

## SHOULD
- **S1** — devils-advocate review on the FINAL diff — MANDATORY (core write-path logic per §3.8.4), even though the code is dead. Verdict cited in the PR body.
- **S2** — the contract documents the residual (read→write entry-INSERT window) and that OWN-2's reconciliation loop heals it; the JS-not-TS deviation is documented in-file and here.

## Out of scope (deferred — declared)
- **Wiring any live caller** — OWN-3 reroutes the ~11 incremental writers onto the owner (per-call-site, including the "is the caller already inside an outer same-client txn?" check that would move the pre-txn entry read earlier).
- **The reconciliation loop** — OWN-2 adds the Check-7 repair-half that calls this same owner.
- **legal_procedure stage recompute** — DRIFT-3 (HOURS-only here); its DETECT already shipped in OWN-0(d).
- **The enable-flag / `system_settings` toggle** — belongs to OWN-2/3 (dead code needs none).
- **Retiring the incremental writers** — OWN-4.

## 🔴 OWN-3 prerequisites (BLOCKING before any live caller is wired — surfaced by devils-advocate, GO-WITH-CHANGES)
These are SAFE to defer while OWN-1 is dead code, but each is load-bearing the instant a live caller is wired. OWN-3 MUST resolve them BEFORE wiring:
1. **Block-flip semantics, per call-site.** The owner does NOT carry `applyClient`'s `APPROVED_BLOCK_FLIPS` human gate (`repair-package-aggregates.js:364,410`). A recompute-from-ledger can move `hoursRemaining` ≤0 and flip `isBlocked false→true` (the client owner recomputes it unconditionally). For a live deduction path that is the correct surfacing of a depleted client — but OWN-3 must consciously DECIDE per call-site whether any recompute-driven flip needs a gate, not inherit "no gate" by omission.
2. **read-your-write on `entriesForService`.** A5 guards the CLIENT DOC only; an entry INSERT/EDIT/DELETE in the read→write window is the accepted D1 residual (healed by OWN-2, max staleness one cycle, metric = billing hours). OWN-3 must read `entriesForService` AFTER its own entry write so the common single-writer case is fresh-by-construction.
3. **Emulator integration test.** The owner does TWO `transaction.get(clientRef)` (its own select + the client owner's re-read). This is expected-benign per Firestore consistent-snapshot semantics, but the mocked-SDK unit tests cannot PROVE it (the exact DRIFT-2.2 blind-spot class). OWN-3 owes ONE Firestore-emulator test: real double-get + a real concurrent client-doc writer forcing the A5 abort path.
4. **Reconcile design §5 with the code.** `SINGLE-OWNER-AGGREGATE-DESIGN.md` §5 still describes "Σ entries WHERE packageId=X"; the engine actually re-derives attribution by forward-replay (entry.packageId is advisory — the deliberate BC-1/D1 choice that avoids the orphan under-count). The design doc (on branch `docs/single-owner-aggregate-design`) must be corrected so a future maintainer does not "simplify" the owner to group-by-packageId.

## Rollback (G2)
Pure `git revert <merge-commit>` + redeploy. OWN-1 adds two new files, deletes/creates no Cloud Function, touches no secret, runs no migration, and is called by nothing — reverting removes dead code with zero data or deploy-surface impact.

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — no customer-facing strings/paths; the owner's thrown errors are internal (developer-facing codes: `invalid_argument`/`not_found`/`service_not_found`/`aborted`/`invariant_violation`), reached by no live caller.
- **G2 (rollback):** PASS — pure `git revert` (no CF add/delete, no secret, no migration). See Rollback.
- **G3 (monitoring):** N/A — the module is not on any live write path (dead code); it adds no production write. When OWN-2/3 wire it, those PRs own the success/failure logging at the call sites + the injected `auditFn` (which this owner already orders writer-before-audit).
- **G4 (test proves scenario):** PASS — integration-style: the REAL owner drives the REAL forward-replay engine + the REAL client owner (only the SDK boundary mocked), exercising the full owner→engine→client-owner→update path: drift correction, orphan attribution, D2 skips, A5 guard, invariant fail-safe, writer-before-audit on a reads-before-writes-enforcing txn. 33 tests; 1171 total green.
- **G5 (Hebrew UI):** N/A — backend only, no UI/customer strings.
- **G6 (breaking change):** N/A — additive dead code. No schema/contract/route/default-behavior change; no existing data or caller affected. (The owner treats `totalHours/ratePerHour/fixedPrice` as read-only intake precisely to stay compatible with the H.3 Plan + all ledger consumers.)
- **G7 (security):** N/A — does not touch auth, permissions, Firestore rules, or PII. (devils-advocate is run anyway — MANDATORY for core write-path logic, not for G7.)

## Notes for grader
- The owner is a THIN WRAPPER: it adds the in-txn single read, the A5 guard, service selection by id, the invariant fail-safe, and the delegation — all the ledger-truth math is the already-built+tested engine. The flow mirrors the WRITE-ORDERING + reads-before-writes of the DRIFT-2 `applyClient` (`repair-package-aggregates.js:343-448`) generalized to ONE service inside a transaction, entries supplied from outside. It does NOT carry `applyClient`'s block-flip approval gate — see OWN-3 prerequisite #1 (that gate is a per-call-site policy, not a primitive property).
- The double-read of the client doc (owner reads to locate/select the service; the client owner re-reads to merge `{services}`) is the established pattern from the repair script and is EXPECTED-benign per Firestore consistent-snapshot semantics (both reads precede every write). It is not yet PROVEN against the real SDK by these mocked tests — OWN-3 prerequisite #3 owes the emulator integration test.
- D1 residual is the approved trade — eventual ledger-truth via OWN-2's loop, not per-write linearizability. Its true scope is entry INSERT **and** EDIT/DELETE in the read→write window (A5 guards the client doc, not the entry collection); max staleness = one OWN-2 cycle; affected metric = billing hours. Haim consciously signed off; there is no Firestore mechanism that closes it inside a single transaction (txns cannot query the entry collection). OWN-3 prerequisite #2 (read-your-write) keeps the common single-writer case fresh.
