/**
 * Delete ALL Client-Related Data from Firestore
 * ⚠️ WARNING: This script will DELETE all client data including:
 * - clients collection
 * - cases collection
 * - timesheet_entries collection
 * - budget_tasks collection
 * - All associated logs
 *
 * Usage: node .claude/firestore-scripts/delete-all-client-data.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccountPath = path.join(__dirname, '../../firebase-admin-key.json');

    if (!fs.existsSync(serviceAccountPath)) {
        console.error('❌ firebase-admin-key.json not found!');
        process.exit(1);
    }

    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'law-office-system-e4801'
    });
}

const db = admin.firestore();

/**
 * Delete all documents in a collection
 */
async function deleteCollection(collectionName) {
    const batchSize = 500;
    let deletedCount = 0;

    console.log(`\n🗑️ Deleting collection: ${collectionName}`);

    const collectionRef = db.collection(collectionName);

    while (true) {
        const snapshot = await collectionRef.limit(batchSize).get();

        if (snapshot.size === 0) {
            break;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        deletedCount += snapshot.size;
        console.log(`   Deleted ${deletedCount} documents...`);
    }

    console.log(`✅ Deleted ${deletedCount} total documents from ${collectionName}`);
    return deletedCount;
}

/**
 * Delete documents by query (for subcollections or filtered deletes)
 */
async function deleteByQuery(collectionName, fieldPath, operator, value) {
    const batchSize = 500;
    let deletedCount = 0;

    console.log(`\n🗑️ Deleting from ${collectionName} where ${fieldPath} ${operator} ${value}`);

    const query = db.collection(collectionName).where(fieldPath, operator, value);

    while (true) {
        const snapshot = await query.limit(batchSize).get();

        if (snapshot.size === 0) {
            break;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        deletedCount += snapshot.size;
        console.log(`   Deleted ${deletedCount} documents...`);
    }

    console.log(`✅ Deleted ${deletedCount} total documents`);
    return deletedCount;
}

/**
 * Confirm deletion with user
 */
async function confirmDeletion() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('\n⚠️ WARNING: This will DELETE ALL client data!\n\nType "DELETE ALL" to confirm: ', (answer) => {
            rl.close();
            resolve(answer === 'DELETE ALL');
        });
    });
}

async function deleteAllClientData() {
    try {
        console.log('╔═══════════════════════════════════════════════════════════════╗');
        console.log('║  🔥 DELETE ALL CLIENT DATA FROM FIRESTORE                    ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');

        // Confirm deletion
        const confirmed = await confirmDeletion();

        if (!confirmed) {
            console.log('\n❌ Deletion cancelled by user.');
            process.exit(0);
        }

        console.log('\n🚀 Starting deletion process...\n');

        const stats = {
            clients: 0,
            cases: 0,
            timesheet_entries: 0,
            budget_tasks: 0,
            activityLogs: 0,
            notifications: 0,
            task_completion_alerts: 0,
            total: 0
        };

        // 1. Delete clients collection
        stats.clients = await deleteCollection('clients');

        // 2. Delete cases collection
        stats.cases = await deleteCollection('cases');

        // 3. Delete timesheet_entries collection
        stats.timesheet_entries = await deleteCollection('timesheet_entries');

        // 4. Delete budget_tasks collection
        stats.budget_tasks = await deleteCollection('budget_tasks');

        // 5. Delete task completion alerts
        stats.task_completion_alerts = await deleteCollection('task_completion_alerts');

        // 6. Delete activity logs related to clients
        console.log('\n🗑️ Deleting activity logs (client-related)...');
        const activityLogsSnapshot = await db.collection('activityLogs')
            .where('entityType', 'in', ['client', 'case', 'timesheet', 'task'])
            .get();

        if (activityLogsSnapshot.size > 0) {
            const batch = db.batch();
            activityLogsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            stats.activityLogs = activityLogsSnapshot.size;
            console.log(`✅ Deleted ${stats.activityLogs} activity logs`);
        }

        // 7. Delete notifications related to clients
        console.log('\n🗑️ Deleting notifications (client-related)...');
        const notificationsSnapshot = await db.collection('notifications')
            .where('type', 'in', ['client_created', 'task_completed', 'hours_low', 'timesheet_added'])
            .get();

        if (notificationsSnapshot.size > 0) {
            const batch = db.batch();
            notificationsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            stats.notifications = notificationsSnapshot.size;
            console.log(`✅ Deleted ${stats.notifications} notifications`);
        }

        // Calculate total
        stats.total = Object.values(stats).reduce((sum, val) => sum + val, 0) - stats.total;

        // Summary
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║  ✅ DELETION COMPLETE - SUMMARY                              ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log('\n📊 Deleted Documents:');
        console.log(`   • clients: ${stats.clients}`);
        console.log(`   • cases: ${stats.cases}`);
        console.log(`   • timesheet_entries: ${stats.timesheet_entries}`);
        console.log(`   • budget_tasks: ${stats.budget_tasks}`);
        console.log(`   • task_completion_alerts: ${stats.task_completion_alerts}`);
        console.log(`   • activityLogs: ${stats.activityLogs}`);
        console.log(`   • notifications: ${stats.notifications}`);
        console.log('   ─────────────────────────────────');
        console.log(`   📌 TOTAL: ${stats.total} documents deleted\n`);

        // Save summary to backup folder
        const backupDir = path.join(__dirname, '../../backup-clean-architecture-2025-12-01_14-21-15');
        const summaryFile = path.join(backupDir, 'deletion-summary.json');

        fs.writeFileSync(summaryFile, JSON.stringify({
            deletedAt: new Date().toISOString(),
            stats: stats
        }, null, 2));

        console.log(`💾 Deletion summary saved to: ${summaryFile}\n`);
        console.log('✅ Firestore is now clean - ready for new architecture!\n');

        process.exit(0);

    } catch (error) {
        console.error('❌ Error during deletion:', error);
        process.exit(1);
    }
}

deleteAllClientData();
