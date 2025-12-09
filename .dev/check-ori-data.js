const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with Service Account
if (!admin.apps.length) {
    const serviceAccountPath = path.join(__dirname, 'firebase-admin-key.json');

    if (!fs.existsSync(serviceAccountPath)) {
        console.error('❌ Error: firebase-admin-key.json not found!');
        console.error('Please follow these steps:');
        console.error('1. Go to Firebase Console → Project Settings → Service Accounts');
        console.error('2. Click "Generate New Private Key"');
        console.error('3. Save the file as "firebase-admin-key.json" in the project root');
        process.exit(1);
    }

    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'law-office-system-e4801',
        databaseURL: 'https://law-office-system-e4801-default-rtdb.firebaseio.com'
    });
}

const db = admin.firestore();

async function checkOriData() {
    try {
        console.log('🔍 Searching for אורי שטיינברג...\n');

        const snapshot = await db.collection('clients')
            .where('fullName', '==', 'אורי שטיינברג')
            .get();

        if (snapshot.empty) {
            console.log('❌ No client found with name "אורי שטיינברג"');

            // Try to get all clients to see what's available
            console.log('\n📋 Fetching all clients to see available names...\n');
            const allClients = await db.collection('clients').limit(10).get();

            allClients.forEach(doc => {
                const data = doc.data();
                console.log(`- ${data.fullName || 'No name'} (ID: ${doc.id})`);
            });

            process.exit(0);
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            console.log('✅ Found client!');
            console.log('Document ID:', doc.id);
            console.log('\n=== CLIENT DATA ===\n');
            console.log(JSON.stringify(data, null, 2));

            // Highlight key fields for analysis
            console.log('\n=== KEY FIELDS ANALYSIS ===\n');
            console.log('📌 Type:', data.type);
            console.log('📌 Procedure Type:', data.procedureType);
            console.log('📌 Total Hours (top level):', data.totalHours);
            console.log('📌 Hours Remaining (top level):', data.hoursRemaining);
            console.log('📌 Current Stage:', data.currentStage);

            if (data.services && data.services.length > 0) {
                console.log('\n📦 SERVICES ARRAY:');
                data.services.forEach((service, index) => {
                    console.log(`\n  Service ${index + 1}:`);
                    console.log(`    - Name: ${service.name}`);
                    console.log(`    - Type: ${service.type}`);
                    console.log(`    - Status: ${service.status}`);
                    console.log(`    - Stage: ${service.stage}`);
                    console.log(`    - Hours: ${service.hours}`);
                    console.log(`    - Total Hours: ${service.totalHours}`);
                    console.log(`    - Hours Remaining: ${service.hoursRemaining}`);
                    console.log(`    - Hours Used: ${service.hoursUsed}`);

                    if (service.stages && service.stages.length > 0) {
                        console.log(`    - Stages Array:`);
                        service.stages.forEach((stage, si) => {
                            console.log(`      Stage ${si + 1}:`);
                            console.log(`        - Name: ${stage.name}`);
                            console.log(`        - Status: ${stage.status}`);
                            console.log(`        - Hours: ${stage.hours}`);
                            console.log(`        - Total Hours: ${stage.totalHours}`);
                            console.log(`        - Hours Remaining: ${stage.hoursRemaining}`);
                        });
                    }
                });
            }

            if (data.stages) {
                console.log('\n🎯 STAGES (top level):');
                console.log(JSON.stringify(data.stages, null, 2));
            }
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkOriData();
