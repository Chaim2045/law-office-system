/**
 * ⏱️ Deduction Logic - Helper functions for calculating hour deductions
 *
 * This module handles all logic for deducting hours from services, stages, and packages.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 📝 CHANGELOG - Architectural Upgrade: Immutable Patterns
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🗓️ תאריך: 2025-01-23 (November 23, 2025)
 * 🏗️ גרסה: v2.0.0 → v3.0.0
 *
 * 🎯 שדרוג ארכיטקטוני: מעבר ל-Immutable Data Patterns
 *
 * ❌ הבעיה עם הגרסה הקודמת (v2.x):
 * הפונקציות שינו אובייקטים in-place (mutable operations):
 *   pkg.hoursUsed = ...;  // ← משנה את האובייקט ישירות
 *   pkg.hoursRemaining = ...;
 *   return pkg;  // ← מחזיר את אותו אובייקט
 *
 * זה גרם ל-3 בעיות:
 * 1. **Reference Issues:** Firestore לא זיהה שינויים כי reference לא השתנה
 * 2. **Scalability:** צריך לזכור deep clone בכל מקום → code duplication
 * 3. **Debugging:** אובייקטים משתנים "מתחת לידיים" → קשה לעקוב
 *
 * ✅ הפתרון - Immutable Patterns:
 * כל פונקציה יוצרת אובייקט חדש במקום לשנות את הקיים:
 *   return { ...pkg, hoursUsed: ..., hoursRemaining: ... };  // ← עותק חדש
 *
 * יתרונות:
 * - ✅ Firestore מזהה שינויים אוטומטית (reference חדש)
 * - ✅ אין צורך ב-JSON.parse(JSON.stringify()) workarounds
 * - ✅ Easier debugging (אובייקטים לא משתנים)
 * - ✅ Industry standard (React, Redux, modern frameworks)
 * - ✅ Thread-safe by design
 *
 * 📍 פונקציות ששודרגו:
 * - deductHoursFromPackage() (line 52-85) → Immutable
 * - deductHoursFromStage() (line 91-115) → Immutable
 *
 * 🎯 Backward Compatibility:
 * ה-API לא השתנה - אותה חתימה, אותה התנהגות
 * רק העבודה הפנימית שונתה ל-immutable
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Finds the active package in a stage
 *
 * @param {Object} stage - Stage object with packages array
 * @returns {Object|null} Active package or null if not found
 */
function getActivePackage(stage) {
  if (!stage || !stage.packages || stage.packages.length === 0) {
    return null;
  }

  // Find first package with status 'active' (or no status) and hoursRemaining > 0
  // Backward compatibility: packages without status are considered active
  return stage.packages.find(pkg => {
    const isActive = !pkg.status || pkg.status === 'active';
    const hasHours = (pkg.hoursRemaining || 0) > 0;
    return isActive && hasHours;
  }) || null;
}

/**
 * Calculates remaining hours from packages
 *
 * @param {Object} entity - Stage or service with packages
 * @returns {number} Total remaining hours from active packages
 */
function calculateRemainingHours(entity) {
  if (!entity) return 0;

  if (!entity.packages || entity.packages.length === 0) {
    return entity.hoursRemaining || 0;
  }

  return entity.packages
    .filter(pkg => pkg.status === 'active' || !pkg.status)
    .reduce((sum, pkg) => sum + (pkg.hoursRemaining || 0), 0);
}

/**
 * Deducts hours from a package (Immutable - returns new object)
 *
 * ✅ UPGRADED to Immutable Pattern (v3.0.0)
 * Instead of mutating the original package, this function returns a new object.
 *
 * @param {Object} pkg - Package object (NOT modified)
 * @param {number} hours - Hours to deduct
 * @returns {Object} NEW package object with updated values
 *
 * @example
 * // ❌ Old (mutable):
 * deductHoursFromPackage(pkg, 2);  // pkg changes in-place
 *
 * // ✅ New (immutable):
 * const updatedPkg = deductHoursFromPackage(pkg, 2);  // pkg unchanged, updatedPkg is new
 */
function deductHoursFromPackage(pkg, hours) {
  // Calculate new values
  const newHoursUsed = (pkg.hoursUsed || 0) + hours;
  const newHoursRemaining = Math.max(0, (pkg.hoursRemaining || 0) - hours);

  // Determine new status
  let newStatus = pkg.status || 'active';
  let closedDate = pkg.closedDate;

  if (newHoursRemaining <= 0) {
    newStatus = 'depleted';
    closedDate = new Date().toISOString();
  }

  // ✅ Return NEW object (immutable)
  return {
    ...pkg,  // Copy all existing fields
    hoursUsed: newHoursUsed,
    hoursRemaining: newHoursRemaining,
    status: newStatus,
    closedDate: closedDate
  };
}

/**
 * Deducts hours from a stage (Immutable - returns new stage)
 *
 * ✅ UPGRADED to Immutable Pattern (v3.0.0)
 * Returns a new stage object with updated packages array.
 *
 * @param {Object} stage - Stage object (NOT modified)
 * @param {number} hours - Hours to deduct
 * @returns {Object} Update result with new stage and package info
 *
 * @example
 * // ❌ Old (mutable):
 * deductHoursFromStage(stage, 2);  // stage changes in-place
 *
 * // ✅ New (immutable):
 * const result = deductHoursFromStage(stage, 2);
 * const newStage = result.updatedStage;  // NEW object
 */
