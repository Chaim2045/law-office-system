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
 * Finds the active package in a stage/service for deduction.
 *
 * @param {Object} stage - Stage or service object with packages array
 * @param {boolean} allowOverdraft - Allow falling back to packages with negative hours (up to -10)
 * @param {boolean} overrideActive - When true, the -10h floor is bypassed in the fallback pass
 * @returns {Object|null} Selected package or null if none eligible
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 📝 SELECTION PRIORITY (PR-DED-1, 2026-05-25)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Two-pass selection:
 *   1. **Fresh pass:** prefer the OLDEST package (by purchaseDate / createdAt
 *      ascending) with `hoursRemaining > 0` AND status in
 *      ['active', 'pending', no-status]. This drains old "additional"
 *      packages FIFO before newer ones — matches per-package billing model
 *      surfaced by `ReportGenerator.renderPackagesBreakdown`.
 *
 *   2. **Fallback pass (only if allowOverdraft):** if no fresh package
 *      exists, return the first eligible package within the -10h floor
 *      (or any package if overrideActive=true). Status set includes
 *      'overdraft' and 'depleted' to keep BC for legacy single-package
 *      overdraft flows.
 *
 * Why this exists:
 *   Before this fix, `.find()` returned the FIRST eligible package, which
 *   meant a depleted initial package (hoursRemaining=-7.6, status=depleted)
 *   was selected even when a fresh additional package (hoursRemaining=35.5,
 *   status=active) existed alongside it. Result: customer-blocking
 *   CLIENT_OVERDRAFT_SOFT errors despite having paid for fresh hours.
 *
 * Historical context (preserved):
 *   - 2025-12-01: pending packages eligible when stage.status === 'active'
 *   - 2025-12-21: overdraft window (-10h) for uninterrupted workflow
 *   - 2026-05-25 (this fix): fresh-first priority over depleted
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { SYSTEM_CONSTANTS } = require('../../../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// Helper: ascending sort key for FIFO tie-break of fresh packages
function _packageOrderKey(pkg) {
  const raw = pkg.purchaseDate || pkg.createdAt;
  if (!raw) return Number.POSITIVE_INFINITY; // no timestamp → sort to end
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function getActivePackage(stage, allowOverdraft = true, overrideActive = false) {
  if (!stage || !stage.packages || stage.packages.length === 0) {
    return null;
  }

  // Branch A: modern data — packages live under an active/completed stage.
  // Eligible statuses include 'pending' (legal_procedure v2.0 — stage active,
  // first package may carry status='pending' initially).
  if (stage.status === 'active' || stage.status === 'completed') {
    const eligibleStatus = (s) =>
      !s || s === 'active' || s === 'pending' || s === 'overdraft' || s === 'depleted';

    // Pass 1 (fresh): hoursRemaining > 0 AND status fresh-or-pending.
    // FIFO tie-break by purchaseDate/createdAt ascending — old "additional"
    // packages drain before newly purchased ones.
    const freshCandidates = stage.packages.filter(pkg => {
      const status = pkg.status;
      const isFresh = !status || status === 'active' || status === 'pending';
      return isFresh && (pkg.hoursRemaining || 0) > 0;
    });
    if (freshCandidates.length > 0) {
      freshCandidates.sort((a, b) => _packageOrderKey(a) - _packageOrderKey(b));
      return freshCandidates[0];
    }

    // No allowOverdraft → strict mode, no depleted fallback.
    if (!allowOverdraft) {
      return null;
    }

    // Pass 2 (fallback): depleted/overdraft within -10h floor (or any if override).
    const fallbackA = stage.packages.find(pkg => {
      if (!eligibleStatus(pkg.status)) return false;
      const hoursRemaining = pkg.hoursRemaining || 0;
      return overrideActive || hoursRemaining > -10;
    }) || null;
    if (fallbackA) {
      try {
        console.warn(
          `[deduction] getActivePackage fallback to non-fresh package id=${fallbackA.id} ` +
          `status=${fallbackA.status || 'none'} hoursRemaining=${fallbackA.hoursRemaining || 0} ` +
          `overrideActive=${overrideActive}`
        );
      } catch (_) { /* logging is best-effort */ }
    }
    return fallbackA;
  }

  // Branch B: BC — legacy packages without an explicit stage.status.
  // Eligible statuses tighter ('pending' NOT included here, matching legacy).
  const eligibleStatusBC = (s) =>
    !s || s === 'active' || s === 'overdraft' || s === 'depleted';

  // Pass 1 (fresh): hoursRemaining > 0 AND status active-or-none.
  const freshCandidatesBC = stage.packages.filter(pkg => {
    const status = pkg.status;
    const isFresh = !status || status === 'active';
    return isFresh && (pkg.hoursRemaining || 0) > 0;
  });
  if (freshCandidatesBC.length > 0) {
    freshCandidatesBC.sort((a, b) => _packageOrderKey(a) - _packageOrderKey(b));
    return freshCandidatesBC[0];
  }

  if (!allowOverdraft) {
    return null;
  }

  // Pass 2 (fallback): same -10h floor + override semantics as Branch A.
  const fallback = stage.packages.find(pkg => {
    if (!eligibleStatusBC(pkg.status)) return false;
    const hoursRemaining = pkg.hoursRemaining || 0;
    return overrideActive || hoursRemaining > -10;
  }) || null;

  // PR-DED-1 G3 monitoring: log when fallback path is taken (depleted/overdraft
  // selected because no fresh package exists). Helps spot misconfigured stages
  // post-deploy.
  if (fallback) {
    try {
      console.warn(
        `[deduction] getActivePackage fallback to non-fresh package id=${fallback.id} ` +
        `status=${fallback.status || 'none'} hoursRemaining=${fallback.hoursRemaining || 0} ` +
        `overrideActive=${overrideActive}`
      );
    } catch (_) { /* logging is best-effort */ }
  }
  return fallback;
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
  const newHoursRemaining = (pkg.hoursRemaining || 0) - hours;  // ✅ Allow negative values for overdraft

  // Determine new status
  let newStatus = pkg.status || 'active';

  // ✅ Build updated package object
  const updatedPackage = {
    ...pkg,  // Copy all existing fields
    hoursUsed: newHoursUsed,
    hoursRemaining: newHoursRemaining,
    status: newStatus
  };

  // ✅ Update status based on remaining hours
  if (newHoursRemaining < 0 && newHoursRemaining >= -10) {
    updatedPackage.status = 'overdraft';  // In overdraft range
  } else if (newHoursRemaining <= 0) {
    updatedPackage.status = 'depleted';  // Depleted or beyond overdraft
    updatedPackage.closedDate = new Date().toISOString();
  }

  return updatedPackage;
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
  if (taskData.serviceType === ST.LEGAL_PROCEDURE && taskData.parentServiceId) {
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
  } else if (taskData.serviceType === ST.HOURS && taskData.parentServiceId) {
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
  if (taskData.serviceType === ST.LEGAL_PROCEDURE && !taskData.serviceId) {
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
