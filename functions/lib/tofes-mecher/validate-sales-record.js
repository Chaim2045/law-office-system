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
exports.validateSalesRecordExists = exports.validateSalesRecordInputSchema = void 0;
exports.asString = asString;
exports.asNumberOrNull = asNumberOrNull;
exports.asTimestampIso = asTimestampIso;
exports.projectSalesRecord = projectSalesRecord;
exports.readSalesRecordSnapshot = readSalesRecordSnapshot;
exports.validateSalesRecordExistsHandler = validateSalesRecordExistsHandler;
/**
 * validateSalesRecordExists — Phase 2 H.1.b (Pattern A: live cross-project read)
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-gated v2 callable that reads ONE specific sales_record from the
 * tofes-mecher project (law-office-sales-form) via the cross-project named app
 * and returns a FIELD-MINIMIZED snapshot for the future H.6 cutover flow
 * (createClientFromSalesRecord). This is the Pattern-A "commit" read of the DLR
 * (MASTER_PLAN §8.2.5 #6): discover via the Pattern-D mirror, COMMIT via one
 * live read of the specific sale.
 *
 * Supersedes the H.0 `tofesMecherConnectivityCheck` (DELETED in this PR): it
 * proves the identical wiring (Secret → named app → tofes Firestore read) AND
 * does real work — the REPURPOSE-OR-DELETE debt is resolved (MASTER_PLAN §8.3).
 *
 * ─── Design contract (H.1.b checkpoint, Haim-approved 2026-06-09) ────────────
 *  1. v2 `onCall` with `{ secrets: [TOFES_KEY] }`; handler exported for tests.
 *  2. Role-only admin gate (`claims.role === 'admin'`); rejects unauth +
 *     non-admin + legacy `admin:true`-only (the Pre-H.0.0.E follow-up gate).
 *  3. Zod `.strict()` input `{ salesRecordId }` pinned to the 20-char Firestore
 *     auto-id shape (`/^[A-Za-z0-9]{20}$/`) — also hard-bounds path safety
 *     (a charset-bounded id cannot traverse out of the collection in `.doc()`).
 *  4. FIELD MINIMIZATION (security default-deny): returns ONLY the 9 fields the
 *     H.6 create-client decision + the DLR four-amounts confirm UI need —
 *     clientName, idNumber, the 4 amounts, transactionType, timestamp. EXCLUDES
 *     address/phone/email and all instrument/routing/installment fields. NEVER
 *     `return snap.data()` — a server-side allowlist projection (Firestore is
 *     schemaless, so a future tofes field must not leak unseen to the browser).
 *  5. NON-PII ACCESS AUDIT (H.1.b checkpoint): every lookup writes an audit_log
 *     entry via `logCriticalAction('VALIDATE_SALES_RECORD', uid, {salesRecordId,
 *     found})` — NEVER ת"ז / amounts / name. Closes the IDOR-without-trace gap
 *     (devils-advocate 🔴): an admin pulling a customer's ת"ז + financials from
 *     a SECOND project via an over-read SA leaves a durable forensic record. The
 *     audit is a PRECONDITION for disclosure — if it throws, the PII is NOT
 *     returned (fail-secure, the audit-FIRST discipline of `logCriticalAction`).
 *  6. snapshot-never-re-derive (DLR): RAW field values, NO computation. The ONLY
 *     transform is Timestamp → ISO string. No VAT math, no fee-pick (the
 *     consumer picks `amountBeforeVat`, D1), no parseInt of string-numerics, no
 *     date parsing.
 *  7. Not-found → `{ exists: false }` (a legitimate H.6 discovery state, NOT an
 *     error) + a distinct non-PII `logger.warn`: the id is expected to come from
 *     the Pattern-D mirror and SHOULD exist, so a missing live doc is a
 *     mirror/live divergence worth surfacing (DLR #6/#7).
 *  8. NO PII to `logger.*` — only uid, salesRecordId, errorCode, found-bool.
 *  9. Hebrew customer-facing errors (G1/G5); sanitized credential errors (no key
 *     fragment) via the read-only `getTofesMecherReader`.
 */
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const zod_1 = require("zod");
const config_1 = require("../config");
const app_1 = require("./app");
const audit_critical_1 = require("../audit-critical");
const logger = __importStar(require("../../shared/logger"));
const TOFES_KEY = (0, params_1.defineSecret)(config_1.TOFES_MECHER_SA_KEY_SECRET);
/** Stable audit action key (the payload is non-PII: salesRecordId + found). */
const AUDIT_ACTION = 'VALIDATE_SALES_RECORD';
/**
 * Input schema — strict. `salesRecordId` is a tofes Firestore auto-id (20 chars,
 * `[A-Za-z0-9]`). The charset bound also prevents any path traversal in `.doc()`.
 */
