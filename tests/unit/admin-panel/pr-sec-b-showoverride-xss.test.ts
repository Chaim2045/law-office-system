/**
 * PR-SEC-B — stored XSS in the admin override modal (output-encoding fix).
 * ─────────────────────────────────────────────────────────────────────────────
 * A security red-team (2026-08-10) found that `ClientManagementModal.showOverrideModal`
 * interpolated a RAW service name into `modal.innerHTML` (the "אישור/ביטול חריגה — <name>"
 * title). The `data-name` attribute escape on the override button is defeated by a dataset
 * decode round-trip: the click handler reads `btn.dataset.name` (browser HTML-decodes the
 * attribute back to the raw string) and passes it here — so a service named
 * `<img src=x onerror=…>` executed script in the admin's session (all service-name writers
 * are admin-only post-#537, so the live class is admin→admin; the sink is still fixed).
 *
 * The fix routes the name through the SSOT escaper at the sink:
 *     אישור חריגה — ${this.escapeHtml(serviceName)}   (this.escapeHtml → window.escapeHtml)
 *
 * This is the G4 proof: a malicious service name renders INERT (escaped text, no live
 * <img>, onerror never fires) in BOTH the active and inactive branches. The harness mirrors
 * modal-unification-u1-stored-hoursused.test.ts (stub the window globals BEFORE importing the
 * IIFE, then drive the real exported instance) — but installs the REAL 5-entity SSOT escaper
 * (js/core/escape-html.js semantics), because a pass-through stub could not prove escaping.
 *
 * Created: 2026-08-11 — fix/pr-sec-b-xss-showoverride
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

// The class delegates escaping to the SSOT window global. Install the REAL 5-entity escaper
// (matching apps/admin-panel/js/core/escape-html.js: & < > " ') BEFORE importing the IIFE.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).SYSTEM_CONSTANTS = {
  SERVICE_TYPES: { HOURS: 'hours', LEGAL_PROCEDURE: 'legal_procedure', FIXED: 'fixed' },
  PRICING_TYPES: { HOURLY: 'hourly', FIXED: 'fixed' }
};
const ESC_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).escapeHtml = (s: unknown): string =>
  (s === null || s === undefined ? '' : String(s).replace(/[&<>"']/g, (c) => ESC_MAP[c]));

// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/ui/ClientManagementModal.js';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../../../apps/admin-panel/js/ui/ClientManagementModal.js'),
  'utf8'
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inst = (window as any).ClientManagementModal;

const PAYLOAD = '<img src=x onerror="window.__XSS_FIRED = true">';

beforeAll(() => {
  // The IIFE may start a DOM-polling interval on import; clear it so it can't leak.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyInst = inst as any;
  if (anyInst && anyInst.modalCheckIntervalId) {
    clearInterval(anyInst.modalCheckIntervalId);
  }
});

beforeEach(() => {
  document.body.innerHTML = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__XSS_FIRED = false;
});

function titleDivWith(text: string): HTMLElement | undefined {
  return Array.from(document.body.querySelectorAll('div')).find((d) =>
    (d.textContent || '').includes(text)
  ) as HTMLElement | undefined;
}

describe('PR-SEC-B — showOverrideModal escapes the service name (renders inert)', () => {
  it('active branch: a malicious service name is escaped, no live <img>, onerror never fires', async () => {
    const p = inst.showOverrideModal(true, PAYLOAD);

    // No live element was injected anywhere from the name.
    expect(document.body.querySelector('img'), 'no live <img> injected from the name').toBeNull();

    const title = titleDivWith('אישור חריגה');
    expect(title, 'active-branch title rendered').toBeTruthy();
    expect(title!.textContent, 'the name is shown as LITERAL text').toContain('<img');
    expect(title!.innerHTML, 'the name is HTML-escaped in the sink').toContain('&lt;img');
    expect(title!.innerHTML, 'raw tag must not appear as markup').not.toContain('<img');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).__XSS_FIRED, 'onerror must never fire').toBe(false);

    // Resolve the promise + cleanup (cancel).
    (document.getElementById('overrideCancel') as HTMLButtonElement).click();
    await p;
  });

  it('inactive branch: same escaping on the "ביטול חריגה" title', async () => {
    const p = inst.showOverrideModal(false, PAYLOAD);

    expect(document.body.querySelector('img'), 'no live <img> injected from the name').toBeNull();

    const title = titleDivWith('ביטול חריגה');
    expect(title, 'inactive-branch title rendered').toBeTruthy();
    expect(title!.textContent, 'the name is shown as LITERAL text').toContain('<img');
    expect(title!.innerHTML, 'the name is HTML-escaped in the sink').toContain('&lt;img');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).__XSS_FIRED, 'onerror must never fire').toBe(false);

    (document.getElementById('overrideCancel') as HTMLButtonElement).click();
    await p;
  });

  it('a benign name still renders correctly (no over-escaping regression)', async () => {
    const p = inst.showOverrideModal(true, 'ייעוץ שוטף');
    const title = titleDivWith('אישור חריגה');
    expect(title!.textContent).toContain('ייעוץ שוטף');
    (document.getElementById('overrideCancel') as HTMLButtonElement).click();
    await p;
  });
});

describe('PR-SEC-B — source lock: the sink routes the name through the SSOT escaper', () => {
  it('both override-modal titles call this.escapeHtml(serviceName)', () => {
    const matches = SRC.match(/\$\{this\.escapeHtml\(serviceName\)\}/g) || [];
    expect(matches.length, 'both active + inactive titles are escaped').toBe(2);
  });

  it('the raw unescaped interpolation is gone (regression lock)', () => {
    expect(SRC, 'no raw ${serviceName} in a modal title').not.toContain('חריגה — ${serviceName}</div>');
  });
});
