/**
 * U4 — ReportTab (the "הפקת דוח" tab) + ClientManagementModal tab-switching contracts.
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U4.
 *
 * ReportTab renders the report form + selectable cards (ServiceCardModel → UnifiedServiceCard)
 * and emits a formData object BIT-IDENTICAL to ClientReportModal.getFormData. The suite pins:
 *   - the 9-key formData contract + selection→formData bridge,
 *   - DA-1: the format read is SCOPED to the tab root + uses `mgmtReportFormat` (no bleed from
 *     the old modal's global `reportFormat`),
 *   - D2 in the tab: two legal procedures both render as selectable,
 *   - VAL-2 (source): open() always renders the management panel (injector DOM), tab is CSS-toggle.
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).escapeHtml = (s: unknown): string => (s === null || s === undefined ? '' : String(s));

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

let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="cmReportPanel"></div>';
  root = document.getElementById('cmReportPanel') as HTMLElement;
});

describe('U4 · ReportTab.render — form + cards', () => {
  it('renders the scoped form (mgmtReport* ids + mgmtReportFormat radios) + populates cards', () => {
    ReportTab.render(hoursClient(), root);
    expect(root.querySelector('#mgmtReportStartDate')).not.toBeNull();
    expect(root.querySelector('#mgmtReportEndDate')).not.toBeNull();
    expect(root.querySelectorAll('input[name="mgmtReportFormat"]').length).toBe(2);
    expect(root.querySelector('#mgmtGenerateReportBtn')).not.toBeNull();
    expect(root.querySelectorAll('#mgmtReportServiceCards .report-service-card').length).toBe(1);
    // quick-date default 'all' populated a start date
    expect((root.querySelector('#mgmtReportStartDate') as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('D2 in the tab: two legal procedures BOTH render as selectable cards', () => {
    ReportTab.render(twoLegalClient(), root);
    const cards = Array.from(root.querySelectorAll('#mgmtReportServiceCards .report-service-card')) as HTMLElement[];
    const ids = cards.map((c) => c.dataset.serviceId);
    expect(ids).toContain('srv_tviaa');
    expect(ids).toContain('srv_hagana'); // the D2 bug drops this in the old modal
  });
});

describe('U4 · ReportTab.getFormData — bit-identical 9-key contract', () => {
  it('returns exactly the 9 keys with the right shape; selection fills service/serviceId/stage', () => {
    ReportTab.render(hoursClient(), root);
    const card = root.querySelector('#mgmtReportServiceCards .report-service-card[role="button"]') as HTMLElement;
    card.click();
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

  it('a legal stage selection carries stage (never empty)', () => {
    ReportTab.render(twoLegalClient(), root);
    const card = root.querySelector('#mgmtReportServiceCards .report-service-card[data-service-id="srv_hagana"]') as HTMLElement;
    card.click();
    const fd = ReportTab.getFormData();
    expect(fd.serviceId).toBe('srv_hagana');
    expect(fd.stage).toBe('stage_a'); // DA-2: a legal selection always has a stage
  });
});

describe('U4 · DA-1 — the format read is scoped + namespaced (no bleed from the old modal)', () => {
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

describe('U4 · ClientManagementModal + clients.html — VAL-2 / tab-switching contracts (source)', () => {
  it('open() keeps renderServices() + renderFeeAgreements() unconditional (injector DOM always present)', () => {
    expect(MGMT).toMatch(/open\(client,\s*dataManager,\s*opts\s*=\s*\{\}\)/);
    // both renders are called before any tab branch, unconditionally
    expect(MGMT).toContain('this.renderServices();');
    expect(MGMT).toContain('this.renderFeeAgreements();');
  });
  it('_switchTab renders ReportTab into the report panel + toggles via CSS (both panels stay in DOM)', () => {
    expect(MGMT).toContain('window.ReportTab.render(this.currentClient, reportPanel)');
    expect(MGMT).toContain("classList.toggle('cm-panel--active'");
  });
  it('clients.html has the tab-bar + both panels, and introduces NO second name="reportFormat"', () => {
    expect(HTML).toContain('class="cm-tabs"');
    expect(HTML).toContain('id="cmManagePanel"');
    expect(HTML).toContain('id="cmReportPanel"');
    // exactly the two OLD report radios keep name="reportFormat"; the tab uses mgmtReportFormat
    expect((HTML.match(/name="reportFormat"/g) || []).length).toBe(2);
    expect(HTML).not.toContain('name="mgmtReportFormat"'); // the tab radios are built in JS, not HTML
  });
});
