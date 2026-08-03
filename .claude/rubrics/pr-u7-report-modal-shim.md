# Rubric — PR-U7: delete-last — gut ClientReportModal to a shim

**Track:** Admin modal-unification (`docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md`, PR-U7 :361-374 + §6.6). The final PR: the standalone report modal is dead (U6 repointed its entry) → U7 guts it to a compatibility shim + removes its dead DOM. HIGH-STAKES / admin-critical / >100-line deletion → **devils-advocate MANDATORY** (plan :361, §3.8.4).
**Scope:** frontend-only. `ClientReportModal.js` → ~thin shim (the file is NEVER byte-deleted — the FROZEN `clients-fluent.html` still loads it); `clients.html` removes the `#clientReportModal` DOM block + `?v=` bump; `clients-fluent.html` `?v=` bump only; the U0 known-bug test rewritten + 3 stale contract tests re-anchored. `ReportGenerator`/`ReportPreview`/`ClientManagementModal`/rules/functions UNTOUCHED.
**Type:** delete-last. Per the plan (:373) NO live path passes through the deleted code; single-revert rollback (:374).

## MUST (all required for PASS)

- **M1 — the shim.** `ClientReportModal.js` is a thin shim keeping `window.ClientReportModal` alive with: `init()` (no-op-safe — never throws when `#clientReportModal` is absent), `open(clientId)` (routes to `ClientManagementModal.open(client, dm, {initialTab:'report'})` when present, else a professional Hebrew `notify` on the Fluent page — NO throw), `openEditTimesheetModal(entryData)` → `ReportPreview.openEditModal(entryData)`. The dead D1/D2 renderer + recompute (`populateServiceCards`/`createServiceCard`/`getFormData`/`selectServiceCard`/`getStageName`/the timesheet-fallback phantom/the `servicesMap.set(stage.id,…)` keying) are DELETED.
- **M2 — the LIVE report path survives (THE crux).** Every member `ReportPreview.host()` (= `window.ClientReportModal`) reads at runtime — `showLoading`, `hideLoading`, `close`, `dataManager` (+ `dataManager.getEmployeeName`), and any other — is RETAINED in the shim, so the unified report tab (ReportTab → ReportPreview.showForFormData / the preview-row edit / proceedToGenerateReport) never throws a TypeError. Proven by auditing every `host().X`/`h.X` call against the shim's members.
- **M3 — the removed DOM leaves no dangling reference.** The `#clientReportModal` block is removed from `clients.html`; NO live JS still `getElementById`/`querySelector`s `#clientReportModal` or its removed child ids (a null-deref check). The shim's `init()` touches no removed DOM.
- **M4 — Fluent page (frozen) safe.** On `clients-fluent.html` the shim's `open()` shows a professional Hebrew `notify` ("הפקת דוח זמינה במסך ניהול הלקוחות") — G1-clean, "not worse than today" (the old Fluent report DOM was already a stub, plan :372); the `notify` call is guarded so it cannot itself throw if the API differs. `?v=` bumped; the frozen page is otherwise untouched.
- **M5 — `ReportGenerator` untouched + its edit flow works.** `ReportGenerator.editTimesheetEntry` (~1431) still calls `ClientReportModal.openEditTimesheetModal(payload)`; the shim forwards the SAME payload to `ReportPreview.openEditModal` → the edit-timesheet modal works on both `clients.html` (unified tab) and `clients-fluent.html`. No `ReportGenerator` diff.
- **M6 — tests updated, coverage preserved (plan :369).** The U0 "known-bug" (D1/D2) behavioral cases are replaced with STATIC guards proving the dead path is gone (source no longer contains `populateServiceCards`/`createServiceCard`/`servicesMap`) + BEHAVIORAL tests of the shim's route/notify. The 3 stale old-modal contract pins (report-preview-contract delegates + generateAndEmail; management-contracts email action; report-tab radio count) are RE-ANCHORED onto the surviving surface (ReportTab `_email`/`ReportGenerator.generateAndEmail`; the removed radios → 0) — re-pointed, NOT silently weakened. The live-path coverage (ReportPreview/ReportTab suites) stays green unchanged.
- **M7 — gates.** Full admin-panel vitest suite green; ESLint 0 errors (pre-existing warnings OK — e.g. the shim's defensive `no-alert` fallback, same pattern ReportPreview uses); `node --check` clean; `?v=` bumped on both pages.

## SHOULD

- **S1** — the shim is minimal + a clear docblock explaining it is the U7 Fluent-compatibility shim, the D1/D2 guts removed, and the real report path is the unified card's report tab.
- **S2** — the removed `#clientReportModal` block leaves a short "REMOVED in PR-U7" marker comment for traceability.

## PRODUCT-GRADE GATES (expected)

- **G1** PASS — the Fluent `open()` notify is professional Hebrew with a next-action ("…זמינה במסך ניהול הלקוחות"); no throw/undefined/stack trace; client-not-found → Hebrew error.
- **G2** PASS — Rollback = a single `git revert` restores the full file + the HTML block (plan :374).
- **G3** N/A — the shim writes nothing (`open`/notify/delegate are pure routing); `ReportGenerator`'s write path is untouched.
- **G4** PASS — the U0 rewrite proves the retirement (static "gone" guards + the shim's route/notify behavior); the live report path stays covered by the unchanged ReportPreview/ReportTab suites.
- **G5** PASS — all customer-facing text Hebrew.
- **G6** PASS-with-declaration — BEHAVIORAL: the Fluent report button now shows a redirect-notify instead of the already-broken/stub old modal (declared in the PR body; "not worse than today"). NO data/contract change — ReportGenerator, ReportPreview, the callables, and every count/filter key are untouched; the report OUTPUT on the live path is unchanged (the unified tab). No migration needed.
- **G7** N/A — no auth/PII/permissions; the shim renders nothing.
