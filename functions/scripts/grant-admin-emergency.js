#!/usr/bin/env node
/**
 * grant-admin-emergency.js — Break-glass admin claim grant (Pre-H.0.0.B)
 * ─────────────────────────────────────────────────────────────────────────────
 * WHEN TO USE: only as a last resort.
 *
 * The normal flow:
 *   - Production admin promotes a user via the Admin Panel UI, which calls
 *     `setAdminClaims` (callable). That endpoint requires an existing admin.
 *
 * The bootstrap problem this script solves:
 *   - If NO user has an admin claim (e.g., disaster recovery after a Firebase
 *     Auth restore, or initial environment setup), there's no admin to promote
 *     anyone else. This script uses an Admin-SDK service account to bypass
 *     the callable gate.
 *
 * USAGE
 * ─────
 *   1. Place a service-account JSON at the path given by SERVICE_ACCOUNT env
 *      var, or at functions/secrets/service-account.json (gitignored — see
 *      .gitignore patterns `service-account*.json` / `firebase-admin-key.json`).
 *      The service account needs the "Firebase Authentication Admin" role on
 *      the target project.
 *   2. Set TARGET_UID and (optionally) TARGET_EMAIL_FOR_LOG env vars.
 *   3. Run with `--apply` to actually write. Without it, dry-run only.
 *
 *      node functions/scripts/grant-admin-emergency.js               # dry-run
 *      TARGET_UID=xyz node functions/scripts/grant-admin-emergency.js --apply
 *
 * SAFETY
 * ──────
 *   - Defaults to DRY-RUN (logs intent, no write). `--apply` is required.
 *   - Refuses to run if the target ALREADY has the dual-shape claim
 *     ({admin:true, role:'admin'}) — prevents accidental re-runs.
 *   - Writes the dual-shape claim {admin:true, role:'admin'} matching the
 *     `setAdminClaims` and `initializeAdminClaims` production endpoints.
 *   - The service account JSON is gitignored. Never commit it. CI does not
 *     run this script. The repo is PUBLIC.
 *
 * AFTER USE
 * ─────────
 *   - Document in your incident log: who ran it, when, target uid, why the
 *     normal flow was unavailable.
 *   - Run `firebase functions:call verifyClaims` to confirm the claim landed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const TARGET_UID = process.env.TARGET_UID;
const TARGET_EMAIL_FOR_LOG = process.env.TARGET_EMAIL_FOR_LOG || '<not provided>';
const SERVICE_ACCOUNT_PATH =
  process.env.SERVICE_ACCOUNT ||
  path.resolve(__dirname, '../secrets/service-account.json');

function fail(message) {
  // Intentional console — this is a CLI tool, not a Cloud Function.
  console.error(`[grant-admin-emergency] FAIL: ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[grant-admin-emergency] ${message}`);
}

async function main() {
  if (!TARGET_UID) {
    fail('TARGET_UID env var is required. Example: TARGET_UID=abc123 node grant-admin-emergency.js --apply');
  }

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    fail(`Service account file not found at ${SERVICE_ACCOUNT_PATH}. Set SERVICE_ACCOUNT env var or place at functions/secrets/service-account.json.`);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  } catch (err) {
    fail(`Could not parse service account JSON: ${err.message}`);
  }

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

  // Verify the target user exists
  let userRecord;
  try {
    userRecord = await admin.auth().getUser(TARGET_UID);
  } catch (err) {
    fail(`Could not fetch target user (${TARGET_UID}): ${err.code || err.message}`);
  }

  const existing = userRecord.customClaims || {};
  const alreadyDualShape = existing.admin === true && existing.role === 'admin';

  info(`Target UID: ${TARGET_UID}`);
  info(`Target email (per Auth):  ${userRecord.email || '<unknown>'}`);
  info(`Target email (per env):   ${TARGET_EMAIL_FOR_LOG}`);
  info(`Existing claims: ${JSON.stringify(existing)}`);

  if (alreadyDualShape) {
    info('Target ALREADY has dual-shape admin claim. No write needed.');
    process.exit(0);
  }

  if (!APPLY) {
    info('DRY-RUN: would write { admin: true, role: \'admin\' }. Re-run with --apply to commit.');
    process.exit(0);
  }

  await admin.auth().setCustomUserClaims(TARGET_UID, { admin: true, role: 'admin' });
  info(`✅ Granted dual-shape admin claim to ${TARGET_UID}.`);
  info('Document this in your incident log. Then run `verifyClaims` to confirm.');
  process.exit(0);
}

main().catch((err) => {
  fail(`Unexpected error: ${err.stack || err.message}`);
});
