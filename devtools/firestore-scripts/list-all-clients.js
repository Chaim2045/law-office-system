/**
 * List All Clients from Firestore
 * Usage: node .claude/firestore-scripts/list-all-clients.js
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

async function listAllClients() {
    try {
        console.log('🔍 Fetching all clients...\n');

        const snapshot = await db.collection('clients').get();

        console.log(`📊 Total clients: ${snapshot.size}\n`);

        const clients = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            clients.push({
                id: doc.id,
                fullName: data.fullName,
                type: data.type,
                procedureType: data.procedureType,
                email: data.email,
                status: data.status,
                totalHours: data.totalHours,
                hoursRemaining: data.hoursRemaining,
                servicesCount: data.services?.length || 0
            });

            console.log(`📌 ${data.fullName} (${data.type || data.procedureType || 'unknown'})`);
        });

        // Save summary to cache
        const cacheDir = path.join(__dirname, '../firestore-data');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        const cacheFile = path.join(cacheDir, 'all-clients-summary.json');
        fs.writeFileSync(cacheFile, JSON.stringify({
            fetchedAt: new Date().toISOString(),
            totalCount: clients.length,
            clients: clients
        }, null, 2));

        console.log(`\n💾 Summary cached to: ${cacheFile}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

listAllClients();