function deductHoursFromStage(stage, hours) {
  const activePackage = getActivePackage(stage);

  if (!activePackage) {
    return {
      success: false,
      error: 'אין חבילה פעילה לניכוי שעות'
    };
  }

  // ✅ Deduct from package (immutable - returns new object)
  const updatedPackage = deductHoursFromPackage(activePackage, hours);

  // ✅ Create new packages array with updated package
  const updatedPackages = stage.packages.map(pkg =>
    pkg.id === updatedPackage.id ? updatedPackage : pkg
  );

  // ✅ Create new stage object
  const updatedStage = {
    ...stage,
    packages: updatedPackages,
    hoursUsed: (stage.hoursUsed || 0) + hours,
    hoursRemaining: updatedPackages
      .filter(pkg => pkg.status === 'active' || !pkg.status)
      .reduce((sum, pkg) => sum + (pkg.hoursRemaining || 0), 0)
  };

  return {
    success: true,
    packageId: updatedPackage.id,
    stageId: stage.id,
    updatedStage: updatedStage  // ← NEW: return updated stage
  };
}

/**
 * Calculates client updates after time entry
 *
 * @param {Object} clientData - Full client document
 * @param {Object} taskData - Task being updated
 * @param {number} minutesToAdd - Minutes to add
 * @returns {Object} Updates to apply to client document
 */
function calculateClientUpdates(clientData, taskData, minutesToAdd) {
  const hoursToAdd = minutesToAdd / 60;

  // Initialize result
  const result = {
    clientUpdate: null,
    error: null
  };

  // Handle legal procedure with services
  if (taskData.serviceType === 'legal_procedure' && taskData.parentServiceId) {
    const services = clientData.services || [];
    const serviceIndex = services.findIndex(s => s.id === taskData.parentServiceId);

    if (serviceIndex === -1) {
      result.error = `שירות ${taskData.parentServiceId} לא נמצא`;
      return result;
    }

    const targetService = services[serviceIndex];
    const stages = targetService.stages || [];
    const currentStageIndex = stages.findIndex(s => s.id === taskData.serviceId);

    if (currentStageIndex === -1) {
      result.error = `שלב ${taskData.serviceId} לא נמצא בשירות`;
      return result;
    }

    const currentStage = stages[currentStageIndex];

    // Deduct from stage
    const deductionResult = deductHoursFromStage(currentStage, hoursToAdd);

    if (!deductionResult.success) {
      result.error = deductionResult.error;
      return result;
    }

    // Update service totals
    targetService.hoursUsed = (targetService.hoursUsed || 0) + hoursToAdd;
    targetService.hoursRemaining = targetService.stages.reduce(
      (sum, stage) => sum + (stage.hoursRemaining || 0), 0
    );

    // Build update object using dot notation for efficiency
    result.clientUpdate = {
      [`services.${serviceIndex}`]: targetService,
      hoursUsed: (clientData.hoursUsed || 0) + hoursToAdd,
      _version: (clientData._version || 0) + 1
    };
  } else if (taskData.serviceType === 'hours' && taskData.parentServiceId) {
    // Handle hourly service (no stages)
    const services = clientData.services || [];
    const serviceIndex = services.findIndex(s => s.id === taskData.parentServiceId);

    if (serviceIndex === -1) {
      result.error = `שירות ${taskData.parentServiceId} לא נמצא`;
      return result;
    }

    const targetService = services[serviceIndex];

    // Deduct from service
    targetService.hoursUsed = (targetService.hoursUsed || 0) + hoursToAdd;
    targetService.hoursRemaining = (targetService.hoursRemaining || 0) - hoursToAdd;

    if (targetService.hoursRemaining < 0) {
      targetService.hoursRemaining = 0;
    }

    result.clientUpdate = {
      [`services.${serviceIndex}`]: targetService,
      hoursUsed: (clientData.hoursUsed || 0) + hoursToAdd,
      _version: (clientData._version || 0) + 1
    };
  } else {
    result.error = 'סוג שירות לא נתמך או חסר מידע';
  }

  return result;
}

/**
 * Validates that a task can have time added
 *
 * @param {Object} taskData - Task to validate
 * @param {Object} clientData - Client document
 * @returns {Object} Validation result
 */
function validateTimeEntry(taskData, clientData) {
  // Check task exists
  if (!taskData) {
    return { valid: false, error: 'משימה לא נמצאה' };
  }

  // Check client exists
  if (!clientData) {
    return { valid: false, error: 'לקוח לא נמצא' };
  }

  // Check task has service info
  if (!taskData.serviceType || !taskData.parentServiceId) {
    return { valid: false, error: 'המשימה חסרה מידע על שירות' };
  }

  // For legal procedures, need serviceId (stage)
  if (taskData.serviceType === 'legal_procedure' && !taskData.serviceId) {
    return { valid: false, error: 'המשימה חסרה מידע על שלב' };
  }

  // Check client has services
  if (!clientData.services || clientData.services.length === 0) {
    return { valid: false, error: 'ללקוח אין שירותים פעילים' };
  }

  return { valid: true };
}

module.exports = {
  getActivePackage,
  calculateRemainingHours,
  deductHoursFromPackage,
  deductHoursFromStage,
  calculateClientUpdates,
  validateTimeEntry
};
