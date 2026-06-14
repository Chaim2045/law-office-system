# Rubric — H.3 PR1-followup: one-time backfill to strip the fabricated legal-hourly `ratePerHour: 800` from existing client docs

**Title:** A supervised, one-time migration script that REMOVES the un-elected `ratePerHour: 800` default from existing `services[]` (legal_procedure + hourly) and recomputes `client.plan` canonically, so the H.3 static Plan reports `pricing_missing` for those services instead of a fabricated 800×hours revenue. The forward-only data convergence deferred from PR #369.
**Branch:** `fix/pr-h-3-1-backfill-rate`
**Base:** `main` (contains #369 `c8b09a2`)
**App / Env:** Functions — `functions/scripts/` migration (read of `clients`, write via the canonical writer). Mutates the LIVE shared Firebase project (DEV=PROD, ONE project). Additive code; **data migration**.
**Effort:** MEDIUM. Investigation: data-investigator (cohort/predicate census) + backend-firebase-expert (canonical-writer safety) + completeness-checker; Haim checkpoint 2026-06-14 (scope = targeted 800 cohort only; approved to code). devils-advocate MANDATORY (data migration, §3.8.4).

**Context:** PR #369 removed the `data.ratePerHour || 800` silent default from both intake routes (forward-only; existing data deferred to THIS PR). The ONLY pre-#369 writers were `createClient` (`|| 800`) + the two dialogs (hard-coded 800); there was no UI to elect a rate → every stored rate is the 800 placeholder. The ONLY consumer of `service.ratePerHour` is the H.3 Plan helper (`computeServicePlan`, repo-wide verified). Real rate source = tofes `amountBeforeVat` snapshot at H.6 (MASTER_PLAN §8.2.5 D1, §8.5 D-B; H.3 PR1 rubric M2).

## MUST criteria (block on FAIL)

### M1 — Correct, complete strip cohort
**Rule:** The migration targets EXACTLY services where `type==='legal_procedure' && pricingType==='hourly' && typeof ratePerHour==='number' && ratePerHour===800`. It strips `ratePerHour` from those services and from no others. Multiple matching services on one client are all handled.
**Evidence:** `classifyServices` + tests A1–A4, D1; data-investigator predicate verdict (CORRECT AND COMPLETE).

### M2 — Non-800 → fail-secure GLOBAL STOP (preserve elected rates)
**Rule:** Any stored numeric rate that is NOT a legal-hourly 800 (a legal-hourly rate ≠ 800 incl. 0/negative = ELECTED_NON_800_RATE; a numeric rate on a non-legal-hourly service = UNEXPECTED_RATE_LOCATION) aborts the WHOLE run with ZERO writes, reported as clientId + code. Such a rate is a deliberately-elected rate to PRESERVE, never strip.
**Evidence:** the anomaly gate in `main()` (`process.exit(2)`, runs before any write, in both modes); tests B1–B5.

### M3 — plan recomputed canonically; hours aggregates NOT regressed
**Rule:** The write goes through `writeClientWithCanonicalAggregates` passing the cleaned `services[]` — `plan` (a RESTRICTED_KEY) is re-derived via `computeClientPlan`, and the hours/minutes aggregates are recomputed from the same services. Removing `ratePerHour` is NOT an input to any hours aggregate, so totalHours/hoursUsed/hoursRemaining/minutes*/isBlocked/isCritical stay identical. The stale 800-based `expectedRevenue` is replaced by `pricing_missing`.
**Evidence:** backend-firebase-expert GO-WITH-CONDITIONS (ratePerHour absent from `functions/shared/` aggregate code, grep-confirmed); tests E1–E2 (after-strip plan = pricing_missing, hours preserved, fixed-price sibling untouched).

### M4 — DRY-RUN default; `--apply` explicit; NOT run autonomously
**Rule:** Default mode is read-only DRY-RUN (discovery + before/after preview + backup, no writes). Writes happen only with `--apply`. The script is NON-interactive; the `--apply` run is supervised (Haim's hands) and is NOT executed by the agent.
**Evidence:** `APPLY = process.argv.includes('--apply')`; the `if (!APPLY) return` guard before Phase 2; PR body states `--apply` is deferred to Haim.

### M5 — Idempotent + TOCTOU-safe per-client transaction
**Rule:** A re-run after `--apply` is a no-op (cohort empty once stripped). Each client is migrated in its own Firestore transaction whose strip set + anomaly/null re-checks are rebuilt from the IN-TRANSACTION read (not the discovery snapshot). Per-client audit via `logCriticalActionInTxn` (atomic with the write).
**Evidence:** test E3 (re-classify cleaned → empty); the `runTransaction` block re-asserting `classifyServices` on the fresh `tx.get`; backend Q3 (read-before-write ordering valid).

### M6 — PII / PUBLIC-repo discipline
**Rule:** console + `audit_log` carry clientId + errorCode/counts ONLY — never client names, idNumber, or amounts. The before-state JSON backup (clientId + services snapshot) stays LOCAL in the gitignored `functions/backfill-backups/`.
**Evidence:** all `console.*`/audit payloads use clientId + code; `.gitignore` covers `functions/backfill-backups/`; no client name/idNumber/amount in any log path.

### M7 — Additive; mirrors the established backfill pattern; suite green
**Rule:** New script + test only; no change to intake routes, the canonical writer, the Plan helper, or aggregates. Mirrors `backfill-cost-per-hour.js` (dry-run default, `--apply`, gitignored backup, counts summary). Full functions suite green.
**Evidence:** `git diff` adds only `functions/scripts/backfill-strip-legal-hourly-rate.js`, `functions/tests/backfill-strip-legal-hourly-rate.test.js`, the rubric, and a `.gitignore` comment; full functions suite **899/899** (880 + 19 new).

## SHOULD criteria (warn on FAIL)

### S1 — Null/malformed service entries skipped + flagged (not silently dropped)
**Rule:** A cohort client with a null/non-object service slot is skipped + flagged (the canonical writer's `.filter(Boolean)` would otherwise drop it) — the rate strip is not conflated with a structural change.
**Evidence:** the `hasNullEntry` skip branch; test C1.

### S2 — Forward seam to H.6 + deferred-backfill provenance documented
**Rule:** The script header notes the real rate source is the tofes `amountBeforeVat` snapshot at H.6 and that this is the deferred convergence from PR #369.
**Evidence:** the file-header docblock.

### S3 — Testable pure core
**Rule:** The risky logic (`classifyServices` / `buildCleanedServices`) is pure and exported behind a `require.main === module` guard so the suite imports it without touching Firestore.
**Evidence:** `module.exports` + the `require.main` guard; the test imports the pure core directly.

## PRODUCT-GRADE GATES (G1–G7)
- **G1 errors:** N/A — no customer-facing UI path. The only output is a developer/admin CLI (console). Errors are logged as clientId + errorCode (no stack traces / undefined / English-in-Hebrew-UI surface).
- **G2 rollback:** PASS — code rollback = `git revert <sha>` (the script is additive and never auto-runs). Data rollback (if `--apply` already ran and the strip must be undone): the gitignored before-state backup `functions/backfill-backups/strip-legal-hourly-rate-*.json` holds each client's full `services[]` + `plan` snapshot to restore. Documented in the PR "Rollback" section.
- **G3 monitoring:** PASS — data-mutating: every applied client writes an atomic `audit_log` entry via `logCriticalActionInTxn` (`BACKFILL_STRIP_LEGAL_HOURLY_RATE`, actor `sys:backfill-rate-h3`, payload clientId + servicesStripped). Per-page progress + a final counts summary; per-client failures logged as clientId + errorCode (run continues). The DRY-RUN backup JSON is the pre-write record.
- **G4 customer test:** PASS — `backfill-strip-legal-hourly-rate.test.js` (19 tests) proves the scenario end-to-end against the REAL `computeClientPlan`: strip 800 → `pricing_missing` (NOT 800×hours), hours preserved, fixed-price sibling untouched, idempotency, anomaly detection, null-entry skip. Full suite 899/899.
- **G5 Hebrew UI:** N/A — no customer-facing strings; CLI/log output is developer-only (English logs acceptable per §2.1).
- **G6 breaking change:** PASS — documented, consumer-safe data change. The sole reader of `service.ratePerHour` is the Plan helper, which is by-design tolerant of absence (→ pricing_missing). No field is renamed/removed from any consumed contract; world-readable `clients` shape is unchanged except the targeted services lose a fabricated field + `plan.expectedRevenue` legitimately drops. This PR IS the migration; forward-only with a backup-based inverse. See the PR "Behavioral change" section.
- **G7 security:** N/A (no auth/rules/PII-surface change) — `ratePerHour` is non-PII billing metadata already on the world-readable client doc; no `firestore.rules` change. devils-advocate is MANDATORY here NOT for G7 but for the data-migration trigger (§3.8.4); its verdict is cited in the PR body.

## VERDICT
`outcomes-grader` must return **PASS** / **PASS_WITH_WARNINGS** before `gh pr create`.
