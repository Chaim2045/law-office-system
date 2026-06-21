/**
 * Routing guard — escapeHtml SSOT consolidation PR2
 * ─────────────────────────────────────────────────────────────────────────────
 * PR1 (#390) created the shared SSOT `window.escapeHtml` (js/core/escape-html.js,
 * 5-entity `& < > " '`) and routed the 6 string-replace escapers to it. PR2 routes
 * the remaining 16 LIVE duplicated escapers — 14 "temp-div" copies
 * (`div.textContent = x; return div.innerHTML;` → 3 entities only) + 2 inline-map
 * 5-entity copies (ReportGenerator, WhatsAppMessageDialog) — by replacing each
 * escaper BODY with `return window.escapeHtml(<param>);` (call-sites unchanged).
 *
 * This is a SOURCE-LEVEL guard (the repo's AST-guard precedent — rules-drift-guard,
 * PR-SEC-2 migration guards). The 16 escapers live on heavyweight UI managers that
 * self-instantiate at load (Firebase/DOM deps), so a per-manager behavioral test is
 * impractical for all 16 — the END-TO-END behavioral proof is covered by
 * escape-html.test.ts (the SSOT, 8 tests) + report-generator-escaping.test.ts +
 * whatsapp-message-dialog-escaping.test.ts (two routed managers, exercised live).
 *
 * ─── What this catches ───────────────────────────────────────────────────────
 *   ✅ A routed escaper that was NOT actually delegated (still has its old body).
 *   ✅ A leftover temp-div (`document.createElement`) or inline-map (`.replace`)
 *      body between the signature and the delegation return.
 *   ✅ A host page that loads a routed consumer WITHOUT loading escape-html.js, OR
 *      loads it AFTER the consumer (the PR1 devils-advocate's load-order attack —
 *      `window.escapeHtml` undefined at call-time → TypeError in production).
 *
 * Created: 2026-06-21 — refactor/escapehtml-ssot-pr2
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

// escapeHtml-dedup PR2 — load the SSOT so the behavioral contract can be re-pinned.
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/core/escape-html.js';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const read = (rel: string): string => fs.readFileSync(path.resolve(ADMIN, rel), 'utf8');

/**
 * Extract the escaper body from its signature line through (and including) the
 * `return window.escapeHtml(` delegation line. Scoping to exactly this span means
 * the negative assertions (no temp-div, no inline-map) cannot false-positive on an
 * unrelated `document.createElement` / `.replace` elsewhere in the file.
 */
function escaperBody(src: string, sig: string): string {
  const all = src.split('\n');
  const i = all.findIndex((l) => l.includes(sig));
  expect(i, `escaper signature not found: ${sig}`).toBeGreaterThan(-1);
  let j = -1;
  for (let k = i; k < Math.min(i + 12, all.length); k++) {
    if (all[k].includes('return window.escapeHtml(')) {
      j = k;
      break;
    }
  }
  expect(j, `delegation "return window.escapeHtml(" not found within 12 lines of: ${sig}`).toBeGreaterThan(-1);
  return all.slice(i, j + 1).join('\n');
}

// [file, escaper-signature (unique within the file), parameter name]
const ROUTED: ReadonlyArray<readonly [string, string, string]> = [
  ['js/ui/MessagesFullscreenModal.js', 'escapeHTML(text) {', 'text'],
  ['js/fluent/FluentDataGrid.js', 'escapeHtml(text) {', 'text'],
  ['js/ui/DeleteDataSidePanel.js', 'escapeHtml(text) {', 'text'],
  ['js/features/ServiceOverdraftResolution.js', 'escapeHtml(text) {', 'text'],
  ['js/ui/AnnouncementCard.js', 'static escapeHtml(text) {', 'text'],
  ['js/ui/AdminThreadView.js', '_escapeHTML(str) {', 'str'],
  ['js/ui/ClientReportModal.js', 'escapeHtml(text) {', 'text'],
  ['js/ui/ClientManagementModal.js', 'escapeHtml(text) {', 'text'],
  ['js/ui/ReadStatusModal.js', 'escapeHtml(text) {', 'text'],
  ['js/ui/TaskApprovalSidePanel.js', '_escapeHtml(str) {', 'str'],
  ['js/ui/UserAlertsPanel.js', 'escapeHTML(str) {', 'str'],
  ['js/ui/UserDetailsModal.js', 'escapeHtml(text) {', 'text'],
  ['js/ui/UsersTable.js', 'escapeHtml(text) {', 'text'],
  ['js/ui/ClientsTable.js', 'escapeHtml(text) {', 'text'],
  ['js/managers/WhatsAppMessageDialog.js', 'function escapeHtml(text) {', 'text'],
  ['js/managers/ReportGenerator.js', 'escapeHtml(text) {', 'text'],
];

