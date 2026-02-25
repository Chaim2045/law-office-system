const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccountPath = path.join(__dirname, '../../firebase-admin-key.json');

    if (!fs.existsSync(serviceAccountPath)) {
        console.error('Firebase key not found!');
        process.exit(1);
    }

    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'law-office-system-e4801'
    });
}

const db = admin.firestore();

async function countClientsByStatus() {
    const snapshot = await db.collection('clients').get();

    const total = snapshot.size;
    const statusCounts = {};
    let noStatus = 0;
    const noStatusDocs = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === undefined || data.status === null) {
            noStatus++;
            noStatusDocs.push({ id: doc.id, name: data.fullName || data.clientName || '(no name)' });
        } else {
            const s = String(data.status);
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        }
    });

    console.log(`TOTAL: ${total}`);
    console.log('\nBY STATUS:');
    for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${status}: ${count}`);
    }
    console.log(`  (no status field): ${noStatus}`);

    if (noStatusDocs.length > 0) {
        console.log('\nDOCS WITHOUT STATUS:');
        noStatusDocs.forEach(d => console.log(`  ${d.id} — ${d.name}`));
    }
}

countClientsByStatus().catch(console.error).then(() => process.exit(0));
