/**
 * Nav tab guard (H.6 PR3) — the "לקוחות ממתינים" tab is wired into the admin Navigation.
 *
 * PR2 shipped apps/admin-panel/pending-clients.html but the page was reachable only
 * by direct URL (Navigation.js renders a FIXED navItems array — a new page is
 * invisible until that array is edited). PR3 adds the one nav item. The render is
 * DOM/auth-gated (not unit-testable headless), so this is a static-scan guard that
 * the nav item exists + points to the right page + uses the canonical id the page
 * passes to Navigation.init('pending-clients') for active-state. Static scan (no
 * import -> no DOM/Firebase). Runs in CI via root Vitest.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

const ROOT = process.cwd();
const NAV = readFileSync(resolve(ROOT, 'apps/admin-panel/js/ui/Navigation.js'), 'utf8');
const PAGE = readFileSync(resolve(ROOT, 'apps/admin-panel/pending-clients.html'), 'utf8');

describe('Navigation — לקוחות ממתינים (pending-clients) nav tab (H.6 PR3)', () => {
  it("navItems includes a 'pending-clients' entry pointing to pending-clients.html", () => {
    const match = NAV.match(/\{[^}]*id:\s*'pending-clients'[^}]*\}/);
    expect(match, "a navItems entry with id:'pending-clients' must exist").not.toBeNull();
    const entry = match ? match[0] : '';
    expect(entry).toContain("href: 'pending-clients.html'");
    expect(entry).toContain("label: 'לקוחות ממתינים'");
  });

  it('the nav id matches the active-state id the page passes to Navigation.init', () => {
    // pending-clients.html calls Navigation.init('pending-clients') — the nav item
    // id MUST equal that string or the tab never shows active on the page.
    expect(PAGE).toContain("Navigation.init('pending-clients')");
    expect(NAV).toMatch(/id:\s*'pending-clients'/);
  });

  it('does not break the existing tabs (users/clients/workload/profitability/announcements still present)', () => {
    ['index.html', 'clients.html', 'workload.html', 'profitability.html', 'system-announcements.html'].forEach((href) => {
      expect(NAV).toContain("href: '" + href + "'");
    });
  });
});
