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
exports.createClientFromSalesRecord = exports.createClientFromSalesRecordInputSchema = void 0;
exports.createClientFromSalesRecordHandler = createClientFromSalesRecordHandler;
/**
 * createClientFromSalesRecord — Phase 2 H.6 (the cutover core)
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-gated v2 callable that DETERMINISTICALLY creates a law-office-system
 * client + a single fixed-price service FROM a tofes-mecher `sales_record`. This is
 * the heart of the H.6 cutover (MASTER_PLAN §8.8): instead of an admin re-typing
 * client details, the already-accountant-verified sale becomes the source of truth
 * for the new case. The agreed fee = the sale's pre-VAT amount (DLR §8.2.5 D1).
 *
 * ─── Design contract (the locked H.6.a design — do NOT deviate) ──────────────
 *  1. v2 `onCall` with `{ secrets: [TOFES_KEY] }`; handler exported for tests.
 *  2. Role-only admin gate (`claims.role === 'admin'`) — rejects unauth + non-admin
 *     + legacy `admin:true`-only (the Pre-H.0.0.E consumer-contraction gate).
 *  3. Zod `.strict()` input `{ salesRecordId }` pinned to the 20-char tofes auto-id
 *     (`/^[A-Za-z0-9]{20}$/`) — the charset bound also blocks `.doc()` traversal.
 *  4. LIVE read the sale via the SSOT `readSalesRecordSnapshot` (the SAME named-app
 *     read + 9-field projection H.1.b `validateSalesRecordExists` uses — no duplicate
 *     business logic). Fail-CLOSED:
 *       • sale not found → `failed-precondition` (it may have been deleted in source);
 *       • `amountBeforeVat` null / non-finite → `failed-precondition` (no fee → no
 *         service; the admin must enter it manually).
 *  5. IDEMPOTENCY + CREATE in ONE `db.runTransaction`:
 *       • read `sales_record_links/{salesRecordId}`; if it EXISTS → return
 *         `{ created:false, caseNumber }` (a re-call creates NO second client);
 *       • else allocate a fresh 7-digit caseNumber atomically (the same
 *         `_system/caseNumberCounter` the canonical generator uses, replicated INSIDE
 *         this txn — `generateCaseNumberWithTransaction` runs its OWN txn and cannot
 *         nest), build the FULL FIXED clientData EXACTLY as `createClient`'s `fixed`
 *         branch (procedureType:'fixed', the `srv_fixed_*` service with
 *         fixedPrice = amountBeforeVat, plan = computeClientPlan(services)), and
 *         `transaction.create(clients/{caseNumber})`.
 *  6. AUDIT-FIRST inside the txn via `logCriticalActionInTxn('CREATE_CLIENT_FROM_
 *     SALES_RECORD', adminUid, {salesRecordId, caseNumber, serviceId})` — the audit
 *     doc is part of the SAME atomic commit as the client + link, so the create can
 *     never land without its forensic record. Payload is NON-PII (business ids only —
 *     NEVER the amount / clientName / idNumber).
 *  7. The financial snapshot (`agreedFeeSnapshot = amountBeforeVat`) is written to the
 *     CF-only `sales_record_links/{salesRecordId}` doc — OFF the world-readable
 *     `clients` doc (§7.6 / DLR D-A). The clients doc carries the fee only as the
 *     service's `fixedPrice` (intrinsic to a fixed service), plus the non-PII
 *     `salesRecordId` on the service element for traceability — NEVER a raw
 *     `agreedFee`/amount field.
 *  8. NO PII to `logger.*` — only uid, business ids (salesRecordId/caseNumber/
 *     serviceId), errorCode. NEVER the amount / clientName / idNumber. A static AST
 *     guard + a runtime serialization scan enforce this in the tests.
 *  9. Hebrew customer-facing errors everywhere (G1/G5).
 *
 * ⚠️ SCOPE (Option A): this PR is the deterministic create from a sale. It does NOT
 * gate on the H.5 signature-presence check / the PDF — that gate is a LATER H.6
 * increment. No PDF / AI egress happens here.
 */
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const zod_1 = require("zod");
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
const validate_sales_record_1 = require("../tofes-mecher/validate-sales-record");
const app_1 = require("../tofes-mecher/app");
const audit_critical_1 = require("../audit-critical");
const logger = __importStar(require("../../shared/logger"));
// The static Plan layer (H.3 PR1) — derived from services[] EXACTLY as createClient
// + the canonical client-writer, so the third intake route (this CF) never drifts.
const client_plan_1 = require("../profitability/client-plan");
const TOFES_KEY = (0, params_1.defineSecret)(config_1.TOFES_MECHER_SA_KEY_SECRET);
/** Stable audit action (payload is NON-PII: salesRecordId + caseNumber + serviceId). */
const AUDIT_ACTION = 'CREATE_CLIENT_FROM_SALES_RECORD';
/** The MAIN-project collections this CF writes. */
const CLIENTS_COLLECTION = 'clients';
const SALES_RECORD_LINKS_COLLECTION = 'sales_record_links';
/** The atomic case-number counter doc (mirrors functions/case-number-transaction.js). */
const CASE_NUMBER_COUNTER_PATH = ['_system', 'caseNumberCounter'];
/** Link-record schema version — forward-compat anchor (DLR §8.2.5). */
const LINK_SCHEMA_VERSION = 1;
/**
 * Input schema — strict. `salesRecordId` is a tofes Firestore auto-id (20 chars,
 * `[A-Za-z0-9]`). The charset bound also prevents any path traversal in `.doc()`.
 */
