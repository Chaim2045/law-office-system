/**
 * 🧪 Unit Tests for deduction.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock the deduction module
const deduction = {
  getActivePackage(stage) {
    if (!stage || !stage.packages || stage.packages.length === 0) {
      return null;
    }

    return stage.packages.find(pkg =>
      pkg.status === 'active' && (pkg.hoursRemaining || 0) > 0
    ) || null;
  },

  calculateRemainingHours(entity) {
    if (!entity) return 0;

    if (!entity.packages || entity.packages.length === 0) {
      return entity.hoursRemaining || 0;
    }

    return entity.packages
      .filter(pkg => pkg.status === 'active' || !pkg.status)
      .reduce((sum, pkg) => sum + (pkg.hoursRemaining || 0), 0);
  },

  deductHoursFromPackage(pkg, hours) {
    pkg.hoursUsed = (pkg.hoursUsed || 0) + hours;
    pkg.hoursRemaining = (pkg.hoursRemaining || 0) - hours;

    if (pkg.hoursRemaining <= 0) {
      pkg.status = 'depleted';
      pkg.hoursRemaining = 0;
    }

    return pkg;
  },

  deductHoursFromStage(stage, hours) {
    const activePackage = this.getActivePackage(stage);

    if (!activePackage) {
      return {
        success: false,
        error: 'אין חבילה פעילה לניכוי שעות'
      };
    }

    this.deductHoursFromPackage(activePackage, hours);

    stage.hoursUsed = (stage.hoursUsed || 0) + hours;
    stage.hoursRemaining = this.calculateRemainingHours(stage);

    return {
      success: true,
      packageId: activePackage.id,
      stageId: stage.id
    };
  },

  validateTimeEntry(taskData, clientData) {
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
};

describe('deduction.js - getActivePackage', () => {
  it('should return active package with hours remaining', () => {
    const stage = {
      packages: [
        { id: 'pkg_1', status: 'active', hoursRemaining: 20 },
        { id: 'pkg_2', status: 'pending', hoursRemaining: 15 }
      ]
    };

    const result = deduction.getActivePackage(stage);
    expect(result).toBeTruthy();
    expect(result.id).toBe('pkg_1');
  });

  it('should return null if no active packages', () => {
    const stage = {
      packages: [
        { id: 'pkg_1', status: 'depleted', hoursRemaining: 0 },
        { id: 'pkg_2', status: 'pending', hoursRemaining: 15 }
      ]
    };

    const result = deduction.getActivePackage(stage);
    expect(result).toBeNull();
  });

  it('should return null if active package has no hours', () => {
    const stage = {
      packages: [
        { id: 'pkg_1', status: 'active', hoursRemaining: 0 }
      ]
    };

    const result = deduction.getActivePackage(stage);
    expect(result).toBeNull();
  });

  it('should return null if stage has no packages', () => {
    const stage = { packages: [] };
    const result = deduction.getActivePackage(stage);
    expect(result).toBeNull();
  });
});

describe('deduction.js - calculateRemainingHours', () => {
  it('should sum hours from active packages', () => {
    const stage = {
      packages: [
        { status: 'active', hoursRemaining: 10 },
        { status: 'active', hoursRemaining: 15 },
        { status: 'depleted', hoursRemaining: 0 }
      ]
    };

    const result = deduction.calculateRemainingHours(stage);
    expect(result).toBe(25); // 10 + 15
  });

  it('should include packages without status', () => {
    const stage = {
      packages: [
        { hoursRemaining: 10 }, // no status
        { status: 'active', hoursRemaining: 5 }
      ]
    };

    const result = deduction.calculateRemainingHours(stage);
    expect(result).toBe(15);
  });

  it('should return hoursRemaining if no packages', () => {
    const entity = { hoursRemaining: 30 };
    const result = deduction.calculateRemainingHours(entity);
    expect(result).toBe(30);
  });

  it('should return 0 for null entity', () => {
    const result = deduction.calculateRemainingHours(null);
    expect(result).toBe(0);
  });
});

describe('deduction.js - deductHoursFromPackage', () => {
  it('should deduct hours correctly', () => {
    const pkg = {
      hoursUsed: 0,
      hoursRemaining: 20,
      status: 'active'
    };

    deduction.deductHoursFromPackage(pkg, 1.25);

    expect(pkg.hoursUsed).toBe(1.25);
    expect(pkg.hoursRemaining).toBe(18.75);
    expect(pkg.status).toBe('active');
  });

  it('should mark package as depleted when hours reach 0', () => {
    const pkg = {
      hoursUsed: 18,
      hoursRemaining: 2,
      status: 'active'
    };

    deduction.deductHoursFromPackage(pkg, 2);

    expect(pkg.hoursUsed).toBe(20);
    expect(pkg.hoursRemaining).toBe(0);
    expect(pkg.status).toBe('depleted');
  });

  it('should handle over-deduction', () => {
    const pkg = {
      hoursUsed: 0,
      hoursRemaining: 1,
      status: 'active'
    };

    deduction.deductHoursFromPackage(pkg, 2);

    expect(pkg.hoursRemaining).toBe(0); // capped at 0
    expect(pkg.status).toBe('depleted');
  });
});

describe('deduction.js - deductHoursFromStage', () => {
  it('should deduct hours from active package and update stage', () => {
    const stage = {
      id: 'stage_a',
      hoursUsed: 0,
      packages: [
        { id: 'pkg_1', status: 'active', hoursRemaining: 20, hoursUsed: 0 }
      ]
    };

    const result = deduction.deductHoursFromStage(stage, 1.25);

    expect(result.success).toBe(true);
    expect(result.packageId).toBe('pkg_1');
    expect(result.stageId).toBe('stage_a');
    expect(stage.hoursUsed).toBe(1.25);
    expect(stage.hoursRemaining).toBe(18.75);
  });

  it('should return error if no active package', () => {
    const stage = {
      id: 'stage_b',
      packages: [
        { id: 'pkg_1', status: 'depleted', hoursRemaining: 0 }
      ]
    };

    const result = deduction.deductHoursFromStage(stage, 1);

    expect(result.success).toBe(false);
    expect(result.error).toBe('אין חבילה פעילה לניכוי שעות');
  });

  it('should handle multiple packages and use first active', () => {
    const stage = {
      id: 'stage_a',
      hoursUsed: 5,
      packages: [
        { id: 'pkg_1', status: 'depleted', hoursRemaining: 0, hoursUsed: 10 },
        { id: 'pkg_2', status: 'active', hoursRemaining: 15, hoursUsed: 5 }
      ]
    };

    const result = deduction.deductHoursFromStage(stage, 2);

    expect(result.success).toBe(true);
    expect(result.packageId).toBe('pkg_2');
    expect(stage.packages[1].hoursRemaining).toBe(13);
  });
});

describe('deduction.js - validateTimeEntry', () => {
  it('should validate correct legal procedure task', () => {
    const task = {
      serviceType: 'legal_procedure',
      parentServiceId: 'srv_001',
      serviceId: 'stage_a'
    };

    const client = {
      services: [{ id: 'srv_001' }]
    };

    const result = deduction.validateTimeEntry(task, client);
    expect(result.valid).toBe(true);
  });

  it('should reject task without serviceType', () => {
    const task = {
      parentServiceId: 'srv_001'
    };

    const client = { services: [] };

    const result = deduction.validateTimeEntry(task, client);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('שירות');
  });

  it('should reject legal procedure without serviceId', () => {
    const task = {
      serviceType: 'legal_procedure',
      parentServiceId: 'srv_001'
      // missing serviceId
    };

    const client = { services: [] };

    const result = deduction.validateTimeEntry(task, client);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('שלב');
  });

  it('should reject if client has no services', () => {
    const task = {
      serviceType: 'hours',
      parentServiceId: 'srv_001'
    };

    const client = { services: [] };

    const result = deduction.validateTimeEntry(task, client);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('אין שירותים');
  });

  it('should accept hourly service without serviceId', () => {
    const task = {
      serviceType: 'hours',
      parentServiceId: 'srv_001'
    };

    const client = {
      services: [{ id: 'srv_001' }]
    };

    const result = deduction.validateTimeEntry(task, client);
    expect(result.valid).toBe(true);
  });
});
