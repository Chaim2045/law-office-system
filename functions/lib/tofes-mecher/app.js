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
exports.TofesMecherCredentialError = void 0;
exports.getTofesMecherApp = getTofesMecherApp;
exports.getTofesMecherReader = getTofesMecherReader;
exports.__resetTofesMecherAppForTests = __resetTofesMecherAppForTests;
/**
 * tofes-mecher named-app init (Phase 2 H.0)
 * ─────────────────────────────────────────────────────────────────────────────
 * Initializes (once) a SECOND firebase-admin app pointed at the tofes-mecher
 * project (`law-office-sales-form`), using a cross-project service-account key.
 * The default unnamed app remains the MAIN project — this NAMED app is used
 * ONLY for reading tofes-mecher Firestore.
 *
 * ─── Concurrency-safe singleton (devils-advocate H.0 Attack #1) ─────────────
 * The naive pattern — `try admin.app(NAME) catch → initializeApp(NAME)` — races
 * under concurrent invocations (gen-2 functions allow many concurrent calls per
 * instance): two cold calls both hit the catch and both call initializeApp →
 * the second throws `app/duplicate-app` and crashes one invocation. Instead we
 * use a module-level memo `cachedApp`. Node's event loop is single-threaded and
 * there is NO `await` between the null-check and the assignment, so the
 * synchronous `cachedApp = admin.initializeApp(...)` is race-free. The try/catch
 * around `admin.app()` only handles warm-instance reuse where the named app
 * already exists from a prior invocation on the same instance.
 *
 * ─── Credential safety (devils-advocate H.0 Attack #2) ──────────────────────
 * `JSON.parse(saKeyJson)` + `cert(...)` can throw on a malformed secret. The
 * raw SyntaxError can echo a fragment of the input (the key!) into the message,
 * and Cloud Logging is project-readable (PUBLIC-repo discipline). So the
 * parse+cert is wrapped and re-thrown as a SANITIZED error carrying NO input
 * fragment. Callers log only the sanitized message + error code — never the
 * original error's `.message`/`.stack`.
 */
const crypto_1 = require("crypto");
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
const logger = __importStar(require("../../shared/logger"));
/** Module-level singleton — survives warm invocations on the same instance. */
let cachedApp = null;
/** Thrown when the SA key cannot be parsed/validated. Carries NO key material. */
class TofesMecherCredentialError extends Error {
    constructor() {
        super('tofes-mecher credential init failed');
        this.name = 'TofesMecherCredentialError';
    }
}
exports.TofesMecherCredentialError = TofesMecherCredentialError;
/**
 * Returns the tofes-mecher named app, initializing it once. Concurrency-safe.
 *
 * @param saKeyJson the service-account key JSON string (from
 *        `defineSecret(...).value()`). NEVER logged, NEVER persisted.
 * @returns the named firebase-admin app for tofes-mecher.
 * @throws TofesMecherCredentialError if the key JSON is malformed OR its own
 *         `project_id` is not the tofes-mecher project (both sanitized — no
 *         input fragment leaks to logs).
 */
function getTofesMecherApp(saKeyJson) {
    if (cachedApp) {
        return cachedApp;
    }
    // Warm-instance reuse: the named app may already exist from a prior call.
    try {
        cachedApp = admin.app(config_1.TOFES_MECHER_APP_NAME);
        return cachedApp;
    }
    catch {
        // Not yet initialized on this instance — fall through to init.
    }
    let credential;
    let saClientEmail = '';
    try {
        const parsed = JSON.parse(saKeyJson);
        // ─── Circuit-breaker: bind the key to the tofes-mecher project ────────────
        // The `projectId` passed to initializeApp below is a HARDCODED constant, so
        // an assertion on `app.options.projectId` would be a tautology and catch
        // NOTHING. The load-bearing check is the KEY's OWN `project_id`: if a wrong
        // key is ever placed in the secret (e.g. the MAIN-project key, or a rotated
        // key for another project), fail CLOSED here rather than authenticate as the
        // wrong principal against tofes Firestore. Sanitized (no key fragment leaks).
        if (parsed.project_id !== config_1.TOFES_MECHER_PROJECT_ID) {
            throw new TofesMecherCredentialError();
        }
        saClientEmail = typeof parsed.client_email === 'string' ? parsed.client_email : '';
        credential = admin.credential.cert(parsed);
    }
    catch (err) {
        // Our own sanitized error (wrong-project) re-throws as-is; JSON.parse / cert
        // errors are swallowed + re-thrown sanitized — their message/stack may carry
        // a fragment of the key, and Cloud Logging is project-readable.
        if (err instanceof TofesMecherCredentialError) {
            throw err;
        }
        throw new TofesMecherCredentialError();
    }
    // Synchronous assignment, no await before it → race-free under the event loop.
    cachedApp = admin.initializeApp({ credential, projectId: config_1.TOFES_MECHER_PROJECT_ID }, config_1.TOFES_MECHER_APP_NAME);
    // Init self-test signal: turns a mis-provisioned SA into an observable log
    // line. `projectId` is already asserted == tofes. We log a HASH of the SA
    // `client_email` (not the email itself) so an operator can detect a
    // wrong-but-same-project SA (a DIFFERENT SA → a different hash) WITHOUT writing
    // an email to project-readable Cloud Logging — honoring the MASTER_PLAN §2.2
    // absolute "NO email in log fields" rule. NEVER logs the key or any fragment.
    logger.info('tofes_mecher.app.initialized', {
        projectId: config_1.TOFES_MECHER_PROJECT_ID,
        clientEmailHash: saClientEmail
            ? (0, crypto_1.createHash)('sha256').update(saClientEmail).digest('hex').slice(0, 12)
            : ''
    });
    return cachedApp;
}
/**
 * Returns the READ-ONLY reader over the tofes-mecher named app. Constructs the
 * app EAGERLY (so a malformed / wrong-project key throws {@link
 * TofesMecherCredentialError} HERE, at construction — preserving the pre-reader
 * behavior where the init error surfaced before the read, so a caller's init
 * try/catch still classifies it as an init failure). The returned object is
 * frozen and exposes only reads.
 *
 * @param saKeyJson the SA key JSON (from `defineSecret(...).value()`); NEVER logged.
 */
function getTofesMecherReader(saKeyJson) {
    const app = getTofesMecherApp(saKeyJson);
    return Object.freeze({
        readDoc: (collection, docId) => app.firestore().collection(collection).doc(docId).get(),
        readCollection: (collection) => app.firestore().collection(collection).get()
    });
}
/**
 * Test-only: reset the module singleton so each test starts clean. NOT for
 * production use (production wants the warm-reuse memo).
 */
function __resetTofesMecherAppForTests() {
    cachedApp = null;
}
//# sourceMappingURL=app.js.map