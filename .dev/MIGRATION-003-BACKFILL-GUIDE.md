# Migration 003: Backfill Cancelled Task Approvals - Complete Guide

**Branch:** `feature/task-cancel-approval-sync`
**Created:** 2026-01-13
**Related Commit:** fd574e8 (sync approval status on cancel)

---

## 📋 Summary

This migration fixes legacy cancelled tasks that weren't synced to the approval system before commit fd574e8 (2026-01-12).

**What it does:**
- Finds all tasks with `budget_tasks.status = 'בוטל'`
- Updates their `pending_task_approvals.status` from `'auto_approved'` → `'task_cancelled'`
- Copies cancellation metadata (cancelledBy, cancelledAt, etc.)
- Adds backfill audit trail for tracking

**Why it's needed:**
- Admin panel shows cancelled tasks (wrong UX)
- Badge counts cancelled tasks (wrong count)
- Inconsistent data between budget_tasks and pending_task_approvals

---

## 🎯 Approach: Node.js Migration Script (Matches Existing Pattern)

**Chosen approach:** Node.js migration script using existing runner system

**Why this approach:**
- ✅ Matches existing pattern ([functions/migrations/](../functions/migrations/))
- ✅ 2 migrations already exist (001, 002) using same structure
- ✅ Full-featured runner with dry-run, batch processing, rollback
- ✅ No callable functions found for backfills in this repo
- ✅ Consistent with team conventions

**Alternative considered (rejected):**
- ❌ Admin-only callable function - no existing pattern found in repo

---

## 📁 Files Changed

### 1. New Migration File
**Path:** [functions/migrations/003_backfill_cancelled_task_approvals.js](../functions/migrations/003_backfill_cancelled_task_approvals.js)

**Exports:**
- `up()` - Execute backfill (updates approvals)
- `down()` - Rollback (restore to 'auto_approved')
- `dryRun()` - Preview changes (no DB writes)

**Features:**
- Batch processing (500 docs/batch)
- Error handling (continues on individual failures)
- Detailed logging (task by task)
- Audit trail (backfilledAt, backfillVersion, backfillMigration)
- Safety checks (skips already-synced approvals)

### 2. Updated README
**Path:** [functions/migrations/README.md](../functions/migrations/README.md)

**Added:** Documentation for Migration 003 in "Available Migrations" section

---

## 🚀 How to Run

### ⚠️ CRITICAL: Single Firebase Project

**Project:** `law-office-system-e4801`
**Environment:** **PRODUCTION ONLY** - there is NO separate dev/staging database.

All operations below affect **LIVE PRODUCTION DATA**.

---

### Step 1: Dry-Run (REQUIRED FIRST)

**Command:**
```bash
cd functions/migrations
node runner.js 003_backfill_cancelled_task_approvals dryRun
```

**What it does:**
- Scans all cancelled tasks in **PRODUCTION**
- Finds matching approvals
- Shows what WOULD be updated (no changes - 100% safe)
- Displays first 5 examples

**Expected output:**
```
══════════════════════════════════════════════════════════════════════
🧪 DRY RUN: Migration 003
══════════════════════════════════════════════════════════════════════
Mode: DRY RUN (no changes will be made)
Started: 2026-01-13T10:00:00.000Z
══════════════════════════════════════════════════════════════════════

📥 Fetching cancelled tasks (status=בוטל)...
   Found 23 cancelled tasks

🔍 Analyzing approvals (first 5 shown as examples)...

  ✅ WOULD UPDATE: Approval abc123xyz
     Task ID: task_abc123
     Client: משרד עורכי דין כהן ושות׳
     Description: הכנת כתב תביעה
     Current status: auto_approved
     Would change to: task_cancelled
     Cancelled by: john.doe@law.com
     Cancelled at: 2026-01-10T14:30:00.000Z

  [... 4 more examples ...]

══════════════════════════════════════════════════════════════════════
📊 DRY RUN SUMMARY
══════════════════════════════════════════════════════════════════════
Cancelled tasks scanned:       23
Approval records matched:      20
Would update:                  18 ✅
Already synced (skip):         2
Approvals not found:           3
Duration:                      2.45s
══════════════════════════════════════════════════════════════════════

⚠️  NEXT STEPS:
   1. Review the examples above
   2. Create database backup (IMPORTANT!)
      firebase firestore:export gs://your-bucket/backup-$(date +%s)
   3. If everything looks correct, run:
      node runner.js 003_backfill_cancelled_task_approvals up
```

**Review checklist:**
- [ ] Count makes sense (cancelled tasks vs. approvals matched)
- [ ] "Already synced" count is reasonable (tasks cancelled after fd574e8)
- [ ] "Not found" tasks are pre-approval-system (expected)
- [ ] Examples show correct task metadata
- [ ] No unexpected errors

---

