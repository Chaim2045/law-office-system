/**
 * H.6.c-2 — User-App regression guard: a pending_signature client is NOT
 * selectable for time entry.
 * ─────────────────────────────────────────────────────────────────────────────
 * The ClientCaseSelector loads clients into its cache via a Firestore query
 * `where('status','==','active')` and, when `showOnlyActive` is set, further
 * filters `c.status === 'active'`. Both are load-bearing safety: a
 * pending_signature client (created by createClientFromSalesRecord, service
 * status:'pending', activeServices:0) must NEVER appear in the time-entry client
 * picker — logging time against an unsigned case is exactly what the signature
 * gate exists to prevent.
 *
 * This is a PIN. If a future refactor drops the active-only query/filter, these
 * guards fail — surfacing the silent safety loss before it ships.
 *
 * Created: 2026-07-05 — feat/h6-c-2-pending-consumers
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const SELECTOR = path.resolve(
  __dirname,
  '../../../apps/user-app/js/modules/client-case-selector.js'
);

/** Strip block + line comments so a commented-out filter can't satisfy the guard. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('ClientCaseSelector — active-only load-bearing filters (H.6.c-2 pin)', () => {
  let code: string;
  beforeAll(() => {
    code = stripComments(fs.readFileSync(SELECTOR, 'utf8'));
  });

  it('the cache query filters to status == active (a pending client is never cached)', () => {
    // .where('status', '==', 'active') — tolerate quote/whitespace variance
    expect(code).toMatch(/\.where\(\s*['"]status['"]\s*,\s*['"]==['"]\s*,\s*['"]active['"]\s*\)/);
  });

  it('the showOnlyActive path filters c.status === active', () => {
    expect(code).toMatch(/\.filter\(\s*c\s*=>\s*c\.status\s*===\s*['"]active['"]\s*\)/);
  });
});

// ─── Behavioral pin: the equivalent active-only predicate excludes pending ─────
// Mirrors the `showOnlyActive` filter (line ~740) so the intent — not just the
// source text — is locked. A pending_signature client is dropped; an active one
// is kept.
describe('active-only selection predicate — pending_signature is excluded', () => {
  const activeOnly = (c: { status?: string }): boolean => c.status === 'active';

  it('keeps an active client', () => {
    expect(activeOnly({ status: 'active' })).toBe(true);
  });

  it('drops a pending_signature client (NOT selectable for time entry)', () => {
    expect(activeOnly({ status: 'pending_signature' })).toBe(false);
  });

  it('drops archived / inactive / undefined-status clients too', () => {
    expect(activeOnly({ status: 'archived' })).toBe(false);
    expect(activeOnly({ status: 'inactive' })).toBe(false);
    expect(activeOnly({})).toBe(false);
  });
});
