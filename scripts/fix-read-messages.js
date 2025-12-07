/**
 * One-time Script: Fix old 'read' messages to 'dismissed'
 *
 * Problem: Old messages with status='read' still exist in Firestore
 * Solution: Update all 'read' messages to 'dismissed'
 *
 * Run: node scripts/fix-read-messages.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://law-office-system-e4801.firebaseio.com"
});

const db = admin.firestore();

async function fixReadMessages() {
  console.log('🔍 Searching for messages with status="read"...');

  try {
    const snapshot = await db.collection('user_messages')
      .where('status', '==', 'read')
      .get();

    console.log(`📊 Found ${snapshot.size} messages with status="read"`);

    if (snapshot.size === 0) {
      console.log('✅ No messages to fix!');
      process.exit(0);
    }

    // Update in batches (max 500 per batch)
    const batchSize = 500;
    let batch = db.batch();
    let count = 0;
    let totalUpdated = 0;

    for (const doc of snapshot.docs) {
      batch.update(doc.ref, {
        status: 'dismissed',
        dismissedAt: admin.firestore.FieldValue.serverTimestamp(),
        _migratedFrom: 'read' // For tracking
      });

      count++;

      // Commit batch every 500 operations
      if (count === batchSize) {
        await batch.commit();
        totalUpdated += count;
        console.log(`✅ Updated ${totalUpdated} messages...`);
        batch = db.batch();
        count = 0;
      }
    }

    // Commit remaining operations
    if (count > 0) {
      await batch.commit();
      totalUpdated += count;
    }

    console.log(`\n✅ Successfully updated ${totalUpdated} messages from 'read' to 'dismissed'`);
    console.log('🎉 Migration complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run
fixReadMessages();
