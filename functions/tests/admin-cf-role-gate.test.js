/**
 * PR-SEC-A · admin-CF role gate — broken-function-level-authorization fix.
 *
 * A security red-team (2026-08-10) found a family of MANAGEMENT Cloud Functions that
 * authenticated (`checkUserPermissions`) but never enforced `role === 'admin'` — so an
 * authenticated non-admin employee could call them DIRECTLY (bypassing the admin-only UI)
 * and rewrite any client's lifecycle/billing, and bypass the #535 hours-gate via a direct
 * `changeServiceStatus` reopen.
 *
 * Verified against the LIVE code (SYSTEM_MAP was stale): these 9 CFs have NO live caller
 * outside the admin-panel and NO internal/trigger caller → admin-only is correct. The fix
 * mirrors the pre-existing gate at clients/index.js setServiceOverride.
 *
 * `addServiceToClient` + `createClient` were EXCLUDED by PR-SEC-A (user-app case creation).
 * PR-SEC-A2 (2026-08-10, Haim's data-verified decision) REVERSES that exclusion: opening a
 * case and adding a service are admin-only management actions. Data check (read-only
 * list-management-group.js over ADC): 5 role='admin' (incl. the office manager), 10
 * role='lawyer', 0 with the isAdmin flag → role==='admin' is the sole live management
 * definition and locks nobody legitimate out. This also closes addServiceToClient's
 * billing-IDOR (any employee could add a service with an arbitrary fixedPrice to ANY client).
 * The user-app open-case / add-service buttons are hidden from non-admins in a frontend
 * fast-follow; until then a lawyer gets a clean Hebrew permission-denied toast.
 */
const fs = require('fs');
const path = require('path');

const FN = path.resolve(__dirname, '..');
const servicesSrc = fs.readFileSync(path.join(FN, 'services', 'index.js'), 'utf8');
const clientsSrc = fs.readFileSync(path.join(FN, 'clients', 'index.js'), 'utf8');

function cfBlock(src, name) {
  const start = src.indexOf(`exports.${name} = functions.https.onCall`);
  expect(start).toBeGreaterThan(-1);
  const nextExport = src.indexOf('\nexports.', start + 1);
  return src.slice(start, nextExport === -1 ? undefined : nextExport);
}

function assertAdminGated(src, name) {
  const block = cfBlock(src, name);
  const authIdx = block.indexOf('await checkUserPermissions(context)');
  const gateIdx = block.indexOf("user.role !== 'admin'");
  expect(authIdx).toBeGreaterThan(-1);
  expect(gateIdx).toBeGreaterThan(-1);
  expect(gateIdx).toBeGreaterThan(authIdx); // the gate comes AFTER auth
  expect(block).toContain("'permission-denied'");
}

const GATED_SERVICES = ['addServiceToClient', 'addPackageToService', 'addHoursPackageToStage',
  'moveToNextStage', 'completeService', 'changeServiceStatus', 'deleteService',
  'updatePackagePurchaseDate'];
const GATED_CLIENTS = ['createClient', 'changeClientStatus', 'closeCase'];

describe('PR-SEC-A + A2 · every admin-only management CF gates on role !== admin, after auth', () => {
  GATED_SERVICES.forEach((name) => {
    it(`services/${name} — admin role gate present, after checkUserPermissions`, () => {
      assertAdminGated(servicesSrc, name);
    });
  });

  GATED_CLIENTS.forEach((name) => {
    it(`clients/${name} — admin role gate present, after checkUserPermissions`, () => {
      assertAdminGated(clientsSrc, name);
    });
  });
});
