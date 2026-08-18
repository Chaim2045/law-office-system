/**
 * Unit tests — detectBudgetCrossing (H.4 PR-b, Model A "smart budget meter")
 * ─────────────────────────────────────────────────────────────────────────
 * The LOAD-BEARING worker-side rule as a pure function (no DOM/Firebase): given
 * the actual minutes BEFORE and AFTER a time entry + the task budget, did this
 * entry NEWLY cross a canonical budget threshold (85% approaching / 100% over)?
 *
 * This is the "customer scenario" test (G4): a worker logging time
 *   - crosses 85%  → exactly ONE "מתקרב לתקציב" signal,
 *   - later crosses 100% → exactly ONE "חריגת תקציב" signal,
 *   - logs more while already over → NO repeat signal (once-per-crossing).
 *
 * Mirrors tests/unit/admin-panel/budget-status.test.ts (the admin PR-a helper).
 */
import { describe, it, expect } from 'vitest';

import {
  detectBudgetCrossing,
  budgetCrossingLabel,
  BUDGET_CROSSING_THRESHOLDS,
  BUDGET_CROSSING_LABELS
} from '../../../apps/user-app/js/modules/budget-crossing.js';

// Budget = 100 minutes → percent == minutes, so the numbers read as percentages.
const EST = 100;

describe('detectBudgetCrossing — no budget → never a crossing', () => {
  it.each([undefined, null, 0, -50, NaN, Infinity, '100'])(
    'estimatedMinutes=%p → null',
    (est) => {
      expect(detectBudgetCrossing(50, 200, est as never)).toBeNull();
    }
  );
});

describe('detectBudgetCrossing — approaching (85%) crossing', () => {
  it('50% → 90% fires "approaching"', () => {
    expect(detectBudgetCrossing(50, 90, EST)).toBe('approaching');
  });

  it('crossing exactly to 85% fires "approaching" (>= APPROACHING)', () => {
    expect(detectBudgetCrossing(84, 85, EST)).toBe('approaching');
  });

  it('staying just below 85% does NOT fire (84 → 84.4 rounds to 84)', () => {
    expect(detectBudgetCrossing(84, 84.4, EST)).toBeNull();
  });

  it('reaching exactly 100% is "approaching", NOT "over" (percent>100 is over)', () => {
    expect(detectBudgetCrossing(50, 100, EST)).toBe('approaching');
  });
});

describe('detectBudgetCrossing — over (100%) crossing', () => {
  it('90% → 110% fires "over"', () => {
    expect(detectBudgetCrossing(90, 110, EST)).toBe('over');
  });

  it('crossing just past 100% fires "over" (100 → 101)', () => {
    expect(detectBudgetCrossing(100, 101, EST)).toBe('over');
  });

  it('a jump straight past BOTH lines (50% → 130%) reports the highest: "over"', () => {
    expect(detectBudgetCrossing(50, 130, EST)).toBe('over');
  });
});

describe('detectBudgetCrossing — once per crossing (no repeats)', () => {
  it('already approaching, still below 100 → null (not newly crossed)', () => {
    expect(detectBudgetCrossing(88, 95, EST)).toBeNull();
  });

  it('already over, logging more → null (no repeat "over")', () => {
    expect(detectBudgetCrossing(120, 180, EST)).toBeNull();
  });

  it('crossing 85 then a SECOND entry crossing 100 each fire once', () => {
    // entry 1: 60 → 88  (crosses 85)
    expect(detectBudgetCrossing(60, 88, EST)).toBe('approaching');
    // entry 2: 88 → 105 (crosses 100)
    expect(detectBudgetCrossing(88, 105, EST)).toBe('over');
    // entry 3: 105 → 130 (already over)
    expect(detectBudgetCrossing(105, 130, EST)).toBeNull();
  });
});

describe('detectBudgetCrossing — degenerate inputs', () => {
  it('no forward progress (after <= before) → null', () => {
    expect(detectBudgetCrossing(90, 90, EST)).toBeNull();
    expect(detectBudgetCrossing(90, 50, EST)).toBeNull();
  });

  it('non-finite before is treated as 0 (first entry crossing straight in)', () => {
    expect(detectBudgetCrossing(NaN, 90, EST)).toBe('approaching');
    expect(detectBudgetCrossing(undefined as never, 130, EST)).toBe('over');
  });

  it('non-finite after → null (nothing to compare)', () => {
    expect(detectBudgetCrossing(50, NaN, EST)).toBeNull();
    expect(detectBudgetCrossing(50, undefined as never, EST)).toBeNull();
  });

  it('never returns NaN / undefined — only the three allowed values', () => {
    const out = detectBudgetCrossing(50, 90, EST);
    expect(['over', 'approaching', null]).toContain(out);
  });
});

describe('budgetCrossingLabel — Hebrew labels', () => {
  it('maps each level to its canonical Hebrew label', () => {
    expect(budgetCrossingLabel('over')).toBe('חריגת תקציב');
    expect(budgetCrossingLabel('approaching')).toBe('מתקרב לתקציב');
    expect(budgetCrossingLabel(null)).toBeNull();
  });

  it('exposes the locked thresholds + labels as frozen constants', () => {
    expect(BUDGET_CROSSING_THRESHOLDS.APPROACHING_PERCENT).toBe(85);
    expect(BUDGET_CROSSING_THRESHOLDS.OVER_PERCENT).toBe(100);
    expect(BUDGET_CROSSING_LABELS.approaching).toBe('מתקרב לתקציב');
    expect(BUDGET_CROSSING_LABELS.over).toBe('חריגת תקציב');
    expect(Object.isFrozen(BUDGET_CROSSING_THRESHOLDS)).toBe(true);
    expect(Object.isFrozen(BUDGET_CROSSING_LABELS)).toBe(true);
  });
});
