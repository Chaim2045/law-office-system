/**
 * Feature Flags Configuration
 * מערכת דגלי תכונות - הפעלה/כיבוי של פיצ'רים במערכת
 *
 * @module feature-flags
 * @version 1.0.0
 * @created 2025-01-26
 *
 * ════════════════════════════════════════════════════════════════════
 * 🎯 PURPOSE: Safe Feature Rollout & Instant Rollback
 * ════════════════════════════════════════════════════════════════════
 *
 * מאפשר:
 * 1. הפעלה/כיבוי של פיצ'רים ללא deploy
 * 2. חזרה מהירה למצב קודם במקרה של בעיה
 * 3. בדיקה בסביבת ייצור לפני rollout מלא
 * 4. A/B testing (עתיד)
 */

const admin = require('firebase-admin');

/**
 * Feature Flags Registry
 * רשימת כל הפיצ'רים במערכת
 */
const FEATURE_FLAGS = {
  /**
   * Frozen Tasks on Stage Change
   * ════════════════════════════════════════════════════════════════
   * כשמופעל: משימות נשארות פתוחות אבל מסומנות כ"קפואות"
   * כשכבוי: התנהגות ישנה - אין סימון, הכל ממשיך כרגיל
   */
  FROZEN_TASKS_ON_STAGE_CHANGE: {
    name: 'Frozen Tasks on Stage Change',
    description: 'סימון משימות כקפואות כאשר התיק עובר לשלב הבא',
    defaultValue: false,  // 🔴 כבוי כברירת מחדל - בטוח!
    version: '1.0.0',
    createdAt: '2025-01-26',
    owner: 'system'
  }
};

/**
 * Cache for feature flags (in-memory)
 * מונע קריאות מיותרות ל-Firestore
 */
let flagsCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 60000; // 1 minute

/**
 * Get feature flag value from Firestore
 * @param {string} flagName - Feature flag name
 * @returns {Promise<boolean>} Flag value
 */
async function getFeatureFlag(flagName) {
  try {
    // Check if flag exists in registry
    if (!FEATURE_FLAGS[flagName]) {
      console.warn(`⚠️ Unknown feature flag: ${flagName}`);
      return false;
    }

    // Check cache
    const now = Date.now();
    if (flagsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
      return flagsCache[flagName] ?? FEATURE_FLAGS[flagName].defaultValue;
    }

    // Load from Firestore
    const db = admin.firestore();
    const doc = await db.collection('system_settings').doc('feature_flags').get();

    if (!doc.exists) {
      // Create default settings if not exist
      await initializeFeatureFlags();
      return FEATURE_FLAGS[flagName].defaultValue;
    }

    const data = doc.data();

    // Update cache
    flagsCache = data.flags || {};
    cacheTimestamp = now;

    // Return flag value or default
    return flagsCache[flagName] ?? FEATURE_FLAGS[flagName].defaultValue;

  } catch (error) {
    console.error(`❌ Error reading feature flag ${flagName}:`, error);
    // Fail-safe: return default value
    return FEATURE_FLAGS[flagName].defaultValue;
  }
}

/**
 * Initialize feature flags in Firestore
 * יוצר את המסמך הראשוני עם כל הדגלים
 */
async function initializeFeatureFlags() {
  try {
    const db = admin.firestore();

    // Build initial flags object
    const initialFlags = {};
    Object.keys(FEATURE_FLAGS).forEach(flagName => {
      initialFlags[flagName] = FEATURE_FLAGS[flagName].defaultValue;
    });

    // Create document
    await db.collection('system_settings').doc('feature_flags').set({
      flags: initialFlags,
      metadata: FEATURE_FLAGS,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      version: '1.0.0'
    });

    console.log('✅ Feature flags initialized');
    return true;

  } catch (error) {
    console.error('❌ Error initializing feature flags:', error);
    return false;
  }
}

/**
 * Set feature flag value
 * @param {string} flagName - Feature flag name
 * @param {boolean} value - New value
 * @param {string} changedBy - User who changed the flag
 * @returns {Promise<boolean>} Success
 */
async function setFeatureFlag(flagName, value, changedBy = 'system') {
  try {
    if (!FEATURE_FLAGS[flagName]) {
      throw new Error(`Unknown feature flag: ${flagName}`);
    }

    if (typeof value !== 'boolean') {
      throw new Error('Feature flag value must be boolean');
    }

    const db = admin.firestore();
    const docRef = db.collection('system_settings').doc('feature_flags');

    // Update flag
    await docRef.update({
      [`flags.${flagName}`]: value,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastChangedBy: changedBy,
      [`history.${flagName}`]: admin.firestore.FieldValue.arrayUnion({
        value,
        changedBy,
        changedAt: new Date().toISOString()
      })
    });

    // Clear cache
    flagsCache = null;
    cacheTimestamp = null;

    console.log(`✅ Feature flag ${flagName} set to ${value} by ${changedBy}`);

    return true;

  } catch (error) {
    console.error(`❌ Error setting feature flag ${flagName}:`, error);
    throw error;
  }
}

/**
 * Get all feature flags
 * @returns {Promise<Object>} All flags with metadata
 */
async function getAllFeatureFlags() {
  try {
    const db = admin.firestore();
    const doc = await db.collection('system_settings').doc('feature_flags').get();

    if (!doc.exists) {
      await initializeFeatureFlags();
      return {
        flags: Object.keys(FEATURE_FLAGS).reduce((acc, key) => {
          acc[key] = FEATURE_FLAGS[key].defaultValue;
          return acc;
        }, {}),
        metadata: FEATURE_FLAGS
      };
    }

    return doc.data();

  } catch (error) {
    console.error('❌ Error getting all feature flags:', error);
    throw error;
  }
}

/**
 * Clear cache (useful for testing)
 */
function clearCache() {
  flagsCache = null;
  cacheTimestamp = null;
}

// Export
module.exports = {
  FEATURE_FLAGS,
  getFeatureFlag,
  setFeatureFlag,
  getAllFeatureFlags,
  initializeFeatureFlags,
  clearCache
};