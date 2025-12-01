/**
 * List All Firestore Collections
 * Usage: node .claude/firestore-scripts/list-collections.js
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

async function listCollections() {
    try {
        console.log('🔍 Fetching all Firestore collections...\n');

        const collections = await db.listCollections();

        console.log(`📊 Total collections: ${collections.length}\n`);

        const collectionsData = [];

        for (const collection of collections) {
            const snapshot = await collection.limit(1).get();
            const count = snapshot.size > 0 ? '≥1' : '0';

            console.log(`📁 ${collection.id} (${count} documents)`);

            collectionsData.push({
                id: collection.id,
                path: collection.path
            });

            // Get sample document structure
            if (snapshot.size > 0) {
                const doc = snapshot.docs[0];
                const data = doc.data();
                console.log(`   Sample fields: ${Object.keys(data).slice(0, 5).join(', ')}...`);
            }
            console.log('');
        }

        // Save to cache
        const cacheDir = path.join(__dirname, '../firestore-data');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        const cacheFile = path.join(cacheDir, 'all-collections.json');
        fs.writeFileSync(cacheFile, JSON.stringify({
            fetchedAt: new Date().toISOString(),
            totalCount: collectionsData.length,
            collections: collectionsData
        }, null, 2));

        console.log(`💾 Collections cached to: ${cacheFile}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

listCollections();
