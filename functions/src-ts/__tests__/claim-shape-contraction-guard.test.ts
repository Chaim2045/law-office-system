/**
 * Claim-shape contraction guard — Pre-H.0.0.E (cross-writer static invariants)
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-H.0.0.E retired the legacy `{admin:true}` field from the FOUR writers that
 * had been minting the dual shape. This guard locks that contraction at the
 * source level so a future refactor cannot silently re-introduce it (which would
 * resurrect the drift this PR eliminated):
 *
 *   1. functions/src-ts/set-admin-claims.ts        (v2 callable — grant)
 *   2. functions/src-ts/initialize-admin-claims.ts (v2 callable — bulk sync)
 *   3. functions/auth/index.js                     (v1 callable — grant + REVOKE)
 *   4. functions/scripts/grant-admin-emergency.js  (break-glass CLI)
 *
 * Group (4) adds a REPO-WIDE backstop over the OTHER role-claim writers that
 * were already `{role}`-only (master-admin-wrappers createUser/updateUser, the
 * auth createUser/linkAuthToEmployee path) — they never emitted the boolean, but
 * the backstop guarantees `admin:true` cannot creep back into ANY claim write.
 *
 * It ALSO provides the test for the v1 `setAdminClaim` REVOKE path (§7.4 step 3):
 * revoke now writes `{}` (full removal — setCustomUserClaims REPLACES the whole
 * claims object) rather than the legacy `{admin:false}` residue. The v1 callable
 * is an inline `functions.https.onCall(...)` with no separately-exported handler,
 * so a source-level invariant is the appropriate, in-pattern test layer (mirrors
 * the static AST guards the Pre-H.0.0.B suites already use for the writers).
 *
 * SCOPE NOTE — what this guard deliberately does NOT assert:
 *   The auth GATES that READ a caller's token (`claims.admin === true || ...`)
 *   and the consumer reads (admin-panel auth.js) are intentionally UNCHANGED in
 *   E — they keep accepting the legacy token shape for one token-refresh window
 *   and are retired in the §7.4 FOLLOW-UP PR. This guard targets WRITES only.
 *
 * Public-repo safety: reads source files only; no PII, no network, no writes.
 */
import * as fs from 'fs';
import * as path from 'path';

// ─── Writer source files (resolved relative to this test) ────────────────────
const SET_ADMIN_CLAIMS = path.resolve(__dirname, '../set-admin-claims.ts');
const INIT_ADMIN_CLAIMS = path.resolve(__dirname, '../initialize-admin-claims.ts');
const AUTH_INDEX = path.resolve(__dirname, '../../auth/index.js');
const GRANT_EMERGENCY = path.resolve(__dirname, '../../scripts/grant-admin-emergency.js');
const MASTER_ADMIN_WRAPPERS = path.resolve(__dirname, '../../admin/master-admin-wrappers.js');

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

