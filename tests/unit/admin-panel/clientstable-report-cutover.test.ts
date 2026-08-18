/**
 * U6 — the "הפק דוח" table button opens the UNIFIED client card on its report tab.
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U6 (entry-point cutover).
 *
 * The LIVE report flow: an admin clicks "הפק דוח" on a client row →
 * ClientsTable.handleReportClick(clientId). U6 repoints it from
 * `ClientReportModal.open(clientId)` to
 * `ClientManagementModal.open(client, dataManager, { initialTab: 'report' })` — the
 * unified client card on its report tab (U4). The report itself is unchanged (the
 * report tab is bit-identical formData + the ReportGenerator engine); only the
 * container/flow moves to the one client card. Part of the modal-unification track;
 * U7 (delete-last) removes the now-unused ClientReportModal after the Fluent orphan
 * page (clients-fluent.html, which does NOT load the unified stack) is resolved.
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/ui/ClientsTable.js';

// window.ClientsTable is the singleton instance (new ClientsTable()).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientsTable: any = (window as any).ClientsTable;

const CT_SRC = fs.readFileSync(
  path.resolve(__dirname, '../../../apps/admin-panel/js/ui/ClientsTable.js'),
  'utf8'
);

const CLIENT = { id: '2025994', fullName: 'לקוח לדוגמה' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mgmtOpen: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let reportOpen: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let notifyErr: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dm: any;

beforeEach(() => {
  mgmtOpen = vi.fn();
  reportOpen = vi.fn();
  notifyErr = vi.fn();
  dm = { getClientById: vi.fn((id: string) => (id === CLIENT.id ? CLIENT : null)) };
  clientsTable.dataManager = dm;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ClientManagementModal = { open: mgmtOpen };
  // The old standalone modal — present, so a test can prove it is NO LONGER called.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ClientReportModal = { open: reportOpen };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).notify = { error: notifyErr, success: vi.fn() };
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ClientManagementModal;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ClientReportModal;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).notify;
});

describe('U6 · "הפק דוח" opens the unified client card on the report tab', () => {
  it('the customer scenario (G4): resolves the client and opens ClientManagementModal on the report tab', () => {
    clientsTable.handleReportClick(CLIENT.id);
    expect(dm.getClientById).toHaveBeenCalledWith(CLIENT.id);
    expect(mgmtOpen).toHaveBeenCalledTimes(1);
    // client OBJECT (not the id string) + the dataManager + the report-tab opt.
    expect(mgmtOpen).toHaveBeenCalledWith(CLIENT, dm, { initialTab: 'report' });
  });

  it('the cutover: the report button NO LONGER routes to the standalone ClientReportModal', () => {
    clientsTable.handleReportClick(CLIENT.id);
    expect(reportOpen).not.toHaveBeenCalled();
  });

  it('missing client → Hebrew error, no modal opened (no crash)', () => {
    clientsTable.handleReportClick('does-not-exist');
    expect(mgmtOpen).not.toHaveBeenCalled();
    expect(notifyErr).toHaveBeenCalledWith('הלקוח לא נמצא', 'שגיאה');
  });

  it('unified modal not loaded → Hebrew error, no throw', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).ClientManagementModal;
    expect(() => clientsTable.handleReportClick(CLIENT.id)).not.toThrow();
    expect(notifyErr).toHaveBeenCalledWith('מערכת ניהול הלקוח לא נטענה', 'שגיאה');
  });
});

describe('U6 · static cutover guard', () => {
  it('ClientsTable no longer CALLS the standalone ClientReportModal', () => {
    expect(CT_SRC).not.toContain('ClientReportModal.open');
    expect(CT_SRC).toContain("initialTab: 'report'");
  });
});
