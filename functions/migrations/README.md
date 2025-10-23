# Database Migrations System

## Overview

Professional database migration system for Firebase Firestore, similar to migrations in Rails, Django, or Sequelize.

This system provides:
- ✅ **Dry-run mode** - Preview changes before execution
- ✅ **Rollback support** - Undo migrations if needed
- ✅ **Audit trail** - Track what was migrated and when
- ✅ **Batch processing** - Respects Firestore limits (500 operations/batch)
- ✅ **Safety prompts** - Confirmation required for destructive operations
- ✅ **Color-coded output** - Easy to read terminal output

## Why Use Migrations?

❌ **Console Scripts (Bad)**:
- No rollback capability
- No dry-run preview
- No audit trail
- Easy to make mistakes
- Can't track what changed

✅ **Migrations (Good)**:
- Test before executing (dry-run)
- Can rollback if something goes wrong
- Full audit trail with timestamps
- Batch processing for safety
- Professional and maintainable

## Directory Structure

```
functions/migrations/
├── README.md                          # This file
├── runner.js                          # CLI tool to run migrations
├── 001_fix_task_hours_minutes.js     # First migration
└── 002_your_next_migration.js        # Future migrations...
```

## Migration File Structure

Each migration file exports three functions:

```javascript
module.exports = {
  // Execute the migration (makes changes)
  up: async () => {
    // Your migration logic here
    return { stats... };
  },

  // Rollback the migration (undo changes)
  down: async () => {
    // Your rollback logic here
    return { stats... };
  },

  // Preview what would happen (no changes)
  dryRun: async () => {
    // Your preview logic here
    return { wouldChange... };
  }
};
```

## Usage

### 1. Always Start with Dry-Run (Safe)

Preview what would change without making any modifications:

```bash
cd functions/migrations
node runner.js 001_fix_task_hours_minutes dryRun
```

This will show:
- How many documents would be affected
- What changes would be made
- Detailed breakdown of each change
- No data is modified (100% safe)

### 2. Backup Your Database

**CRITICAL**: Always backup before running migrations!

```bash
# Export entire Firestore database
firebase firestore:export gs://law-office-system-e4801.appspot.com/backups/backup-$(date +%s)

# Or use Firebase Console to create a backup
```

### 3. Execute the Migration

After reviewing dry-run output and creating backup:

```bash
node runner.js 001_fix_task_hours_minutes up
```

You'll be prompted:
```
⚠️  WARNING: This operation will modify your database!
⚠️  Make sure you have a backup before proceeding!

Do you want to continue? (yes/no):
```

Type `yes` to proceed.

### 4. Rollback if Needed

If something goes wrong:

```bash
node runner.js 001_fix_task_hours_minutes down
```

## Available Migrations

### 001_fix_task_hours_minutes

**Purpose**: Fix inconsistent actualHours and actualMinutes data in budget_tasks collection.

**Problem**:
- Some tasks have actualHours but different actualMinutes
- Old tasks were updated directly from client, causing race conditions
- Data integrity issue affecting ~7 tasks

**Solution**:
- Makes actualMinutes the source of truth
- Recalculates actualHours = actualMinutes / 60
- Adds audit trail markers for tracking

**Dry-run**:
```bash
node runner.js 001_fix_task_hours_minutes dryRun
```

**Execute**:
```bash
node runner.js 001_fix_task_hours_minutes up
```

**Rollback**:
```bash
node runner.js 001_fix_task_hours_minutes down
```

Note: Rollback removes migration markers but doesn't restore incorrect values (since the fix is correct).

## Creating New Migrations

### Step 1: Create Migration File

Create a new file with format: `NNN_descriptive_name.js`

```bash
# Example: 002_add_client_status_field.js
```

Use sequential numbering (001, 002, 003, etc.)

### Step 2: Migration Template