### Step 2: Create Backup (CRITICAL)

**Command:**
```bash
firebase firestore:export gs://law-office-system-e4801.appspot.com/backups/backup-$(date +%s)
```

**Or via Firebase Console:**
1. Go to Firestore Database
2. Click "Import/Export"
3. Export to Cloud Storage
4. Wait for completion (check notification)

**Why critical:**
- Migrations modify production data
- Rollback requires original state
- Backup = safety net if something goes wrong

---

### Step 3: Execute Migration

**⚠️ WARNING:** This modifies **PRODUCTION DATA** in `law-office-system-e4801`.

**Command:**
```bash
node runner.js 003_backfill_cancelled_task_approvals up
```

**Confirmation prompt:**
```
⚠️  WARNING: This operation will modify your PRODUCTION database!
⚠️  Project: law-office-system-e4801 (SINGLE PROJECT - NO DEV/PROD SPLIT)
⚠️  Make sure you have a backup before proceeding!

════════════════════════════════════════════════════════════════════════════════
🚨 CRITICAL: PRODUCTION DATA MODIFICATION
════════════════════════════════════════════════════════════════════════════════
This migration will update pending_task_approvals records.
There is NO separate dev environment - this affects LIVE data.
════════════════════════════════════════════════════════════════════════════════

Type exactly: RUN_BACKFILL_003_WITH_BACKUP to continue:
```

**Type exactly:** `RUN_BACKFILL_003_WITH_BACKUP` (case-sensitive, no spaces)

**Expected output:**
```
══════════════════════════════════════════════════════════════════════
🔄 MIGRATION 003: Backfill Cancelled Task Approvals
══════════════════════════════════════════════════════════════════════
Mode: EXECUTE (making real changes)
Started: 2026-01-13T10:15:00.000Z
══════════════════════════════════════════════════════════════════════

📥 Fetching cancelled tasks (status=בוטל)...
   Found 23 cancelled tasks

🔍 Processing cancelled tasks...

  ✅ Queued update for approval abc123xyz (task: task_abc123)
     Task: הכנת כתב תביעה
     Client: משרד עורכי דין כהן ושות׳
     Old approval status: auto_approved
     New approval status: task_cancelled
     Cancelled by: john.doe@law.com

  [... more tasks ...]

💾 Committing batch #1 (18 operations)...
   ✅ Batch committed

══════════════════════════════════════════════════════════════════════
✅ MIGRATION COMPLETED SUCCESSFULLY
══════════════════════════════════════════════════════════════════════
Cancelled tasks scanned:       23
Approval records matched:      20
Approvals updated:             18 ✅
Already synced (skipped):      2
Approvals not found:           3
Errors:                        0
Batches committed:             1
Duration:                      3.21s
══════════════════════════════════════════════════════════════════════
```

**Interpretation:**
- **Scanned:** Total tasks with status='בוטל'
- **Matched:** Approvals found for those tasks
- **Updated:** Approvals successfully changed to 'task_cancelled'
- **Already synced:** Tasks cancelled after fd574e8 (skip)
- **Not found:** Pre-approval-system tasks (no approval record)
- **Errors:** Should be 0 (check details if >0)

---

### Step 4: Verify Results

#### A. Firebase Console Check
1. Open Firestore Console
2. Go to `pending_task_approvals` collection
3. Filter: `backfillVersion == 1`
4. **Verify:**
   - `status` = `'task_cancelled'`
   - `backfilledAt` exists (timestamp)
   - `backfillMigration` = `'003_backfill_cancelled_task_approvals'`
   - `cancelledBy`, `cancelledAt` populated

#### B. Admin Panel Check
1. Login to Master Admin Panel
2. Open Task Approval Side Panel (bell icon)
3. **Verify:**
   - Cancelled tasks NO LONGER appear ✅
   - Badge count decreased (if any were showing before)
   - Only active/pending tasks visible

#### C. Spot Check (Random Sample)
Pick 2-3 tasks from dry-run output:
1. Find in `budget_tasks` → `status='בוטל'` ✅
2. Find in `pending_task_approvals` → `status='task_cancelled'` ✅
3. Check timestamps match

---

### Step 5: Rollback (If Needed)

**When to rollback:**
- Migration updated wrong approvals
- Unexpected side effects discovered
- Need to revert for investigation

**Command:**
```bash
node runner.js 003_backfill_cancelled_task_approvals down
```

**What it does:**
- Finds all backfilled approvals (`backfillVersion == 1`)
- Restores `status='auto_approved'`
- Removes backfill metadata
- Removes cancellation metadata added by backfill

