/**
 * WorkloadCard onclick → data-attr + delegation refactor — escapeHtml dedup PR3c
 * ─────────────────────────────────────────────────────────────────────────────
 * PR3c closes the WorkloadCard half of the dedup:
 *   • The ONE live inline-onclick (`narrative-grid-row` → workloadDrawer.open) that
 *     interpolated the email into a JS-string is replaced by a single delegated
 *     `click` listener on the persistent #workloadContent container, reading the
 *     decoded `data-email` (so an apostrophe email round-trips safely — the exact
 *     path the keyboard handler already used).
 *   • `sanitize` is deleted (all call-sites routed to window.escapeHtml).
 *   • The DEAD category-toggle subsystem (renderEmployeeCard + its 4 category
 *     methods + 2 content methods + renderDetailedSections/CriticalAlertsSection +
 *     the orphaned renderManager* + extractReasonsChips, all zero-live-callers) and
 *     the 3 dead `window.toggle*` globals are removed.
 *
 * Source guards + a happy-dom behavioral test of the delegated drawer-open.
 *
 * Created: 2026-06-22 — refactor/escapehtml-ssot-pr3c
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeEach } from 'vitest';

// The SSOT is loaded on workload.html before WorkloadCard (PR3a). Stub it for the
// IIFE's render-time calls; the IIFE itself only needs `document` at load.
const MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
(window as any).escapeHtml = (s: unknown): string =>
  (s === null || s === undefined ? '' : String(s).replace(/[&<>"']/g, (c) => MAP[c]));

// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/workload-analytics/WorkloadCard.js';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const SRC = fs.readFileSync(path.resolve(ADMIN, 'js/workload-analytics/WorkloadCard.js'), 'utf8');

describe('escapeHtml PR3c — WorkloadCard source guards', () => {
  it('no inline on*= handler interpolates ${...} except the allow-listed toggleEmployeeGroup(groupId)', () => {
    const handlers = SRC.match(/\son\w+="[^"]*"/g) || [];
    // groupId is a render-internal status bucket (group-${status}), never user-text → no XSS.
    const offenders = handlers.filter((h) => /\$\{/.test(h) && !h.includes("toggleEmployeeGroup('${groupId}')"));
    expect(offenders, 'inline on*= with interpolation must be gone: ' + JSON.stringify(offenders)).toEqual([]);
  });

  it('the dead toggle globals + sanitize + the dead renderEmployeeCard subsystem are removed', () => {
    expect(SRC).not.toContain('window.toggleCategory');
    expect(SRC).not.toContain('window.toggleBreakdown');
    expect(SRC).not.toContain('window.toggleAllPeakTasks');
    expect(SRC).not.toMatch(/\bsanitize\b/);
    expect(SRC).not.toContain('renderEmployeeCard');
    expect(SRC).not.toContain('renderTaskQualityCategory');
    expect(SRC).not.toContain('renderWeeklyBreakdownContent');
  });

  it('the live drawer-open is now a data-attr + delegated listener (bound once)', () => {
    expect(SRC).toContain('__wlcRowDelegated');
    expect(SRC).toContain("e.target.closest('.narrative-grid-row')");
    expect(SRC).toContain('window.workloadDrawer.open(row.dataset.email)');
  });
});

describe('escapeHtml PR3c — delegated row-click opens the drawer with the decoded (apostrophe-safe) email', () => {
  let opened: string[];

  beforeEach(() => {
    document.body.innerHTML = '<div id="workloadContent"></div>';
    opened = [];
    (window as any).workloadDrawer = { open: (email: string): number => opened.push(email) };
  });

  it('clicking inside a row calls workloadDrawer.open with the apostrophe email (verbatim from dataset)', () => {
    const card = (window as any).WorkloadCard;
    const container = document.getElementById('workloadContent');
    card.container = container;
    // The render emits data-email="${escapeHtml(email)}" (→ o&#039;brien@x.com); a real browser
    // HTML-decodes that on parse so dataset.email is the literal "o'brien@x.com". We set the
    // DECODED value directly (happy-dom does not decode numeric entities) — the point under test
    // is that the delegated handler passes dataset.email through VERBATIM, so an apostrophe (which
    // broke the old inline-onclick JS-string) no longer breaks anything.
    container!.innerHTML =
      '<div class="narrative-grid-row" data-status="ok" data-email="o\'brien@x.com">' +
      '<span class="grid-col-employee">x</span></div>';
    card.attachEventListeners();
    // click a nested element — the delegated handler must resolve the row via closest()
    container!.querySelector('.grid-col-employee')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(opened).toEqual(["o'brien@x.com"]);
    // and the SSOT escapes that email for the attribute (the browser decodes it back on parse):
    expect((window as any).escapeHtml("o'brien@x.com")).toBe('o&#039;brien@x.com');
  });

  it('round-trips the FULL escape→parse→dataset pipeline (lossless join) for a decodable email', () => {
    // The apostrophe test above sets the decoded value directly because happy-dom does NOT
    // decode the numeric entity &#039; on parse (real browsers do). To EXECUTE the join step
    // the apostrophe test can only argue, this test drives the same render pipeline end-to-end
    // with `&` — valid in an email local-part (RFC 5322 atext) and one happy-dom DOES decode.
    // escapeHtml('a&b@x.com') → 'a&amp;b@x.com'; setting it as the data-email attribute and
    // reading dataset.email back proves the round-trip is lossless, so the delegated handler
    // receives the original email verbatim. The apostrophe case is identical in a real browser.
    const card = (window as any).WorkloadCard;
    const container = document.getElementById('workloadContent');
    card.container = container;
    const email = 'a&b@x.com';
    const escaped = (window as any).escapeHtml(email);
    expect(escaped).toBe('a&amp;b@x.com');
    container!.innerHTML =
      '<div class="narrative-grid-row" data-email="' + escaped + '">' +
      '<span class="grid-col-employee">x</span></div>';
    // sanity: the DOM decoded the escaped attribute back to the original on parse
    expect(container!.querySelector('.narrative-grid-row')!.getAttribute('data-email')).toBe(email);
    card.attachEventListeners();
    container!.querySelector('.grid-col-employee')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(opened).toEqual([email]);
  });

  it('a second attachEventListeners (re-render) does NOT double-bind — one open per click', () => {
    const card = (window as any).WorkloadCard;
    const container = document.getElementById('workloadContent');
    card.container = container;
    card.attachEventListeners();
    card.attachEventListeners();
    container!.innerHTML = '<div class="narrative-grid-row" data-email="a@b.com"><i>z</i></div>';
    container!.querySelector('i')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(opened).toEqual(['a@b.com']);
  });

  it('a click outside any row is ignored', () => {
    const card = (window as any).WorkloadCard;
    const container = document.getElementById('workloadContent');
    card.container = container;
    container!.innerHTML = '<div class="something-else">y</div>';
    card.attachEventListeners();
    container!.querySelector('.something-else')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(opened).toEqual([]);
  });
});
