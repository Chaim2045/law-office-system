/**
 * config — typed constants (Phase 2 H.0)
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure deterministic accessors; no mocks needed. Locks the project IDs, region,
 * secret name, and dataset so a typo can't silently retarget the cross-project
 * bridge at the wrong project.
 */
import {
  MAIN_PROJECT_ID,
  TOFES_MECHER_PROJECT_ID,
  REGION,
  TOFES_MECHER_SA_KEY_SECRET,
  TOFES_MECHER_APP_NAME,
  TOFES_SALES_COLLECTION,
  BIGQUERY_DATASET
} from '../config';

describe('config — cross-project constants', () => {
  it('MAIN project id is the law-office-system project', () => {
    expect(MAIN_PROJECT_ID).toBe('law-office-system-e4801');
  });

  it('tofes-mecher project id is the separate sales-form project', () => {
    expect(TOFES_MECHER_PROJECT_ID).toBe('law-office-sales-form');
    // The two projects MUST differ — a cross-project bridge to itself is a bug.
    expect(TOFES_MECHER_PROJECT_ID).not.toBe(MAIN_PROJECT_ID);
  });

  it('region matches the existing callables', () => {
    expect(REGION).toBe('us-central1');
  });

  it('secret name is stable (referenced by firebase functions:secrets:set)', () => {
    expect(TOFES_MECHER_SA_KEY_SECRET).toBe('TOFES_MECHER_SA_KEY');
  });

  it('named app + dataset names are stable', () => {
    expect(TOFES_MECHER_APP_NAME).toBe('tofes-mecher');
    expect(BIGQUERY_DATASET).toBe('law_office_analytics');
  });

  it('sales collection is the VERIFIED tofes-mecher sales_records (probe 2026-06-01)', () => {
    // ✅ VERIFIED 2026-06-01 read-only schema probe against law-office-sales-form
    // (PHASE_2_FOUNDATIONS "✅ VERIFIED"). Pin the exact name so a typo cannot
    // silently retarget the H.1 bridge at a non-existent collection.
    expect(TOFES_SALES_COLLECTION).toBe('sales_records');
  });
});
