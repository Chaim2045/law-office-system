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
exports.verifySignaturePresence = exports.verifySignatureInputSchema = void 0;
exports.verifySignaturePresenceHandler = verifySignaturePresenceHandler;
/**
 * verifySignaturePresence — Phase 2 H.5 (AI signature-presence check)
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-gated v2 callable. Given a stored fee-agreement document (PDF or image),
 * downloads it from Firebase Storage (Admin SDK) and asks Claude whether the page
 * visually CONTAINS a client signature AND a lawyer signature — PRESENCE only,
 * NOT authenticity/fraud (Decisions-Locked 2026-05-27). Returns the two booleans
 * + the model's confidence + a short Hebrew reasoning + a derived `passed` verdict
 * the future H.6 cutover gate consumes. The FIRST Anthropic integration + the
 * FIRST Cloud Storage read in this codebase.
 *
 * ─── Design contract (H.5 checkpoint, Haim-approved 2026-06-16) ──────────────
 *  1. v2 `onCall` with `{ secrets: [ANTHROPIC_KEY] }`; handler exported for tests.
 *  2. Role-only admin gate (`claims.role === 'admin'`) — the ONLY effective caller
 *     gate (the Admin SDK bypasses Storage rules by design).
 *  3. Zod `.strict()` input `{ clientId, agreementId, collection? }`, charset-
 *     bounded so a malformed id cannot traverse out of the collection in `.doc()`.
 *  4. SOURCE = the stored `feeAgreements[].storagePath` (trusted), NOT a caller-
 *     supplied path and NOT the public `downloadUrl`. Resolve the entity doc →
 *     find the agreement by id → download via the Admin SDK (mirrors the
 *     deleteFeeAgreement read-doc→resolve-storagePath→Storage-op idiom).
 *  5. AUDIT-FIRST, EGRESS-SECOND (fail-secure): `logCriticalAction(
 *     'VERIFY_SIGNATURE_PRESENCE', uid, {clientId, agreementId, collection})` is
 *     awaited BEFORE the PDF is downloaded or sent to Anthropic. If the audit
 *     write fails, NO document leaves the system (every external PII egress has a
 *     prior durable forensic trace). Payload is non-PII (business ids only) —
 *     NEVER the PDF bytes / signatures / client name / the model's reasoning.
 *  6. NO PII to `logger.*`: only uid, clientId/agreementId (business ids), model,
 *     token counts, booleans, errorCode/errorName. NEVER the API key, the PDF
 *     base64, or the model's free-text `reasoning` (which can quote names off the
 *     page). `reasoning` transits ONLY in the callable response to the admin.
 *  7. snapshot-never-re-derive: returns the model's raw verdict + a single derived
 *     `passed` (both present AND confidence ≥ SIGNATURE_CONFIDENCE_THRESHOLD).
 *  8. Hebrew customer-facing errors (G1/G5); sanitized Anthropic-init errors (no
 *     key fragment) via getAnthropicClient.
 *
 * ⚠️ PII EGRESS: this CF sends the full document to Anthropic's external API. Per
 * the H.5 checkpoint it ships as PLUMBING (no live consumer until H.6); a DPA /
 * privacy-law basis is an H.6 prerequisite BEFORE it is wired to real PROD data.
 * Tests mock the SDK boundary — no real document egresses in DEV/CI.
 */
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const zod_1 = require("zod");
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
const audit_critical_1 = require("../audit-critical");
const logger = __importStar(require("../../shared/logger"));
const anthropic_client_1 = require("./anthropic-client");
const ANTHROPIC_KEY = (0, params_1.defineSecret)(config_1.ANTHROPIC_API_KEY_SECRET);
/** Stable audit action key (payload is non-PII: clientId + agreementId + collection). */
const AUDIT_ACTION = 'VERIFY_SIGNATURE_PRESENCE';
/** Supported document media types (must match the fee-agreement upload allow-list). */
const SUPPORTED_MEDIA_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
/** Hard size ceiling (bytes) — matches the fee-agreement upload cap (6MB). */
const MAX_DOCUMENT_BYTES = 6 * 1024 * 1024;
/**
 * Input schema — strict. `clientId`/`agreementId` are charset-bounded (also blocks
 * `.doc()` path traversal). `collection` defaults to `clients` (the admin-panel
 * upload path); `cases` covers the WhatsApp-bot upload path.
 */
