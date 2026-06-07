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
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
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
 * @throws TofesMecherCredentialError if the key JSON is malformed (sanitized —
 *         no input fragment leaks to logs).
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
    try {
        const parsed = JSON.parse(saKeyJson);
        credential = admin.credential.cert(parsed);
    }
    catch {
        // Deliberately swallow the original error — its message/stack may contain
        // a fragment of the key. Re-throw a sanitized error (no input material).
        throw new TofesMecherCredentialError();
    }
    // Synchronous assignment, no await before it → race-free under the event loop.
    cachedApp = admin.initializeApp({ credential, projectId: config_1.TOFES_MECHER_PROJECT_ID }, config_1.TOFES_MECHER_APP_NAME);
    return cachedApp;
}
/**
 * Test-only: reset the module singleton so each test starts clean. NOT for
 * production use (production wants the warm-reuse memo).
 */
function __resetTofesMecherAppForTests() {
    cachedApp = null;
}
//# sourceMappingURL=app.js.map