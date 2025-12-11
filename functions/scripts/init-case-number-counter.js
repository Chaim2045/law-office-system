/**
 * Initialize Case Number Counter
 * סקריפט חד-פעמי ליצירת Counter למספרי תיקים
 *
 * Usage:
 *   node scripts/init-case-number-counter.js
 *
 * What it does:
 * 1. מצא את המספר תיק האחרון הקיים ב-clients collection
 * 2. יצור/עדכן את ה-Counter ב-_system/caseNumberCounter
 * 3. מוודא שה-Counter מסונכרן עם המצב הקיים
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
// Note: צריך service account key או להיות מחובר ב-`firebase login`
try {
  const serviceAccount = require(path.join(__dirname, '../../service-account-key.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  // If no service account key, use default credentials
  admin.initializeApp();
}

const db = admin.firestore();

async function initCounter() {
  console.log('🚀 Starting Case Number Counter initialization...\n');

  try {
    // Step 1: מצא את המספר תיק האחרון הקיים
    console.log('📊 Step 1: Fetching last case number from clients collection...');

    const snapshot = await db.collection('clients')
      .orderBy('caseNumber', 'desc')
      .limit(1)
      .get();

    let lastNumber = 0;
    let year = new Date().getFullYear().toString();
    let lastCaseNumber = null;

    if (!snapshot.empty) {
      lastCaseNumber = snapshot.docs[0].data().caseNumber;
      console.log(`   Found last case: ${lastCaseNumber}`);

      if (lastCaseNumber && lastCaseNumber.startsWith(year)) {
        // חלץ את המספר הסידורי (3 ספרות אחרונות)
        lastNumber = parseInt(lastCaseNumber.slice(-3));
        console.log(`   Extracted last number: ${lastNumber} for year ${year}`);
      } else if (lastCaseNumber) {
        console.log(`   Last case is from previous year: ${lastCaseNumber}`);
        console.log(`   Starting fresh for year ${year}`);
      }
    } else {
      console.log('   No existing cases found - starting from 1');
    }

    // Step 2: יצור/עדכן את ה-Counter
    console.log('\n💾 Step 2: Creating/updating counter document...');

    const counterRef = db.collection('_system').doc('caseNumberCounter');

    await counterRef.set({
      year: year,
      lastNumber: lastNumber,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      _metadata: {
        initialized: true,
        initializedAt: admin.firestore.FieldValue.serverTimestamp(),
        initializedFrom: lastCaseNumber || 'fresh_start',
        note: 'Atomic counter for case number generation'
      },
      _stats: {
        totalTransactions: 0,
        lastAttemptCount: 0,
        lastCaseNumber: lastCaseNumber || null
      }
    });

    console.log(`   ✅ Counter initialized:`);
    console.log(`      Year: ${year}`);
    console.log(`      Last Number: ${lastNumber}`);
    console.log(`      Next Case: ${year}${(lastNumber + 1).toString().padStart(3, '0')}`);

    // Step 3: Verification
    console.log('\n🔍 Step 3: Verifying counter...');

    const verifyDoc = await counterRef.get();
    if (verifyDoc.exists) {
      const data = verifyDoc.data();
      console.log('   ✅ Counter verified:');
      console.log(`      ${JSON.stringify(data, null, 2)}`);
    } else {
      console.error('   ❌ ERROR: Counter document not found after creation!');
      process.exit(1);
    }

    console.log('\n✅ SUCCESS: Case Number Counter initialized successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Deploy Security Rules: firebase deploy --only firestore:rules');
    console.log('   2. Deploy Functions: firebase deploy --only functions');
    console.log('   3. Test case creation\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the initialization
initCounter()
  .then(() => {
    console.log('🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
