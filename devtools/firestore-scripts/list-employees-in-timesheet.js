/**
 * List all unique employees in timesheet_entries
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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

async function listEmployees() {
    try {
        console.log('🔍 Fetching all timesheet_entries...\n');

        const snapshot = await db.collection('timesheet_entries').get();

        console.log(`📊 Total entries: ${snapshot.size}\n`);

        const employeeSet = new Set();

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.employee) {
                employeeSet.add(data.employee);
            }
        });

        console.log('👥 Unique employees:\n');
        Array.from(employeeSet).sort().forEach(emp => {
            console.log(`   - ${emp}`);
        });

        console.log(`\n📊 Total unique employees: ${employeeSet.size}\n`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

listEmployees();
