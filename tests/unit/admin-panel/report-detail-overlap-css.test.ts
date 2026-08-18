/**
 * Fix — report detail: the date/preset/calendar section overlapping the stage list.
 * ─────────────────────────────────────────────────────────────────────────────
 * On a multi-stage legal service, opening "מותאם אישית" (the inline flatpickr
 * calendar) made the period section — "תקופת הדוח" label + the preset chips + the
 * date line — render ON TOP of the last stage rows (שלב ג' / שלב ד'). Reproduced +
 * measured: `.report-period` started at y=164 while `.report-stage-list` ran to
 * y=280 → a ~116px overlap.
 *
 * Root cause: `.report-detail` is BOTH a flex column AND the `.cm-detail` scroll
 * container (`max-height: 60vh; overflow-y: auto`). `.report-service-detail` (the
 * stage-list pane) carries an explicit `min-height: 96px`, which overrides flex's
 * default `min-height: auto`. So once the stage list + the open calendar push the
 * total past 60vh, the flex algorithm SHRINKS the pane toward 96px instead of
 * letting the container scroll — and the stage rows (overflow visible) spill DOWN
 * over the period section.
 *
 * Fix: `flex-shrink: 0` on `.report-service-detail` → it keeps its content height;
 * overflow then happens on `.cm-detail` (scroll), as intended. Re-measured after
 * the fix: `.report-period` top = 296 sits below the stage-list bottom = 280 → no
 * overlap. This suite pins the fix + the two container facts it depends on.
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const CSS = fs.readFileSync(path.resolve(ADMIN, 'css/clients-modals.css'), 'utf8');

function ruleBody(selector: string): string {
  const idx = CSS.indexOf(selector + ' {');
  expect(idx, `selector not found: ${selector}`).toBeGreaterThan(-1);
  const open = CSS.indexOf('{', idx);
  return CSS.slice(open + 1, CSS.indexOf('}', open));
}

describe('fix · report-detail overlap (stage list vs period section)', () => {
  it('THE FIX: .report-service-detail is flex-shrink:0 (keeps content height, cannot collapse)', () => {
    const body = ruleBody('.report-service-detail');
    expect(body).toMatch(/flex-shrink:\s*0/);
    // the explicit min-height that made it shrinkable stays (it reserves the empty-state height).
    expect(body).toMatch(/min-height:\s*96px/);
  });

  it('the container the fix relies on is intact: .cm-detail scrolls (max-height 60vh + overflow-y auto)', () => {
    const body = ruleBody('.cm-detail');
    expect(body).toMatch(/max-height:\s*60vh/);
    expect(body).toMatch(/overflow-y:\s*auto/);
  });
});
