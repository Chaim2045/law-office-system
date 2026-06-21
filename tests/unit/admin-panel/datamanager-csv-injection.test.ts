/**
 * Integration tests — DataManager users-CSV export routes through the shared SSOT
 * CSV/formula-injection encoder (security/datamanager-csv-injection).
 *
 * `exportToCSV()` builds the users-list CSV the admin downloads from the index page
 * (wired from the "ייצוא" button in FilterBar → window.DataManager.exportToCSV).
 * BEFORE this fix it wrapped each cell in "..." with NO quote-doubling AND NO
 * formula-injection guard — the LAST live CSV sink of the same class as #386
 * (ClientsTable). A user display name like `=cmd|' /C calc'!A1` executed as a
 * formula when the admin opened the download.
 *
 * The fix routes EVERY cell through `window.CsvSafe.cell` (the SSOT encoder
 * apps/admin-panel/js/core/csv-safe.js, introduced by #384, already wired live on
 * index.html by #385) — NOT a new inline copy — and fails secure if the encoder
 * is missing. The neutralization logic itself is unit-tested by csv-safe's own
 * suite; THESE tests prove the customer scenario end-to-end (G4):
 *   - a poisoned user name / email / role cell comes out of the downloaded CSV as
 *     inert text, never a live formula, and
 *   - if the encoder is not loaded, the export FAILS SECURE (aborts, Hebrew notice).
 *
 * Created: 2026-06-21 — security/datamanager-csv-injection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// constants.js MUST load first — the DataManager singleton is built at module load
// (`new DataManager()`) and its constructor reads window.ADMIN_PANEL_CONSTANTS.CACHE.
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/core/constants.js';
// The SSOT encoder MUST be present before DataManager's export runs (mirrors the
// <script> tag on index.html). Import it so window.CsvSafe is defined.
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/core/csv-safe.js';
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/managers/DataManager.js';

// window.DataManager is the singleton instance (new DataManager()).
const dataManager: any = (window as any).DataManager;
const savedCsvSafe: any = (window as any).CsvSafe;

// A quoted CSV field must NEVER open directly onto a formula trigger. After
// neutralization every triggered cell opens with a single quote (`"'=...`).
const OPENS_ONTO_TRIGGER = /(?:^|[,\n])"[=+\-@\t\r]/;

// Feed exportToCSV its data source (the filtered users list).
function setUsers(rows: any[]) {
  dataManager.filteredUsers = rows;
}

describe('DataManager CSV wiring', () => {
  it('the shared CsvSafe encoder is loaded (load contract)', () => {
    expect(savedCsvSafe).toBeTruthy();
    expect(typeof savedCsvSafe.cell).toBe('function');
  });

  it('exportToCSV has a fail-secure ensureCsvSafe guard (no inline copy)', () => {
    expect(typeof dataManager.ensureCsvSafe).toBe('function');
  });
});

// --- integration: prove the downloaded CSV is inert (G4) ---------------------
// Capture the CSV string by stubbing the Blob constructor + URL.createObjectURL.

describe('DataManager.exportToCSV — the customer scenario (G4)', () => {
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

  it('poisoned user name / email / role cells are neutralized', () => {
    setUsers([{
      username: '=HYPERLINK("http://evil","x")',
      email: '+evil@example.com',
      role: '@admin',
      isActive: true,
      clientsCount: 3,
      tasksCount: 7,
      hoursThisWeek: 5,
      hoursThisMonth: 20
    }]);

    dataManager.exportToCSV();

    expect(captured).toContain("'=HYPERLINK(");   // user name — formula-prefixed
    expect(captured).toContain('""http://evil""'); // ...with RFC-4180 quote-doubling intact
    expect(captured).toContain("'+evil@example.com"); // email
    expect(captured).toContain("'@admin");         // role string (via getRoleText)
    // No quoted cell anywhere opens directly onto a live formula trigger.
    expect(captured).not.toMatch(OPENS_ONTO_TRIGGER);
  });

  it('each leading formula trigger (= + - @) is neutralized in the user-name cell', () => {
    for (const payload of ['=cmd', '+1', '-1', '@x']) {
      captured = '';
      setUsers([{
        username: payload,
        email: 'user@example.com',
        role: 'employee',
        isActive: true,
        clientsCount: 0,
        tasksCount: 0,
        hoursThisWeek: 0,
        hoursThisMonth: 0
      }]);
      dataManager.exportToCSV();
      expect(captured).toContain(`'${payload}`);
      expect(captured).not.toMatch(OPENS_ONTO_TRIGGER);
    }
  });

  it('legitimate values are unchanged (no false-positive single quote)', () => {
    setUsers([{
      username: 'משה לוי',
      email: 'moshe@example.com',
      role: 'admin',
      isActive: true,
      clientsCount: 5,
      tasksCount: 2,
      hoursThisWeek: 3,
      hoursThisMonth: 12
    }]);

    dataManager.exportToCSV();

    expect(captured).toContain('"משה לוי"');
    expect(captured).toContain('"moshe@example.com"');
    expect(captured).not.toContain("'משה"); // no stray text-marker on a clean cell
  });

  it('FAIL-SECURE: if CsvSafe is not loaded, the export ABORTS (no CSV) + Hebrew notice', () => {
    const notifyCalls: Array<{ msg: string; title: string }> = [];
    (window as any).notify = { error: (msg: string, title: string) => notifyCalls.push({ msg, title }) };
    delete (window as any).CsvSafe; // simulate js/core/csv-safe.js not loaded

    setUsers([{
      username: '=cmd',
      email: 'x@example.com',
      role: 'employee',
      isActive: true,
      clientsCount: 0,
      tasksCount: 0,
      hoursThisWeek: 0,
      hoursThisMonth: 0
    }]);

    dataManager.exportToCSV();

    expect(captured).toBe(''); // aborted before building/emitting any CSV
    expect(notifyCalls.length).toBe(1);
    expect(notifyCalls[0].msg).toMatch(/[֐-׿]/); // Hebrew error text
  });
});
