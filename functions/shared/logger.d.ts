/**
 * Type declarations for `functions/shared/logger.js` (PR-Pre-H.0.0.B)
 * ─────────────────────────────────────────────────────────────────────────────
 * The shim itself is JavaScript (CommonJS) because it's consumed by the
 * existing 37 legacy JS modules. TypeScript callers in `functions/src-ts/`
 * need type-safety; this co-located .d.ts file provides it without enabling
 * `allowJs` in the TS compile (which would broaden the surface drastically).
 *
 * Keep the signatures in lockstep with `logger.js` — when adding a method
 * there, add it here too. The .d.ts is the contract; the .js is the impl.
 */

export type LogFields = Record<string, unknown>;

export declare function info(action: string, fields?: LogFields): void;
export declare function warn(action: string, fields?: LogFields): void;
export declare function error(action: string, fields?: LogFields): void;
export declare function debug(action: string, fields?: LogFields): void;

/**
 * Raw `firebase-functions/logger` — escape hatch for advanced cases that need
 * direct severity setters. Avoid unless the structured helpers above are
 * insufficient (e.g., assertion-style structured severity testing).
 */
export declare const _raw: unknown;
