/**
 * Integration tests — ReportGenerator CSV exports route through the shared SSOT
 * CSV/formula-injection encoder (PR-SEC-3).
 *
 * The admin downloads these CSVs and opens them in Excel / Google Sheets. A cell whose
 * value STARTS with `= + - @` (or TAB / CR / LF) is evaluated as a formula by the
 * spreadsheet → data exfiltration / command execution (OWASP "CSV Injection").
 *
 * PR-SEC-3 routes every user-controllable string cell in `generateExcel` +
 * `generateEmployeeCSV` through the SSOT encoder `window.CsvSafe.cell`
 * (apps/admin-panel/js/core/csv-safe.js, introduced by PR-SMS-CSV-INJECTION #384) —
 * NOT a second inline copy. The neutralization logic itself is unit-tested by
 * csv-safe's own suite; THESE tests prove the customer scenario end-to-end:
 *   - a poisoned client/employee/description/task value comes out of the downloaded
 *     CSV as inert text, never as a live formula (G4), and
 *   - if the encoder is not loaded, the export FAILS SECURE (aborts, Hebrew notice)
 *     rather than emitting an un-neutralized CSV.
 *
 * Created: 2026-06-17 — security/csv-injection-report-generator-pr-sec-3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// The SSOT encoder MUST be loaded before ReportGenerator (mirrors the <script> order
// wired into clients.html / clients-fluent.html / index.html). Import it first so
// window.CsvSafe is defined when ReportGenerator's exports run.
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/core/csv-safe.js';
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/managers/ReportGenerator.js';

const reportGenerator: any = (window as any).ReportGenerator;
const savedCsvSafe: any = (window as any).CsvSafe;

// A quoted CSV field must NEVER open directly onto a formula trigger. After neutralization
// every triggered cell opens with a single quote (`"'=...`). This catches a live formula
// cell at the start of the file OR after any comma / newline (covers first-and-later cells).
const OPENS_ONTO_TRIGGER = /(?:^|[,\n])"[=+\-@\t\r]/;

describe('PR-SEC-3 wiring', () => {
  it('the shared CsvSafe encoder is loaded (load-order contract)', () => {
    expect(savedCsvSafe).toBeTruthy();
    expect(typeof savedCsvSafe.cell).toBe('function');
  });

  it('ReportGenerator does NOT keep a second inline neutralizer (csvCell removed — SSOT)', () => {
    // The neutralization lives ONLY in window.CsvSafe.cell; ReportGenerator must not
    // re-declare its own csvCell copy.
    expect(reportGenerator.csvCell).toBeUndefined();
    expect(typeof reportGenerator.ensureCsvSafe).toBe('function');
  });
});

// --- integration: prove the downloaded CSV is inert (G4) ---------------------
// Capture the CSV string by stubbing the Blob constructor (no dependency on Blob.text())
// and stubbing URL.createObjectURL so the download path doesn't throw on the fake blob.

describe('generateExcel / generateEmployeeCSV — the customer scenario (G4)', () => {
  let captured = '';
  const RealBlob = globalThis.Blob;
  const realCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    captured = '';
    (window as any).CsvSafe = savedCsvSafe; // ensure present for the happy-path tests
    // @ts-ignore — capture the CSV parts without relying on Blob.text()
    globalThis.Blob = function (parts: unknown[]) {
      captured = (parts || []).join('');
    } as any;
    // @ts-ignore
    URL.createObjectURL = () => 'blob:mock';
  });

  afterEach(() => {
    globalThis.Blob = RealBlob;
    URL.createObjectURL = realCreateObjectURL;
    (window as any).CsvSafe = savedCsvSafe;
    (window as any).notify = undefined;
  });

  it('generateExcel: poisoned employee / service / description / task cells are neutralized', () => {
    reportGenerator.dataManager = { getEmployeeName: (e: unknown) => e };
    reportGenerator.generateExcel({
      client: { fullName: 'לקוח רגיל', caseNumber: '2025001' },
      timesheetEntries: [{
        date: '2026-06-17',
        employee: "=cmd|' /C calc'!A1",
        serviceName: '+SERVICE',
        minutes: 60,
        action: '=HYPERLINK("http://evil","x")'
      }],
      budgetTasks: [{
        taskName: '@taskname', status: 'active', estimatedHours: 1, actualMinutes: 30, deadline: null
      }],
      stats: { totalHours: 1, entriesCount: 1 },
      formData: { startDate: '2026-06-01', endDate: '2026-06-30' }
    });

    expect(captured).toContain("'=cmd|' /C calc'!A1"); // employee name
    expect(captured).toContain("'+SERVICE");            // service name
    expect(captured).toContain("'=HYPERLINK(");         // description neutralized
    expect(captured).toContain('""http://evil""');      // ...with quote-doubling intact
    expect(captured).toContain("'@taskname");           // task name
    // No quoted cell anywhere opens directly onto a live formula trigger.
    expect(captured).not.toMatch(OPENS_ONTO_TRIGGER);
  });

  it('generateEmployeeCSV: poisoned employee name / client name / description cells are neutralized', () => {
    reportGenerator.generateEmployeeCSV({
      employee: { name: '=cmd', dailyTarget: 8 },
      period: { label: 'יוני 2026', year: 2026, month: 6 },
      summary: {
        totalHours: 10, clientHours: 8, internalHours: 2,
        workingDays: 5, dailyAverage: 2, quotaPercent: 80
      },
      clientBreakdown: [{ name: '@evilclient', hours: 3, count: 2, percent: 30 }],
      entries: {
        internal: [{ date: '2026-06-01', action: '+internal note', minutes: 30 }],
        client: [{ date: '2026-06-02', clientName: '-client', action: '=desc', minutes: 60 }]
      }
    });

    expect(captured).toContain("'=cmd");          // employee name
    expect(captured).toContain("'@evilclient");   // client breakdown name
    expect(captured).toContain("'+internal note"); // internal description
    expect(captured).toContain("'-client");        // client entry name
    expect(captured).toContain("'=desc");          // client entry description
    expect(captured).not.toMatch(OPENS_ONTO_TRIGGER);
  });

  it('generateExcel: legitimate values are unchanged (no false positives in the file)', () => {
    reportGenerator.dataManager = { getEmployeeName: (e: unknown) => e };
    reportGenerator.generateExcel({
      client: { fullName: 'משה לוי', caseNumber: '2025002' },
      timesheetEntries: [{
        date: '2026-06-17', employee: 'דוד כהן', serviceName: 'ייעוץ', minutes: 45, action: 'פגישה עם הלקוח'
      }],
      budgetTasks: [],
      stats: { totalHours: 0.75, entriesCount: 1 },
      formData: { startDate: '2026-06-01', endDate: '2026-06-30' }
    });

    expect(captured).toContain('"דוד כהן"');
    expect(captured).toContain('"ייעוץ"');
    expect(captured).toContain('"פגישה עם הלקוח"');
    // no stray single-quote was injected in front of a clean Hebrew cell
    expect(captured).not.toContain("'דוד");
  });

  it('FAIL-SECURE: if the CsvSafe encoder is not loaded, the export ABORTS (no CSV emitted) + Hebrew notice', () => {
    const notifyCalls: Array<{ msg: string; title: string }> = [];
    (window as any).notify = { error: (msg: string, title: string) => notifyCalls.push({ msg, title }) };
    delete (window as any).CsvSafe; // simulate the script not loaded

    reportGenerator.dataManager = { getEmployeeName: (e: unknown) => e };
    reportGenerator.generateExcel({
      client: { fullName: 'לקוח', caseNumber: '1' },
      timesheetEntries: [{ date: '2026-06-17', employee: '=cmd', serviceName: 'x', minutes: 1, action: 'y' }],
      budgetTasks: [],
      stats: { totalHours: 0, entriesCount: 1 },
      formData: { startDate: '2026-06-01', endDate: '2026-06-30' }
    });

    expect(captured).toBe(''); // aborted before building/emitting any CSV
    expect(notifyCalls.length).toBe(1);
    expect(notifyCalls[0].msg).toMatch(/[֐-׿]/); // Hebrew error text
  });
});
