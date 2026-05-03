/**
 * Unit Tests - Deduction Calculators
 * Tests for all calculation functions
 */

import { describe, it, expect } from 'vitest';

import {
  calculateRemainingHours,
  calculateTotalHours,
  calculateHoursUsed
} from '../../../apps/user-app/src/modules/deduction/calculators.js';

describe('Deduction Calculators - calculateRemainingHours', () => {
  it('should calculate remaining hours from active packages', () => {
    const service = {
      packages: [
        { status: 'active', hoursRemaining: 20 },
        { status: 'depleted', hoursRemaining: 0 },
        { status: 'active', hoursRemaining: 15 }
      ]
    };

    const result = calculateRemainingHours(service);
    expect(result).toBe(35);
  });

  it('should handle packages without status as active', () => {
    const service = {
      packages: [
        { hoursRemaining: 10 }, // No status = active
        { status: 'active', hoursRemaining: 5 }
      ]
    };

    const result = calculateRemainingHours(service);
    expect(result).toBe(15);
  });

  it('should fallback to legacy hoursRemaining when no packages', () => {
    const oldCase = {
      hoursRemaining: 50
    };

    const result = calculateRemainingHours(oldCase);
    expect(result).toBe(50);
  });

  it('should return 0 for null entity', () => {
    const result = calculateRemainingHours(null);
    expect(result).toBe(0);
  });

  it('should return 0 for entity with empty packages', () => {
    const service = {
      packages: []
    };

    const result = calculateRemainingHours(service);
    expect(result).toBe(0);
  });
});

describe('Deduction Calculators - calculateTotalHours', () => {
  it('should calculate total hours from all packages', () => {
    const service = {
      packages: [
        { hours: 50, hoursRemaining: 20 },
        { hours: 30, hoursRemaining: 0 }
      ]
    };

    const result = calculateTotalHours(service);
    expect(result).toBe(80);
  });

  it('should fallback to totalHours when no packages', () => {
    const service = {
      totalHours: 100
    };

    const result = calculateTotalHours(service);
    expect(result).toBe(100);
  });
});

describe('Deduction Calculators - calculateHoursUsed', () => {
  it('should calculate hours used from all packages', () => {
    const service = {
      packages: [
        { hours: 50, hoursUsed: 30 },
        { hours: 30, hoursUsed: 30 }
      ]
    };

    const result = calculateHoursUsed(service);
    expect(result).toBe(60);
  });
});

