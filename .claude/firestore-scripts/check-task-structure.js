/**
 * Check budget_tasks structure
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize
if (!admin.apps.length) {
    const serviceAccount = require(path.join(__dirname, '../../firebase-admin-key.json'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkTaskStructure() {
    try {
        console.log('🔍 Checking budget_tasks structure...\n');

        const snapshot = await db.collection('budget_tasks').limit(3).get();

        if (snapshot.empty) {
            console.log('❌ No tasks found');
            process.exit(1);
        }

        snapshot.forEach(doc => {
            const task = doc.data();
            console.log(`📋 Task ID: ${doc.id}`);
            console.log(`   clientName: ${task.clientName || 'N/A'}`);
            console.log(`   serviceId: ${task.serviceId || 'N/A'}`);
            console.log(`   serviceName: ${task.serviceName || 'N/A'}`);
            console.log(`   serviceType: ${task.serviceType || 'N/A'}`);
            console.log(`   parentServiceId: ${task.parentServiceId || 'N/A'}`);
            console.log('');
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkTaskStructure();