exports.validateSalesRecordInputSchema = zod_1.z
    .object({
    salesRecordId: zod_1.z
        .string()
        .regex(/^[A-Za-z0-9]{20}$/, 'מזהה רשומת מכר אינו תקין.')
})
    .strict();
/** Absent/non-string field → '' (stable wire shape; never `undefined`). */
function asString(v) {
    return typeof v === 'string' ? v : '';
}
/** Absent/non-finite number → null (0 is a valid fee; absent must differ). */
function asNumberOrNull(v) {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
/** Firestore Timestamp → ISO 8601 string (the ONLY transform). null if absent. */
function asTimestampIso(v) {
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
/**
 * SSOT projection: maps a raw tofes-mecher `sales_records` doc to the
 * field-minimized 9-field {@link SalesRecordSnapshot} (allowlist; RAW values; the
 * single Timestamp→ISO transform). Exported so any consumer of a live sale (H.1.b
 * validate + the H.6 create-from-sale cutover) projects through ONE function — no
 * duplicate business logic, no risk of a future tofes field leaking via a second
 * hand-rolled projection. NEVER call `snap.data()` into a response; always via here.
 */
function projectSalesRecord(salesRecordId, data) {
    return {
        salesRecordId,
        clientName: asString(data.clientName),
        idNumber: asString(data.idNumber),
        amountBeforeVat: asNumberOrNull(data.amountBeforeVat),
        vatAmount: asNumberOrNull(data.vatAmount),
        amountWithVat: asNumberOrNull(data.amountWithVat),
        amount: asNumberOrNull(data.amount),
        transactionType: asString(data.transactionType),
        timestampIso: asTimestampIso(data.timestamp)
    };
}
/**
 * SSOT live read: initializes the tofes-mecher named app from the SA key, point-reads
 * ONE `sales_records` doc by id (collection hard-scoped), and returns either
 * `{ exists: false }` or `{ exists: true } & {@link SalesRecordSnapshot}` (projected
 * through {@link projectSalesRecord}). The SINGLE place a live sale is read +
 * minimized — reused by both `validateSalesRecordExists` (H.1.b) and
 * `createClientFromSalesRecord` (H.6 cutover). Throws {@link TofesMecherCredentialError}
 * on a malformed key (sanitized — no key fragment); rethrows the raw read error
 * (caller maps it to a Hebrew HttpsError + logs only its `code`). Never logs PII.
 *
 * @param saKeyJson the SA key JSON (from `defineSecret(...).value()`); NEVER logged.
 * @param salesRecordId a validated 20-char tofes auto-id (charset-bounded by the caller).
 */
async function readSalesRecordSnapshot(saKeyJson, salesRecordId) {
    const reader = (0, app_1.getTofesMecherReader)(saKeyJson);
    const snap = await reader.readDoc(config_1.TOFES_SALES_COLLECTION, salesRecordId);
    if (!snap.exists) {
        return { exists: false };
    }
    return { exists: true, ...projectSalesRecord(salesRecordId, snap.data() ?? {}) };
}
/**
 * Internal handler — exported separately for direct unit testing (no v2
 * wrapping / region routing needed in tests).
 */
async function validateSalesRecordExistsHandler(request) {
    // ─── (1) Auth gate (role-only admin) ──────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
    }
    const claims = (request.auth.token ?? {});
    if (claims.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'רק מנהל מערכת רשאי לאמת רשומת מכר.');
    }
    const callerUid = request.auth.uid;
    // ─── (2) Input validation (Zod, strict) ───────────────────────────────────
    const parsed = exports.validateSalesRecordInputSchema.safeParse(request.data);
    if (!parsed.success) {
        const fieldPath = parsed.error.issues[0]?.path?.join('.') ?? 'salesRecordId';
        logger.warn('tofes_mecher.validate.invalid_input', {
            actor: { uid: callerUid },
            issueField: fieldPath
        });
        throw new https_1.HttpsError('invalid-argument', `נתונים לא תקינים: שדה "${fieldPath}". אנא נסה שוב.`);
    }
    const { salesRecordId } = parsed.data;
    // ─── (3) Init the read-only reader (sanitized credential errors) ───────────
    let reader;
    try {
        reader = (0, app_1.getTofesMecherReader)(TOFES_KEY.value());
    }
    catch (err) {
        const name = err instanceof app_1.TofesMecherCredentialError
            ? err.name
            : 'unknown_init_error';
        logger.error('tofes_mecher.validate.init_failed', {
            actor: { uid: callerUid },
            errorName: name
        });
        throw new https_1.HttpsError('internal', 'שגיאה באתחול החיבור לטופס המכר. ודא שהמפתח הוגדר כראוי ונסה שוב, או פנה לתמיכה.');
    }
    // ─── (4) One live read of the specific sale (collection hard-scoped) ───────
    let snap;
    try {
        snap = await reader.readDoc(config_1.TOFES_SALES_COLLECTION, salesRecordId);
    }
    catch (err) {
        const error = err;
        // errorCode only — never error.message (could echo project/collection data).
        logger.error('tofes_mecher.validate.read_failed', {
            actor: { uid: callerUid },
            salesRecordId,
            errorCode: error.code
        });
        throw new https_1.HttpsError('unavailable', 'לא ניתן להתחבר לטופס המכר כעת. ודא שלחשבון השירות יש הרשאת קריאה ונסה שוב.');
    }
    const found = Boolean(snap.exists);
    // ─── (5) Non-PII access audit — PRECONDITION for disclosure ────────────────
    // Records WHO pulled WHICH sale (uid + salesRecordId + found) — NEVER ת"ז /
    // amounts / clientName. If the audit write fails, the PII is NOT disclosed
    // (fail-secure: no durable trace → no cross-project PII to the browser).
    try {
        await (0, audit_critical_1.logCriticalAction)(AUDIT_ACTION, callerUid, { salesRecordId, found });
    }
    catch {
        // logCriticalAction already emitted audit_critical.write_failed (errorCode
        // only). Do NOT echo the error here.
        throw new https_1.HttpsError('internal', 'לא ניתן לתעד את הגישה לרשומת המכר כעת. אנא נסה שוב או פנה לתמיכה.');
    }
    // ─── (6) Not found → {exists:false} + divergence warn (DLR #6/#7) ──────────
    if (!found) {
        // The id is expected from the Pattern-D mirror and SHOULD exist; a missing
        // live doc = mirror/live divergence worth surfacing (non-PII, no throw).
        logger.warn('tofes_mecher.validate.not_found', {
            actor: { uid: callerUid },
            salesRecordId
        });
        return { exists: false, salesRecordId };
    }
    // ─── (7) Field-minimized projection (allowlist; RAW; one transform) ────────
    // Projects through the SSOT `projectSalesRecord` (also used by the H.6
    // create-from-sale cutover) — one allowlist projection, never `snap.data()`.
    logger.info('tofes_mecher.validate.found', {
        actor: { uid: callerUid },
        salesRecordId
        // NO PII (idNumber / clientName / amounts) ever reaches Cloud Logging.
    });
    return { exists: true, ...projectSalesRecord(salesRecordId, snap.data() ?? {}) };
}
// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
exports.validateSalesRecordExists = (0, https_1.onCall)({ region: config_1.REGION, secrets: [TOFES_KEY] }, validateSalesRecordExistsHandler);
//# sourceMappingURL=validate-sales-record.js.map