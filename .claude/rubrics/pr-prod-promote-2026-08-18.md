# PR-PROD-PROMOTE-2026-08-18 — promote `main` to `production-stable`

**Type:** branch promotion (PROD frontend release)
**App:** Admin Panel + User App (frontends only — `functions/` and `firestore.rules`
already deploy from `main` and are live)
**Environment:** PROD
**Branch:** `promote/main-to-production-stable-2026-08-18` → `production-stable`
**Rebuilt:** 2026-08-18, off `main` at `d7aa94e` (post-PR #547)
**Scope:** 239 commits. `production-stable` tip was `8c869d4`, dated 2026-07-24.

## Why this PR exists

Netlify serves both PROD sites from `production-stable`; `main` is DEV. The branch
had drifted 239 commits, so partners were working against a build from 2026-07-24.
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
| M5 | Nothing newly reachable in PROD activates a write path that has not been through supervised promotion | Verify the live setting each new admin surface controls |
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
returns **0**. The four differing files are the two PROD-only rubric docs (kept,
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

## Rollback

```
git revert -m 1 <merge-commit-sha>
```

then let Netlify redeploy both sites. This is a frontend-only promotion —
`functions/` and `firestore.rules` are untouched by it and already live from
`main`, so no Cloud Function delete step is needed. The revert is effective
because M6 kept assets revalidating; had `immutable` been promoted, revert would
not have reached already-cached browsers.

## Post-merge smoke (Haim's hands)

1. Confirm both Netlify PROD deploys go green.
2. Open the admin panel PROD URL, hard-refresh once.
3. `clients.html` — confirm the clients table renders and the phantom-capacity
   line appears on an affected client.
4. Confirm the nav shows the new tabs and that "סנכרון שעות" reports `dry_run`.
5. Open the user app PROD URL and confirm time entry still saves.
6. Any console error = deployment FAIL, per the root CLAUDE.md deployment rules.