```javascript
/**
 * Migration NNN: Descriptive Title
 *
 * Created: YYYY-MM-DD
 * Author: Your Name
 * Issue: Brief description of problem
 *
 * PROBLEM:
 * Detailed explanation of what's wrong
 *
 * SOLUTION:
 * How you're fixing it
 *
 * AFFECTED DATA:
 * How many documents, which collection
 */

const admin = require('firebase-admin');

module.exports = {
  up: async () => {
    const db = admin.firestore();
    const stats = {
      total: 0,
      updated: 0,
      errors: []
    };

    try {
      // Get documents
      const snapshot = await db.collection('your_collection').get();
      stats.total = snapshot.size;

      // Process in batches
      const BATCH_SIZE = 500;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Your logic to determine if update needed
        if (needsUpdate(data)) {
          batch.update(doc.ref, {
            // Your changes
            newField: 'value',
            // Audit trail
            _migrated: true,
            _migrationVersion: NNN,
            _migratedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          stats.updated++;
          batchCount++;

          // Commit batch if reached limit
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
      }

      // Commit remaining
      if (batchCount > 0) {
        await batch.commit();
      }

      return stats;

    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },

  down: async () => {
    const db = admin.firestore();
    // Rollback logic here
  },

  dryRun: async () => {
    const db = admin.firestore();
    // Preview logic here (no changes)
  }
};
```

### Step 3: Test Your Migration

1. **Dry-run first** to see what would change
2. **Review output** carefully
3. **Create backup**
4. **Execute migration**
5. **Verify results** in Firebase Console
6. **Test rollback** (optional, in staging)

## Best Practices

### 1. Always Dry-Run First
Never execute a migration without running dry-run first!

### 2. Create Backups
Always backup before executing migrations.

### 3. Batch Processing
Always use batches to respect Firestore limits:
- Max 500 operations per batch
- Commit batch when reaching limit

```javascript
const BATCH_SIZE = 500;
let batch = db.batch();
let batchCount = 0;

for (const doc of snapshot.docs) {
  batch.update(doc.ref, {...});
  batchCount++;

  if (batchCount >= BATCH_SIZE) {
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  }
}

if (batchCount > 0) {
  await batch.commit();
}
```

### 4. Audit Trail
Always add migration metadata:

```javascript
{
  _migrated: true,
  _migrationVersion: 1,
  _migratedAt: admin.firestore.FieldValue.serverTimestamp(),
  _migrationName: '001_fix_task_hours_minutes',
  _oldValue: originalValue  // For reference
}
```

### 5. Detailed Logging
Log every change for debugging:

```javascript
console.log(`  ✅ Updated document ${doc.id}`);
console.log(`     Old: ${oldValue}`);
console.log(`     New: ${newValue}`);
```

### 6. Error Handling
Catch and report errors without stopping:

```javascript
try {
  // Migration logic
} catch (error) {
  stats.errors.push(`Document ${doc.id}: ${error.message}`);
  continue; // Don't stop entire migration
}
```

### 7. Test on Staging First
If you have a staging environment, test there first!

## Troubleshooting

### Error: "Firebase Admin not initialized"

Make sure you have a service account key:

```bash
# Download from Firebase Console
# Project Settings -> Service Accounts -> Generate new private key

# Save as: functions/serviceAccountKey.json
# Or set environment variable:
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
```

### Error: "Migration file not found"

Check that:
1. You're in the correct directory: `functions/migrations/`
2. File name matches exactly (case-sensitive)
3. File has `.js` extension

### Error: "Mode not supported"

Make sure your migration file exports all three functions:
- `up`
- `down`
- `dryRun`

### Migration Runs But No Changes

1. Check dry-run output first
2. Verify your filter logic (`if (needsUpdate)`)
3. Check Firestore permissions

## Safety Checklist

Before running any migration:

- [ ] Ran dry-run and reviewed output
- [ ] Created database backup
- [ ] Tested in staging environment (if available)
- [ ] Reviewed migration code for errors
- [ ] Understand what the migration does
- [ ] Know how to rollback if needed
- [ ] Have time to monitor results

## Support

If you encounter issues:

1. Check the error message carefully
2. Review migration code
3. Check Firebase Console for data state
4. Use dry-run to debug logic
5. Test rollback functionality

## Examples

### Example 1: Fix Field Values

```bash
# Preview changes
node runner.js 001_fix_task_hours_minutes dryRun

# Create backup
firebase firestore:export gs://your-bucket/backup-$(date +%s)

# Execute
node runner.js 001_fix_task_hours_minutes up

# Verify in Firebase Console
# If something wrong:
node runner.js 001_fix_task_hours_minutes down
```

### Example 2: Add New Field

```bash
# Preview
node runner.js 002_add_status_field dryRun

# Backup
firebase firestore:export gs://your-bucket/backup

# Execute
node runner.js 002_add_status_field up
```

---

**Remember**: Migrations are powerful tools. Use them carefully and always test first! 🚀
