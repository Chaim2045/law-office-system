/**
 * H.8.0 — user-app OpenAI chat + dormant admin↔user messaging stack REMOVED
 * ─────────────────────────────────────────────────────────────────────────────
 * A client-side OpenAI chat (`apps/user-app/js/modules/ai-system/`) shipped a
 * browser-held OpenAI API key + a "paste sk-proj-… into source" setup doc — a
 * latent data-egress liability. It was dormant (gated behind an empty key), and a
 * PROD check found its bundled admin↔user messaging feature was used 3 times in
 * Dec-2025 and abandoned (0 traffic since). Haim approved deleting the whole
 * dormant user-app stack. This guard locks the removal so it can't silently
 * regress, and proves the active wiring (authentication.js / main.js / index.html)
 * was unwired cleanly.
 *
 * The CROSS-APP remnants (admin-panel sender, the WhatsApp CF `task_approval`
 * write, the `user_messages` rules) + the peripheral GUARDED consumer hooks
 * (navigation.js / client-validation.js / index.html helper) are intentionally
 * OUT OF SCOPE here (tracked follow-up) — this test does NOT assert on those.
 *
 * Created: 2026-06-29 — chore/retire-userapp-openai-chat
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const UA = path.resolve(__dirname, '../../../apps/user-app');
const read = (rel: string): string => fs.readFileSync(path.resolve(UA, rel), 'utf8');
const exists = (rel: string): boolean => fs.existsSync(path.resolve(UA, rel));

describe('H.8.0 — the OpenAI chat + messaging stack files are deleted', () => {
  const deleted = [
    'js/modules/ai-system/ai-config.js',
    'js/modules/ai-system/ai-engine.js',
    'js/modules/ai-system/ai-context-builder.js',
    'js/modules/ai-system/ai-chat-ui.js',
    'js/modules/ai-system/ThreadView.js',
    'js/modules/ai-system/ai-chat.css',
    'js/modules/ai-system/README.md',
    'js/modules/ai-system/SETUP-INSTRUCTIONS.md',
    'js/modules/notification-bell.js',
    'js/modules/UserReplyModal.js',
    'js/modules/notification-realtime-bridge.js',
    'js/config/message-categories.js',
    'css/thread-view.css'
  ];

  it.each(deleted)('removed: %s', (rel) => {
    expect(exists(rel), `${rel} must be deleted (OpenAI/messaging stack)`).toBe(false);
  });

  it('the whole ai-system directory is gone', () => {
    expect(exists('js/modules/ai-system')).toBe(false);
  });
});

describe('H.8.0 — the active wiring is unwired (no dangling loader/refs)', () => {
  it('authentication.js no longer defines or exports the AI-chat lazy loader', () => {
    const src = read('js/modules/authentication.js');
    expect(src, 'initAIChatSystem loader must be gone').not.toContain('initAIChatSystem');
    expect(src, 'no reference to the deleted ai-system path').not.toContain('ai-system/');
    expect(src, 'no NotificationBell instantiation').not.toContain('NotificationBellSystem');
  });

  it('main.js no longer references the deleted bell/chat globals', () => {
    const src = read('js/main.js');
    expect(src, 'no instance field for the deleted bell').not.toContain('this.notificationBell');
    expect(src, 'no AI chat UI global').not.toContain('window.aiChat');
    expect(src, 'no AI chat class global').not.toContain('window.AIChatUI');
    expect(src, 'no global bell expose').not.toContain('window.notificationBell = manager');
    expect(src, 'AI-chat wrapper method removed').not.toContain('initAIChatSystem');
  });

  it('main.js renamed the bell auth-listener to the services listener (ticker/popup kept)', () => {
    const src = read('js/main.js');
    expect(src, 'old bell-named method must be gone').not.toContain('setupNotificationBellListener');
    expect(src, 'renamed services listener present').toContain('setupServicesAuthListener');
    // the announcement ticker/popup the method now solely serves must remain wired
    expect(src).toContain('announcementTicker');
  });

  it('index.html no longer links the deleted chat/thread stylesheets', () => {
    const src = read('index.html');
    expect(src, 'ai-chat.css link removed').not.toContain('ai-system/ai-chat.css');
    expect(src, 'thread-view.css link removed').not.toContain('thread-view.css');
  });
});
