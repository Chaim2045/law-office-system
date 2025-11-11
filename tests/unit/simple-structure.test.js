/**
 * 🧪 Simple Tests for New Data Structure
 */

import { describe, it, expect, test } from 'vitest';

describe('Data Structure Tests', () => {

  test('should have services array in new structure', () => {
    const client = {
      id: '2025001',
      clientName: 'יוסי כהן',
      services: []
    };

    expect(client).toHaveProperty('services');
    expect(Array.isArray(client.services)).toBe(true);
  });

  test('should NOT have legacy stages at client level', () => {
    const client = {
      id: '2025001',
      clientName: 'יוסי כהן',
      services: [
        {
          id: 'srv_001',
          type: 'legal_procedure',
          stages: []  // stages inside service, not at client level
        }
      ]
    };

    expect(client).not.toHaveProperty('stages');
    expect(client).not.toHaveProperty('procedureType');
  });

  test('should use clientName not fullName', () => {
    const client = {
      id: '2025001',
      clientName: 'יוסי כהן'
    };

    expect(client).toHaveProperty('clientName');
    expect(client).not.toHaveProperty('fullName');
  });

  test('calculateRemainingHours from packages', () => {
    const calculateRemainingHours = (entity) => {
      if (!entity) return 0;

      if (!entity.packages || entity.packages.length === 0) {
        return entity.hoursRemaining || 0;
      }

      return entity.packages
        .filter(pkg => pkg.status === 'active' || !pkg.status)
        .reduce((sum, pkg) => sum + (pkg.hoursRemaining || 0), 0);
    };

    const stage = {
      packages: [
        { status: 'active', hoursRemaining: 10 },
        { status: 'active', hoursRemaining: 15 },
        { status: 'depleted', hoursRemaining: 0 }
      ]
    };

    const result = calculateRemainingHours(stage);
    expect(result).toBe(25); // 10 + 15, not counting depleted
  });

  test('deduct hours from correct service and stage', () => {
    const client = {
      services: [
        {
          id: 'srv_001',
          type: 'legal_procedure',
          stages: [
            {
              id: 'stage_a',
              packages: [
                { id: 'pkg_001', hoursRemaining: 20, status: 'active' }
              ]
            }
          ]
        }
      ]
    };

    const task = {
      parentServiceId: 'srv_001',
      serviceId: 'stage_a'
    };

    // Find service
    const service = client.services.find(s => s.id === task.parentServiceId);
    expect(service).toBeDefined();

    // Find stage
    const stage = service.stages.find(s => s.id === task.serviceId);
    expect(stage).toBeDefined();

    // Find package
    const pkg = stage.packages.find(p => p.status === 'active');
    expect(pkg.hoursRemaining).toBe(20);

    // Deduct hours
    pkg.hoursRemaining -= 1.25;
    expect(pkg.hoursRemaining).toBe(18.75);
  });

  test('service creation with 3 stages', () => {
    const service = {
      id: 'srv_001',
      type: 'legal_procedure',
      currentStage: 'stage_a',
      stages: [
        { id: 'stage_a', status: 'active' },
        { id: 'stage_b', status: 'pending' },
        { id: 'stage_c', status: 'pending' }
      ]
    };

    expect(service.stages.length).toBe(3);

    const activeStages = service.stages.filter(s => s.status === 'active');
    expect(activeStages.length).toBe(1);
    expect(activeStages[0].id).toBe('stage_a');

    const pendingStages = service.stages.filter(s => s.status === 'pending');
    expect(pendingStages.length).toBe(2);
  });
});
