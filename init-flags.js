const admin = require('firebase-admin');

// Initialize Firebase Admin
// Uses GOOGLE_APPLICATION_CREDENTIALS environment variable if set
// Otherwise uses default credentials
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'law-office-system-e4801'
  });
}

const db = admin.firestore();

const FEATURE_FLAGS = {
  FROZEN_TASKS_ON_STAGE_CHANGE: {
    name: 'Frozen Tasks on Stage Change',
    description: 'סימון משימות כקפואות כאשר התיק עובר לשלב הבא',
    defaultValue: false,
    version: '1.0.0'
  }
};

async function initializeFlags() {
  try {
    console.log('🔧 Initializing feature flags...');

    const flagsRef = db.collection('system_settings').doc('feature_flags');
    const doc = await flagsRef.get();

    if (doc.exists) {
      console.log('✅ Feature flags already exist');
      const data = doc.data();
      console.log('\nCurrent flags:');
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'object' && value.enabled !== undefined) {
          console.log(`  ${key}: ${value.enabled ? '🟢 ON' : '🔴 OFF'}`);
        }
      });
    } else {
      console.log('📝 Creating new feature flags document...');

      const flagsData = {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };

      Object.entries(FEATURE_FLAGS).forEach(([key, config]) => {
        flagsData[key] = {
          enabled: config.defaultValue,
          name: config.name,
          description: config.description,
          version: config.version,
          lastModified: admin.firestore.FieldValue.serverTimestamp()
        };
      });

      await flagsRef.set(flagsData);
      console.log('✅ Feature flags initialized successfully!');
      console.log('\nInitialized flags:');
      Object.entries(FEATURE_FLAGS).forEach(([key, config]) => {
        console.log(`  ${key}: ${config.defaultValue ? '🟢 ON' : '🔴 OFF'} (default)`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

initializeFlags();
