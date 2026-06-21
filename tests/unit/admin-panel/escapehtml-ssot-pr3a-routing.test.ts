/**
 * Routing guard — escapeHtml SSOT consolidation PR3a (mechanical)
 * ─────────────────────────────────────────────────────────────────────────────
 * PR3a closes the LOW-RISK remainder of the escapeHtml dedup (PR3c handles the
 * onclick→addEventListener behavioral refactors). It:
 *   • deletes the DEAD admin `case-form-validator.js` (zero admin pages load it),
 *   • routes `service-card-renderer.js` to window.escapeHtml (drops the永 dead
 *     dead `window.safeText || <temp-div>` fallback — window.safeText is never
 *     defined in the admin panel),
 *   • routes `WorkloadCard.sanitize`'s METHOD BODY to window.escapeHtml (the
 *     id-coupled id=/onclick pairs stay consistent because both sides call the
 *     same method; the onclick JS-string apostrophe hazard is PRE-EXISTING and is
 *     fixed in PR3c) + adds escape-html.js to workload.html,
 *   • routes notification-bell's 3 HTML-TEXT sites to window.escapeHtml, KEEPING
 *     `safeText` for the onclick JS-string site (PR3c / the notification PR).
 *
 * Source-level guard, same precedent as escapehtml-ssot-pr2-routing.test.ts.
 *
 * Created: 2026-06-21 — refactor/escapehtml-ssot-pr3a
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

// escapeHtml-dedup — load the SSOT so the behavioral contract can be re-pinned.
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/core/escape-html.js';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const read = (rel: string): string => fs.readFileSync(path.resolve(ADMIN, rel), 'utf8');
const exists = (rel: string): boolean => fs.existsSync(path.resolve(ADMIN, rel));

// Extract an escaper body from its signature line through the delegation return,
// so the negative assertions cannot false-positive on an unrelated createElement.
function escaperBody(src: string, sig: string): string {
  const all = src.split('\n');
  const i = all.findIndex((l) => l.includes(sig));
  expect(i, 'escaper signature not found: ' + sig).toBeGreaterThan(-1);
  let j = -1;
  for (let k = i; k < Math.min(i + 12, all.length); k++) {
    if (all[k].includes('return window.escapeHtml(')) {
      j = k;
      break;
    }
  }
  expect(j, 'delegation "return window.escapeHtml(" not found after ' + sig).toBeGreaterThan(-1);
  return all.slice(i, j + 1).join('\n');
}

describe('escapeHtml PR3a — dead case-form-validator.js deleted + unreferenced', () => {
  it('the admin-panel copy no longer exists', () => {
    expect(exists('js/modules/case-form-validator.js')).toBe(false);
  });

  it('no admin-panel HTML page loads it', () => {
    const pages = fs.readdirSync(ADMIN).filter((f) => f.endsWith('.html'));
    for (const page of pages) {
      expect(read(page).includes('case-form-validator.js'), page + ' still references case-form-validator.js').toBe(false);
    }
  });
});

describe('escapeHtml PR3a — service-card-renderer routed to the SSOT', () => {
  it('aliases escapeHtml to window.escapeHtml and drops the dead window.safeText fallback', () => {
    const src = read('js/modules/service-card-renderer.js');
    expect(src).toContain('const escapeHtml = window.escapeHtml;');
    expect(src, 'dead window.safeText fallback expression must be removed').not.toContain('window.safeText ||');
  });

  it('clients.html loads escape-html.js before service-card-renderer.js', () => {
    const html = read('clients.html');
    const ssot = html.indexOf('<script src="js/core/escape-html.js');
    const consumer = html.indexOf('<script src="js/modules/service-card-renderer.js');
    expect(ssot, 'clients.html does not load escape-html.js').toBeGreaterThan(-1);
    expect(consumer, 'clients.html does not load service-card-renderer.js').toBeGreaterThan(-1);
    expect(ssot, 'escape-html.js must load BEFORE service-card-renderer.js').toBeLessThan(consumer);
  });
});

describe('escapeHtml PR3a — WorkloadCard.sanitize delegates to the SSOT', () => {
  it('sanitize body routes to window.escapeHtml (temp-div removed)', () => {
    const body = escaperBody(read('js/workload-analytics/WorkloadCard.js'), 'sanitize(text) {');
    expect(body).toContain('return window.escapeHtml(text);');
    expect(body, 'temp-div body must be gone').not.toContain('document.createElement');
  });

  it('workload.html loads escape-html.js before WorkloadCard.js (new dependency)', () => {
    const html = read('workload.html');
    const ssot = html.indexOf('<script src="js/core/escape-html.js');
    const consumer = html.indexOf('<script src="js/workload-analytics/WorkloadCard.js');
    expect(ssot, 'workload.html does not load escape-html.js').toBeGreaterThan(-1);
    expect(consumer, 'workload.html does not load WorkloadCard.js').toBeGreaterThan(-1);
    expect(ssot, 'escape-html.js must load BEFORE WorkloadCard.js').toBeLessThan(consumer);
  });
});

describe('escapeHtml PR3a — notification-bell text sites routed (onclick site deferred to PR3c)', () => {
  const src = read('js/modules/notification-bell.js');

  it('the 3 notification text sites now use window.escapeHtml', () => {
    const count = (src.match(/\$\{window\.escapeHtml\(/g) || []).length;
    expect(count, 'expected the 3 notification-title/description/time sites to route').toBeGreaterThanOrEqual(3);
  });

  it('safeText is KEPT for the onclick JS-string site (PR3c handles the data-attr refactor)', () => {
    expect(src, 'safeText must remain for the openReplyModal onclick').toContain('function safeText(');
    // the openReplyModal onclick still uses safeText + the apostrophe escaping — untouched here
    expect(src, 'the onclick JS-string site must be left for PR3c').toContain(".replace(/'/g");
  });
});

describe('escapeHtml PR3a — SSOT behavioral contract the routing depends on', () => {
  it('escapes all 5 entities', () => {
    const escapeHtml = (window as any).escapeHtml;
    expect(typeof escapeHtml).toBe('function');
    expect(escapeHtml('a & b < c > d " e \' f')).toBe('a &amp; b &lt; c &gt; d &quot; e &#039; f');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
