/**
 * System Constants — User App Adapter (IIFE → window)
 * =====================================================
 *
 * Canonical source: shared/system-constants.js
 * Sync verified by: tests/sync-constants.test.js
 *
 * Exports:
 *   window.SYSTEM_CONSTANTS  — all constants
 *   window.SystemConstantsHelpers — helper functions
 */

(function() {
  'use strict';

  const SYSTEM_CONSTANTS = {

    // Service Types (סוגי שירות)
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

    // Pricing Types (סוגי תמחור)
    PRICING_TYPES: {
      HOURLY: 'hourly',
      FIXED: 'fixed'
    },
    VALID_PRICING_TYPES: ['hourly', 'fixed'],
    PRICING_TYPE_LABELS: {
      'hourly': 'שעתי',
      'fixed': 'מחיר קבוע'
    },

    // Legal Procedure Stages (שלבי הליך משפטי)
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

    // User Roles (תפקידים)
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

    // Business Limits (מגבלות עסקיות)
    BUSINESS_LIMITS: {
      MAX_PACKAGE_HOURS: 500,
      MAX_STAGE_HOURS: 1000,
      MAX_FIXED_PRICE: 1000000,
      MAX_DEDUCTION_HOURS: 24
    },

    // Idle Timeout (זמן אי-פעילות)
    IDLE_TIMEOUT: {
      IDLE_MS: 10 * 60 * 1000,
      WARNING_MS: 5 * 60 * 1000,
      CHECK_INTERVAL_MS: 60 * 1000,
      ACTIVITY_THROTTLE_MS: 5 * 1000
    },

    // Admin Emails (מיילים מורשים)
    ADMIN_EMAILS: [
      'haim@ghlawoffice.co.il',
      'roi@ghlawoffice.co.il',
      'guy@ghlawoffice.co.il'
    ],

    // Package Types (סוגי חבילות)
    PACKAGE_TYPES: {
      INITIAL: 'initial',
      ADDITIONAL: 'additional',
      RENEWAL: 'renewal'
    },
    VALID_PACKAGE_TYPES: ['initial', 'additional', 'renewal']
  };


  // Helper Functions

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


  // Export to window
  window.SYSTEM_CONSTANTS = SYSTEM_CONSTANTS;
  window.SystemConstantsHelpers = {
    getStageName: getStageName,
    getServiceTypeLabel: getServiceTypeLabel,
    getPricingTypeLabel: getPricingTypeLabel,
    getRoleLabel: getRoleLabel,
    isValidServiceType: isValidServiceType,
    isValidPricingType: isValidPricingType,
    isValidStageId: isValidStageId,
    isValidRole: isValidRole,
    isValidPackageType: isValidPackageType
  };

  console.log('✅ System Constants loaded');

})();
