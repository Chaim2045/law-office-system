/**
 * Get Sample Timesheet Entry
 * Usage: node .claude/firestore-scripts/sample-timesheet-entry.js
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

async function getSampleTimesheetEntry() {
    try {
        console.log('🔍 Fetching sample timesheet entry...\n');

        const snapshot = await db.collection('timesheet_entries')
            .limit(5)
            .get();

        console.log(`📊 Total entries found: ${snapshot.size}\n`);

        const entries = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            entries.push({
                id: doc.id,
                ...data,
                date: data.date?.toDate?.() || data.date
            });

            console.log('─────────────────────────────────────');
            console.log(`📝 Entry ID: ${doc.id}`);
            console.log(`   clientId: ${data.clientId || 'N/A'}`);
            console.log(`   clientName: ${data.clientName || 'N/A'}`);
            console.log(`   serviceId: ${data.serviceId || 'N/A'}`);
            console.log(`   serviceName: ${data.serviceName || 'N/A'}`);
            console.log(`   serviceType: ${data.serviceType || 'N/A'}`);
            console.log(`   parentServiceId: ${data.parentServiceId || 'N/A'}`);
            console.log(`   stageId: ${data.stageId || 'N/A'}`);
            console.log(`   stage: ${data.stage || 'N/A'}`);
            console.log(`   stageName: ${data.stageName || 'N/A'}`);
            console.log(`   minutes: ${data.minutes || 'N/A'}`);
            console.log(`   employee: ${data.employee || 'N/A'}`);
            console.log(`   taskDescription: ${data.taskDescription || 'N/A'}`);
            console.log('');
        });

        // Save to cache
        const cacheDir = path.join(__dirname, '../firestore-data');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        const cacheFile = path.join(cacheDir, 'sample-timesheet-entries.json');
        fs.writeFileSync(cacheFile, JSON.stringify({
            fetchedAt: new Date().toISOString(),
            totalCount: entries.length,
            entries: entries
        }, null, 2));

        console.log(`💾 Cached to: ${cacheFile}\n`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

getSampleTimesheetEntry();
