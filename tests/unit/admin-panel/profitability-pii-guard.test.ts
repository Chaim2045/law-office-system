/**
 * PII source-guard (H.3 PR4) — a cost/profit value must never escape the client.
 *
 * `logger.js`'s production override nulls only console.log/info/debug;
 * console.error / warn SURVIVE in production. The repo is PUBLIC and a case's
 * actualCost / projectedProfit / paidRevenue is §7.6-confidential (a single-
 * employee case's actualCost÷actualHours = that employee's exact cost rate).
 * This static scan asserts the dashboard JS:
 *   (1) never passes a cost/profit VALUE (actualCost / projectedProfit /
 *       paidRevenue) to console.* / Logger.*, and
 *   (2) never writes one to localStorage / sessionStorage / a URL.
 *
 * Mirrors tests/unit/admin-panel/employee-costs-pii-guard.test.ts — but the
 * COST_REF is WIDENED for PR4's richer surface (cost AND profit AND revenue).
 * Static scan (no import → no DOM/Firebase). Runs in CI via root Vitest.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

/** Strip block + line comments so a comment mentioning a value identifier
 *  doesn't trip the guard (the `[^:]` before // keeps `://` URLs intact). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// The §7.6-sensitive VALUE identifiers — matched as WHOLE identifiers so the
// page name "Profitability"/"ProfitabilityPage" (which contains "Profit") is
// NOT flagged: only the exact value accessors actualCost / projectedProfit /
// paidRevenue (e.g. `data.actualCost`, `forecast.projectedProfit`).
const COST_REF = /\b(?:actualCost|projectedProfit|paidRevenue)\b/;
const LOG_WITH_COST =
  new RegExp('(?:console\\.\\w+|[Ll]ogger\\.\\w+)\\s*\\([^;]*' + COST_REF.source);
const STORAGE_WITH_COST =
  new RegExp('(?:localStorage|sessionStorage)\\.setItem\\s*\\([^;]*' + COST_REF.source);
const URL_WITH_COST =
  new RegExp(
    '(?:searchParams\\.(?:set|append)|location\\.(?:href|hash|search)\\s*=)\\s*[^;]*' + COST_REF.source
  );

const ROOT = process.cwd();
const FILES = [
  resolve(ROOT, 'apps/admin-panel/js/ui/ProfitabilityPage.js'),
  resolve(ROOT, 'apps/admin-panel/js/core/profitability-format.js')
];

describe('no cost/profit value escapes the client — static source guard', () => {
  FILES.forEach((file) => {
    const name = file.split(/[\\/]/).pop();
    const code = stripComments(readFileSync(file, 'utf8'));

    it(`${name} never passes a cost/profit value to console.*/Logger.*`, () => {
      expect(code).not.toMatch(LOG_WITH_COST);
    });

    it(`${name} never writes a cost/profit value to localStorage/sessionStorage`, () => {
      expect(code).not.toMatch(STORAGE_WITH_COST);
    });

    it(`${name} never writes a cost/profit value to a URL`, () => {
      expect(code).not.toMatch(URL_WITH_COST);
    });
  });

  it('sanity: the guard regexes DO catch violating patterns', () => {
    expect('console.log(`x ${data.actualCost}`);').toMatch(LOG_WITH_COST);
    expect('console.error("fail", forecast.projectedProfit);').toMatch(LOG_WITH_COST);
    expect('Logger.warn("x", paidRevenue);').toMatch(LOG_WITH_COST);
    expect("localStorage.setItem('c', actualCost);").toMatch(STORAGE_WITH_COST);
    expect("sessionStorage.setItem('p', projectedProfit);").toMatch(STORAGE_WITH_COST);
    expect('url.searchParams.set("c", actualCost);').toMatch(URL_WITH_COST);
  });

  it('sanity: the guard does NOT flag the page-name string "Profitability"', () => {
    // The page legitimately logs '[Profitability] ...' + 'ProfitabilityPage: ...'
    // — neither references a cost/profit VALUE, so the guard must not trip on the
    // page name (which contains the substring "Profit").
    expect("console.log('📊 Profitability Dashboard - Loading...');").not.toMatch(LOG_WITH_COST);
    expect("console.error('ProfitabilityPage: container not found:', sectionId);").not.toMatch(LOG_WITH_COST);
    expect("console.error('❌ [Profitability] live listener error:', error && error.code);").not.toMatch(LOG_WITH_COST);
  });
});