**Expected output:**
```
══════════════════════════════════════════════════════════════════════
⏮️  ROLLBACK MIGRATION 003
══════════════════════════════════════════════════════════════════════

📥 Fetching backfilled approval records...
   Found 18 backfilled approvals

  ✅ Queued rollback for approval abc123xyz (task: task_abc123)
  [... more ...]

💾 Committing final batch #1...
   ✅ Final batch committed

══════════════════════════════════════════════════════════════════════
✅ ROLLBACK COMPLETED
══════════════════════════════════════════════════════════════════════
Rolled back:     18 approvals
Batches:         1
Duration:        1.87s
══════════════════════════════════════════════════════════════════════

⚠️  NOTE: Approvals restored to status='auto_approved'.
   Cancelled tasks will now appear in admin panel again.
   Re-run migration (up) if this was unintended.
```

**After rollback:**
- Admin panel will show cancelled tasks again (as before migration)
- Can re-run `up` after fixing any issues

---

## 🧪 Verification Steps (PRODUCTION)

### ⚠️ Note: No Separate Test Environment

**Reality:** `law-office-system-e4801` is the only Firebase project.
**Approach:** Use **dry-run extensively** + **backup** before any execution.

### Verification Scenario 1: Dry-Run Analysis
1. **Run:** `node runner.js 003_backfill_cancelled_task_approvals dryRun`
2. **Review output:** Cancelled tasks count, approvals matched, would update count
3. **Spot-check:** Pick 2-3 taskIds from "would update" list
4. **Verify in Firestore Console:**
   - `budget_tasks/{taskId}` → `status = 'בוטל'` ✅
   - `pending_task_approvals` (where `taskId == ...`) → `status = 'auto_approved'` ✅
5. **Expected:** Counts align with real data

### Verification Scenario 2: Already Synced Tasks
1. **Identify:** Find recently cancelled task (post-fd574e8, after 2026-01-12)
2. **Check Firestore:** `pending_task_approvals` → should be `status = 'task_cancelled'`
3. **Run:** `dryRun`
4. **Expected:** Task in "already synced" count, NOT "would update"

### Verification Scenario 3: Post-Execution Check
1. **After running migration `up`:**
2. **Firestore Console:**
   - Filter `pending_task_approvals` where `backfillVersion == 1`
   - Verify all have `status = 'task_cancelled'`
3. **Admin Panel:**
   - Open Task Approval Side Panel
   - Verify cancelled tasks NOT shown
   - Badge count excludes cancelled tasks

### Verification Scenario 4: Rollback Validation
1. **Only if needed:** `node runner.js 003_backfill_cancelled_task_approvals down`
2. **Firestore Console:**
   - Approvals restored to `status = 'auto_approved'`
   - Backfill metadata removed
3. **Admin Panel:** Cancelled tasks reappear (expected)

### Verification Scenario 5: Spot Check Sample
Pick 3 random tasks from migration output:
- Task A: Should be updated (was 'auto_approved' → now 'task_cancelled')
- Task B: Already synced (no change)
- Task C: No approval found (skipped)

Verify each in Firestore Console matches expected state.

---

## 📊 Expected Metrics (Production Estimate)

**Assumptions:**
- ~20-50 cancelled tasks before fd574e8 (2026-01-12)
- ~95% have approval records (5% pre-approval-system)
- ~10% already synced by current code (fd574e8+)

**Predicted output:**
```
Cancelled tasks scanned:       35
Approval records matched:      33
Approvals updated:             30 ✅
Already synced (skipped):      3
Approvals not found:           2
```

**Duration:** ~2-5 seconds (small dataset)

**Batch count:** 1 (well under 500 docs)

---

## 🛡️ Safety & Constraints

### Batch Processing
- **Size:** 500 docs/batch (Firestore limit)
- **Commit:** After each batch + final remaining
- **Large datasets:** Handles 10,000+ tasks safely

### Error Handling
- **Individual failures:** Logged, migration continues
- **Critical failures:** Migration aborts, no partial commits
- **Rollback:** Reverses all changes (via `backfillVersion` marker)

### Data Integrity
- **No overwrites:** Skips already-synced approvals (`status='task_cancelled'`)
- **Preserves metadata:** Copies from task if exists, else defaults
- **Audit trail:** All updates marked with `backfillVersion=1`

### Performance
- **Read:** Single query per collection (efficient)
- **Write:** Batched (optimal for Firestore)
- **Network:** Minimal round-trips

---

## 🐛 Troubleshooting

