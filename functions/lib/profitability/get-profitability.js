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
exports.getProfitability = exports.getProfitabilityInputSchema = void 0;
exports.getProfitabilityHandler = getProfitabilityHandler;
/**
 * getProfitability — Phase 2 H.3 PR3 (admin||partner read of a case's Forecast)
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-side API for the CF-only `client_profitability/{caseNumber}` aggregate.
 * The collection's rule is `allow read: if isAdmin() || isPartner()` (D-A), so the
 * PR4 dashboard streams the live GRID via `onSnapshot` directly. This callable is
 * the AUDITED single-case fetch (Haim checkpoint 2026-06-14: every deliberate
 * profitability fetch is logged; the live grid is not per-view audited).
 *
 * ─── Design contract ────────────────────────────────────────────────────────
 *  1. v2 `onCall`; handler exported separately for direct unit testing.
 *  2. D-E gate — `claims.role === 'admin' || claims.role === 'partner'`. The FIRST
 *     production isPartner() consumer; dormant + fail-secure (resolves admin-only
 *     today — no user holds role=='partner'). Legacy `admin:true` is NOT accepted
 *     (retired Pre-H.0.0.E).
 *  3. Zod `.strict()` input `{ caseNumber: /^\d{7}$/ }` (the 7-digit case-doc id) —
 *     the charset bound also prevents path traversal in `.doc()`.
 *  4. NON-PII access audit as a PRECONDITION for disclosure (mirrors
 *     validateSalesRecordExists): `logCriticalAction('READ_PROFITABILITY', uid,
 *     {caseNumber, found})` — if the audit write throws, the cost data is NOT
 *     returned (fail-secure). cost/profit VALUES never reach logger.*.
 *  5. Missing doc → `{ exists:false }` (NOT a throw) — the collection is empty
 *     system-wide until the aggregation job runs + costs are entered, so a
 *     throw-on-missing would make the dashboard look broken on day one.
 *  6. `actualCost` is `number | null` (null ≠ 0 — un-costed, not free).
 */
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const config_1 = require("../config");
const audit_critical_1 = require("../audit-critical");
const logger = __importStar(require("../../shared/logger"));
const forecast_aggregation_1 = require("./forecast-aggregation");
/** Stable audit action (non-PII payload: caseNumber + found). */
const AUDIT_ACTION = 'READ_PROFITABILITY';
/** Input schema — strict. caseNumber is the 7-digit `clients` doc id (YYYYNNN). */
exports.getProfitabilityInputSchema = zod_1.z
    .object({
    caseNumber: zod_1.z.string().regex(/^\d{7}$/, 'מספר תיק אינו תקין.')
})
    .strict();
/** Absent/non-finite → null (preserves the null-≠-0 contract on the wire). */
function numOrNull(v) {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
/** Firestore Timestamp → ISO 8601 string (the one transform). null if absent. */
function tsIsoOrNull(v) {
    if (v && typeof v.toDate === 'function') {
        try {
            return v.toDate().toISOString();
        }
        catch {
            return null;
        }
    }
    return null;
}
/** Internal handler — exported separately for direct unit testing. */
async function getProfitabilityHandler(request) {
    // ─── (1) Auth gate (admin || partner) ──────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
    }
    const claims = (request.auth.token ?? {});
    if (claims.role !== 'admin' && claims.role !== 'partner') {
        throw new https_1.HttpsError('permission-denied', 'רק מנהל מערכת או שותף רשאי לצפות בנתוני רווחיות.');
    }
    const callerUid = request.auth.uid;
    // ─── (2) Input validation (Zod, strict) ────────────────────────────────────
    const parsed = exports.getProfitabilityInputSchema.safeParse(request.data);
    if (!parsed.success) {
        const fieldPath = parsed.error.issues[0]?.path?.join('.') ?? 'caseNumber';
        logger.warn('profitability.get.invalid_input', {
            actor: { uid: callerUid },
            issueField: fieldPath
        });
        throw new https_1.HttpsError('invalid-argument', `נתונים לא תקינים: שדה "${fieldPath}". אנא נסה שוב.`);
    }
    const { caseNumber } = parsed.data;
    // ─── (3) Read the aggregate doc ─────────────────────────────────────────────
    const db = admin.firestore();
    let snap;
    try {
        snap = await db.collection(forecast_aggregation_1.CLIENT_PROFITABILITY_COLLECTION).doc(caseNumber).get();
    }
    catch (err) {
        const code = err.code;
        logger.error('profitability.get.read_failed', {
            actor: { uid: callerUid },
            caseNumber,
            errorCode: code
        });
        throw new https_1.HttpsError('unavailable', 'לא ניתן לטעון את נתוני הרווחיות כעת. אנא נסה שוב או פנה לתמיכה.');
    }
    const found = Boolean(snap.exists);
    // ─── (4) Non-PII access audit — PRECONDITION for disclosure (fail-secure) ───
    try {
        await (0, audit_critical_1.logCriticalAction)(AUDIT_ACTION, callerUid, { caseNumber, found });
    }
    catch {
        // logCriticalAction already emitted audit_critical.write_failed (errorCode only).
        throw new https_1.HttpsError('internal', 'לא ניתן לתעד את הגישה לנתוני הרווחיות כעת. אנא נסה שוב או פנה לתמיכה.');
    }
    // ─── (5) Not found → {exists:false} (a legitimate empty state, not an error) ─
    if (!found) {
        logger.info('profitability.get.not_found', {
            actor: { uid: callerUid },
            caseNumber
        });
        return { exists: false, caseNumber };
    }
    // ─── (6) Found → typed projection (cost VALUE never logged) ─────────────────
    const data = snap.data() ?? {};
    logger.info('profitability.get.found', {
        actor: { uid: callerUid },
        caseNumber
        // actualCost / profit intentionally omitted from Cloud Logging (§7.6 PII).
    });
    return {
        exists: true,
        caseNumber,
        actualHours: numOrNull(data.actualHours),
        actualCost: numOrNull(data.actualCost),
        costedEntryCount: numOrNull(data.costedEntryCount),
        totalEntryCount: numOrNull(data.totalEntryCount),
        unCostedCoveragePercent: numOrNull(data.unCostedCoveragePercent),
        paidRevenue: numOrNull(data.paidRevenue),
        projectedProfit: numOrNull(data.projectedProfit),
        schemaVersion: numOrNull(data.schemaVersion),
        computedAtIso: tsIsoOrNull(data.computedAt)
    };
}
// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
exports.getProfitability = (0, https_1.onCall)({ region: config_1.REGION }, getProfitabilityHandler);
//# sourceMappingURL=get-profitability.js.map