/**
 * U0 — CHARACTERIZATION: the CURRENT (buggy) report-modal service-picker behavior.
 * ─────────────────────────────────────────────────────────────────────────────
 * MASTER_PLAN / docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U0.
 *
 * The unification (U1–U7) deletes ClientReportModal's recompute path, which is the
 * root cause of two live bugs. This suite PINS that current behavior AS-IS — it
 * asserts what the code DOES today (the bugs included), so U4/U5 can prove the
 * unified renderer FIXES them (and U7 can prove the buggy path is gone). A
 * characterization test that fails against current code is wrong by definition.
 *
 *   D2 (קובי הראל): `populateServiceCards` keys its client-wide map by the
 *       SERVICE-LOCAL `stage.id` (ClientReportModal.js:383). Two legal_procedure
 *       services that each own a `stage_a` collide → the second overwrites the
 *       first → a whole service VANISHES; the survivors carry the LAST service's id.
 *
 *   D1 (רעות ואוריאל חליבה): the timesheet-fallback block (:505-531) fabricates a
 *       phantom card `{totalHours:0, usedHours:N}` (no displayName/type/status) for
 *       any `entry.serviceName` not already a map key. Because the map is keyed by
 *       stage.id, a legal service whose hours are logged under its NAME never
 *       matches → a nameless "used>0 / total 0" phantom. It survives only for a
 *       MIXED client (top-level procedureType:'hours' → the active-stage filter at
 *       :573-590 never runs to wipe it).
 *
 * Harness mirrors tests/unit/admin-panel/overdraft-debt-reframe.test.ts (stub the
 * window globals BEFORE importing the IIFE; drive the real exported instance).
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeEach } from 'vitest';

// Globals the render path reads — stub BEFORE importing the IIFE.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).escapeHtml = (s: unknown): string => (s === null || s === undefined ? '' : String(s));
// getClientTimesheetEntries drives the D1 phantom path; default empty, overridden per-test.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).ClientsDataManager = { getClientTimesheetEntries: (): unknown[] => [] };

// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/ui/ClientReportModal.js';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const SRC = fs.readFileSync(path.resolve(ADMIN, 'js/ui/ClientReportModal.js'), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inst = (window as any).ClientReportModal;

// ── fixtures ────────────────────────────────────────────────────────────────
// Two DISTINCT legal procedures, each with its own active stage_a + stage_b —
// the D2 (קובי) shape. Stage ids are unique only WITHIN a service.
function twoLegalProceduresClient() {
  return {
    fullName: 'לקוח דו-הליכי',
    procedureType: 'legal_procedure',
    services: [
      {
        id: 'srv_tviaa', name: 'תביעה', type: 'legal_procedure', pricingType: 'hourly',
        stages: [
          { id: 'stage_a', status: 'active', totalHours: 50, hoursUsed: 46.8 },
          { id: 'stage_b', status: 'active', totalHours: 40, hoursUsed: 0 }
        ]
      },
      {
        id: 'srv_hagana', name: 'כתב הגנה', type: 'legal_procedure', pricingType: 'hourly',
        stages: [
          { id: 'stage_a', status: 'active', totalHours: 45, hoursUsed: 22.1 },
          { id: 'stage_b', status: 'active', totalHours: 30, hoursUsed: 0 }
        ]
      }
    ]
  };
}

// A MIXED client: top-level procedureType:'hours' + a legal service whose hours are
// logged under its NAME — the D1 (חליבה) shape.
function mixedHoursLegalClient() {
  return {
    fullName: 'לקוח מעורב',
    procedureType: 'hours',
    services: [
      {
        id: 'srv_beitdin', name: 'ביה"ד לעבודה', type: 'legal_procedure', pricingType: 'hourly',
        stages: [{ id: 'stage_a', status: 'active', totalHours: 79.5, hoursUsed: 61.2 }]
      }
    ]
  };
}

function cards(): HTMLElement[] {
  return Array.from(inst.serviceCardsContainer.querySelectorAll('.report-service-card')) as HTMLElement[];
}

beforeEach(() => {
  document.body.innerHTML = '<div id="reportServiceCards"></div><input id="selectedService" />';
  inst.serviceCardsContainer = document.getElementById('reportServiceCards');
  inst.selectedServiceInput = document.getElementById('selectedService'); // populateServiceCards nulls it at :267
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ClientsDataManager.getClientTimesheetEntries = (): unknown[] => [];
});

// ── D2 — a service VANISHES via the stage.id collision ───────────────────────
describe('U0 · D2 — stage.id map-key collision drops a service (current bug)', () => {
  it('two legal procedures (each with stage_a+stage_b) render as 2 cards, ALL carrying the LAST service id', async () => {
    await inst.populateServiceCards(twoLegalProceduresClient());
    const rendered = cards();

    // 4 active stages exist across 2 services, but stage_a/stage_b keys collide →
    // only 2 cards survive (one per stage id), and "תביעה" is gone.
    expect(rendered).toHaveLength(2);
    // BUG: every surviving card carries srv_hagana's id — srv_tviaa vanished.
    for (const c of rendered) {
      expect(c.dataset.serviceId).toBe('srv_hagana');
    }
    // srv_tviaa ("תביעה") is nowhere.
    expect(rendered.some((c) => c.dataset.serviceId === 'srv_tviaa')).toBe(false);
  });
});

// ── D1 — a phantom card is fabricated for a mixed client ─────────────────────
describe('U0 · D1 — timesheet-fallback fabricates a phantom card (current bug)', () => {
  it('with NO timesheet entries the mixed client renders exactly 1 (real) card', async () => {
    await inst.populateServiceCards(mixedHoursLegalClient());
    expect(cards()).toHaveLength(1);
  });

  it('when the ledger carries the legal service NAME, an extra nameless total-0 phantom appears', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ClientsDataManager.getClientTimesheetEntries = (): unknown[] => [
      { serviceName: 'ביה"ד לעבודה', minutes: 3672 } // 61.2h, logged under the NAME
    ];
    await inst.populateServiceCards(mixedHoursLegalClient());
    const rendered = cards();

    // The phantom is the EXTRA card (the map keyed the real one by stage.id, so
    // has('ביה"ד לעבודה') misses → a fabricated card is added).
    expect(rendered).toHaveLength(2);
    // The phantom has no displayName → its name renders empty (the "unfamiliar card").
    const phantom = rendered.find((c) => (c.querySelector('.report-card-name')?.textContent ?? '') === '');
    expect(phantom, 'a nameless phantom card must exist').toBeTruthy();
  });
});

// ── source-level contracts (pin the exact mechanisms U-PRs must remove/replace)
describe('U0 · source contracts — the buggy mechanisms are present today', () => {
  it('D2: the map is keyed by the service-local stage.id', () => {
    expect(SRC).toMatch(/servicesMap\.set\(\s*stage\.id\s*,/);
  });
  it('D1: the timesheet-fallback fabricates a total-0 card keyed by serviceName', () => {
    expect(SRC).toContain('if (!servicesMap.has(serviceName))');
    expect(SRC).toMatch(/servicesMap\.set\(serviceName,\s*\{[\s\S]*?totalHours:\s*0/);
  });
  it('createServiceCard falls back serviceId → stage when a service id is absent', () => {
    expect(SRC).toMatch(/dataset\.serviceId\s*=\s*serviceInfo\.serviceId\s*\|\|\s*serviceInfo\.stage/);
  });
  it('the overdraft count/filter key is overdraftResolved.isResolved (must not move in U1-U7)', () => {
    expect(SRC).toContain('overdraftResolved?.isResolved');
  });
});
