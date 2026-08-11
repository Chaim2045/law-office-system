/**
 * PR-SEC-C2 — stored XSS via the shared admin toast/confirm primitive.
 * ─────────────────────────────────────────────────────────────────────────────
 * `Notifications.js` (window.NotificationManager / window.notify) is the shared toast +
 * confirm layer. It interpolated `title`/`message` (toast) and `title`/`message`/button
 * labels (confirm) RAW into innerHTML. Reachability check (2026-08-11): the LIVE path is
 * `UserDetailsModal` delete-hour → `NotificationManager.confirm(…entry.action…)`, where
 * `entry.action` is written UNSANITIZED by `updateTimesheetEntry` (any active employee) →
 * a non-admin lawyer stores `<img onerror=…>` in a timesheet action, an admin clicks
 * "delete hour", and it executes in the admin session (non-admin→admin escalation).
 *
 * Fix: a SELF-CONTAINED 5-entity escapeHtml on the class (no window.escapeHtml load-order
 * dependency — this component loads on admin pages that may not load core/escape-html.js
 * first), applied at every sink. The confirm message preserves its intentional `\n→<br>`
 * by escaping FIRST, then converting. The backend `updateTimesheetEntry` sanitize (the root)
 * is a separate functions PR (C2b).
 *
 * Created: 2026-08-11 — fix/pr-sec-c2-notifications-xss
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../../../apps/admin-panel/js/ui/Notifications.js'),
  'utf8'
);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let inst: any;

const PAYLOAD = '<img src=x onerror="window.__C2_FIRED = true">';

beforeAll(async () => {
  // The NotificationManager constructor reads window.ADMIN_PANEL_CONSTANTS at construction —
  // stub it BEFORE the (dynamic) import so the IIFE can instantiate window.NotificationManager.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ADMIN_PANEL_CONSTANTS = {
    NOTIFICATIONS: { MAX_SIMULTANEOUS: 5, DEFAULT_DURATION_MS: 3000 }
  };
  // @ts-ignore — classic admin-panel IIFE; registers window.NotificationManager
  await import('../../../apps/admin-panel/js/ui/Notifications.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inst = (window as any).NotificationManager;
});

beforeEach(() => {
  document.body.innerHTML = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__C2_FIRED = false;
});

describe('PR-SEC-C2 — toast escapes title + message', () => {
  it('createNotificationHTML escapes a malicious title + message (renders inert)', () => {
    const html: string = inst.createNotificationHTML({
      type: 'error', id: 'n1', title: PAYLOAD, message: PAYLOAD, closeable: true
    });
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
    const div = document.createElement('div');
    div.innerHTML = html;
    expect(div.querySelector('img'), 'no live <img> from title/message').toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).__C2_FIRED).toBe(false);
  });
});

describe('PR-SEC-C2 — confirm escapes title + message + buttons; preserves \\n→<br>', () => {
  it('a malicious confirm message/title/buttons render inert (no live <img>)', () => {
    inst.confirm(PAYLOAD, () => {}, () => {}, { title: PAYLOAD, confirmText: PAYLOAD, cancelText: PAYLOAD });
    expect(document.body.querySelector('.confirm-dialog'), 'dialog rendered').toBeTruthy();
    expect(document.body.querySelector('img'), 'no live <img> anywhere in the dialog').toBeNull();
    const msg = document.body.querySelector('.confirm-message') as HTMLElement;
    expect(msg.innerHTML).toContain('&lt;img');
    expect(msg.innerHTML).not.toContain('<img');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).__C2_FIRED).toBe(false);
  });

  it('preserves the intentional \\n→<br> formatting (escape-first-then-convert)', () => {
    inst.confirm('שורה ראשונה\nשורה שנייה', () => {}, () => {});
    const msg = document.body.querySelector('.confirm-message') as HTMLElement;
    expect(msg.querySelectorAll('br').length, 'the newline became a real <br>').toBe(1);
    expect(msg.textContent).toContain('שורה ראשונה');
    expect(msg.textContent).toContain('שורה שנייה');
  });

  it('a payload that also contains a newline is escaped while the <br> is preserved', () => {
    inst.confirm('<img onerror=alert(1)>\nהמשך', () => {}, () => {});
    const msg = document.body.querySelector('.confirm-message') as HTMLElement;
    expect(msg.innerHTML).toContain('&lt;img');
    expect(msg.innerHTML).not.toContain('<img');
    expect(msg.querySelectorAll('br').length).toBe(1);
  });
});

describe('PR-SEC-C2 — source lock', () => {
  it('a SELF-CONTAINED 5-entity escapeHtml is defined (no window.escapeHtml dependency)', () => {
    expect(SRC).toContain('escapeHtml(text)');
    expect(SRC).toContain("'&': '&amp;'");
    expect(SRC).toContain("'<': '&lt;'");
    expect(SRC).toMatch(/replace\(\/\[&<>"'\]\/g/);
    expect(SRC, 'the local escaper must not CALL window.escapeHtml (load-order safety)').not.toMatch(/window\.escapeHtml\s*\(/);
  });

  it('every toast + confirm sink routes through this.escapeHtml', () => {
    expect(SRC).toContain('${this.escapeHtml(config.title)}');
    expect(SRC).toContain('${this.escapeHtml(config.message)}');
    expect(SRC, 'confirm message escaped BEFORE the <br> conversion').toContain('this.escapeHtml(message).replace');
    expect(SRC).toContain('${this.escapeHtml(config.confirmText)}');
    expect(SRC).toContain('${this.escapeHtml(config.cancelText)}');
    expect(SRC, 'toast type class escaped — no attribute breakout (devils GO hardening)')
      .toContain('notification-${this.escapeHtml(config.type)}');
  });
});
