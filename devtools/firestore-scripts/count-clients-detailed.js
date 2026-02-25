const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
    const serviceAccountPath = path.join(__dirname, '../../firebase-admin-key.json');
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'law-office-system-e4801'
    });
}

const db = admin.firestore();

async function main() {
    const snapshot = await db.collection('clients').get();
    const total = snapshot.size;

    let internal = 0;
    let notInternal = 0;
    const internalDocs = [];
    const statusAfterFilter = {};

    snapshot.forEach(doc => {
        const data = doc.data();
        const isInternal = data.isInternal === true || data.clientType === 'internal';

        if (isInternal) {
            internal++;
            internalDocs.push({
                id: doc.id,
                name: data.fullName || data.clientName || '(no name)',
                isInternal: data.isInternal,
                clientType: data.clientType
            });
        } else {
            notInternal++;
            // also default status to 'active' like admin panel does
            const status = data.status || 'active';
            statusAfterFilter[status] = (statusAfterFilter[status] || 0) + 1;
        }
    });

    console.log(`TOTAL docs in collection: ${total}`);
    console.log(`Internal (filtered out): ${internal}`);
    console.log(`Non-internal (displayed): ${notInternal}`);
    console.log('\nInternal docs:');
    internalDocs.forEach(d => console.log(`  ${d.id} — ${d.name} (isInternal=${d.isInternal}, clientType=${d.clientType})`));
    console.log('\nNon-internal by status:');
    for (const [s, c] of Object.entries(statusAfterFilter).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${s}: ${c}`);
    }
}

main().catch(console.error).then(() => process.exit(0));
