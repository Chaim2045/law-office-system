/**
 * PR-3c — the first reader of `hoursCapacity`, and the progress-bar polarity fix.
 *
 * Two changes on the partners' primary screen:
 *
 *  1. THE PHANTOM LINE. A second line under the hours figure naming how many of
 *     the contracted hours are actually available now. Purely additive — it
 *     feeds no badge, icon, counter, filter, sort or export. `activeHours` is a
 *     CAPACITY figure and `remaining` is a BALANCE; pairing a stage-filtered
 *     numerator with an unfiltered denominator would drive every client past
 *     stage A negative and block them (plan §4, ruling P4).
 *
 *  2. THE BAR POLARITY. It used to fill with `remaining / total` — a fullness
 *     bar, unique in this codebase. So shrinking a client's real capacity made
 *     the bar fill MORE and an over-drawn client look healthier. Now it fills
 *     with consumption, like every other meter in the app.
 *
 * The polarity change alters what an admin sees in EVERY row, so it is pinned
 * here rather than left to inspection.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect, beforeAll } from 'vitest';

const SRC = readFileSync(
  resolve(__dirname, '../../../apps/admin-panel/js/ui/ClientsTable.js'),
  'utf8'
);

const CSS = readFileSync(
  resolve(__dirname, '../../../apps/admin-panel/css/clients.css'),
  'utf8'
);

// The renderer is a method on a classic-script singleton. Rather than boot the
// whole admin app, extract the pure method and evaluate it standalone — it
// depends on nothing but its argument.
let renderCapacityNote: (client: any) => string;

beforeAll(() => {
  const start = SRC.indexOf('renderCapacityNote(client) {');
  if (start === -1) {
throw new Error('renderCapacityNote not found in ClientsTable.js');
}

  // Walk braces to the end of the method.
  let depth = 0;
  let end = -1;
  for (let i = SRC.indexOf('{', start); i < SRC.length; i++) {
    if (SRC[i] === '{') {
depth++;
} else if (SRC[i] === '}') {
      depth--;
      if (depth === 0) {
 end = i + 1; break;
}
    }
  }
  if (end === -1) {
throw new Error('could not delimit renderCapacityNote');
}

  const body = SRC.slice(SRC.indexOf('{', start), end);

  renderCapacityNote = new Function('client', `return (function(client)${body})(client);`) as any;
});

const cap = (activeHours: number, contractHours: number, phantomHours: number) => ({
  hoursCapacity: {
    activeHours, contractHours, phantomHours,
    unknownStatusStageCount: 0, rule: 'active_stage_on_hours_accepting_service',
    ruleVersion: 1, schemaVersion: 1
  }
});

describe('the phantom line — when it appears', () => {
  it('renders for a client with locked hours, naming both figures', () => {
    // 2025006 (תמיר אקווע): 355 contracted, 235 genuinely available.
    const html = renderCapacityNote(cap(235, 355, 120));
    expect(html).toContain('235.0');
    expect(html).toContain('355.0');
    expect(html).toContain('120.0');
    expect(html).toContain('נעולות');
  });

  it('renders NOTHING when there is no phantom — silence is the correct output', () => {
    expect(renderCapacityNote(cap(100, 100, 0)).trim()).toBe('');
  });

  it('renders NOTHING when the field is absent — never a placeholder, never a zero', () => {
    // The field is written only when a client is next written; until the
    // materialization script runs it is missing on most clients. A placeholder
    // on every row would be noise; a `0` would be a lie, because activeHours: 0
    // is a legitimate value for a client whose every service is closed.
    expect(renderCapacityNote({}).trim()).toBe('');
    expect(renderCapacityNote({ hoursCapacity: null }).trim()).toBe('');
    expect(renderCapacityNote(null).trim()).toBe('');
  });

  it('renders NOTHING below a tenth of an hour — rounding noise is not a finding', () => {
    expect(renderCapacityNote(cap(100, 100.04, 0.04)).trim()).toBe('');
  });

  it('a display extra never breaks a row on malformed input', () => {
    const bad = [
      { hoursCapacity: 'nonsense' },
      { hoursCapacity: {} },
      { hoursCapacity: { activeHours: NaN, contractHours: 10, phantomHours: 5 } },
      { hoursCapacity: { activeHours: 5, contractHours: undefined, phantomHours: 5 } },
      { hoursCapacity: { activeHours: '5', contractHours: '10', phantomHours: '5' } }
    ];
    for (const client of bad) {
      expect(() => renderCapacityNote(client)).not.toThrow();
      expect(renderCapacityNote(client).trim()).toBe('');
    }
  });

  it('carries an explanation, so the number is not a mystery', () => {
    const html = renderCapacityNote(cap(235, 355, 120));
    expect(html).toMatch(/title="[^"]*שטרם נפתחו[^"]*"/);
  });

  it('is Hebrew — no English leaks into the row', () => {
    const html = renderCapacityNote(cap(235, 355, 120));
    const text = html.replace(/<[^>]*>/g, '').replace(/[\d.·\s]/g, '');
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/[A-Za-z]/);
  });
});

describe('the progress bar fills with CONSUMPTION, not remainder', () => {
  it('the formula is used/total, and the old remaining/total is gone', () => {
    // The polarity is the whole point: with the old formula, shrinking a
    // client's real capacity made the bar fill MORE.
    expect(SRC).toContain('const used = totalHours - remaining;');
    expect(SRC).toMatch(/\(used \/ totalHours\) \* 100/);
    expect(SRC).not.toMatch(/\(remaining \/ totalHours\) \* 100/);
  });

  it('is clamped to 0..100 so a negative balance is a full bar, not an overflow', () => {
    expect(SRC).toMatch(/Math\.max\(0, Math\.min\(100,/);
  });

  it('the arithmetic behaves at the boundaries', () => {
    const pct = (total: number, remaining: number) => {
      const used = total - remaining;
      return total > 0 ? Math.max(0, Math.min(100, (used / total) * 100)) : 0;
    };
    expect(pct(100, 100)).toBe(0);    // nothing used → empty
    expect(pct(100, 50)).toBe(50);
    expect(pct(100, 0)).toBe(100);    // fully used → full
    expect(pct(100, -40)).toBe(100);  // over-drawn → full, not 140
    expect(pct(0, 0)).toBe(0);        // no contract → empty, no divide-by-zero
    expect(pct(100, 150)).toBe(0);    // more remaining than total → empty, not negative
  });
});

describe('additive only — nothing else on the row moved', () => {
  it('the hours figure still renders remaining / totalHours, untouched', () => {
    expect(SRC).toContain('${warningIcon}${remaining.toFixed(1)} / ${totalHours}');
  });

  it('the warning icon, badges and status logic still read hoursRemaining', () => {
    // If any of these had been switched to activeHours, alerts would silently
    // change. They must stay on the old basis until PR-5 pairs the denominator.
    expect(SRC).toMatch(/getHoursWarningIcon\(client\)/);
    expect(SRC).not.toMatch(/hoursCapacity[\s\S]{0,80}getHoursWarningIcon/);
  });

  it('the CSV export does not mention the new field', () => {
    const csvStart = SRC.indexOf('exportToExcel');
    expect(csvStart).toBeGreaterThan(-1);
    expect(SRC.slice(csvStart)).not.toContain('hoursCapacity');
  });

  it('hoursCapacity is read in exactly one place — the note renderer', () => {
    const reads = SRC.split('client.hoursCapacity').length - 1;
    expect(reads).toBe(1);
  });
});

describe('styling', () => {
  it('the note has a style rule and uses design tokens, not hardcoded colours', () => {
    expect(CSS).toContain('.hours-capacity-note');
    const block = CSS.slice(CSS.indexOf('.hours-capacity-note'), CSS.indexOf('.hours-capacity-note') + 400);
    expect(block).toMatch(/var\(--text-secondary\)/);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it('does not reference the undefined --text-tertiary token', () => {
    const noteBlocks = CSS.slice(CSS.indexOf('.hours-capacity-note'));
    expect(noteBlocks.slice(0, 600)).not.toContain('--text-tertiary,');
  });
});
