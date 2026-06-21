/**
 * Unit tests — the shared HTML-escape SSOT (apps/admin-panel/js/core/escape-html.js).
 *
 * `window.escapeHtml` is the ONE canonical 5-entity escaper that PR1 of the
 * escapeHtml-dedup routes the string-replace → innerHTML family through. These
 * tests pin its exact output shape (`& < > " '` → `&amp; &lt; &gt; &quot; &#039;`),
 * which MUST match the canonical ReportGenerator/WhatsApp escaper already pinned by
 * report-generator-escaping.test.ts / whatsapp-message-dialog-escaping.test.ts, plus
 * the stricter null/undefined-only guard.
 *
 * Created: 2026-06-21 — refactor/escapehtml-ssot-pr1
 */

import { describe, it, expect } from 'vitest';

// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/core/escape-html.js';

const escapeHtml: (t: unknown) => string = (window as any).escapeHtml;

describe('window.escapeHtml — the SSOT 5-entity escaper', () => {
  it('is loaded as a global function', () => {
    expect(typeof escapeHtml).toBe('function');
  });

  it('escapes all five entities in the canonical shape (matches ReportGenerator/WhatsApp)', () => {
    expect(escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#039;');
  });

  it('escapes each trigger character individually', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#039;');
  });

  it('neutralizes a script-injection payload', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('null / undefined → empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('a literal 0 / false is stringified, NOT blanked (stricter guard than !text)', () => {
    expect(escapeHtml(0)).toBe('0');
    expect(escapeHtml(false)).toBe('false');
  });

  it('leaves benign Hebrew + plain text unchanged', () => {
    expect(escapeHtml('משה לוי')).toBe('משה לוי');
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });

  it('escapes every occurrence (global), including repeated + already-encoded entities', () => {
    expect(escapeHtml('a & b & c')).toBe('a &amp; b &amp; c');
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});
