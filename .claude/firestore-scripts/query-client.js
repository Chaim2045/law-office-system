/**
 * Query Client Data from Firestore
 * Usage: node .claude/firestore-scripts/query-client.js "אורי שטיינברג"
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

async function queryClient() {
    try {
        console.log(`🔍 Searching for: ${clientName}\n`);

        const snapshot = await db.collection('clients')
            .where('fullName', '==', clientName)
            .get();

        if (snapshot.empty) {
            console.log('❌ No client found');
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();

            // Save to cache
            const cacheDir = path.join(__dirname, '../firestore-data');
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            const cacheFile = path.join(cacheDir, `client-${doc.id}.json`);
            fs.writeFileSync(cacheFile, JSON.stringify({
                id: doc.id,
                data: data,
                fetchedAt: new Date().toISOString()
            }, null, 2));

            console.log('✅ Client found!');
            console.log(`📁 Document ID: ${doc.id}`);
            console.log(`💾 Cached to: ${cacheFile}\n`);
            console.log(JSON.stringify(data, null, 2));
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

queryClient();
