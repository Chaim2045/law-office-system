/**
 * H.8.0 follow-up (PR2) — admin↔employee user_messages messaging DECOMMISSIONED
 * ─────────────────────────────────────────────────────────────────────────────
 * PR1/PR1b (#412) retired the user-app dead bell. PR2 removes the admin-panel half
 * of the obsolete admin↔employee messaging built on the `user_messages` collection:
 * the sender stack (AlertCommunicationManager + AdminThreadView + QuickMessageDialog
 * + MessagesFullscreenModal + message-categories), the admin notification bell
 * (loaded-but-invisible listener), the UserDetailsModal messaging slice, and the
 * UsersTable "הודעות" column. This removes every CLIENT-side reader/writer of
 * `user_messages` (the backend getUserFullDetails read + the dead WhatsApp writes +
 * the firestore.rules block are PR3/PR4). This guard locks the removal.
 *
 * KEPT (NOT this feature): UserAlertsPanel.js (a dead, never-instantiated alerts
 * panel whose guarded `window.quickMessageDialog` ref degrades by design — its
 * whole-component fate is a separate decision).
 *
 * Created: 2026-06-30 — chore/retire-messaging-admin-decommission
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const read = (rel: string): string => fs.readFileSync(path.resolve(ADMIN, rel), 'utf8');
const exists = (rel: string): boolean => fs.existsSync(path.resolve(ADMIN, rel));

describe('PR2 — the admin messaging stack files are deleted', () => {
  const deleted = [
    'js/managers/AlertCommunicationManager.js',
    'js/ui/AdminThreadView.js',
    'js/ui/QuickMessageDialog.js',
    'js/ui/MessagesFullscreenModal.js',
    'js/config/message-categories.js',
    'css/admin-thread-view.css',
    'css/message-categories.css',
    'js/modules/notification-bell.js'
  ];

  it.each(deleted)('removed: %s', (rel) => {
    expect(exists(rel), `${rel} must be deleted (admin messaging stack)`).toBe(false);
  });
});

describe('PR2 — index.html is unwired (no messaging loads / init), UserAlertsPanel kept', () => {
  const html = read('index.html');

  it.each([
    'AlertCommunicationManager.js',
    'AdminThreadView.js',
    'QuickMessageDialog.js',
    'MessagesFullscreenModal.js',
    'config/message-categories.js',
    'admin-thread-view.css',
    'message-categories.css',
    'modules/notification-bell.js'
  ])('no longer loads %s', (frag) => {
    expect(html, `index.html still references ${frag}`).not.toContain(frag);
  });

  it('the AlertCommunicationManager init block is gone', () => {
    expect(html).not.toContain('new window.AlertCommunicationManager');
    expect(html).not.toContain('alertCommManager');
  });

  it('the NotificationBell presence-check + global are gone', () => {
    expect(html).not.toContain('window.notificationBell');
  });

  it('KEEPS the unrelated UserAlertsPanel.js load (separate dead-component decision)', () => {
    expect(html).toContain('js/ui/UserAlertsPanel.js');
  });
});

describe('PR2 — UserDetailsModal messaging slice removed, the 6 tabs kept', () => {
  const src = read('js/ui/UserDetailsModal.js');

  it.each([
    'alertCommManager', 'adminThreadView', 'messagesFullscreenModal', 'quickMessageDialog',
    'user_messages', 'threadListener', 'messageFilter', 'SYSTEM_MESSAGE_TYPES',
    'renderCommunicationSection', 'renderMessagesTab', 'sendNewMessage', 'archiveMessage',
    'restoreMessage', 'openThread', 'findActiveThread', 'startThreadListener',
    'userData.messages', 'btn-send-first-message', 'btn-view-thread'
  ])('no longer contains %s', (sym) => {
    expect(src, `UserDetailsModal still contains ${sym}`).not.toContain(sym);
  });

  it('the loadFromFirestore Promise.all is re-indexed to 4 elements (no messagesSnapshot)', () => {
    expect(src).toContain('const [clientsSnapshot, tasksSnapshot, timesheetSnapshot, activitySnapshot] = await Promise.all([');
    expect(src, 'messagesSnapshot destructure must be gone').not.toContain('messagesSnapshot');
  });

  it('the 6 non-messaging tab renderers + shared helpers survive', () => {
    for (const m of ['renderGeneralTab', 'renderClientsTab', 'renderTasksTab', 'renderHoursTab', 'renderActivityTab', 'renderPerformanceTab', 'escapeHtml', 'renderInfoRow', 'renderStatCard']) {
      expect(src, `${m} must remain`).toContain(m);
    }
  });
});

describe('PR2 — UsersTable "הודעות" column + response-counts removed', () => {
  const src = read('js/ui/UsersTable.js');

  it.each(['alertCommManager', 'loadResponseCounts', 'responseCounts', 'renderMessageBadge', 'handleMessageBadgeClick', 'user-messages-badge-cell', 'user-message-badge'])(
    'no longer contains %s', (sym) => {
      expect(src, `UsersTable still contains ${sym}`).not.toContain(sym);
    }
  );

  it('the "הודעות" column entry is gone (actions column still present)', () => {
    expect(src).not.toContain("{ key: 'messages', title: 'הודעות'");
    expect(src, 'other columns must survive').toContain("{ key: 'actions'");
  });
});

describe('PR2 — auth.js notification-bell wiring removed', () => {
  const src = read('js/core/auth.js');
  it('no startListeningToAdminMessages / notificationBell wiring', () => {
    expect(src).not.toContain('startListeningToAdminMessages');
    expect(src).not.toContain('notificationBell');
  });
});
