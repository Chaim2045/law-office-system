/**
 * PII source-guard (Pre-H.1.0b) — ת"ז must never reach the browser console.
 *
 * `logger.js`'s production override nulls only console.log/info/debug;
 * console.error / warn / group / trace / dir / table SURVIVE in production and
 * bypass Logger.sanitize(). The repo is PUBLIC and ת"ז is sensitive PII under
 * Israeli privacy law. This static scan asserts that no console.* / Logger.*
 * call in the touched files carries an `idNumber`, the `formData` object, or the
 * `firebaseData`/CF payload — the realistic frontend leak vectors once the field
 * is wired through collectFormData → buildFirebaseData.
 *
 * Mirrors the backend guard functions/tests/client-idnumber-pii-guard.test.js.
 * Static scan (no import → no DOM/Firebase needed). Runs in CI via root Vitest.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

/** Remove block + line comments so a comment that merely mentions idNumber
 *  doesn't trip the guard (the `[^:]` before // keeps `://` URLs intact). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// A console.* / Logger.* call whose argument span (up to the next `;`) references
// idNumber, the form object, or the CF payload. `[^;]` spans newlines so a
// multi-line logging call is covered.
const LOG_WITH_PII =
  /(?:console\.\w+|[Ll]ogger\.\w+)\s*\([^;]*\b(?:idNumber|formData|firebaseData)\b/;

const ROOT = process.cwd();
const DIALOG = resolve(
  ROOT,
  'apps/user-app/js/modules/case-creation/case-creation-dialog.js'
);
const HELPER = resolve(ROOT, 'apps/user-app/js/modules/israeli-id.js');

describe('no ת"ז (idNumber) value in the browser console — static source guard', () => {
  it('case-creation-dialog.js never passes idNumber/formData/firebaseData to console.*/Logger.*', () => {
    const code = stripComments(readFileSync(DIALOG, 'utf8'));
    expect(code).not.toMatch(LOG_WITH_PII);
  });

  it('israeli-id.js never logs the value it validates', () => {
    const code = stripComments(readFileSync(HELPER, 'utf8'));
    expect(code).not.toMatch(LOG_WITH_PII);
  });

  it('sanity: the guard regex DOES catch a violating pattern', () => {
    expect('console.error("save failed", formData);').toMatch(LOG_WITH_PII);
    expect('console.log(`id ${client.idNumber}`);').toMatch(LOG_WITH_PII);
    expect('Logger.warn("x", firebaseData);').toMatch(LOG_WITH_PII);
  });
});
