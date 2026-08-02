/**
 * U0 — CHARACTERIZATION (part 2): the management-modal contracts + the callable
 * parity surface the unification (U1–U7) MUST preserve.
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U0 · §14 parity · §15 VAL-1.
 *
 * These are SOURCE-level contract pins (readFileSync + assert). They fail the
 * moment a U-PR silently drops one, so the unified renderer can't:
 *   - break the two DOM-injection features (ServiceOverdraftResolution reads
 *     `.management-service-card[data-service-id]`; AddPackageToStage matches a stage
 *     by `.management-stage-name` textContent === stage.name),
 *   - move the U1 `hoursUsed = totalHours - hoursRemaining` derivation unnoticed,
 *   - or drop any of the 16 client-mutating callables (§14 parity — incl. Haim's
 *     named "change purchase date" = updatePackagePurchaseDate, #13).
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const read = (rel: string): string => fs.readFileSync(path.resolve(ADMIN, rel), 'utf8');

const MGMT = read('js/ui/ClientManagementModal.js');
const REPORT = read('js/ui/ClientReportModal.js');
const OVERDRAFT = read('js/features/ServiceOverdraftResolution.js');

// ── ClientManagementModal — display + DOM contracts ──────────────────────────
describe('U0 · ClientManagementModal — current display + DOM contracts', () => {
  it('U1 (DONE): getServiceInfo reads the STORED service.hoursUsed as SSOT, legacy-fallback to total − remaining', () => {
    // U1 flipped the management modal OFF the diverging `total − remaining` derivation
    // onto the stored `hoursUsed` the client rollup (functions/shared/aggregates.js),
    // the report modal, and the unified renderer already treat as canonical. Pinned so
    // a later U-PR can't silently regress management back to the diverging derivation.
    // Behavioral proof (drifted / legacy-absent / stored-0) lives in
    // modal-unification-u1-stored-hoursused.test.ts.
    // whitespace-tolerant so a line-wrap of the ternary doesn't defeat the pin.
    expect(MGMT).toMatch(
      /Number\.isFinite\(service\.hoursUsed\)\s*\?\s*service\.hoursUsed\s*:\s*\(totalHours - hoursRemaining\)/
    );
    expect(MGMT, 'the old diverging derivation must be gone').not.toContain('const hoursUsed = totalHours - hoursRemaining;');
  });

  it('DOM contract: each service renders `.management-service-card[data-service-id]` (ServiceOverdraftResolution injects here)', () => {
    expect(MGMT).toMatch(/class="management-service-card"\s+data-service-id="\$\{service\.id\}"/);
  });

  it('DOM contract: `.management-stage-name` textContent is EXACTLY the stage name (AddPackageToStage matches on it)', () => {
    // No hours/icon may be packed into this element — additions must go in siblings.
    expect(MGMT).toMatch(/class="management-stage-name">\$\{this\.escapeHtml\(stage\.name/);
    expect(MGMT).toContain('management-stage-info');
  });

  it('DOM contract: the 5 service quick-actions are present (renew / next-stage / change-status / complete / delete)', () => {
    for (const action of ['renew', 'next-stage', 'change-status', 'complete', 'delete']) {
      expect(MGMT, `data-service-action="${action}"`).toContain(`data-service-action="${action}"`);
    }
  });

  it('isBlocked/isCritical are APPLIED from the CF result, never re-derived on the client', () => {
    expect(MGMT).toContain('NEVER send isBlocked/isCritical');
    expect(MGMT).toMatch(/this\.currentClient\.isBlocked\s*=\s*result\.data(\.clientAggregates)?\.isBlocked/);
  });
});

// ── §14 parity — every client-mutating callable is present today ─────────────
describe('U0 · §14 parity — the 16 callables the unification must preserve', () => {
  const CALLABLES: Array<{ src: string; name: string; where: string }> = [
    { src: MGMT, name: 'updateClient', where: 'ClientManagementModal' },
    { src: MGMT, name: 'setServiceOverride', where: 'ClientManagementModal' },
    { src: MGMT, name: 'addServiceToClient', where: 'ClientManagementModal' },
    { src: MGMT, name: 'changeClientStatus', where: 'ClientManagementModal' },
    { src: MGMT, name: 'closeCase', where: 'ClientManagementModal' },
    { src: MGMT, name: 'updatePackagePurchaseDate', where: 'ClientManagementModal' }, // Haim's #13 "change purchase date"
    { src: MGMT, name: 'addPackageToService', where: 'ClientManagementModal' },
    { src: MGMT, name: 'moveToNextStage', where: 'ClientManagementModal' },
    { src: MGMT, name: 'completeService', where: 'ClientManagementModal' },
    { src: MGMT, name: 'changeServiceStatus', where: 'ClientManagementModal' },
    { src: MGMT, name: 'deleteService', where: 'ClientManagementModal' },
    { src: MGMT, name: 'uploadFeeAgreement', where: 'ClientManagementModal' },
    { src: MGMT, name: 'getFeeAgreementUrl', where: 'ClientManagementModal' },
    { src: MGMT, name: 'deleteFeeAgreement', where: 'ClientManagementModal' },
    { src: REPORT, name: 'updateTimesheetEntry', where: 'ClientReportModal' },
    { src: OVERDRAFT, name: 'setServiceOverdraftResolved', where: 'ServiceOverdraftResolution' }
  ];

  it('exactly 16 callables catalogued', () => {
    expect(CALLABLES).toHaveLength(16);
  });

  it.each(CALLABLES)('$where invokes httpsCallable(\'$name\')', ({ src, name }) => {
    expect(src).toContain(`httpsCallable('${name}')`);
  });

  it('updatePackagePurchaseDate ("שינוי תאריך רכישה") is preserved — Haim\'s named fear', () => {
    expect(MGMT).toContain("httpsCallable('updatePackagePurchaseDate')");
  });
});

// ── write-path payload + external-action contracts ───────────────────────────
describe('U0 · write-path + external-action contracts (must stay byte-stable)', () => {
  it('updateTimesheetEntry (report edit) carries the accumulated editHistory + autoGenerated', () => {
    expect(REPORT).toContain("httpsCallable('updateTimesheetEntry')");
    expect(REPORT).toMatch(/editHistory:\s*editHistory/);
    expect(REPORT).toMatch(/autoGenerated:\s*currentEntry\.autoGenerated/);
  });

  it('generateAndEmail (external, client-facing) is only reached from the explicit email button', () => {
    // Never from init/render — a click handler on the email button, then the engine.
    expect(REPORT).toMatch(/emailBtn\.addEventListener\('click',\s*\(\)\s*=>\s*this\.generateAndEmailReport\(\)\)/);
    expect(REPORT).toContain('window.ReportGenerator.generateAndEmail(formData)');
  });
});
