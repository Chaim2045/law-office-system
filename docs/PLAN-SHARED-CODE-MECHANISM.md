# PLAN — Shared-Code Mechanism (cross-app SSOT for `apps/admin-panel` ↔ `apps/user-app`)

**Status:** DESIGN / PLAN ONLY — nothing built, nothing deployed. Read-only investigation complete; every structural claim below verified in code with file:line.
**Author:** Opus-class software architect (sub-agent), 2026-07-29.
**Scope owner on approval:** Lead Agent → Product Owner (Haim).
**Sibling to:** `docs/PLAN-SYSTEM-HEALTH-TS-MIGRATION.md` (this is the concrete design for that plan's duplication track, §3 map row 2 + §8 גל-3ג items 9-11 + §7 TS order). Governed by the same house rules (7 gates, grader, devils-advocate on high-stakes).

---

## 0. The problem, confirmed

Over 1+ year, shared-concept JS modules were **copy-pasted** between the two frontend apps because **there is no shared-code mechanism**. The copies then drifted independently. This is the exact class of bug TypeScript + an SSOT is meant to kill (`PLAN-SYSTEM-HEALTH-TS-MIGRATION.md` §5: "TS נועל את הניקוי").

### 0.1 Verified structural constraint — why no single physical file can be shared by reference

Two apps, two Netlify sites, **disjoint publish roots**:

- Root `netlify.toml:21` → `publish = "apps/user-app"` (main app; `gh-law-office-system.netlify.app`).
- `apps/admin-panel/netlify.toml:19` → `publish = "."` with base dir `apps/admin-panel` set in the Netlify dashboard (admin; `admin-gh-law-office-system.netlify.app`).
- Root `netlify.toml:70-74` actively **301-redirects** `/apps/admin-panel/*` off the main origin.

A `<script src="js/…">` resolves against the **serving origin**. `apps/user-app/` is one origin's root; `apps/admin-panel/` is the other origin's root. Neither origin can see the other's tree. **Therefore a true SSOT requires a BUILD STEP that emits one canonical source into BOTH publish roots** — there is no symlink/reference trick that survives two separate Netlify deploys. This is the load-bearing fact the whole mechanism is built around.

### 0.2 Verified build reality

- Root build command (`netlify.toml:25`, production-stable path): `npm run cache-bust && npm run type-check && npm run compile-ts`.
- `package.json:11` `cache-bust` → `node update-cache-busting.js`; `:12` `compile-ts` → `npx tsc`; `:10` `type-check` → `npx tsc --noEmit`.
- Root `tsconfig.json:40-45` `include` = `["*.ts", "apps/user-app/**/*.ts", "types/**/*.ts", "functions/**/*.ts"]` → **`apps/admin-panel/**` is NOT in the TS program at all.** The admin panel is 100% classic `<script>`/`window`-global JS. The user-app has a partial TS build emitting to `apps/user-app/dist` (`tsconfig.json:13`).
- `update-cache-busting.js:34-37` rewrites `?v=…` tokens **only in `apps/user-app/index.html` and `apps/admin-panel/index.html`** — nothing else.

### 0.3 Verified cache-bust reality — worse than "tokens exist"

Tokens are **manual, per-page, and inconsistent**. The same physical file is referenced with different tokens from different pages:

| File | Referencing page:line | Token |
|---|---|---|
| `idle-timeout-manager.js` | `apps/admin-panel/index.html:229` | `?v=e02c45c` |
| `idle-timeout-manager.js` | `apps/admin-panel/workload.html:84` | `?v=bf8073e` |
| `idle-timeout-manager.js` | `apps/user-app/index.html:1251` | `?v=esc5fix` |
| `holidays-cache.js` | `apps/admin-panel/index.html:256` | `?v=e02c45c` |
| `holidays-cache.js` | `apps/admin-panel/workload.html:104` | `?v=5.2.0` |
| `work-hours-calculator.js` | `apps/admin-panel/workload.html:105` | `?v=5.2.0` |
| `service-card-renderer.js` | `apps/admin-panel/clients.html:620` | `?v=20260621-escapehtml-pr3a` |
| `service-card-renderer.js` | `apps/user-app/index.html:1290` | `?v=esc5fix` |

Consequences the mechanism must respect:
- `update-cache-busting.js` touches only the two `index.html` files, so **any shared module loaded from a non-index admin page (`clients.html` has 31 `?v=` refs, `workload.html` has 20) is never auto-busted** — its token is hand-edited per PR.
- Netlify serves `/js/*` `immutable, max-age=31536000` (`netlify.toml:104-106`, `apps/admin-panel/netlify.toml:108-111`), so a **wrong/stale token pins a stale file in the browser forever**. Cache-bust correctness is a hard safety property, not a nicety.

### 0.4 The 11 duplicated pairs — measured, not assumed

Same relative path under `js/` in each app. Diffs measured with `diff`/`cmp` (line counts = `wc -l`):

| # | Path (under `js/`) | admin LOC | user LOC | Diff | Class |
|---|---|---|---|---|---|
| 1 | `modules/idle-timeout-manager.js` | 496 | 496 | **byte-identical** | trivial |
| 2 | `modules/work-hours-calculator.js` | 391 | 391 | **byte-identical** | trivial |
| 3 | `shared/business-rules-adapter.js` | 59 | 59 | **byte-identical** | trivial (already drift-guarded — see §1.4) |
| 4 | `shared/holidays-cache.js` | 430 | 430 | **byte-identical** | trivial |
| 5 | `shared/work-hours-constants.js` | 92 | 92 | **byte-identical** | trivial |
| 6 | `core/system-constants.js` | 167 | 167 | comment-only (header line "Admin Panel Adapter" vs "User App Adapter", lines 2-3) | trivial-after-header-normalization |
| 7 | `managers/AlertEngine.js` | 541 | 541 | 1 real diff — line 176 `task.status === 'הושלם'/'בוטל'` (admin) vs `=== 'completed'/'cancelled'` (user, **buggy**) | **out — deleted separately** |
| 8 | `core/config-loader.js` | 108 | 79 | admin superset: `version`, `.get(path)`, `getVersion()`, verbose logs | intentionally-parameterized |
| 9 | `modules/logger.js` | 280 | 308 | user-app appends a "PROD Console Override" block (silences `console.log/info/debug` in prod; admin lacks it) | intentionally-parameterized |
| 10 | `modules/service-card-renderer.js` | 413 | 414 | 4 hunks (H1-H4, see §3.3) — live/live, mixed bugs + 1 intentional split | **bug-reconcile-first (highest stakes)** |
| 11 | `modules/client-case-selector.js` | 1700 | 1821 | 189-diff-line, unaudited | own-investigation |

AlertEngine (pair 7) is excluded from this mechanism: its user-app copy is orphaned and being deleted on the H.8.0 messaging-retire track (`HEALTH-MAP-2026-07.md` §2.2, §6.3). Once that lands, AlertEngine is a single admin-only file — no cross-app pair remains. **This plan covers the other 10 pairs.**

---

## 1. The shared-code mechanism

### 1.1 Design goals (in priority order)

1. **Zero user-visible change on introduction.** Prod is live (10 daily users, 200+ clients). The mechanism ships behavior-preserving on byte-identical pairs first.
2. **One canonical source per shared module.** Editing it is the only way to change either app's copy.
3. **The two publish roots can NEVER silently diverge again** — a CI drift-guard fails the build if they do. This is the whole point (§0).
4. **Cache-bust stays correct** across both roots and all referencing pages, including non-index admin pages (§0.3).
5. **The shared module should BE the TypeScript one** — the emit and the TS migration are the same motion, not two (see §4).

### 1.2 Chosen architecture — "canonical source + generated, committed emit + CI drift-guard"

**Canonical sources live in a new top-level `shared-web/` tree** (sibling to `apps/`, `functions/`), organized to mirror the `js/` sub-paths:

```
shared-web/
  src/
    modules/idle-timeout-manager.ts        (was .js during migration; see §4)
    modules/work-hours-calculator.ts
    shared/holidays-cache.ts
    shared/work-hours-constants.ts
    core/system-constants.ts
    ...
  README.md   (KEEP-safelisted: "edit here, never edit the emitted copies")
```

Why a NEW tree, not "pick one app's copy as canonical": neither app's `js/` may become the other's dependency (§0.1 — disjoint origins), and putting canonical inside one app's publish root would ship the canonical `.ts`/source into that origin as dead weight and invite "just edit the copy under me." A neutral `shared-web/` outside both publish roots is the only location that is symmetric and never itself served.

**The emit step** copies/compiles each canonical module into **both** `apps/admin-panel/js/…` and `apps/user-app/js/…` at the identical relative sub-path, then **stamps a content-hash cache-bust token** and rewrites every referencing `<script src>` token across **all** pages of both apps (not just the two `index.html`s — closing the §0.3 gap).

- New script: `shared-web/emit.js` (Node, no new runtime deps; uses `fs` + `crypto` only, mirroring `update-cache-busting.js`'s dependency-free style).
- New npm scripts: `emit:shared` (run emit) and `verify:shared` (drift-guard, exit non-zero on mismatch — see §1.5).
- Wired into the existing build: root `netlify.toml:25` command becomes `npm run emit:shared && npm run cache-bust && npm run type-check && npm run compile-ts`. The `main` preview and admin builds gain `npm run verify:shared` (fast, read-only). Exact wiring is a per-PR detail; the mechanism PR (§5, PR-SHARE-1) introduces it behind the drift-guard so it can't silently break a deploy.

### 1.3 Committed emit, NOT generated-at-deploy — justified

**Decision: the emitted per-app copies are committed to git (generated by `emit:shared`, then committed by the author).** This is NOT a free choice — it is forced by three verified facts:

1. **The house already made this exact call for the same reason.** `functions/lib/` (compiled TS) is committed to git, decided 2026-05-28 for "deploy determinism, no build-time dependency, transparent in PRs" (`MASTER_PLAN.md` §10). The production-stable Netlify context literally runs `echo 'dist already in git - skip build'` (`netlify.toml:47`) — **prod deploys from committed artifacts, it does not build.** A generate-at-deploy emit would be invisible on the branch that actually serves users and would break the "dist already in git" model.
2. **Reviewability.** A committed emit means the diff of a change to a shared module shows the canonical edit AND both emitted copies changing in lockstep in the same PR — a reviewer (and the grader) can see the two roots stayed in sync. A generated-at-deploy emit hides the actual shipped bytes from review (§7.6-class blindness for the price/cost flag).
3. **Cache-bust integrity.** The content-hash token (§1.6) must be present in the committed HTML so the immutable-cached `/js/*` URL is stable and correct at the moment of deploy; deriving it at deploy-time reintroduces the "different token per page" drift (§0.3) and couples correctness to the deploy environment.

**The cost of committed emit — double-write in every shared-module PR — is exactly what the CI drift-guard (§1.5) polices.** You cannot forget to re-emit: `verify:shared` fails the build if the committed copies don't match a fresh emit from canonical.

### 1.4 How each app loads the artifact

**No change to the load mechanism.** Each app keeps its existing `<script defer src="js/…?v=TOKEN">` tags pointing at its own committed copy under its own `js/` tree (verified current pattern, §0.3 table). The emit writes those copies; it does not change how they are referenced or the IIFE-`window`-global contract. This is what makes introduction zero-risk: the runtime is byte-for-byte the file that shipped before, just now sourced from canonical.

There is already a proven load-and-execute harness for these IIFE modules in a Node test context: `tests/unit/shared/business-rules.sync.test.ts:61-73` loads an IIFE adapter via `new Function('window', source)` against a fake `window`. The drift-guard reuses this exact technique where behavior (not just bytes) must be compared.

### 1.5 The CI drift-guard — the non-negotiable core

A new test, `tests/unit/shared/shared-web-emit.sync.test.ts`, modeled directly on the **already-passing** `business-rules.sync.test.ts` (which enforces byte-identity of the `business-rules-adapter.js` pair at lines 161-169, plus a function-output matrix). For every shared module the guard asserts:

1. **Byte-parity between canonical-emit and both committed copies.** Re-run the emit into a temp dir; `fs.readFileSync(...).equals(...)` the temp output against `apps/admin-panel/js/…` and `apps/user-app/js/…`. Any mismatch = someone edited a copy directly, or forgot to re-emit → **test FAILS → CI red → merge blocked.**
2. **Token presence + content-hash correctness.** For each referencing page, assert the `?v=` token on that module's `<script src>` equals the content-hash of the emitted bytes (§1.6). Catches the §0.3 "stale immutable token" bug mechanically.
3. **Behavior parity for parameterized modules (§2).** For `config-loader`/`logger`/`service-card-renderer`, byte-parity is intentionally FALSE (they differ by app-context). Instead the guard loads both emitted copies via the `new Function('window', …)` harness and asserts the shared behavior matrix agrees, and — critically — asserts the **confidentiality invariant** (§2.3): the staff-surface render never contains a price/cost token.

The guard runs in the existing root `npm test` (`package.json:20` → `vitest run`), which the CI `pull-request.yml` already executes. No new CI job needed for waves that don't touch backend. This mirrors how `business-rules.sync.test.ts` already rides the standard suite.

**This guard is the mechanism.** The emit is convenience; the guard is the guarantee that the two roots can never silently diverge again.

### 1.6 Cache-bust token strategy — content-hash, emit-stamped, all pages

Replace the hand-authored, per-page, inconsistent tokens (§0.3) for shared modules with a **content-hash token**: `?v=sh-<first8 of sha256(emitted bytes)>`. The emit script computes the hash once from the canonical output and rewrites the token on **every** `<script src="js/<module>">` across both apps' HTML (globbing all `.html`, not just `index.html`) so the same bytes always carry the same token and changed bytes always carry a new one. `update-cache-busting.js` is left intact for all non-shared refs (out of scope; it keeps doing git-hash busting on the two index files) — the emit only owns the tokens of the modules it emits, and the drift-guard (§1.5 check 2) proves it.

This is strictly safer than today: today a shared file can carry a stale token from a page the cache-bust script never touches (`workload.html`), pinning a stale `immutable` copy. Content-hash tokens make staleness impossible for shared modules.

---

## 2. Legitimate per-app divergence without re-forking

Three modules legitimately differ by app: `config-loader` (admin superset), `logger` (user-app prod console-silencing), and `service-card-renderer` H4 (management sees price; staff must NOT — `MASTER_PLAN.md` §7.6). The mechanism must express these from ONE canonical source.

### 2.1 The pattern — a compile-time/emit-time app-context flag

Each canonical module reads a single injected constant, `APP_CONTEXT`, that the emit stamps per target: `'admin'` when emitting into `apps/admin-panel/js/…`, `'user'` when emitting into `apps/user-app/js/…`. Implementation options, in preference order:

- **(A) Emit-time constant injection (preferred, works for classic-JS today).** The canonical source references a sentinel `const APP_CONTEXT = /*__APP_CONTEXT__*/ 'user';` and the emit replaces the sentinel per target. Deterministic, greppable, and the drift-guard can assert the injected value per copy. No bundler needed — fits the current no-build-for-admin reality (§0.2).
- **(B) TS build-time flag (post-migration).** Once a module is `.ts` (§4) and compiled per-target, the same constant is a typed `const APP_CONTEXT: 'admin' | 'user'`. This is the end state.

Caller-passed `options` (the module reading a flag from its call-site) is **rejected** for the confidentiality case: a caller that forgets to pass the flag would silently fall back — a fail-open leak. Emit-time injection cannot be "forgotten" at a call site.

### 2.2 Behavior branches keyed on `APP_CONTEXT`

- `config-loader`: the admin-only `version`/`.get()`/`getVersion()` methods and verbose logs live behind `if (APP_CONTEXT === 'admin')`. User-app emit still gets the same file; the extra surface is present but dormant (or tree-shaken post-TS). Net behavior identical to today.
- `logger`: the PROD-console-override block runs `if (APP_CONTEXT === 'user' && isProduction)`. Admin behavior unchanged (no silencing), user behavior unchanged (silencing). Verified today's split is exactly this (§0.4 pair 9).

### 2.3 The confidentiality case (service-card-renderer H4) — fail-SECURE by construction

Verified today (`service-card-renderer.js` diff, §3.3): the admin copy renders `פיקס ₪${price}` + hours-worked + entries-count for a fixed-price service (`apps/admin-panel/js/modules/service-card-renderer.js` ~line 279-293); the user copy renders only `שירות קבוע` with **no price, no hours, no entries** (`apps/user-app/…` ~line 292). This is the §7.6 lock: **staff surface NEVER gets price/cost.**

The canonical module must make the leak **impossible to introduce by default**. Design:

```
// canonical service-card-renderer — fixed-price branch
const SHOW_FINANCIALS = (APP_CONTEXT === 'admin');   // default-deny: any value ≠ 'admin' → false
...
if (SHOW_FINANCIALS) {
  // price + hours-worked + entries block  (management only)
} else {
  // "שירות קבוע" only  (staff surface — no ₪, no hours, no entries)
}
```

Two properties make this fail-secure:
1. **Default-deny boolean.** `SHOW_FINANCIALS` is `true` **only** for the exact literal `'admin'`. A mis-stamped, empty, or unexpected `APP_CONTEXT` yields `false` → staff-safe render. There is no code path where "flag missing/wrong" reveals price.
2. **Mechanical guard.** Drift-guard check 3 (§1.5) loads the **user** emit via the `new Function('window', …)` harness, renders a fixed-price fixture, and asserts the output HTML contains **no** `₪`, no `שעות עבודה`, no `רשומות`, and no numeric price. If a future edit flips the default or leaks a financial token into the staff branch, CI goes red **before merge**. This is the same class of mechanical §7.6 guard the codebase already uses (the profitability PRs' "cost value never reaches client console/storage/URL/toast" source-guards, `MASTER_PLAN.md` §8.5 PR4).

**Open decision surfaced, not pre-decided (§2.4 below):** H2 (remaining-hours) is a data-model question for the Product Owner, separate from H4.

---

## 3. Per-pair migration strategy

Sequence: **safe → dangerous.** Every pair that emits into `apps/admin-panel/` and touches an **admin-trusted display** (a count/status/financial value staff or partners act on) is flagged high-stakes → admin-safety checklist (`apps/admin-panel/CLAUDE.md`) + `devils-advocate`.

### 3.1 The table (all 10 in-scope pairs)

| # | Pair | Strategy | Admin-trusted display touched? | High-stakes gate | Wave |
|---|---|---|---|---|---|
| 1 | `modules/idle-timeout-manager.js` | **trivial** — adopt byte-identical into canonical, emit, drift-guard | No (session UX) | grader only | W1 |
| 2 | `modules/work-hours-calculator.js` | **trivial** — adopt byte-identical | Indirect (feeds workload; but bytes unchanged) | grader; note in PR | W1 |
| 3 | `shared/business-rules-adapter.js` | **trivial** — adopt; FOLD the existing `business-rules.sync.test.ts` byte-identity assertion into the new drift-guard (do not duplicate) | No (pure predicates) | grader only | W1 |
| 4 | `shared/holidays-cache.js` | **trivial** — adopt byte-identical | Indirect (work-day calc) | grader; note | W1 |
| 5 | `shared/work-hours-constants.js` | **trivial** — adopt byte-identical | Indirect (constants) | grader; note | W1 |
| 6 | `core/system-constants.js` | **trivial-after-header-normalization** — the only diff is the header comment (lines 2-3). Normalize the header in canonical (drop app-name from the banner), then it emits byte-identical to both | No (constants) | grader only | W1 |
| 7 | `managers/AlertEngine.js` | **OUT** — user copy deleted on H.8.0 track; becomes admin-only single file. No pair to unify | n/a | n/a — excluded | — |
| 8 | `core/config-loader.js` | **intentionally-parameterized** — `APP_CONTEXT==='admin'` gate for the superset (§2.2). Behavior-preserving both sides | No (config plumbing) | grader; behavior-parity drift-guard | W2 |
| 9 | `modules/logger.js` | **intentionally-parameterized** — `APP_CONTEXT==='user'` gate for prod console-silencing (§2.2) | No (logging) | grader; behavior-parity drift-guard | W2 |
| 10a | `modules/service-card-renderer.js` — **H1 (escape)** | **bug-reconcile-first** — canonical adopts the 5-entity `window.escapeHtml` SSOT (admin's version; user is behind, defense-in-depth only, NOT currently exploitable per brief). Requires user-app to load `escape-html.js` before this script (verify load order) | **YES** — renders client service cards (admin-trusted) | devils-advocate + admin-safety checklist | W3 |
| 10b | `modules/service-card-renderer.js` — **H2 (remaining-hours)** | **DATA-MODEL DECISION → Product Owner (§3.2).** Do NOT pre-decide. Canonical must implement whichever value the PO confirms is correct, then both apps show the SAME number | **YES** — an admin-trusted hours count | devils-advocate + PO decision gate | W3 |
| 10c | `modules/service-card-renderer.js` — **H3 (title)** | **bug-reconcile-first** — canonical adopts user's wrong-service-prevention title (`service.name || descriptor`; admin is behind — two hours-services currently render identical generic titles) | **YES** — service identity on admin cards | devils-advocate + admin-safety checklist | W3 |
| 10d | `modules/service-card-renderer.js` — **H4 (price/hours on fixed-price)** | **intentionally-parameterized (§2.3)** — `SHOW_FINANCIALS = APP_CONTEXT==='admin'`, fail-secure default-deny + mechanical staff-no-price guard | **YES** — §7.6 confidentiality | devils-advocate + confidentiality drift-guard | W3 |
| 11 | `modules/client-case-selector.js` | **own-investigation** — 189-diff-line, 1700/1821 LOC, unaudited. Full read-only per-hunk audit FIRST (classify each hunk: identical-intent / bug / intentional-split), then a dedicated checkpoint before any unify | **LIKELY** (client/case selection feeds many admin flows) | full investigation + devils-advocate | W4 |

### 3.2 OPEN DECISION for the Product Owner — service-card H2 (do NOT pre-decide)

Verified behavior today (`service-card-renderer.js` diff hunk 2):
- **admin** (`apps/admin-panel/…` ~line 77-79): remaining hours = `Σ hoursRemaining over active packages` — if there are **no active packages, the sum is 0**.
- **user** (`apps/user-app/…` ~line 79-85): same sum, BUT if there are **no active packages, it falls back to the service-level `entity.hoursRemaining`** (a non-zero number).

So for a service whose packages are all inactive, **admin shows 0 remaining, staff shows the service-level remaining** — two different admin-vs-staff truths for the same service. This is a data-model question, not a rendering choice: *when all packages are inactive, what is the true remaining-hours — 0, or the service-level residual?* The answer changes an **admin-trusted count** partners may act on. **This plan does not choose.** It is surfaced as an AskUserQuestion (Hebrew, per house convention) at the W3 checkpoint, backed by `data-investigator` + `devils-advocate` verdicts, with the two options and their trade-offs. Canonical implements the PO's answer; both apps then show the identical number.

### 3.3 service-card-renderer hunk map (for the W3 investigators)

Confirmed 4 hunks in the 59-line diff (413 admin / 414 user):
- **H1** — escape: admin `const escapeHtml = window.escapeHtml` (5-entity SSOT); user `window.safeText || tempdiv` (3-entity `& < >`). User behind. Not currently exploitable (free text → text nodes; only attribute sink is system-generated IDs) per brief — treat as defense-in-depth, still reconcile to the SSOT.
- **H2** — remaining-hours (see §3.2, DATA-MODEL → PO).
- **H3** — title: admin generic `'תוכנית שעות'` title (two hours-services look identical); user `service.name || 'שירות שעות · נותרו X'` (wrong-service-prevention). Admin behind.
- **H4** — fixed-price financials: admin shows `פיקס ₪price` + hours-worked + entries; user shows `שירות קבוע` only. **Intentional §7.6 split** → parameterized fail-secure (§2.3).

### 3.4 Admin-safety checklist (attached to every W3+ PR touching an admin card)

Per `apps/admin-panel/CLAUDE.md` (ADMIN SAFETY / AGGREGATE-DISPLAY / VALIDATION-MINIMUM). Each PR that changes an admin-rendered card MUST answer, in the PR body:
1. What data is shown, and is it raw or derived/aggregated?
2. Does this change any count/status/financial value staff or partners act on? (If yes → behavioral change, not visual.)
3. Could the admin card now disagree with backend truth or with the user-app card? (For H2, the answer is the whole point — it must AGREE post-unify.)
4. Happy / empty / loading / stale / permission states re-verified.
5. `devils-advocate` verdict cited (mandatory: admin-critical + >100-line-class change).

---

## 4. Ordering vs the JS→TS migration

**Decision: the shared mechanism ships BEFORE the TS migration of these modules, AND the emit is TS-aware from day one so the shared module BECOMES the TS module — the copy-step is never redone for TS.**

Rationale, anchored in the verified reality and the health plan:
- `PLAN-SYSTEM-HEALTH-TS-MIGRATION.md` §4 principle 5: **"לא מהגרים מה שעומדים למחוק"** and §7 orders TS by risk×frequency. Duplicated modules are the single worst TS candidates *while still duplicated* — you'd migrate two drifting copies and have to keep them in sync in a second language. **Unify first, then migrate once.**
- The health plan §5: **"TS נועל את הניקוי"** — TS is the *lock* that keeps a consolidation from re-drifting. That lock only has meaning once there is ONE canonical source to typecheck. Mechanism-first creates the thing TS then locks.
- **The emit is designed so canonical can be `.js` today and `.ts` tomorrow with no re-plumbing.** `shared-web/src/**` starts as `.js` (byte-adopted from the current copies). When a module's TS turn comes (health plan §7 order — e.g. the `apps/*/js/core/{escape-html,csv-safe,budget-status}.js` cluster is item 9; `israeli-id`/`budget-crossing` item 10), the canonical file becomes `.ts`, the emit compiles it per-target (with the `APP_CONTEXT` constant typed) into each app's `js/`, and the committed emitted artifact is now compiled JS — exactly the `functions/lib/`-committed model the house already runs (`MASTER_PLAN.md` §10). **No JS copy-step is thrown away; it graduates in place.**

So: **BEFORE** for consolidation, **WITH** for the plumbing (TS-aware emit), **the shared module IS the eventual TS module.** This directly satisfies the brief's "avoid a JS copy-step redone for TS."

Sequencing against the health plan waves: this mechanism is `PLAN-SYSTEM-HEALTH-TS-MIGRATION.md` **גל-3ג items 9-11** (duplication consolidation), which the health plan already orders AFTER גל-3א (security) and גל-3ב (dead-code) and states "**תחילה המסוכן**" (do the drifted/dangerous pairs with care). It runs **before / in parallel-background with גל-3ה** (TS migration, §7). No conflict; this plan is the concrete design for those rows.

---

## 5. Rollout — small, reversible, bar-compliant PRs

Each PR = one bar-compliant unit with its own rubric in `.claude/rubrics/`, `outcomes-grader` PASS before open, and an explicit `Rollback` section (G2). Waves gate on the prior wave's grader-PASS + (W3+) devils-advocate GO.

| PR | Title | Scope | Devils-advocate? | Rollback |
|---|---|---|---|---|
| **PR-SHARE-1** | Mechanism introduction (NO module moved) | Create `shared-web/` (empty-ish), `emit.js`, `verify:shared`, the drift-guard test skeleton, wire `emit:shared`+`verify:shared` into build. **Prove it on ONE trivial byte-identical pair (idle-timeout-manager) end-to-end**: canonical → emit → both copies byte-match current prod bytes → content-hash tokens → CI green. Zero user-visible change (emitted bytes == current bytes). | **YES** — this is the bar-level mechanism-introduction PR; it changes the build for a live system. Devils-advocate mandatory (per brief + `MASTER_PLAN.md` §3.8.4). | `git revert` — restores hand-managed copies + old tokens; no data touched. |
| **PR-SHARE-2** | W1 trivial pairs (2-6) | Adopt pairs 2,3,4,5,6 into canonical; emit; fold `business-rules.sync.test.ts` byte-check into the drift-guard; normalize `system-constants` header. Each emitted copy byte-identical to current prod (except system-constants header comment, which is display-invisible). | No (byte-preserving, non-admin-trusted); grader only. Note pair 2/4/5 feed workload/work-day calc → PR body flags "indirect." | `git revert` per pair-group. |
| **PR-SHARE-3** | W2 parameterized: `config-loader` | Canonical + `APP_CONTEXT` gate for admin superset; emit; behavior-parity drift-guard. | Recommended (behavior branch), grader minimum. | `git revert`. |
| **PR-SHARE-4** | W2 parameterized: `logger` | Canonical + `APP_CONTEXT==='user'` prod-silence gate; emit; behavior-parity guard. | Recommended; grader minimum. | `git revert`. |
| **PR-SHARE-5** | W3 investigation (read-only) | Per-hunk audit of `service-card-renderer` (confirm §3.3) + surface H2 as the PO AskUserQuestion. **No code.** Produces the W3 checkpoint. | `data-investigator` + `devils-advocate` verdicts feed the checkpoint. | n/a (read-only). |
| **PR-SHARE-6** | W3 `service-card-renderer` unify | Canonical with H1 (SSOT escape), H3 (wrong-service-prevention title), H4 (fail-secure `SHOW_FINANCIALS`), and H2 = the PO-approved value. Emit; confidentiality drift-guard (staff render has no ₪/hours/entries) + admin-safety checklist. | **YES — mandatory.** Admin-trusted display + §7.6 confidentiality + >100-line-class. | `git revert` — both copies restored atomically. G3 note: no data-mutating path (render-only). |
| **PR-SHARE-7** | W4 `client-case-selector` investigation | Full read-only per-hunk audit of the 189-diff; classify each hunk; dedicated checkpoint. **No code.** | `data-investigator` + `devils-advocate`. | n/a. |
| **PR-SHARE-8** | W4 `client-case-selector` unify | Per the PR-SHARE-7 verdict. Scope TBD by that audit — likely itself split into sub-PRs. | **YES — mandatory** (large, likely admin-trusted). | `git revert`. |

Note on TS graduation: it is NOT a wave here. Each module graduates to `.ts` in the health plan's גל-3ה §7 order, on its own PR, reusing this mechanism unchanged (§4). This plan does not schedule those; it guarantees they need no re-plumbing.

---

## 6. Risks + adversarial self-critique (top 5 + mitigations)

1. **Build-copy drift between commit and deploy** (author edits a copy directly, or edits canonical but forgets to re-emit). → **Mitigation:** `verify:shared` drift-guard (§1.5 check 1) runs in `npm test` on every PR; a stale/edited copy fails CI, blocking merge. This is the single most important control — it is *why* the mechanism exists, and it is mechanical, not reviewer-attention.
2. **Cache-bust token mismatch** (stale `?v=` pins an `immutable`-cached stale file forever; today's per-page hand tokens already do this — §0.3). → **Mitigation:** content-hash tokens stamped by the emit across **all** referencing pages (§1.6) + drift-guard check 2 asserts every page's token == content-hash of the emitted bytes. Staleness becomes impossible for shared modules; a wrong token fails CI.
3. **Committed-vs-generated confusion** (someone assumes deploy regenerates the emit, ships an un-emitted change). → **Mitigation:** decision is committed-emit (§1.3), matching the existing `functions/lib/`-in-git + `netlify.toml:47` "dist already in git — skip build" model. The drift-guard makes an un-emitted change fail CI regardless of assumption. `shared-web/README.md` (safelisted KEEP) states "edit canonical, run `emit:shared`, commit all three" as the one workflow.
4. **Breaking an app's script load order** (canonical assumes a dependency loaded first — e.g. service-card-renderer's H1 needs `window.escapeHtml` from `escape-html.js`, which admin's `clients.html:620` loads but user-app must too). → **Mitigation:** the emit does NOT change `<script>` ordering; W3 investigation (PR-SHARE-5) explicitly verifies each app loads the module's prerequisites before it, and the drift-guard's `new Function('window', …)` behavior harness runs the emitted module against a fake `window` with the expected globals absent to catch a hard dependency that would throw at load. Introduction pairs (W1) are byte-identical → same order that ships today.
5. **The confidentiality flag defaults wrong and leaks price/cost to the staff surface** (§7.6 catastrophic). → **Mitigation (defense in depth):** (a) `SHOW_FINANCIALS` is default-DENY — `true` only for the exact literal `'admin'`, so any mis-stamp yields the staff-safe render (§2.3); (b) emit-time constant injection, not caller-passed options, so it cannot be "forgotten" at a call site; (c) mechanical drift-guard renders the **user** emit and asserts the output contains no `₪`, no `שעות עבודה`, no `רשומות`, no numeric price — a leak fails CI before merge; (d) PR-SHARE-6 is mandatory-devils-advocate + admin-safety checklist. Four independent controls, the first three mechanical.

**Self-critique — where this plan is weakest:**
- The emit adds a build step to a live system's deploy path (`netlify.toml:25`). PR-SHARE-1 mitigates by proving it on one byte-identical pair with CI-green + a trivial `git revert`, but the introduction PR genuinely changes prod's build — hence its bar-level, mandatory-devils-advocate status.
- `client-case-selector` (189 diff, 1700+ LOC) is under-specified here on purpose — it needs its own investigation (PR-SHARE-7) before any strategy is credible. Committing to a unify approach now would violate "explore first, then plan."
- `APP_CONTEXT` emit-time injection is a light form of "build magic." It is greppable and drift-guarded, but a future contributor must understand it. `shared-web/README.md` documents it; the alternative (caller-passed flag) was rejected as fail-open for the confidentiality case.

---

## 7. Executive summary (for the Lead Agent → Product Owner)

**Mechanism.** Because the two apps deploy to two Netlify origins with disjoint publish roots (`netlify.toml:21` `publish="apps/user-app"` vs `apps/admin-panel/netlify.toml:19` `publish="."`), no single physical file can be shared by reference — a `<script src>` resolves against its own origin's root. So the SSOT is a **build-emit**: canonical sources live in a new neutral `shared-web/src/**` tree (outside both publish roots); a dependency-free `emit.js` copies/compiles each module into BOTH `apps/*/js/…` at the same sub-path, stamps a **content-hash `?v=` token**, and rewrites that token on every referencing page (closing the verified gap that `update-cache-busting.js` only touches the two `index.html`s and that the same file today carries different hand-tokens from different pages). The emitted copies are **committed to git** (matching the house's existing `functions/lib/`-in-git + "dist already in git — skip build" model), and a **CI drift-guard** — modeled on the already-passing `business-rules.sync.test.ts` byte-identity + behavior-matrix test — fails the build if any committed copy differs from a fresh emit or carries a wrong token. That guard is the guarantee the two roots can never silently diverge again.

**TS ordering.** Mechanism **before** TS migration, plumbing **TS-aware from day one**: unify-first (the health plan's "don't migrate what's duplicated"; "TS locks the cleanup"), and the canonical file graduates `.js → .ts` in place later with no re-plumbing — the JS copy-step is never redone for TS.

**Per-app divergence** is expressed from one source via an emit-injected `APP_CONTEXT` ('admin'|'user') constant. The §7.6 price-confidentiality case (service-card H4) uses a **fail-secure default-deny** `SHOW_FINANCIALS = (APP_CONTEXT==='admin')` plus a **mechanical guard** asserting the staff render contains no ₪/hours/entries — a leak fails CI before merge.

**Phased PRs (safe→dangerous):** PR-SHARE-1 mechanism-introduction (bar-level, **devils-advocate mandatory**, proven on one byte-identical pair, zero user-visible change) → PR-SHARE-2 the 5 trivial byte-identical/comment-only pairs → PR-SHARE-3/4 parameterized `config-loader` + `logger` → PR-SHARE-5 (read-only investigation) + PR-SHARE-6 `service-card-renderer` unify (**devils-advocate mandatory** — admin-trusted + confidentiality) → PR-SHARE-7/8 `client-case-selector` (investigate first, then unify). AlertEngine is excluded (its user copy is being deleted on the H.8.0 track).

**Open decisions for the Product Owner:**
1. **service-card H2 (data-model, must decide before PR-SHARE-6):** when a service's packages are all inactive, what is the true remaining-hours — **0** (today's admin behavior) or the **service-level residual** (today's staff behavior)? They currently disagree; unifying forces one answer to an admin-trusted count. Surfaced with `data-investigator`+`devils-advocate` trade-offs, not pre-decided.
2. **Approve the mechanism itself** (new `shared-web/` tree + committed-emit + build-step change) before any code.
3. **Confirm the wave sequencing** and that `client-case-selector` gets its own investigation+checkpoint before any unify.

**Top risks (all mitigated, mostly mechanically):** (1) commit↔deploy copy drift → drift-guard fails CI; (2) stale immutable cache-bust token → content-hash tokens + guard; (3) committed-vs-generated confusion → committed-emit matching the existing lib-in-git model; (4) broken script load order → emit preserves order + behavior harness catches hard deps; (5) confidentiality flag leaks price to staff → default-deny + emit-time injection + mechanical staff-no-price guard + mandatory devils-advocate.

**Nothing is built. Nothing is deployed. This returns to the Lead Agent for review, then the Product Owner for approval — no code until approved.**
