/**
 * Test setup for TypeScript tests under functions/src-ts/
 * ─────────────────────────────────────────────────────────────────────────────
 * Introduced in PR-META-6.
 *
 * Differences from the legacy ./setup.js:
 *   - Does NOT mock global.console — new tests can assert on structured logger
 *     output, and the firebase-functions/logger shim is visible.
 *   - Same emulator host configuration (Firestore + Auth) so cross-project
 *     test infrastructure (firebase-functions-test) works identically.
 *
 * Public-repo safety note (the repo is PUBLIC — CI logs are world-readable):
 *   Tests in src-ts/ MUST NOT log raw client data, PII, or auth tokens. The
 *   logger shim itself is fine; what callers pass into it is the surface.
 *   When in doubt, use the same redaction patterns enforced in production
 *   code (no full request payload dumps).
 */
'use strict';

// Emulator hosts (must run before any firebase-admin import; the Admin SDK
// reads these at initializeApp time).
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.GCLOUD_PROJECT = 'test-project';

// Increase test timeout for Firebase operations (matches legacy setup).
jest.setTimeout(10000);
