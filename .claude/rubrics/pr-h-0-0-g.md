# Rubric — Pre-H.0.0.G

**Title:** `employee_costs/{email}` CF-only collection + setEmployeeCost / getEmployeeCost callables
**Branch:** `feat/pre-h-0-0-g-employee-costs`
**Base:** `main`
**Scope:** New CF-only Firestore collection storing per-employee cost-per-hour (salary-adjacent PII, sourced from the external accountant). Single-doc-per-employee model (Haim approved — NOT subcollection; historical lookup is YAGNI under snapshot-never-re-derive §1.3.7). Zod schema, 2 v2 callables (admin-gated write + read), audit-first via `logCriticalAction` (Pre-H.0.0.C), firestore.rules block + rules-test (Pre-H.0.0.D infra). Hard dependency for Phase 2 H.2 → H.3 (profitability dashboard, first visible bud). Also carries Pre-H.0.0 status updates to MASTER_PLAN.

## MUST criteria (block on FAIL)

### M1 — CF-only rule, fully locked
**Rule:** `firestore.rules` adds `match /employee_costs/{email} { allow read, write: if false; }` — fully CF-only (stricter than audit_log's admin-read). No existing rule modified.
**Evidence:** grep firestore.rules for the block; diff touches only the addition + header docblock note.

### M2 — rules-test mirror + 8 deny scenarios
**Rule:** `firestore.rules.test` mirrors the real `employee_costs` block. `tests/rules/employeeCosts.test.ts` asserts read+write DENY for unauth / employee / admin / partner (8 scenarios). The admin-DENY is the key non-obvious assertion (even admin client SDK cannot read).
**Evidence:** both files present; 8 `it()` blocks; all `assertFails`.

### M3 — Zod schema, strict, with enum source + cost bounds
**Rule:** `functions/src-ts/schemas/employee-cost.ts` — `setEmployeeCostInputSchema` is `.strict()`; `costPerHour` min(1) max(20000); `source` is `z.enum(['accountant','manual','import'])`; `currency` `z.literal('ILS')`; `email` `.email().toLowerCase()`.
**Evidence:** schema file present with these constraints.

### M4 — setEmployeeCost: admin-gated, audit-FIRST, fail-secure
**Rule:** dual-shape admin gate (`role==='admin' || admin===true`); Zod validation; employee-existence proof (`employees/{email}`); audit via `logCriticalAction('SET_EMPLOYEE_COST',...)` BEFORE the write — if audit fails, NO write; compensating audit on write failure.
**Evidence:** source ordering (audit before `costRef.set`); tests assert audit-fail-aborts + compensating-audit + not-found.

### M5 — Email normalized ONCE (same key for existence-check + write)
**Rule:** email lowercased by the schema transform; the SAME normalized value keys both `employees/{email}` existence check and `employee_costs/{email}` write (devils-advocate Attack #1).
**Evidence:** source uses one `email` var for both `.doc(email)` calls; test "lowercases email before existence-check + write".

### M6 — getEmployeeCost: admin-gated, NO self-read, read-only
**Rule:** dual-shape admin gate; NO self-read carve-out (employee cannot read own cost); no audit write (read-only); no `.set(`.
**Evidence:** AST test asserts no `=== request.auth.token.email`, no `logCriticalAction`, no `.set(`; runtime test "rejects non-admin employee (NO self-read)".

### M7 — PII discipline: cost NEVER in logger.*, updatedBy=UID
**Rule:** cost figures appear ONLY in the `audit_log` payload (forensic), NEVER in `logger.*`. `updatedBy` is the admin UID, never email.
**Evidence:** AST tests `not.toMatch(/logger\.\w+\([^)]*costPerHour/)` + `updatedBy: callerUid`.

### M8 — Hebrew customer-facing errors (G1, G5)
**Rule:** every `HttpsError` to the caller has a Hebrew message with next-action. No raw FirebaseError, no English.
**Evidence:** grep diff for `HttpsError(` — all Hebrew.

### M9 — audit_log salary-PII consequence documented (devils-advocate Attack #3)
**Rule:** because cost values live in `audit_log` (admin-read), and H.8 plans a BigQuery export, the code + rubric + MASTER_PLAN MUST document that `SET_EMPLOYEE_COST` audit details are salary-PII and H.8's export MUST redact them.
**Evidence:** comment in set-employee-cost.ts header + MASTER_PLAN §7.6 note + §8.11 flag.

### M10 — wiring + lib committed
**Rule:** `functions/index.js` exports `setEmployeeCost` + `getEmployeeCost` via `require('./lib/...')`. `functions/lib/{set,get}-employee-cost.js` + `lib/schemas/employee-cost.js` committed, matching a fresh `npm run build:ts`.
**Evidence:** index.js diff; lib files present; `git diff functions/lib/` empty after rebuild.

### M11 — all tests pass, no regression
**Rule:** `npm run test:ts` (functions) → 103 (72 prior + 31 new). `npm test` (root) → 367 + drift-guard, unchanged. `npm run test:legacy` → 600 unchanged. ESLint 0 errors. typecheck 0 errors. Rules-emulator tests run on CI (Java not local).
**Evidence:** local run output.

### M12 — Devils-advocate findings addressed (MANDATORY §3.8.4)
**Rule:** all 5 attacks addressed: #1 email-normalize-once; #3 cost-in-audit documented + H.8 flag; #4 max raised to 20000; #5 App Check N/A documented + validFrom as metadata; #2 overwrite acceptable under snapshot model (documented). New collection + new rule + PII → devils-advocate was MANDATORY and ran.
**Evidence:** this section maps each attack to its resolution.

## SHOULD criteria (warning on FAIL)

### S1 — MASTER_PLAN carries
§7.1 row D→✅ #343, E→BLOCKED+deferred, G→in progress; §7.4 E circular-ref fix + BLOCKED findings; §7.6 G locked decisions; §10 new rows; §14 revision entry.

### S2 — resolveEmployeeCost + deleteEmployeeCost explicitly deferred/out-of-scope
Documented in schema header + MASTER_PLAN §7.6 (resolveEmployeeCost → H.2; delete → not needed).

### S3 — drift-guard match-block gap flagged to backlog
Security noted the drift-guard checks only helpers not match-blocks. Flagged as a non-blocking backlog item (not required for G).

## PRODUCT-GRADE GATES

- **G1 Customer errors:** PASS — Hebrew HttpsError everywhere, actionable.
- **G2 Rollback:** PASS — `git revert` removes collection + callables + rules + lib + docs. Collection starts empty; any written cost docs are CF-only orphans (harmless). No inverse migration needed.
- **G3 Monitoring:** PASS — setEmployeeCost writes audit_log (who/when/prev/new) + structured logger.info on success/failure (cost value omitted — PII). getEmployeeCost logs read access.
- **G4 Customer-scenario test:** PASS — 31 ts-jest tests (set: auth gates, Zod, existence, fail-secure, happy path, email-normalize; get: auth gates incl no-self-read, Zod, not-found, success) + 8 rules-emulator deny scenarios.
- **G5 Hebrew UI:** PASS — all customer-facing strings Hebrew; logger keys English (admin-facing, acceptable).
- **G6 Breaking change:** PASS — purely additive (new collection, new callables, new rule block). No existing schema/contract changed. Collection starts empty.
- **G7 Security:** PASS — security-access-expert consulted (PASS_WITH_WARNINGS, 4 required changes all applied); devils-advocate MANDATORY (PROCEED-WITH-CHANGES, 5 changes all applied). New PII collection + new rule + new endpoints returning user data → G7 mandatory, satisfied.

## Out of scope (do not downgrade for absence)

- `resolveEmployeeCost(email,date)` shared helper — deferred to H.2 (its first consumer). YAGNI now.
- `deleteEmployeeCost` — set+get sufficient; accountant re-sets, H.2 reads.
- subcollection-with-history / composite index — single-doc model chosen (snapshot-never-re-derive makes history YAGNI).
- App Check / rate-limiting — system-wide decision (not G-only); N/A for 10-user admin-trust model.
- drift-guard match-block coverage — backlog item.
- H.8 BigQuery redaction of cost audit details — flagged for H.8; not buildable now (H.8 is future).

## Rollback

```bash
git revert <merge-commit>
git push origin main
firebase deploy --only functions:setEmployeeCost,functions:getEmployeeCost
firebase deploy --only firestore:rules
```

Removes the 2 callables, the rules block, the schema, lib output, docs. Any cost docs written before revert are CF-only orphans — unreadable by any client, consumed by nothing until H.2. No data migration.

## Test plan

Automated (this PR): see M11. Manual smoke (DEV, post-deploy):
1. As admin, call `setEmployeeCost({email:'<test-employee>', costPerHour:150})` → confirm `employee_costs/{email}` doc + `audit_log` SET_EMPLOYEE_COST entry with previousCost/newCost.
2. As admin, call `getEmployeeCost({email:'<test-employee>'})` → returns the record.
3. As a non-admin (or unauth), both calls → `permission-denied` / `unauthenticated` (Hebrew).
4. Confirm Firestore console: a non-CF client read of `employee_costs/*` is denied.
5. Confirm Cloud Logging: no cost figure appears in any `employee_cost.*` log line.

## Notes for grader

- G is the payoff of the foundational PRs: it uses C (`logCriticalAction`), D (rules-test infra), B (TS callable + Zod + dual-shape gate) — all three foundations exercised together for the first time.
- The single-doc model is a deliberate YAGNI contraction (completeness NEEDS-CONTRACTION), NOT a quality compromise per §2.0.2 — it matches the locked §7.6 spec + the snapshot-never-re-derive invariant. Subcollection-history would add unused capability.
- audit_log now carries salary-PII (cost values). This is the strongest devils-advocate finding (#3). Resolution: keep values (forensic necessity) + explicit H.8-redaction flag. The grader should confirm the H.8 flag is documented in 3 places (code header, MASTER_PLAN §7.6, this rubric §M9).
