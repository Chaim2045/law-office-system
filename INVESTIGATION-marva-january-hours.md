# Investigation: Marva January 2026 Hours

## Query Target
- **Collection:** `timesheet_entries`
- **Employee:** `marva@ghlaw.co.il`
- **Date Range:** 2026-01-01 to 2026-01-31
- **Metric:** Sum of `minutes` field, converted to hours

## Result: BLOCKED - Missing Credentials

Unable to query production Firestore from this environment.

### Root Cause
No service account key or authentication credentials are available:
- `serviceAccountKey.json` / `firebase-admin-key.json` not present (correctly gitignored)
- No Application Default Credentials configured
- No GCE metadata service available
- Firestore security rules require authentication for `timesheet_entries`

### How to Complete This Query

**Option 1 - Firebase Console:**
1. Go to Firebase Console > Firestore > `timesheet_entries`
2. Filter: `employee == "marva@ghlaw.co.il"`, `date >= "2026-01-01"`, `date <= "2026-01-31"`
3. Sum the `minutes` field, divide by 60

**Option 2 - Existing Cloud Function:**
Call `getTimesheetEntries` (functions/index.js:4259) with parameters:
- `employee`: `marva@ghlaw.co.il`
- `startDate`: `2026-01-01`
- `endDate`: `2026-01-31`

**Option 3 - Local Script (requires serviceAccountKey.json):**
Place the service account key at `functions/serviceAccountKey.json` or set `GOOGLE_APPLICATION_CREDENTIALS` env var, then re-run this investigation.
