/**
 * Unit tests — ReportGenerator client-report HTML escaping (stored-XSS gap)
 *
 * The CLIENT report path (buildHTMLContent + renderPackagesTable) interpolates
 * user-controllable strings RAW into an HTML document that is rendered via
 * `document.write` (generateHTML). A client whose name / a timesheet description /
 * a package note contains markup (e.g. a name written RAW into the world-readable
 * `clients.fullName` by the H.6 cutover CF `createClientFromSalesRecord`) would
 * execute when a partner generates that client's activity report.
 *
 * Fix = escape at the sink via the existing `escapeHtml` helper (the EMPLOYEE
 * report path already does this). These tests prove every user-controllable sink
 * in the client path is now escaped — the raw payload must NEVER appear as a live
 * tag in the rendered HTML, only its escaped form.
 *
 * Created: 2026-06-17 — security/report-generator-xss-escape
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ReportGenerator.escapeHtml now DELEGATES to the shared SSOT window.escapeHtml
// (escapeHtml-dedup PR2) — import the SSOT FIRST so the global is defined when the
// report HTML is built below. Without this the routed escaper throws at call-time.
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/core/escape-html.js';

// ReportGenerator.js is an IIFE that assigns the singleton to window (happy-dom
// provides window). Import for side-effect, then read the instance off window.
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/managers/ReportGenerator.js';

const reportGenerator: any = (window as any).ReportGenerator;

// A canonical stored-XSS payload. Escaped form: `<` -> &lt;, `>` -> &gt;.
const XSS = '<img src=x onerror=alert(1)>';
const XSS_LIVE = '<img src=x onerror=alert(1)>';
const XSS_ESCAPED = '&lt;img src=x onerror=alert(1)&gt;';

// helper: count non-overlapping occurrences of a substring
function count(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

// --- the escapeHtml helper itself -------------------------------------------

describe('escapeHtml — helper', () => {
  it('is exposed on the ReportGenerator singleton', () => {
    expect(reportGenerator).toBeTruthy();
    expect(typeof reportGenerator.escapeHtml).toBe('function');
  });

  it('escapes all five HTML-significant characters', () => {
    expect(reportGenerator.escapeHtml('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#039;');
  });

  it('neutralizes an onerror <img> payload (no live tag survives)', () => {
    const out = reportGenerator.escapeHtml(XSS);
    expect(out).toBe(XSS_ESCAPED);
    expect(out).not.toContain('<img');
  });

  it('returns empty string for null/undefined (no "undefined" leak — G1)', () => {
    expect(reportGenerator.escapeHtml(null)).toBe('');
    expect(reportGenerator.escapeHtml(undefined)).toBe('');
  });
});

// --- the client report (buildHTMLContent) -----------------------------------

describe('buildHTMLContent — escapes every user-controllable sink in the client path', () => {
  beforeEach(() => {
    // renderTimesheetRows + renderServiceInfo reach for the data manager; stub it.
    // getEmployeeName echoes its arg so we can feed it a payload as the "employee".
    reportGenerator.dataManager = {
      getEmployeeName: (id: string) => id,
      getClientTimesheetEntries: () => []
    };
  });

  function reportDataWithPayloadEverywhere() {
    return {
      client: {
        fullName: XSS, // -> <title> (226) + info-value (482)
        caseNumber: XSS, // -> info-value (486)
        type: 'hours', // renders the hours/timesheet/summary sections
        services: []
      },
      formData: {
        service: XSS, // -> section title (502)
        reportType: 'full', // renders the timesheet table
        startDate: '2026-01-01',
        endDate: '2026-01-31'
      },
      timesheetEntries: [
        { date: '2026-01-10', action: XSS, employee: XSS, minutes: 60 } // -> 832 + 833
      ],
      budgetTasks: [],
      stats: {
        totalMinutes: 60,
        totalHours: 1,
        entriesCount: 1,
        byEmployee: [{ employee: XSS, employeeName: XSS, hours: 1, entries: 1, minutes: 60 }], // -> 527
        byService: [{ service: XSS, hours: 1, entries: 1, minutes: 60 }], // -> 576
        tasksStats: { total: 0, completed: 0, inProgress: 0, pending: 0 }
      },
      generatedAt: new Date('2026-02-01')
    };
  }

  it('NEVER emits the raw payload as a live tag anywhere in the document', () => {
    const html = reportGenerator.buildHTMLContent(reportDataWithPayloadEverywhere());
    // If any single sink rendered raw, the live tag would appear here and fail.
    expect(html).not.toContain(XSS_LIVE);
  });

  it('emits the escaped form for every active sink (>= 8 occurrences)', () => {
    const html = reportGenerator.buildHTMLContent(reportDataWithPayloadEverywhere());
    expect(html).toContain(XSS_ESCAPED);
    // title(226) + fullName(482) + caseNumber(486) + service(502) +
    // employeeName(527) + service.service(576) + entry.action(832) + employee(833)
    expect(count(html, XSS_ESCAPED)).toBeGreaterThanOrEqual(8);
  });

  it('escapes the two NAMED fullName sinks specifically (title + info-value)', () => {
    const html = reportGenerator.buildHTMLContent(reportDataWithPayloadEverywhere());
    expect(html).toContain(`<title>דוח פעילות ללקוח - ${XSS_ESCAPED}</title>`);
    expect(html).toContain(`<span class="info-value">${XSS_ESCAPED}</span>`);
  });
});

// --- the packages table (renderPackagesTable) -------------------------------

describe('renderPackagesTable — escapes service name and package description/reason', () => {
  it('escapes the service-name title (1165) and the package note (1194)', () => {
    const packages = [
      { type: 'נוספת', hours: 5, hoursUsed: 1, hoursRemaining: 4, purchaseDate: '2026-01-01', description: XSS },
      { type: 'נוספת', hours: 5, hoursUsed: 1, hoursRemaining: 4, purchaseDate: '2026-01-02', reason: XSS }
    ];
    const html = reportGenerator.renderPackagesTable(packages, XSS, null, null);
    expect(html).not.toContain(XSS_LIVE);
    expect(html).toContain(XSS_ESCAPED);
    // serviceName title + 2 package notes
    expect(count(html, XSS_ESCAPED)).toBeGreaterThanOrEqual(3);
  });
});

// --- date sinks are laundered through formatDate (not raw markup) ------------
// The report's date interpolations (formData.startDate/endDate at ~490, the
// service purchaseDate at ~768) are NOT escaped — they are passed through
// formatDate(), which runs the value through `new Date(...)` and emits only
// `toLocaleDateString('he-IL')`. A markup-bearing value therefore becomes an
// "Invalid Date" token, never a live tag. This proves that laundering holds so
// the "no live tag anywhere in the document" guarantee is real, not assumed.

describe('buildHTMLContent — date sinks cannot smuggle markup (formatDate laundering)', () => {
  beforeEach(() => {
    reportGenerator.dataManager = {
      getEmployeeName: (id: string) => id,
      getClientTimesheetEntries: () => []
    };
  });

  it('markup in form dates AND in a service purchasedAt never renders as a live tag', () => {
    const reportData = {
      client: {
        fullName: 'לקוח תקין',
        caseNumber: '1234567',
        type: 'hours',
        // purchaseDate path: dateService.purchasedAt.toDate() -> formatDate (line ~768)
        services: [{ name: 'svc', purchasedAt: { toDate: () => XSS } }]
      },
      formData: {
        service: 'svc',
        reportType: 'full',
        // attacker-controlled form fields laundered through formatDate (line ~490)
        startDate: '2026-01-01' + XSS,
        endDate: XSS
      },
      timesheetEntries: [],
      budgetTasks: [],
      stats: {
        totalMinutes: 0, totalHours: 0, entriesCount: 0,
        byEmployee: [], byService: [],
        tasksStats: { total: 0, completed: 0, inProgress: 0, pending: 0 }
      },
      generatedAt: new Date('2026-02-01')
    };
    const html = reportGenerator.buildHTMLContent(reportData);
    expect(html).not.toContain(XSS_LIVE);
  });
});