exports.verifySignatureInputSchema = zod_1.z
    .object({
    clientId: zod_1.z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'מזהה לקוח אינו תקין.'),
    agreementId: zod_1.z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'מזהה הסכם אינו תקין.'),
    collection: zod_1.z.enum(['clients', 'cases']).optional()
})
    .strict();
/** The model's structured verdict (validated defensively after the API call). */
const signatureResultSchema = zod_1.z.object({
    clientSignaturePresent: zod_1.z.boolean(),
    lawyerSignaturePresent: zod_1.z.boolean(),
    confidence: zod_1.z.number(),
    reasoning: zod_1.z.string()
});
/** The prompt is developer-facing (English) but asks for a Hebrew `reasoning`. */
const SIGNATURE_PROMPT = 'You are reviewing a signed legal fee-agreement document (the text is in Hebrew). ' +
    'Determine ONLY whether the document VISUALLY CONTAINS: (a) a CLIENT signature, and ' +
    '(b) a LAWYER signature. This is a PRESENCE check — do NOT assess authenticity, do ' +
    'NOT judge whether a signature is genuine, only whether a signature mark is present in ' +
    'a signature area. A signature is any handwritten mark, stylized name, or sign-off in a ' +
    'signing area. Respond with: clientSignaturePresent (boolean), lawyerSignaturePresent ' +
    '(boolean), confidence (a number from 0.0 to 1.0 — your overall confidence), and reasoning ' +
    '(one or two short sentences IN HEBREW explaining what you saw). If the document is ' +
    'unreadable or unclear, set both booleans to false with a low confidence and say so in Hebrew.';
/** Structured-output schema forcing the 4-field verdict shape. */
const OUTPUT_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        clientSignaturePresent: { type: 'boolean' },
        lawyerSignaturePresent: { type: 'boolean' },
        confidence: { type: 'number' },
        reasoning: { type: 'string' }
    },
    required: ['clientSignaturePresent', 'lawyerSignaturePresent', 'confidence', 'reasoning']
};
/** Clamp any number into [0,1]; non-finite → 0. */
function clamp01(v) {
    if (!Number.isFinite(v)) {
        return 0;
    }
    return Math.min(1, Math.max(0, v));
}
/** Resolve the media type from the stored fileType, else the path extension. */
function resolveMediaType(meta) {
    const ft = typeof meta.fileType === 'string' ? meta.fileType.toLowerCase() : '';
    if (SUPPORTED_MEDIA_TYPES.includes(ft)) {
        return ft;
    }
    const path = typeof meta.storagePath === 'string' ? meta.storagePath.toLowerCase() : '';
    if (path.endsWith('.pdf')) {
        return 'application/pdf';
    }
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
        return 'image/jpeg';
    }
    if (path.endsWith('.png')) {
        return 'image/png';
    }
    if (path.endsWith('.webp')) {
        return 'image/webp';
    }
    return null;
}
/**
 * Internal handler — exported separately for direct unit testing (the SDK +
 * Storage + Firestore boundaries are mocked; no real document egresses).
 */
