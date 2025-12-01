/**
 * Query Timesheet Entries for Client
 * Usage: node .claude/firestore-scripts/query-timesheet.js "אורי שטיינברג"
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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
const clientName = process.argv[2] || 'אורי שטיינברג';

async function queryTimesheet() {
    try {
        console.log(`🔍 Searching timesheet entries for: ${clientName}\n`);

        const snapshot = await db.collection('timesheet')
            .where('clientName', '==', clientName)
            .orderBy('date', 'desc')
            .get();

        console.log(`📊 Total entries: ${snapshot.size}\n`);

        const entries = [];
        let totalMinutes = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            entries.push({
                id: doc.id,
                date: data.date?.toDate?.() || data.date,
                employee: data.employee,
                serviceName: data.serviceName,
                stage: data.stage,
                minutes: data.minutes,
                taskDescription: data.taskDescription,
                notes: data.notes
            });

            totalMinutes += data.minutes || 0;

            console.log(`📅 ${data.date?.toDate?.().toLocaleDateString('he-IL') || 'Unknown'}`);
            console.log(`   Service: ${data.serviceName || data.stage || '-'}`);
            console.log(`   Minutes: ${data.minutes}`);
            console.log(`   Task: ${data.taskDescription || '-'}`);
            console.log('');
        });

        console.log(`⏱️ Total minutes: ${totalMinutes}`);
        console.log(`⏱️ Total hours: ${(totalMinutes / 60).toFixed(2)}\n`);

        // Save to cache
        const cacheDir = path.join(__dirname, '../firestore-data');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        const cacheFile = path.join(cacheDir, `timesheet-${clientName.replace(/\s+/g, '-')}.json`);
        fs.writeFileSync(cacheFile, JSON.stringify({
            fetchedAt: new Date().toISOString(),
            clientName: clientName,
            totalEntries: entries.length,
            totalMinutes: totalMinutes,
            totalHours: totalMinutes / 60,
            entries: entries
        }, null, 2));

        console.log(`💾 Cached to: ${cacheFile}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

queryTimesheet();
