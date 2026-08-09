/**
 * Track-2 PR-2 — buildManageDetail live injector contract (identity-band adoption).
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U5 §5, extended by Track-2 PR-2.
 *
 * PR-2 replaced the management card's old `.management-service-header` with the SHARED
 * identity band (`buildIdentityBand` from PR-1) + a calm status pill, and dropped the
 * unclamped-"5838%" `.management-hours-progress` bar (hours-utilization now lives in the
 * band's clamped 4px meter). That INTENTIONALLY breaks the old header-equality this suite
 * used to assert (`buildManageDetail` vs the dead `ClientManagementModal.renderServiceCard`).
 *
 * RE-ANCHORED here: instead of comparing against the dead old renderer, the suite now pins
 * `buildManageDetail`'s LIVE injector contract directly — the root `.management-service-card`
 * `[data-service-id]`, the 5 `data-service-action` buttons (per type), the legal
 * `.management-stage` / `.management-stage-name` (=== stage.name) / `.management-stage-info`
 * anchors, and the `.override-btn` / `.edit-pkg-date-btn` data-attrs — plus proof that the
 * old header + progress bar are GONE and the shared band + status pill took their place.
 * These are the selectors the overdraft / add-package injectors + the §14 callables depend on.
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

// A REAL 5-entity escaper (mirrors the SSOT) so the SEC-1 breakout test is meaningful and
// the rendered output reflects production escaping (the renderer routes through it).
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

// @ts-ignore
import '../../../apps/admin-panel/js/modules/ServiceCardModel.js';
// @ts-ignore
import '../../../apps/admin-panel/js/ui/UnifiedServiceCard.js';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
// Source of the LIVE management modal — the U5b cutover pins (block 3) read it as text.
const MGMT_SRC = fs.readFileSync(path.resolve(ADMIN, 'js/ui/ClientManagementModal.js'), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const model = (window as any).ServiceCardModel;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const USC = (window as any).UnifiedServiceCard;

// The contract-bearing facts the injectors + §14 actions depend on, read off the new card.
function facts(card: HTMLElement) {
  const el = (sel: string) => card.querySelector(sel) as HTMLElement | null;
  const all = (sel: string) => Array.from(card.querySelectorAll(sel)) as HTMLElement[];
  const overrideBtn = el('.override-btn');
  return {
    serviceId: card.getAttribute('data-service-id'),
    // the management header (Track-2 fork) now carries the (full, un-truncated) name via .msc-name.
    identityName: el('.msc-name')?.textContent?.trim(),
    actions: all('[data-service-action]').map((b) => b.dataset.serviceAction).sort(),
    stageNames: all('.management-stage-name').map((e) => e.textContent?.trim()),
    override: overrideBtn ? { active: overrideBtn.dataset.active, name: overrideBtn.dataset.name } : null,
    editPkg: all('.edit-pkg-date-btn').map((b) => ({ svc: b.dataset.serviceId, pkg: b.dataset.packageId, date: b.dataset.currentDate })),
    // the info block (labels + values) — catches the fixed-status-Hebrew / label-colon class of divergence.
    infoItems: all('.management-service-info-item').map((item) => ({
      label: item.querySelector('.management-service-info-label')?.textContent?.trim(),
      value: item.querySelector('.management-service-info-value')?.textContent?.trim()
    }))
  };
}

// newCard(service) → the `.management-service-card` element from buildManageDetail.
function newCard(service: unknown): HTMLElement {
  // manage-mode: build WITHOUT getStageName so stage.name resolves identically to renderStages.
  const cardModel = model.build({ services: [service] }).cards[0];
  return USC.buildManageDetail(cardModel);
}

// ── fixtures ──────────────────────────────────────────────────────────────
const blockedHours = {
  id: 'srv_h', name: 'ייעוץ שוטף עם שם ארוך במיוחד', type: 'hours', status: 'active',
  totalHours: 50, hoursUsed: 55, hoursRemaining: -5, startedAt: '2026-01-15',
  overrideActive: false,
  packages: [{ id: 'pkg1', purchaseDate: '2026-01-15', hours: 50, hoursUsed: 55, hoursRemaining: -5, description: 'חבילה ראשונה' }]
};
const twoStageLegal = {
  id: 'srv_l', name: 'תביעה', type: 'legal_procedure', status: 'active', pricingType: 'hourly',
  stages: [
    { id: 'stage_a', name: 'כתב תביעה', status: 'active', totalHours: 50, hoursUsed: 20, hoursRemaining: 30 },
    { id: 'stage_b', name: 'הוכחות', status: 'completed', totalHours: 40, hoursUsed: 40, hoursRemaining: 0 }
  ]
};
const fixedSvc = { id: 'srv_f', name: 'ריטיינר', type: 'fixed', status: 'active', fixedPrice: 12000 };

describe('T2-2 · buildManageDetail live injector contract (shared band adopted)', () => {
  it('blocked hours — card root + 4 actions + override + editPkg; header + "5838%" progress removed', () => {
    const card = newCard(blockedHours);
    const n = facts(card);
    expect(n.serviceId).toBe('srv_h');
    // 5-action set, hours variant: renew + the 3 always-on (no next-stage for hours).
    expect(n.actions).toEqual(['change-status', 'complete', 'delete', 'renew']);
    // buildOverride / buildPackagesBreakdown injectors untouched.
    expect(n.override).toEqual({ active: 'true', name: 'ייעוץ שוטף עם שם ארוך במיוחד' }); // "אפשר חריגה"
    expect(n.editPkg).toEqual([{ svc: 'srv_h', pkg: 'pkg1', date: '2026-01-15' }]);
    // the management header carries the full name; the hours body is now packages-only (0 info items —
    // the standalone "תאריך פתיחה" item moved out; each package row carries its own purchase date).
    expect(n.identityName).toBe('ייעוץ שוטף עם שם ארוך במיוחד');
    expect(n.infoItems.length).toBe(0);
    // the old header + the UNCLAMPED "5838%" progress bar are gone; the calm status dot took their place.
    expect(card.querySelector('.management-service-header')).toBeNull();
    expect(card.querySelector('.management-hours-progress')).toBeNull();
    expect(card.querySelector('.service-status-badge')).toBeNull();
    expect(card.querySelectorAll('.management-hours-stat-value').length).toBe(0);
    expect(card.querySelector('.msc-status--active')).not.toBeNull();
  });

  it('legal procedure (2 stages) — .management-stage-name === stage.name + stage-info + next-stage action', () => {
    const card = newCard(twoStageLegal);
    const n = facts(card);
    expect(n.serviceId).toBe('srv_l');
    expect(n.actions).toEqual(['change-status', 'complete', 'delete', 'next-stage']);
    // AddPackageToStage matches on .management-stage-name === stage.name EXACTLY.
    expect(n.stageNames).toEqual(['כתב תביעה', 'הוכחות']);
    expect(card.querySelectorAll('.management-stage').length).toBe(2);
    expect(card.querySelectorAll('.management-stage-info').length).toBe(2);
    // header removed; the management header carries the name + the status dot.
    expect(card.querySelector('.management-service-header')).toBeNull();
    expect(n.identityName).toBe('תביעה');
    expect(card.querySelector('.msc-status--active')).not.toBeNull();
  });

  it('fixed service — no renew/next-stage; change-status/complete/delete; no header/progress', () => {
    const card = newCard(fixedSvc);
    const n = facts(card);
    expect(n.serviceId).toBe('srv_f');
    expect(n.actions).toEqual(['change-status', 'complete', 'delete']);
    // fixed branch info items unchanged (מחיר / סטטוס, no label colons).
    expect(n.infoItems.map((i) => i.label)).toEqual(['מחיר', 'סטטוס']);
    expect(card.querySelector('.management-service-header')).toBeNull();
    expect(card.querySelector('.management-hours-progress')).toBeNull();
  });

  it('out-of-enum status → NO status pill (never a false "פעיל"; devils-advocate Attack 5)', () => {
    // A legacy/blocked service whose status is not one of {active,completed,on_hold,archived}
    // must render NO pill — defaulting to "פעיל" would mislabel an admin-critical card and
    // contradict the rail's "דורש טיפול" dot for the same service.
    const card = newCard({ ...fixedSvc, id: 'srv_x', status: 'blocked' });
    expect(card.querySelector('.msc-status')).toBeNull();
    expect(card.querySelector('.msc-status--active')).toBeNull();
  });
});

describe('T2-2 · injector-anchor selectors + band are present on the new card', () => {
  it('emits .management-services-list anchors: the card + stages + info blocks the injectors scan', () => {
    const n = newCard(twoStageLegal);
    expect(n.classList.contains('management-service-card')).toBe(true);
    expect(n.getAttribute('data-service-id')).toBe('srv_l');
    // AddPackageToStage needs .management-stage + .management-stage-name + .management-stage-info.
    expect(n.querySelectorAll('.management-stage').length).toBe(2);
    expect(n.querySelectorAll('.management-stage-info').length).toBe(2);
    expect(n.querySelector('.management-stage-name')).not.toBeNull();
    // the management header replaced the old header (.msc-* selectors are injector-safe: NOT
    // .management-stage / .report-*, so the add-package / overdraft scanners never match them).
    expect(n.querySelector('.msc-head')).not.toBeNull();
    expect(n.querySelector('.msc-status')).not.toBeNull();
  });
  it('SEC-1: escaping the name prevents an attribute breakout (no injected event handler)', () => {
    const el = USC.buildManageDetail(
      model.build({ services: [{ id: 's', name: 'A" onmouseover="alert(1)', type: 'hours', status: 'active', totalHours: 1, hoursUsed: 0, hoursRemaining: 1 }] }).cards[0]
    );
    // With escaping, the `"` cannot break out → NO injected onmouseover anywhere in the card.
    expect(el.querySelector('[onmouseover]')).toBeNull();
    // and the full raw name is preserved safely as the management header name's text content.
    const name = el.querySelector('.msc-name') as HTMLElement;
    expect(name.textContent).toBe('A" onmouseover="alert(1)');
  });
});

describe('U5b · the live panel now renders via the unified renderer (master-detail cutover)', () => {
  it('renderServices drives ServiceCardModel + UnifiedServiceCard (buildManageDetail/buildRailRow)', () => {
    // The cutover wired the unified renderer into the live management panel.
    expect(MGMT_SRC).toContain('ServiceCardModel');
    expect(MGMT_SRC).toContain('buildManageDetail');
    expect(MGMT_SRC).toContain('buildRailRow');
    // The old accordion render path is no longer wired: renderServices no longer maps its
    // OWN renderServiceCard into the list, and the accordion toggle listeners are gone.
    expect(MGMT_SRC).not.toMatch(/services\.map\([^)]*this\.renderServiceCard/);
    expect(MGMT_SRC).not.toContain('attachServiceToggleListeners');
    // NOTE (U5b deviation, reported): the old renderServiceCard cluster (renderServiceCard,
    // getServiceInfo, renderStages, getServiceActions, …) is retained as dead code — deleting
    // it would break modal-unification-management-contracts.test.ts (source-pins those exact
    // strings) and modal-unification-u1-stored-hoursused.test.ts (drives getServiceInfo at
    // runtime), both outside this PR's editable file set. Removal + retargeting those pins is a
    // follow-up. The live-contract assertions above still prove the injector contract holds.
  });
});
