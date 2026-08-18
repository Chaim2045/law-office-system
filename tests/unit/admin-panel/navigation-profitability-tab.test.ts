/**
 * Nav tab guard (H.3 PR5) — the רווחיות tab is wired into the admin Navigation.
 *
 * PR4 shipped apps/admin-panel/profitability.html but the page was reachable only
 * by direct URL (Navigation.js renders a FIXED navItems array — a new page is
 * invisible until that array is edited). PR5 adds the one nav item. The render is
 * DOM/auth-gated (not unit-testable headless), so this is a static-scan guard that
 * the nav item exists + points to the right page + uses the canonical id the page
 * passes to Navigation.init('profitability') for active-state. Static scan (no
 * import → no DOM/Firebase). Runs in CI via root Vitest.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

const ROOT = process.cwd();
const NAV = readFileSync(resolve(ROOT, 'apps/admin-panel/js/ui/Navigation.js'), 'utf8');
const PAGE = readFileSync(resolve(ROOT, 'apps/admin-panel/profitability.html'), 'utf8');

describe('Navigation — רווחיות (profitability) nav tab (H.3 PR5)', () => {
  it("navItems includes a 'profitability' entry pointing to profitability.html", () => {
    // Find the profitability navItems object and assert its href + label.
    const match = NAV.match(/\{[^}]*id:\s*'profitability'[^}]*\}/);
    expect(match, "a navItems entry with id:'profitability' must exist").not.toBeNull();
    const entry = match ? match[0] : '';
    expect(entry).toContain("href: 'profitability.html'");
    expect(entry).toContain("label: 'רווחיות'");
  });

  it('the nav id matches the active-state id the page passes to Navigation.init', () => {
    // profitability.html calls Navigation.init('profitability') — the nav item id
    // MUST equal that string or the tab never shows active on the page.
    expect(PAGE).toContain("Navigation.init('profitability')");
    expect(NAV).toMatch(/id:\s*'profitability'/);
  });

  it('does not break the existing tabs (users/clients/workload/announcements still present)', () => {
    ['index.html', 'clients.html', 'workload.html', 'system-announcements.html'].forEach((href) => {
      expect(NAV).toContain("href: '" + href + "'");
    });
  });
});
