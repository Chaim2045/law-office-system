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
exports.connectivityCheck = void 0;
exports.connectivityCheckHandler = connectivityCheckHandler;
/**
 * tofesMecherConnectivityCheck — Phase 2 H.0 (foundation proof)
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-gated v2 callable that proves the cross-project bridge is wired:
 * Secret Manager → service-account key → named firebase-admin app →
 * ONE read of the tofes-mecher Firestore. Returns whether the project is
 * reachable and whether at least one sales record was seen.
 *
 * This is the ONLY thing that exercises the DEPLOYED secret-binding + the real
 * cross-project IAM grant — a local script cannot prove those. That is the
 * entire point of an H.0 "foundations" PR (devils-advocate #3 defense).
 *
 * ⚠️ REPURPOSE-OR-DELETE IN H.1 (devils-advocate H.0 Attack #3): after H.1
 * ships the real `validateSalesRecordExists`, this function is dead weight
 * holding a tofes-mecher secret binding. H.1 must EITHER repurpose this file
 * into the real bridge OR delete this export. Tracked in MASTER_PLAN §8.2.
 *
 * ─── Design contract ────────────────────────────────────────────────────────
 *  1. v2 `onCall` with `{ secrets: [TOFES_KEY] }` — defineSecret is v2-only.
 *  2. Role-only admin gate (`claims.role === 'admin'`; the legacy `admin:true`
 *     acceptance was retired in the Pre-H.0.0.E follow-up, 2026-06-05).
 *  3. Read-only → `logger.*`, NOT `logCriticalAction` (G3 N/A for reads;
 *     audit-on-read would invent a precedent not in the bar).
 *  4. NO PII / NO key material in any log: success logs actor uid only;
 *     failure logs actor uid + error code/name only — never the key, never the
 *     original error message/stack (which could carry a key fragment), never
 *     any sales data.
 *  5. Hebrew customer-facing errors (G1, G5).
 */
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const config_1 = require("../config");
const app_1 = require("./app");
const logger = __importStar(require("../../shared/logger"));
const TOFES_KEY = (0, params_1.defineSecret)(config_1.TOFES_MECHER_SA_KEY_SECRET);
/**
 * Internal handler — exported separately for direct unit testing (no v2
 * wrapping / region routing needed in tests).
 */
async function connectivityCheckHandler(request) {
    // ─── (1) Auth gate ─────────────────────────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
    }
    const claims = (request.auth.token ?? {});
    const isAdmin = claims.role === 'admin';
    if (!isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'רק מנהל מערכת רשאי לבדוק את חיבור טופס המכר.');
    }
    const callerUid = request.auth.uid;
    // ─── (2) Init the named app (sanitized credential errors) ─────────────────
    let app;
    try {
        app = (0, app_1.getTofesMecherApp)(TOFES_KEY.value());
    }
    catch (err) {
        // TofesMecherCredentialError is already sanitized (no key fragment). Log
        // only the error name — never `.message`/`.stack` (could carry a fragment).
        const name = err instanceof app_1.TofesMecherCredentialError
            ? err.name
            : 'unknown_init_error';
        logger.error('tofes_mecher.connectivity.init_failed', {
            actor: { uid: callerUid },
            errorName: name
        });
        throw new https_1.HttpsError('internal', 'שגיאה באתחול החיבור לטופס המכר. ודא שהמפתח הוגדר כראוי ונסה שוב, או פנה לתמיכה.');
    }
    // ─── (3) ONE read to prove reachability ───────────────────────────────────
    let sawAtLeastOneDoc = false;
    try {
        const snap = await app.firestore()
            .collection(config_1.TOFES_SALES_COLLECTION)
            .limit(1)
            .get();
        sawAtLeastOneDoc = !snap.empty;
    }
    catch (err) {
        const error = err;
        // errorCode only — never the message (could echo project/collection detail)
        // and never any document data.
        logger.error('tofes_mecher.connectivity.read_failed', {
            actor: { uid: callerUid },
            errorCode: error.code
        });
        throw new https_1.HttpsError('unavailable', 'לא ניתן להתחבר לטופס המכר כעת. ודא שלחשבון השירות יש הרשאת קריאה ונסה שוב.');
    }
    // ─── (4) Success log (uid only — no PII, no data) + return ────────────────
    logger.info('tofes_mecher.connectivity.ok', {
        actor: { uid: callerUid },
        sawAtLeastOneDoc
    });
    return { ok: true, reachable: true, sawAtLeastOneDoc };
}
// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
exports.connectivityCheck = (0, https_1.onCall)({ region: config_1.REGION, secrets: [TOFES_KEY] }, connectivityCheckHandler);
//# sourceMappingURL=connectivity-check.js.map