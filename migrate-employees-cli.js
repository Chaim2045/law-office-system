/**
 * Migration Script: employees collection (CLI version)
 * Changes Document ID from USERNAME to EMAIL
 *
 * CRITICAL: Run this ONCE only!
 *
 * Usage:
 * 1. Make sure you're logged in: firebase login
 * 2. Run: node migrate-employees-cli.js
 */

// Import Firebase modules
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, writeBatch } = require('firebase/firestore');

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAlVbkAEBklF6lnxI_LsSg8ZXGlp0pgeMw",
  authDomain: "law-office-system-e4801.firebaseapp.com",
  databaseURL: "https://law-office-system-e4801-default-rtdb.firebaseio.com",
  projectId: "law-office-system-e4801",
  storageBucket: "law-office-system-e4801.firebasestorage.app",
  messagingSenderId: "199682320505",
  appId: "1:199682320505:web:8e4f5e34653476479b4ca8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateEmployees() {
  console.log('🚀 Starting employees migration: USERNAME → EMAIL');
  console.log('================================================\n');

  try {
    // Step 1: Get all employees
    console.log('📖 Step 1: Reading all employees...');
    const employeesCollection = collection(db, 'employees');
    const snapshot = await getDocs(employeesCollection);
    console.log(`   Found ${snapshot.size} employees\n`);

    if (snapshot.empty) {
      console.log('❌ No employees found!');
      return;
    }

    // Step 2: Analyze current state
    console.log('🔍 Step 2: Analyzing current document IDs...');
    const employees = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      employees.push({
        currentId: docSnap.id,
        email: data.email,
        username: data.username || data.name,
        data: data
      });
      console.log(`   - Document ID: "${docSnap.id}" | Email: "${data.email}" | Username: "${data.username || data.name}"`);
    });
    console.log('');

    // Step 3: Check if migration is needed
    console.log('✅ Step 3: Checking if migration is needed...');
    const needsMigration = employees.filter(emp => emp.currentId !== emp.email);

    if (needsMigration.length === 0) {
      console.log('✨ All documents already use EMAIL as ID. Migration not needed!');
      process.exit(0);
    }

    console.log(`   ${needsMigration.length} employees need migration\n`);

    // Step 4: Show what will be migrated
    console.log('📋 Step 4: Migration plan:');
    needsMigration.forEach(emp => {
      console.log(`   "${emp.username}": "${emp.currentId}" → "${emp.email}"`);
    });
    console.log('');

    // Step 5: Confirm
    console.log('⚠️  Step 5: This will:');
    console.log('   1. Create new documents with EMAIL as ID');
    console.log('   2. Copy all data from old documents');
    console.log('   3. Delete old documents with USERNAME as ID\n');

    console.log('🔴 CRITICAL: Make sure you have a backup!\n');
    console.log('Press Ctrl+C now to cancel, or wait 5 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 6: Migrate each employee
    console.log('🔄 Step 6: Migrating employees...\n');

    const batch = writeBatch(db);
    let migratedCount = 0;

    for (const emp of needsMigration) {
      // Check if target document already exists
      const targetDocRef = doc(db, 'employees', emp.email);
      const targetDoc = await getDoc(targetDocRef);
      if (targetDoc.exists()) {
        console.log(`⚠️  Warning: Document "${emp.email}" already exists! Skipping "${emp.username}"...`);
        continue;
      }

      console.log(`✏️  Migrating "${emp.username}": "${emp.currentId}" → "${emp.email}"`);

      // Create new document with email as ID
      const newDocRef = doc(db, 'employees', emp.email);
      batch.set(newDocRef, emp.data);

      // Delete old document
      const oldDocRef = doc(db, 'employees', emp.currentId);
      batch.delete(oldDocRef);

      migratedCount++;
    }

    // Step 7: Commit the batch
    if (migratedCount > 0) {
      console.log(`\n💾 Step 7: Committing ${migratedCount} changes to Firestore...`);
      await batch.commit();
      console.log('   ✅ Batch committed successfully!\n');
    } else {
      console.log('\n⚠️  No changes to commit\n');
    }

    // Step 8: Verify
    console.log('🔍 Step 8: Verifying migration...');
    const employeesCollection2 = collection(db, 'employees');
    const afterSnapshot = await getDocs(employeesCollection2);
    console.log(`   Total documents after migration: ${afterSnapshot.size}`);

    afterSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const status = docSnap.id === data.email ? '✅' : '⚠️';
      console.log(`   ${status} "${data.username || data.name}" → Document ID: ${docSnap.id}`);
    });

    console.log('\n================================================');
    console.log('✨ Migration completed successfully!');
    console.log(`   Migrated: ${migratedCount} employees`);
    console.log('================================================\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Stack:', error.stack);
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