describe('escapeHtml PR2 — every routed escaper delegates to the SSOT', () => {
  it('routes all 16 escapers (and the count is exactly 16)', () => {
    expect(ROUTED).toHaveLength(16);
  });

  for (const [file, sig, param] of ROUTED) {
    it(`${file} :: ${sig.replace(/\s*\{$/, '')} → window.escapeHtml(${param})`, () => {
      const body = escaperBody(read(file), sig);
      expect(body).toContain(`return window.escapeHtml(${param});`);
      // the old temp-div body must be gone
      expect(body, 'leftover temp-div body').not.toContain('document.createElement');
      // the old inline-map body (ReportGenerator / WhatsAppMessageDialog) must be gone
      expect(body, 'leftover inline-map body').not.toMatch(/\.replace\(/);
    });
  }
});

describe('escapeHtml PR2 — the ClientsTable data-tooltip-html escape stays EXCLUDED', () => {
  // getTypeBadge packs ALREADY-RENDERED HTML into a data attribute and escapes
  // only & + " on purpose; routing it to the 5-entity SSOT would turn <div> into
  // &lt;div&gt; and break the tooltip. PR2 must NOT touch it.
  it('getTypeBadge still uses its own &/" -only inline escape (not the SSOT)', () => {
    const src = read('js/ui/ClientsTable.js');
    expect(src).toContain(".replace(/&/g, '&amp;')");
    expect(src).toContain(".replace(/\"/g, '&quot;')");
  });
});

describe('escapeHtml PR2 — load-order invariant (escape-html.js before EVERY routed consumer)', () => {
  // Match the actual `<script src="..."` tag, NOT the bare filename — a page may
  // mention a consumer in an HTML comment BEFORE its script tag (e.g. clients.html
  // references ClientReportModal.js in a comment above the load), which would make a
  // bare-filename indexOf false-match. Asserting the <script> tag avoids that.
  const ssotAt = (html: string): number => html.indexOf('<script src="js/core/escape-html.js');
  const tagAt = (html: string, rel: string): number => html.indexOf('<script src="' + rel);

  // page → EVERY routed consumer <script> it loads (devils-advocate #5-i: assert all,
  // not one representative, so a future routed <script> inserted ABOVE escape-html.js
  // on any page is caught — the exact PR1 load-order failure mode).
  const PAGE_CONSUMERS: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['index.html', [
      'js/ui/UsersTable.js', 'js/ui/UserDetailsModal.js', 'js/ui/DeleteDataSidePanel.js',
      'js/managers/WhatsAppMessageDialog.js', 'js/ui/UserAlertsPanel.js',
      'js/ui/MessagesFullscreenModal.js', 'js/ui/AdminThreadView.js',
      'js/ui/TaskApprovalSidePanel.js', 'js/managers/ReportGenerator.js',
    ]],
    ['system-announcements.html', ['js/ui/AnnouncementCard.js', 'js/ui/ReadStatusModal.js']],
    ['clients.html', [
      'js/managers/ReportGenerator.js', 'js/ui/ClientReportModal.js',
      'js/ui/ClientManagementModal.js', 'js/ui/ClientsTable.js',
      'js/features/ServiceOverdraftResolution.js', 'js/ui/TaskApprovalSidePanel.js',
    ]],
    ['clients-fluent.html', [
      'js/ui/ClientsTable.js', 'js/ui/ClientReportModal.js',
      'js/managers/ReportGenerator.js', 'js/fluent/FluentDataGrid.js',
    ]],
  ];

  for (const [page, consumers] of PAGE_CONSUMERS) {
    it(`${page} loads escape-html.js before all ${consumers.length} routed consumers`, () => {
      const html = read(page);
      const ssot = ssotAt(html);
      expect(ssot, `${page} does not load js/core/escape-html.js`).toBeGreaterThan(-1);
      for (const consumer of consumers) {
        const at = tagAt(html, consumer);
        expect(at, `${page} does not load <script src="${consumer}`).toBeGreaterThan(-1);
        expect(ssot, `${page}: escape-html.js must load BEFORE ${consumer}`).toBeLessThan(at);
      }
    });
  }
});

describe('escapeHtml PR2 — SSOT behavioral contract the routing depends on', () => {
  it('escapes all 5 entities (the routed temp-div copies now also escape " and \')', () => {
    const escapeHtml = (globalThis as any).window?.escapeHtml ?? (globalThis as any).escapeHtml;
    expect(typeof escapeHtml).toBe('function');
    expect(escapeHtml(`O'Brien & <b>"x"</b>`)).toBe('O&#039;Brien &amp; &lt;b&gt;&quot;x&quot;&lt;/b&gt;');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
