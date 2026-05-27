/**
 * Sync test — business-rules service-classification across 5 implementations
 *
 * Enforces that the canonical SOT and its 4 mirrors produce IDENTICAL outputs
 * for every cell of the function-output matrix.
 *
 * Compared implementations:
 *   1. shared/business-rules/service-classification.js                   (canonical, CJS)
 *   2. functions/shared/business-rules/service-classification.js         (functions mirror, CJS)
 *   3. apps/admin-panel/js/shared/business-rules-adapter.js              (admin IIFE → window.BUSINESS_RULES)
 *   4. apps/user-app/js/shared/business-rules-adapter.js                 (user-app IIFE sibling)
 *   5. apps/admin-panel/js/core/client-type-display.js:isFixedService    (legacy public export, preserved)
 *
 * Implementation #5 only exposes isFixedService (the other 2 predicates are not
 * declared there) — it asserts only that one predicate. The other 4 impls cover
 * all 3 predicates.
 *
 * Drift detection strategy:
 *   - Data drift: deep-equal of API keys exposed by all four impls.
 *   - Behavior drift: function-output matrix — 6 inputs × 3 predicates = 18 cells × 4 impls.
 *   - Signature drift: NOT directly caught (these are mono-arg pure predicates;
 *     full mitigation deferred to PR-2.1.1c pre-commit hook).
 *
 * If this test fails: someone edited one of the 4 files but not the others.
 * Restore parity by editing the canonical (shared/business-rules/...) and
 * mirroring the change to all 3 other files. Run this test locally before pushing.
 *
 * Created: 2026-05-26 as part of PR-2.1.1.
 */

import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

// @ts-ignore — CommonJS require from TypeScript ESM test
import * as clientTypeDisplayNS from '../../../apps/admin-panel/js/core/client-type-display.js';
// @ts-ignore
import * as functionsMirrorNS from '../../../functions/shared/business-rules/service-classification.js';
// @ts-ignore
import * as canonicalNS from '../../../shared/business-rules/service-classification.js';

type Predicate = (svc: unknown) => boolean;
type Impl = {
  isFixedService: Predicate;
  isHourlyService: Predicate;
  isLegalProcedureService: Predicate;
};

const repoRoot = path.resolve(__dirname, '../../..');

// 1 — canonical (CJS, repo-root)
const canonical = canonicalNS as unknown as Impl;

// 2 — functions mirror (CJS, inside functions/ tree)
const functionsMirror = functionsMirrorNS as unknown as Impl;

// 3, 4 — IIFE adapters loaded via Function constructor with a fake window object.
//        This isolates each IIFE in its own scope and captures the BUSINESS_RULES
//        assignment, so the same approach works in Node and CI.
function loadIIFEAdapter(relPath: string): Impl {
  const absPath = path.join(repoRoot, relPath);
  const source = fs.readFileSync(absPath, 'utf8');
  const fakeWindow: { BUSINESS_RULES?: Impl } = {};
  // The IIFE checks `typeof window !== 'undefined'` and assigns window.BUSINESS_RULES.
  // We pass our fakeWindow as the `window` parameter so the IIFE writes into it.
  const runner = new Function('window', source);
  runner(fakeWindow);
  if (!fakeWindow.BUSINESS_RULES) {
    throw new Error(`IIFE adapter ${relPath} did not set window.BUSINESS_RULES`);
  }
  return fakeWindow.BUSINESS_RULES;
}

const adminAdapter = loadIIFEAdapter('apps/admin-panel/js/shared/business-rules-adapter.js');
const userAdapter = loadIIFEAdapter('apps/user-app/js/shared/business-rules-adapter.js');

// 5 — legacy public export from client-type-display.js. Preserved as a local copy
//     of isFixedService so existing Vitest tests don't need setup changes.
//     This sync test enforces it stays in lockstep with the canonical.
const clientTypeDisplay = clientTypeDisplayNS as unknown as { isFixedService: Predicate };

const IMPLS: Record<string, Impl> = {
  canonical,
  functionsMirror,
  adminAdapter,
  userAdapter
};

// 6 canonical inputs covering all production shapes + edge cases
const INPUTS: Record<string, unknown> = {
  hours: { type: 'hours', totalHours: 10 },
  fixed: { type: 'fixed', work: { totalMinutesWorked: 0 } },
  legalProcedureHourly: { type: 'legal_procedure', pricingType: 'hourly', stages: [] },
  legalProcedureFixed: { type: 'legal_procedure', pricingType: 'fixed', stages: [] },
  nullInput: null,
  undefinedInput: undefined
};

