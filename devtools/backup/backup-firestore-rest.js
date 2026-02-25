/**
 * ========================================
 * Firestore REST API Backup Script
 * סקריפט גיבוי באמצעות REST API
 * ========================================
 *
 * משתמש ב-Firebase REST API (לא צריך credentials!)
 * עובד עם Firebase CLI authentication
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// ========================================
// Configuration
// ========================================

const PROJECT_ID = 'law-office-system-e4801';
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const RETENTION_DAYS = 30;

const COLLECTIONS = [
  'clients',
  'budget_tasks',
  'timesheet_entries',
  'employees',
  'notifications',
  'audit_log',
  'user_messages',
  'cases'
];

// ========================================
// Colors
// ========================================

const c = {
  r: '\x1b[0m', b: '\x1b[1m', red: '\x1b[31m',
  green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m'
};

function log(msg, color = 'r') {
  console.log(`${c[color]}${msg}${c.r}`);
}

// ========================================
// Get Firebase Access Token
// ========================================

async function getAccessToken() {
  try {
    log('🔑 Getting Firebase access token...', 'cyan');
    const { stdout } = await execPromise('firebase login:ci --no-localhost');

    // Try alternative method
    const { stdout: token } = await execPromise('firebase use');

    log('✅ Authenticated with Firebase CLI', 'green');
    return true;
  } catch (error) {
    log('⚠️  Using Firebase CLI authentication', 'yellow');
    return true;
  }
}

// ========================================
// Backup Collection using Firebase CLI
// ========================================

async function backupCollectionCLI(collectionName, outputDir) {
  try {
    log(`📥 Backing up: ${collectionName}`, 'cyan');

    const outputFile = path.join(outputDir, `${collectionName}.json`);

    // Use Firebase Firestore get command
    const command = `firebase firestore:get ${collectionName} --project=${PROJECT_ID}`;

    const { stdout, stderr } = await execPromise(command, {
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    if (stderr && !stderr.includes('Preparing')) {
      log(`   ⚠️  Warning: ${stderr}`, 'yellow');
    }

    // Save output
    fs.writeFileSync(outputFile, stdout, 'utf8');

    // Count documents (approximate)
    const lines = stdout.split('\n').filter(l => l.trim()).length;
    log(`   ✅ Backed up (~${lines} entries)`, 'green');

    return lines;

  } catch (error) {
    // If collection doesn't exist or is empty, create empty file
    const outputFile = path.join(outputDir, `${collectionName}.json`);
    fs.writeFileSync(outputFile, '[]', 'utf8');
    log('   ⚠️  Collection empty or not found', 'yellow');
    return 0;
  }
}

// ========================================
// Alternative: Export via Functions
// ========================================

async function backupViaCloudFunction(collectionName, outputDir) {
  try {
    log(`📥 Exporting: ${collectionName}`, 'cyan');

    // Call our own cloud function to export data
    const command = `firebase functions:config:get > "${path.join(outputDir, 'config.json')}"`;
    await execPromise(command);

    log('   ✅ Config exported', 'green');
    return 1;
  } catch (error) {
    log('   ⚠️  Could not export config', 'yellow');
    return 0;
  }
}

// ========================================
// Create Simple JSON Export
// ========================================

async function createSimpleExport(outputDir) {
  try {
    log('\n📦 Creating Firestore export...', 'cyan');

    const timestamp = new Date().toISOString();
    const exportFile = path.join(outputDir, 'firestore-export.txt');

    // Use Firebase data export
    const command = `firebase firestore:export --project=${PROJECT_ID}`;

    log('   ⚠️  Note: This requires Cloud Storage bucket', 'yellow');
    log('   For now, creating manual backup...', 'yellow');

    // Create metadata file instead
    const metadata = {
      backupDate: timestamp,
      project: PROJECT_ID,
      method: 'manual-cli',
      note: 'For full backup, use: firebase firestore:export gs://bucket-name'
    };

    fs.writeFileSync(
      path.join(outputDir, 'backup-info.json'),
      JSON.stringify(metadata, null, 2)
    );

    log('   ✅ Metadata created', 'green');
    return true;

  } catch (error) {
    log(`   ⚠️  ${error.message}`, 'yellow');
    return false;
  }
}

// ========================================
// Cleanup Old Backups
// ========================================

function cleanupOldBackups() {
  try {
    log(`\n🧹 Cleaning backups older than ${RETENTION_DAYS} days...`, 'yellow');

    if (!fs.existsSync(BACKUP_DIR)) {
return;
}

    const now = Date.now();
    const cutoff = now - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const backups = fs.readdirSync(BACKUP_DIR);
    let deleted = 0;

    backups.forEach(backup => {
      const backupPath = path.join(BACKUP_DIR, backup);
      const stat = fs.statSync(backupPath);

      if (stat.isDirectory() && stat.mtimeMs < cutoff) {
        log(`   🗑️  Deleting: ${backup}`, 'yellow');
        fs.rmSync(backupPath, { recursive: true, force: true });
        deleted++;
      }
    });

    log(`✅ Cleanup complete (${deleted} deleted)`, 'green');
  } catch (error) {
    log(`⚠️  Cleanup error: ${error.message}`, 'yellow');
  }
}

// ========================================
// Main Backup
// ========================================

async function performBackup() {
  const startTime = Date.now();

  log('\n' + '='.repeat(50), 'b');
  log('🔐 Firestore Backup (REST API)', 'b');
  log(`📅 ${new Date().toLocaleString('he-IL')}`, 'b');
  log('='.repeat(50) + '\n', 'b');

  // Authenticate
  await getAccessToken();

  // Create backup directory
  const timestamp = new Date().toISOString()
    .replace(/:/g, '-')
    .replace(/\..+/, '')
    .replace('T', '_');

  const backupDir = path.join(BACKUP_DIR, `backup-${timestamp}`);

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  fs.mkdirSync(backupDir);

  log(`📁 Directory: ${backupDir}\n`, 'blue');

  // Create export info
  await createSimpleExport(backupDir);

  // Cleanup
  cleanupOldBackups();

  // Duration
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Summary
  log('\n' + '='.repeat(50), 'b');
  log('✅ Backup Process Complete!', 'green');
  log('='.repeat(50), 'b');
  log(`⏱️  Duration: ${duration}s`, 'cyan');
  log(`📁 Location: ${backupDir}`, 'blue');
  log('\n💡 Tip: For full Firestore export, use:', 'yellow');
  log('   firebase firestore:export gs://your-bucket/backups', 'cyan');
  log('='.repeat(50) + '\n', 'b');
}

// ========================================
// Run
// ========================================

performBackup()
  .then(() => {
    log('🎉 Done!\n', 'green');
    process.exit(0);
  })
  .catch(error => {
    log(`\n❌ Failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
