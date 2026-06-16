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

/** Sanitized init error — carries NO key fragment (PUBLIC-repo discipline). */
export class AnthropicClientError extends Error {
  constructor() {
    super('anthropic_client_init_failed');
    this.name = 'AnthropicClientError';
  }
}

/** Token-usage fields we read for non-PII cost logging (others ignored). */
export interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/** A response content block (we only ever read text blocks). */
export interface AnthropicContentBlock {
  type: string;
  text?: string;
}

/** The slice of the Messages response H.5 consumes. */
export interface AnthropicMessageResponse {
  content?: AnthropicContentBlock[];
  usage?: AnthropicUsage;
  stop_reason?: string | null;
  /** Present only on SDK helpers that pre-parse structured output (defensive). */
  parsed_output?: unknown;
}

/** The slice of the SDK client H.5/H.8 use. */
export interface AnthropicClient {
  messages: {
    create: (params: unknown) => Promise<AnthropicMessageResponse>;
  };
}

/**
 * Lazily construct an Anthropic client for the given API key.
 * @param apiKey - the Claude API key (from Secret Manager via defineSecret)
 * @returns a minimal-typed client
 * @throws {AnthropicClientError} if the key is missing or construction fails —
 *         never echoes the key or the raw SDK error.
 */
export async function getAnthropicClient(apiKey: string): Promise<AnthropicClient> {
  if (typeof apiKey !== 'string' || apiKey.length === 0) {
    throw new AnthropicClientError();
  }
  let mod: unknown;
  try {
    mod = await import('@anthropic-ai/sdk');
  } catch {
    // Module resolution failure (e.g. dep not installed) — never echo details.
    throw new AnthropicClientError();
  }
  const AnthropicCtor =
    (mod as { default?: unknown }).default ?? (mod as unknown);
  try {
    const Ctor = AnthropicCtor as new (opts: { apiKey: string }) => unknown;
    return new Ctor({ apiKey }) as unknown as AnthropicClient;
  } catch {
    // Bad key shape / constructor throw — sanitized, no fragment in logs.
    throw new AnthropicClientError();
  }
}
