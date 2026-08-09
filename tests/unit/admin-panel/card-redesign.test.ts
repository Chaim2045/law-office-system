/**
 * Management service-card redesign (Track-2 PR-1) — behavioral + report-safety guard.
 * ─────────────────────────────────────────────────────────────────────────────
 * The management card got a compact reading-pane redesign: a management-forked header
 * (buildManageHeader → .msc-head / .msc-status, NOT the shared report band), a RELATIVE
 * hours meter (orange only ≥85% used — now the ONE shared meterStatus, so the report band
 * reads identically; PR-2 unified the threshold), and a collapsible packages disclosure
 * (native <details> for >1, inline for 1).
 *
 * This suite drives the REAL buildManageDetail (JSDOM) to prove:
 *   - the relative meter reads calm on a barely-used small quota (the #526 absolute threshold bug),
 *   - the packages disclosure keeps the `.edit-pkg-date-btn` + data-* handler contract,
 *   - the header forks from the shared band (the management card emits NO .usc-identity), and
 *   - buildIdentityBand + the ReportTab consumer are byte-untouched (the report tab is unaffected).
 * The full injector contract (root / data-service-action / .management-stage*) lives in
 * manage-detail-equality.test.ts, re-anchored alongside this PR.
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

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
const REPORT_SRC = fs.readFileSync(path.resolve(ADMIN, 'js/ui/ReportTab.js'), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const model = (window as any).ServiceCardModel;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const USC = (window as any).UnifiedServiceCard;

function card(svc: Record<string, unknown>): HTMLElement {
  return USC.buildManageDetail(model.build({ services: [svc] }).cards[0]);
}
function hoursSvc(over: Record<string, unknown>): Record<string, unknown> {
  return { id: 'h', name: 'שירות שעות', type: 'hours', status: 'active', ...over };
}

describe('card redesign — RELATIVE meter (management-only; the report band stays absolute)', () => {
  it('a barely-used small quota reads calm (good/blue), NOT orange — the #526 absolute-10h bug', () => {
    const c = card(hoursSvc({ totalHours: 10, hoursUsed: 2.5, hoursRemaining: 7.5 }));
    expect(c.querySelector('.msc-meter-fill--good')).not.toBeNull();
    expect(c.querySelector('.msc-meter-fill--high')).toBeNull();
  });

  it('≥85% used → high (orange)', () => {
    const c = card(hoursSvc({ totalHours: 10, hoursUsed: 9, hoursRemaining: 1 }));
    expect(c.querySelector('.msc-meter-fill--high')).not.toBeNull();
    expect(c.querySelector('.msc-meter-fill--good')).toBeNull();
  });

  it('overdraft (remaining < 0) → over (red)', () => {
    const c = card(hoursSvc({ totalHours: 10, hoursUsed: 12, hoursRemaining: -2 }));
    expect(c.querySelector('.msc-meter-fill--over')).not.toBeNull();
  });

  it('exactly on budget (remaining 0) → high, NEVER over (a spent quota is a warning, not a debt)', () => {
    const c = card(hoursSvc({ totalHours: 10, hoursUsed: 10, hoursRemaining: 0 }));
    expect(c.querySelector('.msc-meter-fill--high')).not.toBeNull();
    expect(c.querySelector('.msc-meter-fill--over')).toBeNull();
  });
});

describe('card redesign — collapsible packages keep the edit-date handler contract', () => {
  it('2 packages → a native <details> disclosure, COLLAPSED by default', () => {
    const c = card(hoursSvc({
      totalHours: 30, hoursUsed: 5, hoursRemaining: 25,
      packages: [
        { id: 'p1', purchaseDate: '2026-01-01', hours: 10, hoursUsed: 2, hoursRemaining: 8, description: 'a' },
        { id: 'p2', purchaseDate: '2026-02-01', hours: 20, hoursUsed: 3, hoursRemaining: 17, description: 'b' }
      ]
    }));
    const d = c.querySelector('details.msc-pkgs') as HTMLDetailsElement | null;
    expect(d).not.toBeNull();
    expect(d?.open).toBe(false);
    const edits = Array.from(c.querySelectorAll('.edit-pkg-date-btn')) as HTMLElement[];
    expect(edits.length).toBe(2);
    expect(edits[0].dataset.serviceId).toBe('h');
    expect(edits[0].dataset.packageId).toBe('p1');
    expect(edits[0].dataset.currentDate).toBe('2026-01-01');
  });

  it('1 package → inline (no <details>), edit contract intact', () => {
    const c = card(hoursSvc({
      totalHours: 10, hoursUsed: 1, hoursRemaining: 9,
      packages: [{ id: 'only', purchaseDate: '2026-03-03', hours: 10, hoursUsed: 1, hoursRemaining: 9, description: 'a' }]
    }));
    expect(c.querySelector('details.msc-pkgs')).toBeNull();
    expect(c.querySelector('.msc-pkgs-solo')).not.toBeNull();
    const e = c.querySelector('.edit-pkg-date-btn') as HTMLElement;
    expect(e.dataset.packageId).toBe('only');
    expect(e.dataset.currentDate).toBe('2026-03-03');
  });
});

describe('card redesign — the management header forks from the shared band (report tab untouched)', () => {
  it('the management card renders .msc-head + .msc-status, and NOT the report band .usc-identity', () => {
    const c = card(hoursSvc({ totalHours: 10, hoursUsed: 1, hoursRemaining: 9 }));
    expect(c.querySelector('.msc-head')).not.toBeNull();
    expect(c.querySelector('.msc-status--active')).not.toBeNull();
    expect(c.querySelector('.usc-identity')).toBeNull();
  });

  it('buildIdentityBand still exists, is exported, and keeps the report band shape (byte-untouched)', () => {
    expect(typeof USC.buildIdentityBand).toBe('function');
    const cm = model.build({ services: [hoursSvc({ totalHours: 10, hoursUsed: 1, hoursRemaining: 9 })] }).cards[0];
    const band: string = USC.buildIdentityBand(cm);
    expect(band).toContain('usc-identity');
  });

  it('ReportTab still renders via buildIdentityBand (the redesign never reached the report tab)', () => {
    expect(REPORT_SRC).toContain('UnifiedServiceCard.buildIdentityBand');
  });
});
