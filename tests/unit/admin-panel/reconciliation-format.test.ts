/**
 * Unit tests — ReconciliationFormat (OWN-3 "סנכרון שעות")
 * ──────────────────────────────────────────────────────
 * The LOAD-BEARING display rules of the reconciliation control page as pure
 * functions (no DOM/Firebase): mode labels for all 3 modes, the run-row display
 * strings + status level (failed>0 → error; clean → ok; warning conditions),
 * the client-side desc sort (the page uses NO Firestore .orderBy / index), the
 * signed net-hours-delta formatting, and the non-PII deferral formatting.
 *
 * Mirrors tests/unit/admin-panel/profitability-format.test.ts in style + rigor.
 */
import { describe, it, expect } from 'vitest';

// @ts-ignore — CommonJS require from a TypeScript ESM test (dual-export module).
import {
  VALID_MODES,
  isValidMode,
  modeLabel,
  modeLabelShort,
  formatInt,
  formatHoursDelta,
  formatHoursValue,
  runStatusLevel,
  runStatusLabel,
  formatRunRow,
  sortRunsDesc,
  formatDeferral
} from '../../../apps/admin-panel/js/ui/reconciliation-format.js';

describe('mode labels — all 3 modes (the literal mode VALUES stay English)', () => {
  it('VALID_MODES is exactly [off, dry_run, enforce]', () => {
    expect(VALID_MODES).toEqual(['off', 'dry_run', 'enforce']);
  });

  it('isValidMode accepts the 3 modes, rejects anything else', () => {
    expect(isValidMode('off')).toBe(true);
    expect(isValidMode('dry_run')).toBe(true);
    expect(isValidMode('enforce')).toBe(true);
    expect(isValidMode('ENFORCE')).toBe(false);
    expect(isValidMode('')).toBe(false);
    expect(isValidMode(undefined)).toBe(false);
    expect(isValidMode('on')).toBe(false);
  });

  it('modeLabel: full Hebrew label per mode; unknown → "לא ידוע"', () => {
    expect(modeLabel('off')).toBe('כבוי');
    expect(modeLabel('dry_run')).toBe('צפייה (ללא כתיבה)');
    expect(modeLabel('enforce')).toBe('תיקון (כותב לפרודקשן)');
    expect(modeLabel('bogus')).toBe('לא ידוע');
    expect(modeLabel(undefined)).toBe('לא ידוע');
  });

  it('modeLabelShort: short Hebrew label per mode; unknown → "לא ידוע"', () => {
    expect(modeLabelShort('off')).toBe('כבוי');
    expect(modeLabelShort('dry_run')).toBe('צפייה');
    expect(modeLabelShort('enforce')).toBe('תיקון');
    expect(modeLabelShort('bogus')).toBe('לא ידוע');
  });
});

describe('formatInt — thousands grouping, null-safe', () => {
  it('groups thousands; 0 → "0"; null/undefined → "0"', () => {
    expect(formatInt(0)).toBe('0');
    expect(formatInt(7)).toBe('7');
    expect(formatInt(1234)).toBe('1,234');
    expect(formatInt(1234567)).toBe('1,234,567');
    expect(formatInt(null)).toBe('0');
    expect(formatInt(undefined)).toBe('0');
  });
});

describe('formatHoursDelta — signed running hours sum', () => {
  it('a clean run (0) → "0.0" (no sign)', () => {
    expect(formatHoursDelta(0)).toBe('0.0');
  });

  it('positive → explicit "+" sign, 1 decimal', () => {
    expect(formatHoursDelta(1.5)).toBe('+1.5');
    expect(formatHoursDelta(12.34)).toBe('+12.3');
  });

  it('negative → carries its own "-" sign, 1 decimal', () => {
    expect(formatHoursDelta(-2)).toBe('-2.0');
    expect(formatHoursDelta(-0.04)).toBe('0.0'); // rounds to 0 → no sign
  });

  it('null/undefined → "0.0"', () => {
    expect(formatHoursDelta(null)).toBe('0.0');
    expect(formatHoursDelta(undefined)).toBe('0.0');
  });
});