exports.createClientFromSalesRecordInputSchema = zod_1.z
    .object({
    salesRecordId: zod_1.z
        .string()
        .regex(/^[A-Za-z0-9]{20}$/, 'מזהה רשומת מכר אינו תקין.')
})
    .strict();
/**
 * Allocates the next 7-digit caseNumber INSIDE an active transaction, replicating
 * `functions/case-number-transaction.js generateCaseNumberWithTransaction` (which
 * runs its OWN transaction and therefore cannot be nested). MUST be called before
 * any write in the same transaction (Firestore requires all reads before writes).
 *
 * @returns `{ caseNumber, counterUpdate }` — the caller applies `counterUpdate` via
 *          `transaction.set(counterRef, counterUpdate, { merge:true })` so the
 *          allocation commits atomically with the client create.
 */
async function allocateCaseNumberInTxn(transaction, db) {
    const counterRef = db.collection(CASE_NUMBER_COUNTER_PATH[0]).doc(CASE_NUMBER_COUNTER_PATH[1]);
    const counterDoc = await transaction.get(counterRef);
    const currentYear = new Date().getFullYear().toString();
    let nextNumber = 1;
    if (counterDoc.exists) {
        const data = counterDoc.data() ?? {};
        if (data.year === currentYear) {
            nextNumber = (typeof data.lastNumber === 'number' ? data.lastNumber : 0) + 1;
            if (nextNumber > 999) {
                // Mirrors the generator's hard limit (3-digit per-year sequence).
                throw new https_1.HttpsError('resource-exhausted', 'הגעת למספר התיקים המרבי לשנה זו. אנא פנה לתמיכה.');
            }
        }
    }
    const caseNumber = `${currentYear}${nextNumber.toString().padStart(3, '0')}`;
    const prevStats = (counterDoc.data()?._stats ?? {});
    const prevTotal = typeof prevStats.totalTransactions === 'number' ? prevStats.totalTransactions : 0;
    const counterUpdate = {
        year: currentYear,
        lastNumber: nextNumber,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        _stats: {
            totalTransactions: prevTotal + 1,
            lastCaseNumber: caseNumber,
            lastSource: 'createClientFromSalesRecord'
        }
    };
    return { caseNumber, counterRef, counterUpdate };
}
/**
 * Builds the FIXED-service clientData EXACTLY as `functions/clients/index.js`
 * `createClient`'s `procedureType === 'fixed'` branch (base object :224-262 + the
 * fixed service :310-334 + `plan` :561-565), with the identity fields populated from
 * the approving admin and the fee from the sale's `amountBeforeVat`. `caseTitle` is
 * sourced from the sale's `transactionType` (else '').
 *
 * @param caseNumber the freshly-allocated 7-digit id (also the doc id).
 * @param actorName  the approving admin's username (display) — `createdBy`/`mainAttorney`/etc.
 * @param clientName the sale's clientName (also `fullName`).
 * @param idNumber   the sale's idNumber (the cross-system join key, §8.2.5).
 * @param caseTitle  the sale's transactionType (or '').
 * @param fixedPrice the sale's `amountBeforeVat` (a validated finite number).
 * @param salesRecordId a non-PII business id stamped on the service for traceability.
 * @param serviceId  the deterministic `srv_fixed_*` id.
 * @param nowIso     a single ISO timestamp string reused for the service `createdAt`.
 */
