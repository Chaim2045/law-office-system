/**
 * List All Firebase Auth Users
 * Usage: node .claude/firestore-scripts/list-users.js
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

async function listAllUsers() {
    try {
        console.log('🔍 Fetching all Firebase Auth users...\n');

        const listUsersResult = await admin.auth().listUsers();

        console.log(`📊 Total users: ${listUsersResult.users.length}\n`);

        const users = [];

        listUsersResult.users.forEach((userRecord) => {
            const user = {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                disabled: userRecord.disabled,
                emailVerified: userRecord.emailVerified,
                customClaims: userRecord.customClaims || {},
                creationTime: userRecord.metadata.creationTime,
                lastSignInTime: userRecord.metadata.lastSignInTime
            };

            users.push(user);

            console.log(`👤 ${user.email}`);
            console.log(`   UID: ${user.uid}`);
            console.log(`   Role: ${user.customClaims?.role || 'user'}`);
            console.log(`   Active: ${!user.disabled}`);
            console.log('');
        });

        // Save to cache
        const cacheDir = path.join(__dirname, '../firestore-data');
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }

        const cacheFile = path.join(cacheDir, 'all-users.json');
        fs.writeFileSync(cacheFile, JSON.stringify({
            fetchedAt: new Date().toISOString(),
            totalCount: users.length,
            users: users
        }, null, 2));

        console.log(`💾 Users cached to: ${cacheFile}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

listAllUsers();
