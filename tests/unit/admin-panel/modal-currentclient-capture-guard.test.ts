/**
 * Source-level guard — ClientManagementModal sub-dialog clientId capture
 * ─────────────────────────────────────────────────────────────────────────────
 * BUG (reproduced in DEV 2026-07-26): the package purchase-date pencil
 * (`_editPackagePurchaseDate`) and the "חדש שעות" add-hours dialog
 * (`renewServiceHours` → `_submitRenewHours`) both open a `window.ModalManager`
 * sub-dialog and then read `this.currentClient.id` at SUBMIT time. Opening the
 * sub-dialog can trigger the parent ClientManagementModal's own Esc/backdrop
 * `close()` (unscoped document/backdrop listeners), which sets
 * `this.currentClient = null` — so the submit threw
 * `TypeError: Cannot read properties of null (reading 'id')`.
 *
 * FIX: capture `const clientId = this.currentClient?.id` at the TOP of each
 * function (while the parent modal is guaranteed open), thread it through, and
 * guard the in-memory success-path update with `this.currentClient.id === clientId`.
 *
 * WHY a SOURCE-LEVEL guard (repo precedent — see
 * escapehtml-ssot-pr2-routing.test.ts): `window.ClientManagementModal` is a
 * heavyweight UI manager that SELF-INSTANTIATES at load with Firebase/DOM deps
 * (`window.ClientManagementModal = new ClientManagementModal()` at file end), so
 * a per-manager behavioral (DOM) test is impractical. This guard fails against the
 * pre-fix source (which read `clientId: this.currentClient.id` at submit) and
 * catches a regression that reverts the capture.
 *
 * Created: 2026-07-26 — fix/modal-currentclient-null
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../../../apps/admin-panel/js/ui/ClientManagementModal.js'),
  'utf8'
);

/**
 * Extract a single class method body by its `async <name>(` anchor, up to the
 * next 8-space-indented `async ` method (this file's method indentation).
 */
function methodBody(name: string): string {
  const start = SRC.indexOf(`        async ${name}(`);
  expect(start, `method ${name} not found`).toBeGreaterThan(-1);
  const rest = SRC.slice(start + 1);
  const nextIdx = rest.indexOf('\n        async ');
  return nextIdx === -1 ? rest : rest.slice(0, nextIdx);
}

describe('ClientManagementModal — sub-dialog clientId is captured before the ModalManager dialog opens', () => {
  const editBody = methodBody('_editPackagePurchaseDate');
  const renewBody = methodBody('renewServiceHours');
  const submitBody = methodBody('_submitRenewHours');

  it('_editPackagePurchaseDate captures clientId up front and uses the captured local in the callable payload', () => {
    expect(editBody).toContain('const clientId = this.currentClient?.id;');
    // The updatePackagePurchaseDate payload must use the captured local, NOT a live read.
    expect(editBody).toContain('clientId: clientId,');
    expect(editBody).not.toContain('clientId: this.currentClient.id');
    // Success-path in-memory update is guarded against a nulled/switched currentClient.
    expect(editBody).toContain('this.currentClient && this.currentClient.id === clientId');
  });

  it('renewServiceHours captures clientId up front and threads it into _submitRenewHours', () => {
    expect(renewBody).toContain('const clientId = this.currentClient?.id;');
    expect(renewBody).toContain('this._submitRenewHours(modalId, service, clientId)');
  });

  it('_submitRenewHours takes clientId as a param and uses it in the addPackageToService payload', () => {
    expect(SRC).toContain('async _submitRenewHours(modalId, service, clientId)');
    expect(submitBody).toContain('clientId: clientId,');
    expect(submitBody).not.toContain('clientId: this.currentClient.id');
    // Success-path in-memory update is guarded against a nulled/switched currentClient.
    expect(submitBody).toContain('this.currentClient && this.currentClient.id === clientId');
  });
});
