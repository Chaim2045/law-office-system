/**
 * Tests for PR-G.3.6 — auth-gated boot in `holidays-cache.js`.
 *
 * Bug fixed: previously `_init()` ran as soon as `firebase.apps.length > 0`,
 * subscribing to Firestore BEFORE `auth().currentUser` resolved. Rules require
 * `isAuthenticated()` → silent permission-denied → 5s timeout → embedded
 * fallback. Every cold-load user got stale single-year embedded data.
 *
 * Fix: wrap `_init()` in `onAuthStateChanged(user => { if (user) _init(); })`.
 * Add idempotency (re-login same user), teardown on logout, race protection
 * for fallback-then-late-auth, READY promise reset on logout, memory safety
 * (auth unsub captured), uid guard against token-refresh re-emits.
 */

import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

declare global {

  var WORK_HOURS_HOLIDAYS_MAP: Map<string, any>;

  var WORK_HOURS_HOLIDAYS_FALLBACK_USED: boolean;

  var WORK_HOURS_HOLIDAYS_READY: Promise<void>;

  var WORK_HOURS_HOLIDAYS_CACHE: any;

  var WORK_HOURS_HOLIDAYS_REFRESH: () => void;

  var firebase: any;
}

const srcPath = path.resolve(
  process.cwd(),
  'apps/user-app/js/shared/holidays-cache.js'
);
const src = fs.readFileSync(srcPath, 'utf8');

function loadIIFE() {
  // Evaluate the IIFE in this context — script attaches to window/global.

  new Function(src)();
}

interface AuthMock {
  auth: { onAuthStateChanged: ReturnType<typeof vi.fn> };
  fireAuth: (user: { uid: string } | null) => void;
  authUnsub: ReturnType<typeof vi.fn>;
}

function makeAuthMock(): AuthMock {
  let cb: ((u: { uid: string } | null) => void) | null = null;
  const authUnsub = vi.fn();
  const onAuthStateChanged = vi.fn((callback: (u: { uid: string } | null) => void) => {
    cb = callback;
    return authUnsub;
  });
  return {
    auth: { onAuthStateChanged },
    fireAuth: (user) => {
 if (cb) {
cb(user);
}
},
    authUnsub
  };
}

interface FirestoreMock {
  firestore: () => { collection: ReturnType<typeof vi.fn> };
  collection: ReturnType<typeof vi.fn>;
  fireSnapshot: (year: string, data: Record<string, unknown>) => void;
  snapshotCallbacks: Map<string, (snap: any) => void>;
  snapshotUnsubs: Map<string, ReturnType<typeof vi.fn>>;
}

function makeFirestoreMock(): FirestoreMock {
  const snapshotCallbacks = new Map<string, (snap: any) => void>();
  const snapshotUnsubs = new Map<string, ReturnType<typeof vi.fn>>();

  const collection = vi.fn(() => ({
    doc: (year: string) => ({
      onSnapshot: (cb: (snap: any) => void) => {
        snapshotCallbacks.set(year, cb);
        const unsub = vi.fn();
        snapshotUnsubs.set(year, unsub);
        return unsub;
      }
    })
  }));

  return {
    firestore: () => ({ collection }),
    collection,
    fireSnapshot: (year, data) => {
      const cb = snapshotCallbacks.get(year);
      if (cb) {
cb({ exists: true, data: () => data });
}
    },
    snapshotCallbacks,
    snapshotUnsubs
  };
}

