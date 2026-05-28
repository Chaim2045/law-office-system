# Partner Claim Diagnostic — `verifyClaims`

**Status:** Read-only diagnostic. Safe to run anytime. Zero side effects.
**Introduced in:** PR-H.0.0.A (first step of the AI Management Layer foundation)
**Owner:** Lead Agent (Haim approves runs in PROD).

## Why this exists

The AI Management Layer plan adds a `partner` custom claim to enable a profitability dashboard restricted to office partners (Guy, Haim). Before any code writes a partner claim, we MUST inspect the current state of the system:

1. **What custom claims are actually set today** on every employee's auth user?
2. **What shape are those claims?** Two coexisting shapes were found:
   - `{role: 'admin'}` (string form — written by `setAdminClaims`)
   - `{admin: true}` (boolean form — written by legacy `initializeAdminClaims`)
   The admin panel reads BOTH. Future writes that pick one shape risk silently demoting users who hold only the other.
3. **Are there mismatches** between `employees/{email}.role` (Firestore field) and the actual token claim?
4. **Are there any `messages` documents with `'partner'` already in their `toRoles` array?** If yes — setting a `partner` claim would grant immediate read access to those documents via the wildcard rule at `firestore.rules:239`.

The `verifyClaims` callable answers all four questions in one report. Nothing is changed. Nothing is logged anywhere customer-facing.

## How to invoke

### From the Admin Panel browser console (recommended)

1. Open the Admin Panel: `https://main--admin-gh-law-office-system.netlify.app` (DEV) or `https://admin-gh-law-office-system.netlify.app` (PROD)
2. Log in as an admin (Haim or Guy)
3. Open browser DevTools console (F12)
4. Run:

```js
const verify = firebase.functions().httpsCallable('verifyClaims');
const result = await verify({});
console.log(JSON.stringify(result.data, null, 2));
```

5. Copy the JSON output into a file for analysis.

### Permission requirements

You must hold a current admin claim — accepts EITHER `{role: 'admin'}` OR `{admin: true}` (during the transition).

Non-admin → permission-denied (Hebrew message).
Unauthenticated → unauthenticated (Hebrew message).

## How to read the report

### `summary` — start here

```js
{
  totalEmployees: 11,
  matchedCount: 8,           // Firestore role and claim agree, or no role expected
  mismatchCount: 2,          // explicit mismatch — see report.mismatches[]
  authMissingCount: 1,       // employee exists in Firestore but no auth user
  legacyAdminBooleanCount: 0,// users still holding {admin:true} shape
  messagesWithPartnerToRoles: 0, // critical: must be 0 before any partner claim write
  elapsedMs: 4521
}
```

**Decision rule for the next PR in Pre-H.0.0:**
- `messagesWithPartnerToRoles > 0` → STOP. Investigate which documents have `'partner'` in `toRoles` and decide whether to clean those up FIRST, or proceed knowingly.
- `legacyAdminBooleanCount > 0` → before any `setCustomUserClaims` write, design a merge strategy (read old claim → merge with new role → write).
- `mismatchCount > 0` → the drift is real. Plan PR-H.0.0.F (sync) accordingly.

### `employees[]` — per-employee detail

Each element:

```js
{
  email: "guy@ghlawoffice.co.il",
  isActive: true,
  firestoreRole: "partner",        // employees/{email}.role
  authUid: "abc123...",
  authError: null,                 // populated only if getUserByEmail failed
  customClaims: { role: "admin" }, // raw claims object as stored
  claimShape: "role_string_only",  // see "claim shapes" below
  tokenRole: "admin",              // customClaims.role
  adminBoolean: false,             // customClaims.admin === true
  mismatch: "firestore_partner_no_claim"  // or null if matched
}
```

### Claim shapes

- `role_string_only`: `{ role: 'admin' }` or `{ role: 'partner' }`. The current/intended shape.
- `admin_boolean_only`: `{ admin: true }`. Legacy shape from `initializeAdminClaims`. Needs migration.
- `both_shapes`: `{ admin: true, role: 'admin' }`. Belt-and-suspenders. Safe but redundant.
- `no_claim`: no custom claims at all.

### Mismatch kinds

- `firestore_admin_no_claim` — Firestore says this user is admin but they have no admin claim. They will be denied admin actions until claim is set.
- `firestore_partner_no_claim` — Firestore says partner, no partner claim. Future partner-gated features won't work for them.
- `firestore_employee_has_elevated_claim` — Firestore says regular employee but the claim is admin or partner. This is the more alarming direction — could be an out-of-band manual grant that needs investigation before any sync run.

### `messagesWithPartnerToRoles`

```js
{
  scanned: true,        // false if the messages collection or index is missing
  count: 0,             // how many docs had 'partner' in toRoles array
  samples: [],          // up to 10 sample documents (id, toRoles, createdAt)
  error: null           // populated only if scan failed
}
```

**This number must be 0 before any partner-claim write goes to production.**
If it's non-zero, you have a choice:
1. Clean the documents (remove `'partner'` from their `toRoles`) before proceeding
2. Accept that setting the claim will grant read access to those specific docs (probably fine if the docs were intended for partners anyway, but make it an explicit decision, not a silent side effect)

## What this diagnostic does NOT do

- Does **not** set any claim. Use future PR-H.0.0.F (`syncRoleClaims`) for that.
- Does **not** delete or modify any document.
- Does **not** clean up `messages.toRoles` even if it finds `'partner'` there.
- Does **not** audit-log anything. (Read-only diagnostic does not need critical audit per G3 of PRODUCT-GRADE-GATES.)
- Does **not** examine claims of users who are NOT in the `employees` collection. If someone has an auth user but no employee doc, they are invisible to this diagnostic.

## When to run it

- Before any subsequent Pre-H.0.0 PR (B-G) goes to planning
- After any manual claim change via Firebase Console (sanity check)
- Quarterly as part of security review
- After onboarding a new employee, to confirm their claim is set correctly

## Rollback

This PR can be reverted with a single `git revert`. No data rollback needed — the function performs zero writes.

```bash
git revert <merge-commit>
firebase deploy --only functions:verifyClaims --project law-office-system-e4801
```

After redeploy, the `verifyClaims` callable is removed from the production endpoint surface.
