/**
 * Unit tests — submit-guard (PR-1: duplicate-timesheet fix)
 * ─────────────────────────────────────────────────────────────────────────
 * The two LOAD-BEARING submit guards for `submitTimeEntry`, as pure functions
 * (no DOM / no Firebase):
 *
 *   - mintIdempotencyKey(): one key per submission; it must be minted ONCE and
 *     reused across the 3 auto-retries, and its shape must satisfy the
 *     server-side validator (/^[A-Za-z0-9_-]+$/, non-empty, ≤200 chars). The
 *     "minted once" contract is a caller responsibility in main.js — here we
 *     pin that the function is deterministic-per-call (each CALL yields a fresh
 *     valid key) and that a single minted key is a stable string reused as-is.
 *
 *   - isOffline(): true ONLY when navigator.onLine === false; a missing
 *     navigator or onLine=true → online (submit proceeds).
 *
 * Same extraction + injectable-dependency pattern as budget-crossing.test.ts.
 */
import { describe, it, expect } from 'vitest';

// @ts-ignore — ESM helper module imported into a TS ESM test.
import { mintIdempotencyKey, isOffline } from '../../../apps/user-app/js/modules/submit-guard.js';

// The exact server-side validator (functions/addTimeToTask_v2.js IDEMPOTENCY_KEY_REGEX).
const SERVER_KEY_REGEX = /^[A-Za-z0-9_-]+$/;

describe('mintIdempotencyKey', () => {
  it('uses crypto.randomUUID when available', () => {
    const key = mintIdempotencyKey({ randomUUID: () => 'fixed-uuid-value' });
    expect(key).toBe('fixed-uuid-value');
  });

  it('falls back to a timestamp+random token when randomUUID is absent', () => {
    const key = mintIdempotencyKey({}); // no randomUUID
    expect(key.startsWith('addtime_')).toBe(true);
  });

  it('produces a key that satisfies the server-side validator (uuid path)', () => {
    const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    const key = mintIdempotencyKey({ randomUUID: () => uuid });
    expect(SERVER_KEY_REGEX.test(key)).toBe(true);
    expect(key.length).toBeGreaterThan(0);
    expect(key.length).toBeLessThanOrEqual(200);
  });

  it('produces a key that satisfies the server-side validator (fallback path)', () => {
    const key = mintIdempotencyKey({});
    expect(SERVER_KEY_REGEX.test(key)).toBe(true);
    expect(key.length).toBeLessThanOrEqual(200);
  });

  it('a single minted key is a stable string (reused verbatim across retries)', () => {
    // The "minted once" contract: main.js mints ONE key outside the retry closure
    // and passes the SAME reference each attempt. We pin that the value is a plain
    // immutable string — reusing it yields identical bytes.
    const key = mintIdempotencyKey({ randomUUID: () => 'retry-stable-key' });
    const attempt1 = key;
    const attempt2 = key;
    const attempt3 = key;
    expect(attempt1).toBe('retry-stable-key');
    expect(attempt2).toBe(attempt1);
    expect(attempt3).toBe(attempt1);
  });

  it('successive CALLS yield distinct keys (each submission is unique)', () => {
    const a = mintIdempotencyKey({ randomUUID: () => 'uuid-a' });
    const b = mintIdempotencyKey({ randomUUID: () => 'uuid-b' });
    expect(a).not.toBe(b);
  });
});

describe('isOffline', () => {
  it('true when navigator.onLine === false', () => {
    expect(isOffline({ onLine: false })).toBe(true);
  });

  it('false when navigator.onLine === true', () => {
    expect(isOffline({ onLine: true })).toBe(false);
  });

  it('false when navigator is missing (non-browser / unknown)', () => {
    expect(isOffline(undefined as any)).toBe(false);
  });

  it('false when onLine is undefined (does not block on an unknown signal)', () => {
    expect(isOffline({} as any)).toBe(false);
  });
});
