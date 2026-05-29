# Engineering Bar — Backend Code

**Introduced by:** PR-META-6 (2026-05)
**Applies to:** All new Cloud Functions backend code starting from Pre-H.0.0.B onwards.
**Does NOT apply to:** Existing JS in `functions/*.js` — no rewrites mandated by this document.

---

## Why this exists

The law-office-system is being prepared for commercial sale (PRODUCT-GRADE Rule, `_PRODUCT-GRADE-GATES.md`). Internal-tool tooling — vanilla JS, manual smoke tests, `console.log` everywhere — is acceptable for the existing 6-month-old production codebase but not for the 40+ PRs that will land in the AI Management Layer initiative.

Rather than rewrite the existing code (high risk, no business value), we set a higher bar for code that doesn't exist yet. Two codebases coexist: the legacy JS, and the new TS under `functions/src-ts/`.

---

## The bar (mandatory for new backend code)

### 1. Language

- **TypeScript** in `functions/src-ts/`. Strict mode (already inherited from root `tsconfig.json` — `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`).
- New JS files in `functions/` are **discouraged but not forbidden** — there are reasonable cases (a small one-off script, a Firebase Functions config helper). When you write one, document why TS wasn't the right call.
- Existing JS files stay as JS. Do not migrate without a separate PR with clear motivation.

### 2. Input/output validation

- **Zod** for callable function inputs AND outputs. Define the schema, then derive the TS type:

  ```typescript
  import { z } from 'zod';

  const InputSchema = z.object({
    salesRecordId: z.string().min(1),
    dryRun: z.boolean().optional().default(true)
  });
  type Input = z.infer<typeof InputSchema>;

  export const myCallable = functions.https.onCall((data, context) => {
    const input = InputSchema.parse(data); // throws ZodError on invalid
    // ... use input safely typed
  });
  ```

- Catch `ZodError` and translate to Hebrew `HttpsError('invalid-argument', ...)` for the caller (G1: customer-visible errors are professional).

### 3. Logging

- **Use `functions/shared/logger.js`** — the structured-logger shim. NEVER `console.log/info/warn/error` in new code:

  ```typescript
  import logger from '../../shared/logger';
  logger.info('service_creation_approved', { clientId, serviceId, actorUid });
  ```

- Fields go in the object. Don't string-interpolate sensitive data into the message.
- **PUBLIC REPO REMINDER:** the repo is public. CI logs are world-readable. Never log: Twilio creds, auth tokens, full request payloads, raw FirebaseError messages.

### 4. Secrets

- **`defineSecret`** for any new v2 callable / trigger that reads sensitive config:

  ```typescript
  import { defineSecret } from 'firebase-functions/params';
  const TWILIO_SID = defineSecret('TWILIO_ACCOUNT_SID');

  export const myFn = onCall({ secrets: [TWILIO_SID] }, (req) => {
    const sid = TWILIO_SID.value(); // runtime fetch from Secret Manager
  });
  ```

