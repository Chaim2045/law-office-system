/**
 * config — typed environment + project constants (Phase 2 H.0)
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for cross-project identifiers, region, secret names,
 * and the BigQuery dataset name. Introduced in H.0 (the tofes-mecher bridge
 * foundation) to DRY the scattered `region: 'us-central1'` literals and to give
 * the cross-project code a typed, greppable home.
 *
 * ─── Why hardcoded consts (not env vars) ────────────────────────────────────
 * Project IDs and the region are DEPLOY-TARGET IDENTIFIERS, not secrets. They
 * are already public throughout the repo (firebase.json, netlify config). Making
 * them env-driven would add a failure mode (missing/typo'd env var) for zero
 * security benefit — a project ID is not a credential. The actual credential
 * (the tofes-mecher service-account key) lives ONLY in GCP Secret Manager,
 * referenced here by its NAME, never its value (see TOFES_MECHER_SA_KEY_SECRET).
 *
 * ─── Scope note (H.0) ───────────────────────────────────────────────────────
 * H.0 establishes this module for NEW cross-project code. It does NOT refactor
 * the ~5 existing JS modules that hardcode 'us-central1' — that would be scope
 * creep. Existing callables keep their literals; new code imports from here.
 */

/** The MAIN Firebase project (this app). Public; already in firebase.json. */
export const MAIN_PROJECT_ID = 'law-office-system-e4801';

/**
 * The tofes-mecher Firebase project (system-of-record for sales transactions).
 * A SEPARATE project; this app reads it via a cross-project service account.
 * Public identifier — NOT a secret.
 */
export const TOFES_MECHER_PROJECT_ID = 'law-office-sales-form';

/** Cloud Functions region. Matches all existing callables. */
export const REGION = 'us-central1';

/**
 * Name of the GCP Secret Manager secret holding the tofes-mecher service-account
 * key JSON. The VALUE is never in code/repo — set by an admin via
 * `firebase functions:secrets:set TOFES_MECHER_SA_KEY` BEFORE deploy.
 * See docs/PHASE_2_FOUNDATIONS.md.
 */
export const TOFES_MECHER_SA_KEY_SECRET = 'TOFES_MECHER_SA_KEY';

/**
 * The named firebase-admin app for tofes-mecher. Used to retrieve the second
 * app instance (the default unnamed app remains the MAIN project).
 */
export const TOFES_MECHER_APP_NAME = 'tofes-mecher';

/**
 * tofes-mecher Firestore collection holding sales records.
 *
 * ✅ VERIFIED 2026-06-01 (read-only schema probe against the live
 * `law-office-sales-form` project — field names + types only, ZERO PII values):
 * the collection IS exactly `sales_records` — top-level, flat documents with
 * Firestore auto-ids. The earlier H.0 `UNVERIFIED` caveat is resolved; the probe
 * confirmed the assumed const was correct. Full verified schema (37 fields) in
 * docs/PHASE_2_FOUNDATIONS.md ("✅ VERIFIED"). The H.1 connectivity check still
 * reports `sawAtLeastOneDoc` separately from `reachable`, so an empty/early
 * collection is never misread as an unreachable-project failure.
 */
export const TOFES_SALES_COLLECTION = 'sales_records';

/**
 * BigQuery dataset (in the MAIN project) for the Pattern-D analytical export.
 * H.0 documents the schema; the dataset is created by an admin in the Console;
 * the export CODE lands in H.1. See docs/PHASE_2_FOUNDATIONS.md.
 */
export const BIGQUERY_DATASET = 'law_office_analytics';

/**
 * Name of the GCP Secret Manager secret holding the Anthropic (Claude) API key,
 * used by the H.5 signature-presence check (and reused by H.8 AI chat). The VALUE
 * is NEVER in code/repo — set by an admin via
 * `firebase functions:secrets:set ANTHROPIC_API_KEY` BEFORE the next deploy
 * (a `defineSecret` that is unset at deploy time fails the WHOLE functions
 * codebase deploy — same landmine class as TOFES_MECHER_SA_KEY). See
 * docs/PHASE_2_FOUNDATIONS.md "ANTHROPIC_API_KEY".
 */
export const ANTHROPIC_API_KEY_SECRET = 'ANTHROPIC_API_KEY';

/**
 * Claude model for the H.5 signature-presence vision check. Opus 4.8 is the
 * vision/document-capable default (the claude-api skill mandate). Centralized
 * here so the model can be retuned (e.g. to a cheaper Sonnet for cost) without
 * touching the handler. Use ONLY exact model-id strings (no date suffix).
 */
export const SIGNATURE_CHECK_MODEL = 'claude-opus-4-8';

/**
 * Max output tokens for the signature check. The response is a tiny structured
 * object ({2 booleans, confidence, a 1-2 sentence Hebrew reasoning}). 2048 gives
 * headroom so a dense Hebrew reasoning + the JSON envelope are NOT truncated (a
 * `max_tokens` cut-off would yield invalid JSON → a failed check; devils-advocate
 * #2). Still trivial cost, and non-streaming is safe at this size (no timeout).
 */
export const SIGNATURE_CHECK_MAX_TOKENS = 2048;

/**
 * Confidence floor (0..1) at which BOTH-signatures-present is treated as a
 * deterministic `passed: true` for the H.6 cutover gate. The model returns its
 * own confidence; H.5 derives `passed = clientPresent && lawyerPresent &&
 * confidence >= this`. Centralized so the gate policy is one tunable constant.
 */
export const SIGNATURE_CONFIDENCE_THRESHOLD = 0.8;

/**
 * BigQuery table (within BIGQUERY_DATASET) holding the synced sales_records
 * mirror. Created by the H.1.c exporter (create-if-not-exists); H.0 created only
 * the empty dataset. The `raw_json` whole-doc column documented in H.0 was OMITTED
 * in H.1.c (security default-deny — see docs/PHASE_2_FOUNDATIONS.md), so the table
 * is the 19 typed columns only.
 */
export const BIGQUERY_SALES_TABLE = 'sales_records';