const PREDICATES: Array<keyof Impl> = ['isFixedService', 'isHourlyService', 'isLegalProcedureService'];

describe('business-rules sync — API surface', () => {
  it('all four implementations expose the same predicate keys', () => {
    const expectedKeys = ['isFixedService', 'isHourlyService', 'isLegalProcedureService'].sort();
    for (const [name, impl] of Object.entries(IMPLS)) {
      const actualKeys = Object.keys(impl)
        .filter((k) => typeof (impl as unknown as Record<string, unknown>)[k] === 'function')
        .sort();
      expect(actualKeys, `${name} predicate keys`).toEqual(expectedKeys);
    }
  });

  it('all predicates are functions in every implementation', () => {
    for (const [name, impl] of Object.entries(IMPLS)) {
      for (const pred of PREDICATES) {
        expect(typeof impl[pred], `${name}.${pred}`).toBe('function');
      }
    }
  });
});

describe('business-rules sync — function-output matrix', () => {
  // 6 inputs × 3 predicates = 18 cells. Each cell asserts all 4 impls agree.
  for (const [inputName, inputValue] of Object.entries(INPUTS)) {
    for (const pred of PREDICATES) {
      it(`all 4 impls agree on ${pred}(${inputName})`, () => {
        const canonicalOutput = canonical[pred](inputValue);
        for (const [implName, impl] of Object.entries(IMPLS)) {
          const output = impl[pred](inputValue);
          expect(
            output,
            `${implName}.${pred}(${inputName}) = ${output}, canonical = ${canonicalOutput}`
          ).toBe(canonicalOutput);
        }
      });
    }
  }
});

describe('business-rules sync — canonical truth table is correct', () => {
  // Verify the canonical itself gives the expected boolean for each cell.
  // If this fails, the bug is in the canonical SOT, not in mirror drift.
  const expected: Record<string, Record<keyof Impl, boolean>> = {
    hours: { isFixedService: false, isHourlyService: true, isLegalProcedureService: false },
    fixed: { isFixedService: true, isHourlyService: false, isLegalProcedureService: false },
    legalProcedureHourly: { isFixedService: false, isHourlyService: true, isLegalProcedureService: true },
    legalProcedureFixed: { isFixedService: true, isHourlyService: false, isLegalProcedureService: true },
    nullInput: { isFixedService: false, isHourlyService: false, isLegalProcedureService: false },
    undefinedInput: { isFixedService: false, isHourlyService: false, isLegalProcedureService: false }
  };

  for (const [inputName, inputValue] of Object.entries(INPUTS)) {
    for (const pred of PREDICATES) {
      it(`canonical: ${pred}(${inputName}) === ${expected[inputName][pred]}`, () => {
        expect(canonical[pred](inputValue)).toBe(expected[inputName][pred]);
      });
    }
  }
});

describe('business-rules sync — IIFE adapters are byte-identical', () => {
  it('admin and user-app adapter files have identical bytes', () => {
    const adminPath = path.join(repoRoot, 'apps/admin-panel/js/shared/business-rules-adapter.js');
    const userPath = path.join(repoRoot, 'apps/user-app/js/shared/business-rules-adapter.js');
    const adminBytes = fs.readFileSync(adminPath);
    const userBytes = fs.readFileSync(userPath);
    expect(adminBytes.equals(userBytes), 'adapter file byte-equality').toBe(true);
  });
});

describe('business-rules sync — legacy client-type-display.isFixedService matches canonical', () => {
  // Implementation #5: a preserved local copy in apps/admin-panel/js/core/client-type-display.js.
  // The function is not removed (existing tests depend on it); this sync test enforces parity.
  for (const [inputName, inputValue] of Object.entries(INPUTS)) {
    it(`client-type-display.isFixedService(${inputName}) matches canonical`, () => {
      const canonicalOutput = canonical.isFixedService(inputValue);
      const legacyOutput = clientTypeDisplay.isFixedService(inputValue);
      expect(
        legacyOutput,
        `client-type-display.isFixedService(${inputName}) = ${legacyOutput}, canonical = ${canonicalOutput}`
      ).toBe(canonicalOutput);
    });
  }
});
