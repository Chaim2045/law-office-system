/**
 * Deduction System - Validators Module
 * Input validation functions for deduction operations
 *
 * @module deduction/validators
 * @description Validates all inputs before deduction operations
 * @created 2025-11-11
 * @version 1.0.0
 */

/**
 * Validate time entry before deduction
 *
 * @param {Object} taskData - Task data
 * @param {Object} clientData - Client data
 * @returns {Object} Validation result
 */
function validateTimeEntry(taskData, clientData) {
  if (!taskData) {
    return { valid: false, error: 'משימה לא נמצאה' };
  }

  if (!clientData) {
    return { valid: false, error: 'לקוח לא נמצא' };
  }

  if (!taskData.serviceType || !taskData.parentServiceId) {
    return { valid: false, error: 'המשימה חסרה מידע על שירות' };
  }

  if (taskData.serviceType === 'legal_procedure' && !taskData.serviceId) {
    return { valid: false, error: 'המשימה חסרה מידע על שלב' };
  }

  if (!clientData.services || clientData.services.length === 0) {
    return { valid: false, error: 'ללקוח אין שירותים פעילים' };
  }

  return { valid: true };
}

/**
 * Validate package data
 *
 * @param {Object} packageData - Package data to validate
 * @returns {Object} Validation result
 */
function validatePackage(packageData) {
  const errors = [];

  if (!packageData.hours || packageData.hours <= 0) {
    errors.push('חובה להזין כמות שעות תקינה');
  }

  if (packageData.hours > 500) {
    errors.push('כמות שעות גבוהה מדי (מקסימום 500)');
  }

  if (!packageData.type || !['initial', 'additional', 'renewal'].includes(packageData.type)) {
    errors.push('סוג חבילה לא תקין');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate hours package for stage
 *
 * @param {number} hours - Hours to add
 * @param {string} reason - Reason for adding
 * @returns {Object} Validation result
 */
function validateHoursPackage(hours, reason) {
  const errors = [];

  if (!hours || hours <= 0) {
    errors.push('חובה להזין כמות שעות תקינה');
  }

  if (hours > 500) {
    errors.push('כמות שעות גבוהה מדי (מקסימום 500 שעות בחבילה)');
  }

  if (!reason || reason.trim().length < 3) {
    errors.push('חובה להזין סיבה/הערה (לפחות 3 תווים)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate stages for legal procedure
 *
 * @param {Array} stages - Stages array
 * @param {string} pricingType - Pricing type (hourly/fixed)
 * @returns {Object} Validation result
 */
function validateStages(stages, pricingType = 'hourly') {
  const errors = [];

  if (!Array.isArray(stages) || stages.length !== 3) {
    errors.push('חובה למלא בדיוק 3 שלבים');
    return { valid: false, errors };
  }

  stages.forEach((stage, index) => {
    const stageNum = index + 1;

    if (!stage.description || !stage.description.trim()) {
      errors.push(`שלב ${stageNum}: חובה למלא תיאור השלב`);
    }

    if (pricingType === 'hourly') {
      if (!stage.hours || stage.hours <= 0) {
        errors.push(`שלב ${stageNum}: חובה למלא תקרת שעות תקינה`);
      }

      if (stage.hours && stage.hours > 1000) {
        errors.push(`שלב ${stageNum}: תקרת שעות גבוהה מדי (מקסימום 1000)`);
      }
    } else {
      if (!stage.fixedPrice || stage.fixedPrice <= 0) {
        errors.push(`שלב ${stageNum}: חובה למלא מחיר פיקס תקין`);
      }

      if (stage.fixedPrice && stage.fixedPrice > 1000000) {
        errors.push(`שלב ${stageNum}: מחיר גבוה מדי (מקסימום 1,000,000 ₪)`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate deduction amount
 *
 * @param {number} hours - Hours to deduct
 * @param {Object} entity - Entity (service/stage) to deduct from
 * @returns {Object} Validation result
 */
function validateDeduction(hours, entity) {
  if (!hours || hours <= 0) {
    return { valid: false, error: 'כמות שעות לקיזוז חייבת להיות חיובית' };
  }

  if (hours > 24) {
    return { valid: false, error: 'לא ניתן לקזז יותר מ-24 שעות בפעולה אחת' };
  }

  if (!entity) {
    return { valid: false, error: 'לא נמצא שירות או שלב לקיזוז' };
  }

  return { valid: true };
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateTimeEntry,
    validatePackage,
    validateHoursPackage,
    validateStages,
    validateDeduction
  };
}

export {
  validateTimeEntry,
  validatePackage,
  validateHoursPackage,
  validateStages,
  validateDeduction
};
