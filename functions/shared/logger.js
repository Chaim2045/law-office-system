"use strict";
/**
 * Structured Logger Shim — PR-META-6 · migrated to TypeScript in גל-3ה TS-1 (2026-07-30)
 * ─────────────────────────────────────────────────────────────────────────────
 * Re-exports `firebase-functions/logger` so new code can use structured logging
 * with a consistent import path:
 *
 *   const logger = require('../shared/logger');   // legacy CommonJS callers
 *   logger.info('event_name', { entityId, userId, count });
 *
 *   import * as logger from '../shared/logger';    // TS callers (src-ts)
 *
 * vs. legacy code which uses `console.log()` (still works, still routed by the
 * Cloud Functions runtime to Cloud Logging at INFO level — but unstructured).
 *
 * ─── Build mechanism (A′, in-place) ──────────────────────────────────────────
 * This `.ts` is the SOURCE OF TRUTH. `functions/shared/tsconfig.json` compiles it
 * IN PLACE to `functions/shared/logger.js` (+ generated `logger.d.ts`) at the
 * IDENTICAL path, so all existing `require('../shared/logger')` /
 * `import * as logger from '../shared/logger'` consumers resolve unchanged. The
 * emitted `.js`/`.d.ts` are committed (repo deploys committed output). The old
 * hand-written `.d.ts` "keep in lockstep" burden is GONE — the declaration is now
 * generated from this file.
 *
 * ─── Why a shim, not direct import ───────────────────────────────────────────
 * 1) Single seam if we later swap to OpenTelemetry / Datadog / custom backend.
 * 2) Easy to enforce via ESLint rule (`no-restricted-imports`) — the rule will
 *    forbid `firebase-functions/logger` outside this file and force the shim.
 * 3) Centralized place to add PII redaction in the future.
 *
 * ─── PUBLIC REPO SAFETY ──────────────────────────────────────────────────────
 * The repository is public. CI logs are world-readable. Callers MUST NOT pass:
 *   - Twilio credentials (process.env.TWILIO_*)
 *   - Firebase Auth tokens (context.auth.token)
 *   - Full request bodies that may contain client PII
 *   - Raw error stack traces in user-visible paths (G1 of PRODUCT-GRADE Gates)
 *
 * Structured fields you SHOULD include:
 *   - action: 'service_created' | 'service_creation_emergency_override' | ...
 *   - entityId: clientId / serviceId / userId (NOT email or phone)
 *   - actor: { uid } only — never include email or full token
 *   - durationMs, statusCode, correlationId
 *
 * ─── Migration policy ────────────────────────────────────────────────────────
 * - NEW code (functions/src-ts/, new modules added from META-6 onwards): use
 *   this shim. Treat console.* as forbidden in new files.
 * - LEGACY code (existing console.* calls): NO mass rewrite. Refactor
 *   opportunistically when touching a file for another reason.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports._raw = void 0;
exports.info = info;
exports.warn = warn;
exports.error = error;
exports.debug = debug;
const ffLogger = __importStar(require("firebase-functions/logger"));
/**
 * Structured info-level log.
 * @param action - dot.separated.event_name (snake_case)
 * @param fields - structured fields; avoid PII (see file header)
 */
function info(action, fields = {}) {
    ffLogger.info(action, fields);
}
/** Structured warning. Use for recoverable issues / unexpected-but-handled state. */
function warn(action, fields = {}) {
    ffLogger.warn(action, fields);
}
/**
 * Structured error. Use for failures requiring investigation.
 * NEVER pass raw user-facing errors — strip PII before logging.
 */
function error(action, fields = {}) {
    ffLogger.error(action, fields);
}
/**
 * Debug-level — typically filtered out in production by Cloud Logging
 * sampling. Safe to leave in code; do not rely on it for monitoring.
 */
function debug(action, fields = {}) {
    ffLogger.debug(action, fields);
}
/**
 * Raw `firebase-functions/logger` — escape hatch for advanced cases that need
 * direct severity setters. Use sparingly.
 */
// Explicitly typed `unknown` (NOT the inferred namespace type) so the GENERATED
// `.d.ts` is deterministic across environments — matches the old hand-written
// contract and never varies with whether firebase-functions types resolve.
exports._raw = ffLogger;
