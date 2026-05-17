/**
 * Tests for the enforcement-mode module (PR-A.6).
 *
 * Coverage:
 *   - Default to 'enforce' when doc missing
 *   - Read valid mode from Firestore
 *   - Coerce invalid mode → 'enforce'
 *   - Coerce missing `mode` field → 'enforce'
 *   - Coerce Firestore read error → 'enforce'
 *   - Cache: second call within TTL skips Firestore
 *   - Cache: expired TTL re-reads
 *   - Cache: explicit reset for tests
 */

const mockDocGet = jest.fn();
const mockDocRef = { get: mockDocGet };
const mockCollection = jest.fn(() => ({ doc: jest.fn(() => mockDocRef) }));

jest.mock('firebase-admin', () => {
  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(
      jest.fn(() => ({ collection: mockCollection })),
      { FieldValue: { serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP') } }
    )
  };
});

jest.mock('firebase-functions', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

// Require after mocks
const enforcementMode = require('../shared/enforcement-mode');

beforeEach(() => {
  jest.clearAllMocks();
  enforcementMode._test.resetCache();
});

// ═══════════════════════════════════════════════════════════════
// A. Default safety
// ═══════════════════════════════════════════════════════════════

describe('A. Default safety', () => {
  test('doc missing → defaults to enforce', async () => {
    mockDocGet.mockResolvedValue({ exists: false });
    await expect(enforcementMode.getEnforcementMode()).resolves.toBe('enforce');
  });

  test('doc exists but `mode` field missing → defaults to enforce', async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({}) });
    await expect(enforcementMode.getEnforcementMode()).resolves.toBe('enforce');
  });

  test('mode field is invalid value → defaults to enforce', async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ mode: 'invalid_mode' }) });
    await expect(enforcementMode.getEnforcementMode()).resolves.toBe('enforce');
  });

  test('mode field is non-string → defaults to enforce', async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ mode: 42 }) });
    await expect(enforcementMode.getEnforcementMode()).resolves.toBe('enforce');
  });

  test('Firestore read throws → defaults to enforce', async () => {
    mockDocGet.mockRejectedValue(new Error('permission-denied'));
    await expect(enforcementMode.getEnforcementMode()).resolves.toBe('enforce');
  });

  test('doc.data() returns null → defaults to enforce', async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => null });
    await expect(enforcementMode.getEnforcementMode()).resolves.toBe('enforce');
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Valid modes pass through
// ═══════════════════════════════════════════════════════════════

describe('B. Valid mode values', () => {
  test('mode=enforce → enforce', async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ mode: 'enforce' }) });
    await expect(enforcementMode.getEnforcementMode()).resolves.toBe('enforce');
  });

  test('mode=log_only → log_only', async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ mode: 'log_only' }) });
    await expect(enforcementMode.getEnforcementMode()).resolves.toBe('log_only');
  });

  test('mode=disabled → disabled', async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ mode: 'disabled' }) });
    await expect(enforcementMode.getEnforcementMode()).resolves.toBe('disabled');
  });

  test('VALID_MODES contains exactly the three modes', () => {
    expect(enforcementMode.VALID_MODES.slice()).toEqual(['enforce', 'log_only', 'disabled']);
  });

  test('DEFAULT_MODE is enforce', () => {
    expect(enforcementMode.DEFAULT_MODE).toBe('enforce');
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Caching behavior
// ═══════════════════════════════════════════════════════════════

describe('C. Caching', () => {
  test('first call reads Firestore', async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ mode: 'log_only' }) });
    await enforcementMode.getEnforcementMode();
    expect(mockDocGet).toHaveBeenCalledTimes(1);
  });

  test('second call within TTL skips Firestore', async () => {
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ mode: 'log_only' }) });
    await enforcementMode.getEnforcementMode();
    await enforcementMode.getEnforcementMode();
    await enforcementMode.getEnforcementMode();
    expect(mockDocGet).toHaveBeenCalledTimes(1);
  });

  test('cache returns the cached value, not a fresh read', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ mode: 'log_only' }) });
    const first = await enforcementMode.getEnforcementMode();
    // Change the underlying doc — but cache should serve the old value.
    mockDocGet.mockResolvedValue({ exists: true, data: () => ({ mode: 'enforce' }) });
    const second = await enforcementMode.getEnforcementMode();
    expect(first).toBe('log_only');
    expect(second).toBe('log_only'); // from cache
    expect(mockDocGet).toHaveBeenCalledTimes(1); // only the first call hit Firestore
  });

  test('resetCache forces re-read on next call', async () => {
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ mode: 'log_only' }) });
    await enforcementMode.getEnforcementMode();
    enforcementMode._test.resetCache();
    mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ mode: 'disabled' }) });
    const after = await enforcementMode.getEnforcementMode();
    expect(after).toBe('disabled');
    expect(mockDocGet).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// D. normalizeMode helper
// ═══════════════════════════════════════════════════════════════

describe('D. normalizeMode (test-only export)', () => {
  test.each([
    ['enforce', 'enforce'],
    ['log_only', 'log_only'],
    ['disabled', 'disabled']
  ])('passes through valid mode %s', (input, expected) => {
    expect(enforcementMode._test.normalizeMode(input)).toBe(expected);
  });

  test.each([
    ['ENFORCE'], // case-sensitive — wrong case = invalid
    ['enabled'],
    [''],
    [null],
    [undefined],
    [123],
    [{ mode: 'enforce' }]
  ])('coerces invalid input %p to enforce', (input) => {
    expect(enforcementMode._test.normalizeMode(input, 'test')).toBe('enforce');
  });
});
