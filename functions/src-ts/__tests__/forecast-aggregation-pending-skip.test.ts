/**
 * forecast-aggregation — H.6.c-2 handler-level skip test
 * ─────────────────────────────────────────────────────────────────────────────
 * Proves the aggregation LOOP (`aggregateClientProfitabilityHandler`) never
 * writes a `client_profitability/{caseNumber}` doc for a `pending_signature`
 * client — while an `active` client in the same run IS written. Firestore is
 * fully mocked (routed by collection name); no emulator.
 */

// The module wraps its handler in onSchedule at import — make that hermetic.
jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_config: unknown, handler: unknown) => handler
}));

// Capture every client_profitability write.
const profitabilityWrites: string[] = [];
// Audit writer (safeRunAudit → logCriticalAction → audit_log .add).
const mockAuditAdd = jest.fn().mockResolvedValue({ id: 'audit-id' });

// The clients-collection docs the mocked firestore returns for a given test.
// Typed holder (avoids `any` on globalThis) shared with the mock factory.
const mockClientDocs: { docs: Array<{ id: string; data: () => { status: string }; exists: boolean }> } = { docs: [] };

jest.mock('firebase-admin', () => {
  // Per-collection routing for the DEFAULT app firestore.
  const firestoreFn = () => ({
    collection: (name: string) => {
      if (name === 'clients') {
        return { get: () => Promise.resolve({ docs: mockClientDocs.docs }) };
      }
      if (name === 'timesheet_entries') {
        // .where('clientId','==',x).get() → no entries (hours=0 is fine for this test)
        return { where: () => ({ get: () => Promise.resolve({ docs: [] }) }) };
      }
      if (name === 'client_profitability') {
        return {
          doc: (caseNumber: string) => ({
            set: (_doc: unknown) => {
              profitabilityWrites.push(caseNumber);
              return Promise.resolve();
            }
          })
        };
      }
      if (name === 'timesheet_entry_costs') {
        return { doc: () => ({ get: () => Promise.resolve({ exists: false, data: () => ({}) }) }) };
      }
      // audit_log (logCriticalAction)
      return { add: mockAuditAdd, doc: () => ({}) };
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (firestoreFn as any).FieldValue = { serverTimestamp: () => 'ts-sentinel' };
  return { firestore: firestoreFn };
});

jest.mock('../../shared/logger', () => ({
  info: () => {},
  warn: () => {},
  error: () => {}
}));

import { aggregateClientProfitabilityHandler } from '../profitability/forecast-aggregation';

/** A clients-collection doc snapshot with the given id + status. */
function clientDoc(id: string, status: string) {
  return { id, data: () => ({ status }), exists: true };
}

beforeEach(() => {
  profitabilityWrites.length = 0;
  mockAuditAdd.mockClear();
});

describe('aggregateClientProfitabilityHandler — H.6.c-2 pending_signature skip', () => {
  it('writes an aggregate for the active client but NOT for the pending_signature client', async () => {
    mockClientDocs.docs = [
      clientDoc('2025001', 'active'),
      clientDoc('2025002', 'pending_signature'),
      clientDoc('2025003', 'archived') // still aggregated (client-level; archived is a SERVICE filter)
    ];

    const result = await aggregateClientProfitabilityHandler();

    // pending_signature produced NO client_profitability doc
    expect(profitabilityWrites).not.toContain('2025002');
    // active + archived clients were written
    expect(profitabilityWrites).toContain('2025001');
    expect(profitabilityWrites).toContain('2025003');
    expect(profitabilityWrites).toHaveLength(2);

    // the skipped client counts as scanned-but-not-written, not failed
    expect(result.clientsScanned).toBe(3);
    expect(result.clientsWritten).toBe(2);
    expect(result.clientsFailed).toBe(0);
    expect(result.ok).toBe(true);
  });

  it('a run of ONLY pending_signature clients writes nothing and does not fail', async () => {
    mockClientDocs.docs = [
      clientDoc('2025010', 'pending_signature'),
      clientDoc('2025011', 'pending_signature')
    ];

    const result = await aggregateClientProfitabilityHandler();

    expect(profitabilityWrites).toHaveLength(0);
    expect(result.clientsScanned).toBe(2);
    expect(result.clientsWritten).toBe(0);
    expect(result.clientsFailed).toBe(0);
    expect(result.ok).toBe(true);
  });
});
