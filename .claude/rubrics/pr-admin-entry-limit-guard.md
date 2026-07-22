# Rubric — PR: admin-panel query caps + truncation guard

**Branch:** `fix/admin-entry-limit-guard` · **Commits:** `aedf8c9`, `f4d237b`
**App:** admin-panel (frontend only) · **Environment:** DEV (`main`) · **Size:** SMALL
**High-stakes:** the defect silently hides data from every admin screen. Adversarial review REQUIRED (ran; verdict below).

---

## Intent

`apps/admin-panel/js/managers/ClientsDataManager.js` loaded `timesheet_entries` and `budget_tasks` with a hard `limit(5000)`. Past that ceiling Firestore returns the first N documents and reports nothing — the admin panel then renders an **incomplete dataset with no indication whatsoever**. The oldest records disappear from every screen, every total, and every export that reads from this manager.

The recorded measurement puts production at roughly **4,962 of 5,000**, growing ~21 entries/day — i.e. days from crossing it.

**Two changes:**
1. Raise both caps to 20,000.
2. Add `warnIfTruncated(collection, snapshot, limit)` — when a query returns exactly its limit, log loudly and raise a **non-auto-hiding** notification, so truncation can never again be silent.

**Explicitly NOT in scope:** the structural fix (per-client querying / pagination / date-bounded queries). 20,000 is a runway extension of roughly two years at the measured rate, not a cure. That deferral is declared in `docs/MASTER_PLAN.md` rather than left implicit.

---

## MUST (all required for PASS)

| # | Criterion | Verification |
|---|---|---|
| M1 | **Every capped query in the file is guarded.** An unguarded capped query would defeat the entire purpose. | Full query enumeration performed in review: `timesheet_entries` (capped, guarded), `budget_tasks` (capped, guarded); `clients`/`employees` `.get()` and both `onSnapshot` listeners carry no `.limit()` and cannot truncate. No capped query is left unguarded. |
| M2 | **A regression to the old cap fails the suite.** The guard's correctness is a *coupling* between the value passed to `.limit()` and the value passed to `warnIfTruncated`. | The test fake previously **discarded** `.limit()`'s argument, so reverting the cap was undetectable — 12 tests would still have passed. `f4d237b` makes `limit` a recording spy and asserts the coupling on both loaders. Self-check performed: introducing a deliberate mismatch produced `AssertionError: expected 5000 to be 20000`, then reverted. |
| M3 | **The warning survives page load.** `notify.error()` hardcodes a 6-second auto-dismiss and `warnIfTruncated` runs inside `loadAllData()` at page init — the message would vanish while the admin was still watching a loading table, leaving every later screen unmarked. | Switched to `notify.show({ …, duration: 0 })`. Verified from `Notifications.js` that `duration: 0` only skips the auto-hide branch and that `closeable` still defaults true, so the notification remains **user-dismissible**. |
| M4 | **The guard cannot break the data load.** | `warnIfTruncated` validates `Array.isArray(docs)`, requires a positive `limit`, and is wrapped in its own try/catch inside each loader's existing try. Malformed / null / undefined snapshots are handled by test. |
| M5 | **`window.notify` is genuinely reachable**, so the user-visible half is not dead. | Load order traced on both pages: `Notifications.js` assigns `window.notify` at module scope; all scripts are `defer`; `ClientsDataManager.init()` runs only from the `DOMContentLoaded` → auth-guard callback, strictly later. The `typeof` guard is retained so a missing `notify` still degrades to console rather than throwing. |
| M6 | **No PII.** Repo is PUBLIC, CI logs world-readable. | The log template interpolates only a hardcoded collection-name literal and a numeric limit; the catch branch logs `guardError.message` only. No document data reaches any sink. |
| M7 | **Cache-bust complete.** A page serving a stale cached copy would silently not receive the fix. | Every HTML file referencing `ClientsDataManager.js` enumerated: exactly two, both bumped. No dynamic `createElement('script')` / `import()` loads exist. |
| M8 | **No performance regression.** 4× documents must not freeze the tab — trading a silent wrong number for a hung browser is not an improvement. | Consumers traced: `getClientTimesheetEntries` is a single linear filter called per selected client, never inside a loop over all clients; `calculateStatistics` does not iterate entries. No O(n²) path. Production sits at 4,962, so today's payload is unchanged. |
| M9 | **No decorative tests.** | Two were found and closed: a `typeof === 'function'` assertion (deleted) and a mislabelled "negative count mismatch" test that actually fired a false positive it never mentioned (the guard itself was corrected to require a positive limit; the test was split and honestly renamed). |
| M10 | **No regression.** | `npx vitest run` → **51 files / 892 passed / 2 skipped**. ESLint over the changed files → **exit 0, 0 errors**. |

