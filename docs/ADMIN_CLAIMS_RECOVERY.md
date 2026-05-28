# Admin Claims — Recovery Playbook

**Created:** 2026-05-28 (Pre-H.0.0.B)
**Audience:** Haim, on-call engineer.
**Goal:** restore admin access when the normal "admin promotes another user" flow is unavailable.

## The bootstrap problem

After Pre-H.0.0.B the three admin-claim entry points all require an EXISTING admin:

| Endpoint | Path | Gate |
|---|---|---|
| `setAdminClaim` (legacy singular, grant + revoke) | `functions/auth/index.js` | `checkUserPermissions` → `employee.isAdmin` |
| `setAdminClaims` (new, grant only) | `functions/src-ts/set-admin-claims.ts` | dual-shape token check (`token.role==='admin'` OR `token.admin===true`) |
| `initializeAdminClaims` (new, bulk sync from `employees`) | `functions/src-ts/initialize-admin-claims.ts` | same dual-shape token check |

This is intentional — it eliminates the previous vulnerability where unauthenticated callers could grant admin. The trade-off is that if NO user has admin (disaster recovery, restored Auth backup, fresh environment), there's no in-app path to bootstrap one.

This playbook covers the three recovery paths.

---

## Recovery path A — Firebase Console (preferred for one-off)

1. Open the [Firebase Console](https://console.firebase.google.com/) → project → Authentication.
2. Find the target user. Copy the UID.
3. Open the user's row → "Custom claims" → "Edit".
4. Paste exactly:
   ```json
   {"admin": true, "role": "admin"}
   ```
5. Save. Wait up to one hour OR sign the user out + back in to force a token refresh.

> **Note:** the user must sign out and back in for `firestore.rules` to see the new `token.role`. Don't proceed to step 6 until that's done.

6. From the Admin Panel, run `verifyClaims` (PR-H.0.0.A diagnostic) and confirm:
   - `claimShapeBreakdown.both_shapes` increased by 1.
   - The target user's `mismatch` field is `null`.

---

## Recovery path B — local emergency script (preferred for scripted recovery)

The script lives at `functions/scripts/grant-admin-emergency.js`. It uses the Admin SDK with a service-account JSON.

### Prerequisites

- Service account JSON with the **Firebase Authentication Admin** role.
- File placed at `functions/secrets/service-account.json` (the path is gitignored via the `service-account*.json` pattern in `.gitignore`).
- Or, the `SERVICE_ACCOUNT` env var pointing at an alternative path.

### Dry run (safe)

```bash
cd functions
TARGET_UID=<the-target-uid> \
TARGET_EMAIL_FOR_LOG=<for-your-records-only> \
node scripts/grant-admin-emergency.js
```

Output explains what would be written. **No claim is set** in dry-run mode.

### Apply

```bash
TARGET_UID=<the-target-uid> \
TARGET_EMAIL_FOR_LOG=<for-your-records-only> \
node scripts/grant-admin-emergency.js --apply
```

The script:
- Writes the dual-shape claim `{admin: true, role: 'admin'}`.
- Refuses to run if the target already has the dual-shape (defensive).
- Logs the resolved email vs the env-provided email so you can catch UID/email mismatches.

### After applying

1. Document in your incident log: who ran the script, when, target UID, why the normal flow was unavailable.
2. Sign the target user out + back in (or wait ≤1h for token refresh).
3. From the Admin Panel run `verifyClaims` to confirm.

---

## Recovery path C — disaster: restore from Firestore backup

If admin claims got wiped *and* `employees.isAdmin` was also lost:

1. Restore the most recent Firestore backup → `employees` collection.
2. Confirm at least one document has `isAdmin: true`.
3. Use path A or path B to grant an admin claim to ONE of those users.
4. That user logs in → opens Admin Panel → triggers `initializeAdminClaims`.
5. The function iterates `employees.isAdmin === true` and grants the dual-shape claim to each, idempotently (skips users who already have it).

---

## Verifying success after any path

Always run `verifyClaims` after recovery. From the Firebase Functions emulator or via a logged-in admin:

```javascript
firebase.functions().httpsCallable('verifyClaims')({})
  .then(r => console.log(r.data));
```

Expected:
- `summary.totalEmployees >= 1`
- `summary.mismatchCount === 0` for the user you granted
- `claimShapeBreakdown.both_shapes >= 1`

If `mismatch` shows `firestore_admin_no_claim` for your target, the claim isn't taking effect — likely because the user hasn't refreshed their token. Sign them out + back in.

---

## What you must NOT do

- ❌ Re-add a `setAdminClaims` HTTP endpoint with no auth. That was the original vulnerability this PR closes.
- ❌ Hard-code admin emails inside Cloud Functions source. The repo is **PUBLIC**.
- ❌ Commit the service-account JSON. The `.gitignore` blocks the standard names; **always check `git status` before commit**.
- ❌ Skip the audit log. All three production endpoints write to `audit_log` before writing the claim. The emergency script bypasses audit by design — log the action manually in your incident notes.

---

## Related

- `docs/PARTNER_CLAIM_DIAGNOSTIC.md` — claim-shape drift analysis (PR-H.0.0.A).
- `docs/ENGINEERING_BAR.md` — backend standard (PR-META-6).
- `.claude/rubrics/pr-h-0-0-b.md` — the PR rubric this playbook supports.
