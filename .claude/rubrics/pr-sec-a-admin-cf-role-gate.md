# Rubric — PR-SEC-A · Admin-CF role gate (broken function-level authorization)

**Scope:** `functions/` — backend, security. A red-team (2026-08-10) found a family of MANAGEMENT
Cloud Functions that authenticate (`checkUserPermissions`) but never enforce `role === 'admin'` — so an
authenticated **non-admin employee** could call them DIRECTLY (bypassing the admin-only UI) and rewrite
any client's lifecycle/billing, and bypass the #535 hours-gate via a direct `changeServiceStatus` reopen.
`firestore.rules` already restricts direct client writes to admin; the CF layer did not mirror that.

**Verification (Haim-mandated — done BEFORE any code):** cross-checked against the LIVE code because
`SYSTEM_MAP.md` (Jul 30) is STALE (it references retired files — `user-app/js/legal-procedures.js`, the
retired admin `case-creation-dialog.js`). Live-code result: these 9 CFs have **no** live caller outside
the admin-panel and **no** internal/trigger caller → admin-only is correct. `'manager'` (the failing tests'
mock) is **not** a real role — a placeholder from before any gate existed.

**Files:** `functions/services/index.js` (7 CFs), `functions/clients/index.js` (2 CFs), 8 re-anchored test
files, 1 new guard test. **No** firestore.rules / schema / claim / auth-helper change.

## MUST (any FAIL → grader FAIL)

- **M1 — 9 CFs admin-gated.** Each of `addPackageToService`, `addHoursPackageToStage`, `moveToNextStage`,
  `completeService`, `changeServiceStatus`, `deleteService`, `updatePackagePurchaseDate` (services) +
  `changeClientStatus`, `closeCase` (clients) throws `permission-denied` with a Hebrew message when
  `user.role !== 'admin'`, placed IMMEDIATELY after `checkUserPermissions` and BEFORE any validation/mutation.
  Mirrors the pre-existing gate at `clients/index.js` setServiceOverride (`:1240`).
- **M2 — addServiceToClient DELIBERATELY NOT gated.** It is also called from the USER APP (case creation);
  admin-gating it would break a live employee flow. Its concern is IDOR/ownership (separate), not admin-only.
  A guard test LOCKS this exclusion (fails if someone admin-gates it).
- **M3 — no over-reach.** Only management CFs proven admin-panel-only are gated. The employee-callable CFs
  (`addServiceToClient`, `addTimeToTask`, `createQuickLogEntry`, `createTimesheetEntry_v2`, `updateTimesheetEntry`,
  `createClient`) are UNTOUCHED. No firestore.rules / schema / claim change.
- **M4 — tests.** (a) a static guard asserting each of the 9 CFs has the gate after auth + that `addServiceToClient`
  does not; (b) a behavioral test: a non-admin caller → `permission-denied` (on `changeServiceStatus`, the
  #535-bypass CF); (c) the pre-existing behavior tests re-anchored from the `'manager'`/`'employee'` placeholder
  to the real caller `role:'admin'` (legitimate re-anchoring — NOT bypassing an assertion). Full `functions/` suite green; ESLint 0.
- **M5 — verified whole-system.** The PR body/rubric documents the live-caller + internal-caller verification
  (per-CF), and the SYSTEM_MAP-staleness reconciliation.

## Gate notes

- **G1:** PASS — Hebrew `permission-denied` messages, action-specific, no PII/stack.
- **G2:** PASS — code-only → `git revert <merge-commit>` + supervised redeploy. No data migration.
- **G3:** N/A — a refusal before any mutation; adds no write.
- **G4:** PASS — static guard (all 9 + the exclusion) + behavioral non-admin-rejection.
- **G5:** PASS — Hebrew.
- **G6 — BREAKING (DECLARED):** a non-admin who could previously call these 9 CFs directly now gets
  `permission-denied`. There is **no legitimate non-admin caller** (verified: admin-panel-only; the UI is
  admin-gated) → no real flow breaks; the "breakage" IS closing the vulnerability. `addServiceToClient` (the one
  employee-callable case) is explicitly preserved. No data migration.
- **G7 — SECURITY (this IS the security fix):** authz hardening. No auth-helper / claims / firestore.rules / PII
  change — it adds role checks that mirror the established pattern.

## devils-advocate = GO-WITH-CHANGES (folded) + the authz boundary this PR does / does NOT close

Independently re-verified: the 9-gate change breaks NO legitimate flow (0 user-app callers, 0 internal callers,
admin-panel is hard admin-only, `'manager'` is not a real role). Folded:
- **🔴 #1 — `addServiceToClient` residual IDOR is NOT closed by this PR (honesty, do NOT overclaim).** That CF
  is employee-callable (user-app case creation) so it is deliberately un-gated here — but it also has **no
  ownership check**, so an employee can add a service (arbitrary `fixedPrice` / hours package) to ANY `clientId`.
  The "employee mutates arbitrary billing" threat is therefore only PARTIALLY closed by PR-SEC-A. Closing it is
  **PR-SEC-A2** (Haim-approved, immediately after): add the owner-or-admin gate mirroring `updateClient`
  (`clients/index.js:1082`), after verifying the user-app case-creation flow targets a caller-owned client.
- **#5 — behavioral coverage widened:** non-admin→`permission-denied` runtime tests now cover
  `changeServiceStatus`, `deleteService`, `changeClientStatus` (3/9) + the static guard over all 9.
- **Authz boundary declared (#2/#3/#4):** these 9 are **admin-ONLY by design** — `'partner'` is excluded (H.3
  reads profitability via `isAdmin()||isPartner()`, but partners do NOT mutate lifecycle; no employee holds
  `role:'partner'` today, and it isn't UI-assignable). `updateClient`/`deleteClient` remain **owner-or-admin**
  (unchanged). The gate uses `role==='admin'` consistent with the admin-panel login gate (`auth.js:424`) and the
  local pattern (`setServiceOverride`); the legacy `employee.isAdmin` boolean used by `admin/index.js`/`budget-tasks`
  is a pre-existing "which field means admin" SSOT question, flagged as a separate concern (no live lockout —
  admins are `role:'admin'`).

**devils-advocate MANDATORY (§3.8.4):** DONE = GO-WITH-CHANGES, all folded.
