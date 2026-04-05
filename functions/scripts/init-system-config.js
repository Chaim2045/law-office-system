/**
 * Initialize System Config
 * סקריפט חד-פעמי ליצירת system_config ב-Firestore
 *
 * Usage:
 *   cd functions && node scripts/init-system-config.js
 *
 * IDEMPOTENT: If system_config already exists, skips without overwriting.
 */

'use strict';

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
try {
  const serviceAccount = require(path.join(__dirname, '../../service-account-key.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  admin.initializeApp();
}

const db = admin.firestore();
const { SYSTEM_CONSTANTS } = require('../shared/constants');

async function initSystemConfig() {
  console.log('🚀 Starting System Config initialization...\n');

  const configRef = db.collection('_system').doc('system_config');

  try {
    // Step 1: Check if already exists (IDEMPOTENT)
    console.log('📊 Step 1: Checking if system_config already exists...');
    const existing = await configRef.get();

    if (existing.exists) {
      const data = existing.data();
      console.log('⚠️  system_config already exists — skipping init');
      console.log(`   Version: ${data._version}`);
      console.log(`   Updated: ${data._updatedAt?.toDate?.() || 'unknown'}`);
      console.log(`   Updated by: ${data._updatedBy || 'unknown'}`);
      console.log('\n✅ No changes made.');
      return;
    }

    // Step 2: Create with default values from SYSTEM_CONSTANTS
    console.log('📝 Step 2: Creating system_config with default values...');

    const defaultConfig = {
      serviceTypes: {
        hours: { label: SYSTEM_CONSTANTS.SERVICE_TYPE_LABELS.hours, icon: 'fa-clock', active: true },
        legal_procedure: { label: SYSTEM_CONSTANTS.SERVICE_TYPE_LABELS.legal_procedure, icon: 'fa-gavel', active: true },
        fixed: { label: SYSTEM_CONSTANTS.SERVICE_TYPE_LABELS.fixed, icon: 'fa-file-contract', active: true }
      },

      pricingTypes: {
        hourly: { label: SYSTEM_CONSTANTS.PRICING_TYPE_LABELS.hourly, active: true },
        fixed: { label: SYSTEM_CONSTANTS.PRICING_TYPE_LABELS.fixed, active: true }
      },

      legalProcedureStages: {
        stage_a: { name: SYSTEM_CONSTANTS.STAGE_NAMES.stage_a, order: 1 },
        stage_b: { name: SYSTEM_CONSTANTS.STAGE_NAMES.stage_b, order: 2 },
        stage_c: { name: SYSTEM_CONSTANTS.STAGE_NAMES.stage_c, order: 3 }
      },
      stageCount: SYSTEM_CONSTANTS.STAGE_COUNT,

      roles: {
        admin: { label: SYSTEM_CONSTANTS.ROLE_LABELS.admin, active: true },
        user: { label: SYSTEM_CONSTANTS.ROLE_LABELS.user, active: true },
        lawyer: { label: SYSTEM_CONSTANTS.ROLE_LABELS.lawyer, active: true },
        employee: { label: SYSTEM_CONSTANTS.ROLE_LABELS.employee, active: true },
        intern: { label: SYSTEM_CONSTANTS.ROLE_LABELS.intern, active: true }
      },

      adminEmails: [...SYSTEM_CONSTANTS.ADMIN_EMAILS],

      businessLimits: { ...SYSTEM_CONSTANTS.BUSINESS_LIMITS },

      idleTimeout: {
        idleMs: SYSTEM_CONSTANTS.IDLE_TIMEOUT.IDLE_MS,
        warningMs: SYSTEM_CONSTANTS.IDLE_TIMEOUT.WARNING_MS
      },

      _version: 1,
      _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      _updatedBy: 'system-init'
    };

    await configRef.set(defaultConfig);

    console.log('✅ system_config initialized successfully!');
    console.log(`   Service types: ${Object.keys(defaultConfig.serviceTypes).join(', ')}`);
    console.log(`   Roles: ${Object.keys(defaultConfig.roles).join(', ')}`);
    console.log(`   Admin emails: ${defaultConfig.adminEmails.join(', ')}`);
    console.log(`   Version: 1`);

  } catch (error) {
    console.error('❌ Error initializing system_config:', error);
    process.exit(1);
  }
}

initSystemConfig().then(() => {
  console.log('\n🏁 Done.');
  process.exit(0);
});
