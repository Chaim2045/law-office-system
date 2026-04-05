/**
 * System Config Cloud Functions
 * ==============================
 * Manage system-wide configuration stored in _system/system_config.
 * History stored in _system_config_history/v{N}.
 */

'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { checkUserPermissions } = require('../shared/auth');
const { logAction } = require('../shared/audit');
const { SYSTEM_CONSTANTS } = require('../shared/constants');

const db = admin.firestore();

/**
 * Validate and sanitize config update data.
 * Returns sanitized object. Throws on invalid input.
 */
function validateConfigUpdate(data) {
  const validated = {};

  // HARD GUARD: Stage count CANNOT be changed
  if (data.stageCount !== undefined && data.stageCount !== SYSTEM_CONSTANTS.STAGE_COUNT) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'שינוי מספר שלבים אסור — דורש data migration'
    );
  }

  // HARD GUARD: Stage structure locked (only label changes allowed)
  if (data.legalProcedureStages !== undefined) {
    const stageIds = Object.keys(data.legalProcedureStages);
    if (stageIds.length !== SYSTEM_CONSTANTS.STAGE_COUNT ||
        !stageIds.every(id => SYSTEM_CONSTANTS.VALID_STAGE_IDS.includes(id))) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'שינוי מבנה שלבים אסור — רק שינוי תוויות מותר'
      );
    }
    // Only allow name changes
    validated.legalProcedureStages = {};
    for (const [id, stage] of Object.entries(data.legalProcedureStages)) {
      validated.legalProcedureStages[id] = {
        name: typeof stage.name === 'string' ? stage.name.trim() : SYSTEM_CONSTANTS.STAGE_NAMES[id],
        order: SYSTEM_CONSTANTS.LEGAL_PROCEDURE_STAGES[
          Object.keys(SYSTEM_CONSTANTS.LEGAL_PROCEDURE_STAGES).find(
            k => SYSTEM_CONSTANTS.LEGAL_PROCEDURE_STAGES[k].id === id
          )
        ]?.order || 0
      };
    }
  }

  // Validate service type labels
  if (data.serviceTypes !== undefined) {
    validated.serviceTypes = {};
    for (const [key, val] of Object.entries(data.serviceTypes)) {
      if (!SYSTEM_CONSTANTS.VALID_SERVICE_TYPES.includes(key)) {
        throw new functions.https.HttpsError('invalid-argument', `סוג שירות לא מוכר: ${key}`);
      }
      validated.serviceTypes[key] = {
        label: typeof val.label === 'string' ? val.label.trim() : key,
        icon: typeof val.icon === 'string' ? val.icon.trim() : 'fa-briefcase',
        active: val.active !== false
      };
    }
  }

  // Validate pricing type labels
  if (data.pricingTypes !== undefined) {
    validated.pricingTypes = {};
    for (const [key, val] of Object.entries(data.pricingTypes)) {
      if (!SYSTEM_CONSTANTS.VALID_PRICING_TYPES.includes(key)) {
        throw new functions.https.HttpsError('invalid-argument', `סוג תמחור לא מוכר: ${key}`);
      }
      validated.pricingTypes[key] = {
        label: typeof val.label === 'string' ? val.label.trim() : key,
        active: val.active !== false
      };
    }
  }

  // Validate role labels
  if (data.roles !== undefined) {
    validated.roles = {};
    for (const [key, val] of Object.entries(data.roles)) {
      if (!SYSTEM_CONSTANTS.VALID_ROLES.includes(key)) {
        throw new functions.https.HttpsError('invalid-argument', `תפקיד לא מוכר: ${key}`);
      }
      validated.roles[key] = {
        label: typeof val.label === 'string' ? val.label.trim() : key,
        active: val.active !== false
      };
    }
  }

  // Validate business limits
  if (data.businessLimits !== undefined) {
    validated.businessLimits = {};
    for (const [key, val] of Object.entries(data.businessLimits)) {
      if (typeof val !== 'number' || val <= 0) {
        throw new functions.https.HttpsError('invalid-argument', `${key} חייב להיות מספר חיובי`);
      }
      validated.businessLimits[key] = val;
    }
  }

  // Validate admin emails
  if (data.adminEmails !== undefined) {
    if (!Array.isArray(data.adminEmails) || data.adminEmails.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'חייב להיות לפחות אדמין אחד');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of data.adminEmails) {
      if (typeof email !== 'string' || !emailRegex.test(email)) {
        throw new functions.https.HttpsError('invalid-argument', `מייל לא תקין: ${email}`);
      }
    }
    validated.adminEmails = data.adminEmails.map(e => e.trim().toLowerCase());
  }

  // Validate idle timeout
  if (data.idleTimeout !== undefined) {
    const { idleMs, warningMs } = data.idleTimeout;
    if (idleMs !== undefined) {
      if (typeof idleMs !== 'number' || idleMs < 60000 || idleMs > 3600000) {
        throw new functions.https.HttpsError('invalid-argument', 'Idle timeout חייב להיות בין דקה לשעה');
      }
      validated.idleTimeout = validated.idleTimeout || {};
      validated.idleTimeout.idleMs = idleMs;
    }
    if (warningMs !== undefined) {
      if (typeof warningMs !== 'number' || warningMs < 30000 || warningMs > 1800000) {
        throw new functions.https.HttpsError('invalid-argument', 'Warning timeout חייב להיות בין 30 שניות ל-30 דקות');
      }
      validated.idleTimeout = validated.idleTimeout || {};
      validated.idleTimeout.warningMs = warningMs;
    }
  }

  return validated;
}


