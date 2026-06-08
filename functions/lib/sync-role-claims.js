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
exports.syncRoleClaims = void 0;
exports.syncRoleClaimsHandler = syncRoleClaimsHandler;
/**
 * syncRoleClaims — Pre-H.0.0.F (role-claim reconciler + first partner-claim writer)
 * ─────────────────────────────────────────────────────────────────────────────
 * Closes Phase 1. A v2 admin-gated callable that reconciles each employee's Auth
 * custom-claim `role` to the SSOT — the `employees/{email}.role` Firestore field.
 *
 * ─── What it does ───────────────────────────────────────────────────────────
 *  - Scans the WHOLE `employees` collection.
 *  - Desired claim per employee: `admin`/`partner` (the only privilege-bearing
 *    roles) → `{role:<that>}`; ANY other role (`employee`/`lawyer`/`user`/…) →
 *    NO elevated claim (the `role` field is removed). This is what retires the 7
 *    dormant `{role:'lawyer'}` claims (§7.4) and writes the FIRST `{role:'partner'}`
 *    claims (Haim + Guy).
 *  - **read-merge-write** (shared `claim-writer`): edits ONLY the `role` field,
 *    preserving any other claim a user holds (the §7.5 no-clobber prerequisite).
 *  - DRY-RUN by default; writes only on strict `apply === true`.
 *  - Idempotent (no-drift employees are skipped — no write, no audit spam).
 *  - Lock doc (mirrors initializeAdminClaims) — serializes concurrent runs.
 *  - Audit-FIRST per employee via `logCriticalAction`; compensating audit on
 *    claim-write failure.
 *  - **messages.toRoles probe**: before any `--apply`, scans `messages` for
 *    `'partner'` (and `'lawyer'`) in `toRoles`. Writing `{role:'partner'}` grants
 *    immediate read to any such doc via `firestore.rules` dynamic membership, so
 *    a non-zero `partner` count ABORTS apply unless `ackMessagesGrant` is set.
 *
 * ─── PUBLIC-REPO SAFETY ─────────────────────────────────────────────────────
 *  - No PII in `logger.*` — `actor:{uid}`, counts only. Emails/claim values live
 *    in `audit_log` (forensic) only.
 *  - DEV and PROD share one Firebase project — `apply:true` mutates PROD Auth.
 *    The first real apply is a supervised, Haim-approved action.
 */
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const audit_critical_1 = require("./audit-critical");
const logger = __importStar(require("../shared/logger"));
// Shared read-merge-write primitives (JS module — same import style as logger).
const claim_writer_1 = require("../shared/claim-writer");
// ─── Constants ──────────────────────────────────────────────────────────────
const SYNC_LOCK_PATH = 'system/role_claims_sync_lock';
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes — long enough for a real run, short enough to recover from a crash
const MESSAGES_PROBE_LIMIT = 100; // matches verifyClaims' messages scan bound
// The ONLY privilege-bearing roles. Everything else maps to "no elevated claim".
const ELEVATED_ROLES = new Set(['admin', 'partner']);
// ─── Schema ─────────────────────────────────────────────────────────────────
const syncRoleClaimsSchema = zod_1.z.object({
    apply: zod_1.z.boolean().default(false),
    // Required acknowledgement to proceed with --apply when a `messages` doc
    // already carries 'partner' in toRoles (writing partner would grant it read).
    ackMessagesGrant: zod_1.z.boolean().default(false)
}).strict();
/**
 * Probe `messages` for roles present in `toRoles` arrays. Read-only.
 * Writing `{role:'partner'}` grants immediate read to any doc whose toRoles
 * contains 'partner' (firestore.rules dynamic membership), so `partnerCount`
 * GATES apply. `lawyerCount` is OBSERVABILITY ONLY (F removes lawyer claims —
 * a safe, access-reducing direction — so it needs no gate); it mirrors the
 * verifyClaims `messagesWithLawyerToRoles` diagnostic.
 */
async function probeMessagesToRoles(db) {
    try {
        const [partnerSnap, lawyerSnap] = await Promise.all([
            db.collection('messages').where('toRoles', 'array-contains', 'partner').limit(MESSAGES_PROBE_LIMIT).get(),
            db.collection('messages').where('toRoles', 'array-contains', 'lawyer').limit(MESSAGES_PROBE_LIMIT).get()
        ]);
        return { scanned: true, partnerCount: partnerSnap.size, lawyerCount: lawyerSnap.size, error: null };
    }
    catch (err) {
        const error = err;
        return { scanned: false, partnerCount: 0, lawyerCount: 0, error: error.message || 'unknown' };
    }
}
/**
 * Internal handler — exported separately for direct unit testing.
 */
