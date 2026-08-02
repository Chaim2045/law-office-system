# Rubric — PR-U1: Management modal reads the stored `hoursUsed` SSOT

**Track:** Admin modal-unification (`docs/WORK-PLAN-MODAL-UNIFICATION.md`, PR-U1).
**Scope:** frontend-only — `apps/admin-panel/js/ui/ClientManagementModal.js` (`getServiceInfo`, HOURS branch) + `clients.html` cache-bust + tests. **Zero** `functions/**` / rules / claims / callable change.
**Type:** declared BEHAVIORAL CHANGE to a displayed admin aggregate (the "נוצלו" figure + progress %) — apps/admin-panel/CLAUDE.md BEHAVIORAL CHANGE RULE.

## The change (1 line of production code)

`getServiceInfo` (HOURS branch) previously computed `const hoursUsed = totalHours - hoursRemaining;` — the ONLY surface deriving it. U1 replaces it with the stored SSOT + legacy-safe fallback:

```js
const hoursUsed = Number.isFinite(service.hoursUsed) ? service.hoursUsed : (totalHours - hoursRemaining);
```

## MUST (all required for PASS)

- **M1 — SSOT read.** Management now reads stored `service.hoursUsed`, the same field the report modal (`ClientReportModal.js:483`), the client rollup (`functions/shared/aggregates.js:87-88`), and the unified renderer (`service-card-renderer.js` `calculateHoursUsed`) already treat as canonical. Verified by the flipped U0 source-guard + the behavioral suite.
- **M2 — no regression on healthy or legacy data.** Healthy docs (`hoursUsed == totalHours − hoursRemaining`) display the identical number; legacy-absent docs (`hoursUsed` undefined) fall back to `totalHours − hoursRemaining` (today's behavior). `Number.isFinite` (not `|| 0`) so a real stored `0` is respected, not treated as absent.
- **M3 — behavioral proof (G4).** A DOM-driven test drives the real `getServiceInfo` and asserts the rendered "נוצלו" + progress % for: healthy (unchanged) / drifted (shows stored) / legacy-absent (fallback) / stored-0-with-drift (respects 0). `modal-unification-u1-stored-hoursused.test.ts`.
- **M4 — the change is pinned.** The U0 M3 source-guard (`modal-unification-management-contracts.test.ts`) is flipped to assert the new line AND assert the old diverging derivation is gone — so no later U-PR silently regresses it.
- **M5 — no aggregate/filter/count moves.** The overdraft count/filter key (`overdraftResolved.isResolved`), the client-level `isBlocked`/`isCritical` (CF-applied), the DOM contracts (`.management-service-card[data-service-id]`, `.management-stage-name`), and all 16 callables are byte-unchanged. Only the per-service *displayed* used-hours figure moves. Verified: management-contracts suite intact.
- **M6 — cache-bust.** `?v=` bumped on `ClientManagementModal.js` in `clients.html` (the only page that loads it).
- **M7 — gates.** ESLint 0 errors; the touched line adds no new warning; `node --check` clean; the 3 modal-unification suites green.

## SHOULD

- **S1** — the `Number.isFinite` vs the report's coercing `parseFloat` nuance documented as an auditable decision (only diverges for a string-typed legacy `hoursUsed`, which no writer produces; `Number.isFinite` avoids the report's "0-used" legacy fallback while never regressing).
- **S2** — comment at the change site names the SSOT + the fallback rationale.

## PRODUCT-GRADE GATES (expected)

- **G1** N/A (no error path added). **G2** PASS (`git revert`). **G3** N/A (read/display only — no write path). **G4** PASS (behavioral DOM test). **G5** PASS (Hebrew labels unchanged). **G6** PASS — declared behavioral change (a displayed aggregate moves toward the report SSOT); no data/schema/contract change, no migration needed (the stored field already exists). **G7** N/A (no auth/PII/permissions; frontend display).
