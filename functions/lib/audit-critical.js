"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logCriticalAction = logCriticalAction;
exports.logCriticalActionInTxn = logCriticalActionInTxn;
/**
 * logCriticalAction — canonical audit-FIRST primitive (Pre-H.0.0.C)
 * ─────────────────────────────────────────────────────────────────────────────
 * Canonical helper for write paths that REQUIRE the audit doc to land before
 * the mutation. If the audit write fails, the helper throws and the caller
 * aborts the mutation — fail-secure by design.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 * Pre-H.0.0.B introduced a local `writeAuditOrThrow` helper duplicated across
 * `set-admin-claims.ts` and `initialize-admin-claims.ts`. The pattern is
 * needed by every future critical write path (Pre-H.0.0.D / F / G + Phase 2
 * H.2 / H.4 / H.6 / H.8). Canonicalize now to prevent duplication and drift.
 *
 * ─── Contract ────────────────────────────────────────────────────────────────
 * • Writes to Firestore `audit_log` collection with EXACT schema (matches
 *   `functions/shared/audit.js#logAction` + Pre-H.0.0.B writeAuditOrThrow).
 * • Adds `schemaVersion: 1` as the forward-compat anchor — future PRs that
 *   need optional top-level fields bump this version.
 * • On Firestore failure: emits `logger.error('audit_critical.write_failed',
 *   {actorUid, action, errorCode})` BEFORE rethrowing the raw error so the
 *   caller can inspect `error.code` for compensating logic. NEVER logs
 *   `error.message` (could leak rule paths to PUBLIC Cloud Logging — repo is
 *   PUBLIC and Cloud Logging is admin-readable but world-discoverable by
 *   role enumeration).
 * • Does NOT auto-emit a success log — callers log success contextually
 *   (e.g. `admin_claims.set.success`).
 *
 * ─── Two exports (Type-safety) ───────────────────────────────────────────────
 * Devils-advocate Attack #2 (Pre-H.0.0.C planning): a single export with an
 * optional `txn?` parameter invites callers to pass `txn` to compensating-
 * audit writes — which would roll back on transaction abort, losing the
 * failure record. We split into TWO exports so the type system enforces
 * the semantic:
 *   - `logCriticalAction(action, actorUid, payload)` — non-transactional;
 *     safe for compensating audits and any write outside a Firestore
 *     transaction.
 *   - `logCriticalActionInTxn(txn, action, actorUid, payload)` — only when
 *     the caller has an active transaction. Pre-allocates the doc ref via
 *     `collection.doc()` so the id can be returned synchronously.
 *
 * ─── PII policy (G7) ─────────────────────────────────────────────────────────
 * The `payload` parameter is a free-form `Record<string, unknown>` for
 * forward flexibility. Callers MUST observe the following:
 *   ✅ ALLOWED: actor UID, target UID, claim shapes, doc IDs, error codes,
 *      action-specific business identifiers (e.g. `salesRecordId`,
 *      `serviceId`, `clientCaseNumber`).
 *   ⚠️ DISCOURAGED: target email, phone, full name. Permitted ONLY when the
 *      action key explicitly requires email-based correlation (e.g.
 *      `INIT_ADMIN_CLAIM` uses email because the employee doc join key is
 *      email). Prefer target UIDs when available.
 *   ❌ FORBIDDEN: passwords, tokens, JWTs, raw stack traces, full HTTP
 *      request bodies, customer credit-card data.
 * The audit_log collection is admin-read per firestore.rules but the repo
 * is PUBLIC — any future CI log of a payload leaks to the world. Logger
 * output (firebase-functions/logger) goes to Cloud Logging which Haim/Guy
 * + any future GCP IAM grantee can read.
 *
 * ─── Actor UID validation ────────────────────────────────────────────────────
 * Devils-advocate Attack #3: a hard length-≥20 check rejects emulator UIDs
 * and (more importantly) future system-actor identifiers used by triggers,
 * crons, and scheduled functions. Replaced with:
 *   - Empty string / non-string / whitespace → reject.
 *   - `sys:`-prefix system actors → must match `/^sys:[a-z][a-z0-9-]{2,60}$/`
 *     (e.g. `sys:cron-sync-role-claims`, `sys:trigger-cost-stamp`).
 *   - Otherwise → must match `/^[\w-]{6,128}$/` (Firebase Auth UID shape).
 *
 * ─── Schema version (forward-compat) ─────────────────────────────────────────
 * Every audit doc includes `schemaVersion: 1`. Future schema additions
 * (e.g. `correlationId` for H.8 BigQuery joins) bump this to 2 and document
 * the change in `docs/ENGINEERING_BAR.md` audit-pattern section. Consumers
 * filter by `schemaVersion` to avoid reading mismatched docs.
 */
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("../shared/logger"));
// ─── Constants ──────────────────────────────────────────────────────────────
const AUDIT_COLLECTION = 'audit_log';
/** Current audit doc schema version. Bump when adding top-level fields. */
const SCHEMA_VERSION = 1;
// ─── Actor UID validation ───────────────────────────────────────────────────
const SYSTEM_ACTOR_PATTERN = /^sys:[a-z][a-z0-9-]{2,60}$/;
const HUMAN_ACTOR_PATTERN = /^[\w-]{6,128}$/;
/**
 * Validates that `actorUid` is a non-empty string matching either the human
 * UID pattern OR the system-actor `sys:` prefix convention. Throws if not.
 *
 * Centralized so both `logCriticalAction` and `logCriticalActionInTxn`
 * apply the same check — DRY + audit-log integrity guarantee.
 */
