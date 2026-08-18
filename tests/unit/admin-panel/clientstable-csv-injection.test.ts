/**
 * Integration tests — ClientsTable Excel/CSV export routes through the shared SSOT
 * CSV/formula-injection encoder (security/clientstable-csv-injection).
 *
 * `exportToExcel()` builds the clients-list CSV the admin downloads and opens in
 * Excel / Google Sheets. BEFORE this fix it wrapped each cell in "..." with NO
 * quote-doubling AND NO formula-injection guard (the worst of the admin-panel CSV
 * sinks) — a LIVE client name like `=cmd|' /C calc'!A1` executed as a formula.
 *
 * The fix routes EVERY cell through `window.CsvSafe.cell` (the SSOT encoder
 * apps/admin-panel/js/core/csv-safe.js, introduced by #384, already wired live by
 * #385) — NOT a new inline copy — and fails secure if the encoder is missing.
 * The neutralization logic itself is unit-tested by csv-safe's own suite; THESE
 * tests prove the customer scenario end-to-end (G4):
 *   - a poisoned client name / case number / assignedTo cell comes out of the
 *     downloaded CSV as inert text, never a live formula, and
 *   - if the encoder is not loaded, the export FAILS SECURE (aborts, Hebrew notice).
 *
 * Created: 2026-06-17 — security/clientstable-csv-injection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// The SSOT encoder MUST be present before ClientsTable's export runs (mirrors the
// <script> tags on clients.html / clients-fluent.html). Import it first so
// window.CsvSafe is defined when exportToExcel() runs.
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/core/csv-safe.js';
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/ui/ClientsTable.js';

// window.ClientsTable is the singleton instance (new ClientsTable()).
const clientsTable: any = (window as any).ClientsTable;
const savedCsvSafe: any = (window as any).CsvSafe;

// A quoted CSV field must NEVER open directly onto a formula trigger. After
// neutralization every triggered cell opens with a single quote (`"'=...`).
const OPENS_ONTO_TRIGGER = /(?:^|[,\n])"[=+\-@\t\r]/;

// Feed exportToExcel its data source + neutralize the unrelated date helper.
function setRows(rows: any[]) {
  clientsTable.dataManager = { filteredClients: rows };
  clientsTable.getTeamLastLogin = () => '01/06/2026';
}

describe('ClientsTable CSV wiring', () => {
  it('the shared CsvSafe encoder is loaded (load contract)', () => {
    expect(savedCsvSafe).toBeTruthy();
    expect(typeof savedCsvSafe.cell).toBe('function');
  });

  it('exportToExcel has a fail-secure ensureCsvSafe guard (no inline copy)', () => {
    expect(typeof clientsTable.ensureCsvSafe).toBe('function');
  });
});

// --- integration: prove the downloaded CSV is inert (G4) ---------------------
// Capture the CSV string by stubbing the Blob constructor + URL.createObjectURL.

describe('ClientsTable.exportToExcel — the customer scenario (G4)', () => {
  let captured = '';
  const RealBlob = globalThis.Blob;
  const realCreateObjectURL = URL.createObjectURL;

  beforeEach(() => {
    captured = '';
    (window as any).CsvSafe = savedCsvSafe; // present for the happy-path tests
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

  it('poisoned client name / case number / assignedTo cells are neutralized', () => {
    setRows([{
      fullName: '=HYPERLINK("http://evil","x")',
      caseNumber: '+2025003',
      typeDisplay: { kind: 'hours', label: 'שעות', breakdown: [] },
      hoursRemaining: 5,
      status: 'active',
      assignedTo: ['@evil', 'דוד']
    }]);

    clientsTable.exportToExcel();

    expect(captured).toContain("'=HYPERLINK(");   // client name — formula-prefixed
    expect(captured).toContain('""http://evil""'); // ...with RFC-4180 quote-doubling intact
    expect(captured).toContain("'+2025003");       // case number
    expect(captured).toContain("'@evil");          // assignedTo join starts with @
    // No quoted cell anywhere opens directly onto a live formula trigger.
    expect(captured).not.toMatch(OPENS_ONTO_TRIGGER);
  });

  it('each leading formula trigger (= + - @) is neutralized in the client-name cell', () => {
    for (const payload of ['=cmd', '+1', '-1', '@x']) {
      captured = '';
      setRows([{
        fullName: payload,
        caseNumber: '2025001',
        typeDisplay: { kind: 'hours', label: 'שעות', breakdown: [] },
        hoursRemaining: 1,
        status: 'active',
        assignedTo: []
      }]);
      clientsTable.exportToExcel();
      expect(captured).toContain(`'${payload}`);
      expect(captured).not.toMatch(OPENS_ONTO_TRIGGER);
    }
  });

  it('legitimate values are unchanged (no false-positive single quote)', () => {
    setRows([{
      fullName: 'משה לוי',
      caseNumber: '2025002',
      typeDisplay: { kind: 'hours', label: 'שעות', breakdown: [] },
      hoursRemaining: 5,
      status: 'active',
      assignedTo: ['דוד כהן']
    }]);

    clientsTable.exportToExcel();

    expect(captured).toContain('"משה לוי"');
    expect(captured).toContain('"דוד כהן"');
    expect(captured).not.toContain("'משה"); // no stray text-marker on a clean cell
  });

  it('FAIL-SECURE: if CsvSafe is not loaded, the export ABORTS (no CSV) + Hebrew notice', () => {
    const notifyCalls: Array<{ msg: string; title: string }> = [];
    (window as any).notify = { error: (msg: string, title: string) => notifyCalls.push({ msg, title }) };
    delete (window as any).CsvSafe; // simulate js/core/csv-safe.js not loaded

    setRows([{
      fullName: '=cmd',
      caseNumber: '1',
      typeDisplay: { kind: 'hours', label: 'שעות', breakdown: [] },
      hoursRemaining: 1,
      status: 'active',
      assignedTo: []
    }]);

    clientsTable.exportToExcel();

    expect(captured).toBe(''); // aborted before building/emitting any CSV
    expect(notifyCalls.length).toBe(1);
    expect(notifyCalls[0].msg).toMatch(/[֐-׿]/); // Hebrew error text
  });
});
