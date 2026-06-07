/**
 * Integration tests for the Pre-H.1.0 idNumber (ת"ז) behavior of
 * createClient + updateClient (functions/clients/index.js).
 *
 * Customer scenarios proven:
 *  A. Creating a client WITH a valid ת"ז → stored on the client doc.
 *  B. Creating a client WITH an invalid ת"ז → rejected (Hebrew, invalid-argument),
 *     and the rejected value is NOT echoed in the error message (PII discipline).
 *  C. Creating a client WITHOUT a ת"ז → still succeeds; field stored as '' (optional).
 *  D. Updating a client and trying to change ת"ז → rejected (immutable).
 *
 * Mocks mirror the existing change-client-status.test.js harness. The REAL
 * validators module is used (so the real isValidIsraeliId check-digit runs).
 */
'use strict';

// ── Mocks (precede require) ──────────────────────────────────────────────────
const mockCreate = jest.fn(async () => ({}));
const mockUpdate = jest.fn(async () => ({}));
const mockSet = jest.fn(async () => ({}));
let mockClientDocSnap = { exists: true, data: () => ({ createdBy: 'testuser', idNumber: '' }) };
const mockGet = jest.fn(async () => mockClientDocSnap);

const mockDb = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({ create: mockCreate, get: mockGet, update: mockUpdate, set: mockSet }))
  }))
};

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n })),
    delete: jest.fn(() => 'DELETE')
  };
  const Timestamp = { fromDate: jest.fn((d) => ({ _ts: d.getTime() })) };
  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(() => mockDb, { FieldValue, Timestamp }),
    auth: jest.fn(() => ({ getUser: jest.fn() }))
  };
});

jest.mock('firebase-functions', () => {
  class HttpsError extends Error {
    constructor(code, message, details) {
      super(message);
      this.code = code;
      this.details = details;
    }
  }
  return {
    https: { onCall: jest.fn((fn) => fn), HttpsError },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() }
  };
});

const mockCheckUserPermissions = jest.fn();
jest.mock('../shared/auth', () => ({ checkUserPermissions: mockCheckUserPermissions }));

const mockLogAction = jest.fn();
jest.mock('../shared/audit', () => ({ logAction: mockLogAction }));

jest.mock('../case-number-transaction', () => ({
  generateCaseNumberWithTransaction: jest.fn(() => 'AUTO-2026000')
}));

jest.mock('../shared/client-writer', () => ({
  writeClientWithCanonicalAggregates: jest.fn()
}));

// NOTE: validators is intentionally NOT mocked — we exercise the real
// isValidIsraeliId check-digit algorithm through the CF.

// ── Requires (after mocks) ───────────────────────────────────────────────────
const { createClient, updateClient } = require('../clients/index');

const VALID_USER = { uid: 'user1', email: 'test@test.com', username: 'testuser', role: 'manager' };
const VALID_ID = '123456782'; // correct check digit
const INVALID_ID = '123456789'; // wrong check digit
const ctx = { auth: { uid: 'user1', token: { email: 'test@test.com', role: 'manager' } } };

function hoursClientData(overrides = {}) {
  return { clientName: 'לקוח טסט', procedureType: 'hours', totalHours: 20, serviceName: 'שירות שעות', ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckUserPermissions.mockResolvedValue(VALID_USER);
  mockClientDocSnap = { exists: true, data: () => ({ createdBy: 'testuser', idNumber: '' }) };
});

describe('createClient — idNumber (ת"ז)', () => {
  it('A. stores a valid ת"ז on the created client doc', async () => {
    await createClient(hoursClientData({ idNumber: VALID_ID }), ctx);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const written = mockCreate.mock.calls[0][0];
    expect(written.idNumber).toBe(VALID_ID);
  });

  it('B. rejects an invalid ת"ז WITHOUT echoing the value in the error', async () => {
    expect.assertions(4);
    try {
      await createClient(hoursClientData({ idNumber: INVALID_ID }), ctx);
    } catch (err) {
      expect(err.code).toBe('invalid-argument');
      expect(err.message).toBe('מספר תעודת הזהות אינו תקין');
      expect(err.message).not.toContain(INVALID_ID); // no PII leak in the error
    }
    expect(mockCreate).not.toHaveBeenCalled(); // creation aborted before the write
  });

  it('C. succeeds with NO ת"ז and stores it as empty string (optional field)', async () => {
    await createClient(hoursClientData(), ctx);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0].idNumber).toBe('');
  });

  it('C2. treats blank / whitespace ת"ז as not-provided (stored as empty)', async () => {
    await createClient(hoursClientData({ idNumber: '   ' }), ctx);
    expect(mockCreate.mock.calls[0][0].idNumber).toBe('');
  });
});

describe('updateClient — idNumber immutability', () => {
  it('D. rejects any attempt to change ת"ז after creation', async () => {
    expect.assertions(2);
    try {
      await updateClient({ clientId: 'AUTO-2026000', idNumber: VALID_ID }, ctx);
    } catch (err) {
      expect(err.code).toBe('invalid-argument');
      expect(err.message).toBe('לא ניתן לעדכן תעודת זהות לאחר יצירת הלקוח');
    }
  });

  it('D2. does NOT write idNumber even if other valid fields are present', async () => {
    try {
      await updateClient({ clientId: 'AUTO-2026000', idNumber: VALID_ID, fullName: 'שם חדש' }, ctx);
    } catch (_) { /* expected throw */ }
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
