#!/usr/bin/env node

/**
 * Migration Runner
 *
 * Professional database migration tool for Firebase Firestore
 * Similar to migrations in Rails, Django, or Sequelize
 *
 * Usage:
 *   node runner.js <migration-name> [mode]
 *
 * Examples:
 *   node runner.js 001_fix_task_hours_minutes dryRun    # Preview changes
 *   node runner.js 001_fix_task_hours_minutes up        # Execute migration
 *   node runner.js 001_fix_task_hours_minutes down      # Rollback migration
 *
 * Modes:
 *   dryRun  - Preview what would change (default, safe)
 *   up      - Execute the migration (makes changes)
 *   down    - Rollback the migration (undo changes)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${color}${text}${colors.reset}`;
}

/**
 * Prompt user for confirmation
 */
function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(colorize(question + ' (yes/no): ', colors.yellow), answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Load migration file
 */
function loadMigration(migrationName) {
  const migrationPath = path.join(__dirname, `${migrationName}.js`);

  if (!fs.existsSync(migrationPath)) {
    console.error(colorize(`\n❌ Migration file not found: ${migrationPath}`, colors.red));
    console.log('\nAvailable migrations:');

    const files = fs.readdirSync(__dirname)
      .filter(f => f.match(/^\d+_.*\.js$/))
      .sort();

    if (files.length === 0) {
      console.log('  (none)');
    } else {
      files.forEach(f => {
        console.log(`  - ${f.replace('.js', '')}`);
      });
    }

    process.exit(1);
  }

  return require(migrationPath);
}

/**
 * Validate migration object
 */
function validateMigration(migration, mode) {
  if (typeof migration[mode] !== 'function') {
    console.error(colorize(`\n❌ Migration does not support mode: ${mode}`, colors.red));
    console.log('\nAvailable modes in this migration:');
    ['up', 'down', 'dryRun'].forEach(m => {
      if (typeof migration[m] === 'function') {
        console.log(`  ✅ ${m}`);
      } else {
        console.log(`  ❌ ${m}`);
      }
    });
    process.exit(1);
  }
}

/**
 * Print banner
 */
function printBanner(migrationName, mode) {
  console.log('\n' + colorize('='.repeat(80), colors.cyan));
  console.log(colorize('🔧 FIREBASE MIGRATION RUNNER', colors.bright + colors.cyan));
  console.log(colorize('='.repeat(80), colors.cyan));
  console.log(`Migration: ${colorize(migrationName, colors.bright)}`);
  console.log(`Mode:      ${colorize(mode.toUpperCase(), mode === 'up' ? colors.red : mode === 'down' ? colors.yellow : colors.green)}`);
  console.log(`Time:      ${new Date().toISOString()}`);
  console.log(`Project:   ${admin.instanceId().app.options.projectId || 'default'}`);
  console.log(colorize('='.repeat(80), colors.cyan));
}

/**
 * Main runner function
 */
async function runMigration(migrationName, mode = 'dryRun') {
  try {
    // Initialize Firebase Admin
    if (!admin.apps.length) {
      // Try to load service account from environment or default location
      const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        path.join(__dirname, '../serviceAccountKey.json');

      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log(colorize('\n✅ Firebase Admin initialized with service account', colors.green));
      } else {
        // Try application default credentials
        admin.initializeApp();
        console.log(colorize('\n✅ Firebase Admin initialized with default credentials', colors.green));
      }
    }

    // Load migration
    const migration = loadMigration(migrationName);

    // Validate migration supports the mode
    validateMigration(migration, mode);

    // Print banner
    printBanner(migrationName, mode);

    // Safety check for destructive operations
    if (mode === 'up' || mode === 'down') {
      console.log('\n' + colorize('⚠️  WARNING: This operation will modify your database!', colors.yellow));
      console.log(colorize('⚠️  Make sure you have a backup before proceeding!', colors.yellow));

      const confirmed = await confirm('\nDo you want to continue?');
      if (!confirmed) {
        console.log(colorize('\n❌ Migration cancelled by user', colors.red));
        process.exit(0);
      }
    }

    // Run the migration
    console.log('\n' + colorize('🚀 Starting migration...', colors.cyan) + '\n');
    const startTime = Date.now();

    const result = await migration[mode]();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Success
    console.log(colorize('\n✅ Migration completed successfully!', colors.green));
    console.log(`⏱️  Total time: ${duration}s\n`);

    // Log result object if available
    if (result && typeof result === 'object') {
      console.log(colorize('📊 Result:', colors.bright));
      console.log(JSON.stringify(result, null, 2));
      console.log('');
    }

    // Next steps suggestion
    if (mode === 'dryRun' && result && result.wouldFix > 0) {
      console.log(colorize('💡 Next step:', colors.cyan));
      console.log(`   Run: node runner.js ${migrationName} up`);
      console.log('');
    }

    process.exit(0);

  } catch (error) {
    console.error(colorize('\n❌ Migration failed!', colors.red));
    console.error(colorize('Error:', colors.red), error.message);

    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

/**
 * CLI entry point
 */
function main() {
  const args = process.argv.slice(2);

  // Help
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
${colorize('Firebase Migration Runner', colors.bright + colors.cyan)}

${colorize('Usage:', colors.bright)}
  node runner.js <migration-name> [mode]

${colorize('Modes:', colors.bright)}
  ${colorize('dryRun', colors.green)}  - Preview changes without modifying database (default, safe)
  ${colorize('up', colors.red)}       - Execute the migration (makes real changes)
  ${colorize('down', colors.yellow)}     - Rollback the migration (undo changes)

${colorize('Examples:', colors.bright)}
  node runner.js 001_fix_task_hours_minutes dryRun
  node runner.js 001_fix_task_hours_minutes up
  node runner.js 001_fix_task_hours_minutes down

${colorize('Safety Tips:', colors.bright)}
  1. ${colorize('Always run dryRun first', colors.yellow)}
  2. Backup your database before running "up"
  3. Test on staging environment first
  4. Have a rollback plan ready

${colorize('Backup command:', colors.bright)}
  firebase firestore:export gs://your-bucket/backup-$(date +%s)
`);
    process.exit(0);
  }

  const migrationName = args[0];
  const mode = args[1] || 'dryRun';

  // Validate mode
  const validModes = ['dryRun', 'up', 'down'];
  if (!validModes.includes(mode)) {
    console.error(colorize(`\n❌ Invalid mode: ${mode}`, colors.red));
    console.log(`\nValid modes: ${validModes.join(', ')}`);
    console.log('Run with --help for usage information\n');
    process.exit(1);
  }

  // Run migration
  runMigration(migrationName, mode);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runMigration };
