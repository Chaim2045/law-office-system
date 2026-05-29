# FUNCTIONS — LOCAL WORKING RULES

## SCOPE
These rules apply only when working inside `functions/`.

They are added on top of the root CLAUDE.md.

## ROLE
This area is backend-critical.

Changes inside `functions/` may affect:
- Firestore data
- client aggregates
- timesheet calculations
- triggers
- callable functions
- Admin Panel behavior
- User App behavior
- reports and audits

Assume high risk by default.

## REQUIRED MENTAL MODEL
Before proposing or changing anything in `functions/`, explicitly check:

1. What writes data?
2. What reads the data?
3. What recalculates aggregates?
4. What happens on CREATE?
5. What happens on UPDATE?
6. What happens on DELETE?
7. Is there any fallback logic?
8. Could there be drift between levels of truth?
   - entry level
   - package level
   - stage level
   - service level
   - client aggregate level

## DATA INTEGRITY RULE
Never treat a backend change as local-only.

Any change in `functions/` must consider:
- backward compatibility
- existing data
- rollback behavior
- deletion behavior
- update delta behavior
- concurrency
- transaction safety
- audit/reconciliation scripts

If any of these were not checked:
say explicitly: "אין לי ודאות".

## SOURCE OF TRUTH RULE
When hours / balances / aggregates are involved, explicitly identify:
- what is the source of truth
- what is derived data
- where inconsistency may appear

If source of truth is unclear:
stop and state it clearly.

## BEHAVIORAL CHANGE RULE
If a change turns a flow from:
- strict/fail-safe
to
- fallback/best-effort

you must explicitly call it a behavioral change.

Do not present it as a small fix.

## VALIDATION MINIMUM FOR FUNCTIONS
For meaningful backend changes, minimum validation thinking must include:
- CREATE path
- UPDATE path
- DELETE path
- regression on normal happy path
- cross-system impact
- data integrity risk
- audit/reconciliation impact

## SYSTEM_STATUS RULE (LOCAL)
Never update SYSTEM_STATUS.md from work inside `functions/` unless Haim explicitly approved it.

The file path is:
`c:\Users\haim\Projects\law-office-system\SYSTEM_STATUS.md`

## STYLE
- Be exact
- Be skeptical
- Do not minimize backend risk
- Do not assume a fix is safe just because syntax looks correct

## TYPESCRIPT PATH FOR NEW BACKEND CODE (PR-META-6, 2026-05)

**All new Cloud Functions backend code lives in `functions/src-ts/` and is written in TypeScript.**

### What this means in practice

- **New module?** Create it as `functions/src-ts/<module-name>.ts`. Compile via `npm run build:ts` (from `functions/`). Output lands in `functions/lib/`. Import in `functions/index.js` via `require('./lib/<module-name>')`.
- **Existing JS module?** Stays as JS. Do NOT migrate it as a side effect of unrelated work. A separate PR with explicit motivation is required.
- **Tests** for new code: `functions/src-ts/__tests__/<module>.test.ts`. Jest with `ts-jest` runs them via the `src-ts` project in `functions/jest.config.js`.
- **Tests** for existing code: `functions/tests/<module>.test.js`. Jest runs them via the `legacy-js` project — same as before META-6.

### Strict bar for `functions/src-ts/**`

See `docs/ENGINEERING_BAR.md` for the full standard. Highlights:
- TypeScript strict mode (`strict: true`, `allowJs: false`)
- ESLint with 0 errors enforced (warnings reported but not blocking)
- `no-restricted-syntax` forbids `console.*` — use `require('../shared/logger')` shim
- Zod for input/output validation on callables
- v2 Cloud Functions (`firebase-functions/v2/*`) for all new endpoints
- `defineSecret` for v2 secrets; `process.env.X` for v1 callables that aren't being migrated
- Test coverage target: 60% to start, growing to 80%

### What NEVER changes

- The existing `functions/*.js` files keep working unchanged.
- The existing `functions/tests/` Jest suite keeps running on Jest defaults (now via the `legacy-js` project).
- `functions/test/setup.js` is sacred — DO NOT modify (it mocks `global.console` for the existing 38 tests; changing it would leak data to the public CI log).
- `firebase.json` deploy config is unchanged. Compiled TS output in `functions/lib/` deploys naturally.

### Where to find canonical examples

- Logger shim: `functions/shared/logger.js`
- TS config: `functions/src-ts/tsconfig.json`
- Sample test asserting "no writes": `functions/src-ts/__tests__/verify-claims.test.ts`
- Audit-FIRST primitive (use for every critical write path): `functions/src-ts/audit-critical.ts` (`logCriticalAction` + `logCriticalActionInTxn`)
- Engineering standard: `docs/ENGINEERING_BAR.md`