function buildFixedClientData(args) {
    const { caseNumber, actorName, clientName, idNumber, caseTitle, fixedPrice, salesRecordId, serviceId, nowIso } = args;
    const services = [
        {
            id: serviceId,
            type: 'fixed',
            name: 'שירות קבוע',
            description: '',
            status: 'active',
            createdAt: nowIso,
            createdBy: actorName,
            fixedPrice,
            work: {
                totalMinutesWorked: 0,
                entriesCount: 0
            },
            completedAt: null,
            // Non-PII business id — links the service back to its source sale for
            // traceability (NEVER the amount; that lives in fixedPrice + the CF-only link).
            salesRecordId
        }
    ];
    const clientData = {
        // ─── identity + basic info (mirrors createClient base :224-262) ───────────
        caseNumber,
        clientName,
        fullName: clientName,
        idNumber,
        caseTitle,
        procedureType: 'fixed',
        status: 'active',
        priority: 'medium',
        description: '',
        // ─── management (the approving admin) ─────────────────────────────────────
        assignedTo: [actorName],
        mainAttorney: actorName,
        createdBy: actorName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: actorName,
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        // ─── the fixed service + aggregates ───────────────────────────────────────
        services,
        totalServices: 1,
        activeServices: 1,
        isOnHold: false
    };
    // H.3 PR1: stamp the static Plan from services[] (NON-confidential —
    // expectedHours/expectedRevenue only; cost/profit live CF-only). Same helper the
    // other two intake routes use → no drift.
    clientData.plan = (0, client_plan_1.computeClientPlan)(services);
    return clientData;
}
/**
 * Internal handler — exported separately for direct unit testing (the tofes read,
 * firebase-admin firestore/transaction, the secret, and the audit primitive are all
 * mocked; no real cross-project call or write occurs in tests).
 */
