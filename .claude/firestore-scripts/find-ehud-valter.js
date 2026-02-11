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

async function findEhudValter() {
    console.log('=== SEARCHING FOR אהוד ולטר IN clients COLLECTION ===\n');

    // 1. Search by fullName
    console.log('--- Search 1: fullName == "אהוד ולטר" ---');
    const byFullName = await db.collection('clients')
        .where('fullName', '==', 'אהוד ולטר')
        .get();
    console.log(`Results: ${byFullName.size}`);
    byFullName.forEach(doc => {
        console.log(`\nDOC ID: ${doc.id}`);
        console.log(JSON.stringify(doc.data(), null, 2));
    });

    // 2. Search by clientName
    console.log('\n--- Search 2: clientName == "אהוד ולטר" ---');
    const byClientName = await db.collection('clients')
        .where('clientName', '==', 'אהוד ולטר')
        .get();
    console.log(`Results: ${byClientName.size}`);
    byClientName.forEach(doc => {
        console.log(`\nDOC ID: ${doc.id}`);
        console.log(JSON.stringify(doc.data(), null, 2));
    });

    // 3. Broad search - scan ALL clients and look for "אהוד" or "ולטר" in any field
    console.log('\n--- Search 3: Full scan for "אהוד" or "ולטר" in any name field ---');
    const allClients = await db.collection('clients').get();
    console.log(`Total clients in collection: ${allClients.size}`);

    const found = [];
    allClients.forEach(doc => {
        const data = doc.data();
        const fullName = (data.fullName || '').toLowerCase();
        const clientName = (data.clientName || '').toLowerCase();
        const name = (data.name || '').toLowerCase();

        if (fullName.includes('אהוד') || fullName.includes('ולטר') ||
            clientName.includes('אהוד') || clientName.includes('ולטר') ||
            name.includes('אהוד') || name.includes('ולטר') ||
            doc.id.includes('אהוד') || doc.id.includes('ולטר')) {
            found.push({ id: doc.id, data: data });
        }
    });

    console.log(`\nFound ${found.length} matching documents:`);
    found.forEach(item => {
        console.log(`\n========== DOC ID: ${item.id} ==========`);
        console.log(JSON.stringify(item.data, null, 2));
    });

    // 4. Also grab a known visible/active client for comparison
    console.log('\n\n=== SAMPLE ACTIVE CLIENT FOR COMPARISON ===');
    const activeClients = await db.collection('clients')
        .where('status', '==', 'active')
        .limit(2)
        .get();

    activeClients.forEach(doc => {
        console.log(`\n========== ACTIVE CLIENT DOC ID: ${doc.id} ==========`);
        console.log(JSON.stringify(doc.data(), null, 2));
    });

    console.log('\n\nDone.');
}

findEhudValter().catch(console.error).then(() => process.exit(0));
