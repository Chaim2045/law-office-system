/**
 * PR-B — a CLOSED service (archived/completed) hides add-hours / stage-advance in the
 * admin management card, and the AddPackageToStage injector scopes each stage to its OWN
 * service (explicit identity, not a first-match `find`).
 * ─────────────────────────────────────────────────────────────────────────────
 * Backend #535 already REFUSES new hours on a closed service (functions/shared/service-status.js
 * → HOURS_LOCKED_STATUSES = ['archived','completed']). Until now the admin management card still
 * SHOWED "חדש שעות" / "הוסף שעות" (injected) / "עבור לשלב הבא" on closed services → a dead-end
 * (click → raw permission error). Two bugs, both proven below against the live מידר-אלעד shape
 * (client 2025364, verified by a read-only probe 2026-08-16):
 *   BUG 1 — a CLOSED service still offered add-hours (no service-status gate on the frontend).
 *   BUG 2 — the injector `find(s => s.type==='legal_procedure')` processed ONLY the FIRST legal
 *           procedure per client → a 2nd/3rd active service got NO button at all.
 *
 * "שנה סטטוס" (the reopen path, per service-status.js) and "מחק" stay visible on a closed service.
 *
 * Created: 2026-08-16 — fix/closed-service-hide-actions
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

// side-effect imports (classic admin scripts → register window.*)
// @ts-ignore — registers window.escapeHtml (esc delegates to it)
import '../../../apps/admin-panel/js/core/escape-html.js';
// @ts-ignore — registers window.UnifiedServiceCard (buildActions exposed as a test seam)
import '../../../apps/admin-panel/js/ui/UnifiedServiceCard.js';
// @ts-ignore — registers window.AddPackageToStage (self-inits; exposes addButtonsToStages)
import '../../../apps/admin-panel/js/features/AddPackageToStage.js';

const USC: any = (window as any).UnifiedServiceCard;
const APS: any = (window as any).AddPackageToStage;

describe('test harness self-check', () => {
  it('both modules are live', () => {
    expect(typeof USC?.buildActions).toBe('function');
    expect(typeof APS?.addButtonsToStages).toBe('function');
  });
});

describe('PR-B — buildActions: a CLOSED service hides add-hours + stage-advance', () => {
  const actions = (card: any): string => USC.buildActions(card);

  it('OPEN hours service shows "חדש שעות" (renew)', () => {
    expect(actions({ type: 'hours', serviceId: 's1', status: 'active' })).toContain('data-service-action="renew"');
  });

  it('ARCHIVED hours service HIDES renew, KEEPS change-status (reopen) + delete', () => {
    const out = actions({ type: 'hours', serviceId: 's1', status: 'archived' });
    expect(out).not.toContain('data-service-action="renew"');
    expect(out).toContain('data-service-action="change-status"');
    expect(out).toContain('data-service-action="delete"');
  });

  it('COMPLETED hours service HIDES renew', () => {
    expect(actions({ type: 'hours', serviceId: 's1', status: 'completed' })).not.toContain('data-service-action="renew"');
  });

  it('OPEN legal_procedure with an active stage shows "עבור לשלב הבא" (next-stage)', () => {
    const out = actions({ type: 'legal_procedure', serviceId: 's2', status: 'active', stages: [{ status: 'active' }] });
    expect(out).toContain('data-service-action="next-stage"');
  });

  it('ARCHIVED legal_procedure (even with an active stage) HIDES next-stage, KEEPS change-status', () => {
    const out = actions({ type: 'legal_procedure', serviceId: 's2', status: 'archived', stages: [{ status: 'active' }] });
    expect(out).not.toContain('data-service-action="next-stage"');
    expect(out).toContain('data-service-action="change-status"');
  });

  it('no status → DEFAULT-ACTIVE (open) → renew shows', () => {
    expect(actions({ type: 'hours', serviceId: 's1' })).toContain('data-service-action="renew"');
  });
});

describe('PR-B — AddPackageToStage injector: the live מידר-אלעד scenario (both bugs)', () => {
  const stageDom = (name: string) =>
    `<div class="management-stage"><div class="management-stage-info"><div class="management-stage-name">${name}</div></div></div>`;
  const cardDom = (serviceId: string, stageNames: string[]) =>
    `<div class="management-service-card" data-service-id="${serviceId}"><div class="management-stages-list">${stageNames.map(stageDom).join('')}</div></div>`;

  it('injects "הוסף שעות" ONLY on active services’ active stages — never on the closed service, and on every legal procedure (not just the first)', () => {
    // מידר 2025364: [0] archived+hourly ("שלב א" active) · [1] active+hourly ("שלב ב'" active) · [2] active+hourly ("שלב א'" active)
    (window as any).ClientManagementModal = {
      currentClient: {
        caseNumber: '2025364',
        services: [
          { id: 'srv_0', type: 'legal_procedure', status: 'archived', pricingType: 'hourly',
            stages: [{ id: 'st_0a', name: 'שלב א', status: 'active' }, { id: 'st_0b', name: 'שלב ב', status: 'pending' }] },
          { id: 'srv_1', type: 'legal_procedure', status: 'active', pricingType: 'hourly',
            stages: [{ id: 'st_1a', name: "שלב א'", status: 'completed' }, { id: 'st_1b', name: "שלב ב'", status: 'active' }] },
          { id: 'srv_2', type: 'legal_procedure', status: 'active', pricingType: 'hourly',
            stages: [{ id: 'st_2a', name: "שלב א'", status: 'active' }] }
        ]
      }
    };

    const modal = document.createElement('div');
    modal.id = 'clientManagementModal';
    modal.style.display = 'flex';
    modal.innerHTML =
      cardDom('srv_0', ['שלב א', 'שלב ב']) +
      cardDom('srv_1', ["שלב א'", "שלב ב'"]) +
      cardDom('srv_2', ["שלב א'"]);
    document.body.appendChild(modal);

    APS.addButtonsToStages();

    // Exactly 2 buttons: srv_1 "שלב ב'" (active) + srv_2 "שלב א'" (active). NONE on the archived srv_0.
    expect(modal.querySelectorAll('.add-package-btn').length).toBe(2);
    expect(modal.querySelector('[data-service-id="srv_0"]')!.querySelectorAll('.add-package-btn').length).toBe(0); // BUG 1 fixed: closed → no button
    expect(modal.querySelector('[data-service-id="srv_1"]')!.querySelectorAll('.add-package-btn').length).toBe(1); // BUG 2 fixed: 2nd procedure gets its button
    expect(modal.querySelector('[data-service-id="srv_2"]')!.querySelectorAll('.add-package-btn').length).toBe(1); // BUG 2 fixed: 3rd procedure gets its button

    document.body.removeChild(modal);
  });
});

describe('PR-B — HOURS_LOCKED_STATUSES drift-guard (both frontend mirrors ↔ backend SSOT)', () => {
  const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');
  // matches backend `Object.freeze(['archived','completed'])` AND the frontend `['archived','completed']`
  const RE = /HOURS_LOCKED_STATUSES\s*=\s*(?:Object\.freeze\()?\[\s*'archived'\s*,\s*'completed'\s*\]/;

  it('backend functions/shared/service-status.js = [archived, completed]', () => {
    expect(read('../../../functions/shared/service-status.js')).toMatch(RE);
  });
  it('UnifiedServiceCard.js mirror = [archived, completed]', () => {
    expect(read('../../../apps/admin-panel/js/ui/UnifiedServiceCard.js')).toMatch(RE);
  });
  it('AddPackageToStage.js mirror = [archived, completed]', () => {
    expect(read('../../../apps/admin-panel/js/features/AddPackageToStage.js')).toMatch(RE);
  });
});
