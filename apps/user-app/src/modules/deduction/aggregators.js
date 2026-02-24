/**
 * Deduction System - Aggregators Module
 * Updates aggregate fields after deduction operations
 *
 * @module deduction/aggregators
 * @description Updates the 10 critical aggregate fields in client documents
 * @created 2025-11-11
 * @version 1.0.0
 */

import { calculateRemainingHours, calculateTotalHours, calculateHoursUsed } from './calculators.js';

/**
 * Update service-level aggregates after deduction
 *
 * @param {Object} service - Service object to update
 * @param {string} username - User performing the update
 * @returns {Object} Updated service
 */
function updateServiceAggregates(service, username) {
  if (!service) {
return service;
}

  // Recalculate from packages
  service.totalHours = calculateTotalHours(service);
  service.hoursUsed = calculateHoursUsed(service);
  service.hoursRemaining = calculateRemainingHours(service);

  // Minutes (for precision)
  service.minutesUsed = Math.round(service.hoursUsed * 60);
  service.minutesRemaining = Math.round(service.hoursRemaining * 60);
  service.totalMinutes = Math.round(service.totalHours * 60);

  // Metadata
  service.lastActivity = new Date().toISOString();
  service._lastModified = new Date().toISOString();
  if (username) {
    service._modifiedBy = username;
  }

  return service;
}

/**
 * Update stage-level aggregates after deduction
 *
 * @param {Object} stage - Stage object to update
 * @param {string} username - User performing the update
 * @returns {Object} Updated stage
 */
function updateStageAggregates(stage, username) {
  if (!stage) {
return stage;
}

  // Recalculate from packages
  stage.totalHours = calculateTotalHours(stage);
  stage.hoursUsed = calculateHoursUsed(stage);
  stage.hoursRemaining = calculateRemainingHours(stage);

  // Minutes
  stage.minutesUsed = Math.round(stage.hoursUsed * 60);
  stage.minutesRemaining = Math.round(stage.hoursRemaining * 60);
  stage.totalMinutes = Math.round(stage.totalHours * 60);

  // Metadata
  stage.lastActivity = new Date().toISOString();

  return stage;
}

/**
 * Update client-level aggregates (sum of all services)
 *
 * @param {Object} clientData - Client document
 * @param {string} username - User performing the update
 * @returns {Object} Client updates object
 */
function updateClientAggregates(clientData, username) {
  if (!clientData || !clientData.services || clientData.services.length === 0) {
    return {};
  }

  // Sum across all services
  const totalHours = clientData.services.reduce((sum, s) => sum + (s.totalHours || 0), 0);
  const hoursUsed = clientData.services.reduce((sum, s) => sum + (s.hoursUsed || 0), 0);
  const hoursRemaining = clientData.services.reduce((sum, s) => sum + calculateRemainingHours(s), 0);

  return {
    totalHours,
    hoursUsed,
    hoursRemaining,
    minutesUsed: Math.round(hoursUsed * 60),
    minutesRemaining: Math.round(hoursRemaining * 60),
    totalMinutes: Math.round(totalHours * 60),
    lastActivity: new Date().toISOString(),
    _lastModified: new Date().toISOString(),
    _modifiedBy: username || 'system',
    _version: (clientData._version || 0) + 1
  };
}

/**
 * Update all aggregates in a legal procedure
 *
 * @param {Object} procedure - Legal procedure object
 * @param {string} username - User performing the update
 * @returns {Object} Updated procedure
 */
function updateLegalProcedureAggregates(procedure, username) {
  if (!procedure || !procedure.stages) {
return procedure;
}

  // Update each stage
  procedure.stages.forEach(stage => {
    updateStageAggregates(stage, username);
  });

  // Update service totals (sum of all stages)
  procedure.totalHours = procedure.stages.reduce((sum, s) => sum + (s.totalHours || 0), 0);
  procedure.hoursUsed = procedure.stages.reduce((sum, s) => sum + (s.hoursUsed || 0), 0);
  procedure.hoursRemaining = procedure.stages.reduce((sum, s) => sum + calculateRemainingHours(s), 0);

  procedure.minutesUsed = Math.round(procedure.hoursUsed * 60);
  procedure.minutesRemaining = Math.round(procedure.hoursRemaining * 60);

  procedure.lastActivity = new Date().toISOString();
  procedure._lastModified = new Date().toISOString();
  if (username) {
    procedure._modifiedBy = username;
  }

  return procedure;
}

/**
 * Create Firestore increment update object
 *
 * @param {number} hoursToAdd - Hours to increment (negative for deduction)
 * @param {Object} FieldValue - Firebase FieldValue object
 * @returns {Object} Update object with increments
 */
function createIncrementUpdate(hoursToAdd, FieldValue) {
  const minutesToAdd = Math.round(hoursToAdd * 60);

  return {
    hoursUsed: FieldValue.increment(hoursToAdd),
    hoursRemaining: FieldValue.increment(-hoursToAdd),
    minutesUsed: FieldValue.increment(minutesToAdd),
    minutesRemaining: FieldValue.increment(-minutesToAdd),
    lastActivity: FieldValue.serverTimestamp(),
    _lastModified: FieldValue.serverTimestamp()
  };
}

// Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    updateServiceAggregates,
    updateStageAggregates,
    updateClientAggregates,
    updateLegalProcedureAggregates,
    createIncrementUpdate
  };
}

export {
  updateServiceAggregates,
  updateStageAggregates,
  updateClientAggregates,
  updateLegalProcedureAggregates,
  createIncrementUpdate
};
