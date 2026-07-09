# PR — tofes-mecher read-only circuit-breaker (code-side enforcement)

**Scope:** The bridge to tofes-mecher (`law-office-sales-form`) is READ-ONLY by
contract, but that was enforced ONLY by Console IAM (`roles/datastore.viewer`) —
there was NO code circuit-breaker. The blind-spot hunt (2026-07-09) flagged this
as the one real showstopper before the H.6 cutover/matching screen goes live.
This PR adds the code-side layer, on the CURRENT key-based architecture (keyless
ADC + a narrow custom role are a separate, later infra track — not this PR).

Backend, `functions/src-ts/tofes-mecher/**` + the cutover consumer. Read-only
contract change (no new writes); every changed CF path is behavior-preserving.

## Honest limit (state in the PR body)

Code CANNOT downgrade a credential's permissions — the Admin SDK bypasses
Security Rules and *attempts* any call; whether a write SUCCEEDS is GCP IAM's
decision. `datastore.viewer` already denies writes at the IAM layer. The
strongest honest guarantee code provides is: **no write is ATTEMPTED anywhere in
this repo, and a wrong-project key is REFUSED at init.** Over-read (the SA can
read all of tofes) is unfixable in code — it needs infra (custom role / VPC-SC),
tracked separately.

## MUST

### M1 — Read-only reader is the sanctioned surface
`getTofesMecherReader(saKeyJson)` returns a FROZEN object exposing ONLY
`readDoc(collection, id)` + `readCollection(collection)` — no caller holds a
handle that can `.set/.update/.delete/.add/.batch/.create`. All FIVE live
consumers route through it: `validate-sales-record` (readSalesRecordSnapshot +
the inline handler), `export-sales-to-bigquery`, `list-unlinked-sales-records`;
the cutover `create-client-from-sales-record` inherits it via
`readSalesRecordSnapshot`. No consumer calls `getTofesMecherApp(` directly.
**Not oversold:** IAM (`datastore.viewer`) is the ENFORCING layer — a returned
snapshot's `.ref` is still write-capable and `getTofesMecherApp` stays exported
for its tests, so the reader is the sanctioned surface + a guard backstop, NOT a
hermetic wall.

### M2 — Wrong-project circuit-breaker (fail-closed, NOT a tautology)
`getTofesMecherApp` refuses a well-formed key whose OWN `project_id` is not
`TOFES_MECHER_PROJECT_ID`, throwing the sanitized `TofesMecherCredentialError`
BEFORE `cert()`/`initializeApp` — no key fragment leaks. The check is on the
PARSED KEY's `project_id`, NOT on `app.options.projectId` (a hardcoded constant →
catches nothing). Scope is wrong-**project** only (NOT a wrong/over-privileged SA
within the tofes project — that's IAM + the init hash signal). The warm-reuse
memo skips the re-check safely ONLY because `app.ts` is the SOLE initializer of
the app name (a wrong key throws before it can be cached) — documented in-code.

### M3 — AST guard + wrong-project test
A new static AST guard (`tofes-readonly-guard.test.ts`, mirrors
`verify-claims.test.ts`) asserts: (a) `app.ts` is write-free (crypto `.update`
stripped so it doesn't false-match); (b) the frozen reader exists; (c) a
DIRECTORY-WIDE scan of `tofes-mecher/**` (except app.ts) + `cutover/**` — no
module calls `getTofesMecherApp(`, and the live readers route through
`getTofesMecherReader(` (catches a FUTURE module, not a fixed allowlist); (c2)
the reader files never write through a returned `.ref`; (d) the breaker checks
`parsed.project_id`; (e) the init log emits a HASH, never a raw email. A runtime
test proves a wrong-project key is refused before cert/init, and that the reader
is frozen + read-only.

### M4 — Init self-test signal (PII-safe)
On successful init, a single `logger.info('tofes_mecher.app.initialized', {
projectId, clientEmailHash })` emits a HASH of the SA `client_email` (first 12
hex of sha256), NOT the email — so a wrong-but-same-project SA is detectable
(different SA → different hash) WITHOUT writing an email to project-readable Cloud
Logging, honoring the MASTER_PLAN §2.2 absolute "NO email in log fields" rule.
NEVER logs the key or any key fragment.

### M5 — Behavior-preserving + green
Every changed CF reads exactly as before (same collection, same doc/collection
`.get()`); credential errors still surface at init (eager reader construction) so
each caller's init try/catch still classifies them. Full functions suite green;
tsc 0; ESLint 0 errors on changed files.

## SHOULD

### S1 — No scope creep into infra
Keyless ADC, a narrow custom read-only role + IAM Condition, and any org-level
control (VPC-SC / org policy) are NOT in this PR — they are the follow-up infra
track (gated on the `gcloud projects get-ancestors` org recon). The PR body names
them as deferred.

### S2 — lib/ committed for the 4 changed modules only
Only the recompiled `lib/tofes-mecher/{app,validate-sales-record,export-sales-to-bigquery,list-unlinked-sales-records}.js(.map)`
are staged — unrelated `lib/*` line-ending churn from the fresh tsc emit is NOT.

## PRODUCT-GRADE GATES

- **G1 — errors:** PASS. Wrong-project/malformed key → the existing sanitized
  `TofesMecherCredentialError` → the callers' existing Hebrew `HttpsError`
  (`internal` on init). No key fragment, no raw message. No new customer-facing
  string.
- **G2 — rollback:** PASS. Code-only; `git revert` + redeploy functions. No data,
  no schema, no rules. The reverted code reads tofes exactly as today.
- **G3 — monitoring:** N/A→PASS. Read-only (no data mutation to tofes). The one
  new log is the init self-test signal (non-PII). The MAIN-project dead-letter /
  audit writes in the consumers are UNCHANGED.
- **G4 — test proves scenario:** PASS. AST guard (write-free + routed) + runtime
  wrong-project-refused + reader-frozen-read-only; full suite exercises all five
  consumers through the reader.
- **G5 — Hebrew UI:** N/A. No new customer-facing string (the init log is
  admin-only English; existing Hebrew errors unchanged).
- **G6 — breaking change:** PASS / none. `getTofesMecherReader` is additive;
  `getTofesMecherApp` stays exported (its tests keep it). The wrong-project
  assertion is a NEW fail-closed guard but the LIVE key IS the tofes project
  (`cross-project-reader` in `law-office-sales-form`) → no runtime regression. No
  callable contract, route, or return shape changes.
- **G7 — security:** PASS. Security-access specialist consulted in investigation
  (verdict: ship the wrapper + corrected parsed-project assertion; the
  `app.options.projectId` form is a tautology; defer the CI IAM audit as an infra
  alert). Cross-project auth surface — tightened, not loosened.

## Rollback

```
git revert <merge-commit>
cd functions && npm run build:ts   # or use the reverted lib/
firebase deploy --only functions:validateSalesRecordExists,functions:exportSalesToBigQuery,functions:listUnlinkedSalesRecords
```
Code-only, no data migration, no rules, no schema. A revert restores the exact
prior read paths (the reader is a thin wrapper over the same `.get()` calls).
