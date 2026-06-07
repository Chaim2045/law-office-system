/**
 * PII source-guard (Pre-H.1.0) — ת"ז must NEVER reach logs/audit.
 *
 * Mirrors the H.0 no-PII-in-logs AST guard (set-employee-cost.test.ts): reads the
 * SOURCE of the touched files, strips comments, and asserts no console.* / logger.*
 * / logAction(...) call carries an idNumber value. The repo is PUBLIC and
 * `audit_log` is a forensic store — ת"ז (sensitive PII per Israeli privacy law)
 * must stay out of both (MASTER_PLAN §8.2.5 constraint #8).
 *
 * Static scan (no require → no firebase-admin init needed).
 */
'use strict';

const fs = require('fs');
const path = require('path');

/** Remove block + line comments so a comment that merely *mentions* idNumber
 *  doesn't trip the guard (the `[^:]` before // keeps `://` URLs intact). */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// Matches a console.* / logger.* / logAction( call whose argument span (up to the
// next `;`) contains idNumber or validatedIdNumber. `[^;]` spans newlines, so the
// multi-line logAction payload is covered.
const LOG_WITH_ID = /(?:console\.\w+|logger\.\w+|logAction)\s*\([^;]*[iI]dNumber/;

describe('no ת"ז (idNumber) value in logs/audit — static source guard', () => {
  it('functions/clients/index.js never passes idNumber to console/logger/logAction', () => {
    const code = stripComments(
      fs.readFileSync(path.resolve(__dirname, '../clients/index.js'), 'utf8')
    );
    expect(code).not.toMatch(LOG_WITH_ID);
  });

  it('functions/shared/validators.js never logs the id value', () => {
    const code = stripComments(
      fs.readFileSync(path.resolve(__dirname, '../shared/validators.js'), 'utf8')
    );
    expect(code).not.toMatch(LOG_WITH_ID);
  });

  it('sanity: the guard regex DOES catch a violating pattern', () => {
    expect('logAction("X", uid, name, { idNumber: x });').toMatch(LOG_WITH_ID);
    expect('console.log(`id ${client.idNumber}`);').toMatch(LOG_WITH_ID);
  });
});
