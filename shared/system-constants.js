/**
 * SYSTEM CONSTANTS — Canonical Definition
 * ========================================
 *
 * This file is the SINGLE SOURCE OF TRUTH for all system-wide constants.
 *
 * Three adapter files mirror these values for each codebase:
 *   1. functions/shared/constants.js              (CommonJS — require)
 *   2. apps/admin-panel/js/core/system-constants.js  (IIFE — window.SYSTEM_CONSTANTS)
 *   3. apps/user-app/js/core/system-constants.js     (IIFE — window.SYSTEM_CONSTANTS)
 *
 * When changing a value here:
 *   1. Update ALL three adapters
 *   2. Run: node tests/sync-constants.test.js  (verifies sync)
 *   3. The pre-commit hook also runs this test automatically
 *
 * @version 1.0.0
 */

'use strict';

const SYSTEM_CONSTANTS = {

  // ═══════════════════════════════════════════
  // Service Types (סוגי שירות)
  // ══════════════════════════════════════════���
  SERVICE_TYPES: {
    HOURS: 'hours',
    LEGAL_PROCEDURE: 'legal_procedure',
    FIXED: 'fixed'
  },

  VALID_SERVICE_TYPES: ['hours', 'legal_procedure', 'fixed'],

  SERVICE_TYPE_LABELS: {
    'hours': 'שעות',
    'legal_procedure': 'הליך משפטי',
    'fixed': 'קבוע'
  },

  // ═══════════════════════════════════════════
  // Pricing Types (סוגי תמחור)
  // ═══════════════════════════════════════════
  PRICING_TYPES: {
    HOURLY: 'hourly',
    FIXED: 'fixed'
  },

  VALID_PRICING_TYPES: ['hourly', 'fixed'],

  PRICING_TYPE_LABELS: {
    'hourly': 'שעתי',
    'fixed': 'מחיר קבוע'
  },

  // ═══════════════════════════════════════════
  // Legal Procedure Stages (שלבי הליך משפטי)
  // ═══════════════════════════════════════════
  LEGAL_PROCEDURE_STAGES: {
    STAGE_A: { id: 'stage_a', name: "שלב א'", order: 1 },
    STAGE_B: { id: 'stage_b', name: "שלב ב'", order: 2 },
    STAGE_C: { id: 'stage_c', name: "שלב ג'", order: 3 }
  },

  VALID_STAGE_IDS: ['stage_a', 'stage_b', 'stage_c'],

  STAGE_COUNT: 3,

  STAGE_NAMES: {
    'stage_a': "שלב א'",
    'stage_b': "שלב ב'",
    'stage_c': "שלב ג'"
  },

  // ═══════════════════════════════════════════
  // User Roles (תפקידים)
  // ═══════════════════════════════════════════
  USER_ROLES: {
    ADMIN: 'admin',
    USER: 'user',
    LAWYER: 'lawyer',
    EMPLOYEE: 'employee',
    INTERN: 'intern'
  },

  VALID_ROLES: ['admin', 'user', 'lawyer', 'employee', 'intern'],

  ROLE_LABELS: {
    'admin': 'מנהל',
    'user': 'משתמש',
    'lawyer': 'עורך דין',
    'employee': 'עובד',
    'intern': 'מתמחה'
  },

  // ═══════════════════════════════════════════
  // Business Limits (מגבלות עסקיות)
  // ═══════════════════════════════════════════
  BUSINESS_LIMITS: {
    MAX_PACKAGE_HOURS: 500,
    MAX_STAGE_HOURS: 1000,
    MAX_FIXED_PRICE: 1000000,
    MAX_DEDUCTION_HOURS: 24
  },

  // ═══════════════════════════════════════════
  // Idle Timeout (זמן אי-פעילות)
  // ═══════════════════════════════════════════
  IDLE_TIMEOUT: {
    IDLE_MS: 10 * 60 * 1000,       // 10 minutes
    WARNING_MS: 5 * 60 * 1000,     // 5 minutes
    CHECK_INTERVAL_MS: 60 * 1000,  // 60 seconds
    ACTIVITY_THROTTLE_MS: 5 * 1000 // 5 seconds
  },

  // ═══════════════════════════════════════════
  // Admin Emails (מיילים מורשים)
  // ═══════════════════════════════════════════
  ADMIN_EMAILS: [
    'haim@ghlawoffice.co.il',
    'roi@ghlawoffice.co.il',
    'guy@ghlawoffice.co.il'
  ],

  // ═══════════════════════════════════════════
  // Description Limits (מגבלות תווים לתיאורים)
  // ═══════════════════════════════════════════
  DESCRIPTION_LIMITS: {
    TASK_DESCRIPTION: 50,
    TIMESHEET_DESCRIPTION: 50
  },

  // ═══════════════════════════════════════════
  // Package Types (סוגי חבילות)
  // ═══════════════════════════════════════════
  PACKAGE_TYPES: {
    INITIAL: 'initial',
    ADDITIONAL: 'additional',
    RENEWAL: 'renewal'
  },

  VALID_PACKAGE_TYPES: ['initial', 'additional', 'renewal']
};


// ═══════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════

function getStageName(stageId) {
  return SYSTEM_CONSTANTS.STAGE_NAMES[stageId] || stageId;
}

function getServiceTypeLabel(type) {
  return SYSTEM_CONSTANTS.SERVICE_TYPE_LABELS[type] || type;
}

function getPricingTypeLabel(type) {
  return SYSTEM_CONSTANTS.PRICING_TYPE_LABELS[type] || type;
}

function getRoleLabel(role) {
  return SYSTEM_CONSTANTS.ROLE_LABELS[role] || role;
}

function isValidServiceType(type) {
  return SYSTEM_CONSTANTS.VALID_SERVICE_TYPES.includes(type);
}

function isValidPricingType(type) {
  return SYSTEM_CONSTANTS.VALID_PRICING_TYPES.includes(type);
}

function isValidStageId(id) {
  return SYSTEM_CONSTANTS.VALID_STAGE_IDS.includes(id);
}

function isValidRole(role) {
  return SYSTEM_CONSTANTS.VALID_ROLES.includes(role);
}

function isValidPackageType(type) {
  return SYSTEM_CONSTANTS.VALID_PACKAGE_TYPES.includes(type);
}


// CommonJS export (used by functions/shared/constants.js and tests/sync-constants.test.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SYSTEM_CONSTANTS,
    getStageName,
    getServiceTypeLabel,
    getPricingTypeLabel,
    getRoleLabel,
    isValidServiceType,
    isValidPricingType,
    isValidStageId,
    isValidRole,
    isValidPackageType
  };
}
