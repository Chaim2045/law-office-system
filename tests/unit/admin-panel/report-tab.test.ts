/**
 * PR-R2 — ReportTab (the "הפקת דוח" tab) master-detail + ClientManagementModal contracts.
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-R2.
 *
 * ReportTab is now a MASTER-DETAIL surface: a rail of services (UnifiedServiceCard.buildRailRow,
 * role="radio") + a detail pane (dates + per-service detail + format footer). It emits a formData
 * object BIT-IDENTICAL to ClientReportModal.getFormData. The suite pins:
 *   - the 9-key formData contract + selection→formData bridge (rail-row click, not a flat card),
 *   - DA-1: the format read is SCOPED to the tab root + uses `mgmtReportFormat`,
 *   - D2 in the tab: two legal procedures both render as rail rows (no stage-id collision),
 *   - DA-2: a legal selection with no active/completed stage never yields a stage-bearing selection,
 *           and a pending stage renders LOCKED (not selectable),
 *   - the unassigned-hours note (dataManager-driven, null-not-0),
 *   - the ClientManagementModal → ReportTab.render(..., this.dataManager) wiring + clients.html pins.
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).escapeHtml = (s: unknown): string => (s === null || s === undefined ? '' : String(s));
// jsdom has no real alert — stub it so _validateSelection() (DA-2) doesn't emit "Not implemented".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).alert = (): void => undefined;

// @ts-ignore
import '../../../apps/admin-panel/js/modules/ServiceCardModel.js';
// @ts-ignore
import '../../../apps/admin-panel/js/ui/UnifiedServiceCard.js';
// @ts-ignore
import '../../../apps/admin-panel/js/ui/ReportTab.js';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const MGMT = fs.readFileSync(path.resolve(ADMIN, 'js/ui/ClientManagementModal.js'), 'utf8');
const TAB = fs.readFileSync(path.resolve(ADMIN, 'js/ui/ReportTab.js'), 'utf8');
const HTML = fs.readFileSync(path.resolve(ADMIN, 'clients.html'), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReportTab = (window as any).ReportTab;

const hoursClient = () => ({
  id: 'c-hours', fullName: 'לקוח שעות',
  services: [{ id: 'srv_h', name: 'ייעוץ', type: 'hours', pricingType: 'hourly', totalHours: 50, hoursUsed: 20, hoursRemaining: 30 }]
});
const twoLegalClient = () => ({
  id: 'c-legal', fullName: 'לקוח דו-הליכי',
  services: [
    { id: 'srv_tviaa', name: 'תביעה', type: 'legal_procedure', pricingType: 'hourly',
      stages: [{ id: 'stage_a', status: 'active', totalHours: 50, hoursUsed: 46.8 }] },
    { id: 'srv_hagana', name: 'כתב הגנה', type: 'legal_procedure', pricingType: 'hourly',
      stages: [{ id: 'stage_a', status: 'active', totalHours: 45, hoursUsed: 22.1 }] }
  ]
});
// A legal service with BOTH an active stage (preselected) and a pending stage (LOCKED).
const legalWithPendingClient = () => ({
  id: 'c-lp', fullName: 'לקוח שלבים',
  services: [
    { id: 'srv_proc', name: 'הליך', type: 'legal_procedure', pricingType: 'hourly',
      stages: [
        { id: 'stage_a', status: 'active', totalHours: 40, hoursUsed: 10 },
        { id: 'stage_b', status: 'pending', totalHours: 30, hoursUsed: 0 }
      ] }
  ]
});
// A legal service with NO active/completed stage (only pending) — DA-2.
const legalNoActiveClient = () => ({
  id: 'c-na', fullName: 'לקוח ללא שלב',
  services: [
    { id: 'srv_na', name: 'הליך ריק', type: 'legal_procedure', pricingType: 'hourly',
      stages: [{ id: 'stage_a', status: 'pending', totalHours: 20, hoursUsed: 0 }] }
  ]
});
const unassignedClient = () => ({
  id: 'c-u', fullName: 'לקוח שעתון',
  services: [{ id: 'srv_x', name: 'שירות איקס', type: 'hours', totalHours: 10, hoursUsed: 2 }]
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubDataManager = (entries: any[]) => ({ getClientTimesheetEntries: () => entries });

let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="cmReportPanel"></div>';
  root = document.getElementById('cmReportPanel') as HTMLElement;
});

describe('R2 · ReportTab.render — master-detail shell + rail', () => {
  it('renders the scoped shell (mgmtReport* ids + mgmtReportFormat radios) + populates the rail', () => {
    ReportTab.render(hoursClient(), root);
    expect(root.querySelector('#mgmtReportStartDate')).not.toBeNull();
    expect(root.querySelector('#mgmtReportEndDate')).not.toBeNull();
    expect(root.querySelectorAll('input[name="mgmtReportFormat"]').length).toBe(2);
    expect(root.querySelector('#mgmtGenerateReportBtn')).not.toBeNull();
    // the rail holds one service row (not a flat service card)
    expect(root.querySelectorAll('#mgmtReportRail .cm-rail-row').length).toBe(1);
    // quick-date default 'all' populated a start date
    expect((root.querySelector('#mgmtReportStartDate') as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('D2 in the tab: two legal procedures BOTH render as rail rows (keyed by serviceId, no collision)', () => {
    ReportTab.render(twoLegalClient(), root);
    const rails = Array.from(root.querySelectorAll('#mgmtReportRail .cm-rail-row')) as HTMLElement[];
    const ids = rails.map((r) => r.dataset.rail);
    expect(ids).toContain('srv_tviaa');
    expect(ids).toContain('srv_hagana'); // the D2 bug drops this in the old modal
  });
});

describe('R2 · ReportTab.getFormData — bit-identical 9-key contract', () => {
  it('returns exactly the 9 keys with the right shape; selecting a rail row fills service/serviceId/stage', () => {
    ReportTab.render(hoursClient(), root);
    const railRow = root.querySelector('#mgmtReportRail .cm-rail-row[data-rail="srv_h"]') as HTMLElement;
    railRow.click();
    const fd = ReportTab.getFormData();
    expect(Object.keys(fd).sort()).toEqual(
      ['clientId', 'clientName', 'endDate', 'reportFormat', 'reportType', 'service', 'serviceId', 'stage', 'startDate'].sort()
    );
    expect(fd).toMatchObject({
      clientId: 'c-hours', clientName: 'לקוח שעות', service: 'ייעוץ', serviceId: 'srv_h', stage: '',
      reportType: 'hours', reportFormat: 'pdf'
    });
    expect(fd.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('a legal rail row renders a stage picker with the active stage PRESELECTED → getFormData carries the stage', () => {
    ReportTab.render(twoLegalClient(), root);
    const railRow = root.querySelector('#mgmtReportRail .cm-rail-row[data-rail="srv_hagana"]') as HTMLElement;
    railRow.click();
    // the detail renders a stage picker
    expect(root.querySelectorAll('#mgmtReportServiceDetail .report-stage').length).toBeGreaterThan(0);
    const fd = ReportTab.getFormData();
    expect(fd.serviceId).toBe('srv_hagana');
    expect(fd.stage).toBe('stage_a'); // DA-2: a legal selection always has a stage
  });
});

describe('R2 · DA-2 — legal stage locking + stageless refusal', () => {
  it('a pending stage renders LOCKED (not selectable) while the active stage is preselected', () => {
    ReportTab.render(legalWithPendingClient(), root);
    (root.querySelector('#mgmtReportRail .cm-rail-row[data-rail="srv_proc"]') as HTMLElement).click();
    const stages = root.querySelectorAll('#mgmtReportServiceDetail .report-stage');
    expect(stages.length).toBe(2);
    // active preselected
    const active = root.querySelector('.report-stage[data-stage-id="stage_a"]') as HTMLElement;
    expect(active).not.toBeNull();
    expect(active.classList.contains('report-stage--on')).toBe(true);
    // pending LOCKED: no data-stage-id (never wired), aria-disabled
    const locked = Array.from(root.querySelectorAll('.report-stage--locked')) as HTMLElement[];
    expect(locked.length).toBe(1);
    expect(locked[0].hasAttribute('data-stage-id')).toBe(false);
    expect(locked[0].getAttribute('aria-disabled')).toBe('true');
    // the preselected active stage drives the selection
    expect(ReportTab.getFormData().stage).toBe('stage_a');
  });

  it('a legal service with NO active/completed stage yields a stageless selection that fails validation', () => {
    ReportTab.render(legalNoActiveClient(), root);
    (root.querySelector('#mgmtReportRail .cm-rail-row[data-rail="srv_na"]') as HTMLElement).click();
    // no stage picker (DA-2)
    expect(root.querySelectorAll('#mgmtReportServiceDetail .report-stage').length).toBe(0);
    // the selection carries stage:'' and the belt-check refuses to generate it
    expect(ReportTab.getFormData().stage).toBe('');
    expect(ReportTab._validateSelection()).toBe(false);
  });
});

describe('R2 · unassigned-hours note (dataManager-driven, null-not-0)', () => {
  it('shows the note with the right hours when some entries match no service', () => {
    // 60min matches srv_x (assigned); 90min is orphan (unassigned) → 1.5h
    const dm = stubDataManager([
      { serviceId: 'srv_x', minutes: 60 },
      { serviceId: 'orphan', minutes: 90 }
    ]);
    ReportTab.render(unassignedClient(), root, dm);
    const note = root.querySelector('#mgmtReportUnassignedNote') as HTMLElement;
    expect(note.hidden).toBe(false);
    expect(note.innerHTML).toContain('1.5');
  });

  it('hides the note when every entry matches a service', () => {
    const dm = stubDataManager([{ serviceId: 'srv_x', minutes: 60 }]);
    ReportTab.render(unassignedClient(), root, dm);
    expect((root.querySelector('#mgmtReportUnassignedNote') as HTMLElement).hidden).toBe(true);
  });

  it('hides the note when no dataManager is supplied (2-arg render → uncomputable, never a fake 0)', () => {
    ReportTab.render(unassignedClient(), root);
    expect((root.querySelector('#mgmtReportUnassignedNote') as HTMLElement).hidden).toBe(true);
  });

  it('passes a LOCAL-midnight start + LOCAL-end-of-day end to the ledger — the note window byte-matches the report (Attack-1)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let captured: any = null;
    const dm = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getClientTimesheetEntries: (name: any, start: any, end: any) => {
        captured = { name, start, end };
        return [];
      }
    };
    ReportTab.render(unassignedClient(), root, dm);
    const startInput = root.querySelector('#mgmtReportStartDate') as HTMLInputElement;
    const endInput = root.querySelector('#mgmtReportEndDate') as HTMLInputElement;
    startInput.value = '2026-08-03';
    endInput.value = '2026-08-03';
    endInput.dispatchEvent(new Event('change')); // _wireDateInputs → recompute the note
    expect(captured).not.toBeNull();
    const s = captured.start as Date;
    const e = captured.end as Date;
    // LOCAL midnight for the start (never UTC — a bare new Date("2026-08-03") is UTC midnight).
    expect([s.getFullYear(), s.getMonth(), s.getDate()]).toEqual([2026, 7, 3]);
    expect([s.getHours(), s.getMinutes(), s.getSeconds()]).toEqual([0, 0, 0]);
    // LOCAL end-of-day for the end — 23:59:59.999 (tz-robust: a bare new Date is NEVER end-of-day).
    expect([e.getFullYear(), e.getMonth(), e.getDate()]).toEqual([2026, 7, 3]);
    expect([e.getHours(), e.getMinutes(), e.getSeconds(), e.getMilliseconds()]).toEqual([23, 59, 59, 999]);
  });

  it('source: the note parses dates LOCALLY (parseLocalDate), never a bare new Date(input.value)', () => {
    expect(TAB).toContain('23, 59, 59, 999');
    expect(TAB).not.toContain('new Date(startInput.value)');
    expect(TAB).not.toContain('new Date(endInput.value)');
  });
});

describe('R2 · DA-1 — the format read is scoped + namespaced (no bleed from the old modal)', () => {
  it('a rogue GLOBAL input[name="reportFormat"]=excel does not change the tab result', () => {
    // The old modal's radio name — must be ignored (the tab uses mgmtReportFormat).
    document.body.insertAdjacentHTML('beforeend', '<input type="radio" name="reportFormat" value="excel" checked>');
    ReportTab.render(hoursClient(), root);
    expect(ReportTab.getFormData().reportFormat).toBe('pdf');
  });

  it('the format read is SCOPED to the tab root (a rogue mgmtReportFormat OUTSIDE root is ignored)', () => {
    ReportTab.render(hoursClient(), root);
    // an excel radio with the SAME name but OUTSIDE the tab root
    document.body.insertAdjacentHTML('beforeend', '<input type="radio" name="mgmtReportFormat" value="excel" checked>');
    expect(ReportTab.getFormData().reportFormat).toBe('pdf'); // root-scoped read wins
  });

  it('source: getFormData reads mgmtReportFormat via the root, never document / reportFormat', () => {
    expect(TAB).toContain("root.querySelector('input[name=\"mgmtReportFormat\"]:checked')");
    expect(TAB).not.toMatch(/document\.querySelector\(\s*['"]input\[name="reportFormat"\]/);
  });
});

describe('R2 · ClientManagementModal + clients.html — tab-switching contracts (source)', () => {
  it('open() keeps renderServices() + renderFeeAgreements() unconditional (injector DOM always present)', () => {
    expect(MGMT).toMatch(/open\(client,\s*dataManager,\s*opts\s*=\s*\{\}\)/);
    // both renders are called before any tab branch, unconditionally
    expect(MGMT).toContain('this.renderServices();');
    expect(MGMT).toContain('this.renderFeeAgreements();');
  });
  it('_switchTab renders ReportTab into the report panel WITH the data manager + toggles via CSS', () => {
    expect(MGMT).toContain('window.ReportTab.render(this.currentClient, reportPanel, this.dataManager)');
    expect(MGMT).toContain("classList.toggle('cm-panel--active'");
  });
  it('clients.html has the tab-bar + both panels, and introduces NO second name="reportFormat"', () => {
    expect(HTML).toContain('class="cm-tabs"');
    expect(HTML).toContain('id="cmManagePanel"');
    expect(HTML).toContain('id="cmReportPanel"');
    // U7 removed the old #clientReportModal block (its 2 name="reportFormat" radios) → 0 remain;
    // the report tab's radios use name="mgmtReportFormat" and are built in JS (not in static HTML).
    expect((HTML.match(/name="reportFormat"/g) || []).length).toBe(0);
    expect(HTML).not.toContain('name="mgmtReportFormat"'); // the tab radios are built in JS, not HTML
  });
});
