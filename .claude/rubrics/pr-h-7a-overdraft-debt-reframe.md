# Rubric — PR-H-7a — Overdraft "open debt to collect" semantic reframe

**Title:** H.7.a — reframe the admin service-overdraft surface from "exception/overrun" to "חוב פתוח לגביה מהלקוח" (open debt to collect) — DISPLAY-ONLY
**App:** Admin Panel · **Env:** DEV · **Frontend-only, display-string reframe, admin-critical**

**Scope:** H.7.a — the Haim-approved "Option A" half of H.7 (§8.9), after a 3-lens investigation overturned the stale premise. **The §8.9-named `ExceptionModal.js` and the string "הפסד למשרד" never existed in code.** The only LIVE overrun-framing surface is `apps/admin-panel/js/features/ServiceOverdraftResolution.js` (admin, on `clients.html`), which already said the neutral "חריגה". This PR reframes that surface's user-facing copy toward "open debt to collect", **with zero backend / persistence / count-filter change**. The collection-WORKFLOW (3-state buttons + persist + dashboard reflection) is **H.7.b — DEFERRED** (gated on the OWN-* backend session releasing `clients/index.js`/`client-writer.js` + H.6's `paidRevenue`).

**In this PR:**
- `ServiceOverdraftResolution.js` — reframe **9 user-facing Hebrew strings**: the open-overrun warning (`חריגה: X שעות` → `חוב פתוח לגביה: X שעות`), the resolve button (`סמן כהוסדר` → `סמן כנגבה`), the resolved-title (`חריגה הוסדרה` → `החוב נגבה`), the modal title (`סימון חריגה כהוסדר` → `סימון חוב כנגבה`), the explanation placeholder (`כיצד החריגה הוסדרה` → `כיצד נגבה החוב`), the success toast (`החריגה סומנה כהוסדרה` → `החוב סומן כנגבה`), the admin-only alert + the unresolve confirm + the unresolve toast (`"הוסדר"` → `"נגבה"`, `כחריגה פעילה` → `כחוב פתוח לגביה`). + **2 stale code comments** updated to match.
- `clients.html` — bump the `?v=` on the `ServiceOverdraftResolution.js` script tag.
- `docs/MASTER_PLAN.md` — correct the stale §8.9 premise + record the H.7.a/H.7.b split (§14 entry).

**Excluded (intentional):** the backend `setServiceOverdraftResolved` CF, the `resolved:true/false` payload, and the `overdraftResolved.isResolved` field (UNCHANGED — no behavioral/count change); the 3-state collection workflow + persistence + dashboard (H.7.b); the factual "חריגה" status badges on `ClientsTable`/`ClientReportModal`/`service-card-renderer` (they mean "overrun", a fact — vocabulary-harmonization deferred to H.7.b).

## MUST (block on FAIL)
- **M1** — the overdraft surface's user-facing copy is reframed to the "open debt to collect" mental model: the open-overrun warning shows `חוב פתוח לגביה`, the action is `סמן כנגבה`, the settled state is `החוב נגבה`. No "loss"/`הפסד` text anywhere (there never was, and none is introduced).
- **M2** — **NO backend / persistence change.** `httpsCallable('setServiceOverdraftResolved')` is still called with the same `resolved: true` / `resolved: false` payload; the count/filter key `service.overdraftResolved?.isResolved` is unchanged. The resolve/unresolve mechanism is binary and behaves identically — only the words change.
- **M3** — **NO admin count / filter / aggregate moves** (ADMIN SAFETY RULE). Because M2 holds (the boolean `isResolved` that suppresses the overdraft count/badge is untouched), a resolved/"collected" service is still excluded from the overdraft count exactly as before. Display-only.
- **M4** — every reframed string is Hebrew, RTL-clean, and reads naturally (G5). Code identifiers (`overdraftResolved`, `mark-resolved-btn`, CSS classes) stay as-is (internal vocabulary; not customer-facing).
- **M5** — a test proves the customer scenario: the rendered overdraft DOM shows the debt framing in BOTH the open and the settled states, AND the backend CF/payload/count-key are asserted unchanged. Full admin-panel suite green.
- **M6** — the stale §8.9 plan premise is corrected (ExceptionModal.js/"הפסד" never existed; real surface named) + the H.7.a/H.7.b split recorded (§11 reconcile-first rule).

## SHOULD
- **S1** — the 2 code comments that referenced the old button text are updated (no stale-comment drift).
- **S2** — `?v=` bumped to `?v=20260625-h7a-debt-reframe` so the reframed copy actually reaches the deployed admin panel (cache-bust mandatory before PROD checks).
- **S3** — the PR body states the premise correction + the H.7.b deferral + the vocabulary-harmonization deferral explicitly, so no future session re-hunts `ExceptionModal.js`.

## Test plan
`tests/unit/admin-panel/overdraft-debt-reframe.test.ts` (5 tests): **behavioral** — `createOverdraftUI(service)` rendered DOM shows `חוב פתוח לגביה` + `סמן כנגבה` (open) and `החוב נגבה` (settled), and the old `חריגה:`/`סמן כהוסדר`/`חריגה הוסדרה` are gone; **contract guards** — the source still calls `setServiceOverdraftResolved` with `resolved:true/false`, still reads `overdraftResolved?.isResolved`, and applies the debt vocabulary end-to-end (modal title + toast + placeholder). Full admin-panel suite **195/195**; ESLint (main config) on the changed JS + test = **0 errors** (warnings = pre-existing no-console in untouched lines + test `any`); `node --check` OK. Browser-preview verification is impractical (the surface renders only inside an authed admin session on `clients.html` with a client that has a negative-hours service + the management modal open) → covered by the behavioral happy-dom render test + a supervised DEV smoke (PR body). **No devils-advocate** — frontend display-only, no rules/claims/migration/schema, <100 lines (§3.8.4 thresholds not met).

## Rollback
`git revert <merge-commit>` + redeploy (frontend; Netlify). No data migration, no schema/rule/CF change. Reverting restores the prior "חריגה/הוסדר" copy + the prior `?v=`.

## PRODUCT-GRADE GATES
- **G1 PASS** — no error-path text changed; the reframed strings are professional Hebrew with a clear action; no stack trace / `undefined` / English leak introduced.
- **G2 PASS** — `git revert` rollback (code-only).
- **G3 N/A** — no data mutation in this PR (the write path is unchanged and pre-existing; display-string reframe only).
- **G4 PASS** — behavioral render test proves the admin sees the debt framing in both states + contract guards prove the persistence/count-key are unchanged; full admin suite green.
- **G5 PASS** — every reframed customer-facing string is Hebrew, RTL-clean ("חוב פתוח לגביה מהלקוח", "סמן כנגבה", "החוב נגבה", …); code identifiers/comments are developer-only.
- **G6 PASS (declared)** — display-only semantic reframe; the resolve/unresolve behavior, the persisted `overdraftResolved` field, and every count/filter/aggregate are byte-unchanged → no contract/data/route change, nothing for existing data to migrate.
- **G7 N/A** — no auth / PII / permissions / rules surface touched (admin-only display copy; the surface was already admin-gated and stays so).

VERDICT: PASS