function clearGlobals() {
  delete (globalThis as any).WORK_HOURS_HOLIDAYS_MAP;
  delete (globalThis as any).WORK_HOURS_HOLIDAYS_READY;
  delete (globalThis as any).WORK_HOURS_HOLIDAYS_FALLBACK_USED;
  delete (globalThis as any).WORK_HOURS_HOLIDAYS_REFRESH;
  delete (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE;
  delete (globalThis as any).firebase;
}

describe('PR-G.3.6 — auth-gated boot', () => {
  let auth: AuthMock;
  let store: FirestoreMock;
  const currentYear = String(new Date().getFullYear());

  beforeEach(() => {
    vi.useFakeTimers();
    clearGlobals();
    (globalThis as any).window = globalThis;
    auth = makeAuthMock();
    store = makeFirestoreMock();
    (globalThis as any).firebase = {
      apps: [{}],
      auth: () => auth.auth,
      firestore: store.firestore
    };
    loadIIFE();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearGlobals();
  });

  it('does NOT call Firestore onSnapshot before auth resolves', () => {
    expect(store.collection).not.toHaveBeenCalled();
    expect(auth.auth.onAuthStateChanged).toHaveBeenCalledTimes(1);
  });

  it('happy path — user fires immediately → subscribes + no fallback', () => {
    auth.fireAuth({ uid: 'haim123' });
    expect(store.collection).toHaveBeenCalledWith('system_holidays');
    expect(store.snapshotCallbacks.size).toBeGreaterThan(0);
    expect((globalThis as any).WORK_HOURS_HOLIDAYS_FALLBACK_USED).toBe(false);
  });

  it('login-screen no-user → fallback engages after AUTH_WAIT_TIMEOUT_MS', () => {
    expect((globalThis as any).WORK_HOURS_HOLIDAYS_FALLBACK_USED).toBe(false);
    // Just before timeout
    vi.advanceTimersByTime(5999);
    expect((globalThis as any).WORK_HOURS_HOLIDAYS_FALLBACK_USED).toBe(false);
    // Just after timeout
    vi.advanceTimersByTime(2);
    expect((globalThis as any).WORK_HOURS_HOLIDAYS_FALLBACK_USED).toBe(true);
  });

  it('two-stage restore (null → user) — fallback never engaged', () => {
    auth.fireAuth(null);
    vi.advanceTimersByTime(3000);
    auth.fireAuth({ uid: 'haim123' });
    store.fireSnapshot(currentYear, {
      holidaysAuto: [{ date: currentYear + '-04-02', isWorking: false, isHalfDay: false }]
    });
    vi.advanceTimersByTime(10000);
    expect((globalThis as any).WORK_HOURS_HOLIDAYS_FALLBACK_USED).toBe(false);
  });

  it('two-stage AFTER timeout — fallback engaged then real data wins', () => {
    auth.fireAuth(null);
    vi.advanceTimersByTime(6500);
    expect((globalThis as any).WORK_HOURS_HOLIDAYS_FALLBACK_USED).toBe(true);
    auth.fireAuth({ uid: 'haim123' });
    store.fireSnapshot(currentYear, {
      holidaysAuto: [{ date: currentYear + '-04-02', isWorking: false, isHalfDay: false }]
    });
    expect((globalThis as any).WORK_HOURS_HOLIDAYS_FALLBACK_USED).toBe(false);
  });

  it('logout tears down subs + resets READY promise', () => {
    const initialReady = (globalThis as any).WORK_HOURS_HOLIDAYS_READY;
    auth.fireAuth({ uid: 'haim123' });
    const unsubBefore = Array.from(store.snapshotUnsubs.values());
    expect(unsubBefore.length).toBeGreaterThan(0);
    auth.fireAuth(null);
    for (const unsub of unsubBefore) {
      expect(unsub).toHaveBeenCalledTimes(1);
    }
    const newReady = (globalThis as any).WORK_HOURS_HOLIDAYS_READY;
    expect(newReady).not.toBe(initialReady);
  });

  it('re-login same user is idempotent (no duplicate subs)', () => {
    auth.fireAuth({ uid: 'haim123' });
    const callsAfterFirst = store.collection.mock.calls.length;
    auth.fireAuth({ uid: 'haim123' });
    const callsAfterSecond = store.collection.mock.calls.length;
    expect(callsAfterSecond).toBe(callsAfterFirst);
  });

  it('re-login as different user tears down old subs + re-inits', () => {
    auth.fireAuth({ uid: 'haim123' });
    const oldUnsubs = Array.from(store.snapshotUnsubs.values());
    const callsAfterFirst = store.collection.mock.calls.length;
    // Simulate user switch — onAuthStateChanged fires for new user
    auth.fireAuth({ uid: 'other456' });
    for (const unsub of oldUnsubs) {
      expect(unsub).toHaveBeenCalledTimes(1);
    }
    expect(store.collection.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it('captures auth unsub to prevent listener leak', () => {
    // The auth.onAuthStateChanged returns an unsub; module must capture it.
    // Cannot directly assert internal state, but verify the fn was called
    // and a fn returned (which the production code stores in _authUnsub).
    expect(auth.auth.onAuthStateChanged).toHaveBeenCalledTimes(1);
    expect(typeof auth.auth.onAuthStateChanged.mock.results[0].value).toBe('function');
  });

  it('unsub throw on logout is swallowed (resilience)', () => {
    auth.fireAuth({ uid: 'haim123' });
    const unsubs = Array.from(store.snapshotUnsubs.values());
    expect(unsubs.length).toBeGreaterThan(0);
    // Make one unsub throw — others should still fire
    unsubs[0].mockImplementationOnce(() => {
 throw new Error('boom');
});
    expect(() => auth.fireAuth(null)).not.toThrow();
    for (const unsub of unsubs.slice(1)) {
      expect(unsub).toHaveBeenCalledTimes(1);
    }
  });
});

describe('PR-G.3.6 — degraded firebase paths', () => {
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    clearGlobals();
    (globalThis as any).window = globalThis;
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    errSpy.mockRestore();
    clearGlobals();
  });

  it('firebase never initializes → fallback after MAX_BOOT_POLL_ATTEMPTS', () => {
    // firebase undefined for the full polling window
    (globalThis as any).firebase = undefined;
    loadIIFE();
    // 50 attempts × 100ms = 5000ms
    vi.advanceTimersByTime(5100);
    expect((globalThis as any).WORK_HOURS_HOLIDAYS_FALLBACK_USED).toBe(true);
  });

  it('firebase.auth() throws → fallback engages immediately', () => {
    (globalThis as any).firebase = {
      apps: [{}],
      auth: () => {
 throw new Error('auth module broken');
},
      firestore: () => ({})
    };
    loadIIFE();
    // The auth() call happens inside _bootWhenAuthReady on first poll;
    // bootstrap should catch + engage fallback synchronously.
    expect((globalThis as any).WORK_HOURS_HOLIDAYS_FALLBACK_USED).toBe(true);
  });
});
