/**
 * 🏗️ Builders - Helper functions for creating services, stages, and packages
 *
 * This module consolidates all logic for building data structures consistently
 * across createClient and addServiceToClient functions.
 */

/**
 * Creates a package object with consistent structure
 *
 * @param {Object} params
 * @param {string} params.stageId - Stage ID (e.g., 'stage_a')
 * @param {string} params.type - Package type ('initial', 'additional')
 * @param {number} params.hours - Total hours for this package
 * @param {string} params.status - Package status ('active', 'pending', 'depleted')
 * @param {string} [params.description] - Optional description
 * @returns {Object} Package object
 */
function createPackage({ stageId, type, hours, status, description }) {
  return {
    id: `pkg_${type}_${stageId}_${Date.now()}`,
    type,
    hours,
    hoursUsed: 0,
    hoursRemaining: hours,
    status,
    description: description || (type === 'initial' ? 'חבילה ראשונית' : 'חבילה נוספת'),
    createdAt: new Date().toISOString()
  };
}

/**
 * Creates a stage object with consistent structure
 *
 * @param {Object} params
 * @param {string} params.id - Stage ID ('stage_a', 'stage_b', 'stage_c')
 * @param {string} params.name - Stage display name
 * @param {string} params.description - Stage description
 * @param {number} params.order - Stage order (1, 2, 3)
 * @param {string} params.status - Stage status ('active', 'pending')
 * @param {number} params.hours - Total hours for this stage
 * @returns {Object} Stage object with initial package
 */
function createStage({ id, name, description, order, status, hours }) {
  const initialPackage = createPackage({
    stageId: id,
    type: 'initial',
    hours,
    status: status === 'active' ? 'active' : 'pending'
  });

  return {
    id,
    name,
    description,
    order,
    status,
    totalHours: hours,
    hoursUsed: 0,
    hoursRemaining: hours,
    packages: [initialPackage],
    createdAt: new Date().toISOString()
  };
}

/**
 * Creates 3 stages for legal procedure service
 *
 * @param {Array<Object>} stagesData - Array with 3 stage objects
 * @param {string} stagesData[].description - Stage description
 * @param {number} stagesData[].hours - Stage hours
 * @returns {Array<Object>} Array of 3 stage objects
 */
function createLegalProcedureStages(stagesData) {
  if (!stagesData || stagesData.length !== 3) {
    throw new Error('Legal procedure requires exactly 3 stages');
  }

  const stageIds = ['stage_a', 'stage_b', 'stage_c'];
  const stageNames = ['שלב א\'', 'שלב ב\'', 'שלב ג\''];

  return stagesData.map((stageData, index) => {
    return createStage({
      id: stageIds[index],
      name: stageNames[index],
      description: stageData.description || '',
      order: index + 1,
      status: index === 0 ? 'active' : 'pending',
      hours: stageData.hours || 0
    });
  });
}

/**
 * Creates a legal procedure service
 *
 * @param {Object} params
 * @param {string} params.id - Service ID
 * @param {string} params.name - Service name (procedure type)
 * @param {Array<Object>} params.stagesData - Array with 3 stage definitions
 * @param {string} [params.currentStage] - Current active stage ID
 * @returns {Object} Complete legal procedure service object
 */
function createLegalProcedureService({ id, name, stagesData, currentStage }) {
  const stages = createLegalProcedureStages(stagesData);

  const totalHours = stages.reduce((sum, stage) => sum + stage.totalHours, 0);

  return {
    id,
    type: 'legal_procedure',
    name,
    currentStage: currentStage || 'stage_a',
    stages,
    totalHours,
    hoursUsed: 0,
    hoursRemaining: totalHours,
    createdAt: new Date().toISOString()
  };
}

/**
 * Creates an hourly service (no stages)
 *
 * @param {Object} params
 * @param {string} params.id - Service ID
 * @param {string} params.name - Service name
 * @param {number} params.hours - Total hours
 * @returns {Object} Hourly service object
 */
function createHourlyService({ id, name, hours }) {
  return {
    id,
    type: 'hours',
    name,
    totalHours: hours,
    hoursUsed: 0,
    hoursRemaining: hours,
    createdAt: new Date().toISOString()
  };
}

/**
 * Adds a package to an existing stage
 *
 * @param {Object} stage - The stage to add package to
 * @param {number} hours - Hours for the new package
 * @param {string} [description] - Optional description
 * @returns {Object} The created package
 */
function addPackageToStage(stage, hours, description) {
  const newPackage = createPackage({
    stageId: stage.id,
    type: 'additional',
    hours,
    status: stage.status === 'active' ? 'active' : 'pending',
    description
  });

  stage.packages.push(newPackage);
  stage.totalHours += hours;
  stage.hoursRemaining += hours;

  return newPackage;
}

module.exports = {
  createPackage,
  createStage,
  createLegalProcedureStages,
  createLegalProcedureService,
  createHourlyService,
  addPackageToStage
};
