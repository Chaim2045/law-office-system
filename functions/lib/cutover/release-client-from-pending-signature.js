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
exports.releaseClientFromPendingSignature = exports.releaseClientFromPendingSignatureInputSchema = void 0;
exports.releaseClientFromPendingSignatureHandler = releaseClientFromPendingSignatureHandler;
/**
 * releaseClientFromPendingSignature — Phase 2 H.6.c-3 (the cutover core, RELEASE phase)
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-gated v2 callable that completes the two-phase `pending_signature` flow
 * (H.6.c-1 created the client in `pending_signature`; this CF verifies the
 * uploaded signed fee-agreement via H.5 and, if it passes, ATOMICALLY flips the
 * client to `active` and writes the permanent `sales_record_links` fee-snapshot
 * doc — the write c-1 deliberately deferred to this CF).
 *
 * ─── Flow ──────────────────────────────────────────────────────────────────
 *  1. Admin sees a pending client on `pending-clients.html` and has already
 *     uploaded a signed fee-agreement PDF (the existing `feeAgreements` upload
 *     flow — out of scope here).
 *  2. Admin clicks "בדוק חתימה ואשר" — this CF:
 *     a. resolves `salesRecordId` → `{caseNumber, serviceId}` via the c-1
 *        `pending_signature_intents/{salesRecordId}` marker;
 *     b. reads `clients/{caseNumber}`, asserts `status==='pending_signature'`
 *        and at least one `feeAgreements[]` entry exists;
 *     c. verifies the LAST-uploaded agreement via the SHARED H.5 core
 *        {@link verifySignatureCore} (no `CallableRequest` fabrication — this CF
 *        already has a real `callerUid` from its own admin gate);
 *     d. if the verdict fails → returns `{released:false, ...booleans}` — NEVER
 *        the model's `reasoning` (it can quote PII off the document);
 *     e. if it passes → LIVE-reads the sale, checks the fee hasn't drifted, then
 *        atomically flips the client to `active` + writes `sales_record_links`.
 *
 * ─── Design contract (locked, mirrors the H.5 + H.6.c-1 conventions) ────────
 *  1. v2 `onCall` with `{ secrets: [ANTHROPIC_KEY, TOFES_KEY] }` (H.5 needs
 *     Anthropic; the fee-drift check needs a live tofes read); `maxInstances: 3`
 *     (matches H.5's ceiling — this CF calls H.5 internally, same paid-API +
 *     PII-egress containment); `timeoutSeconds: 120` (AI call + cross-project
 *     read + transaction can exceed the v2 default 60s).
 *  2. Role-only admin gate (`claims.role === 'admin'`) — rejects unauth +
 *     non-admin + legacy `admin:true`-only.
 *  3. Zod `.strict()` input `{ salesRecordId }` pinned to the 20-char tofes
 *     auto-id shape (also blocks `.doc()` path traversal).
 *  4. NEVER return the H.5 `reasoning` — it may contain PII quoted off the PDF.
 *     Only the two presence booleans + confidence cross the wire on a failed
 *     verdict.
 *  5. Fee-drift check (₪1 tolerance) BEFORE the transaction — the sale is
 *     cross-project (Pattern A) and cannot be read inside a Firestore txn.
 *  6. AUDIT-FIRST, mutation-SECOND, INSIDE the transaction
 *     (`logCriticalActionInTxn('RELEASE_CLIENT_FROM_PENDING_SIGNATURE', ...)`) —
 *     the audit commits atomically with the status flip + the link write.
 *     Payload is NON-PII (business ids + booleans + confidence — NEVER
 *     `reasoning`, NEVER the amount).
 *  7. TOCTOU guard: the client doc is RE-READ inside the transaction and
 *     `status==='pending_signature'` is RE-ASSERTED. If it has already been
 *     released (a concurrent double-click / re-call) → returns
 *     `{released:false, reason:'CLIENT_ALREADY_RELEASED'}` — NOT an error
 *     (idempotent no-op).
 *  8. `sales_record_links/{salesRecordId}` is written via `.create()` (not
 *     `.set()`) — race-safe: a concurrent double-release collides on the doc id
 *     and aborts + retries.
 *  9. `activeServices` is COMPUTED by counting `status==='active'` in the
 *     (locally mutated) services array — never hardcoded.
 * 10. NO PII to `logger.*` — only uid, business ids (salesRecordId/caseNumber/
 *     serviceId/agreementId), booleans, confidence, errorCode. NEVER the
 *     amount / clientName / idNumber / reasoning.
 * 11. Hebrew customer-facing errors everywhere (G1/G5).
 *
 * ⚠️ PII EGRESS: this CF, via {@link verifySignatureCore}, sends the full signed
 * document to Anthropic's external API. The DPA / privacy-law basis was
 * resolved 2026-07-01 (MASTER_PLAN §8.8) — this is the first LIVE consumer of
 * that egress path.
 */
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const zod_1 = require("zod");
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
const verify_signature_presence_1 = require("../signatures/verify-signature-presence");
const validate_sales_record_1 = require("../tofes-mecher/validate-sales-record");
const app_1 = require("../tofes-mecher/app");
const audit_critical_1 = require("../audit-critical");
const logger = __importStar(require("../../shared/logger"));
const ANTHROPIC_KEY = (0, params_1.defineSecret)(config_1.ANTHROPIC_API_KEY_SECRET);
const TOFES_KEY = (0, params_1.defineSecret)(config_1.TOFES_MECHER_SA_KEY_SECRET);
/** Stable audit action (payload is NON-PII: business ids + booleans + confidence). */
const AUDIT_ACTION = 'RELEASE_CLIENT_FROM_PENDING_SIGNATURE';
const CLIENTS_COLLECTION = 'clients';
const PENDING_SIGNATURE_INTENTS_COLLECTION = 'pending_signature_intents';
const SALES_RECORD_LINKS_COLLECTION = 'sales_record_links';
/** Fee-drift tolerance (₪) — absorbs floating-point / rounding noise, not real drift. */
const FEE_DRIFT_TOLERANCE = 1;
/**
 * Input schema — strict. `salesRecordId` is a tofes Firestore auto-id (20 chars,
 * `[A-Za-z0-9]`). The charset bound also prevents any path traversal in `.doc()`.
 */
