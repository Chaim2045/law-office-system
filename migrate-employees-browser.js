הוא /**
 * Migration Script: employees collection (Browser version)
 * Changes Document ID from USERNAME to EMAIL
 *
 * CRITICAL: Run this ONCE only!
 *
 * Usage:
 * 1. Open your law office system in the browser
 * 2. Make sure you're logged in as admin
 * 3. Open DevTools Console (F12)
 * 4. Copy-paste this entire file into the console
 * 5. Press Enter
 */

(async function migrateEmployeesToEmail() {
  console.log('🚀 Starting employees migration: USERNAME → EMAIL');
  console.log('================================================\n');

  const db = window.firebaseDB;

  if (!db) {
    console.error('❌ Firebase not initialized! Make sure you are on the law office system page.');
    return;
  }

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
    const needsMigration = employees.filter(emp => emp.currentId !== emp.email);

    if (needsMigration.length === 0) {
      console.log('✨ All documents already use EMAIL as ID. Migration not needed!');
      return;
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

    console.log('🔴 CRITICAL: Press Ctrl+C NOW to cancel!');
    console.log('Waiting 5 seconds before starting...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 6: Migrate each employee
    console.log('🔄 Step 6: Migrating employees...\n');

    const batch = db.batch();
    let migratedCount = 0;

    for (const emp of needsMigration) {
      // Check if target document already exists
      const targetDoc = await db.collection('employees').doc(emp.email).get();
      if (targetDoc.exists) {
        console.log(`⚠️  Warning: Document "${emp.email}" already exists! Skipping "${emp.username}"...`);
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
    const afterSnapshot = await db.collection('employees').get();
    console.log(`   Total documents after migration: ${afterSnapshot.size}`);

    afterSnapshot.forEach(doc => {
      const data = doc.data();
      const status = doc.id === data.email ? '✅' : '⚠️';
      console.log(`   ${status} "${data.username || data.name}" → Document ID: ${doc.id}`);
    });

    console.log('\n================================================');
    console.log('✨ Migration completed successfully!');
    console.log(`   Migrated: ${migratedCount} employees`);
    console.log('================================================\n');

    console.log('✅ Now refresh the page and log in again!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Stack:', error.stack);
  }
})();
