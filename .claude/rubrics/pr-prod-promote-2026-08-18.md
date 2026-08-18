# PR-PROD-PROMOTE-2026-08-18 — promote `main` to `production-stable`

**Type:** branch promotion (PROD frontend release)
**App:** Admin Panel + User App (frontends only — `functions/` and `firestore.rules`
already deploy from `main` and are live)
**Environment:** PROD
**Branch:** `promote/main-to-production-stable-2026-08-18` → `production-stable`
**Rebuilt:** 2026-08-18, off `main` at `d7aa94e` (post-PR #547)
**Scope:** 241 commits (was 239 before PR #547 added two). `production-stable` tip was `8c869d4`, dated 2026-07-24.

## Why this PR exists

Netlify serves both PROD sites from `production-stable`; `main` is DEV. The branch
had drifted 241 commits, so partners were working against a build from 2026-07-24.
Notably, the hours-capacity work (PR #546) shipped to `main` and its data migration
already ran in production — 163/164 client docs carry `hoursCapacity` — but the
display that reads it was never promoted.

## MUST

| # | Criterion | Evidence required |
|---|---|---|
| M1 | Every merge conflict is resolved without losing a live PROD-only fix — **and every BRANCH of each ported fix, not merely its existence** | Per-file verification against the code, not against commit ancestry. Attempt 1 failed exactly here — see below |
| M2 | No PROD-only commit has substance absent from `main` | Enumerate `git log origin/production-stable ^origin/main` and account for each |
| M3 | No executable file in the merge tree differs from the CI-green `main` tree | `git diff origin/main --name-only` filtered to `js\|ts\|html\|json\|rules\|yml` returns 0 |
| M4 | G2 rollback survives the promotion | A regression must be revertable by `git revert` + redeploy within 5 minutes |
| M5 | Nothing newly reachable in PROD activates a write path that has not been through supervised promotion | Verify EVERY newly-reachable admin surface — all four, named, not one generalised to the class |
| M6 | Deviation from "resolve everything to `main`" is explicit, justified in-file, and reversible | Comment at the deviation site naming the gate it protects |

## SHOULD

| # | Criterion |
|---|---|
| S1 | The absence of CI on the target branch is named, not silently relied upon |
| S2 | Follow-up work created by a deliberate deviation is written down, not left implicit |
| S3 | Post-merge smoke steps are stated concretely enough to execute |

## Verification performed

**M1 — conflicts (4, all resolved to `main`).** `clients-fluent.html`,
`clients.html`, `ClientsDataManager.js`, `ClientReportModal.js`. All trace to
PROD-only hand-ports `8c869d4` (#465), `775fd27` (#464), `2ee8961` (#462).
`#465`'s message says it ported `main`'s `e8af737` + `e29aac7`; those SHAs are not
ancestors of `main` (squash-merged), so ancestry was not used as evidence. Instead:

- `timesheetLoadFailed` / `budgetTasksLoadFailed` and the non-auto-hiding Hebrew
  toast "טעינת שעתון נכשלה" are present in `main`'s `ClientsDataManager.js`
  (lines 33-34, 340, 354, 358, 390, 401).
- Neither branch's `ClientReportModal.js` reads those flags — grep for `LoadFailed`
  returns 0 on `production-stable`'s copy. No consumer is lost; the toast is the
  entire user-visible surface.
- `main` replaced `ClientReportModal.js` (1951 lines → a 168-line shim) and moved
  report rendering to `ClientManagementModal.js`, which reads `stage.hoursUsed`
  directly from the stored aggregate (~line 887) — the SSOT behaviour #465 ported,
  with no recompute-from-timesheet loop.
- Both branches already carry `timesheetLimit` / `budgetTasksLimit` = 10000.

**M2 — PASS.** Of the PROD-only commits, four carry content (`8c869d4`, `775fd27`,
`2ee8961`, `f2f2ee3`) and the rest are merge commits of `main`. `f2f2ee3`
(deduction) exists in `main` as `45b73ce` and evolved from there. No PROD-only
substance is absent.

**M3 — PASS.** `git diff origin/main --name-only` filtered to executable extensions
returns **0**. The five differing files are this rubric itself, the two PROD-only rubric docs (kept,
additive) and the two `netlify.toml` files under M6.

**M4 — PASS, and it is the reason for M6.** Live PROD serves
`public,no-cache,must-revalidate` on admin `/js/*` and `/css/*` (verified by
`curl -I` against both PROD hosts). `main` switches both sites to
`max-age=31536000, immutable`. That policy is only safe when every asset ref
carries a `?v=` token — 83 refs across the 11 admin pages have none, and the admin
Netlify build command is `echo`, so cache-bust never runs there
(`update-cache-busting.js` touches only the two `index.html` files and *replaces*
an existing token rather than adding one). Promoting it would pin 83 assets in
partners' browsers for a year, making a hotfix unrollable by revert + redeploy.

**M5 — PASS.** The promotion makes `reconciliation.html` ("סנכרון שעות") a primary
nav item, which controls `system_settings/package_reconciliation.mode` — the switch
that puts the reconciliation loop into `enforce`, where it writes to live client
documents. A read-only probe returned `mode = "dry_run"`. The supervised
`dry_run → enforce` promotion (MASTER_PLAN §14) has not run and is unaffected by
this PR. The page also requires a typed confirmation token to reach `enforce`.

**M6 — PASS.** `netlify.toml` and `apps/admin-panel/netlify.toml` hold `/css/*`,
`/js/*` (and the user-app's `/dist/*`) at `no-cache, must-revalidate`, each with an
in-file comment naming the G2 gate it protects and the precondition for adopting
`immutable` later. Reversible by aligning those blocks with `main` once the token
gaps are closed.

## Attempt 1 was FAILED — and the failure was real

This promotion was first assembled against `main` at `affe106`. `outcomes-grader`
**FAILED it**, and it was right.

`main` had lost the pricing-aware stage worked-hours rule that `production-stable`
still applies at `ClientReportModal.js:377-379`. On a FIXED-price stage the backend
maintains only `totalHoursWorked` and leaves `hoursUsed` at the `0` it was created
with; every admin-panel consumer read `hoursUsed`. Because that `0` is *finite*, no
guard fell through — the report printed 0 with full confidence.

Measured on live data: **87 of 150 stages are fixed; 26 would have reported a wrong
figure** on the report a partner sends to a client. Worst observed: 120.09h of work
printed as 22.5, and 30.5h printed as 0.0.

**Promoting attempt 1 would have shipped that regression into production.**

It was fixed in `main` first — not inside this promotion branch, which would have put
un-CI'd code straight onto `production-stable` and forfeited M3, the only substitute
for the missing CI. PR #547 merged as `d7aa94e` and deployed green (Deploy to
Production ✓, Health Check ✓).

**This branch was then rebuilt from scratch** off `origin/production-stable` and
re-merged against the fixed `main`. Same 4 conflicts, same resolution, cache policy
re-applied.

**The reusable lesson:** "`main` is a superset" was asserted from a line-count
(1951 → a 168-line shim), from the load-failure flags, and from the stage-card SSOT —
but nobody followed the `pricingType` *branch*. Verifying that a ported fix EXISTS is
not the same as verifying that every BRANCH of it exists.

## The two-definitions landmine (devils-advocate 🔴 #1) — declared, measured, NOT blocking

`ClientsDataManager.loadClients()` **overwrites** the server's `client.totalHours` with
its own frontend recomputation (`:265`). That recomputation excludes only `archived`
services (`_isServiceCountedForClientAggregate`, `:148-154`). The server's capacity rule
excludes `['archived', 'completed']` (`functions/shared/service-status.js:35`).

So the hours figure and the NEW phantom line beneath it are computed on **different
definitions**, one row apart. The divergence fires for a service that is `completed`
while still holding an `active` stage carrying hours — a shape that genuinely occurs in
this system's design, because stage ג' is never marked `completed` and `completeService`
does not touch `stages[]`.

**Measured against live production, two independent ways (2026-08-18, read-only):**

| Check | Result |
|---|---|
| Rows where the frontend total disagrees with `hoursCapacity.activeHours` | **0 of 163** |
| Services that are `completed` AND hold an active stage with hours | **0** |
| Service statuses in production | `active: 190`, `archived: 12`, `completed: 6` |

The condition is **structurally real and empirically dormant**. Blocking the promotion
on a contradiction that renders on zero rows would trade a certain benefit for a
hypothetical one — so it is declared here rather than used as a gate.

**Trigger to watch:** the first time a service is set to `completed` while one of its
stages is still `active` with hours on it, that client's row will show a total that
includes hours the phantom line says are unavailable. **PR-4 (retire the parallel
frontend recomputations) is the fix and is already on the plan** — this measurement is
the argument for its priority, not a reason to hold the promotion.

## Newly-reachable admin surfaces — all four (M5)

The promotion opens four admin pages that `production-stable` does not have. Each was
checked individually; generalising from one to the class is the exact reasoning shape
that made attempt 1 fail, so it is not used here.

| Page | Write reachable? | Gate |
|---|---|---|
| `reconciliation.html` | Yes — `enforce` writes to live client docs | Fail-closed `claims.role==='admin'` render gate; `enforce` requires typing `תיקון` in the UI **and** a backend `confirmToken==='enforce'`. Live setting probed: `mode = "dry_run"`, so nothing is armed |
| `pending-clients.html` | Yes — `createClientFromSalesRecord` creates real client docs; `releaseClientFromPendingSignature` egresses a fee-agreement PDF to Anthropic, then flips the client to `active` | Fail-closed admin gate; Hebrew confirm dialog before each call; page load calls only the read-only `listUnlinkedSalesRecords`. Both CFs already deploy from `main` and are LIVE in PROD today — the promotion adds the UI, not the capability. DPA basis resolved 2026-07-01 (MASTER_PLAN §8.8) |
| `employee-costs.html` | Yes — `setEmployeeCost` | Fail-closed admin gate; nothing fires on load |
| `profitability.html` | Yes — `recomputeProfitability` | Fail-closed admin gate; nothing fires on load |

## Partner-visible display changes beyond the phantom line (G6, declared)

Neither is a count, filter, sort, or CSV change — but both land on partners on day one:

1. **Progress-bar polarity flips.** `ClientsTable.js` filled the bar with `remaining/total`,
   so a client whose real capacity shrank appeared *healthier*. It now fills with
   `used/total`, clamped 0-100. **Every client's bar renders differently after this
   promotion.** Deliberate (PR-3c) and correct, but it is a visual change on every row.
2. **A new status label** `ממתין לחתימה` takes precedence over the derived
   `חסום (אין שעות)` for `status==='pending_signature'`. Display precedence only — the
   status filter is unchanged.

**Four admin pages are REMOVED** by the promotion: `tasks.html`, `timesheet.html`,
`feature-flags.html`, `debug-firebase-init.html`. Verified safe: a `git grep` across
`origin/production-stable`'s admin HTML and JS finds **zero** references to any of
them — they are orphans, reachable only by a direct bookmark.

## Adversarial review

`devils-advocate` (mandatory, CLAUDE.md §3.8.4 — merge to `production-stable`)
returned **GO-WITH-CHANGES** with two blocking conditions. Both were closed before
this PR:

1. *Determine the live cache policy — #465's commit message contradicts
   `netlify.toml`.* Closed by `curl`: PROD is genuinely `no-cache`, so the attack
   was real and #465's message was wrong. Resolved by M6 above.
2. *Confirm the reconciliation mode is not `enforce` before the nav tab reaches
   PROD.* Closed by probe: `dry_run`.

It found **no** PROD-only commit whose substance is absent from `main`, and
confirmed `functions/` in the merge tree is byte-identical to `main`.

Its three non-blocking findings are recorded as follow-ups below rather than fixed
here — each is pre-existing in `main` and none is introduced by this promotion.

## Follow-ups created by this PR

1. **Cache-busting coverage.** Add `?v=` tokens to the 83 untokenised admin refs
   (or make the admin build run cache-bust), then align both `netlify.toml` cache
   blocks with `main`. Until then the `immutable` policy on `main`/DEV rests on an
   assumption that does not hold.
2. **Load-failure flags have no reader.** `timesheetLoadFailed` /
   `budgetTasksLoadFailed` are written but never read anywhere in `apps/admin-panel`
   on either branch. `ReportGenerator.js` (~lines 845-869, 897-923) still falls back
   to summing the client-side entries array, so a failed load can print
   "0.0 שעות" on a partner-facing report. Pre-existing in `main`; not a regression.
3. **No CI on `production-stable`.** Both workflows trigger on `main` only, so this
   promotion runs no tests, no lint, no type-check, and no rules deny-suite.
   Equivalence to the CI-green `main` tree (M3) is the substitute evidence. Worth
   deciding whether the target branch should get its own gate.

## Rollback — READ THIS BEFORE TYPING ANYTHING

**The command is:**

```
git revert 37f95a1
```

`37f95a1` is the promotion. Plain revert, **no `-m 1`** — PR #548 was merged with
SQUASH, so it has a single parent.

### Do NOT use `git revert -m 1 <latest merge commit>`

That was the original instruction here and it is now actively dangerous. The newest
merge commit on `production-stable` is the **ancestry-repair merge**, which changes
no files. Reverting it prints:

```
On branch ...
nothing to commit, working tree clean
```

— a no-op that reads as success. Netlify redeploys nothing, PROD stays broken, and
the operator believes the rollback worked. It is a decoy. Revert `37f95a1` by name.

### After a rollback, re-promotion needs one extra step

The ancestry repair makes git believe `main` is already an ancestor. So once you have
reverted:

```
git merge origin/main     # -> "Already up to date."  DOES NOTHING
```

To get the promotion back, revert the revert:

```
git revert <sha-of-the-revert-commit>
```

That restores tree `8da879d`. Verified by execution in an isolated clone, not reasoned.

### Why the revert reaches browsers at all

Because the cache deviation held assets at `no-cache`. Had `immutable` been promoted,
a revert + redeploy would **not** have reached already-cached browsers — it would have
needed a filename change. That is the G2 gate this promotion protected.

Frontend-only: `functions/` and `firestore.rules` are untouched and already live from
`main`, so no Cloud Function delete step is needed.

## Post-merge smoke (Haim's hands)

1. Confirm both Netlify PROD deploys go green.
2. Open the admin panel PROD URL, hard-refresh once.
3. `clients.html` — confirm the clients table renders, the phantom-capacity line
   appears on an affected client, AND that a client's progress bar reads sensibly:
   it now fills with hours USED, so a heavily-used client shows a FULLER bar than
   before, not an emptier one.
4. Confirm the nav shows the new tabs and that "סנכרון שעות" reports `dry_run`.
5. Open the user app PROD URL and confirm time entry still saves.
6. Any console error = deployment FAIL, per the root CLAUDE.md deployment rules.