/**
 * updateSystemConfig — Admin only
 * Updates system configuration with validation, optimistic locking, and history backup.
 */
exports.updateSystemConfig = functions.https.onCall(async (data, context) => {
  // 1. Auth — admin only
  const user = await checkUserPermissions(context);
  if (user.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'רק מנהלים יכולים לעדכן הגדרות מערכת');
  }

  // 2. Validate and sanitize
  const validated = validateConfigUpdate(data);

  if (Object.keys(validated).length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'אין שדות תקינים לעדכון');
  }

  // 3. Transaction: backup + optimistic locking + write
  const configRef = db.collection('_system').doc('system_config');

  await db.runTransaction(async (tx) => {
    const current = await tx.get(configRef);
    const currentData = current.exists ? current.data() : null;
    const currentVersion = currentData?._version || 0;

    // Optimistic locking
    if (data._expectedVersion !== undefined && data._expectedVersion !== currentVersion) {
      throw new functions.https.HttpsError(
        'aborted',
        'ההגדרות עודכנו על ידי מנהל אחר. רענן ונסה שוב.'
      );
    }

    // Backup inside transaction — atomic
    if (currentData) {
      const historyRef = db.collection('_system_config_history').doc(`v${currentVersion}`);
      tx.set(historyRef, {
        ...currentData,
        _archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        _archivedBy: user.email
      });
    }

    // Write new version
    tx.set(configRef, {
      ...validated,
      _version: currentVersion + 1,
      _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      _updatedBy: user.email
    }, { merge: true });
  });

  // 4. Audit log
  await logAction('system_config_updated', user.uid, user.username, {
    changes: Object.keys(validated)
  });

  return { success: true };
});


/**
 * getSystemConfig — Any authenticated user
 * Returns the current system configuration.
 */
exports.getSystemConfig = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'נדרשת התחברות');
  }

  const configDoc = await db.collection('_system').doc('system_config').get();

  if (!configDoc.exists) {
    return { config: null, source: 'defaults' };
  }

  return { config: configDoc.data(), source: 'firestore' };
});


/**
 * rollbackSystemConfig — Admin only
 * Restores a previous config version from history.
 */
exports.rollbackSystemConfig = functions.https.onCall(async (data, context) => {
  // 1. Auth — admin only
  const user = await checkUserPermissions(context);
  if (user.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'רק מנהלים יכולים לבצע שחזור');
  }

  const targetVersion = data.targetVersion;
  if (typeof targetVersion !== 'number' || targetVersion < 1) {
    throw new functions.https.HttpsError('invalid-argument', 'מספר גרסה לא תקין');
  }

  const configRef = db.collection('_system').doc('system_config');
  const historyRef = db.collection('_system_config_history').doc(`v${targetVersion}`);

  await db.runTransaction(async (tx) => {
    const [currentDoc, historyDoc] = await Promise.all([
      tx.get(configRef),
      tx.get(historyRef)
    ]);

    if (!historyDoc.exists) {
      throw new functions.https.HttpsError('not-found', `גרסה ${targetVersion} לא נמצאה`);
    }

    const currentVersion = currentDoc.exists ? currentDoc.data()?._version || 0 : 0;

    // Archive current before rollback
    if (currentDoc.exists) {
      tx.set(db.collection('_system_config_history').doc(`v${currentVersion}`), {
        ...currentDoc.data(),
        _archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        _archivedBy: user.email,
        _archivedReason: 'pre-rollback'
      });
    }

    // Restore from history
    const historyData = { ...historyDoc.data() };
    delete historyData._archivedAt;
    delete historyData._archivedBy;
    delete historyData._archivedReason;

    tx.set(configRef, {
      ...historyData,
      _version: currentVersion + 1,
      _updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      _updatedBy: user.email,
      _restoredFromVersion: targetVersion
    });
  });

  // Audit log
  await logAction('system_config_rollback', user.uid, user.username, { targetVersion });

  return { success: true };
});
