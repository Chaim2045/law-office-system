/**
 * Deduction System - Public API (Facade)
 * CommonJS version for Firebase Functions
 *
 * @module deduction
 * @description Entry point for the deduction system
 * @created 2025-11-11
 * @version 1.1.0 - CommonJS
 */

// ✅ CommonJS imports - compatible with Firebase Functions
const deductionLogic = require('./deduction-logic');

/**
 * Deduction System - Unified API (CommonJS)
 *
 * This is a simplified version that exports only the core deduction functions
 * needed by Firebase Functions. The full ES6 version with all modules is available
 * for client-side use.
 */
const DeductionSystem = {
  // Core deduction functions
  getActivePackage: deductionLogic.getActivePackage,
  calculateRemainingHours: deductionLogic.calculateRemainingHours,
  deductHoursFromPackage: deductionLogic.deductHoursFromPackage,
  deductHoursFromStage: deductionLogic.deductHoursFromStage,
  calculateClientUpdates: deductionLogic.calculateClientUpdates,
  validateTimeEntry: deductionLogic.validateTimeEntry,
};

// CommonJS Export
module.exports = DeductionSystem;