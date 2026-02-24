/**
 * Unit Tests - Deduction Validators
 * Tests for all validation functions
 */

import { describe, it, expect } from 'vitest';
import {
  validateTimeEntry,
  validatePackage,
  validateHoursPackage,
  validateStages,
  validateDeduction
} from '../../../apps/user-app/src/modules/deduction/validators.js';

describe('Deduction Validators - validateTimeEntry', () => {
  it('should validate a complete time entry', () => {
    const taskData = {
      serviceType: 'hourly_service',
      parentServiceId: 'srv_123'
    };
    const clientData = {
      services: [
        { id: 'srv_123', type: 'hourly_service' }
      ]
    };

    const result = validateTimeEntry(taskData, clientData);
    expect(result.valid).toBe(true);
  });

  it('should require task data', () => {
    const result = validateTimeEntry(null, { services: [] });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('משימה לא נמצאה');
  });

  it('should require client data', () => {
    const taskData = { serviceType: 'hourly_service', parentServiceId: 'srv_123' };
    const result = validateTimeEntry(taskData, null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('לקוח לא נמצא');
  });

  it('should require serviceType and parentServiceId', () => {
    const taskData = { description: 'Some task' };
    const clientData = { services: [{ id: 'srv_123' }] };

    const result = validateTimeEntry(taskData, clientData);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('המשימה חסרה מידע על שירות');
  });

  it('should require serviceId for legal_procedure tasks', () => {
    const taskData = {
      serviceType: 'legal_procedure',
      parentServiceId: 'lp_123'
      // Missing serviceId (stageId)
    };
    const clientData = {
      services: [{ id: 'lp_123', type: 'legal_procedure' }]
    };

    const result = validateTimeEntry(taskData, clientData);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('המשימה חסרה מידע על שלב');
  });

  it('should require client to have active services', () => {
    const taskData = {
      serviceType: 'hourly_service',
      parentServiceId: 'srv_123'
    };
    const clientData = {
      services: []
    };

    const result = validateTimeEntry(taskData, clientData);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('ללקוח אין שירותים פעילים');
  });

  it('should validate legal_procedure with serviceId', () => {
    const taskData = {
      serviceType: 'legal_procedure',
      parentServiceId: 'lp_123',
      serviceId: 'stage_1'
    };
    const clientData = {
      services: [{ id: 'lp_123', type: 'legal_procedure' }]
    };

    const result = validateTimeEntry(taskData, clientData);
    expect(result.valid).toBe(true);
  });
});

describe('Deduction Validators - validatePackage', () => {
  it('should validate a valid package', () => {
    const packageData = {
      hours: 50,
      type: 'initial'
    };

    const result = validatePackage(packageData);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate additional package type', () => {
    const packageData = {
      hours: 30,
      type: 'additional'
    };

    const result = validatePackage(packageData);
    expect(result.valid).toBe(true);
  });

  it('should validate renewal package type', () => {
    const packageData = {
      hours: 100,
      type: 'renewal'
    };

    const result = validatePackage(packageData);
    expect(result.valid).toBe(true);
  });

  it('should reject missing hours', () => {
    const packageData = {
      type: 'initial'
    };

    const result = validatePackage(packageData);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('חובה להזין כמות שעות תקינה');
  });

  it('should reject zero hours', () => {
    const packageData = {
      hours: 0,
      type: 'initial'
    };

    const result = validatePackage(packageData);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('חובה להזין כמות שעות תקינה');
  });

  it('should reject negative hours', () => {
    const packageData = {
      hours: -10,
      type: 'initial'
    };

    const result = validatePackage(packageData);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('חובה להזין כמות שעות תקינה');
  });

  it('should reject hours over 500', () => {
    const packageData = {
      hours: 501,
      type: 'initial'
    };

    const result = validatePackage(packageData);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('כמות שעות גבוהה מדי (מקסימום 500)');
  });

  it('should accept exactly 500 hours', () => {
    const packageData = {
      hours: 500,
      type: 'initial'
    };

    const result = validatePackage(packageData);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid package type', () => {
    const packageData = {
      hours: 50,
      type: 'invalid_type'
    };

    const result = validatePackage(packageData);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('סוג חבילה לא תקין');
  });

  it('should reject missing package type', () => {
    const packageData = {
      hours: 50
    };

    const result = validatePackage(packageData);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('סוג חבילה לא תקין');
  });

  it('should return multiple errors when multiple issues exist', () => {
    const packageData = {
      hours: 0,
      type: 'wrong'
    };

    const result = validatePackage(packageData);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

describe('Deduction Validators - validateHoursPackage', () => {
  it('should validate valid hours and reason', () => {
    const result = validateHoursPackage(50, 'תוספת שעות לפי הסכם');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject missing hours', () => {
    const result = validateHoursPackage(null, 'Valid reason');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('חובה להזין כמות שעות תקינה');
  });

  it('should reject zero hours', () => {
    const result = validateHoursPackage(0, 'Valid reason');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('חובה להזין כמות שעות תקינה');
  });

  it('should reject negative hours', () => {
    const result = validateHoursPackage(-5, 'Valid reason');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('חובה להזין כמות שעות תקינה');
  });

  it('should reject hours over 500', () => {
    const result = validateHoursPackage(501, 'Valid reason');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('כמות שעות גבוהה מדי (מקסימום 500 שעות בחבילה)');
  });

  it('should accept exactly 500 hours', () => {
    const result = validateHoursPackage(500, 'Valid reason');
    expect(result.valid).toBe(true);
  });

  it('should reject missing reason', () => {
    const result = validateHoursPackage(50, null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('חובה להזין סיבה/הערה (לפחות 3 תווים)');
  });

  it('should reject empty reason', () => {
    const result = validateHoursPackage(50, '');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('חובה להזין סיבה/הערה (לפחות 3 תווים)');
  });

  it('should reject reason with only spaces', () => {
    const result = validateHoursPackage(50, '   ');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('חובה להזין סיבה/הערה (לפחות 3 תווים)');
  });

  it('should reject reason shorter than 3 characters', () => {
    const result = validateHoursPackage(50, 'ab');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('חובה להזין סיבה/הערה (לפחות 3 תווים)');
  });

  it('should accept reason with exactly 3 characters', () => {
    const result = validateHoursPackage(50, 'abc');
    expect(result.valid).toBe(true);
  });

  it('should return multiple errors when both hours and reason are invalid', () => {
    const result = validateHoursPackage(0, 'ab');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

describe('Deduction Validators - validateStages', () => {
  it('should validate 3 valid hourly stages', () => {
    const stages = [
      { description: 'שלב 1: הכנות', hours: 50 },
      { description: 'שלב 2: ביצוע', hours: 100 },
      { description: 'שלב 3: סיום', hours: 30 }
    ];

    const result = validateStages(stages, 'hourly');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate 3 valid fixed-price stages', () => {
    const stages = [
      { description: 'שלב 1: הכנות', fixedPrice: 5000 },
      { description: 'שלב 2: ביצוע', fixedPrice: 10000 },
      { description: 'שלב 3: סיום', fixedPrice: 3000 }
    ];

    const result = validateStages(stages, 'fixed');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject when not exactly 3 stages', () => {
    const stages = [
      { description: 'שלב 1', hours: 50 },
      { description: 'שלב 2', hours: 100 }
    ];

    const result = validateStages(stages, 'hourly');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('חובה למלא בדיוק 3 שלבים');
  });

  it('should reject when stages is not an array', () => {
    const result = validateStages(null, 'hourly');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('חובה למלא בדיוק 3 שלבים');
  });

  it('should reject stage with missing description', () => {
    const stages = [
      { description: '', hours: 50 },
      { description: 'שלב 2', hours: 100 },
      { description: 'שלב 3', hours: 30 }
    ];

    const result = validateStages(stages, 'hourly');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('שלב 1: חובה למלא תיאור השלב');
  });

  it('should reject hourly stage with zero hours', () => {
    const stages = [
      { description: 'שלב 1', hours: 0 },
      { description: 'שלב 2', hours: 100 },
      { description: 'שלב 3', hours: 30 }
    ];

    const result = validateStages(stages, 'hourly');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('שלב 1: חובה למלא תקרת שעות תקינה');
  });

  it('should reject hourly stage with negative hours', () => {
    const stages = [
      { description: 'שלב 1', hours: 50 },
      { description: 'שלב 2', hours: -10 },
      { description: 'שלב 3', hours: 30 }
    ];

    const result = validateStages(stages, 'hourly');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('שלב 2: חובה למלא תקרת שעות תקינה');
  });

  it('should reject hourly stage with hours over 1000', () => {
    const stages = [
      { description: 'שלב 1', hours: 50 },
      { description: 'שלב 2', hours: 100 },
      { description: 'שלב 3', hours: 1001 }
    ];

    const result = validateStages(stages, 'hourly');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('שלב 3: תקרת שעות גבוהה מדי (מקסימום 1000)');
  });

  it('should accept hourly stage with exactly 1000 hours', () => {
    const stages = [
      { description: 'שלב 1', hours: 50 },
      { description: 'שלב 2', hours: 100 },
      { description: 'שלב 3', hours: 1000 }
    ];

    const result = validateStages(stages, 'hourly');
    expect(result.valid).toBe(true);
  });

  it('should reject fixed stage with zero price', () => {
    const stages = [
      { description: 'שלב 1', fixedPrice: 5000 },
      { description: 'שלב 2', fixedPrice: 0 },
      { description: 'שלב 3', fixedPrice: 3000 }
    ];

    const result = validateStages(stages, 'fixed');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('שלב 2: חובה למלא מחיר פיקס תקין');
  });

  it('should reject fixed stage with negative price', () => {
    const stages = [
      { description: 'שלב 1', fixedPrice: -1000 },
      { description: 'שלב 2', fixedPrice: 10000 },
      { description: 'שלב 3', fixedPrice: 3000 }
    ];

    const result = validateStages(stages, 'fixed');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('שלב 1: חובה למלא מחיר פיקס תקין');
  });

  it('should reject fixed stage with price over 1000000', () => {
    const stages = [
      { description: 'שלב 1', fixedPrice: 5000 },
      { description: 'שלב 2', fixedPrice: 1000001 },
      { description: 'שלב 3', fixedPrice: 3000 }
    ];

    const result = validateStages(stages, 'fixed');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('שלב 2: מחיר גבוה מדי (מקסימום 1,000,000 ₪)');
  });

  it('should accept fixed stage with exactly 1000000', () => {
    const stages = [
      { description: 'שלב 1', fixedPrice: 5000 },
      { description: 'שלב 2', fixedPrice: 1000000 },
      { description: 'שלב 3', fixedPrice: 3000 }
    ];

    const result = validateStages(stages, 'fixed');
    expect(result.valid).toBe(true);
  });

  it('should return multiple errors for multiple stages', () => {
    const stages = [
      { description: '', hours: 0 },
      { description: 'שלב 2', hours: -5 },
      { description: 'שלב 3', hours: 1001 }
    ];

    const result = validateStages(stages, 'hourly');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('should default to hourly when pricingType not specified', () => {
    const stages = [
      { description: 'שלב 1', hours: 50 },
      { description: 'שלב 2', hours: 100 },
      { description: 'שלב 3', hours: 30 }
    ];

    const result = validateStages(stages);
    expect(result.valid).toBe(true);
  });
});

describe('Deduction Validators - validateDeduction', () => {
  it('should validate valid deduction', () => {
    const entity = {
      packages: [{ status: 'active', hoursRemaining: 50 }]
    };

    const result = validateDeduction(5, entity);
    expect(result.valid).toBe(true);
  });

  it('should reject zero hours', () => {
    const entity = { packages: [{ status: 'active', hoursRemaining: 50 }] };

    const result = validateDeduction(0, entity);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('כמות שעות לקיזוז חייבת להיות חיובית');
  });

  it('should reject negative hours', () => {
    const entity = { packages: [{ status: 'active', hoursRemaining: 50 }] };

    const result = validateDeduction(-5, entity);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('כמות שעות לקיזוז חייבת להיות חיובית');
  });

  it('should reject null hours', () => {
    const entity = { packages: [{ status: 'active', hoursRemaining: 50 }] };

    const result = validateDeduction(null, entity);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('כמות שעות לקיזוז חייבת להיות חיובית');
  });

  it('should reject hours over 24', () => {
    const entity = { packages: [{ status: 'active', hoursRemaining: 50 }] };

    const result = validateDeduction(25, entity);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('לא ניתן לקזז יותר מ-24 שעות בפעולה אחת');
  });

  it('should accept exactly 24 hours', () => {
    const entity = { packages: [{ status: 'active', hoursRemaining: 50 }] };

    const result = validateDeduction(24, entity);
    expect(result.valid).toBe(true);
  });

  it('should reject null entity', () => {
    const result = validateDeduction(5, null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('לא נמצא שירות או שלב לקיזוז');
  });

  it('should reject undefined entity', () => {
    const result = validateDeduction(5, undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('לא נמצא שירות או שלב לקיזוז');
  });

  it('should accept valid entity with legacy structure', () => {
    const entity = { hoursRemaining: 50 };

    const result = validateDeduction(5, entity);
    expect(result.valid).toBe(true);
  });

  it('should accept fractional hours', () => {
    const entity = { packages: [{ status: 'active', hoursRemaining: 50 }] };

    const result = validateDeduction(2.5, entity);
    expect(result.valid).toBe(true);
  });

  it('should accept 0.25 hours (15 minutes)', () => {
    const entity = { packages: [{ status: 'active', hoursRemaining: 50 }] };

    const result = validateDeduction(0.25, entity);
    expect(result.valid).toBe(true);
  });
});
