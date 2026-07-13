/**
 * Unit tests — ReportGenerator.resolveServiceHours (SSOT for client-report hours)
 *
 * Covers the over-count bug fix: a client report for a single service/stage must show
 * ONLY that service/stage's hours, never the sum of all the client's services/stages
 * (which is what the old `client.totalHours` fallback + parent-service matching produced).
 *
 * resolveServiceHours is the shared helper that renderServiceInfo, renderTimesheetRows
 * and renderFinalSummary all delegate to, so testing it covers all three report sections.
 *
 * Created: 2026-06-07 — fix/client-report-stage-scoped-hours
 */

import { describe, it, expect } from 'vitest';

// ReportGenerator.js is an IIFE that assigns the singleton to window (the happy-dom test
// environment provides window). Import for side-effect, then read the instance off window.
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/managers/ReportGenerator.js';

const reportGenerator: any = (window as any).ReportGenerator;

// --- fixtures ---------------------------------------------------------------

function legalProcedureService(overrides: any = {}) {
  return {
    id: 'svc_proc_1',
    type: 'legal_procedure',
    name: 'תביעה כספית',
    status: 'active',
    pricingType: 'hourly',
    currentStage: 'stage_a',
    // Parent-level totalHours is the SUM of all stages — this is the "all stages" trap
    // the old top-level matching fell into. The fix must NOT read this for a stage report.
    totalHours: 30,
    hoursUsed: 2,
    hoursRemaining: 28,
    stages: [
      { id: 'stage_a', name: 'שלב א', status: 'active', totalHours: 10, hoursUsed: 2, hoursRemaining: 8 },
      { id: 'stage_b', name: 'שלב ב', status: 'pending', totalHours: 20, hoursUsed: 0, hoursRemaining: 20 }
    ],
    ...overrides
  };
}

function hourPackageService(overrides: any = {}) {
  return {
    id: 'svc_pkg_1',
    type: 'hours',
    name: 'חבילת ייעוץ',
    status: 'active',
    pricingType: 'hourly',
    totalHours: 15,
    hoursUsed: 5,
    hoursRemaining: 10,
    ...overrides
  };
}

describe('resolveServiceHours — wiring', () => {
  it('is exposed as a method on the ReportGenerator singleton', () => {
    expect(reportGenerator).toBeTruthy();
    expect(typeof reportGenerator.resolveServiceHours).toBe('function');
  });
});

describe('resolveServiceHours — legal_procedure stage (the over-count bug)', () => {
  it('multi-service client: a stage-A report returns ONLY stage A, not the client-wide sum', () => {
    const client = {
      totalHours: 25, // (active stage 10 + package 15) — the inflated client aggregate
      hoursRemaining: 18, // (stage 8 + package 10)
      services: [legalProcedureService(), hourPackageService()]
    };
    const formData = { service: 'שלב א', serviceId: 'svc_proc_1', stage: 'stage_a' };

    const r = reportGenerator.resolveServiceHours(client, formData);

    expect(r.matchType).toBe('stage');
    expect(r.totalHours).toBe(10);
    expect(r.usedHours).toBe(2);
    expect(r.remainingHours).toBe(8);
    // Regression guard: the figures must NOT equal the client-wide aggregate.
    expect(r.remainingHours).not.toBe(client.hoursRemaining);
    expect(r.totalHours).not.toBe(client.totalHours);
  });

  it('does NOT read the parent service.totalHours (the sum of all stages)', () => {
    const client = { totalHours: 30, hoursRemaining: 28, services: [legalProcedureService()] };
    const r = reportGenerator.resolveServiceHours(client, { service: 'שלב א', stage: 'stage_a' });
    expect(r.totalHours).toBe(10); // stage A only, not the parent's 30
  });

  it('derives usedHours from total - remaining when stage.hoursUsed is absent', () => {
    const svc = legalProcedureService();
    delete svc.stages[0].hoursUsed;
    const client = { services: [svc] };
    const r = reportGenerator.resolveServiceHours(client, { service: 'שלב א', stage: 'stage_a' });
    expect(r.totalHours).toBe(10);
    expect(r.remainingHours).toBe(8);
    expect(r.usedHours).toBe(2); // 10 - 8
  });

  it('resolves a selected stage even when completed (shows its own numbers)', () => {
    const svc = legalProcedureService({
      currentStage: 'stage_b',
      stages: [
        { id: 'stage_a', name: 'שלב א', status: 'completed', totalHours: 10, hoursUsed: 10, hoursRemaining: 0 },
        { id: 'stage_b', name: 'שלב ב', status: 'active', totalHours: 20, hoursUsed: 3, hoursRemaining: 17 }
      ]
    });
    const r = reportGenerator.resolveServiceHours({ services: [svc] }, { service: 'שלב א', stage: 'stage_a' });
    expect(r.matchType).toBe('stage');
    expect(r.totalHours).toBe(10);
    expect(r.remainingHours).toBe(0);
  });

  it('preserves negative remaining (overdraft) for a stage in overage', () => {
    const svc = legalProcedureService({
      stages: [{ id: 'stage_a', name: 'שלב א', status: 'active', totalHours: 10, hoursUsed: 13, hoursRemaining: -3 }]
    });
    const r = reportGenerator.resolveServiceHours({ services: [svc] }, { service: 'שלב א', stage: 'stage_a' });
    expect(r.remainingHours).toBe(-3);
  });
});

describe('resolveServiceHours — hour packages (non-staged)', () => {
  it('matches an hour package by name and returns its own hours (unchanged behavior)', () => {
    const client = { totalHours: 25, hoursRemaining: 18, services: [legalProcedureService(), hourPackageService()] };
    const formData = { service: 'חבילת ייעוץ', serviceId: 'svc_pkg_1', stage: '' };
    const r = reportGenerator.resolveServiceHours(client, formData);
    expect(r.matchType).toBe('service');
    expect(r.totalHours).toBe(15);
    expect(r.usedHours).toBe(5);
    expect(r.remainingHours).toBe(10);
  });
});

describe('resolveServiceHours — no match (the safety property)', () => {
  it('returns zeros and matchType "none" — never borrows client.totalHours', () => {
    const client = { totalHours: 999, hoursRemaining: 888, services: [hourPackageService()] };
    const r = reportGenerator.resolveServiceHours(client, { service: 'שירות שלא קיים', stage: '' });
    expect(r.matchType).toBe('none');
    expect(r.totalHours).toBe(0);
    expect(r.usedHours).toBe(0);
    expect(r.remainingHours).toBe(0);
    expect(r.totalHours).not.toBe(client.totalHours);
  });

  it('handles a missing services array safely', () => {
    const r = reportGenerator.resolveServiceHours({}, { service: 'x', stage: '' });
    expect(r.matchType).toBe('none');
    expect(r.totalHours).toBe(0);
  });
});