describe('formatHoursValue — plain 1-decimal hours (deferral before/after)', () => {
  it('finite → 1 decimal; null → dash', () => {
    expect(formatHoursValue(10)).toBe('10.0');
    expect(formatHoursValue(4.92)).toBe('4.9');
    expect(formatHoursValue(0)).toBe('0.0');
    expect(formatHoursValue(null)).toBe('—');
    expect(formatHoursValue(undefined)).toBe('—');
  });
});

describe('runStatusLevel — the run row color signal', () => {
  it('a clean run → ok', () => {
    expect(runStatusLevel({
      mode: 'dry_run', clientsScanned: 50, servicesScanned: 77,
      repaired: 0, wouldRepair: 0, failed: 0, invariantFailures: 0,
      blockFlipsDeferred: 0, scanErrors: 0
    })).toBe('ok');
  });

  it('failed > 0 → error', () => {
    expect(runStatusLevel({ failed: 1 })).toBe('error');
  });

  it('invariantFailures > 0 → error (a service could not be safely repaired)', () => {
    expect(runStatusLevel({ failed: 0, invariantFailures: 3 })).toBe('error');
  });

  it('blockFlipsDeferred > 0 (nothing failed) → warning', () => {
    expect(runStatusLevel({ failed: 0, invariantFailures: 0, blockFlipsDeferred: 2 })).toBe('warning');
  });

  it('scanErrors > 0 (nothing failed) → warning', () => {
    expect(runStatusLevel({ failed: 0, invariantFailures: 0, blockFlipsDeferred: 0, scanErrors: 1 })).toBe('warning');
  });

  it('failed dominates a deferral (error beats warning)', () => {
    expect(runStatusLevel({ failed: 1, blockFlipsDeferred: 5 })).toBe('error');
  });

  it('empty/undefined details → ok (defensive)', () => {
    expect(runStatusLevel({})).toBe('ok');
    expect(runStatusLevel(undefined)).toBe('ok');
  });
});

describe('runStatusLabel — Hebrew label per level', () => {
  it('ok → תקין, warning → דורש בדיקה, error → נכשל', () => {
    expect(runStatusLabel('ok')).toBe('תקין');
    expect(runStatusLabel('warning')).toBe('דורש בדיקה');
    expect(runStatusLabel('error')).toBe('נכשל');
    expect(runStatusLabel('whatever')).toBe('תקין');
  });
});

describe('formatRunRow — all display strings for one run', () => {
  it('a clean dry_run → ok level + grouped counts', () => {
    const row = formatRunRow({
      mode: 'dry_run', clientsScanned: 1050, servicesScanned: 77,
      wouldRepair: 12, repaired: 0, failed: 0, invariantFailures: 0,
      blockFlipsDeferred: 0, scanErrors: 0, netHoursDelta: 0,
      deferrals: [], deferralsCount: 0
    });
    expect(row.level).toBe('ok');
    expect(row.levelLabel).toBe('תקין');
    expect(row.mode).toBe('dry_run');
    expect(row.modeLabel).toBe('צפייה');
    expect(row.clientsScanned).toBe('1,050');
    expect(row.servicesScanned).toBe('77');
    expect(row.wouldRepair).toBe('12');
    expect(row.repaired).toBe('0');
    expect(row.netHoursDelta).toBe('0.0');
    expect(row.deferralsCount).toBe('0');
  });

  it('an enforce run with a failure → error level + the real write count', () => {
    const row = formatRunRow({
      mode: 'enforce', clientsScanned: 50, servicesScanned: 77,
      wouldRepair: 0, repaired: 8, failed: 2, invariantFailures: 0,
      blockFlipsDeferred: 1, scanErrors: 0, netHoursDelta: 8.74,
      deferrals: [{ clientId: 'c1', serviceId: 's1' }], deferralsCount: 1
    });
    expect(row.level).toBe('error');
    expect(row.levelLabel).toBe('נכשל');
    expect(row.mode).toBe('enforce');
    expect(row.modeLabel).toBe('תיקון');
    expect(row.repaired).toBe('8');
    expect(row.failed).toBe('2');
    expect(row.blockFlipsDeferred).toBe('1');
    expect(row.netHoursDelta).toBe('+8.7');
    expect(row.deferralsCount).toBe('1');
  });

  it('deferralsCount falls back to deferrals.length when absent', () => {
    const row = formatRunRow({
      mode: 'dry_run', deferrals: [{ clientId: 'a' }, { clientId: 'b' }]
      // deferralsCount intentionally omitted
    });
    expect(row.deferralsCount).toBe('2');
  });

  it('missing details → all-zero strings, ok level (defensive)', () => {
    const row = formatRunRow(undefined);
    expect(row.level).toBe('ok');
    expect(row.clientsScanned).toBe('0');
    expect(row.repaired).toBe('0');
    expect(row.netHoursDelta).toBe('0.0');
    expect(row.modeLabel).toBe('לא ידוע');
  });
});

