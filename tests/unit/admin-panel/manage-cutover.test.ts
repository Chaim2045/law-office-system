/**
 * U5b — CUTOVER: the LIVE ClientManagementModal renders the management panel as a
 * master-detail layout driven by the unified renderer (ServiceCardModel +
 * UnifiedServiceCard), replacing the old accordion `renderServiceCard` path.
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U5b.
 *
 * This is the G4 proof of the customer scenario ("admin opens a client → sees the
 * services, picks one, acts on it"). It drives the REAL `window.ClientManagementModal`
 * instance against the real #cmManagePanel master-detail markup and asserts:
 *   1. renderServices populates #cmManageRail (כללי + one row/service) and
 *      #managementServicesList (ALL cards present) — the VAL-2 / injector guarantee.
 *   2. Rail selection shows exactly one service card (or the general panel).
 *   3. The injector-anchor contract holds + attachServiceActionListeners binds the
 *      new cards' [data-service-action] / .override-btn / .edit-pkg-date-btn.
 *   4. §14 per-type action parity + the edit-pkg-date data-attrs.
 *   5. Empty state: no services → rail keeps "כללי" + the empty state renders.
 *
 * Harness mirrors manage-detail-equality.test.ts: stub window.escapeHtml (a REAL 5-entity
 * escaper) + window.SYSTEM_CONSTANTS BEFORE importing the IIFEs. Fixtures are PII-free.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// A REAL 5-entity escaper (mirrors the SSOT) — the unified renderer escapes at the sink.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).escapeHtml = (s: unknown): string =>
  (s === null || s === undefined ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).SYSTEM_CONSTANTS = {
  SERVICE_TYPES: { HOURS: 'hours', LEGAL_PROCEDURE: 'legal_procedure', FIXED: 'fixed' },
  PRICING_TYPES: { HOURLY: 'hourly', FIXED: 'fixed' }
};

// @ts-ignore — classic admin-panel scripts, no type declarations
import '../../../apps/admin-panel/js/modules/ServiceCardModel.js';
// @ts-ignore
import '../../../apps/admin-panel/js/ui/UnifiedServiceCard.js';
// @ts-ignore
import '../../../apps/admin-panel/js/ui/ClientManagementModal.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cm = (window as any).ClientManagementModal;

// Faithful minimal #cmManagePanel master-detail fragment (mirrors clients.html post-U5b).
const FIXTURE = `
  <div id="clientManagementModal" class="modal" style="display:none;">
    <div id="managementClientInfo"></div>
    <button id="closeManagementModal"></button>
    <div class="cm-tabs" role="tablist">
      <button class="cm-tab cm-tab--active" data-cm-tab="manage"></button>
      <button class="cm-tab" data-cm-tab="report"></button>
    </div>
    <div id="cmManagePanel" class="cm-panel cm-panel--active" role="tabpanel">
      <div class="cm-split">
        <div id="cmManageRail" class="cm-rail" role="tablist" aria-orientation="vertical"></div>
        <div class="cm-detail">
          <div id="cmGeneralDetail" class="cm-detail-panel cm-detail-panel--active" role="tabpanel">
            <div class="management-section">
              <input type="file" id="feeAgreementInput" style="display:none;">
              <button type="button" id="uploadFeeAgreementBtn" style="display:none;"></button>
              <div id="feeAgreementsList"></div>
            </div>
            <div class="management-section">
              <div class="management-actions-grid">
                <button class="management-action-btn" data-action="add-service"></button>
              </div>
            </div>
          </div>
          <div id="managementServicesList" class="management-services-list" role="tabpanel" hidden></div>
        </div>
      </div>
      <div id="cmReportPanel" class="cm-panel"></div>
    </div>
  </div>`;

// PII-free client with a blocked-hours service (packages + override), a 2-stage legal
// procedure, and a fixed-price service — enough to exercise every injector anchor + action.
function makeClient() {
  return {
    id: 'client_test',
    fullName: 'לקוח בדיקה',
    services: [
      {
        id: 'srv_a', name: 'שירות שעות א', type: 'hours', status: 'active',
        totalHours: 10, hoursUsed: 12, hoursRemaining: -2, startedAt: '2026-02-01',
        overrideActive: false,
        packages: [{ id: 'pkg_a1', purchaseDate: '2026-02-01', hours: 10, hoursUsed: 12, hoursRemaining: -2, description: 'חבילה א' }]
      },
      {
        id: 'srv_b', name: 'הליך משפטי ב', type: 'legal_procedure', status: 'active', pricingType: 'hourly',
        stages: [
          { id: 'stage_1', name: 'שלב א', status: 'active', totalHours: 20, hoursUsed: 5, hoursRemaining: 15 },
          { id: 'stage_2', name: 'שלב ב', status: 'completed', totalHours: 10, hoursUsed: 10, hoursRemaining: 0 }
        ]
      },
      { id: 'srv_c', name: 'מחיר קבוע ג', type: 'fixed', status: 'active', fixedPrice: 8000 }
    ]
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function render(client: any) {
  document.body.innerHTML = FIXTURE;
  cm.modalElement = document.getElementById('clientManagementModal');
  cm.servicesListContainer = document.getElementById('managementServicesList');
  cm._selectedRail = 'general';
  cm.currentClient = client;
  cm.renderServices();
}

const rail = () => document.getElementById('cmManageRail') as HTMLElement;
const list = () => document.getElementById('managementServicesList') as HTMLElement;
const general = () => document.getElementById('cmGeneralDetail') as HTMLElement;

describe('U5b · renderServices → master-detail rail + all-cards-present (VAL-2)', () => {
  beforeEach(() => render(makeClient()));

  it('rail = "כללי" row + one row per service; list = every service card present', () => {
    const rows = Array.from(rail().querySelectorAll('.cm-rail-row')) as HTMLElement[];
    expect(rows).toHaveLength(4); // כללי + 3 services
    expect(rows[0].dataset.rail).toBe('general');
    expect(rows[0].textContent).toContain('כללי');

    const serviceRails = rows.slice(1).map((r) => r.dataset.rail).sort();
    expect(serviceRails).toEqual(['srv_a', 'srv_b', 'srv_c']);

    // ALL cards are in the DOM at once (the overdraft + add-package injectors scan them all).
    const cards = list().querySelectorAll('.management-service-card[data-service-id]');
    expect(cards).toHaveLength(3);
    expect(Array.from(cards).map((c) => c.getAttribute('data-service-id')).sort())
      .toEqual(['srv_a', 'srv_b', 'srv_c']);
  });
});

describe('U5b · rail selection shows exactly one detail panel', () => {
  beforeEach(() => render(makeClient()));

  it('default selection is "כללי" (general shown, services list hidden)', () => {
    expect(general().classList.contains('cm-detail-panel--active')).toBe(true);
    expect(list().hasAttribute('hidden')).toBe(true);
    const active = rail().querySelector('.cm-rail-row[aria-selected="true"]') as HTMLElement;
    expect(active.dataset.rail).toBe('general');
  });

  it('selecting a service row shows that card, hides the others + the general panel', () => {
    cm._selectRail('srv_b');
    expect(general().classList.contains('cm-detail-panel--active')).toBe(false);
    expect(list().hasAttribute('hidden')).toBe(false);

    const shown = list().querySelector('.management-service-card[data-service-id="srv_b"]') as HTMLElement;
    expect(shown.classList.contains('expanded')).toBe(true);
    expect(shown.classList.contains('cm-card-hidden')).toBe(false);

    Array.from(list().querySelectorAll('.management-service-card'))
      .filter((c) => c.getAttribute('data-service-id') !== 'srv_b')
      .forEach((c) => {
        expect(c.classList.contains('cm-card-hidden')).toBe(true);
        expect(c.classList.contains('expanded')).toBe(false);
      });

    const active = rail().querySelector('.cm-rail-row[aria-selected="true"]') as HTMLElement;
    expect(active.dataset.rail).toBe('srv_b');
  });

  it('a rail-row CLICK drives the selection (the wiring works)', () => {
    const rowA = Array.from(rail().querySelectorAll('.cm-rail-row'))
      .find((r) => (r as HTMLElement).dataset.rail === 'srv_a') as HTMLElement;
    rowA.dispatchEvent(new Event('click', { bubbles: true }));
    const shown = list().querySelector('.management-service-card[data-service-id="srv_a"]') as HTMLElement;
    expect(shown.classList.contains('expanded')).toBe(true);
    expect(list().hasAttribute('hidden')).toBe(false);
  });

  it('selecting "כללי" returns to the general panel + hides the services list', () => {
    cm._selectRail('srv_c');
    cm._selectRail('general');
    expect(general().classList.contains('cm-detail-panel--active')).toBe(true);
    expect(list().hasAttribute('hidden')).toBe(true);
  });
});

describe('U5b · injector-anchor contract + attachServiceActionListeners binding', () => {
  beforeEach(() => render(makeClient()));

  it('every service card is .management-service-card[data-service-id]; legal card carries the stage anchors', () => {
    const legal = list().querySelector('.management-service-card[data-service-id="srv_b"]') as HTMLElement;
    expect(legal.querySelectorAll('.management-stage')).toHaveLength(2);
    expect(legal.querySelectorAll('.management-stage-info')).toHaveLength(2);
    const stageNames = Array.from(legal.querySelectorAll('.management-stage-name')).map((e) => e.textContent?.trim());
    expect(stageNames).toEqual(['שלב א', 'שלב ב']); // AddPackageToStage matches on these exactly
  });

  it('the injector selectors are present on the new cards', () => {
    expect(list().querySelectorAll('[data-service-action]').length).toBeGreaterThan(0);
    expect(list().querySelectorAll('.override-btn')).toHaveLength(1);     // srv_a is blocked
    expect(list().querySelectorAll('.edit-pkg-date-btn')).toHaveLength(1); // srv_a has a package
  });

  it('attachServiceActionListeners bound the [data-service-action] / .override-btn / .edit-pkg-date-btn buttons', () => {
    const origAction = cm.handleServiceAction;
    const origOverride = cm.setServiceOverride;
    const origEdit = cm._editPackagePurchaseDate;
    try {
      cm.handleServiceAction = vi.fn();
      cm.setServiceOverride = vi.fn();
      cm._editPackagePurchaseDate = vi.fn();

      (list().querySelector('[data-service-action="renew"]') as HTMLElement)
        .dispatchEvent(new Event('click', { bubbles: true }));
      expect(cm.handleServiceAction).toHaveBeenCalledWith('renew', 'srv_a');

      (list().querySelector('.override-btn') as HTMLElement)
        .dispatchEvent(new Event('click', { bubbles: true }));
      expect(cm.setServiceOverride).toHaveBeenCalledWith('srv_a', true, 'שירות שעות א');

      (list().querySelector('.edit-pkg-date-btn') as HTMLElement)
        .dispatchEvent(new Event('click', { bubbles: true }));
      expect(cm._editPackagePurchaseDate).toHaveBeenCalledWith('srv_a', 'pkg_a1', '2026-02-01');
    } finally {
      cm.handleServiceAction = origAction;
      cm.setServiceOverride = origOverride;
      cm._editPackagePurchaseDate = origEdit;
    }
  });
});

describe('U5b · §14 parity — per-type actions + edit-pkg data-attrs', () => {
  beforeEach(() => render(makeClient()));

  const actionsFor = (id: string) =>
    Array.from(list().querySelectorAll(`.management-service-card[data-service-id="${id}"] [data-service-action]`))
      .map((b) => (b as HTMLElement).dataset.serviceAction)
      .sort();

  it('hours → renew; legal → next-stage; fixed → none extra; all → change-status/complete/delete', () => {
    expect(actionsFor('srv_a')).toEqual(['change-status', 'complete', 'delete', 'renew']);
    expect(actionsFor('srv_b')).toEqual(['change-status', 'complete', 'delete', 'next-stage']);
    expect(actionsFor('srv_c')).toEqual(['change-status', 'complete', 'delete']);
  });

  it('.edit-pkg-date-btn carries data-service-id / data-package-id / data-current-date', () => {
    const btn = list().querySelector('.edit-pkg-date-btn') as HTMLElement;
    expect(btn.dataset.serviceId).toBe('srv_a');
    expect(btn.dataset.packageId).toBe('pkg_a1');
    expect(btn.dataset.currentDate).toBe('2026-02-01');
  });
});

describe('U5b · empty state (zero services → the "כללי" panel IS the default view)', () => {
  it('no services → rail = exactly the "כללי" row; no service cards; general panel active + list hidden', () => {
    render({ id: 'c_empty', fullName: 'ריק', services: [] });
    const rows = rail().querySelectorAll('.cm-rail-row');
    expect(rows).toHaveLength(1);
    expect((rows[0] as HTMLElement).dataset.rail).toBe('general');

    // No service cards (the old, unreachable empty-state innerHTML is gone).
    expect(list().querySelectorAll('.management-service-card')).toHaveLength(0);

    // VISIBILITY (not mere DOM presence): general panel active, services list hidden.
    expect(general().classList.contains('cm-detail-panel--active')).toBe(true);
    expect(list().hasAttribute('hidden')).toBe(true);
  });
});

describe('U5b · rail "needs attention" indicator (FIX 2 — overdraft/blocked surfaced on the rail)', () => {
  beforeEach(() => render(makeClient()));

  it('an overdrawn+unresolved service row shows the attention dot + a non-color-only label', () => {
    const rowA = Array.from(rail().querySelectorAll('.cm-rail-row'))
      .find((r) => (r as HTMLElement).dataset.rail === 'srv_a') as HTMLElement;
    expect(rowA.querySelector('.cm-rail-row-status--attention')).not.toBeNull();
    expect(rowA.getAttribute('title')).toBe('דורש טיפול');       // sighted mouse users
    expect(rowA.textContent).toContain('דורש טיפול');            // screen-reader text (not color-only)
  });

  it('a healthy service row shows an OK (not attention) dot and no attention label', () => {
    // P1: every service row now carries a status dot — healthy = --ok (green), never --attention.
    const rowC = Array.from(rail().querySelectorAll('.cm-rail-row'))
      .find((r) => (r as HTMLElement).dataset.rail === 'srv_c') as HTMLElement;
    expect(rowC.querySelector('.cm-rail-row-status--ok')).not.toBeNull();
    expect(rowC.querySelector('.cm-rail-row-status--attention')).toBeNull();
    expect(rowC.getAttribute('title')).toBeNull();
    expect(rowC.textContent).not.toContain('דורש טיפול');
  });

  it('a RESOLVED overdraft shows the OK dot, not attention', () => {
    const client = makeClient();
    client.services[0].overdraftResolved = { isResolved: true };
    render(client);
    const rowA = Array.from(rail().querySelectorAll('.cm-rail-row'))
      .find((r) => (r as HTMLElement).dataset.rail === 'srv_a') as HTMLElement;
    expect(rowA.querySelector('.cm-rail-row-status--ok')).not.toBeNull();
    expect(rowA.querySelector('.cm-rail-row-status--attention')).toBeNull();
    expect(rowA.getAttribute('title')).toBeNull();
  });
});

describe('P1 · rail polish — hours ratio + clean status dot (no type icon)', () => {
  beforeEach(() => render(makeClient()));

  const railRow = (id: string) =>
    Array.from(rail().querySelectorAll('.cm-rail-row'))
      .find((r) => (r as HTMLElement).dataset.rail === id) as HTMLElement;

  it('an hours service row shows the "used/total" ratio (service-level rollup, overdraft shown truthfully)', () => {
    // srv_a: hoursUsed 12, totalHours 10 → "12.0/10.0".
    const ratio = railRow('srv_a').querySelector('.cm-rail-row-ratio');
    expect(ratio).not.toBeNull();
    expect(ratio?.textContent).toBe('12.0/10.0');
  });

  it('a legal procedure with no service-level total sums its stages', () => {
    // srv_b stages: hoursUsed 5+10=15, totalHours 20+10=30 → "15.0/30.0".
    const ratio = railRow('srv_b').querySelector('.cm-rail-row-ratio');
    expect(ratio).not.toBeNull();
    expect(ratio?.textContent).toBe('15.0/30.0');
  });

  it('a fixed (priceless) service row shows NO ratio', () => {
    expect(railRow('srv_c').querySelector('.cm-rail-row-ratio')).toBeNull();
  });

  it('service rows drop the type icon (mockup parity); the "כללי" row keeps its icon', () => {
    expect(railRow('srv_a').querySelector('.cm-rail-row-icon')).toBeNull();
    expect(railRow('srv_b').querySelector('.cm-rail-row-icon')).toBeNull();
    expect(railRow('general').querySelector('.cm-rail-row-icon')).not.toBeNull();
  });
});

describe('U5b · renderServices resilience (FIX 1 — open() never aborts on a renderer failure)', () => {
  it('unified renderer unavailable → Hebrew fallback + "כללי" still reachable, no throw', () => {
    document.body.innerHTML = FIXTURE;
    cm.modalElement = document.getElementById('clientManagementModal');
    cm.servicesListContainer = document.getElementById('managementServicesList');
    cm._selectedRail = 'general';
    cm.currentClient = makeClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const savedModel = (window as any).ServiceCardModel;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ServiceCardModel = undefined;
    try {
      expect(() => cm.renderServices()).not.toThrow();

      // The "כללי" row survives + is the active view (fee-agreements reachable), no service cards.
      const rows = rail().querySelectorAll('.cm-rail-row');
      expect(rows).toHaveLength(1);
      expect((rows[0] as HTMLElement).dataset.rail).toBe('general');
      expect(general().classList.contains('cm-detail-panel--active')).toBe(true);
      expect(list().querySelectorAll('.management-service-card')).toHaveLength(0);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).ServiceCardModel = savedModel;
    }
  });
});
