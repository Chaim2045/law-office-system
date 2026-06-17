/**
 * Rules drift-guard (Pre-H.0.0.D)
 * ─────────────────────────────────────────────────────────────────────────────
 * Production `firestore.rules` and the test-only `firestore.rules.test` MUST
 * contain identical helper-function bodies. If one diverges, isPartner()
 * tests against the test ruleset stop reflecting production behavior.
 *
 * This guard extracts the bodies of isAuthenticated(), isAdmin(), and
 * isPartner() from BOTH files and asserts string-equality.
 *
 * ─── What this catches ───────────────────────────────────────────────────────
 *   ✅ Future PR edits one file and forgets the other.
 *   ✅ Whitespace / formatting drift.
 *
 * ─── What this does NOT catch ────────────────────────────────────────────────
 *   ❌ Shared bug in BOTH files at once (e.g. someone changes 'partner' to
 *      'Partner' in both files). Devils-advocate Attack #1 raised this; the
 *      counter-defense is the 11 scenarios in isPartner.test.ts (which would
 *      catch the typo via case-sensitive assertion failures), plus future
 *      production-path tests when first consumer rule lands (deferred to H.4).
 *
 * ─── Gated-collection match-block guard (H.3 PR3) ────────────────────────────
 * The helper guard alone left a blind spot the H.3-PR3 devils-advocate flagged:
 * the deny-suite (e.g. clientProfitability.test.ts) runs against firestore.rules.test,
 * so if a future PR weakened a GATED collection's rule in firestore.rules WITHOUT
 * touching the mirror, the deny-suite would stay green while production leaked. We
 * now ALSO assert the `match /<collection>` block of each rule-gated confidential
 * collection is string-equal (comments stripped) between the two files.
 */
import * as fs from 'fs';
import * as path from 'path';

import { beforeAll, describe, expect, it } from 'vitest';

const PROD_RULES = path.resolve(__dirname, '../../../firestore.rules');
const TEST_RULES = path.resolve(__dirname, '../../../firestore.rules.test');

const HELPERS = ['isAuthenticated', 'isAdmin', 'isPartner'] as const;

/**
 * Rule-gated confidential collections whose `match` block MUST be identical between
 * the production ruleset and the test mirror (the deny-suite proves the gate against
 * the mirror, so a silent divergence here would be a false-green). H.3 PR3 added
 * client_profitability (the first production isAdmin()||isPartner() consumer). H.6
 * added sales_record_links (fully CF-only — the agreed-fee snapshot off the
 * world-readable clients doc).
 */
const GATED_COLLECTIONS = ['client_profitability', 'sales_record_links'] as const;

/**
 * Extracts the body of `function <name>() { ... }` from a rules file via
 * bracket matching. Returns the body string normalized to single-space
 * indentation, trimmed.
 */
function extractFunctionBody(source: string, name: string): string {
  const declMarker = `function ${name}()`;
  const declStart = source.indexOf(declMarker);
  if (declStart === -1) {
    throw new Error(`extractFunctionBody: '${name}' not found in source`);
  }
  const openBraceIdx = source.indexOf('{', declStart);
  if (openBraceIdx === -1) {
    throw new Error(`extractFunctionBody: opening brace for '${name}' not found`);
  }
  let depth = 0;
  let endIdx = -1;
  for (let i = openBraceIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) {
    throw new Error(`extractFunctionBody: closing brace for '${name}' not found`);
  }
  return source.slice(openBraceIdx, endIdx + 1).replace(/\s+/g, ' ').trim();
}

/**
 * Extracts the `match /<collection>/{...} { ... }` block via bracket matching, with
 * line comments stripped and whitespace normalized — so the comparison is on the
 * RULE LINES (allow read/write), ignoring the differing surrounding comments.
 */
function extractMatchBlock(source: string, collection: string): string {
  const declMarker = `match /${collection}/`;
  const declStart = source.indexOf(declMarker);
  if (declStart === -1) {
    throw new Error(`extractMatchBlock: 'match /${collection}/' not found in source`);
  }
  const openBraceIdx = source.indexOf('{', declStart);
  if (openBraceIdx === -1) {
    throw new Error(`extractMatchBlock: opening brace for '${collection}' not found`);
  }
  let depth = 0;
  let endIdx = -1;
  for (let i = openBraceIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) {
    throw new Error(`extractMatchBlock: closing brace for '${collection}' not found`);
  }
  return source
    .slice(openBraceIdx, endIdx + 1)
    .replace(/\/\/[^\n]*/g, '') // strip line comments (the only inter-file difference)
    .replace(/\s+/g, ' ')
    .trim();
}

describe('Rules drift-guard — production vs test ruleset', () => {
  let prodSource: string;
  let testSource: string;

  beforeAll(() => {
    prodSource = fs.readFileSync(PROD_RULES, 'utf8');
    testSource = fs.readFileSync(TEST_RULES, 'utf8');
  });

  it.each(HELPERS)('%s body is string-equal in firestore.rules and firestore.rules.test', (name) => {
    const prodBody = extractFunctionBody(prodSource, name);
    const testBody = extractFunctionBody(testSource, name);
    expect(testBody).toBe(prodBody);
  });

  it.each(GATED_COLLECTIONS)(
    '%s match block (rule lines) is string-equal in firestore.rules and firestore.rules.test',
    (collection) => {
      const prodBlock = extractMatchBlock(prodSource, collection);
      const testBlock = extractMatchBlock(testSource, collection);
      expect(testBlock).toBe(prodBlock);
    }
  );
});

