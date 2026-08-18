/**
 * Anchor test for the structured logger shim — גל-3ה TS-1 (2026-07-30)
 * ─────────────────────────────────────────────────────────────────────────────
 * The shim had NO dedicated test before the TS migration (consumers mock it, so
 * they'd pass regardless of its impl). This pins the PUBLIC SURFACE + forwarding
 * so the JS→TS migration cannot silently change the shape (e.g. `export =` vs
 * named exports, a dropped method, or a broken `_raw` escape hatch).
 *
 * Un-mocked: exercises the REAL compiled `functions/shared/logger.js`.
 */
import * as logger from '../../shared/logger';

describe('logger shim — public surface (TS-1 migration anchor)', () => {
  it('exposes the four structured methods as functions', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('exposes the `_raw` firebase-functions/logger escape hatch', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((logger as any)._raw).toBeDefined();
  });

  it('each method forwards (action, fields) to the underlying firebase-functions logger', () => {
    // `_raw` IS the same object the shim methods call into, so spying on it
    // intercepts the forwarding regardless of module internals.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (logger as any)._raw;
    const spies = (['info', 'warn', 'error', 'debug'] as const).map((m) =>
      jest.spyOn(raw, m).mockImplementation(() => undefined)
    );

    try {
      logger.info('svc.created', { entityId: 'c1' });
      logger.warn('svc.retry', { attempt: 2 });
      logger.error('svc.failed', { errorCode: 'E_X' });
      logger.debug('svc.trace', { step: 1 });

      expect(raw.info).toHaveBeenCalledWith('svc.created', { entityId: 'c1' });
      expect(raw.warn).toHaveBeenCalledWith('svc.retry', { attempt: 2 });
      expect(raw.error).toHaveBeenCalledWith('svc.failed', { errorCode: 'E_X' });
      expect(raw.debug).toHaveBeenCalledWith('svc.trace', { step: 1 });
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it('defaults `fields` to an empty object when omitted', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (logger as any)._raw;
    const spy = jest.spyOn(raw, 'info').mockImplementation(() => undefined);
    try {
      logger.info('svc.ping');
      expect(raw.info).toHaveBeenCalledWith('svc.ping', {});
    } finally {
      spy.mockRestore();
    }
  });
});
