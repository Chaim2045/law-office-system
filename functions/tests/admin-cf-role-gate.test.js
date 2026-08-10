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
 * `addServiceToClient` is DELIBERATELY EXCLUDED — it is also called from the USER APP
 * (case creation), so admin-gating it would break a live employee flow; its concern is
 * IDOR/ownership, not admin-only. This suite LOCKS that exclusion too, so a future change
 * can't silently admin-gate it.
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

const GATED_SERVICES = ['addPackageToService', 'addHoursPackageToStage', 'moveToNextStage',
  'completeService', 'changeServiceStatus', 'deleteService', 'updatePackagePurchaseDate'];
const GATED_CLIENTS = ['changeClientStatus', 'closeCase'];

describe('PR-SEC-A · every admin-only management CF gates on role !== admin, after auth', () => {
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

  it('addServiceToClient is DELIBERATELY NOT admin-gated (live user-app case creation must keep working)', () => {
    const block = cfBlock(servicesSrc, 'addServiceToClient');
    expect(block).toContain('await checkUserPermissions(context)');
    const validationIdx = block.indexOf('// Validation');
    const gateIdx = block.indexOf("user.role !== 'admin'");
    // No admin gate at the top (between auth and the first validation). If someone adds one,
    // this fails on purpose — a reminder that the user-app calls this for case creation.
    const gatedAtTop = gateIdx > -1 && gateIdx < validationIdx;
    expect(gatedAtTop).toBe(false);
  });
});
