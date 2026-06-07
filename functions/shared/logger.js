/**
 * Structured Logger Shim — PR-META-6
 * ─────────────────────────────────────────────────────────────────────────────
 * Re-exports `firebase-functions/logger` so new code can use structured logging
 * with a consistent import path:
 *
 *   const logger = require('../shared/logger');
 *   logger.info('event_name', { entityId, userId, count });
 *
 * vs. legacy code which uses `console.log()` (still works, still routed by the
 * Cloud Functions runtime to Cloud Logging at INFO level — but unstructured).
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
 * - LEGACY code (existing 816 console.* calls across 37 files): NO mass
 *   rewrite. Refactor opportunistically when touching a file for another
 *   reason. Adopt structured logging incrementally.
 */
'use strict';

const logger = require('firebase-functions/logger');

/**
 * Structured info-level log.
 *
 * @param {string} action - dot.separated.event_name (snake_case)
 * @param {object} [fields] - structured fields; avoid PII (see file header)
 */
function info(action, fields = {}) {
  logger.info(action, fields);
}

/**
 * Structured warning. Use for recoverable issues / unexpected-but-handled state.
 */
function warn(action, fields = {}) {
  logger.warn(action, fields);
}

/**
 * Structured error. Use for failures requiring investigation.
 * NEVER pass raw user-facing errors — strip PII before logging.
 */
function error(action, fields = {}) {
  logger.error(action, fields);
}

/**
 * Debug-level — typically filtered out in production by Cloud Logging
 * sampling. Safe to leave in code; do not rely on it for monitoring.
 */
function debug(action, fields = {}) {
  logger.debug(action, fields);
}

module.exports = {
  info,
  warn,
  error,
  debug,
  // Re-export the raw firebase-functions/logger for advanced cases that need
  // direct access (e.g., structured severity setters). Use sparingly.
  _raw: logger,
};
