/**
 * U7 — RETIREMENT GUARD: the report modal's dead D1/D2 recompute path is GONE, and the
 * surviving ClientReportModal is a thin compatibility shim.
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U7 (:361-374) + §6.6.
 *
 * HISTORY — this file used to be the U0 CHARACTERIZATION suite: it PINNED the two live
 * report-modal bugs AS-IS so U4/U5 could prove the unified renderer fixed them, and U7
 * could prove the buggy path is gone:
 *   • D2 (קובי הראל): `populateServiceCards` keyed a client-wide Map by the SERVICE-LOCAL
 *       `stage.id` → two legal_procedure services that each own a `stage_a` collided and a
 *       whole service VANISHED.
 *   • D1 (רעות ואוריאל חליבה): the timesheet-fallback block fabricated a nameless
 *       `{totalHours:0, usedHours:N}` phantom card for any ledger `serviceName` the stage.id
 *       Map missed.
 *
 * U7 deleted that whole renderer (the D1/D2 point-of-no-return). ClientReportModal is now a
 * ~shim that only: init()s no-op-safe, open()s → route-or-notify, and delegates
 * openEditTimesheetModal → ReportPreview. The REAL report path is the unified card's report
 * tab (U4/ReportTab → ServiceCardModel/UnifiedServiceCard), which never carried D1/D2.
 *
 * So the old known-bug behavioral cases are REPLACED here by:
 *   (1) static guards proving the dead recompute mechanisms are GONE from the source, and
 *   (2) behavioral tests of the shim's open() route-or-notify (harness mirrors
 *       tests/unit/admin-panel/clientstable-report-cutover.test.ts — stub the window globals,
 *       drive the real exported instance).
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// @ts-ignore — classic admin-panel script, no type declarations. The shim IIFE reads no
// globals at import time; it just sets window.ClientReportModal = new ClientReportModal().
import '../../../apps/admin-panel/js/ui/ClientReportModal.js';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const SRC = fs.readFileSync(path.resolve(ADMIN, 'js/ui/ClientReportModal.js'), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inst = (window as any).ClientReportModal;

const CLIENT = { id: '2025994', fullName: 'לקוח לדוגמה' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mgmtOpen: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let notifyInfo: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let notifyErr: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let previewOpen: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dm: any;

beforeEach(() => {
  mgmtOpen = vi.fn();
  notifyInfo = vi.fn();
  notifyErr = vi.fn();
  previewOpen = vi.fn();
  dm = { getClientById: vi.fn((id: string) => (id === CLIENT.id ? CLIENT : null)) };
  // The shim resolves the dataManager via window.ClientsTable?.dataManager || window.ClientsDataManager.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ClientsTable = { dataManager: dm };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ClientManagementModal = { open: mgmtOpen };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ReportPreview = { openEditModal: previewOpen };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).notify = { info: notifyInfo, error: notifyErr, success: vi.fn(), show: vi.fn() };
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ClientsTable;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ClientManagementModal;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ReportPreview;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).notify;
  document.body.innerHTML = '';
});

// ── static guards — the dead D1/D2 recompute path is GONE ────────────────────
describe('U7 · static guard — the deleted renderer (D1/D2) is no longer in the source', () => {
  it('the D2 map-keying renderer is gone: no populateServiceCards / createServiceCard', () => {
    expect(SRC).not.toContain('populateServiceCards');
    expect(SRC).not.toContain('createServiceCard');
  });

  it('the D2 stage.id map-key collision mechanism is gone: no servicesMap.set(stage.id …)', () => {
    expect(SRC).not.toContain('servicesMap');
    expect(SRC).not.toMatch(/servicesMap\.set\(\s*stage\.id\s*,/);
  });

  it('the D1 timesheet-fallback phantom block is gone: no ledger read / no total-0 fabrication', () => {
    expect(SRC).not.toContain('getClientTimesheetEntries');
    expect(SRC).not.toContain('if (!servicesMap.has(serviceName))');
  });

  it('the other dead render/compute methods are gone (getFormData / selectServiceCard / getStageName / active-stage filter)', () => {
    expect(SRC).not.toContain('getFormData');
    expect(SRC).not.toContain('selectServiceCard');
    expect(SRC).not.toContain('getStageName');
    expect(SRC).not.toContain('isLegalProcedure');
  });

  it('the shim keeps its 3 core members + the global handle (ReportPreview reads it back)', () => {
    expect(SRC).toMatch(/\binit\s*\(/);
    expect(SRC).toMatch(/\bopen\s*\(\s*clientId\s*\)/);
    expect(SRC).toMatch(/openEditTimesheetModal\s*\(/);
    expect(SRC).toContain('window.ClientReportModal');
    // the real report path — the unified card's report tab — is named in the shim's docblock.
    expect(SRC).toContain("initialTab: 'report'");
  });
});

// ── behavioral — the shim's open() routes to the unified card, else Hebrew-notifies ──
describe('U7 · shim open() — route-or-notify', () => {
  it('with the unified modal present → resolves the client and opens the report tab (G4)', () => {
    inst.open(CLIENT.id);
    expect(dm.getClientById).toHaveBeenCalledWith(CLIENT.id);
    expect(mgmtOpen).toHaveBeenCalledTimes(1);
    // client OBJECT (not the id string) + the dataManager + the report-tab opt.
    expect(mgmtOpen).toHaveBeenCalledWith(CLIENT, dm, { initialTab: 'report' });
    expect(notifyInfo).not.toHaveBeenCalled();
  });

  it('NO unified modal (the frozen Fluent page) → a professional Hebrew notice, no throw', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).ClientManagementModal;
    expect(() => inst.open(CLIENT.id)).not.toThrow();
    expect(mgmtOpen).not.toHaveBeenCalled();
    expect(notifyInfo).toHaveBeenCalledWith('הפקת דוח זמינה במסך ניהול הלקוחות');
  });

  it('route branch, client not found → Hebrew error, no modal opened, no crash', () => {
    expect(() => inst.open('does-not-exist')).not.toThrow();
    expect(mgmtOpen).not.toHaveBeenCalled();
    expect(notifyErr).toHaveBeenCalledWith('הלקוח לא נמצא');
  });
});

// ── behavioral — init is no-op-safe, and the edit delegate is preserved ──────
describe('U7 · shim — no-op-safe init + preserved edit delegate', () => {
  it('init() does not throw with NO #clientReportModal DOM present (returns truthy)', () => {
    // The block was removed from clients.html and never existed on the Fluent page.
    document.body.innerHTML = '';
    let result: unknown;
    expect(() => {
      result = inst.init();
    }).not.toThrow();
    expect(result).toBe(true);
  });

  it('openEditTimesheetModal delegates to ReportPreview.openEditModal (the live edit-timesheet flow)', () => {
    const entry = { id: 'e1', minutes: 30 };
    inst.openEditTimesheetModal(entry);
    expect(previewOpen).toHaveBeenCalledWith(entry);
  });

  it('openEditTimesheetModal is guarded when ReportPreview is missing (no throw)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).ReportPreview;
    expect(() => inst.openEditTimesheetModal({ id: 'e1' })).not.toThrow();
  });
});
