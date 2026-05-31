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
exports.getEmployeeCost = void 0;
exports.getEmployeeCostHandler = getEmployeeCostHandler;
/**
 * getEmployeeCost — Pre-H.0.0.G (admin-gated read of per-employee cost-per-hour)
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-side API for the CF-only `employee_costs/{email}` collection. Because the
 * collection is `allow read, write: if false` (no client SDK access), this
 * callable is the ONLY way to read a cost — including for `setEmployeeCost`'s own
 * round-trip and the future H.2 cost-stamping consumer.
 *
 * ─── Design contract (Pre-H.0.0.G checkpoint) ──────────────────────────────
 *  1. v2 `onCall` — handler exported separately for direct unit testing.
 *  2. Dual-shape admin gate — `claims.role==='admin' || claims.admin===true`.
 *  3. NO self-read carve-out — an employee may NOT read their own cost. The gate
 *     is admin-only with no `targetEmail === caller.email` exception. An
 *     employee's internal cost-rate is confidential HR data (security req #4 /
 *     MASTER_PLAN §7.6 "NOT exposed to employee self").
 *  4. Read-only — no audit entry (audit is for mutations; reads get a logger
 *     line only, WITHOUT the cost value — PII discipline).
 *
 * Consumer note: H.2 (cost foundation) will add a shared `resolveEmployeeCost`
 * helper for the timesheet-trigger path; that is deferred to H.2 (YAGNI now).
 * This callable is the admin-facing read.
 */
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const employee_cost_1 = require("./schemas/employee-cost");
const logger = __importStar(require("../shared/logger"));
/**
 * Internal handler — exported separately for direct unit testing.
 */
async function getEmployeeCostHandler(request) {
    // ─── (1) Auth gate ─────────────────────────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
    }
    const claims = (request.auth.token ?? {});
    const isAdmin = claims.role === 'admin' || claims.admin === true;
    // NO self-read carve-out — admin-only, even for one's own cost.
    if (!isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'רק מנהל מערכת רשאי לצפות בעלות עובד.');
    }
    const callerUid = request.auth.uid;
    // ─── (2) Input validation (Zod, strict) ───────────────────────────────────
    const parsed = employee_cost_1.getEmployeeCostInputSchema.safeParse(request.data);
    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        const fieldPath = firstIssue?.path?.join('.') ?? 'unknown';
        logger.warn('employee_cost.get.invalid_input', {
            actor: { uid: callerUid },
            issueField: fieldPath
        });
        throw new https_1.HttpsError('invalid-argument', `נתונים לא תקינים: שדה "${fieldPath}". אנא ודא שהפרטים תקינים ונסה שוב.`);
    }
    const input = parsed.data;
    const email = input.email; // already lowercased by schema transform
    // ─── (3) Read the cost doc ─────────────────────────────────────────────────
    const db = admin.firestore();
    const snap = await db.collection(employee_cost_1.EMPLOYEE_COSTS_COLLECTION).doc(email).get();
    if (!snap.exists) {
        logger.info('employee_cost.get.not_found', {
            actor: { uid: callerUid }
        });
        throw new https_1.HttpsError('not-found', 'לא נמצאה עלות מוגדרת לעובד זה.');
    }
    const data = snap.data() ?? {};
    // ─── (4) Read log (NO cost value — PII) + return ──────────────────────────
    logger.info('employee_cost.get.success', {
        actor: { uid: callerUid }
        // costPerHour + email intentionally omitted from Cloud Logging (PII).
    });
    return {
        success: true,
        email,
        costPerHour: data.costPerHour,
        currency: data.currency,
        source: data.source,
        validFrom: data.validFrom ?? null,
        validUntil: data.validUntil ?? null
    };
}
// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
exports.getEmployeeCost = (0, https_1.onCall)({ region: 'us-central1' }, getEmployeeCostHandler);
//# sourceMappingURL=get-employee-cost.js.map