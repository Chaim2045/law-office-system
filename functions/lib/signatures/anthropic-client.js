"use strict";
/**
 * anthropic-client.ts — lazy, sanitized Anthropic (Claude) SDK accessor (H.5)
 * ─────────────────────────────────────────────────────────────────────────────
 * The FIRST Anthropic integration in this codebase. A thin, reusable wrapper so
 * the H.5 signature-presence check (and later H.8 AI chat) share ONE place that:
 *   1. LAZY-imports `@anthropic-ai/sdk` inside the call (mirrors the
 *      @google-cloud/bigquery lazy-import in H.1.c export-sales-to-bigquery.ts) —
 *      `index.js` fans out to ~67 CFs, so a top-level import would bloat every
 *      cold start. The SDK loads only when a signature check actually runs.
 *   2. Wraps construction so a bad/empty key surfaces as a SANITIZED error class
 *      carrying NO key material (mirrors TofesMecherCredentialError in
 *      tofes-mecher/app.ts) — the repo is PUBLIC and Cloud Logging is
 *      role-discoverable, so the API key must never reach a log line.
 *
 * Minimal STRUCTURAL types (not a top-level `import type` from the SDK) keep the
 * import lazy and decouple the build from SDK type drift — same technique as the
 * BqClient interfaces in export-sales-to-bigquery.ts. We only model the surface
 * H.5/H.8 use: `messages.create(...)` and the usage/content fields we read.
 */
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
exports.AnthropicClientError = void 0;
exports.getAnthropicClient = getAnthropicClient;
/** Sanitized init error — carries NO key fragment (PUBLIC-repo discipline). */
class AnthropicClientError extends Error {
    constructor() {
        super('anthropic_client_init_failed');
        this.name = 'AnthropicClientError';
    }
}
exports.AnthropicClientError = AnthropicClientError;
/**
 * Lazily construct an Anthropic client for the given API key.
 * @param apiKey - the Claude API key (from Secret Manager via defineSecret)
 * @returns a minimal-typed client
 * @throws {AnthropicClientError} if the key is missing or construction fails —
 *         never echoes the key or the raw SDK error.
 */
async function getAnthropicClient(apiKey) {
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
        throw new AnthropicClientError();
    }
    let mod;
    try {
        mod = await Promise.resolve().then(() => __importStar(require('@anthropic-ai/sdk')));
    }
    catch {
        // Module resolution failure (e.g. dep not installed) — never echo details.
        throw new AnthropicClientError();
    }
    const AnthropicCtor = mod.default ?? mod;
    try {
        const Ctor = AnthropicCtor;
        return new Ctor({ apiKey });
    }
    catch {
        // Bad key shape / constructor throw — sanitized, no fragment in logs.
        throw new AnthropicClientError();
    }
}
//# sourceMappingURL=anthropic-client.js.map