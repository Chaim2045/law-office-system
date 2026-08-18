/**
 * PII source-guard (H.3 PR2) — an employee cost value must never escape the client.
 *
 * `logger.js`'s production override nulls only console.log/info/debug;
 * console.error / warn / group / trace / dir / table SURVIVE in production. The
 * repo is PUBLIC and an employee's cost-per-hour is sensitive financial PII
 * (MASTER_PLAN §7.6). This static scan asserts that EmployeeCostsPage.js:
 *   (1) never passes a cost value (costPerHour / the getEmployeeCost response /
 *       the raw cost-input value) to console.* / Logger.*, and
 *   (2) never writes a cost value to localStorage / sessionStorage / a URL.
 *
 * Mirrors the frontend ת"ז guard tests/unit/user-app/idnumber-pii-guard.test.ts
 * (same harness, same location convention, same root-Vitest runner).
 * Static scan (no import → no DOM/Firebase needed). Runs in CI via root Vitest.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

/** Remove block + line comments so a comment that merely mentions costPerHour
 *  doesn't trip the guard (the `[^:]` before // keeps `://` URLs intact). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// Matches a cost-VALUE identifier reference (the leak surface), NOT a log-string
// word. The realistic leak vectors in this file are the SINGULAR value
// identifiers `costPerHour`, `currentCost`, and the local `cost` var
// (e.g. `${costPerHour}` · `, data.costPerHour` · `, currentCost` · `(cost)`).
//
// The page also legitimately logs the PLURAL page name (`'Employee Costs Page'`,
// `'EmployeeCostsPage: ...'`) which carries NO value. The discriminator: the
// value identifiers are a SINGULAR `cost`/`Cost` NOT followed by an `s` (so
// `Costs`/`EmployeeCosts` are excluded), and immediately followed by an
// identifier boundary or `PerHour`/an uppercase continuation. `[Cc]ost(?![s])`
// + the `(?=[A-Z(),. \t\]}]|PerHour|$)` lookahead matches `cost`, `Cost` (in
// `currentCost`), `costPerHour`, but never the plural string word.
const COST_REF = /[Cc]ost(?!s)(?=PerHour|[A-Z(),.\s\]}]|$)/;
const LOG_WITH_COST =
  new RegExp('(?:console\\.\\w+|[Ll]ogger\\.\\w+)\\s*\\([^;]*' + COST_REF.source);

// A storage / URL write whose value span references a cost identifier — the
// cost must never be persisted client-side or put into a query string.
const STORAGE_WITH_COST =
  new RegExp('(?:localStorage|sessionStorage)\\.setItem\\s*\\([^;]*' + COST_REF.source);
const URL_WITH_COST =
  new RegExp(
    '(?:searchParams\\.(?:set|append)|location\\.(?:href|hash|search)\\s*=)\\s*[^;]*' + COST_REF.source
  );

const ROOT = process.cwd();
const PAGE = resolve(ROOT, 'apps/admin-panel/js/ui/EmployeeCostsPage.js');

describe('no employee cost value escapes the client — static source guard', () => {
  const code = stripComments(readFileSync(PAGE, 'utf8'));

  it('EmployeeCostsPage.js never passes a cost value to console.*/Logger.*', () => {
    expect(code).not.toMatch(LOG_WITH_COST);
  });

  it('EmployeeCostsPage.js never writes a cost value to localStorage/sessionStorage', () => {
    expect(code).not.toMatch(STORAGE_WITH_COST);
  });

  it('EmployeeCostsPage.js never writes a cost value to a URL', () => {
    expect(code).not.toMatch(URL_WITH_COST);
  });

  it('sanity: the guard regexes DO catch violating patterns', () => {
    expect('console.log(`cost ${costPerHour}`);').toMatch(LOG_WITH_COST);
    expect('console.error("save failed", data.costPerHour);').toMatch(LOG_WITH_COST);
    expect('Logger.warn("x", currentCost);').toMatch(LOG_WITH_COST);
    expect('console.log(cost);').toMatch(LOG_WITH_COST);
    expect("localStorage.setItem('lastCost', costPerHour);").toMatch(STORAGE_WITH_COST);
    expect("sessionStorage.setItem('cost', cost);").toMatch(STORAGE_WITH_COST);
    expect('url.searchParams.set("cost", costPerHour);').toMatch(URL_WITH_COST);
  });

  it('sanity: the guard does NOT flag a capitalized log STRING word "Costs"', () => {
    // The file legitimately logs `'✅ Employee Costs Page loaded'` and
    // `'EmployeeCostsPage: ...'` — neither references a cost VALUE, so the
    // guard must not trip on the page name. This proves the regex distinguishes
    // a code reference from a plain string word.
    expect("console.log('✅ Employee Costs Page loaded');").not.toMatch(LOG_WITH_COST);
    expect("console.error('EmployeeCostsPage: container not found:', sectionId);").not.toMatch(LOG_WITH_COST);
  });
});
