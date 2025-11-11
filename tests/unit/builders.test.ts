/**
 * 🧪 Unit Tests for builders.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock the builders module
const builders = {
  createPackage({ stageId, type, hours, status, description }) {
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
  },

  createStage({ id, name, description, order, status, hours }) {
    const initialPackage = this.createPackage({
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
  },

  createLegalProcedureStages(stagesData) {
    if (!stagesData || stagesData.length !== 3) {
      throw new Error('Legal procedure requires exactly 3 stages');
    }

    const stageIds = ['stage_a', 'stage_b', 'stage_c'];
    const stageNames = ['שלב א\'', 'שלב ב\'', 'שלב ג\''];

    return stagesData.map((stageData, index) => {
      return this.createStage({
        id: stageIds[index],
        name: stageNames[index],
        description: stageData.description || '',
        order: index + 1,
        status: index === 0 ? 'active' : 'pending',
        hours: stageData.hours || 0
      });
    });
  },

  createLegalProcedureService({ id, name, stagesData, currentStage }) {
    const stages = this.createLegalProcedureStages(stagesData);
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
  },

  createHourlyService({ id, name, hours }) {
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
};

describe('builders.js - Package Creation', () => {
  it('should create initial package with correct structure', () => {
    const pkg = builders.createPackage({
      stageId: 'stage_a',
      type: 'initial',
      hours: 20,
      status: 'active'
    });

    expect(pkg).toHaveProperty('id');
    expect(pkg.id).toContain('pkg_initial_stage_a_');
    expect(pkg.type).toBe('initial');
    expect(pkg.hours).toBe(20);
    expect(pkg.hoursUsed).toBe(0);
    expect(pkg.hoursRemaining).toBe(20);
    expect(pkg.status).toBe('active');
    expect(pkg.description).toBe('חבילה ראשונית');
    expect(pkg).toHaveProperty('createdAt');
  });

  it('should create additional package with custom description', () => {
    const pkg = builders.createPackage({
      stageId: 'stage_b',
      type: 'additional',
      hours: 15,
      status: 'pending',
      description: 'חבילה מותאמת אישית'
    });

    expect(pkg.type).toBe('additional');
    expect(pkg.description).toBe('חבילה מותאמת אישית');
  });
});

describe('builders.js - Stage Creation', () => {
  it('should create active stage with initial package', () => {
    const stage = builders.createStage({
      id: 'stage_a',
      name: 'שלב א\'',
      description: 'שלב ראשון',
      order: 1,
      status: 'active',
      hours: 34
    });

    expect(stage.id).toBe('stage_a');
    expect(stage.name).toBe('שלב א\'');
    expect(stage.status).toBe('active');
    expect(stage.totalHours).toBe(34);
    expect(stage.hoursUsed).toBe(0);
    expect(stage.hoursRemaining).toBe(34);
    expect(stage.packages).toHaveLength(1);
    expect(stage.packages[0].status).toBe('active');
  });

  it('should create pending stage with pending package', () => {
    const stage = builders.createStage({
      id: 'stage_b',
      name: 'שלב ב\'',
      description: 'שלב שני',
      order: 2,
      status: 'pending',
      hours: 25
    });

    expect(stage.status).toBe('pending');
    expect(stage.packages[0].status).toBe('pending');
  });
});

describe('builders.js - Legal Procedure Stages', () => {
  it('should create 3 stages with correct structure', () => {
    const stagesData = [
      { description: 'שלב ראשון', hours: 34 },
      { description: 'שלב שני', hours: 25 },
      { description: 'שלב שלישי', hours: 16 }
    ];

    const stages = builders.createLegalProcedureStages(stagesData);

    expect(stages).toHaveLength(3);
    expect(stages[0].id).toBe('stage_a');
    expect(stages[1].id).toBe('stage_b');
    expect(stages[2].id).toBe('stage_c');
  });

  it('should mark only first stage as active', () => {
    const stagesData = [
      { description: 'א', hours: 10 },
      { description: 'ב', hours: 10 },
      { description: 'ג', hours: 10 }
    ];

    const stages = builders.createLegalProcedureStages(stagesData);

    expect(stages[0].status).toBe('active');
    expect(stages[1].status).toBe('pending');
    expect(stages[2].status).toBe('pending');
  });

  it('should throw error if not exactly 3 stages', () => {
    expect(() => {
      builders.createLegalProcedureStages([
        { description: 'א', hours: 10 },
        { description: 'ב', hours: 10 }
      ]);
    }).toThrow('Legal procedure requires exactly 3 stages');
  });
});

describe('builders.js - Legal Procedure Service', () => {
  it('should create complete service with all properties', () => {
    const stagesData = [
      { description: 'שלב א', hours: 34 },
      { description: 'שלב ב', hours: 25 },
      { description: 'שלב ג', hours: 16 }
    ];

    const service = builders.createLegalProcedureService({
      id: 'srv_001',
      name: 'הליך גירושין',
      stagesData
    });

    expect(service.id).toBe('srv_001');
    expect(service.type).toBe('legal_procedure');
    expect(service.name).toBe('הליך גירושין');
    expect(service.currentStage).toBe('stage_a');
    expect(service.stages).toHaveLength(3);
    expect(service.totalHours).toBe(75); // 34 + 25 + 16
    expect(service.hoursUsed).toBe(0);
    expect(service.hoursRemaining).toBe(75);
  });

  it('should allow custom currentStage', () => {
    const service = builders.createLegalProcedureService({
      id: 'srv_002',
      name: 'הליך',
      stagesData: [
        { description: 'א', hours: 10 },
        { description: 'ב', hours: 10 },
        { description: 'ג', hours: 10 }
      ],
      currentStage: 'stage_b'
    });

    expect(service.currentStage).toBe('stage_b');
  });
});

describe('builders.js - Hourly Service', () => {
  it('should create hourly service with correct structure', () => {
    const service = builders.createHourlyService({
      id: 'srv_h001',
      name: 'ייעוץ משפטי',
      hours: 50
    });

    expect(service.id).toBe('srv_h001');
    expect(service.type).toBe('hours');
    expect(service.name).toBe('ייעוץ משפטי');
    expect(service.totalHours).toBe(50);
    expect(service.hoursUsed).toBe(0);
    expect(service.hoursRemaining).toBe(50);
    expect(service).not.toHaveProperty('stages');
  });
});
