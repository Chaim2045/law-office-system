/**
 * Cross-surface drift-guard (H.4 PR-b) for the task-budget thresholds.
 *
 * The worker crossing toast (apps/user-app/js/modules/budget-crossing.js) MUST
 * speak the SAME 85% / 100% language as the admin "חריגות תקציב" feed + the task
 * card, whose canonical helper is apps/admin-panel/js/core/budget-status.js
 * (H.4 PR-a). They live in different apps (admin IIFE/CJS vs user-app ESM) and
 * are hand-kept in sync — this test PINS them: thresholds + Hebrew labels +
 * level-transition behavior. Any divergence fails CI.
 *
 * Same SSOT-mirror pattern as israeli-id-drift-guard.test.ts (frontend ת"ז ↔
 * backend validator). Runs in CI via root Vitest.
 */
import { describe, it, expect } from 'vitest';

// @ts-ignore — CommonJS dual-export module imported into a TS ESM test.
import { budgetStatus } from '../../../apps/admin-panel/js/core/budget-status.js';
import {
  detectBudgetCrossing,
  budgetCrossingLabel,
  BUDGET_CROSSING_THRESHOLDS,
  BUDGET_CROSSING_LABELS
} from '../../../apps/user-app/js/modules/budget-crossing.js';

const EST = 100; // budget=100 → percent == minutes

// Derive budgetStatus's effective thresholds by probing integer percents, then
// assert the crossing helper's constants match — if PR-a ever retunes the admin
// helper, this fails until the worker helper is retuned to match.
function firstPercentWithLevel(target: string): number {
  for (let p = 0; p <= 300; p++) {
    if (budgetStatus(p, EST).level === target) {
      return p;
    }
  }
  return -1;
}

describe('budget-crossing.js thresholds ≡ budget-status.js thresholds', () => {
  it('"approaching" starts at the same percent budgetStatus turns "warning"', () => {
    expect(firstPercentWithLevel('warning')).toBe(BUDGET_CROSSING_THRESHOLDS.APPROACHING_PERCENT);
  });

  it('"over" starts one percent above budgetStatus\'s OVER_PERCENT (danger = percent>100)', () => {
    expect(firstPercentWithLevel('danger')).toBe(BUDGET_CROSSING_THRESHOLDS.OVER_PERCENT + 1);
  });
});

describe('budget-crossing.js labels ≡ budget-status.js labels', () => {
  it('approaching label matches budgetStatus warning label', () => {
    expect(BUDGET_CROSSING_LABELS.approaching).toBe(budgetStatus(85, EST).label);
    expect(budgetCrossingLabel('approaching')).toBe(budgetStatus(85, EST).label);
  });

  it('over label matches budgetStatus danger label', () => {
    expect(BUDGET_CROSSING_LABELS.over).toBe(budgetStatus(101, EST).label);
    expect(budgetCrossingLabel('over')).toBe(budgetStatus(101, EST).label);
  });
});

describe('detectBudgetCrossing transitions ≡ budgetStatus level transitions', () => {
  // The real pin: for every forward-progress pair, the crossing the worker helper
  // reports must equal the level transition the admin helper would show.
  const POINTS = [0, 40, 50, 84, 85, 90, 100, 101, 130, 200];

  function expectedFromStatus(before: number, after: number): 'over' | 'approaching' | null {
    if (after <= before) {
      return null;
    }
    const lvlBefore = budgetStatus(before, EST).level;
    const lvlAfter = budgetStatus(after, EST).level;
    if (lvlAfter === 'danger' && lvlBefore !== 'danger') {
      return 'over';
    }
    if (lvlAfter === 'warning' && (lvlBefore === 'success' || lvlBefore === 'neutral')) {
      return 'approaching';
    }
    return null;
  }

  for (const before of POINTS) {
    for (const after of POINTS) {
      it(`before=${before}% after=${after}% agrees with budgetStatus`, () => {
        expect(detectBudgetCrossing(before, after, EST)).toBe(expectedFromStatus(before, after));
      });
    }
  }
});