async function createClientFromSalesRecordHandler(request) {
    // ─── (1) Auth gate (role-only admin) ──────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
    }
    const claims = (request.auth.token ?? {});
    if (claims.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'רק מנהל מערכת רשאי ליצור לקוח ממכר.');
    }
    const adminUid = request.auth.uid;
    // ─── (2) Input validation (Zod, strict) ───────────────────────────────────
    const parsed = exports.createClientFromSalesRecordInputSchema.safeParse(request.data);
    if (!parsed.success) {
        const fieldPath = parsed.error.issues[0]?.path?.join('.') ?? 'salesRecordId';
        logger.warn('cutover.create_client.invalid_input', {
            actor: { uid: adminUid },
            issueField: fieldPath
        });
        throw new https_1.HttpsError('invalid-argument', `נתונים לא תקינים: שדה "${fieldPath}". אנא נסה שוב.`);
    }
    const { salesRecordId } = parsed.data;
    // ─── (3) LIVE read the sale via the SSOT (named-app read + 9-field projection)
    let sale;
    try {
        sale = await (0, validate_sales_record_1.readSalesRecordSnapshot)(TOFES_KEY.value(), salesRecordId);
    }
    catch (err) {
        // Credential init failure (sanitized — no key fragment) vs a read failure: both
        // map to a Hebrew error; we log ONLY a stable name/errorCode, never the message.
        if (err instanceof app_1.TofesMecherCredentialError) {
            logger.error('cutover.create_client.tofes_init_failed', {
                actor: { uid: adminUid },
                errorName: err.name
            });
            throw new https_1.HttpsError('internal', 'שגיאה באתחול החיבור לטופס המכר. אנא נסה שוב מאוחר יותר או פנה לתמיכה.');
        }
        const error = err;
        logger.error('cutover.create_client.tofes_read_failed', {
            actor: { uid: adminUid },
            salesRecordId,
            errorCode: error.code
        });
        throw new https_1.HttpsError('unavailable', 'לא ניתן לקרוא את רשומת המכר כעת. אנא נסה שוב מאוחר יותר.');
    }
    // ─── (4) Fail-CLOSED preconditions ────────────────────────────────────────
    if (!sale.exists) {
        // The sale is the source of truth; a missing live doc (e.g. deleted in source)
        // means there is nothing authoritative to create a client from.
        logger.warn('cutover.create_client.sale_not_found', {
            actor: { uid: adminUid },
            salesRecordId
        });
        throw new https_1.HttpsError('failed-precondition', 'רשומת המכר לא נמצאה במערכת המקור. ייתכן שנמחקה.');
    }
    const fixedPrice = sale.amountBeforeVat;
    if (typeof fixedPrice !== 'number' || !Number.isFinite(fixedPrice)) {
        // No fee → no service. The amount must be entered manually upstream.
        logger.warn('cutover.create_client.missing_amount', {
            actor: { uid: adminUid },
            salesRecordId
        });
        throw new https_1.HttpsError('failed-precondition', 'לרשומת המכר אין סכום (לפני מע"מ); לא ניתן ליצור שירות. יש להזין ידנית.');
    }
    // NON-PII business fields stay in local vars; PII (clientName/idNumber/amount) is
    // used ONLY to build the doc — NEVER logged.
    const clientName = sale.clientName;
    const idNumber = sale.idNumber;
    const caseTitle = sale.transactionType ?? '';
    // The SALE's own timestamp (captured here for the link's drift-detection field,
    // NOT the current wall-clock) — the future DLR drift job (§8.2.5 #7) compares
    // this linked snapshot's timestamp against the live sale. `string | null` (null =
    // the sale carried no timestamp; honest-null beats a fabricated time).
    const salesRecordTimestampIso = sale.timestampIso;
    // ─── (5) Resolve the approving admin's display username (a READ, pre-txn) ──
    // Mirrors createClient's `user.username` (employees keyed by authUID). The clients
    // doc stores usernames (the UI reads them); fall back to the token `name` then uid
    // so the create never blocks on a missing employee doc.
    const db = admin.firestore();
    let actorName = adminUid;
    try {
        const empSnap = await db
            .collection('employees')
            .where('authUID', '==', adminUid)
            .limit(1)
            .get();
        if (!empSnap.empty) {
            const uname = (empSnap.docs[0].data() ?? {}).username;
            if (typeof uname === 'string' && uname.trim().length > 0) {
                actorName = uname;
            }
        }
        else if (typeof claims.name === 'string' && claims.name.trim().length > 0) {
            actorName = claims.name;
        }
    }
    catch (err) {
        // Non-fatal — fall back to uid. errorCode only (no PII).
        logger.warn('cutover.create_client.actor_lookup_failed', {
            actor: { uid: adminUid },
            errorCode: err.code
        });
    }
    if (actorName === adminUid) {
        // No employee username AND no token name → the raw UID gets stamped as
        // mainAttorney/createdBy. The clients doc stores usernames, so a UID renders as a
        // blank attorney downstream. Non-fatal (the create proceeds, correctable via
        // updateClient) but surfaced so support can detect + fix it. NON-PII (uid only).
        logger.warn('cutover.create_client.actor_name_uid_fallback', {
            actor: { uid: adminUid }
        });
    }
    // ─── (6) IDEMPOTENCY + CREATE in ONE transaction ──────────────────────────
    const linkRef = db.collection(SALES_RECORD_LINKS_COLLECTION).doc(salesRecordId);
    const serviceId = `srv_fixed_${salesRecordId}`;
    const nowIso = new Date().toISOString();
    let result;
    try {
        result = await db.runTransaction(async (transaction) => {
            // 6a. Idempotency: a link already exists → no second client.
            const existingLink = await transaction.get(linkRef);
            if (existingLink.exists) {
                const existing = existingLink.data() ?? {};
                return {
                    created: false,
                    caseNumber: typeof existing.caseNumber === 'string' ? existing.caseNumber : '',
                    serviceId: typeof existing.serviceId === 'string' ? existing.serviceId : null
                };
            }
            // 6b. Allocate the caseNumber (all reads must precede all writes).
            const { caseNumber, counterRef, counterUpdate } = await allocateCaseNumberInTxn(transaction, db);
            const clientRef = db.collection(CLIENTS_COLLECTION).doc(caseNumber);
            // 6c. AUDIT-FIRST (in-txn): the audit doc commits atomically with the client +
            // link, so a created client can never lack its forensic record. NON-PII payload.
            (0, audit_critical_1.logCriticalActionInTxn)(transaction, AUDIT_ACTION, adminUid, {
                salesRecordId,
                caseNumber,
                serviceId
            });
            // 6d. Build the FIXED clientData EXACTLY as createClient's fixed branch.
            const clientData = buildFixedClientData({
                caseNumber,
                actorName,
                clientName,
                idNumber,
                caseTitle,
                fixedPrice,
                salesRecordId,
                serviceId,
                nowIso
            });
            // 6e. Atomic writes — counter bump + client create + link.
            transaction.set(counterRef, counterUpdate, { merge: true });
            // `.create()` (not set) → a caseNumber collision aborts the txn rather than
            // silently overwriting an existing case (defensive; the counter makes it rare).
            transaction.create(clientRef, clientData);
            // The financial snapshot lives HERE (CF-only) — OFF the world-readable client
            // doc (§7.6 / DLR D-A). The clients doc carries the fee only as the service's
            // fixedPrice + the non-PII salesRecordId.
            transaction.set(linkRef, {
                salesRecordId,
                caseNumber,
                serviceId,
                agreedFeeSnapshot: fixedPrice,
                feeFieldUsed: 'amountBeforeVat',
                salesRecordTimestampIso,
                snapshotAt: admin.firestore.FieldValue.serverTimestamp(),
                confirmedBy: adminUid,
                state: 'matched',
                schemaVersion: LINK_SCHEMA_VERSION
            });
            return { created: true, caseNumber, serviceId };
        });
    }
    catch (err) {
        if (err instanceof https_1.HttpsError) {
            throw err;
        }
        const error = err;
        logger.error('cutover.create_client.txn_failed', {
            actor: { uid: adminUid },
            salesRecordId,
            errorCode: error.code
        });
        throw new https_1.HttpsError('internal', 'יצירת הלקוח מרשומת המכר נכשלה כעת. אנא נסה שוב מאוחר יותר או פנה לתמיכה.');
    }
    // ─── (7) Non-PII outcome log (NEVER the amount / clientName / idNumber) ────
    logger.info('cutover.create_client.completed', {
        actor: { uid: adminUid },
        salesRecordId,
        caseNumber: result.caseNumber,
        created: result.created
    });
    return result;
}
// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
exports.createClientFromSalesRecord = (0, https_1.onCall)({ region: config_1.REGION, secrets: [TOFES_KEY] }, createClientFromSalesRecordHandler);
//# sourceMappingURL=create-client-from-sales-record.js.map