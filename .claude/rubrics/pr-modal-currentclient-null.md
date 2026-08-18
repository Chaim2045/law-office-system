# Rubric — PR: capture clientId before ModalManager sub-dialog (fix currentClient-null crash)

**Branch:** `fix/modal-currentclient-null` (off `origin/main` 62900bf) · **App:** Admin Panel · **Env:** DEV (`main`) → PROD (`production-stable`)
**Size:** LIGHT (1 JS file, ~2 functions, +50/−22) + 1 test + `?v=` bump · **High-stakes:** no (no rules/claims/schema/backend/CF) → no devils-advocate required (§3.8.4).

---

## Intent

Follow-up to the Modals.js fix (#470). With `window.ModalManager` now loaded on clients.html, the package purchase-date pencil (`_editPackagePurchaseDate`) and the "חדש שעות" add-hours dialog (`renewServiceHours` → `_submitRenewHours`) actually open — and immediately exposed a SECOND latent bug: both read `this.currentClient.id` at SUBMIT time, but opening the `ModalManager` sub-dialog can trigger the parent `ClientManagementModal`'s unscoped Esc/backdrop `close()` (line 132-141), which sets `this.currentClient = null`. Submit then threw `TypeError: Cannot read properties of null (reading 'id')` (reproduced live in DEV 2026-07-26; `_editPackagePurchaseDate.js:1526`).

**Root cause** (frontend-fix-verifier, read-only, Opus): the parent modal's document-level ESC handler (`:78-83`) and backdrop click-to-close (`:71-75`) are NOT scoped to suppress themselves while a child dialog is on top; pressing Esc (e.g. to dismiss the native `<input type=date>` calendar) or a stray backdrop click runs `close()` → nulls `currentClient`. Confirmed both dialogs share the defect.

**Fix (Option 1 — capture-then-guard, the agent's recommendation over touching close-lifecycle):** capture `const clientId = this.currentClient?.id` at the TOP of each function (while the parent modal is guaranteed open, before opening the sub-dialog), thread it through, use the captured local in the callable payload, and guard the in-memory success-path update (`this.currentClient && this.currentClient.id === clientId`) so a nulled/switched `currentClient` cannot re-throw; the persisted change is still reflected via the existing `ClientsDataManager.loadClients()` refresh.

**Scope = the 2 ModalManager dialogs only** (Haim checkpoint "מינימלי — 2 הדיאלוגים"). The 3 inline-overlay paths (`changeStatus`/`editCaseOpenDate`/`changeServiceStatus`) that share the same parent-close null exposure are PRE-EXISTING (not caused by this or #470) and are explicitly OUT OF SCOPE — a tracked follow-up. The root-cause fix (scope the parent Esc/backdrop while a sub-dialog is open) + the z-index inversion are also deferred.

---

## MUST (all required for PASS)

| # | Criterion | Verification |
|---|---|---|
| M1 | `_editPackagePurchaseDate` captures `const clientId = this.currentClient?.id` before `ModalManager.create`, bails with a Hebrew notification if falsy, and the `updatePackagePurchaseDate` payload uses the captured local (`clientId: clientId`), NOT `this.currentClient.id`. | Guard test group 1 + local node-check (10/10 PASS). |
| M2 | `renewServiceHours` captures `clientId` up front (same bail) and threads it into both `this._submitRenewHours(modalId, service, clientId)` call sites; `_submitRenewHours(modalId, service, clientId)` takes the param and the `addPackageToService` payload uses `clientId: clientId`. | Guard test groups 2-3. |
| M3 | Both success paths guard the in-memory local-cache update with `this.currentClient && this.currentClient.id === clientId` so a nulled/switched `currentClient` cannot re-throw after a successful CF write; the persisted change is still surfaced (edit → `ClientsDataManager.loadClients()` in the closed branch; renew → the pre-existing `loadClients()` at the end runs regardless). | Guard test M1/M3 asserts + read the diff. |
| M4 | Regression sentinel — neither fixed function's callable payload reads `clientId: this.currentClient.id`. | Guard test `.not.toContain('clientId: this.currentClient.id')` scoped to each function body (fails against pre-fix source). |
| M5 | Scope discipline — ONLY `_editPackagePurchaseDate` + `renewServiceHours`/`_submitRenewHours` changed in the JS; the 3 inline-overlay paths are UNTOUCHED (out of scope per checkpoint). No unrelated edits. | `git diff` = ClientManagementModal.js (2 functions) + clients.html (`?v=`) + 1 test file. |
| M6 | `?v=` cache-bust bumped on clients.html for ClientManagementModal.js (behavior changed → mandatory before PROD). | `?v=20260726-currentclient-null-fix`. |
| M7 | Test that would catch a regression exists and matches repo precedent. The class self-instantiates at load with Firebase/DOM deps → a behavioral DOM test is impractical (documented precedent: `escapehtml-ssot-pr2-routing.test.ts`), so a SOURCE-LEVEL guard is used; it fails against the pre-fix `clientId: this.currentClient.id` source. | `modal-currentclient-capture-guard.test.ts` (3 groups, 10 assertions). Node-replica run: 10/10 PASS. |
| M8 | `node --check` clean on the changed JS. | Ran — OK. |

## SHOULD

| # | Criterion |
|---|---|
| S1 | Comments explain WHY the capture is needed (the parent-close-under-sub-dialog race), so a future refactor doesn't "simplify" it back to a live read. |
| S2 | The out-of-scope sibling paths + the root-cause (scope the parent Esc/backdrop) are named in the PR body as a tracked follow-up (not silently dropped). |

---

## PRODUCT-GRADE GATES

- **G1 — PASS.** REMOVES a customer-visible uncaught `TypeError` (empty error state on submit). New failure path is a Hebrew, actionable notification ("לא ניתן לזהות את הלקוח. פתח מחדש...") — no stack trace, no null/undefined surfaced.
- **G2 — PASS.** Rollback = `git revert <sha>` + redeploy (frontend-only, no data). Reverting returns the (crashing) submit — no migration.
- **G3 — N/A.** No new write path / data mutation. The fixed paths call the SAME already-monitored CFs (`updatePackagePurchaseDate`, `addPackageToService`) with the SAME payload shape — only the source of `clientId` changed (captured local vs live read of the same value).
- **G4 — PASS.** Source-level guard test (repo precedent for this un-instantiable class) that fails against the pre-fix source, PLUS a manual DEV smoke plan (below). The customer scenario — pencil/add-hours open → Esc-dismiss the date picker → submit → succeeds, no TypeError — is the smoke.
- **G5 — PASS.** The one new user-facing string is Hebrew ("לא ניתן לזהות את הלקוח. פתח מחדש את כרטיס הלקוח ונסה שוב."). No English added.
- **G6 — PASS, behavioral change declared.** Two admin dialogs that previously threw on submit now succeed. No data / CF / firestore-rule / route / count / filter / return-shape / payload-shape change — the callable payloads are byte-identical (same fields, same values). The in-memory refresh path is unchanged for the happy case; the guarded branch only adds a fallback list-refresh.
- **G7 — N/A.** No auth / PII / permissions / rules. `clientId` is the same non-sensitive case number already sent; the page is behind the admin auth-guard.

## Reviews

- **frontend-fix-verifier (Opus, read-only)** — confirmed root cause (parent modal's unscoped Esc/backdrop `close()` nulls `currentClient`); confirmed `renewServiceHours` shares the defect; enumerated the out-of-scope sibling inline-overlay paths; recommended Option 1 (capture-then-guard) over the close-lifecycle fix as smaller/safer + noted the success-path guard is mandatory (else a second null-deref). All folded.
- **devils-advocate** — NOT required: no merge-to-production-stable in this step, no schema/rules/security-rule change, <100 lines, no migration (§3.8.4).

## Test plan (DEV smoke — G4)

On Admin Panel DEV (`main--admin-gh-law-office-system.netlify.app`), hard-refresh clients.html:
1. Open a client → package purchase-date ✏️ → the "עדכון תאריך רכישה" dialog opens → **press Esc once** (dismisses the native calendar) → pick a date → **שמור** → success toast, no `TypeError`, the card shows the new date.
2. On the service → **"חדש שעות"** → dialog opens → submit hours → success toast, the package appears, no `TypeError`.
3. Console: no `Cannot read properties of null (reading 'id')`.

VERDICT: PASS
