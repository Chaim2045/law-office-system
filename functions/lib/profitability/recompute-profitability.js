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
exports.recomputeProfitability = exports.recomputeProfitabilityInputSchema = void 0;
exports.recomputeProfitabilityHandler = recomputeProfitabilityHandler;
/**
 * recomputeProfitability — Phase 2 H.3 PR3 (admin||partner on-demand recompute)
 * ─────────────────────────────────────────────────────────────────────────────
 * The "refresh now" path: recomputes ONE case's Forecast immediately instead of
 * waiting for the daily scheduled `aggregateClientProfitability` run (Haim
 * checkpoint 2026-06-14: daily scheduled writer + this on-demand callable). The
 * PR4 dashboard calls it on open / on a refresh button; its onSnapshot listener
 * then sees the fresh write.
 *
 * ─── Design contract ────────────────────────────────────────────────────────
 *  1. v2 `onCall`; handler exported separately for direct unit testing.
 *  2. D-E gate — `claims.role === 'admin' || claims.role === 'partner'` (dormant
 *     partner consumer; resolves admin-only today; fail-secure).
 *  3. Zod `.strict()` input `{ caseNumber: /^\d{7}$/ }`.
 *  4. This MUTATES `client_profitability/{caseNumber}` → AUDIT-FIRST via
 *     logCriticalAction (the mutation aborts if the audit write fails). The
 *     payload is non-PII (caseNumber only — never cost values).
 *  5. Returns `{ found:false }` (not a throw) when the case doesn't exist, so the
 *     dashboard renders a clean "no such case" state.
 */
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const config_1 = require("../config");
const audit_critical_1 = require("../audit-critical");
const logger = __importStar(require("../../shared/logger"));
const forecast_aggregation_1 = require("./forecast-aggregation");
/** Stable audit action (non-PII payload: caseNumber). */
const AUDIT_ACTION = 'RECOMPUTE_PROFITABILITY';
/** Input schema — strict. caseNumber is the 7-digit `clients` doc id (YYYYNNN). */
exports.recomputeProfitabilityInputSchema = zod_1.z
    .object({
    caseNumber: zod_1.z.string().regex(/^\d{7}$/, 'מספר תיק אינו תקין.')
})
    .strict();
/** Internal handler — exported separately for direct unit testing. */
async function recomputeProfitabilityHandler(request) {
    // ─── (1) Auth gate (admin || partner) ──────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
    }
    const claims = (request.auth.token ?? {});
    if (claims.role !== 'admin' && claims.role !== 'partner') {
        throw new https_1.HttpsError('permission-denied', 'רק מנהל מערכת או שותף רשאי לחשב נתוני רווחיות.');
    }
    const callerUid = request.auth.uid;
    // ─── (2) Input validation (Zod, strict) ────────────────────────────────────
    const parsed = exports.recomputeProfitabilityInputSchema.safeParse(request.data);
    if (!parsed.success) {
        const fieldPath = parsed.error.issues[0]?.path?.join('.') ?? 'caseNumber';
        logger.warn('profitability.recompute.invalid_input', {
            actor: { uid: callerUid },
            issueField: fieldPath
        });
        throw new https_1.HttpsError('invalid-argument', `נתונים לא תקינים: שדה "${fieldPath}". אנא נסה שוב.`);
    }
    const { caseNumber } = parsed.data;
    // ─── (3) Audit-FIRST (this WRITES client_profitability — a mutation) ────────
    try {
        await (0, audit_critical_1.logCriticalAction)(AUDIT_ACTION, callerUid, { caseNumber });
    }
    catch {
        throw new https_1.HttpsError('internal', 'לא ניתן לתעד את פעולת החישוב כעת. אנא נסה שוב או פנה לתמיכה.');
    }
    // ─── (4) Recompute + write ──────────────────────────────────────────────────
    let forecast;
    try {
        forecast = await (0, forecast_aggregation_1.recomputeProfitabilityForCase)(caseNumber);
    }
    catch (err) {
        const code = err.code;
        logger.error('profitability.recompute.failed', {
            actor: { uid: callerUid },
            caseNumber,
            errorCode: code
        });
        throw new https_1.HttpsError('internal', 'חישוב הרווחיות נכשל כעת. אנא נסה שוב או פנה לתמיכה.');
    }
    if (forecast === null) {
        logger.warn('profitability.recompute.client_not_found', {
            actor: { uid: callerUid },
            caseNumber
        });
        return { success: false, caseNumber, found: false };
    }
    logger.info('profitability.recompute.ok', {
        actor: { uid: callerUid },
        caseNumber
        // actualCost intentionally omitted from Cloud Logging (§7.6 PII).
    });
    return { success: true, caseNumber, found: true };
}
// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
exports.recomputeProfitability = (0, https_1.onCall)({ region: config_1.REGION }, recomputeProfitabilityHandler);
//# sourceMappingURL=recompute-profitability.js.map