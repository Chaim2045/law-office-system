/**
 * Deduction System - Public API (Facade)
 * Unified interface for all deduction operations
 *
 * @module deduction
 * @description Entry point for the deduction system
 * @created 2025-11-11
 * @version 1.0.0
 */

// Import all sub-modules
import * as Calculators from './calculators.js';
import * as Validators from './validators.js';
import * as Aggregators from './aggregators.js';

// Import deduction logic (if needed for re-export)
import {
  getActivePackage,
  deductHoursFromPackage,
  deductHoursFromStage,
  calculateClientUpdates
} from './deduction-logic.js';

// Import builders (if needed for re-export)
import {
  createPackage,
  createStage,
  createLegalProcedureStages,
  createLegalProcedureService,
  createHourlyService,
  addPackageToStage
} from './builders.js';

/**
 * Deduction System - Unified API
 */
const DeductionSystem = {
  // Calculators
  calculateRemainingHours: Calculators.calculateRemainingHours,
  calculateTotalHours: Calculators.calculateTotalHours,
  calculateHoursUsed: Calculators.calculateHoursUsed,
  calculateProgress: Calculators.calculateProgress,
  minutesToHours: Calculators.minutesToHours,
  hoursToMinutes: Calculators.hoursToMinutes,
  formatHours: Calculators.formatHours,

  // Validators
  validateTimeEntry: Validators.validateTimeEntry,
  validatePackage: Validators.validatePackage,
  validateHoursPackage: Validators.validateHoursPackage,
  validateStages: Validators.validateStages,
  validateDeduction: Validators.validateDeduction,

  // Aggregators
  updateServiceAggregates: Aggregators.updateServiceAggregates,
  updateStageAggregates: Aggregators.updateStageAggregates,
  updateClientAggregates: Aggregators.updateClientAggregates,
  updateLegalProcedureAggregates: Aggregators.updateLegalProcedureAggregates,
  createIncrementUpdate: Aggregators.createIncrementUpdate,

  // Deduction Logic
  getActivePackage,
  deductHoursFromPackage,
  deductHoursFromStage,
  calculateClientUpdates,

  // Builders
  createPackage,
  createStage,
  createLegalProcedureStages,
  createLegalProcedureService,
  createHourlyService,
  addPackageToStage
};

// Global access (for backward compatibility)
if (typeof window !== 'undefined') {
  window.DeductionSystem = DeductionSystem;

  // Keep the critical global function
  window.calculateRemainingHours = Calculators.calculateRemainingHours;
}

// CommonJS Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeductionSystem;
}

// ES6 Export
export default DeductionSystem;

// Named exports for tree-shaking
export {
  // Calculators
  Calculators,
  // Validators
  Validators,
  // Aggregators
  Aggregators,
  // Deduction Logic
  getActivePackage,
  deductHoursFromPackage,
  deductHoursFromStage,
  calculateClientUpdates,
  // Builders
  createPackage,
  createStage,
  createLegalProcedureStages,
  createLegalProcedureService,
  createHourlyService,
  addPackageToStage
};
