/**
 * Unit Tests — ClientsTable pending_signature status badge (H.6.c-2)
 * ─────────────────────────────────────────────────────────────────────────────
 * getStatusBadge(client) must render a DISTINCT "ממתין לחתימה" badge for a
 * pending_signature client — and that lifecycle status must WIN over the derived
 * hours flags (a 0-service pending client can have isBlocked=true, but "חסום
 * (אין שעות)" is the wrong story). Also confirms the pre-existing statuses are
 * untouched (no regression in the badge chain).
 */
import { describe, it, expect, beforeAll } from 'vitest';

// escape-html SSOT must be on window before ClientsTable's escapeHtml is exercised.
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/core/escape-html.js';
// @ts-ignore — IIFE registers window.ClientsTable
import '../../../apps/admin-panel/js/ui/ClientsTable.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (globalThis as any).window.ClientsTable ?? (globalThis as any).ClientsTable;

describe('ClientsTable.getStatusBadge — pending_signature (H.6.c-2)', () => {
  beforeAll(() => {
    expect(table).toBeTruthy();
    expect(typeof table.getStatusBadge).toBe('function');
  });

  it('renders a distinct "ממתין לחתימה" badge for a pending_signature client', () => {
    const html = table.getStatusBadge({ status: 'pending_signature' });
    expect(html).toContain('ממתין לחתימה');
    expect(html).toContain('status-badge');
    expect(html).toContain('fa-hourglass-half');
    // NOT the default active / blocked story — the visible badge text is the
    // pending label, not "פעיל"/"חסום" (guard the status-badge class, since the
    // title copy legitimately contains the word "פעיל" — "טרם פעיל").
    expect(html).toContain('status-badge warning');
    expect(html).not.toContain('status-badge active');
    expect(html).not.toContain('חסום');
  });

  it('pending_signature WINS over derived isBlocked (0-service pending client)', () => {
    // a pending client with activeServices:0 → isBlocked can be true
    const html = table.getStatusBadge({ status: 'pending_signature', isBlocked: true });
    expect(html).toContain('ממתין לחתימה');
    expect(html).not.toContain('חסום (אין שעות)');
  });

  it('does NOT change the default "פעיל" badge for an ordinary active client', () => {
    const html = table.getStatusBadge({ status: 'active' });
    expect(html).toContain('פעיל');
    expect(html).not.toContain('ממתין לחתימה');
  });

  it('does NOT change the "חסום" badge for a real blocked client (no regression)', () => {
    const html = table.getStatusBadge({ status: 'active', isBlocked: true });
    expect(html).toContain('חסום');
    expect(html).not.toContain('ממתין לחתימה');
  });

  it('does NOT change the "מוקפא ידנית" badge for an on-hold client', () => {
    const html = table.getStatusBadge({ status: 'active', isOnHold: true });
    expect(html).toContain('מוקפא ידנית');
    expect(html).not.toContain('ממתין לחתימה');
  });
});
