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

`update-cache-busting.js` is left intact for all **non-shared** refs; the emit
only owns the tokens of the modules it emits.