function validateActorUid(actorUid) {
    if (typeof actorUid !== 'string' || actorUid.trim().length === 0) {
        throw new Error('logCriticalAction: actorUid must be a non-empty string ' +
            '(human Firebase Auth UID OR sys:<name> for system actors)');
    }
    if (actorUid.startsWith('sys:')) {
        if (!SYSTEM_ACTOR_PATTERN.test(actorUid)) {
            throw new Error(`logCriticalAction: invalid system actor "${actorUid}" — ` +
                'must match sys:<name> where <name> is lowercase letters/digits/hyphens, ' +
                '3-61 chars, starting with a letter');
        }
        return;
    }
    if (!HUMAN_ACTOR_PATTERN.test(actorUid)) {
        throw new Error(`logCriticalAction: invalid actorUid "${actorUid}" — ` +
            'must be 6-128 chars matching [A-Za-z0-9_-] OR sys:<name>');
    }
}
/**
 * Builds the canonical audit doc shape from inputs. Pure function — exposed
 * for tests that want to assert on the exact shape without round-tripping
 * through Firestore.
 */
function buildAuditDoc(action, actorUid, payload) {
    return {
        action,
        userId: actorUid,
        username: null,
        details: payload,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: null,
        ipAddress: null,
        schemaVersion: SCHEMA_VERSION
    };
}
// ─── Public API ─────────────────────────────────────────────────────────────
/**
 * Writes an audit_log entry and throws on failure. Use BEFORE any state
 * mutation (claim grant, schema change, financial write, etc.) — if this
 * throws, abort the mutation.
 *
 * For compensating audits (writing a failure record AFTER a mutation failed),
 * call this NON-transactional variant — compensating audits MUST survive
 * mutation rollback.
 *
 * @param action stable identifier — e.g. 'SET_ADMIN_CLAIM', 'DELETE_CLIENT'.
 * @param actorUid human Firebase Auth UID (6-128 chars) OR sys:<name>.
 * @param payload free-form details. See PII policy in file header.
 * @returns the auto-generated audit doc id.
 * @throws if validation fails OR Firestore write fails.
 */
async function logCriticalAction(action, actorUid, payload) {
    validateActorUid(actorUid);
    const db = admin.firestore();
    const doc = buildAuditDoc(action, actorUid, payload);
    try {
        const docRef = await db.collection(AUDIT_COLLECTION).add(doc);
        return docRef.id;
    }
    catch (err) {
        const error = err;
        // Intentionally NO error.message — could leak rule paths to Cloud Logging.
        logger.error('audit_critical.write_failed', {
            actorUid,
            action,
            errorCode: error.code
        });
        throw err;
    }
}
/**
 * Transactional variant. Writes the audit doc as part of a Firestore
 * transaction. Pre-allocates the doc ref via `collection.doc()` so the id
 * is known before the transaction commits.
 *
 * Use this ONLY when you need the audit + mutation to commit atomically.
 * Do NOT use for compensating audits (those must survive rollback — use
 * the non-transactional variant).
 *
 * @param txn active Firestore transaction.
 * @param action stable identifier.
 * @param actorUid human UID OR sys:<name>.
 * @param payload free-form details. See PII policy.
 * @returns the pre-allocated audit doc id (valid once the transaction commits).
 * @throws if validation fails. Firestore write failures surface when txn commits.
 */
function logCriticalActionInTxn(txn, action, actorUid, payload) {
    validateActorUid(actorUid);
    const db = admin.firestore();
    const docRef = db.collection(AUDIT_COLLECTION).doc();
    const doc = buildAuditDoc(action, actorUid, payload);
    txn.set(docRef, doc);
    return docRef.id;
}
//# sourceMappingURL=audit-critical.js.map