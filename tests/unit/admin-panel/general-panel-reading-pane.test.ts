/**
 * General panel (כללי · פרטי לקוח) — reading-pane redesign contract guard.
 * ─────────────────────────────────────────────────────────────────────────────
 * The management modal's "כללי" panel (fee-agreements list + quick actions) was
 * restyled from the old heavy surface (.fee-agreement-* / .management-action-btn /
 * .management-section) to the calm reading-pane .gen-* line — DISPLAY ONLY.
 *
 * Every wired handler is class/id/data-* based and MUST survive the restyle byte-for-byte:
 *   - attachFeeAgreementActionListeners() reads `[data-action]` (view|delete) + `data-agreement-id`
 *     inside `#feeAgreementsList` → the agreement buttons keep BOTH attributes.
 *   - setupFeeAgreementListeners() wires the hidden `#uploadFeeAgreementBtn` + `#feeAgreementInput`;
 *     every "upload" affordance triggers it via `getElementById('uploadFeeAgreementBtn').click()`.
 *   - the modal-wide `[data-action]` → handleQuickAction() switch keeps the 4 values
 *     (add-service / renew-hours / change-status / close-case).
 *
 * These are SOURCE-level pins (readFileSync + assert), mirroring
 * modal-unification-management-contracts.test.ts. They fail the moment a later edit drops a
 * hook or re-introduces the old surface (delete-old-not-layer). The rendered-CSS "customer
 * scenario" proof is the Playwright render shown at PR time.
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const read = (rel: string): string => fs.readFileSync(path.resolve(ADMIN, rel), 'utf8');

const MGMT = read('js/ui/ClientManagementModal.js');
const HTML = read('clients.html');
const CSS = read('css/clients-modals.css');

// #cmGeneralDetail slice of clients.html (the panel this PR restyles).
const GENERAL_PANEL = (() => {
  const start = HTML.indexOf('id="cmGeneralDetail"');
  const end = HTML.indexOf('id="managementServicesList"');
  expect(start, '#cmGeneralDetail must exist').toBeGreaterThan(-1);
  expect(end, '#managementServicesList must follow it').toBeGreaterThan(start);
  return HTML.slice(start, end);
})();

// ── renderFeeAgreements — preserved handler contract (the crux) ───────────────
describe('general panel — renderFeeAgreements keeps every wired hook', () => {
  it('agreement action buttons keep BOTH data-action (view|delete) AND data-agreement-id', () => {
    expect(MGMT).toMatch(/data-action="view"\s+data-agreement-id="\$\{agreement\.id\}"/);
    expect(MGMT).toMatch(/data-action="delete"\s+data-agreement-id="\$\{agreement\.id\}"/);
  });

  it('every agreement row still carries data-agreement-id (delegation reads it)', () => {
    expect(MGMT).toMatch(/class="gen-agr"\s+data-agreement-id="\$\{agreement\.id\}"/);
  });

  it('the upload affordance (empty state + list) triggers the hidden #uploadFeeAgreementBtn', () => {
    const trigger = /onclick="document\.getElementById\('uploadFeeAgreementBtn'\)\.click\(\)"/g;
    const hits = MGMT.match(trigger) || [];
    // one in the empty state, one below the populated list.
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('the list still populates #feeAgreementsList and re-attaches the delegated listeners', () => {
    expect(MGMT).toContain("getElementById('feeAgreementsList')");
    expect(MGMT).toContain('this.attachFeeAgreementActionListeners();');
  });
});

// ── delete-old-not-layer — the old fee-agreement template is GONE ────────────
describe('general panel — the old heavy template is removed, not layered over', () => {
  it('ClientManagementModal.js no longer emits the old fee-agreement / empty-state classes', () => {
    for (const stale of ['fee-agreement-item', 'fee-agreement-add-btn', 'fee-agreements-empty', 'empty-state-btn']) {
      expect(MGMT, `stale class must be gone: ${stale}`).not.toContain(stale);
    }
  });

  it('ClientManagementModal.js emits the new .gen-* row markup', () => {
    for (const fresh of ['gen-agr', 'gen-agr-icon', 'gen-icon-btn', 'gen-empty', 'gen-upload']) {
      expect(MGMT, `new class expected: ${fresh}`).toContain(fresh);
    }
  });
});

// ── clients.html #cmGeneralDetail — ids + the 4 quick-action data-actions ─────
describe('general panel markup — preserved ids + quick-action contract', () => {
  it('keeps the 3 wired ids (hidden input + trigger + list container)', () => {
    for (const id of ['feeAgreementInput', 'uploadFeeAgreementBtn', 'feeAgreementsList']) {
      expect(GENERAL_PANEL, `id must survive: ${id}`).toContain(`id="${id}"`);
    }
  });

  it('keeps all 4 quick-action data-action values (handleQuickAction switch)', () => {
    for (const action of ['add-service', 'renew-hours', 'change-status', 'close-case']) {
      expect(GENERAL_PANEL, `data-action="${action}"`).toContain(`data-action="${action}"`);
    }
  });

  it('adopts the .gen-* layout and drops the old .management-* surface', () => {
    for (const fresh of ['gen-section', 'gen-label', 'gen-actions', 'gen-act']) {
      expect(GENERAL_PANEL, `new class expected: ${fresh}`).toContain(fresh);
    }
    for (const stale of ['management-section', 'management-action-btn', 'management-actions-grid']) {
      expect(GENERAL_PANEL, `stale class must be gone: ${stale}`).not.toContain(stale);
    }
  });
});

// ── clients-modals.css — new .gen-* rules, old rules removed, AA + a11y pins ──
describe('general panel CSS — reading-pane rules present, old blocks gone', () => {
  it('defines the new .gen-* rule blocks', () => {
    for (const sel of ['.gen-agr {', '.gen-icon-btn {', '.gen-upload {', '.gen-empty {', '.gen-act {']) {
      expect(CSS, `rule expected: ${sel}`).toContain(sel);
    }
  });

  it('removes the old fee-agreement / management-action / management-section rule blocks', () => {
    for (const sel of ['.fee-agreement-item {', '.fee-agreement-add-btn {', '.management-action-btn {', '.management-section {', '.management-actions-grid {']) {
      expect(CSS, `stale rule must be gone: ${sel}`).not.toContain(sel);
    }
  });

  it('WCAG AA: destructive uses --red-dark (4.83:1) and the primary uses --blue-dark (5.17:1) — never the failing --red/--blue as text', () => {
    expect(CSS).toMatch(/\.gen-act--primary\s*\{[^}]*background:\s*var\(--blue-dark\)/);
    expect(CSS).toMatch(/\.gen-act--danger:hover\s*\{[^}]*color:\s*var\(--red-dark\)/);
  });

  it('a11y: :focus-visible ring on every interactive .gen-* element', () => {
    for (const sel of ['.gen-icon-btn:focus-visible', '.gen-upload:focus-visible', '.gen-act:focus-visible']) {
      expect(CSS, `focus-visible expected: ${sel}`).toContain(sel);
    }
  });

  it('regression: @keyframes spin is preserved (still used by clients.css + AddPackageToStage)', () => {
    expect(CSS).toContain('@keyframes spin');
  });
});
