/**
 * Query Timesheet Entries for Employee by Date Range
 * Usage: node .claude/firestore-scripts/query-employee-hours.js
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

async function queryEmployeeHours() {
    try {
        const employee = 'marva@ghlawoffice.co.il';

        console.log(`🔍 Step 1: Get all entries for ${employee}\n`);

        const allSnapshot = await db.collection('timesheet_entries')
            .where('employee', '==', employee)
            .get();

        console.log(`📊 Total entries for employee: ${allSnapshot.size}\n`);

        if (allSnapshot.size === 0) {
            console.log('❌ No entries found for this employee');
            process.exit(0);
        }

        // Show first 3 entries to see date format
        console.log('📝 Sample entries:');
        let count = 0;
        allSnapshot.forEach(doc => {
            if (count < 3) {
                const data = doc.data();
                console.log(`   ${doc.id}: date=${data.date} (type: ${typeof data.date}), minutes=${data.minutes}`);
                count++;
            }
        });

        console.log('\n🔍 Step 2: Filter for January 2026\n');

        let totalMinutes = 0;
        let matchedCount = 0;

        allSnapshot.forEach(doc => {
            const data = doc.data();
            let dateObj;

            // Handle both string and timestamp formats
            if (typeof data.date === 'string') {
                dateObj = new Date(data.date);
            } else if (data.date && data.date.toDate) {
                dateObj = data.date.toDate();
            } else {
                return;
            }

            const year = dateObj.getFullYear();
            const month = dateObj.getMonth(); // 0-11

            if (year === 2026 && month === 0) { // January = 0
                totalMinutes += data.minutes || 0;
                matchedCount++;
            }
        });

        const totalHours = (totalMinutes / 60).toFixed(2);

        console.log(`📊 Matched entries: ${matchedCount}`);
        console.log(`⏱️  Total minutes: ${totalMinutes}`);
        console.log(`⏱️  Total hours: ${totalHours}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

queryEmployeeHours();
