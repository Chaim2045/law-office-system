# `functions/src-ts/` — TypeScript Backend Code

**Introduced in:** PR-META-6 (Engineering Bar Elevation)
**Scope:** ALL new Cloud Functions backend code, starting from Pre-H.0.0.B onwards.
**Constraint:** Existing JS in `functions/*.js` is NEVER migrated here. This directory is for new code only.

## Why this exists

The AI Management Layer initiative (40+ PRs) introduces backend code that must be production-grade from day one. Vanilla JS without compile-time type safety, schema validation, or structured logging is acceptable for the existing codebase but not for new commercial-grade work.

## What lives here

- `index.ts` — module entry points exported via compiled `functions/lib/`
- `schemas/` — Zod input/output schemas for callable functions
- `services/` — pure business logic, no Firebase imports
- `__tests__/` — Jest tests using `ts-jest`, mirroring the existing `functions/tests/` pattern

## How it compiles

Run from project root or `functions/`:

```bash
cd functions
npm run build:ts        # compiles src-ts/ → lib/
npm run typecheck:ts    # tsc --noEmit on src-ts/
```

Or rely on the existing root scripts (`npm run type-check`, `npm run compile-ts`) — the root `tsconfig.json` already includes `functions/**/*.ts`, so type-checking covers this directory automatically.

## How it deploys

Compiled output lives in `functions/lib/`. Firebase deploy includes this directory (not gitignored). New modules are imported in `functions/index.js` via:

```javascript
// in functions/index.js
const { newCallable } = require('./lib/some-module');
exports.newCallable = newCallable;
```

## How tests run

Tests in `__tests__/` are picked up by Jest via the new `functions/jest.config.js`. They use `ts-jest` for on-the-fly compilation. They use a separate setup file (`functions/test/setup-ts.js`) that does NOT mock `global.console` (so structured-logger assertions work).

Existing Jest tests in `functions/tests/` continue to use `functions/test/setup.js` unchanged.

## The Engineering Bar

See `docs/ENGINEERING_BAR.md` for the full standard applied to code in this directory.