exports.releaseClientFromPendingSignatureInputSchema = zod_1.z
    .object({
    salesRecordId: zod_1.z
        .string()
        .regex(/^[A-Za-z0-9]{20}$/, 'מזהה רשומת מכר אינו תקין.')
})
    .strict();
/**
 * Internal handler — exported separately for direct unit testing (H.5's core,
 * the tofes read, firebase-admin firestore/transaction, the secrets, and the
 * audit primitive are all mocked; no real cross-project call, AI egress, or
 * Firestore write occurs in tests).
 */
async function releaseClientFromPendingSignatureHandler(request) {
    // ─── (1) Auth gate (role-only admin) ──────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
    }
    const claims = (request.auth.token ?? {});
    if (claims.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'רק מנהל מערכת רשאי לאשר לקוח לאחר בדיקת חתימה.');
    }
    const adminUid = request.auth.uid;
    // ─── (2) Input validation (Zod, strict) ───────────────────────────────────
    const parsed = exports.releaseClientFromPendingSignatureInputSchema.safeParse(request.data);
    if (!parsed.success) {
        const fieldPath = parsed.error.issues[0]?.path?.join('.') ?? 'salesRecordId';
        logger.warn('cutover.release_client.invalid_input', {
            actor: { uid: adminUid },
            issueField: fieldPath
        });
        throw new https_1.HttpsError('invalid-argument', `נתונים לא תקינים: שדה "${fieldPath}". אנא נסה שוב.`);
    }
    const { salesRecordId } = parsed.data;
    const db = admin.firestore();
    // ─── (3) Resolve the pending intent → {caseNumber, serviceId} ─────────────
    let intentSnap;
    try {
        intentSnap = await db.collection(PENDING_SIGNATURE_INTENTS_COLLECTION).doc(salesRecordId).get();
    }
    catch (err) {
        const error = err;
        logger.error('cutover.release_client.intent_read_failed', {
            actor: { uid: adminUid },
            salesRecordId,
            errorCode: error.code
        });
        throw new https_1.HttpsError('unavailable', 'לא ניתן לטעון את רשומת ההמתנה לחתימה כעת. אנא נסה שוב.');
    }
    if (!intentSnap.exists) {
        throw new https_1.HttpsError('not-found', 'לא נמצאה רשומת המתנה לחתימה עבור מכר זה.');
    }
    const intent = intentSnap.data() ?? {};
    const caseNumber = typeof intent.caseNumber === 'string' ? intent.caseNumber : '';
    const serviceId = typeof intent.serviceId === 'string' ? intent.serviceId : '';
    if (!caseNumber || !serviceId) {
        logger.error('cutover.release_client.intent_malformed', {
            actor: { uid: adminUid },
            salesRecordId
        });
        throw new https_1.HttpsError('internal', 'רשומת ההמתנה לחתימה פגומה. אנא פנה לתמיכה.');
    }
    const clientRef = db.collection(CLIENTS_COLLECTION).doc(caseNumber);
    // ─── (4) Read the client doc — status + feeAgreements preconditions ───────
    let clientSnap;
    try {
        clientSnap = await clientRef.get();
    }
    catch (err) {
        const error = err;
        logger.error('cutover.release_client.client_read_failed', {
            actor: { uid: adminUid },
            salesRecordId,
            caseNumber,
            errorCode: error.code
        });
        throw new https_1.HttpsError('unavailable', 'לא ניתן לטעון את פרטי הלקוח כעת. אנא נסה שוב.');
    }
    if (!clientSnap.exists) {
        throw new https_1.HttpsError('not-found', 'הלקוח לא נמצא במערכת.');
    }
    const clientData = clientSnap.data() ?? {};
    if (clientData.status !== 'pending_signature') {
        throw new https_1.HttpsError('failed-precondition', 'הלקוח אינו ממתין לבדיקת חתימה.');
    }
    const feeAgreements = Array.isArray(clientData.feeAgreements)
        ? clientData.feeAgreements
        : [];
    if (feeAgreements.length === 0) {
        throw new https_1.HttpsError('failed-precondition', 'טרם הועלה הסכם שכר טרחה חתום עבור לקוח זה.');
    }
    // ─── (4b) Resolve admin display name — same pattern as createClientFromSalesRecord.
    let actorName = adminUid;
    try {
        const empSnap = await db
            .collection('employees')
            .where('uid', '==', adminUid)
            .limit(1)
            .get();
        if (!empSnap.empty) {
            const uname = (empSnap.docs[0].data() ?? {}).username;
            if (typeof uname === 'string' && uname.trim().length > 0) {
                actorName = uname;
            }
        }
        else if (typeof request.auth.token.name === 'string' &&
            (request.auth.token.name ?? '').trim().length > 0) {
            actorName = request.auth.token.name;
        }
    }
    catch {
        logger.warn('cutover.release_client.actor_lookup_failed', {
            actor: { uid: adminUid }
        });
    }
    // ─── (5) Determine which agreement to verify — the LAST-uploaded entry ────
    const lastAgreement = feeAgreements[feeAgreements.length - 1];
    const agreementId = typeof lastAgreement?.id === 'string' ? lastAgreement.id : '';
    if (!agreementId) {
        logger.error('cutover.release_client.agreement_malformed', {
            actor: { uid: adminUid },
            salesRecordId,
            caseNumber
        });
        throw new https_1.HttpsError('failed-precondition', 'הסכם שכר הטרחה האחרון אינו תקין.');
    }
    // ─── (6) Call the SHARED H.5 core (audit-first + download + Claude call) ──
    let verdict;
    try {
        verdict = await (0, verify_signature_presence_1.verifySignatureCore)(adminUid, caseNumber, agreementId, 'clients');
    }
    catch (err) {
        if (err instanceof https_1.HttpsError) {
            throw err;
        }
        logger.error('cutover.release_client.signature_check_failed', {
            actor: { uid: adminUid },
            salesRecordId,
            caseNumber
        });
        throw new https_1.HttpsError('internal', 'בדיקת החתימה נכשלה כעת. אנא נסה שוב מאוחר יותר או פנה לתמיכה.');
    }
    // ─── (7) Failed / borderline verdict → NEVER return reasoning ─────────────
    if (!verdict.passed) {
        logger.info('cutover.release_client.signature_not_passed', {
            actor: { uid: adminUid },
            salesRecordId,
            caseNumber,
            clientSignaturePresent: verdict.clientSignaturePresent,
            lawyerSignaturePresent: verdict.lawyerSignaturePresent
        });
        return {
            released: false,
            clientSignaturePresent: verdict.clientSignaturePresent,
            lawyerSignaturePresent: verdict.lawyerSignaturePresent,
            confidence: verdict.confidence
        };
    }
    // ─── (8) Passed → LIVE-read the sale (cross-project, cannot be in a txn) ──
    let sale;
    try {
        sale = await (0, validate_sales_record_1.readSalesRecordSnapshot)(TOFES_KEY.value(), salesRecordId);
    }
    catch (err) {
        if (err instanceof app_1.TofesMecherCredentialError) {
            logger.error('cutover.release_client.tofes_init_failed', {
                actor: { uid: adminUid },
                salesRecordId,
                errorName: err.name
            });
            throw new https_1.HttpsError('internal', 'שגיאה באתחול החיבור לטופס המכר. אנא נסה שוב מאוחר יותר או פנה לתמיכה.');
        }
        const error = err;
        logger.error('cutover.release_client.tofes_read_failed', {
            actor: { uid: adminUid },
            salesRecordId,
            errorCode: error.code
        });
        throw new https_1.HttpsError('unavailable', 'לא ניתן לקרוא את רשומת המכר כעת. אנא נסה שוב מאוחר יותר.');
    }
    if (!sale.exists) {
        logger.warn('cutover.release_client.sale_not_found', {
            actor: { uid: adminUid },
            salesRecordId,
            caseNumber
        });
        throw new https_1.HttpsError('failed-precondition', 'רשומת המכר לא נמצאה במערכת המקור. לא ניתן לשחרר את הלקוח.');
    }
    // ─── (9) Fee-drift check (₪1 tolerance) — BEFORE the transaction ──────────
    const services = Array.isArray(clientData.services) ? clientData.services : [];
    const service = services.find((s) => s && s.id === serviceId);
    const clientFixedPrice = typeof service?.fixedPrice === 'number' ? service.fixedPrice : null;
    const saleAmount = sale.amountBeforeVat;
    if (clientFixedPrice === null ||
        typeof saleAmount !== 'number' ||
        !Number.isFinite(saleAmount) ||
        Math.abs(saleAmount - clientFixedPrice) > FEE_DRIFT_TOLERANCE) {
        logger.warn('cutover.release_client.fee_drift', {
            actor: { uid: adminUid },
            salesRecordId,
            caseNumber,
            serviceId
        });
        throw new https_1.HttpsError('failed-precondition', 'סכום העסקה במערכת המכר שונה מהסכום שנרשם בלקוח. נא לבדוק ולעדכן.');
    }
    // ─── (10) TOCTOU-safe transaction: audit-FIRST, status flip, link write ───
    const linksRef = db.collection(SALES_RECORD_LINKS_COLLECTION).doc(salesRecordId);
    let result;
    try {
        result = await db.runTransaction(async (transaction) => {
            const freshSnap = await transaction.get(clientRef);
            if (!freshSnap.exists) {
                throw new https_1.HttpsError('not-found', 'הלקוח לא נמצא במערכת.');
            }
            const freshData = freshSnap.data() ?? {};
            // 10a. Re-assert status — a concurrent release/re-call is an idempotent no-op.
            if (freshData.status !== 'pending_signature') {
                return { released: false, reason: 'CLIENT_ALREADY_RELEASED' };
            }
            // 10b. Re-assert the verified agreement still exists.
            const freshAgreements = Array.isArray(freshData.feeAgreements)
                ? freshData.feeAgreements
                : [];
            if (!freshAgreements.some((a) => a && a.id === agreementId)) {
                throw new https_1.HttpsError('failed-precondition', 'הסכם שכר הטרחה שאומת אינו קיים עוד עבור לקוח זה. אנא נסה שוב.');
            }
            // 10c. Find the pending service by id.
            const freshServices = Array.isArray(freshData.services) ? freshData.services : [];
            const serviceIndex = freshServices.findIndex((s) => s && s.id === serviceId);
            if (serviceIndex === -1 || freshServices[serviceIndex]?.status !== 'pending') {
                throw new https_1.HttpsError('failed-precondition', 'השירות אינו במצב הממתין לשחרור.');
            }
            // 10d. AUDIT-FIRST (in-txn) — NEVER reasoning, NEVER the amount.
            (0, audit_critical_1.logCriticalActionInTxn)(transaction, AUDIT_ACTION, adminUid, {
                caseNumber,
                salesRecordId,
                serviceId,
                agreementId,
                clientSignaturePresent: true,
                lawyerSignaturePresent: true,
                confidence: verdict.confidence
            });
            // 10e. Status flip — activeServices is COMPUTED, never hardcoded.
            const updatedServices = freshServices.map((s, i) => i === serviceIndex ? { ...s, status: 'active' } : s);
            const activeServices = updatedServices.filter((s) => s?.status === 'active').length;
            transaction.update(clientRef, {
                status: 'active',
                services: updatedServices,
                activeServices,
                lastModifiedBy: actorName,
                lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // 10f. Clean up the now-consumed idempotency intent (the permanent
            // sales_record_links doc replaces it as the authoritative link).
            const intentCleanupRef = db.collection(PENDING_SIGNATURE_INTENTS_COLLECTION).doc(salesRecordId);
            transaction.delete(intentCleanupRef);
            // 10g. Permanent fee-snapshot link — `.create()` (race-safe backstop).
            transaction.create(linksRef, {
                caseNumber,
                salesRecordId,
                serviceId,
                agreedFeeSnapshot: {
                    amountBeforeVat: sale.amountBeforeVat,
                    vatAmount: sale.vatAmount,
                    amountWithVat: sale.amountWithVat,
                    amount: sale.amount
                },
                feeFieldUsed: 'amountBeforeVat',
                salesRecordUpdatedAt: sale.timestampIso ?? null,
                snapshotAt: admin.firestore.FieldValue.serverTimestamp(),
                confirmedBy: adminUid,
                state: 'matched'
            });
            return { released: true, caseNumber };
        });
    }
    catch (err) {
        if (err instanceof https_1.HttpsError) {
            throw err;
        }
        const error = err;
        logger.error('cutover.release_client.txn_failed', {
            actor: { uid: adminUid },
            salesRecordId,
            caseNumber,
            errorCode: error.code
        });
        throw new https_1.HttpsError('internal', 'שחרור הלקוח נכשל כעת. אנא נסה שוב מאוחר יותר או פנה לתמיכה.');
    }
    // ─── (11) Non-PII outcome log (NEVER the amount / reasoning) ──────────────
    logger.info('cutover.release_client.completed', {
        actor: { uid: adminUid },
        salesRecordId,
        caseNumber,
        released: result.released,
        reason: result.reason ?? null
    });
    return result;
}
// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
exports.releaseClientFromPendingSignature = (0, https_1.onCall)({
    region: config_1.REGION,
    secrets: [ANTHROPIC_KEY, TOFES_KEY],
    // Matches H.5's containment ceiling — this CF calls verifySignatureCore
    // internally (paid Anthropic call + PII egress), same blast-radius bound.
    maxInstances: 3,
    // AI call + cross-project read + transaction can exceed the v2 default 60s.
    timeoutSeconds: 120
}, releaseClientFromPendingSignatureHandler);
//# sourceMappingURL=release-client-from-pending-signature.js.map