async function verifySignaturePresenceHandler(request) {
    // ─── (1) Auth gate (role-only admin) ──────────────────────────────────────
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
    }
    const claims = (request.auth.token ?? {});
    if (claims.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'רק מנהל מערכת רשאי לבדוק חתימות.');
    }
    const callerUid = request.auth.uid;
    // ─── (2) Input validation (Zod, strict) ───────────────────────────────────
    const parsed = exports.verifySignatureInputSchema.safeParse(request.data);
    if (!parsed.success) {
        const fieldPath = parsed.error.issues[0]?.path?.join('.') ?? 'clientId';
        logger.warn('signature.verify.invalid_input', {
            actor: { uid: callerUid },
            issueField: fieldPath
        });
        throw new https_1.HttpsError('invalid-argument', `נתונים לא תקינים: שדה "${fieldPath}". אנא נסה שוב.`);
    }
    const { clientId, agreementId } = parsed.data;
    const collection = parsed.data.collection ?? 'clients';
    // ─── (3) Resolve the entity doc + the agreement metadata (a READ, no egress) ─
    let entitySnap;
    try {
        entitySnap = await admin.firestore().collection(collection).doc(clientId).get();
    }
    catch (err) {
        const error = err;
        logger.error('signature.verify.entity_read_failed', {
            actor: { uid: callerUid },
            clientId,
            collection,
            errorCode: error.code
        });
        throw new https_1.HttpsError('unavailable', 'לא ניתן לטעון את פרטי הלקוח כעת. אנא נסה שוב.');
    }
    if (!entitySnap.exists) {
        throw new https_1.HttpsError('not-found', 'הלקוח לא נמצא במערכת.');
    }
    const entityData = (entitySnap.data() ?? {});
    const agreements = Array.isArray(entityData.feeAgreements) ? entityData.feeAgreements : [];
    const agreement = agreements.find((a) => a && a.id === agreementId);
    if (!agreement || typeof agreement.storagePath !== 'string' || agreement.storagePath.length === 0) {
        throw new https_1.HttpsError('not-found', 'הסכם שכר הטרחה לא נמצא עבור לקוח זה.');
    }
    const mediaType = resolveMediaType(agreement);
    if (!mediaType) {
        throw new https_1.HttpsError('failed-precondition', 'סוג הקובץ אינו נתמך לבדיקת חתימה. נדרש קובץ PDF או תמונה (JPG/PNG/WEBP).');
    }
    const storagePath = agreement.storagePath;
    // Confused-deputy guard (devils-advocate #4): the Admin SDK bypasses Storage
    // rules, so a poisoned feeAgreements[].storagePath could otherwise make this CF
    // download an arbitrary bucket object. Pin the path to the RESOLVED entity's
    // own agreements folder — the only shape any legitimate uploader writes.
    const expectedPrefix = `${collection}/${clientId}/agreements/`;
    if (!storagePath.startsWith(expectedPrefix)) {
        logger.error('signature.verify.unexpected_storage_path', {
            actor: { uid: callerUid },
            clientId,
            agreementId,
            collection
        });
        throw new https_1.HttpsError('failed-precondition', 'נתיב קובץ ההסכם אינו תקין.');
    }
    // ─── (4) AUDIT-FIRST, EGRESS-SECOND (fail-secure) ─────────────────────────
    // The access is recorded BEFORE the document is downloaded or sent to the
    // external API. If this write fails, NO document leaves the system. Payload is
    // non-PII: business ids only (never the PDF, signatures, name, or reasoning).
    try {
        await (0, audit_critical_1.logCriticalAction)(AUDIT_ACTION, callerUid, { clientId, agreementId, collection });
    }
    catch {
        // logCriticalAction already emitted audit_critical.write_failed (errorCode
        // only). Do NOT echo the error here.
        throw new https_1.HttpsError('internal', 'לא ניתן לתעד את בדיקת החתימה כעת. אנא נסה שוב או פנה לתמיכה.');
    }
    // ─── (5) Download the document from Storage (Admin SDK, trusted path) ──────
    let documentBase64;
    try {
        const [buf] = await admin.storage().bucket().file(storagePath).download();
        if (!buf || buf.length === 0) {
            throw new https_1.HttpsError('failed-precondition', 'קובץ ההסכם ריק או לא נמצא באחסון.');
        }
        if (buf.length > MAX_DOCUMENT_BYTES) {
            throw new https_1.HttpsError('failed-precondition', 'קובץ ההסכם גדול מדי לבדיקת חתימה.');
        }
        documentBase64 = buf.toString('base64');
    }
    catch (err) {
        if (err instanceof https_1.HttpsError) {
            throw err;
        }
        const error = err;
        logger.error('signature.verify.download_failed', {
            actor: { uid: callerUid },
            clientId,
            agreementId,
            errorCode: error.code
        });
        throw new https_1.HttpsError('unavailable', 'לא ניתן להוריד את קובץ ההסכם כעת. אנא נסה שוב.');
    }
    // ─── (6) Build the document/image content block + call Claude ──────────────
    const isPdf = mediaType === 'application/pdf';
    const documentBlock = isPdf
        ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: documentBase64 } }
        : { type: 'image', source: { type: 'base64', media_type: mediaType, data: documentBase64 } };
    let response;
    try {
        const client = await (0, anthropic_client_1.getAnthropicClient)(ANTHROPIC_KEY.value());
        response = await client.messages.create({
            model: config_1.SIGNATURE_CHECK_MODEL,
            max_tokens: config_1.SIGNATURE_CHECK_MAX_TOKENS,
            messages: [
                { role: 'user', content: [documentBlock, { type: 'text', text: SIGNATURE_PROMPT }] }
            ],
            output_config: { format: { type: 'json_schema', schema: OUTPUT_JSON_SCHEMA } }
        });
    }
    catch (err) {
        // NEVER echo the key or the raw SDK error/message — errorName only.
        const errorName = err instanceof anthropic_client_1.AnthropicClientError ? err.name : err?.name;
        logger.error('signature.verify.model_call_failed', {
            actor: { uid: callerUid },
            clientId,
            agreementId,
            errorName: typeof errorName === 'string' ? errorName : 'unknown_model_error'
        });
        throw new https_1.HttpsError('unavailable', 'שירות בדיקת החתימה אינו זמין כעת. אנא נסה שוב מאוחר יותר או פנה לתמיכה.');
    }
    // ─── (7) Parse + validate the structured verdict ───────────────────────────
    // Prefer the SDK's parsed_output if present; else parse the schema-constrained
    // JSON from the text block (output_config.format guarantees the response text
    // matches OUTPUT_JSON_SCHEMA). Either way the verdict is re-validated by Zod
    // below — the model output is never trusted blindly (devils-advocate #1).
    const textBlock = (response.content ?? []).find((b) => b.type === 'text' && typeof b.text === 'string');
    let verdict;
    try {
        const raw = response.parsed_output ?? JSON.parse(textBlock?.text ?? '');
        verdict = signatureResultSchema.parse(raw);
    }
    catch {
        logger.error('signature.verify.bad_model_output', {
            actor: { uid: callerUid },
            clientId,
            agreementId,
            stopReason: response.stop_reason ?? null
        });
        throw new https_1.HttpsError('internal', 'תוצאת בדיקת החתימה לא התקבלה בפורמט תקין. אנא נסה שוב או פנה לתמיכה.');
    }
    const confidence = clamp01(verdict.confidence);
    const passed = verdict.clientSignaturePresent &&
        verdict.lawyerSignaturePresent &&
        confidence >= config_1.SIGNATURE_CONFIDENCE_THRESHOLD;
    // ─── (8) Non-PII usage + outcome log (NEVER the reasoning / PDF / key) ──────
    logger.info('signature.verify.completed', {
        actor: { uid: callerUid },
        clientId,
        agreementId,
        model: config_1.SIGNATURE_CHECK_MODEL,
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        clientSignaturePresent: verdict.clientSignaturePresent,
        lawyerSignaturePresent: verdict.lawyerSignaturePresent,
        passed
    });
    return {
        clientSignaturePresent: verdict.clientSignaturePresent,
        lawyerSignaturePresent: verdict.lawyerSignaturePresent,
        confidence,
        reasoning: verdict.reasoning,
        passed
    };
}
// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
exports.verifySignaturePresence = (0, https_1.onCall)({
    region: config_1.REGION,
    secrets: [ANTHROPIC_KEY],
    // Containment ceiling (devils-advocate #5 🔴): the codebase's FIRST paid
    // external-API + PII-egress CF. With no App Check / rate-limit anywhere (the
    // §7.6 10-user admin-trust model), maxInstances bounds the blast radius of a
    // buggy admin loop or a stolen admin token — capping BOTH concurrent paid
    // Anthropic calls AND the rate at which client documents can egress.
    maxInstances: 3
}, verifySignaturePresenceHandler);
//# sourceMappingURL=verify-signature-presence.js.map