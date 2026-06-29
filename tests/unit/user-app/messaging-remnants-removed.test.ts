/**
 * H.8.0 follow-up (PR1) — user-app peripheral notification-bell remnants REMOVED
 * ─────────────────────────────────────────────────────────────────────────────
 * #411 deleted the user-app OpenAI-chat + bell stack but intentionally LEFT the
 * peripheral GUARDED consumer hooks (navigation.js / client-validation.js /
 * client-hours.js / main.js globals / index.html markup+helper) as a tracked
 * follow-up — see openai-chat-removed.test.ts lines 13-16.
 *
 * After #411 `window.notificationBell` is defined NOWHERE in the user-app
 * (notification-bell.js deleted; the ui-components NotificationBellSystem class is
 * exported-but-never-instantiated), so every `if (window.notificationBell)` guard
 * is permanently false and the `#notificationsDropdown` markup is orphaned. PR1
 * removes those provably-dead remnants. This guard locks the removal so it can't
 * silently regress.
 *
 * STILL OUT OF SCOPE here (later PRs / tracked): the ui-components
 * NotificationBellSystem dead class + the smart-faq-bot/virtual-assistant guarded
 * no-ops (PR1b), and the CROSS-APP admin-side decommission + rules (PR2-4).
 *
 * Created: 2026-06-29 — chore/retire-messaging-crossapp-remnants
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const UA = path.resolve(__dirname, '../../../apps/user-app');
const read = (rel: string): string => fs.readFileSync(path.resolve(UA, rel), 'utf8');

describe('PR1 — the dead notificationBell feeders/wiring are removed', () => {
  it('navigation.js drops toggleNotifications / clearAllNotifications and the bell ref', () => {
    const src = read('js/modules/navigation.js');
    expect(src, 'toggleNotifications fn must be gone').not.toContain('function toggleNotifications');
    expect(src, 'clearAllNotifications fn must be gone').not.toContain('function clearAllNotifications');
    expect(src, 'no notificationBell reference').not.toContain('notificationBell');
  });

  it('client-validation.js drops the dead updateNotificationBell method + bell ref', () => {
    const src = read('js/modules/client-validation.js');
    expect(src, 'updateNotificationBell method must be gone').not.toContain('updateNotificationBell');
    expect(src, 'no notificationBell reference').not.toContain('notificationBell');
  });

  it('client-hours.js drops the dead updateNotificationBell method + bare bell ref', () => {
    const src = read('js/modules/client-hours.js');
    expect(src, 'updateNotificationBell method must be gone').not.toContain('updateNotificationBell');
    expect(src, 'no notificationBell reference').not.toContain('notificationBell');
  });

  it('main.js no longer exposes the removed notification globals', () => {
    const src = read('js/main.js');
    expect(src, 'window.toggleNotifications must be gone').not.toContain('window.toggleNotifications');
    expect(src, 'window.clearAllNotifications must be gone').not.toContain('window.clearAllNotifications');
  });
});

describe('PR1 — the orphaned dropdown markup is removed, the login-flag wrapper kept', () => {
  const html = read('index.html');

  it('the #notificationsDropdown / #notificationsContent markup is gone', () => {
    expect(html, 'notificationsDropdown markup must be gone').not.toContain('notificationsDropdown');
    expect(html, 'notificationsContent markup must be gone').not.toContain('notificationsContent');
    expect(html, 'clear-all button markup must be gone').not.toContain('clear-all-btn');
  });

  it('the inline clearAllNotifications fallback helper is gone', () => {
    expect(html, 'inline clearAllNotifications helper must be gone').not.toContain('function clearAllNotifications');
  });

  it('the load-bearing #interfaceElements wrapper (login-visibility flag) is PRESERVED', () => {
    // main.js isInApp + authentication.js login/logout toggle this element's `hidden`
    // class — it must survive the dropdown removal as an (empty) flag element.
    expect(html, '#interfaceElements must still exist').toContain('id="interfaceElements"');
  });
});
