/**
 * Report-tab stage-picker readability guard.
 * ─────────────────────────────────────────────────────────────────────────────
 * When the calendar is open (V3 side-by-side, narrow column) the stage name was
 * truncated to an unreadable "ש…" because the name, status pill and hours all
 * competed on ONE flex line. The fix stacks the name on its OWN full-width line
 * (`.report-stage-body`, a column) with status + hours on a quiet second line — so
 * the name is never truncated — plus a `title` carrying the VERBOSE stage name
 * (`getStageName` → "הליך משפטי - שלב א'") for hover context.
 *
 * Display-only: the selection contract (`data-stage-id` / `role="radio"` /
 * `aria-checked`, and getFormData's verbose-getStageName byte-match) is untouched.
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const read = (rel: string): string => fs.readFileSync(path.resolve(ADMIN, rel), 'utf8');
const JS = read('js/ui/ReportTab.js');
const CSS = read('css/clients-modals.css');

describe('report stage picker — name is always readable (no truncation)', () => {
  it('_stageRowHtml stacks the name in .report-stage-body with a .report-stage-meta line', () => {
    expect(JS).toContain('class="report-stage-body"');
    expect(JS).toContain('class="report-stage-meta"');
  });

  it('the stage name carries a title with the VERBOSE name (hover shows full context)', () => {
    expect(JS).toContain('class="report-stage-name" title="');
    expect(JS).toContain('esc(getStageName(stage.id))');
  });

  it('CSS: the body stacks vertically so the name gets a full-width line', () => {
    expect(CSS).toMatch(/\.report-stage-body\s*\{[^}]*flex-direction:\s*column/);
  });

  it('CSS: the truncation cause is gone — .report-stage-name no longer forces nowrap/ellipsis', () => {
    const rule = CSS.match(/\.report-stage-name\s*\{[^}]*\}/);
    expect(rule, '.report-stage-name rule found').not.toBeNull();
    const body = rule ? rule[0] : '';
    expect(body).not.toMatch(/white-space:\s*nowrap/);
    expect(body).not.toMatch(/text-overflow:\s*ellipsis/);
  });
});

describe('report stage picker — selection contract preserved (display-only change)', () => {
  it('the interactive row keeps role="radio" + aria-checked + data-stage-id', () => {
    expect(JS).toContain('role="radio"');
    expect(JS).toContain('aria-checked="');
    expect(JS).toContain('data-stage-id="');
  });

  it('the verbose getStageName is still the selection-side label (byte-match contract)', () => {
    // getFormData / _setStageSelection rely on the verbose "הליך משפטי - …" form.
    expect(JS).toContain("'הליך משפטי - '");
  });
});
