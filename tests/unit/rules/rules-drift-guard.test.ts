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
 */
import * as fs from 'fs';
import * as path from 'path';

import { beforeAll, describe, expect, it } from 'vitest';

const PROD_RULES = path.resolve(__dirname, '../../../firestore.rules');
const TEST_RULES = path.resolve(__dirname, '../../../firestore.rules.test');

const HELPERS = ['isAuthenticated', 'isAdmin', 'isPartner'] as const;

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
});

