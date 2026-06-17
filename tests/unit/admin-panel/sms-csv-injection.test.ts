/**
 * Unit + integration tests — SMS CSV / Formula-Injection neutralization
 * (PR-SMS-CSV-INJECTION)
 *
 * Background: admin CSV exports are opened in Excel / Google Sheets. A cell whose
 * value STARTS with `= + - @` (or TAB / CR / LF) is evaluated as a formula by the
 * spreadsheet → data exfiltration / command execution (OWASP "CSV Injection").
 *
 * `window.CsvSafe.cell` is the shared SSOT neutralizer (js/core/csv-safe.js): it
 * prefixes a single quote when the value starts with a trigger char, then preserves
 * RFC-4180 quote-doubling, returning the INNER cell content (the caller wraps "...").
 *
 * `SMSManagement.convertToCSV` routes every value cell through it and fails closed
 * if the encoder script did not load. NOTE: SMSManagement.js is currently ORPHANED
 * (SYSTEM_MAP §D — loaded by no HTML), so this fix is defense-in-depth and
 * establishes the canonical encoder; the integration block proves convertToCSV
 * emits inert cells to the extent the path is reachable (G4 — see rubric).
 *
 * Created: 2026-06-17 — security/sms-csv-injection
 */

import { describe, it, expect } from 'vitest';

// csv-safe.js MUST load before SMSManagement.js (sets window.CsvSafe, used by
// convertToCSV). Both are classic IIFEs that assign to window (happy-dom provides it).
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/core/csv-safe.js';
// @ts-ignore
import '../../../apps/admin-panel/js/ui/SMSManagement.js';

const CsvSafe: any = (window as any).CsvSafe;
const SMSManagement: any = (window as any).SMSManagement;

// A quoted CSV field must NEVER open directly onto a formula trigger. After
// neutralization every triggered cell opens with a single quote (`"'=...`). This
// catches a live formula cell at the start of the file OR after any comma / newline.
const OPENS_ONTO_TRIGGER = /(?:^|[,\n])"[=+\-@\t\r\n]/;

describe('CsvSafe.cell — wiring', () => {
  it('is exposed as window.CsvSafe.cell', () => {
    expect(CsvSafe).toBeTruthy();
    expect(typeof CsvSafe.cell).toBe('function');
  });
});

describe('CsvSafe.cell — neutralizes leading formula triggers (OWASP)', () => {
  it('prefixes a single quote for each trigger char: = + - @ TAB CR LF', () => {
    expect(CsvSafe.cell('=1+1')).toBe("'=1+1");
    expect(CsvSafe.cell('+1+1')).toBe("'+1+1");
    expect(CsvSafe.cell('-2+3')).toBe("'-2+3");
    expect(CsvSafe.cell('@SUM(1)')).toBe("'@SUM(1)");
    expect(CsvSafe.cell('\t=1')).toBe("'\t=1");
    expect(CsvSafe.cell('\r=1')).toBe("'\r=1");
    expect(CsvSafe.cell('\n=1')).toBe("'\n=1");
  });

  it('neutralizes the classic payloads', () => {
    // =HYPERLINK("http://evil","x") → leading quote, inner double-quotes doubled
    const hyperlink = CsvSafe.cell('=HYPERLINK("http://evil","x")');
    expect(hyperlink.startsWith("'=HYPERLINK(")).toBe(true);
    expect(hyperlink).toContain('""http://evil""');
    // =cmd|' /C calc'!A1 (DDE command-exec payload)
    expect(CsvSafe.cell("=cmd|' /C calc'!A1")).toBe("'=cmd|' /C calc'!A1");
  });
});

describe('CsvSafe.cell — leaves safe values untouched (no false positives)', () => {
  it('does NOT prefix Hebrew text, normal names, or digit-leading values', () => {
    expect(CsvSafe.cell('דוד כהן')).toBe('דוד כהן');
    expect(CsvSafe.cell('Acme Ltd')).toBe('Acme Ltd');
    expect(CsvSafe.cell('050-1234567')).toBe('050-1234567');
    expect(CsvSafe.cell('2026-06-17')).toBe('2026-06-17');
  });

  it('does NOT prefix when a trigger char appears MID-string (only leading matters)', () => {
    expect(CsvSafe.cell('a=b')).toBe('a=b');
    expect(CsvSafe.cell('david@example.com')).toBe('david@example.com');
    expect(CsvSafe.cell('total: 5-2')).toBe('total: 5-2');
  });
});

describe('CsvSafe.cell — RFC-4180 quote-doubling preserved', () => {
  it('doubles embedded double-quotes', () => {
    expect(CsvSafe.cell('say "hi"')).toBe('say ""hi""');
  });

  it('applies the trigger-prefix BEFORE doubling (combined case)', () => {
    // value starts with `=` AND contains quotes → prefix ' then double the inner quotes
    const r = CsvSafe.cell('="evil"');
    expect(r.startsWith("'=")).toBe(true);
    expect(r).toContain('""evil""');
  });

  it('coerces empty / null / undefined to an empty string', () => {
    expect(CsvSafe.cell('')).toBe('');
    expect(CsvSafe.cell(null)).toBe('');
    expect(CsvSafe.cell(undefined)).toBe('');
  });
});

// --- integration: prove SMSManagement.convertToCSV emits inert cells (G4) -----

describe('SMSManagement.convertToCSV — the export scenario', () => {
  it('neutralizes poisoned employee name / email / phone cells', () => {
    const csv = SMSManagement.convertToCSV([
      { 'שם': "=cmd|' /C calc'!A1", 'אימייל': '+evil@x.com', 'טלפון': '@SUM(1)', 'מאומת': 'כן' }
    ]);
    expect(csv).toContain("\"'=cmd|' /C calc'!A1\""); // name → leading quote inside transport quotes
    expect(csv).toContain("\"'+evil@x.com\"");         // email
    expect(csv).toContain("\"'@SUM(1)\"");             // phone
    // No quoted cell anywhere opens directly onto a live formula trigger.
    expect(csv).not.toMatch(OPENS_ONTO_TRIGGER);
  });

  it('leaves legitimate values unchanged (no false positives in the file)', () => {
    const csv = SMSManagement.convertToCSV([
      { 'שם': 'דוד כהן', 'אימייל': 'david@example.com', 'טלפון': '050-1234567', 'מאומת': 'לא' }
    ]);
    expect(csv).toContain('"דוד כהן"');
    expect(csv).toContain('"david@example.com"');
    expect(csv).toContain('"050-1234567"');
    // no stray single-quote was injected in front of a clean Hebrew cell
    expect(csv).not.toContain("'דוד");
  });

  it('returns an empty string for empty data', () => {
    expect(SMSManagement.convertToCSV([])).toBe('');
  });

  it('fails closed (throws) when the CsvSafe encoder is not loaded', () => {
    const saved = (window as any).CsvSafe;
    try {
      delete (window as any).CsvSafe;
      expect(() => SMSManagement.convertToCSV([{ 'שם': '=x' }])).toThrow();
    } finally {
      (window as any).CsvSafe = saved;
    }
  });
});
