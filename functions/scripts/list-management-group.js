/**
 * list-management-group.js — READ-ONLY diagnostic.
 *
 * Answers "who is management?" before we lock the case-open / addServiceToClient
 * authz gate. The system has THREE overlapping notions of admin:
 *   - employees.role === 'admin'   (the assignable role; used by firestore.rules + admin-panel login)
 *   - employees.isAdmin === true   (a separate boolean elevation; honored by some CFs, NOT by rules)
 *   - no 'manager' / 'office-manager' role exists in the assignable set (admin|lawyer|employee)
 *
 * This prints every employee's role + isAdmin so we can see exactly who is in the
 * management group (role==='admin' OR isAdmin===true) and whether the two disagree.
 *
 * READ-ONLY: no writes, no claims changes, no --apply. Output goes to YOUR terminal
 * only (it prints employee emails — your own data — never commit the output).
 *
 * Run (same as the other scripts, with functions/secrets/service-account.json present):
 *   cd functions && node scripts/list-management-group.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH =
  process.env.SERVICE_ACCOUNT ||
  path.resolve(__dirname, '../secrets/service-account.json');

function fail(message) {
  console.error(`[list-management-group] FAIL: ${message}`);
  process.exit(1);
}

async function main() {
  // Prefer a service-account file if present; otherwise fall back to Application
  // Default Credentials (run `gcloud auth application-default login` first).
  if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    } catch (err) {
      fail(`Could not parse service account JSON: ${err.message}`);
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.GOOGLE_CLOUD_PROJECT || 'law-office-system-e4801'
      });
    } catch (err) {
      fail(`No service-account file at ${SERVICE_ACCOUNT_PATH} and Application Default Credentials failed (${err.message}). Run: gcloud auth application-default login`);
    }
  }

  const snap = await admin.firestore().collection('employees').get();
  const rows = [];
  snap.forEach((doc) => {
    const d = doc.data() || {};
    rows.push({
      email: doc.id,
      role: d.role || '(none)',
      isAdmin: d.isAdmin === true,
      isActive: d.isActive !== false,
      username: d.username || ''
    });
  });

  rows.sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email));

  console.log('\n=== employees: role + isAdmin (READ-ONLY) ===');
  console.log('email'.padEnd(34), 'role'.padEnd(10), 'isAdmin'.padEnd(9), 'active');
  console.log('-'.repeat(64));
  for (const r of rows) {
    console.log(
      r.email.padEnd(34),
      String(r.role).padEnd(10),
      String(r.isAdmin).padEnd(9),
      String(r.isActive)
    );
  }

  const roleAdmins = rows.filter((r) => r.role === 'admin');
  const flagAdmins = rows.filter((r) => r.isAdmin === true);
  const mgmtGroup = rows.filter((r) => r.role === 'admin' || r.isAdmin === true);
  // The cases the new gate would treat differently: isAdmin=true but role!=='admin'
  const flagOnly = rows.filter((r) => r.isAdmin === true && r.role !== 'admin');
  // …and the reverse: role admin without the flag
  const roleOnly = rows.filter((r) => r.role === 'admin' && r.isAdmin !== true);

  console.log('\n=== summary ===');
  console.log(`total employees:            ${rows.length}`);
  console.log(`role === 'admin':           ${roleAdmins.length}`);
  console.log(`isAdmin === true (flag):    ${flagAdmins.length}`);
  console.log(`management group (either):  ${mgmtGroup.length}`);
  console.log(`\n>>> isAdmin:true BUT role!='admin' (office-managers a role-only gate would LOCK OUT): ${flagOnly.length}`);
  flagOnly.forEach((r) => console.log(`      - ${r.email}  (role=${r.role}, isAdmin=true)`));
  console.log(`>>> role='admin' WITHOUT isAdmin flag (an isAdmin-only gate would lock out): ${roleOnly.length}`);
  roleOnly.forEach((r) => console.log(`      - ${r.email}  (role=admin, isAdmin=${r.isAdmin})`));
  console.log('\nDecision input: if the first count is 0, role==="admin" is sufficient; if >0, the gate must be (role==="admin" || isAdmin===true) to not lock those office-managers out.\n');

  process.exit(0);
}

main().catch((err) => fail(err && err.message ? err.message : String(err)));
