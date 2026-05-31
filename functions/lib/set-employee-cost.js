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
exports.setEmployeeCost = void 0;
exports.setEmployeeCostHandler = setEmployeeCostHandler;
/**
 * setEmployeeCost — Pre-H.0.0.G (admin-gated write of per-employee cost-per-hour)
 * ─────────────────────────────────────────────────────────────────────────────
 * Writes/overwrites `employee_costs/{email}` (single-doc model). Cost-per-hour
 * is sourced from the external accountant. SENSITIVE FINANCIAL PII.
 *
 * ─── Design contract (mirrors set-admin-claims.ts; Pre-H.0.0.G checkpoint) ──
 *  1. v2 `onCall` — handler exported separately for direct unit testing.
 *  2. Dual-shape admin gate — `claims.role==='admin' || claims.admin===true`.
 *     (The legacy `admin:true` branch dies after Pre-H.0.0.E retires it; G is on
 *     E's consumer-sweep list.)
 *  3. Zod `.strict()` input validation `{email, costPerHour, currency?,
 *     validFrom?, source?}`.
 *  4. Email normalized to lowercase ONCE — the SAME key is used for the
 *     employees-existence check AND the cost write, so they can never address
 *     different docs (devils-advocate Attack #1).
 *  5. Existence proof — the `employees/{email}` doc must exist (not-found else).
 *  6. Audit-FIRST via `logCriticalAction('SET_EMPLOYEE_COST', ...)` BEFORE the
 *     write. If audit fails, the cost is NOT written (fail-secure). Compensating
 *     audit on write failure.
 *  7. PII discipline — cost figures go in the audit_log payload (admin-read,
 *     forensic necessity) but NEVER in `logger.*`. `updatedBy` = admin UID.
 *
 * ⚠️ audit_log now carries salary-adjacent PII for SET_EMPLOYEE_COST. The H.8
 *    BigQuery export (MASTER_PLAN §8.11) MUST redact these details.
 */
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const employee_cost_1 = require("./schemas/employee-cost");
const audit_critical_1 = require("./audit-critical");
const logger = __importStar(require("../shared/logger"));
const EMPLOYEES_COLLECTION = 'employees';
/**
 * Internal handler — exported separately so tests invoke it without the v2
 * wrapping + region routing.
 */
async function setEmployeeCostHandler(request) {
    // ─── (1) Auth gate ─────────────────────────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
    }
    const claims = (request.auth.token ?? {});
    const isAdmin = claims.role === 'admin' || claims.admin === true;
    if (!isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'רק מנהל מערכת רשאי לעדכן עלות עובד.');
    }
    const callerUid = request.auth.uid;
    // ─── (2) Input validation (Zod, strict) ───────────────────────────────────
    const parsed = employee_cost_1.setEmployeeCostInputSchema.safeParse(request.data);
    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        const fieldPath = firstIssue?.path?.join('.') ?? 'unknown';
        logger.warn('employee_cost.set.invalid_input', {
            actor: { uid: callerUid },
            issueField: fieldPath
            // NOTE: never log the cost value or the email here (PII discipline).
        });
        throw new https_1.HttpsError('invalid-argument', `נתונים לא תקינים: שדה "${fieldPath}". אנא ודא שהפרטים תקינים ונסה שוב.`);
    }
    const input = parsed.data;
    // email is already lowercased by the schema's .toLowerCase() transform.
    const email = input.email;
    const db = admin.firestore();
    // ─── (3) Existence proof — employee must exist (same key as the write) ────
    const employeeRef = db.collection(EMPLOYEES_COLLECTION).doc(email);
    const employeeSnap = await employeeRef.get();
    if (!employeeSnap.exists) {
        logger.warn('employee_cost.set.employee_not_found', {
            actor: { uid: callerUid }
            // email omitted from logs (PII)
        });
        throw new https_1.HttpsError('not-found', 'העובד המבוקש לא נמצא במערכת. ודא שכתובת המייל תקינה ונסה שוב.');
    }
    // ─── (4) Read previous cost (for the audit trail) ─────────────────────────
    const costRef = db.collection(employee_cost_1.EMPLOYEE_COSTS_COLLECTION).doc(email);
    const previousSnap = await costRef.get();
    const previousCost = previousSnap.exists
        ? (previousSnap.data()?.costPerHour ?? null)
        : null;
    // ─── (5) Audit FIRST — if this fails, the cost is NOT written ─────────────
    // Cost figures live here (admin-read audit_log) for forensic completeness.
    // NEVER in logger.* (Cloud Logging). See file header + Attack #3.
    let auditDocId;
    try {
        auditDocId = await (0, audit_critical_1.logCriticalAction)('SET_EMPLOYEE_COST', callerUid, {
            targetEmail: email,
            previousCost,
            newCost: input.costPerHour,
            currency: input.currency,
            source: input.source
        });
    }
    catch (err) {
        const error = err;
        logger.error('employee_cost.set.audit_write_failed', {
            actor: { uid: callerUid },
            errorCode: error.code
        });
        throw new https_1.HttpsError('internal', 'שגיאה בכתיבת לוג ביקורת. העלות לא נשמרה. אנא נסה שוב מאוחר יותר או פנה לתמיכה.');
    }
    // ─── (6) Write the cost doc (overwrite — single-doc model) ────────────────
    const validFrom = input.validFrom
        ? admin.firestore.Timestamp.fromDate(new Date(input.validFrom))
        : admin.firestore.FieldValue.serverTimestamp();
    try {
        await costRef.set({
            email,
            costPerHour: input.costPerHour,
            currency: input.currency,
            validFrom,
            validUntil: null, // single-doc = always the current rate
            updatedBy: callerUid, // admin UID, never email
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            source: input.source,
            schemaVersion: employee_cost_1.EMPLOYEE_COST_SCHEMA_VERSION
        });
    }
    catch (err) {
        const error = err;
        logger.error('employee_cost.set.write_failed', {
            actor: { uid: callerUid },
            auditDocId,
            errorCode: error.code
        });
        // Compensating audit — the SET audit said "changed" but the write failed.
        try {
            await (0, audit_critical_1.logCriticalAction)('SET_EMPLOYEE_COST_FAILED', callerUid, {
                targetEmail: email,
                originalAuditDocId: auditDocId,
                errorCode: error.code
            });
        }
        catch {
            logger.error('employee_cost.set.compensating_audit_failed', {
                actor: { uid: callerUid },
                auditDocId
            });
        }
        throw new https_1.HttpsError('internal', 'שגיאה בשמירת עלות העובד. הנתון לא נשמר. אנא נסה שוב או פנה לתמיכה עם מזהה האירוע.');
    }
    // ─── (7) Success log (NO cost value — PII) + return ───────────────────────
    logger.info('employee_cost.set.success', {
        actor: { uid: callerUid },
        auditDocId
        // costPerHour + email intentionally omitted from Cloud Logging (PII).
    });
    return {
        success: true,
        email,
        costPerHour: input.costPerHour,
        currency: input.currency,
        auditDocId
    };
}
// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
exports.setEmployeeCost = (0, https_1.onCall)({ region: 'us-central1' }, setEmployeeCostHandler);
//# sourceMappingURL=set-employee-cost.js.map