- For v1 callables — `process.env.X` (the v1 callable runtime doesn't support `defineSecret` directly). Document this clearly in the file.
- **NEVER** read from `functions.config()` — it's deprecated by Firebase and dumps to public CI logs if anyone runs `firebase functions:config:get`.

### 5. Testing

- **Jest with `ts-jest`** under `functions/src-ts/__tests__/`. Uses the new `functions/jest.config.js` projects setup (`src-ts` project, distinct from `legacy-js`).
- Sample reference test: `functions/src-ts/__tests__/verify-claims.test.ts` (PR-META-6 deliverable).
- Tests use `functions/test/setup-ts.js` (does NOT mock global.console — structured logger assertions are possible).
- **What to test:**
  - Happy path
  - Each error branch (auth-missing, permission-denied, invalid-argument)
  - Side-effect assertions (e.g., "this read-only function performs ZERO writes" — see PR-META-6 sample)
  - Edge cases that exposed bugs in the past
- **Coverage target:** start at 60% line coverage for new code. Raise to 80% as the codebase matures. Don't game the metric — a 100%-covered function with assertion-free tests is worse than 60% with real assertions.

### 6. Cloud Functions generation

- **v2 (`firebase-functions/v2/*`)** for all new callables, triggers, and HTTP endpoints.
- v1 (`functions.https.onCall`) stays only for code we're not touching. Don't convert v1 → v2 unless there's a feature reason.
- Reason for v2: native `defineSecret`, better cold start, structured logging integration, Google's go-forward platform.

### 7. CI gate

- The `pull-request.yml` workflow runs typecheck + lint + tests on every PR.
- For now: **informational only** — failing the new gate doesn't block merge. After 7-14 days of consistent green runs, Haim flips the new check to required in GitHub branch protection.
- **Public-repo safety:** never `run: echo ${{ secrets.X }}`, no `set -x` near secret usage, no `env | sort` in any step. Don't run on `pull_request_target` from forks — only `pull_request`.

### 8. Error handling

- Every `HttpsError` thrown to the caller has a Hebrew message + actionable next step ("נסה שוב" / "פנה למנהל"). Never `[object Object]`, `undefined`, raw `FirebaseError`, or stack traces.
- Internal errors go to `console.error` / `logger.error` with structured context — they're for support, not for the user.

### 9. Audit & monitoring

- Any write path (CREATE / UPDATE / DELETE) gets a structured log on success AND failure (G3).
- Critical mutations (claim changes, service creation, emergency overrides) use `functions/shared/logger.js` `info` with action name. Critical AUDIT mutations MUST use the canonical `logCriticalAction` / `logCriticalActionInTxn` helpers from `functions/src-ts/audit-critical.ts` (Pre-H.0.0.C). The helpers write to `audit_log` with `schemaVersion:1`, validate `actorUid` (human UID or `sys:<name>` system actor), and throw on Firestore failure so the caller aborts the mutation (fail-secure). No new local `writeAuditOrThrow` clones — that pattern is now canonicalized.

### 10. Documentation

- Every new module exports a JSDoc/TSDoc block explaining:
  - What it does
  - Who can call it (role gating)
  - What writes it performs (or "ZERO writes — read-only")
  - What audit log entries it produces
- Update `functions/CLAUDE.md` when you add a new pattern that others should follow.

---

## What's NOT required (yet)

These are good practices for the future but not enforced in META-6:

- 100% test coverage — start at 60%, grow
- E2E tests in `functions/` — Playwright at root covers full-system E2E for now
- OpenTelemetry / Datadog — Cloud Logging is sufficient for the current volume
- App Check on callables — series wrap-up of Pre-H.0.0
- Codeowners file — small team, not yet needed
- Mutation testing — overkill for current size

---

## How META-6 itself enforces this

| Bar item | Enforcement mechanism |
|---|---|
| TypeScript | `functions/src-ts/tsconfig.json` with `strict: true`, `allowJs: false` |
| ESLint | New block in `eslint.config.js` for `functions/src-ts/**/*.ts` — `0 errors enforced`, warnings reported |
| Logger | `no-restricted-syntax` ESLint rule forbids `console.*` in `functions/src-ts/` |
| Zod | Added to `functions/package.json` dependencies; no enforcement — convention-driven |
| Secrets | Deprecated `functions.config()` removed from `whatsapp/index.js` as part of this PR |
| Tests | New `functions/jest.config.js` with `src-ts` project + sample test |
| CI gate | New steps in `pull-request.yml` (typescript job + code-quality job) — informational for first 7-14 days |
| Errors | PR rubric M5 (Hebrew customer-facing) + G1 PRODUCT-GRADE Gate |

---

## When the bar gets RAISED

Quarterly review by Haim + Lead Agent:

- Look at the dormant warnings (the `// @ts-expect-error` and ESLint warnings accumulating in `functions/src-ts/`). If patterns repeat, tighten the rule.
- Check coverage. If steady at 80%+ for 6 months, raise the threshold.
- Check critical bugs. If a class of bug isn't caught by current tests, add it as a mandatory test category.

The bar is a moving target — but it only moves UP, never down.
