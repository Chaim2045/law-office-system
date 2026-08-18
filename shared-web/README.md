# shared-web/ — cross-app SSOT for frontend modules

**KEEP — safelisted. Do not delete.** This directory is the single canonical
source for JS modules shared between `apps/admin-panel` and `apps/user-app`.

## Why this exists

The two frontend apps deploy to two Netlify origins with **disjoint publish
roots** (`apps/user-app` and `apps/admin-panel`). A `<script src="js/…">`
resolves against its own serving origin's root, so **no single physical file
can be shared by reference** — see `docs/PLAN-SHARED-CODE-MECHANISM.md` §0.1.

The SSOT is therefore a **build-emit**: one canonical source lives here, under
`shared-web/src/**`, and `emit.js` writes a **byte-identical copy** into BOTH
apps' `js/` trees at the same sub-path, then stamps a **content-hash `?v=`
cache-bust token** on every referencing `<script src>` across ALL html pages of
both apps.

The emitted copies are **committed to git** (matching the house's
`functions/lib/`-in-git model), and a CI drift-guard
(`tests/unit/shared/shared-web-emit.sync.test.ts`) fails the build if any
committed copy differs from a fresh emit or carries a wrong token.

## The one workflow

1. **Edit ONLY files under `shared-web/src/**`.** This is the single place a
   shared module changes.
2. Run **`npm run emit:shared`**.
3. **Commit** the canonical source **AND** both emitted copies under
   `apps/*/js/**` **AND** the `?v=` token changes in the html — all together, in
   one PR.

## NEVER

- **Never edit the emitted copies** under `apps/admin-panel/js/**` or
  `apps/user-app/js/**` for a shared module. They are generated. Edit the
  canonical source and re-emit. The drift-guard fails CI if you edit a copy.
- **Never hand-edit the `?v=` token** of a shared module's `<script src>`. The
  emit owns those tokens (content hash); a hand token will fail the drift-guard.
- **Always reference a shared module with the bare `js/<subpath>` form** —
  exactly `src="js/modules/idle-timeout-manager.js"`. The emit only retokenizes
  references written in that form (`emit.js` `refRegExp`). A page that referenced
  a shared module via `./js/…`, `/js/…`, or any relative-subdir path would be
  **silently NOT retokenized AND silently NOT flagged** by the drift-guard — it
  would ship an un-busted (or wrong) token against an `immutable`-cached file.
  Match the existing `js/<subpath>` convention on every referencing page.

## Cache-bust token

The token is `?v=sh-<first 8 hex of sha256(emitted bytes)>`. Same bytes →
same token; changed bytes → new token. This makes a stale `immutable`-cached
copy impossible for shared modules (the failure mode `update-cache-busting.js`
could not prevent — it only touches the two `index.html` files).

## Commands

| Command | What |
|---|---|
| `npm run emit:shared` | Emit copies + rewrite tokens (writes the repo tree). |
| `npm run verify:shared` | Drift-guard check — no writes; exit 1 on any mismatch. |
| `npm test` | Runs the drift-guard test (rides the standard vitest suite). |

## Registered modules

The registry is the `MODULES` array in `emit.js`. Currently:

- `modules/idle-timeout-manager.js` (defines `window.IdleTimeoutManager`)
- `modules/work-hours-calculator.js` (defines `window.WorkHoursCalculator`)
- `shared/business-rules-adapter.js` (defines `window.BUSINESS_RULES`)
- `shared/holidays-cache.js` (defines `window.WORK_HOURS_HOLIDAYS_MAP`)
- `shared/work-hours-constants.js` (defines `window.WORK_HOURS_CONSTANTS`)
- `core/system-constants.js` (defines `window.SYSTEM_CONSTANTS`)
- `core/config-loader.js` (defines `window.SystemConfigLoader`) — **parameterized**
- `modules/logger.js` (defines `window.Logger`) — **parameterized**

## Per-app parameterization (`APP_CONTEXT`)

Most shared modules emit **byte-identical** into both apps. A few legitimately
differ by app (e.g. `config-loader` — the admin panel tracks a config version and
exposes `get()`/`getVersion()` + verbose logs that the user app does not need).

These express the divergence from ONE canonical source via an **emit-injected
constant**. The canonical carries a sentinel line:

```js
const APP_CONTEXT = /*__APP_CONTEXT__*/ 'user';
```

`emit.js` replaces the literal per target — `'admin'` when emitting into
`apps/admin-panel/js/…`, `'user'` when emitting into `apps/user-app/js/…`.
App-specific behavior is then gated behind `if (APP_CONTEXT === 'admin')` etc.
The default value (`'user'`) is fail-lean: any value other than the exact
`'admin'` literal keeps the admin-only surface OFF.

**Consequence:** a parameterized module's two emitted copies have **different
bytes** and therefore **different `?v=sh-…` tokens** (one per app). This is
correct and expected — the emit computes tokens per target, and the drift-guard
asserts the injected literal + the per-target token on each copy. Modules without
the sentinel are unaffected: their two copies stay byte-identical with one shared
token.

`update-cache-busting.js` is left intact for all **non-shared** refs; the emit
only owns the tokens of the modules it emits.
