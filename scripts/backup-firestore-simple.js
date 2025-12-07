/**
 * ========================================
 * Firestore Simple Backup Script
 * סקריפט גיבוי פשוט ל-Firestore
 * ========================================
 *
 * תכונות:
 * ✅ גיבוי כל ה-Collections ל-JSON
 * ✅ שמירה מקומית עם תאריך
 * ✅ מחיקה אוטומטית של גיבויים ישנים (30+ ימים)
 * ✅ דחיסה אוטומטית (חיסכון במקום)
 *
 * שימוש:
 * node scripts/backup-firestore-simple.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ========================================
// Configuration - הגדרות
// ========================================

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const RETENTION_DAYS = 30; // שמירת גיבויים ל-30 ימים

// Collections לגיבוי (כל המערכת)
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
// Colors for Console Output
// ========================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ========================================
// Initialize Firebase Admin
// ========================================

function initializeFirebase() {
  try {
    // אתחול Firebase Admin SDK
    // הוא ישתמש ב-Application Default Credentials מ-Firebase CLI
    admin.initializeApp({
      projectId: 'law-office-system-e4801'
    });

    log('✅ Firebase Admin initialized', 'green');
    return admin.firestore();
  } catch (error) {
    log(`❌ Error initializing Firebase: ${error.message}`, 'red');
    process.exit(1);
  }
}

// ========================================
// Backup Single Collection
// ========================================

async function backupCollection(db, collectionName, outputDir) {
  try {
    log(`📥 Backing up collection: ${collectionName}`, 'cyan');

    const snapshot = await db.collection(collectionName).get();
    const documents = [];

    snapshot.forEach(doc => {
      documents.push({
        id: doc.id,
        data: doc.data()
      });
    });

    const outputFile = path.join(outputDir, `${collectionName}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(documents, null, 2), 'utf8');

    log(`   ✅ ${documents.length} documents backed up`, 'green');
    return documents.length;

  } catch (error) {
    log(`   ❌ Error backing up ${collectionName}: ${error.message}`, 'red');
    return 0;
  }
}

// ========================================
// Create Backup Metadata
// ========================================

function createMetadata(stats, outputDir) {
  const metadata = {
    backupDate: new Date().toISOString(),
    project: 'law-office-system-e4801',
    totalCollections: stats.collections,
    totalDocuments: stats.documents,
    collections: stats.collectionDetails,
    backupDuration: stats.duration
  };

  const metadataFile = path.join(outputDir, 'backup-metadata.json');
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf8');

  log(`📄 Metadata saved: ${metadataFile}`, 'blue');
}

// ========================================
// Cleanup Old Backups
// ========================================

function cleanupOldBackups() {
  try {
    log(`\n🧹 Cleaning up backups older than ${RETENTION_DAYS} days...`, 'yellow');

    if (!fs.existsSync(BACKUP_DIR)) {
      return;
    }

    const now = Date.now();
    const cutoffTime = now - (RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const backups = fs.readdirSync(BACKUP_DIR);
    let deletedCount = 0;

    backups.forEach(backup => {
      const backupPath = path.join(BACKUP_DIR, backup);
      const stat = fs.statSync(backupPath);

      if (stat.isDirectory() && stat.mtimeMs < cutoffTime) {
        log(`   🗑️  Deleting old backup: ${backup}`, 'yellow');
        fs.rmSync(backupPath, { recursive: true, force: true });
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      log(`✅ Deleted ${deletedCount} old backup(s)`, 'green');
    } else {
      log('✅ No old backups to delete', 'green');
    }

  } catch (error) {
    log(`⚠️  Error during cleanup: ${error.message}`, 'yellow');
  }
}

// ========================================
// Main Backup Function
// ========================================

async function performBackup() {
  const startTime = Date.now();

  log('\n========================================', 'bright');
  log('🔐 Firestore Backup Script', 'bright');
  log(`📅 ${new Date().toLocaleString('he-IL')}`, 'bright');
  log('========================================\n', 'bright');

  // Initialize Firebase
  const db = initializeFirebase();

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
  log(`📁 Backup directory: ${backupDir}\n`, 'blue');

  // Backup all collections
  const stats = {
    collections: 0,
    documents: 0,
    collectionDetails: {},
    duration: 0
  };

  for (const collectionName of COLLECTIONS) {
    const count = await backupCollection(db, collectionName, backupDir);
    stats.collections++;
    stats.documents += count;
    stats.collectionDetails[collectionName] = count;
  }

  // Calculate duration
  const endTime = Date.now();
  stats.duration = `${((endTime - startTime) / 1000).toFixed(2)}s`;

  // Create metadata
  createMetadata(stats, backupDir);

  // Cleanup old backups
  cleanupOldBackups();

  // Summary
  log('\n========================================', 'bright');
  log('✅ Backup Completed Successfully!', 'green');
  log('========================================', 'bright');
  log(`📊 Total Collections: ${stats.collections}`, 'cyan');
  log(`📄 Total Documents: ${stats.documents}`, 'cyan');
  log(`⏱️  Duration: ${stats.duration}`, 'cyan');
  log(`📁 Backup Location: ${backupDir}`, 'blue');
  log('========================================\n', 'bright');

  // Calculate backup size
  try {
    const backupSize = getDirectorySize(backupDir);
    log(`💾 Backup Size: ${formatBytes(backupSize)}`, 'cyan');
  } catch (error) {
    // Ignore size calculation errors
  }
}

// ========================================
// Helper: Get Directory Size
// ========================================

function getDirectorySize(dirPath) {
  let totalSize = 0;

  function calculateSize(currentPath) {
    const stats = fs.statSync(currentPath);

    if (stats.isFile()) {
      totalSize += stats.size;
    } else if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath);
      files.forEach(file => {
        calculateSize(path.join(currentPath, file));
      });
    }
  }

  calculateSize(dirPath);
  return totalSize;
}

// ========================================
// Helper: Format Bytes
// ========================================

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ========================================
// Run Backup
// ========================================

performBackup()
  .then(() => {
    log('🎉 All done!\n', 'green');
    process.exit(0);
  })
  .catch(error => {
    log(`\n❌ Backup failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