### Error: "Firebase Admin not initialized"
**Solution:**
1. Set service account:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
   ```
2. Or place `serviceAccountKey.json` in `functions/`
3. Or use default credentials (if logged in via `firebase login`)

### Error: "Migration file not found"
**Solution:**
- Verify current directory: `cd functions/migrations`
- Check file exists: `ls -la 003_backfill_cancelled_task_approvals.js`
- Verify filename exactly matches (case-sensitive)

### Dry-run shows 0 tasks
**Possible causes:**
1. No cancelled tasks in database (expected if none exist)
2. Wrong Firebase project - must be `law-office-system-e4801` (no other project exists)
3. Permissions issue (check service account has Firestore read access)

**Verify:**
```bash
# Check project ID (must be: law-office-system-e4801)
node -e "const admin = require('firebase-admin'); admin.initializeApp(); console.log(admin.instanceId().app.options.projectId)"
```

### Migration succeeds but admin panel still shows tasks
**Possible causes:**
1. Client-side filter not deployed ([TaskApprovalSidePanel.js:310](../master-admin-panel/js/ui/TaskApprovalSidePanel.js#L310))
2. Badge query not updated ([Navigation.js:387,442](../master-admin-panel/js/ui/Navigation.js#L387))
3. Cache issue (hard refresh browser)

**Verify:**
1. Check approval status in Firestore Console directly
2. Hard refresh admin panel (Ctrl+Shift+R)
3. Verify client-side code deployed (check cache busting version)

### "Would update" count differs between dry-run and execution
**Expected:** Small differences (new cancellations between runs)
**Unexpected:** Large differences (>10%)

**Debug:**
1. Run dry-run again
2. Compare timestamps
3. Check if tasks were cancelled during migration

---

## 📝 Audit Trail

All backfilled approvals are marked with:

```javascript
{
  status: 'task_cancelled',           // Updated status
  cancelledAt: Timestamp,             // From task or serverTimestamp
  cancelledBy: 'john@law.com',        // From task or 'system_backfill'
  cancelledByUid: 'uid123',           // From task (if exists)
  cancelledByEmail: 'john@law.com',   // From task (if exists)
  backfilledAt: Timestamp,            // Migration execution time
  backfillVersion: 1,                 // Migration version
  backfillMigration: '003_backfill...' // Migration name
}
```

**Queries to check:**
```javascript
// Find all backfilled approvals
db.collection('pending_task_approvals')
  .where('backfillVersion', '==', 1)
  .get()

// Find approvals missing backfill (if any were cancelled during migration)
db.collection('budget_tasks')
  .where('status', '==', 'בוטל')
  .get()
  // Then manually check their approval status
```

---

## 🔗 Related Files & Commits

### Migration Files
- [003_backfill_cancelled_task_approvals.js](../functions/migrations/003_backfill_cancelled_task_approvals.js) - Migration script
- [runner.js](../functions/migrations/runner.js) - Migration runner (unchanged)
- [README.md](../functions/migrations/README.md) - Updated documentation

### Related Code (Context)
- [functions/index.js:2591-2613](../functions/index.js#L2591-L2613) - cancelBudgetTask (sync logic added in fd574e8)
- [TaskApprovalSidePanel.js:310](../master-admin-panel/js/ui/TaskApprovalSidePanel.js#L310) - Client-side filter
- [Navigation.js:387,442](../master-admin-panel/js/ui/Navigation.js#L387) - Badge counter query

### Related Commits
- `fd574e8` - fix: sync approval status when task is cancelled (2026-01-12)
- `976e782` - fix: exclude task_cancelled from approval badge count
- `5e99e6f` - fix: exclude task_cancelled from approval badge count

---

## ✅ Checklist: Pre-Execution

⚠️ **PRODUCTION ONLY** - no dev/staging environment exists.

Before running migration `up`:

- [ ] **CRITICAL:** Created Firestore backup (see Step 2)
- [ ] **CRITICAL:** Verified backup completed successfully
- [ ] Reviewed dry-run output thoroughly
- [ ] Counts make sense (cancelled tasks vs approvals)
- [ ] Examples show correct data (spot-checked 2-3 tasks in Firestore Console)
- [ ] No errors in dry-run
- [ ] Client-side filters deployed ([TaskApprovalSidePanel.js:310](../master-admin-panel/js/ui/TaskApprovalSidePanel.js#L310))
- [ ] Badge query updated ([Navigation.js](../master-admin-panel/js/ui/Navigation.js))
- [ ] Understand rollback procedure (can restore if needed)
- [ ] Stakeholders informed (this affects LIVE data)
- [ ] Execution window scheduled (low-traffic time recommended)
- [ ] Confirmation phrase ready: `RUN_BACKFILL_003_WITH_BACKUP`

---

---

## 🚨 CRITICAL WARNINGS

1. **Single Firebase Project:** `law-office-system-e4801` is used for PRODUCTION.
2. **No Dev/Staging:** There is NO separate test environment - all operations affect LIVE data.
3. **Backup Mandatory:** MUST create Firestore backup before running `up`.
4. **Strong Confirmation:** Must type exact phrase `RUN_BACKFILL_003_WITH_BACKUP` to execute.
5. **Dry-Run First:** ALWAYS run `dryRun` and review output before `up`.

---

**Last Updated:** 2026-01-13
**Author:** Claude Code
**Branch:** feature/task-cancel-approval-sync