async function syncRoleClaimsHandler(request) {
    // ─── (1) Auth gate — role-only (born after the Pre-H.0.0.E follow-up) ──────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
    }
    const callerClaims = (request.auth.token ?? {});
    if (callerClaims.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'רק מנהל מערכת רשאי לסנכרן הרשאות.');
    }
    const callerUid = request.auth.uid;
    // ─── (2) Input (Zod strict; apply defaults false) ─────────────────────────
    const parsed = syncRoleClaimsSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        const fieldPath = firstIssue?.path?.join('.') ?? 'unknown';
        logger.warn('role_claims.sync.invalid_input', { actor: { uid: callerUid }, issueField: fieldPath });
        throw new https_1.HttpsError('invalid-argument', `נתונים לא תקינים: שדה "${fieldPath}". אנא נסה שוב.`);
    }
    // Strict positive assertion — only a real boolean `true` enables writes.
    const isApply = parsed.data.apply === true;
    const ackMessagesGrant = parsed.data.ackMessagesGrant === true;
    const db = admin.firestore();
    const authSdk = admin.auth();
    // ─── (3) Acquire lock (serializes dry-run + apply for a consistent snapshot) ─
    const lockRef = db.doc(SYNC_LOCK_PATH);
    const lockSnap = await lockRef.get();
    if (lockSnap.exists) {
        const lockData = (lockSnap.data() ?? {});
        const lockedAt = lockData.lockedAt;
        const ageMs = lockedAt ? Date.now() - lockedAt.toMillis() : Number.POSITIVE_INFINITY;
        if (ageMs < LOCK_TTL_MS) {
            logger.warn('role_claims.sync.locked', { actor: { uid: callerUid }, ageMs });
            throw new https_1.HttpsError('failed-precondition', 'סנכרון הרשאות כבר רץ. אנא המתן עד 5 דקות ונסה שוב.');
        }
        logger.warn('role_claims.sync.stale_lock_overridden', { actor: { uid: callerUid }, ageMs });
    }
    await lockRef.set({ lockedAt: admin.firestore.FieldValue.serverTimestamp(), lockedBy: callerUid });
    try {
        // ─── (4) messages.toRoles probe — gates apply on partner exposure ───────
        // FAIL-SECURE: abort apply if a partner-exposed doc exists OR if the probe
        // could not verify (scanned:false). We must NOT grant partner read when we
        // cannot confirm what it would expose. `ackMessagesGrant` is the conscious
        // admin override after a manual review.
        const messagesProbe = await probeMessagesToRoles(db);
        if (isApply && !ackMessagesGrant && (messagesProbe.partnerCount > 0 || !messagesProbe.scanned)) {
            logger.warn('role_claims.sync.partner_toroles_block', {
                actor: { uid: callerUid },
                partnerCount: messagesProbe.partnerCount,
                probeScanned: messagesProbe.scanned
            });
            throw new https_1.HttpsError('failed-precondition', messagesProbe.scanned
                ? 'קיימות הודעות עם הרשאת "partner". כתיבת הרשאת שותף תעניק להן גישת קריאה. אשר מחדש עם ackMessagesGrant=true לאחר בדיקה.'
                : 'לא ניתן היה לאמת חשיפת הודעות (סריקת messages נכשלה). מטעמי בטיחות הסנכרון לא בוצע. בדוק ידנית ואשר עם ackMessagesGrant=true.');
        }
        // ─── (5) Scan ALL employees ─────────────────────────────────────────────
        const snapshot = await db.collection('employees').get();
        const results = [];
        for (const empDoc of snapshot.docs) {
            const empData = (empDoc.data() ?? {});
            // Normalize to lowercase — the system lowercases emails once (Pre-H.0.0.G),
            // so the getUserByEmail fallback must match (avoids a false "user missing").
            const email = (empData.email ?? empDoc.id).toLowerCase();
            const firestoreRole = typeof empData.role === 'string' ? empData.role : null;
            const authUidFromFirestore = empData.authUID;
            // (5a) Fail-safe: never blind-clear a claim because the source role is absent.
            if (firestoreRole === null) {
                results.push({ email, uid: null, firestoreRole: null, fromClaimRole: null, toClaimRole: null, outcome: 'skipped_no_role' });
                continue;
            }
            // (5b) Resolve auth user — prefer authUID, fall back to email.
            let userRecord;
            try {
                userRecord = authUidFromFirestore
                    ? await authSdk.getUser(authUidFromFirestore)
                    : await authSdk.getUserByEmail(email);
            }
            catch (err) {
                const error = err;
                results.push({ email, uid: null, firestoreRole, fromClaimRole: null, toClaimRole: null, outcome: 'skipped_auth_user_missing', errorCode: error.code });
                continue;
            }
            const existingClaims = (userRecord.customClaims ?? {});
            const fromClaimRole = typeof existingClaims.role === 'string' ? existingClaims.role : null;
            const desiredRole = ELEVATED_ROLES.has(firestoreRole) ? firestoreRole : null;
            // (5c) Decide the action.
            let action;
            if (desiredRole !== null) {
                action = fromClaimRole === desiredRole ? 'no_change' : 'grant';
            }
            else {
                action = fromClaimRole !== null ? 'remove' : 'no_change';
            }
            if (action === 'no_change') {
                results.push({ email, uid: userRecord.uid, firestoreRole, fromClaimRole, toClaimRole: fromClaimRole, outcome: 'no_change' });
                continue;
            }
            // read-merge-write: edit ONLY the role field, preserve everything else.
            const nextClaims = action === 'grant'
                ? (0, claim_writer_1.mergeRoleClaim)(existingClaims, desiredRole)
                : (0, claim_writer_1.removeRoleClaim)(existingClaims);
            const toClaimRole = action === 'grant' ? desiredRole : null;
            // (5d) DRY-RUN: record the plan, write nothing, audit nothing.
            if (!isApply) {
                results.push({
                    email, uid: userRecord.uid, firestoreRole, fromClaimRole, toClaimRole,
                    outcome: action === 'grant' ? 'granted' : 'removed'
                });
                continue;
            }
            // (5e) APPLY — audit FIRST, claim SECOND (fail-secure).
            try {
                await (0, audit_critical_1.logCriticalAction)('SYNC_ROLE_CLAIM', callerUid, {
                    targetUid: userRecord.uid,
                    targetEmail: email,
                    firestoreRole,
                    previousClaims: existingClaims,
                    newClaims: nextClaims,
                    action
                });
            }
            catch (err) {
                const error = err;
                logger.error('role_claims.sync.audit_failed', { actor: { uid: callerUid }, targetUid: userRecord.uid, errorCode: error.code });
                results.push({ email, uid: userRecord.uid, firestoreRole, fromClaimRole, toClaimRole, outcome: 'skipped_audit_failed', errorCode: error.code });
                continue;
            }
            try {
                await authSdk.setCustomUserClaims(userRecord.uid, nextClaims);
                results.push({ email, uid: userRecord.uid, firestoreRole, fromClaimRole, toClaimRole, outcome: action === 'grant' ? 'granted' : 'removed' });
            }
            catch (err) {
                const error = err;
                logger.error('role_claims.sync.claim_failed', { actor: { uid: callerUid }, targetUid: userRecord.uid, errorCode: error.code });
                try {
                    await (0, audit_critical_1.logCriticalAction)('SYNC_ROLE_CLAIM_FAILED', callerUid, { targetUid: userRecord.uid, errorCode: error.code });
                }
                catch {
                    // best-effort compensating audit
                }
                results.push({ email, uid: userRecord.uid, firestoreRole, fromClaimRole, toClaimRole, outcome: 'skipped_claim_failed', errorCode: error.code });
            }
        }
        // ─── (6) Tally + structured completion log (no PII) ─────────────────────
        const granted = results.filter((r) => r.outcome === 'granted').length;
        const removed = results.filter((r) => r.outcome === 'removed').length;
        const noChange = results.filter((r) => r.outcome === 'no_change').length;
        const failed = results.filter((r) => r.outcome === 'skipped_auth_user_missing' ||
            r.outcome === 'skipped_audit_failed' ||
            r.outcome === 'skipped_claim_failed' ||
            r.outcome === 'skipped_no_role').length;
        logger.info('role_claims.sync.completed', {
            actor: { uid: callerUid },
            mode: isApply ? 'apply' : 'dry-run',
            scanned: results.length,
            granted,
            removed,
            noChange,
            failed
        });
        return {
            success: true,
            mode: isApply ? 'apply' : 'dry-run',
            scanned: results.length,
            granted,
            removed,
            noChange,
            failed,
            messagesProbe,
            results
        };
    }
    finally {
        // ─── (7) Release lock — best effort ─────────────────────────────────────
        try {
            await lockRef.delete();
        }
        catch {
            logger.warn('role_claims.sync.lock_release_failed', { actor: { uid: callerUid } });
        }
    }
}
// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
exports.syncRoleClaims = (0, https_1.onCall)({ region: 'us-central1' }, syncRoleClaimsHandler);
//# sourceMappingURL=sync-role-claims.js.map