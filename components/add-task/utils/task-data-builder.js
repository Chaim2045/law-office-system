/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TASK DATA BUILDER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description Utility for building task data objects from form input
 * @version 2.0.0
 * @created 2025-01-20
 *
 * @features
 * - בניית אובייקט taskData מנתוני טופס
 * - ולידציה בסיסית של נתונים
 * - תמיכה בכל השדות הנדרשים
 */

/**
 * Build task data object from form data
 * בניית אובייקט משימה מנתוני הטופס
 *
 * @param {Object} formData - Form data from TaskFormManager
 * @param {string} currentUser - Current logged-in user email
 * @returns {Object} Task data object ready for Firebase
 *
 * @example
 * ```javascript
 * const taskData = buildTaskData(formData, 'user@example.com');
 * await FirebaseService.call('createBudgetTask', taskData);
 * ```
 */
export function buildTaskData(formData, currentUser) {
  if (!formData) {
    throw new Error('Form data is required');
  }

  if (!currentUser) {
    throw new Error('Current user is required');
  }

  return {
    // Description & Category
    description: formData.description || '',
    categoryId: formData.categoryId || null,
    categoryName: formData.categoryName || null,

    // Client & Case Information
    clientName: formData.clientName || '',
    clientId: formData.clientId || '',
    caseId: formData.caseId || '',
    caseNumber: formData.caseNumber || '',
    caseTitle: formData.caseTitle || '',

    // Service Information
    serviceId: formData.serviceId || '',
    serviceName: formData.serviceName || '',
    serviceType: formData.serviceType || '',
    parentServiceId: formData.parentServiceId || null,

    // Task Details
    branch: formData.branch || '',
    estimatedMinutes: parseInt(formData.estimatedMinutes) || 0,
    originalEstimate: parseInt(formData.estimatedMinutes) || 0, // ✅ v2.0 feature
    deadline: formData.deadline || '',

    // Employee & Status
    employee: currentUser,
    status: 'active',

    // Time Tracking
    timeSpent: 0,
    actualMinutes: 0,
    timeEntries: [],

    // Metadata
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Validate task data before sending to Firebase
 * ולידציה של נתוני משימה לפני שליחה
 *
 * @param {Object} taskData - Task data object
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateTaskData(taskData) {
  const errors = [];

  // Required fields validation
  if (!taskData.description || taskData.description.trim().length < 3) {
    errors.push('תיאור המשימה חייב להכיל לפחות 3 תווים');
  }

  if (!taskData.clientId) {
    errors.push('חובה לבחור לקוח');
  }

  if (!taskData.caseId) {
    errors.push('חובה לבחור תיק');
  }

  if (!taskData.branch) {
    errors.push('חובה לבחור סניף מטפל');
  }

  if (!taskData.estimatedMinutes || taskData.estimatedMinutes < 1) {
    errors.push('זמן משוער חייב להיות לפחות 1 דקה');
  }

  if (!taskData.deadline) {
    errors.push('חובה לבחור תאריך יעד');
  }

  if (!taskData.employee) {
    errors.push('חסר מידע על העובד המבצע');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize task data - remove undefined/null values
 * ניקוי נתוני משימה - הסרת ערכים ריקים
 *
 * @param {Object} taskData - Task data object
 * @returns {Object} Sanitized task data
 */
export function sanitizeTaskData(taskData) {
  const sanitized = {};

  for (const [key, value] of Object.entries(taskData)) {
    // Keep falsy values like 0, false, empty string
    // Only remove null and undefined
    if (value !== null && value !== undefined) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Convert form values to proper types
 * המרת ערכי טופס לטיפוסים נכונים
 *
 * @param {Object} rawFormData - Raw form data (all strings)
 * @returns {Object} Converted form data with proper types
 */
export function convertFormTypes(rawFormData) {
  return {
    ...rawFormData,
    estimatedMinutes: parseInt(rawFormData.estimatedMinutes) || 0,
    deadline: rawFormData.deadline ? new Date(rawFormData.deadline) : null,
    // Add more conversions as needed
  };
}

// Export all functions
export default {
  buildTaskData,
  validateTaskData,
  sanitizeTaskData,
  convertFormTypes
};
