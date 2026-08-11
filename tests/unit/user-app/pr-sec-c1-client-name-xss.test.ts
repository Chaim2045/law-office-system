/**
 * PR-SEC-C1 — stored XSS via an unescaped client name in the user-app.
 * ─────────────────────────────────────────────────────────────────────────────
 * A security red-team reachability check (2026-08-11) confirmed a live stored XSS:
 * `createClientFromSalesRecord` persists a client's `fullName`/`caseTitle` VERBATIM
 * (unsanitized) from the authenticated tofes sales form; that raw name becomes an active
 * client and rendered UNESCAPED into two user-app sinks that every lawyer hits daily:
 *   - `client-case-selector.js:604` — `${client.fullName}` in the results dropdown
 *   - `case-creation-dialog.js` — `highlightMatch(client.fullName, …)` (:1732) + the
 *     reflected typed name (:1757)
 * → a client named `<img src=x onerror=…>` executed script in the lawyer's session.
 *
 * The fix escapes at every name sink via the local 5-entity escaper (mirrors the user-app
 * `safeText` SSOT). This suite follows the house pattern (client-case-selector-pending-guard):
 * a SOURCE LOCK (every sink wrapped, no raw interpolation survives) + a BEHAVIORAL MIRROR of
 * the escape-then-wrap algorithm proving a malicious name renders inert while a benign match
 * is still highlighted.
 *
 * Created: 2026-08-11 — fix/pr-sec-c1-client-name-xss
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeAll } from 'vitest';

const SELECTOR = path.resolve(__dirname, '../../../apps/user-app/js/modules/client-case-selector.js');
const DIALOG = path.resolve(__dirname, '../../../apps/user-app/js/modules/case-creation/case-creation-dialog.js');

/** Strip comments so a commented-out escape can't satisfy a source lock. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('PR-SEC-C1 — source lock: every client-name sink is escaped', () => {
  let selector: string;
  let dialog: string;
  beforeAll(() => {
    selector = stripComments(fs.readFileSync(SELECTOR, 'utf8'));
    dialog = stripComments(fs.readFileSync(DIALOG, 'utf8'));
  });

  it('client-case-selector renders fullName via escapeHtml (no raw ${client.fullName})', () => {
    expect(selector).toContain('${this.escapeHtml(client.fullName)}');
    expect(selector, 'no raw fullName interpolation may survive').not.toMatch(/\$\{\s*client\.fullName\s*\}/);
  });

  it('case-creation highlightMatch escapes the no-match branch AND every segment', () => {
    expect(dialog, 'no-match branch escaped').toContain('return this.escapeHtml(text)');
    expect(dialog, 'before segment escaped').toContain('this.escapeHtml(text.substring(0, index))');
    expect(dialog, 'match segment escaped').toMatch(/this\.escapeHtml\(text\.substring\(index, index \+ query\.length\)\)/);
    expect(dialog, 'after segment escaped').toContain('this.escapeHtml(text.substring(index + query.length))');
    // Segments are escaped at ASSIGNMENT (const match = this.escapeHtml(...)), so the wrapping
    // template's ${before}/${match}/${after} hold inert strings — the highlight <span> is the only markup.
  });

  it('case-creation reflects the typed new-name via escapeHtml (no raw ${newName})', () => {
    expect(dialog).toContain('${this.escapeHtml(newName)}');
    expect(dialog, 'no raw newName in the suggestion row').not.toMatch(/\$\{\s*newName\s*\}\s*\(לקוח חדש\)/);
  });

  it('both files define a 5-entity escapeHtml (& < > " \')', () => {
    for (const src of [selector, dialog]) {
      expect(src).toContain("'&': '&amp;'");
      expect(src).toContain("'<': '&lt;'");
      expect(src).toContain("'>': '&gt;'");
      expect(src).toMatch(/replace\(\/\[&<>"'\]\/g/);
    }
  });

  // caseTitle is stored VERBATIM by createClientFromSalesRecord (= sale.transactionType) —
  // the SAME external-authenticated vector as fullName. It renders in the <option> list and the
  // selected-case info span; both must escape (devils-advocate GO-WITH-CHANGES finding, applied).
  it('caseTitle is escaped at the option + selected-case info sinks', () => {
    const hits = (selector.match(/this\.escapeHtml\(caseItem\.caseTitle/g) || []).length;
    expect(hits, 'caseTitle escaped at BOTH the <option> and the info span').toBeGreaterThanOrEqual(2);
  });

  it('client phone is escaped in both files (defense-in-depth)', () => {
    expect(selector).toContain('this.escapeHtml(client.phone)');
    expect(dialog).toContain('this.escapeHtml(client.phone)');
  });
});

// Behavioral mirror of highlightMatch's escape-then-wrap algorithm — locks the INTENT
// (malicious name inert, benign match still highlighted), not just the source text.
describe('PR-SEC-C1 — escape-then-wrap renders a malicious client name inert', () => {
  const escapeHtml = (text: unknown): string => {
    if (text === null || text === undefined) {
return '';
}
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
  };
  const highlight = (text: string, query: string): string => {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) {
return escapeHtml(text);
}
    const before = escapeHtml(text.substring(0, index));
    const match = escapeHtml(text.substring(index, index + query.length));
    const after = escapeHtml(text.substring(index + query.length));
    return `${before}<span style="background: #fef08a; font-weight: 600;">${match}</span>${after}`;
  };

  it('a <img onerror> name is escaped in the no-match path', () => {
    const out = highlight('<img src=x onerror="alert(1)">', 'zzz');
    expect(out).toContain('&lt;img');
    expect(out).not.toContain('<img');
  });

  it('a <img onerror> name is escaped even when part of it matches the query', () => {
    const out = highlight('<img onerror=alert(1)> כהן', 'כהן');
    expect(out).toContain('&lt;img');
    expect(out).not.toContain('<img');
    expect(out, 'benign match is still highlighted').toContain('<span style="background: #fef08a; font-weight: 600;">כהן</span>');
  });

  it('a benign name renders normally (no over-escaping)', () => {
    const out = highlight('משה כהן', 'כהן');
    expect(out).toContain('משה ');
    expect(out).toContain('<span style="background: #fef08a; font-weight: 600;">כהן</span>');
  });

  it('rendering the escaped output as HTML produces NO live element', () => {
    const div = document.createElement('div');
    div.innerHTML = highlight('<img src=x onerror="window.__C1_FIRED=true">', 'zzz');
    expect(div.querySelector('img'), 'no live <img> from the name').toBeNull();
  });
});