## SHOULD

| # | Criterion | Verdict |
|---|---|---|
| S1 | The deferral is declared where the project tracks work, not only in a commit body. | MET — `docs/MASTER_PLAN.md` records the ~2-year runway as an estimate derived from two data points, and names the deferred structural fix. |
| S2 | Stale documentation is corrected in the same change. | MET — the three `.limit(5000)` references in `devtools/docs/INVESTIGATION-ADMIN-CLIENTS-MANAGEMENT.md` updated. |

---

## PRODUCT-GRADE GATES

| Gate | Verdict | Justification |
|---|---|---|
| **G1** | **PASS** | One new user-visible string, Hebrew, naming a next action: `'חלק מהנתונים ההיסטוריים לא נטענו עקב מגבלת כמות - הדוחות עשויים להיות חלקיים. פנה לתמיכה הטכנית.'` (title `'נתונים חלקיים'`). No stack trace, no `undefined`, no raw English exception. |
| **G2** | **PASS** | `git revert -m 1 <merge-sha>` after merge (preferred — immune to the commit list changing), then redeploy. Frontend only: no schema, no migration, no Cloud Function, no Firestore rule, no scheduler change. |
| **G3** | **PASS** | This change *is* observability: it converts a silent truncation into a `console.error` plus a persistent user-facing notification. |
| **G4** | **PASS** | See M2 — the coupling assertion was proven to fail against a deliberately reintroduced regression, not merely asserted to cover it. |
| **G5** | **PASS** | The single new user-facing string is Hebrew. |
| **G6** | **PASS — behavioural change declared.** | Two changes, both deliberate: queries now return up to 20,000 documents instead of 5,000; and a notification that does not auto-dismiss can now appear during normal use. Declared risk: once past the threshold the warning fires on every page load and every `refresh()`, and if both collections truncate, twice — a "trained to ignore it" risk. Accepted because that state is itself an emergency. |
| **G7** | **N/A** | No auth, rules, permissions, or PII surface touched. Read paths only; no write path added. |

---

## Anti-premature-closure

- **Does this fix the underlying problem?** No. It buys roughly two years and makes the ceiling audible. The structural fix is declared and deferred, not disguised.
- **Known-accepted, deliberately untouched:** the `docs.length === limit` heuristic false-positives on a collection of exactly 20,000 (negligible probability; failure mode is a warning, not a wrong number); and `orderBy('date','desc')` causes Firestore to omit documents lacking a `date` field entirely, so that truncation path is invisible to this guard — pre-existing, unproven, out of scope.
- **Unverified from the repo:** the 4,962 / ~21-per-day figures rest on two dated data points with **no preserved measurement script**. `docs/MASTER_PLAN.md` states this openly and instructs re-measurement before the number is trusted again. It affects the urgency estimate, not the correctness of the change.

---

## Reviews

**Adversarial review — VERDICT: GO-WITH-CHANGES**, no blocker. Two MAJOR (the test fake discarded `.limit()`'s argument; the 6-second toast fired during page load) and three MINOR. All closed in `f4d237b`. The reviewer independently verified `window.notify` reachability, cache-bust completeness, absence of an O(n²) path, and PII cleanliness, and ran the suite itself rather than trusting the claim.

**Final adjudication (independent, zero-context) — APPROVE FOR MERGE.** Every checkable number verified exactly: suite 51/892/2-skipped, ESLint 0 errors, the cap-coupling assertion confirmed to have no input under which it passes while the coupling is broken, and no decorative test remaining. The 4,962 figure was marked **UNVERIFIABLE FROM HERE** with the method not preserved — recorded above rather than presented as fact.

VERDICT: PASS
