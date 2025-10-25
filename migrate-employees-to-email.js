/**
 * Migration Script: employees collection
 * Changes Document ID from USERNAME to EMAIL
 *
 * CRITICAL: Run this ONCE only!
 *
 * Before running:
 * 1. Backup your Firestore data
 * 2. Review the script carefully
 *
 * Usage:
 * node migrate-employees-to-email.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateEmployees() {
  console.log('🚀 Starting employees migration: USERNAME → EMAIL');
  console.log('================================================\n');

  try {
    // Step 1: Get all employees
    console.log('📖 Step 1: Reading all employees...');
    const snapshot = await db.collection('employees').get();
    console.log(`   Found ${snapshot.size} employees\n`);

    if (snapshot.empty) {
      console.log('❌ No employees found!');
      return;
    }

    // Step 2: Analyze current state
    console.log('🔍 Step 2: Analyzing current document IDs...');
    const employees = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      employees.push({
        currentId: doc.id,
        email: data.email,
        username: data.username || data.name,
        data: data
      });
      console.log(`   - Document ID: "${doc.id}" | Email: "${data.email}" | Username: "${data.username || data.name}"`);
    });
    console.log('');

    // Step 3: Check if migration is needed
    console.log('✅ Step 3: Checking if migration is needed...');
    const needsMigration = employees.some(emp => emp.currentId !== emp.email);

    if (!needsMigration) {
      console.log('✨ All documents already use EMAIL as ID. Migration not needed!');
      return;
    }
    console.log('   Migration needed!\n');

    // Step 4: Confirm
    console.log('⚠️  Step 4: This will:');
    console.log('   1. Create new documents with EMAIL as ID');
    console.log('   2. Copy all data from old documents');
    console.log('   3. Delete old documents with USERNAME as ID\n');

    console.log('🔴 CRITICAL: Make sure you have a backup!\n');
    console.log('Press Ctrl+C now to cancel, or wait 5 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 5: Migrate each employee
    console.log('🔄 Step 5: Migrating employees...\n');

    const batch = db.batch();
    let migratedCount = 0;
    let skippedCount = 0;

    for (const emp of employees) {
      // Skip if already using email as ID
      if (emp.currentId === emp.email) {
        console.log(`⏭️  Skipping "${emp.username}" - already uses email as ID`);
        skippedCount++;
        continue;
      }

      // Check if target document already exists
      const targetDoc = await db.collection('employees').doc(emp.email).get();
      if (targetDoc.exists) {
        console.log(`⚠️  Warning: Document with email "${emp.email}" already exists! Skipping...`);
        skippedCount++;
        continue;
      }

      console.log(`✏️  Migrating "${emp.username}": "${emp.currentId}" → "${emp.email}"`);

      // Create new document with email as ID
      const newDocRef = db.collection('employees').doc(emp.email);
      batch.set(newDocRef, emp.data);

      // Delete old document
      const oldDocRef = db.collection('employees').doc(emp.currentId);
      batch.delete(oldDocRef);

      migratedCount++;
    }

    // Step 6: Commit the batch
    if (migratedCount > 0) {
      console.log(`\n💾 Step 6: Committing ${migratedCount} changes...`);
      await batch.commit();
      console.log('   ✅ Batch committed successfully!\n');
    }

    // Step 7: Verify
    console.log('🔍 Step 7: Verifying migration...');
    const afterSnapshot = await db.collection('employees').get();
    console.log(`   Total documents: ${afterSnapshot.size}`);

    afterSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   ✅ "${data.username || data.name}" → Document ID: ${doc.id}`);
    });

    console.log('\n================================================');
    console.log('✨ Migration completed successfully!');
    console.log(`   Migrated: ${migratedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log('================================================\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateEmployees()
  .then(() => {
    console.log('✅ Script finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
