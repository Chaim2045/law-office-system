/**
 * U5a — DOM-equality: UnifiedServiceCard('manage-detail') reproduces the OLD
 * ClientManagementModal.renderServiceCard DOM contract byte-for-byte.
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U5 §5 (DOM-equality).
 *
 * U5a ships the manage-detail renderer as DEAD CODE (nothing wired it into the live
 * panel yet — the U5b cutover does that). This suite is the proof that the new renderer
 * emits the exact selectors + data-attrs + `.management-stage-name` textContent + the 5
 * data-service-action buttons + the .override-btn + the .edit-pkg-date-btn that the
 * overdraft/add-package injectors and all §14 callables depend on — BEFORE any live change.
 *
 * It drives BOTH the OLD `renderServiceCard(service)` and the NEW
 * `buildManageDetail(ServiceCardModel card)` on identical fixtures and compares the
 * contract-bearing facts. (Raw whitespace/formatting is intentionally NOT compared — the
 * injectors + actions key off selectors/attrs/textContent, which are what this pins.)
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

// A REAL 5-entity escaper (mirrors the SSOT) so the SEC-1 breakout test is meaningful and
// the old-vs-new comparison reflects production escaping (both renderers route through it).
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
import '../../../apps/admin-panel/js/ui/ClientManagementModal.js';
// @ts-ignore
import '../../../apps/admin-panel/js/modules/ServiceCardModel.js';
// @ts-ignore
import '../../../apps/admin-panel/js/ui/UnifiedServiceCard.js';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const MGMT_SRC = fs.readFileSync(path.resolve(ADMIN, 'js/ui/ClientManagementModal.js'), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mgmt = (window as any).ClientManagementModal;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const model = (window as any).ServiceCardModel;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const USC = (window as any).UnifiedServiceCard;

function toEl(html: string): HTMLElement {
  const box = document.createElement('div');
  box.innerHTML = html;
  return box.querySelector('.management-service-card') as HTMLElement;
}

// The contract-bearing facts the injectors + §14 actions depend on.
function facts(card: HTMLElement) {
  const el = (sel: string) => card.querySelector(sel) as HTMLElement | null;
  const all = (sel: string) => Array.from(card.querySelectorAll(sel)) as HTMLElement[];
  const overrideBtn = el('.override-btn');
  return {
    serviceId: card.getAttribute('data-service-id'),
    nameBadge: el('.management-service-badge.service-name')?.textContent?.trim(),
    typeBadge: el('.management-service-badge:not(.service-name)')?.className,
    statusBadge: el('.service-status-badge')?.className,
    actions: all('[data-service-action]').map((b) => b.dataset.serviceAction).sort(),
    stageNames: all('.management-stage-name').map((e) => e.textContent?.trim()),
    hoursStats: all('.management-hours-stat-value').map((e) => e.textContent?.trim()),
    override: overrideBtn ? { active: overrideBtn.dataset.active, name: overrideBtn.dataset.name } : null,
    editPkg: all('.edit-pkg-date-btn').map((b) => ({ svc: b.dataset.serviceId, pkg: b.dataset.packageId, date: b.dataset.currentDate })),
    // the info block (labels + values) + how many `.management-service-info` wrappers — catches
    // the fixed-status-Hebrew / label-colon / extra-wrapper class of divergence.
    infoItems: all('.management-service-info-item').map((item) => ({
      label: item.querySelector('.management-service-info-label')?.textContent?.trim(),
      value: item.querySelector('.management-service-info-value')?.textContent?.trim()
    })),
    infoWrappers: card.querySelectorAll('.management-service-info').length
  };
}

// oldCard(service) / newCard(service) → the `.management-service-card` element from each renderer.
function oldCard(service: unknown): HTMLElement {
  return toEl(mgmt.renderServiceCard(service));
}
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

describe('U5a · manage-detail == the old renderServiceCard (contract-bearing DOM)', () => {
  it('blocked hours service (packages + override + 4 actions) — identical contract', () => {
    const o = facts(oldCard(blockedHours));
    const n = facts(newCard(blockedHours));
    expect(n.serviceId).toBe('srv_h');
    expect(n).toEqual(o); // serviceId, nameBadge (truncated), badges, actions, hoursStats, override, editPkg
    // spot-checks so a bad `toEqual` can't pass silently:
    expect(n.actions).toEqual(['change-status', 'complete', 'delete', 'renew']);
    expect(n.hoursStats).toEqual(['50.0', '55.0', '-5.0']); // נרכשו / נוצלו / נותרו
    expect(n.override).toEqual({ active: 'true', name: 'ייעוץ שוטף עם שם ארוך במיוחד' }); // "אפשר חריגה"
    expect(n.editPkg).toEqual([{ svc: 'srv_h', pkg: 'pkg1', date: '2026-01-15' }]);
  });

  it('legal procedure (2 stages) — .management-stage-name === stage.name + next-stage action', () => {
    const o = facts(oldCard(twoStageLegal));
    const n = facts(newCard(twoStageLegal));
    expect(n).toEqual(o);
    expect(n.stageNames).toEqual(['כתב תביעה', 'הוכחות']); // AddPackageToStage matches on these exactly
    expect(n.actions).toEqual(['change-status', 'complete', 'delete', 'next-stage']);
  });

  it('fixed service — no renew/next-stage; change-status/complete/delete', () => {
    const o = facts(oldCard(fixedSvc));
    const n = facts(newCard(fixedSvc));
    expect(n).toEqual(o);
    expect(n.actions).toEqual(['change-status', 'complete', 'delete']);
    expect(n.typeBadge).toContain('fixed');
  });
});

describe('U5a · injector-anchor selectors are present on the new card', () => {
  it('emits .management-services-list anchors: the card + stages + info blocks the injectors scan', () => {
    const n = newCard(twoStageLegal);
    expect(n.classList.contains('management-service-card')).toBe(true);
    expect(n.getAttribute('data-service-id')).toBe('srv_l');
    // AddPackageToStage needs .management-stage + .management-stage-name + .management-stage-info
    expect(n.querySelectorAll('.management-stage').length).toBe(2);
    expect(n.querySelectorAll('.management-stage-info').length).toBe(2);
    expect(n.querySelector('.management-stage-name')).not.toBeNull();
  });
  it('SEC-1: escaping the name prevents an attribute breakout (no injected event handler)', () => {
    const el = USC.buildManageDetail(
      model.build({ services: [{ id: 's', name: 'A" onmouseover="alert(1)', type: 'hours', status: 'active', totalHours: 1, hoursUsed: 0, hoursRemaining: 1 }] }).cards[0]
    );
    // With escaping, the `"` cannot break out of the title attribute → NO injected onmouseover.
    expect(el.querySelector('[onmouseover]')).toBeNull();
    // and the full raw name is preserved safely inside the attribute.
    const badge = el.querySelector('.management-service-badge.service-name') as HTMLElement;
    expect(badge.getAttribute('title')).toBe('A" onmouseover="alert(1)');
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
    // follow-up. The equality describes above still prove parity because the old renderer remains.
  });
});