describe('sortRunsDesc — client-side newest-first (NO Firestore .orderBy / index)', () => {
  it('sorts by Firestore Timestamp (.toMillis) descending', () => {
    const docs = [
      { id: 'a', timestamp: { toMillis: () => 1000 } },
      { id: 'b', timestamp: { toMillis: () => 3000 } },
      { id: 'c', timestamp: { toMillis: () => 2000 } }
    ];
    expect(sortRunsDesc(docs).map((d) => d.id)).toEqual(['b', 'c', 'a']);
  });

  it('handles {seconds,nanoseconds} timestamps', () => {
    const docs = [
      { id: 'old', timestamp: { seconds: 100, nanoseconds: 0 } },
      { id: 'new', timestamp: { seconds: 200, nanoseconds: 0 } }
    ];
    expect(sortRunsDesc(docs).map((d) => d.id)).toEqual(['new', 'old']);
  });

  it('handles raw millis numbers and ISO strings', () => {
    const docs = [
      { id: 'iso-old', timestamp: '2020-01-01T00:00:00Z' },
      { id: 'ms-new', timestamp: Date.now() }
    ];
    expect(sortRunsDesc(docs)[0].id).toBe('ms-new');
  });

  it('docs with an unreadable timestamp sort LAST (treated as 0)', () => {
    const docs = [
      { id: 'no-ts' },
      { id: 'has-ts', timestamp: { toMillis: () => 5000 } }
    ];
    expect(sortRunsDesc(docs).map((d) => d.id)).toEqual(['has-ts', 'no-ts']);
  });

  it('does NOT mutate the input array', () => {
    const docs = [
      { id: 'a', timestamp: { toMillis: () => 1 } },
      { id: 'b', timestamp: { toMillis: () => 2 } }
    ];
    const before = docs.map((d) => d.id);
    sortRunsDesc(docs);
    expect(docs.map((d) => d.id)).toEqual(before);
  });

  it('non-array input → empty array (defensive)', () => {
    expect(sortRunsDesc(null)).toEqual([]);
    expect(sortRunsDesc(undefined)).toEqual([]);
  });
});

describe('formatDeferral — non-PII id/before/after only (never a name)', () => {
  it('full deferral → ids + 1-decimal before/after', () => {
    expect(formatDeferral({ clientId: '2025992', serviceId: 'svc-7', serviceBefore: 50, serviceAfter: 48.5 }))
      .toEqual({ clientId: '2025992', serviceId: 'svc-7', before: '50.0', after: '48.5' });
  });

  it('missing ids → dash; missing hours → dash', () => {
    expect(formatDeferral({})).toEqual({ clientId: '—', serviceId: '—', before: '—', after: '—' });
  });

  it('empty deferral object / undefined → all dashes (no throw)', () => {
    expect(formatDeferral(undefined)).toEqual({ clientId: '—', serviceId: '—', before: '—', after: '—' });
  });

  it('numeric ids coerced to string', () => {
    const f = formatDeferral({ clientId: 2025992, serviceId: 12, serviceBefore: 0, serviceAfter: 0 });
    expect(f.clientId).toBe('2025992');
    expect(f.serviceId).toBe('12');
    expect(f.before).toBe('0.0');
    expect(f.after).toBe('0.0');
  });
});
