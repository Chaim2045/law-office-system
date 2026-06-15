/**
 * Unit tests — BudgetStatus (H.4 PR-a)
 * ────────────────────────────────────
 * The LOAD-BEARING task-budget render rule as a pure function (no DOM/Firebase):
 * actual-vs-estimated minutes → { level, label, percent, isOver } at the
 * Haim-locked 85% / 100% thresholds. This is the "customer scenario" test (G4):
 * an admin opening the "חריגות תקציב" feed must see a task at exactly the cap as
 * "מתקרב לתקציב" (warning) and a task past it as "חריגת תקציב" (danger).
 *
 * Mirrors tests/unit/admin-panel/profitability-format.test.ts (the H.3 helper).
 */
import { describe, it, expect } from 'vitest';

// @ts-ignore — CommonJS require from a TypeScript ESM test (dual-export module).
import {
  budgetStatus,
  formatHoursFromMinutes
} from '../../../apps/admin-panel/js/core/budget-status.js';

describe('budgetStatus — no/zero/negative estimate → neutral "אין תקציב"', () => {
  it('no estimate (undefined) → neutral, percent null, not over', () => {
    expect(budgetStatus(120, undefined)).toEqual({
      level: 'neutral', label: 'אין תקציב', percent: null, isOver: false
    });
  });

  it('null estimate → neutral', () => {
    expect(budgetStatus(120, null)).toEqual({
      level: 'neutral', label: 'אין תקציב', percent: null, isOver: false
    });
  });

  it('zero estimate → neutral (a task with no budget can never be "over")', () => {
    expect(budgetStatus(120, 0)).toEqual({
      level: 'neutral', label: 'אין תקציב', percent: null, isOver: false
    });
  });

  it('negative estimate → neutral', () => {
    expect(budgetStatus(120, -60)).toEqual({
      level: 'neutral', label: 'אין תקציב', percent: null, isOver: false
    });
  });

  it('non-finite estimate (NaN) → neutral', () => {
    expect(budgetStatus(120, NaN).level).toBe('neutral');
  });
});

describe('budgetStatus — within budget (percent < 85) → success "בתקציב"', () => {
  it('well within plan → success', () => {
    expect(budgetStatus(50, 100)).toEqual({
      level: 'success', label: 'בתקציב', percent: 50, isOver: false
    });
  });

  it('84% → still success (just under the warning threshold)', () => {
    expect(budgetStatus(84, 100).level).toBe('success');
  });

  it('non-finite actual treated as 0 → success "בתקציב" 0%', () => {
    expect(budgetStatus(null, 100)).toEqual({
      level: 'success', label: 'בתקציב', percent: 0, isOver: false
    });
    expect(budgetStatus(undefined, 100).percent).toBe(0);
  });
});

describe('budgetStatus — approaching (85 <= percent <= 100) → warning "מתקרב לתקציב"', () => {
  it('exactly 85% → warning (boundary)', () => {
    expect(budgetStatus(85, 100)).toEqual({
      level: 'warning', label: 'מתקרב לתקציב', percent: 85, isOver: false
    });
  });

  it('exactly 100% → warning, NOT over (boundary — at-cap is still "approaching")', () => {
    expect(budgetStatus(100, 100)).toEqual({
      level: 'warning', label: 'מתקרב לתקציב', percent: 100, isOver: false
    });
  });

  it('92% → warning', () => {
    expect(budgetStatus(92, 100).level).toBe('warning');
  });
});

describe('budgetStatus — over budget (percent > 100) → danger "חריגת תקציב" + isOver', () => {
  it('101% → danger + isOver true', () => {
    expect(budgetStatus(101, 100)).toEqual({
      level: 'danger', label: 'חריגת תקציב', percent: 101, isOver: true
    });
  });

  it('strongly over → danger + isOver true', () => {
    const r = budgetStatus(300, 100);
    expect(r.level).toBe('danger');
    expect(r.isOver).toBe(true);
    expect(r.percent).toBe(300);
  });
});

describe('budgetStatus — percent rounding', () => {
  it('rounds to nearest integer (295/300 = 98.33% → 98)', () => {
    expect(budgetStatus(295, 300).percent).toBe(98);
  });

  it('rounds up at .5 (1/3 of a 2-min budget → 50; 5/8 → 62.5 → 63)', () => {
    expect(budgetStatus(5, 8).percent).toBe(63);
  });

  it('100.4% rounds to 100 → warning (not over until strictly > 100)', () => {
    // 251/250 = 100.4 → round → 100 → warning boundary
    expect(budgetStatus(251, 250).percent).toBe(100);
    expect(budgetStatus(251, 250).level).toBe('warning');
  });
});

describe('formatHoursFromMinutes — minutes → hours, 1 decimal', () => {
  it('295 minutes → "4.9"', () => {
    expect(formatHoursFromMinutes(295)).toBe('4.9');
  });

  it('60 minutes → "1.0"', () => {
    expect(formatHoursFromMinutes(60)).toBe('1.0');
  });

  it('0 → "0.0" (a real value)', () => {
    expect(formatHoursFromMinutes(0)).toBe('0.0');
  });

  it('non-finite (null/undefined/NaN) → "0.0"', () => {
    expect(formatHoursFromMinutes(null)).toBe('0.0');
    expect(formatHoursFromMinutes(undefined)).toBe('0.0');
    expect(formatHoursFromMinutes(NaN)).toBe('0.0');
  });

  it('90 minutes → "1.5"', () => {
    expect(formatHoursFromMinutes(90)).toBe('1.5');
  });
});
