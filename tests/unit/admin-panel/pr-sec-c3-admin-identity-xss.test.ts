/**
 * PR-SEC-C3 — defense-in-depth: escape admin identity/activity sinks.
 * ─────────────────────────────────────────────────────────────────────────────
 * Reachability check (2026-08-11): the profile-field sinks in the admin user views are
 * admin→admin at most (firestore.rules blocks non-admins from writing displayName/username/
 * photoURL; activity_log is <>-sanitized at write). The one genuinely stored-XSS-capable sink
 * is `user.username` (rendered raw, stored UNSANITIZED). This PR escapes ALL of them at the
 * sink — the durable control (the write-side sanitize is a fragile single point):
 *   - UserDetailsModal: username (:502 caller), avatar photoURL+displayName (renderUserAvatar),
 *     activity actionText + the formatActivityDetails label/value.
 *   - UsersTable: avatar photoURL+displayName (renderAvatar).
 *   - DeleteDataSidePanel: the delete-panel header displayName.
 *
 * These are large admin classes with constructor dependencies, so — per the house pattern
 * (client-case-selector-pending-guard) — this suite is a SOURCE LOCK (every sink routes
 * through this.escapeHtml; no raw interpolation survives) + a BEHAVIORAL MIRROR proving the
 * avatar (attribute-context) and activity-detail (text-context) patterns render inert.
 *
 * Created: 2026-08-11 — fix/pr-sec-c3-admin-identity-xss
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeAll } from 'vitest';

const DIR = path.resolve(__dirname, '../../../apps/admin-panel/js/ui');
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('PR-SEC-C3 — source lock: every admin identity/activity sink is escaped', () => {
  let udm: string;
  let ut: string;
  let ddp: string;
  beforeAll(() => {
    udm = stripComments(fs.readFileSync(path.join(DIR, 'UserDetailsModal.js'), 'utf8'));
    ut = stripComments(fs.readFileSync(path.join(DIR, 'UsersTable.js'), 'utf8'));
    ddp = stripComments(fs.readFileSync(path.join(DIR, 'DeleteDataSidePanel.js'), 'utf8'));
  });

  it('UserDetailsModal: username escaped at the caller', () => {
    expect(udm).toContain("this.renderInfoRow('שם משתמש', this.escapeHtml(user.username");
  });

  it('UserDetailsModal + UsersTable: avatar src + alt escaped (no raw photoURL/displayName)', () => {
    for (const src of [udm, ut]) {
      expect(src).toContain('src="${this.escapeHtml(user.photoURL)}" alt="${this.escapeHtml(user.displayName)}"');
      expect(src, 'no raw photoURL in an <img src>').not.toMatch(/src="\$\{user\.photoURL\}"/);
      expect(src, 'no raw displayName in an <img alt>').not.toMatch(/alt="\$\{user\.displayName\}"/);
    }
  });

  it('UserDetailsModal: activity actionText + detail label/value escaped', () => {
    expect(udm).toContain('${this.escapeHtml(actionText)}');
    expect(udm).toContain('this.escapeHtml(label)}: ${this.escapeHtml(displayValue)}');
    expect(udm, 'no raw actionText render').not.toMatch(/activity-text">\$\{actionText\}/);
  });

  // devils-advocate GO-WITH-CHANGES findings, applied: the modal TITLE and the internal-branch
  // clientName rendered the SAME displayName/clientName raw (siblings of already-escaped sinks).
  it('UserDetailsModal: modal title displayName + internal-branch clientName escaped', () => {
    expect(udm, 'modal title displayName escaped').toContain('פרטי משתמש: ${this.escapeHtml(user.displayName || user.email)}');
    expect(udm, 'internal-badge clientName escaped').toContain('internal-badge"><i class="fas fa-building"></i> ${this.escapeHtml(clientName)}');
    expect(udm, 'no raw displayName in the modal title').not.toMatch(/פרטי משתמש: \$\{user\.displayName/);
    expect(udm, 'no raw clientName in the internal badge').not.toMatch(/internal-badge[^`]*\$\{clientName\}/);
  });

  it('DeleteDataSidePanel: header displayName escaped', () => {
    expect(ddp).toContain('מחיקת נתונים: ${this.escapeHtml(displayName)}');
    expect(ddp, 'no raw displayName in the header').not.toMatch(/מחיקת נתונים: \$\{displayName\}/);
  });

  it('all three files expose a this.escapeHtml escaper', () => {
    for (const src of [udm, ut, ddp]) {
      expect(src).toContain('escapeHtml(text)');
    }
  });
});

// Behavioral mirror — the avatar (attribute) + activity-detail (text) render patterns are inert
// once escaped, for a value that tries to break out.
describe('PR-SEC-C3 — escaped identity patterns render inert', () => {
  const escapeHtml = (text: unknown): string => {
    if (text === null || text === undefined) {
return '';
}
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
  };

  it('a displayName that tries to break out of the alt attribute is inert', () => {
    const displayName = '"><img src=x onerror="window.__C3=1">';
    const html = `<img src="${escapeHtml('x')}" alt="${escapeHtml(displayName)}" class="user-avatar">`;
    const div = document.createElement('div');
    div.innerHTML = html;
    // exactly ONE img (the avatar) — the payload did not spawn a second one
    expect(div.querySelectorAll('img').length).toBe(1);
    expect(div.querySelector('img')!.getAttribute('onerror'), 'no onerror leaked').toBeNull();
  });

  it('a malicious activity clientName renders as inert text', () => {
    const clientName = '<img src=x onerror=alert(1)>';
    const detail = `${escapeHtml('לקוח')}: ${escapeHtml(clientName)}`;
    const div = document.createElement('div');
    div.innerHTML = `<div class="activity-details">${detail}</div>`;
    expect(div.querySelector('img')).toBeNull();
    expect(div.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