/**
 * Strip block + line comments so source-shape assertions test CODE, not the
 * docblocks that legitimately mention the retired `{admin:false}`/`{admin:true}`
 * shapes. Sufficient for these specific files (no `//` inside string literals
 * that would collide with the patterns under test).
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

// ════════════════════════════════════════════════════════════════════════════
// (1) Every writer's claim WRITE is single-shape {role:'admin'} — no admin:true
// ════════════════════════════════════════════════════════════════════════════
describe('claim-shape contraction — writers emit role-only', () => {
  it('set-admin-claims.ts writes {role:\'admin\'} and never admin:true', () => {
    const src = read(SET_ADMIN_CLAIMS);
    expect(src).toMatch(/setCustomUserClaims\(\s*targetUid,\s*\{\s*role:\s*'admin'\s*\}\s*\)/);
    expect(src).not.toMatch(/setCustomUserClaims\([^)]*admin:\s*true/);
  });

  it('initialize-admin-claims.ts writes {role:\'admin\'} and never admin:true', () => {
    const src = read(INIT_ADMIN_CLAIMS);
    // The write spans multiple lines; [\s\S] crosses newlines, *? stays minimal.
    expect(src).toMatch(/setCustomUserClaims\([\s\S]*?\{\s*role:\s*'admin'\s*\}\s*\)/);
    expect(src).not.toMatch(/setCustomUserClaims\([^)]*admin:\s*true/);
  });

  it('grant-admin-emergency.js writes {role:\'admin\'} and never admin:true', () => {
    const src = read(GRANT_EMERGENCY);
    expect(src).toMatch(/setCustomUserClaims\(\s*TARGET_UID,\s*\{\s*role:\s*'admin'\s*\}\s*\)/);
    expect(src).not.toMatch(/setCustomUserClaims\([^)]*admin:\s*true/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (2) v1 setAdminClaim — grant {role:'admin'}, REVOKE {} (NOT {admin:false})
// ════════════════════════════════════════════════════════════════════════════
describe('claim-shape contraction — v1 setAdminClaim grant + revoke', () => {
  let code: string;
  // Comment-stripped: the docblock legitimately mentions the retired shapes.
  beforeAll(() => { code = stripComments(read(AUTH_INDEX)); });

  it('grant branch is {role:\'admin\'}, revoke branch is {} (full removal)', () => {
    // The contracted ternary: grant → role-only; revoke → empty object.
    expect(code).toMatch(
      /newClaims\s*=\s*isAdmin === true\s*\?\s*\{\s*role:\s*'admin'\s*\}\s*:\s*\{\s*\}/
    );
  });

  it('revoke no longer writes the legacy {admin:false} residue (in code)', () => {
    // setCustomUserClaims replaces the whole object; the empty `{}` clears the
    // role too. The legacy `{admin:false}` object literal must be gone from CODE.
    expect(code).not.toMatch(/\{\s*admin:\s*false\s*\}/);
  });

  it('the claim write uses the contracted newClaims variable', () => {
    expect(code).toMatch(/setCustomUserClaims\(\s*userRecord\.uid,\s*newClaims\s*\)/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (3) PII guard — no email / claim objects flow into logger.* (public repo)
// ════════════════════════════════════════════════════════════════════════════
// logger.* output is world-readable (Cloud Logging + public CI logs). Employee
// emails (employees are keyed by email → empDoc.id IS an email) and raw claim
// objects must NEVER appear there. Forensic identity belongs in audit_log only.
describe('claim-shape contraction — PII never reaches logger.*', () => {
  const FORBIDDEN_IN_LOGGER: Array<{ pattern: RegExp; what: string }> = [
    { pattern: /logger\.\w+\([^)]*empDoc\.id/, what: 'employee doc id (an email)' },
    { pattern: /logger\.\w+\([^)]*:\s*email\b/, what: 'email variable' },
    { pattern: /logger\.\w+\([^)]*targetEmail/, what: 'targetEmail' },
    { pattern: /logger\.\w+\([^)]*userRecord\.email/, what: 'userRecord.email' },
    { pattern: /logger\.\w+\([^)]*\bpreviousClaims\b/, what: 'previousClaims object' },
    { pattern: /logger\.\w+\([^)]*\bnewClaims\b/, what: 'newClaims object' },
    { pattern: /logger\.\w+\([^)]*customClaims/, what: 'customClaims object' }
  ];

  it.each([
    ['set-admin-claims.ts', SET_ADMIN_CLAIMS],
    ['initialize-admin-claims.ts', INIT_ADMIN_CLAIMS]
  ])('%s passes no PII into any logger.* call', (_name, file) => {
    const src = read(file);
    // Collect human-readable names of any leaks so a failure says WHAT leaked.
    const violations = FORBIDDEN_IN_LOGGER
      .filter(({ pattern }) => pattern.test(src))
      .map(({ what }) => what);
    expect(violations).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (4) Repo-wide backstop — NO claim writer anywhere emits admin:true
// ════════════════════════════════════════════════════════════════════════════
// The four contracted writers above are not the only setCustomUserClaims callers:
// master-admin-wrappers (createUser/updateUser) and the auth createUser/
// linkAuthToEmployee path also write `{role}` claims. They were already
// role-only, but this backstop ensures a future edit cannot re-introduce the
// legacy boolean into ANY claim-write payload — the regression this PR retires.
describe('claim-shape contraction — repo-wide: no writer emits admin:true', () => {
  it.each([
    ['auth/index.js', AUTH_INDEX],
    ['set-admin-claims.ts', SET_ADMIN_CLAIMS],
    ['initialize-admin-claims.ts', INIT_ADMIN_CLAIMS],
    ['grant-admin-emergency.js', GRANT_EMERGENCY],
    ['admin/master-admin-wrappers.js', MASTER_ADMIN_WRAPPERS]
  ])('%s never writes admin:true via setCustomUserClaims', (_name, file) => {
    const code = stripComments(read(file));
    expect(code).not.toMatch(/setCustomUserClaims\([^)]*admin:\s*true/);
  });
});
