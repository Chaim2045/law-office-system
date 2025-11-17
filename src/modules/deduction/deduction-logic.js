/**
 * ⏱️ Deduction Logic - Helper functions for calculating hour deductions
 *
 * This module handles all logic for deducting hours from services, stages, and packages.
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
  if (!entity) {
return 0;
}

  if (!entity.packages || entity.packages.length === 0) {
    return entity.hoursRemaining || 0;
  }

  return entity.packages
    .filter(pkg => pkg.status === 'active' || !pkg.status)
    .reduce((sum, pkg) => sum + (pkg.hoursRemaining || 0), 0);
}

/**
 * Deducts hours from a package
 *
 * @param {Object} pkg - Package object
 * @param {number} hours - Hours to deduct
 * @returns {Object} Updated package
 */
function deductHoursFromPackage(pkg, hours) {
  pkg.hoursUsed = (pkg.hoursUsed || 0) + hours;
  pkg.hoursRemaining = (pkg.hoursRemaining || 0) - hours;

  // Ensure status is set
  if (!pkg.status) {
    pkg.status = 'active';
  }

  // Mark as depleted if no hours remaining
  if (pkg.hoursRemaining <= 0) {
    pkg.status = 'depleted';
    pkg.hoursRemaining = 0;
    pkg.closedDate = new Date().toISOString();
  }

  return pkg;
}

/**
 * Deducts hours from a stage
 *
 * @param {Object} stage - Stage object
 * @param {number} hours - Hours to deduct
 * @returns {Object} Update result with package info
 */
function deductHoursFromStage(stage, hours) {
  const activePackage = getActivePackage(stage);

  if (!activePackage) {
    return {
      success: false,
      error: 'אין חבילה פעילה לניכוי שעות'
    };
  }

  // Deduct from package
  deductHoursFromPackage(activePackage, hours);

  // Update stage totals
  stage.hoursUsed = (stage.hoursUsed || 0) + hours;
  stage.hoursRemaining = calculateRemainingHours(stage);

  return {
    success: true,
    packageId: activePackage.id,
    stageId: stage.id
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

// ES6 Export (for client-side use)
export {
  getActivePackage,
  calculateRemainingHours,
  deductHoursFromPackage,
  deductHoursFromStage,
  calculateClientUpdates,
  validateTimeEntry
};
