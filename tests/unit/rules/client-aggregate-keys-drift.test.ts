/**
 * DRIFT GUARD — `firestore.rules` clientAggregateKeys() vs
 * `functions/shared/client-writer.js` RESTRICTED_KEYS.
 *
 * Two independent lists guard the same invariant from opposite sides:
 *
 *   RESTRICTED_KEYS      — the canonical writer STRIPS these from caller input,
 *                          so a Cloud Function cannot set them by mistake.
 *   clientAggregateKeys  — the security rules REJECT these from a browser write,
 *                          so the client SDK cannot set them at all.
 *
 * A derived field protected on only one side is a hole. That is not
 * hypothetical: H.3 PR1 added `plan` to RESTRICTED_KEYS and never to the rules,
 * leaving the profitability Plan browser-writable until 2026-08-16. The same
 * bypass class produced the 23 wrongly-blocked clients found in the 2026-05-13
 * audit.
 *
 * This guard makes the next omission fail CI instead of shipping.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');

/**
 * Strip `//` line comments before parsing.
 *
 * Not cosmetic: the RESTRICTED_KEYS entries carry trailing comments, one of
 * which contains the literal `services[]`. A naive "first `]` after the marker"
 * scan stops inside that comment and silently truncates the list — which is
 * exactly how a guard like this passes while proving nothing. Caught when this
 * test was first run against a known-good tree.
 */
function stripLineComments(src: string): string {
  return src.replace(/\/\/[^\n]*/g, '');
}

/** Every quoted string inside the first `[ ... ]` of the given block. */
function quotedItems(block: string): string[] {
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function readRulesAggregateKeys(): string[] {
  const src = stripLineComments(
    readFileSync(resolve(REPO_ROOT, 'firestore.rules'), 'utf8')
  );
  const match = src.match(
    /function\s+clientAggregateKeys\s*\(\)\s*\{\s*return\s*\[([\s\S]*?)\]/
  );
  if (!match) {
    throw new Error('clientAggregateKeys() not found in firestore.rules');
  }
  return quotedItems(match[1]);
}

function readRestrictedKeys(): string[] {
  const src = stripLineComments(
    readFileSync(resolve(REPO_ROOT, 'functions/shared/client-writer.js'), 'utf8')
  );
  const match = src.match(
    /const\s+RESTRICTED_KEYS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/
  );
  if (!match) {
    throw new Error('RESTRICTED_KEYS not found in client-writer.js');
  }
  return quotedItems(match[1]);
}

describe('clientAggregateKeys() vs RESTRICTED_KEYS', () => {
  it('both lists are found and non-trivial', () => {
    expect(readRulesAggregateKeys().length).toBeGreaterThan(5);
    expect(readRestrictedKeys().length).toBeGreaterThan(5);
  });

  it('every server-restricted field is also rejected by the rules', () => {
    const rules = readRulesAggregateKeys();
    const restricted = readRestrictedKeys();

    const unprotected = restricted.filter((k) => !rules.includes(k));

    expect(
      unprotected,
      'These fields are stripped server-side but a browser could still write them ' +
        'directly. Add them to clientAggregateKeys() in firestore.rules: ' +
        `${unprotected.join(', ')}`
    ).toEqual([]);
  });

  it('the rules list adds exactly one field beyond the restricted set: services', () => {
    // `services` is deliberately asymmetric: Cloud Functions MUST be able to set
    // it (it is the input the aggregates are derived FROM), while a browser must
    // not. Any OTHER extra key means the two lists have drifted apart for a
    // reason nobody wrote down.
    const rules = readRulesAggregateKeys();
    const restricted = readRestrictedKeys();

    const extra = rules.filter((k) => !restricted.includes(k));

    expect(extra).toEqual(['services']);
  });

  it('the capacity and plan fields are protected on both sides', () => {
    const rules = readRulesAggregateKeys();
    const restricted = readRestrictedKeys();

    for (const field of ['hoursCapacity', 'plan', 'totalHours', 'isBlocked']) {
      expect(rules, `${field} missing from firestore.rules`).toContain(field);
      expect(restricted, `${field} missing from RESTRICTED_KEYS`).toContain(field);
    }
  });
});
