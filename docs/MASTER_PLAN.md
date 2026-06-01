# MASTER PLAN — Law Office System

**Status anchor:** 2026-05-28
**Owner:** Haim (Product Owner, partner at משרד עו"ד גיא הרשקוביץ ושות')
**Orchestrator:** Lead Agent (Claude Code session)
**Purpose:** Single source of truth for the multi-phase initiative — vision, standard, agreement, decisions, plan, timeline. Survives session resets.

> **Read this file FIRST** when a new session starts and the request mentions the AI Management Layer, profitability, tofes-mecher integration, or Pre-H.0.0 work. The Lead Agent's working memory of the plan ends when the session ends — this file is what persists. The Lead Agent is **allowed to trust this file over its own session memory** when they conflict.

---

## 1. Product Vision

### 1.1 Who uses this system

- **Haim** — senior partner. Approves scope, PROD deploys, architectural decisions. Reviews PRs. Receives weekly profitability summaries. Uses the AI chat to query "which cases are bleeding cash this month?"
- **Guy** — senior partner. Same role as Haim.
- **8 employees** (lawyers + administrative) — daily users of the User App for time entry, task management, client interactions.
- **Accountant** (external) — produces per-employee cost-per-hour data → uploaded into the system via a controlled flow.
- **Future buyer (commercial)** — the system is being prepared for sale. Internal-tool standards do not survive paying customers.

### 1.2 What pain points we are solving

| Pain | Current state | Cost |
|---|---|---|
| Manual client/service creation | Admin types client details into Admin Panel → no validation, no audit, easy drift | Errors propagate to billing, time entry; no one knows when/why a wrong client was opened |
| No real-time profitability | Hours are tracked. Fees are tracked. But cost-per-hour × hours is never computed. We don't know if a case is bleeding cash until quarterly accountant review | Bad cases run for months before anyone notices |
| Exception modal says "loss" | When a service overruns, the modal frames it as a "loss" to the firm | Wrong mental model — for legal billing, "overrun" = "open debt to collect from client", not a write-off |
| tofes-mecher data is siloed | The `tofes-mecher` system (separate Firebase project `law-office-sales-form`) holds sales_record data that is **already accountant-verified**. Currently no integration with law-office-system | We re-enter what's already authoritative elsewhere; numbers drift |
| No AI assistance | Haim/Guy have no fast query path into the data. "Show me all clients with negative forecast" requires manual spreadsheet work | Hours of partner time lost to data-wrangling |
| Task budgeting is inconsistent | Employees self-open tasks without budget. Partners assign tasks without enforced budgets. No approval workflow | Hours pile up without anyone catching it |

### 1.3 Desired end state (MVP)

When this plan is complete:

1. **Single Source of Truth for transactions = tofes-mecher.** Every new client/service goes through a gated pipeline: `sales_record` exists in tofes-mecher → signed PDF uploaded → AI signature-presence check passes → admin reviews → admin approves → law-office-system creates the client + service **deterministically** from the sales_record data. No more manual typing.

2. **Real-time per-case profitability dashboard in Admin Panel.** For every active case shows:
   - **Plan** (Static): fees committed × expected hours at intake → expected profit
   - **Forecast** (Dynamic): fees-paid-so-far + cost-of-hours-logged-so-far → current projection
   - Color-coded alerts when Forecast drops below Plan by X%
   - Includes BOTH hourly and fixed-price clients (for internal measurement, not for billing)

3. **AI Chat in Admin Panel.** Claude-backed, MCP integration, **read-only** queries. Examples:
   - "Show me all cases opened in 2026 with current forecast below break-even"
   - "Which employees logged more than their typical hours on case X in the last month?"
   - "Compare this month's total billable hours vs same month last year"
   - Powered by BigQuery export of tofes-mecher + law-office-system data (Pattern D)

4. **Cross-Project Bridge to tofes-mecher.** Hybrid architecture:
   - **Pattern A (live blocking)**: Cross-Project Cloud Function — when an admin tries to create a client in law-office-system without a matching tofes-mecher sales_record, the operation is blocked at the Cloud Function level
   - **Pattern D (analytical)**: BigQuery export of tofes-mecher data → AI chat can query joined data

5. **Task budgeting with hybrid rules**:
   - **Partner-assigned task** → requires partner approval before opening
   - **Employee-self-opened task** → auto-approves if <3 hours, requires partner approval if ≥3 hours
   - All tasks have explicit budget at creation; budget overruns trigger the Exception modal

6. **Exception modal reframed**. When a service overruns budget:
   - **Old text**: "הפסד למשרד"
   - **New text**: "חוב פתוח לגביה מהלקוח" + explicit workflow to track collection
   - Semantic shift only — no calculation change

7. **Cost foundation**:
   - `employee_costs/{email}` collection — CF-only access, never exposed to client SDK (PII-safe)
   - `costPerHourAtEntry` snapshot on every timesheet entry at write time
   - **NEVER re-derive from current `employee_costs`** — historical entries are immutable for cost purposes
   - When accountant updates costs (monthly), new entries get new snapshots; old entries keep their old snapshots

### 1.4 What this MVP is NOT

- Not a billing system. Existing billing flow stays.
- Not a fraud-detection system. The "AI signature check" verifies **presence** of a signature, not authenticity.
- Not a write-capable AI. Chat is read-only. Mutations stay in the existing UI.
- Not a customer-facing tool. Admin Panel only. Users don't see the AI or the profitability dashboard.
- Not a replacement for the accountant. Cost data still comes from the accountant; the system just stores + applies it.

---

## 2. The Standard ("commercial-grade")

> "המערכת תימכר" — Haim's words. Internal-tool shortcuts do not survive paying customers. This section defines what "commercial-grade" means concretely.

### 2.0 Non-negotiable principle — the bar supersedes preference

**Source:** Haim, 2026-05-29: _"אני לא רוצה שיבוא בחשבון מה שאני רוצה על חשבון הסטנדרט הגבוה ביותר שאני רוצה לפרוייקט הזה מבחינת ארכיטקטורה ומקצועיות"_.

This is the highest-order rule in the entire project. Restated for the Lead Agent and every future session:

- **The bar (architecture + professionalism) wins over every preference**, including Haim's own preferences for speed, visibility, convenience, scope-trimming, or "just ship it".
- **When the Lead Agent detects a tension** between what Haim asks for and the bar (e.g., "skip this test", "we don't need devils-advocate for this one", "just push to main", "let's defer the audit log to a follow-up PR"), the Lead Agent's job is NOT to offer Haim the bar-lowering option. The job is to **identify the tension, name it explicitly, and default to the bar-preserving option**.
- **The Lead Agent is allowed (and expected) to refuse a Haim request** when the request would lower the bar. Examples of legitimate refusals:
  - "I cannot skip the integration test for this write path — G3 + G4 require it. Here is how we ship the same scope while keeping the test."
  - "I cannot merge to `production-stable` without devils-advocate review — the rule applies even when you say 'מהר'."
  - "I cannot defer the audit log entry to a follow-up PR — audit-FIRST is fail-secure design, deferring it leaves a privilege grant unaudited in production."
- **What Haim's "מהר" / "תחליט אתה" / "פשוט תעשה" exemptions DO cover** (per `@.claude/rules/decision-point.md`): skipping agent consultation for **low-stakes** decisions (tiny changes, wording, status checks, after-deploy smoke).
- **What those exemptions DO NOT cover**: lowering the bar on high-stakes work (security, audit, migration, schema, partner gate, claim shape, financial calculation, production deploys). The Lead Agent enforces the bar regardless of the speed pressure.
- **Trade-off framing**: when Lead Agent offers Haim choices, the trade-off must be **time, scope, or feature-richness — NOT quality**. "Three weeks vs. five weeks" is fine; "with tests vs. without tests" is not.

This principle is **codified into the Working Agreement** (§3.8 below) and applies to every PR for the life of the project.

### 2.0.1 What "the bar" is, formally

> **Anchor — Anthropic Constitutional AI (Bai et al., 2022):** Following the paper's central finding that an *explicit* written constitution outperforms implicit guidance, because explicit principles can be inspected, debated, and updated — whereas implicit norms drift over time without anyone noticing. Paraphrased; see "Constitutional AI: Harmlessness from AI Feedback" at anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback for the original argument.

The bar = the union of exactly these **five** sources:

1. The 7 PRODUCT-GRADE Gates — `@.claude/rubrics/_PRODUCT-GRADE-GATES.md`
2. §2.1–§2.9 of this document (Standard)
3. Engineering Bar — `@docs/ENGINEERING_BAR.md` (backend)
4. Design Bar — `@docs/DESIGN_BAR.md` (frontend)
5. MUST criteria of the per-PR rubric in `.claude/rubrics/<pr-id>.md`

**Anything outside these five sources is PREFERENCE, not bar.**

The Lead Agent may NOT refuse a Haim request based on preference. If a concern is not anchored in one of the five sources above, it is a **recommendation**, not a **refusal trigger**.

If the Lead Agent finds itself wanting to refuse but cannot cite a specific item in one of the five sources, the correct action is to **document the concern as a recommendation** and proceed with Haim's request.

### 2.0.2 How each rule is measured

> **Anchor — Anthropic Evals documentation:** Following Anthropic's published guidance that programmatic (code-based) graders are preferred over model-based (LLM-as-judge) graders when the criterion can be automated, because programmatic graders are deterministic and auditable. Model-based grading is reserved for criteria that genuinely cannot be automated. Paraphrased; see docs.anthropic.com/en/docs/test-and-evaluate/develop-tests for the canonical guidance.

Every bar item is classified as one of two measurement types:

- **Mechanical** — verifiable by test / lint / grep / AST scan / automated checker. Deterministic. No interpretive judgment.
- **Subjective** — requires Lead Agent judgment. Non-deterministic. Different sessions may reasonably reach different conclusions.

When the Lead Agent invokes the bar to refuse, the refusal MUST cite (a) the specific bar item and (b) its measurement type.

#### Bar items classified

| Source | Item | Type | Measurement method |
|---|---|---|---|
| G1 | No stack traces in customer output | Mechanical | grep diff for `at file.js:N:N` patterns |
| G1 | No `undefined` / `null` / `[object Object]` / `NaN` in customer output | Mechanical | grep diff |
| G1 | No raw `FirebaseError` leakage | Mechanical | grep diff for `FirebaseError:` |
| G1 | English error messages where UI is Hebrew | Mechanical | grep diff for English string literals in `lang="he"` files |
| G1 | "User-friendly" Hebrew error text with next-action | Subjective | Lead Agent verdict |
| G2 | "Rollback" section in PR body | Mechanical | grep PR body |
| G2 | Rollback executable in ≤ 5 minutes | Subjective | Lead Agent verdict |
| G3 | `logger.info` on success / `logger.error` on failure for write paths | Mechanical | AST scan for `transaction.update` / `transaction.set` without adjacent logger call |
| G3 | Log fields include actor/entityId/timestamp | Mechanical | AST scan of logger calls |
| G3 | `audit_log` entry on DELETE paths | Mechanical | AST scan |
| G4 | Integration-style test exists for new code paths | Mechanical | grep test names for action verbs |
| G4 | Test "proves the customer scenario" | Subjective | Lead Agent verdict |
| G5 | Customer-facing strings in Hebrew | Mechanical | grep diff for English string literals in UI files |
| G6 | "Breaking change" section if PR changes contracts | Mechanical | diff scan + PR body check |
| G6 | Migration plan adequate when breaking | Subjective | Lead Agent verdict |
| G7 | Security agent consulted when auth/PII/permissions touched | Mechanical | PR body grep for "security agent" mention |
| §2.5 | WCAG AA contrast on all text | Mechanical | automated contrast checker |
| §2.5 | `prefers-reduced-motion` respected (no hardcoded transition ms) | Mechanical | grep CSS for hardcoded transition durations |
| §2.6 | TypeScript strict, no `any` | Mechanical | `tsc --strict` + `eslint no-explicit-any` |
| §2.6 | ESLint 0 errors | Mechanical | `eslint . --max-warnings 0` |
| §2.6 | v2 Cloud Functions for new endpoints | Mechanical | grep `firebase-functions/v2/*` |
| §2.6 | Zod `.strict()` schemas on callable inputs | Mechanical | grep `.strict()` adjacent to `z.object(` |
| §2.7 | New page uses `ModalManager` (not inline modal) | Mechanical | grep new HTML for `<div class="modal"` |
| §2.7 | New page extends `design-system.css` tokens (no parallel tokens) | Mechanical | grep new CSS for hardcoded color/spacing literals |
| §2.8 | No PII in code fixtures | Subjective | Lead Agent verdict on fixture realism |
| §2.8 | No secrets in source | Mechanical | gitleaks scan |
| Architecture | "Audit-FIRST, mutation-SECOND" ordering | Mechanical | AST scan: audit call precedes mutation in write paths |
| Architecture | "Professional" code organization | Subjective | Lead Agent verdict |
| Architecture | Single Source of Truth preserved (no duplicate business logic) | Subjective | Lead Agent verdict, informed by canonical helpers list in `shared/` |

**Cross-reference:** the canonical definitions of G1–G7 live in `@.claude/rubrics/_PRODUCT-GRADE-GATES.md` — this table classifies their measurement, it does not redefine them.

**Coverage gap fallback.** This table is **not exhaustive**. Items in the bar's five sources (§2.0.1) that are NOT listed here default to **Subjective** for refusal-mechanism purposes — meaning Haim may override per §3.8.5 CASE B. Rationale: an unclassified item is by definition not yet mechanized; treating it as Subjective preserves Haim's recourse while the classification gap remains open. Expanding the table to cover every Engineering Bar / Design Bar item is tracked as a separate task — not a blocker for governance.

**Implication:** Mechanical refusals are objective and final. Subjective refusals (including unclassified items) are Lead Agent opinions and are eligible for override (see §3.8.5).

### 2.1 Error handling (G1, G5)

- **NO English error messages** where the UI is Hebrew. Mixed sentences are forbidden (`"שגיאה: Permission denied"` is a FAIL).
- **NO stack traces** in customer-visible output. Never `at functionName (file.js:42:13)`.
- **NO raw FirebaseError leakage.** `FirebaseError: 7 PERMISSION_DENIED` → wrap and translate.
- **NO undefined / null / [object Object] / NaN** in customer-visible output.
- **YES Hebrew, user-friendly text** with a next-action suggestion ("נסה שוב", "פנה לתמיכה", "ודא שהפרטים תקינים").
- **YES correlation ID** logged server-side so support can trace.

### 2.2 Audit & monitoring (G3)

- **Every write path** has `logger.info('action.success', {actor, entityId, ...})` on success and `logger.error('action.failure', {actor, errorCode, ...})` on failure.
- **Every delete path** has an `audit_log` entry: who, what, when, why. Soft-delete preferred over hard-delete where reversible.
- **Audit-FIRST, mutation-SECOND, compensating-doc-on-failure** ordering for critical writes (admin claims, financial mutations, schema changes). Established by Pre-H.0.0.B; canonicalized by Pre-H.0.0.C.
- **NO PII in log fields.** `actor: {uid}`, never `actor: {email}`. The repo is PUBLIC; CI logs are world-readable.

### 2.3 Testing (G4)

- **Integration-level tests** that exercise the customer scenario, not just helper functions. Pre-H.0.0.B set the bar at 51 tests across 3 suites for a 3-function PR.
- **Static AST guards** for "this code MUST not contain X" invariants (e.g., write APIs in a read-only function, missing audit calls). Mirror the dual pattern from `verify-claims.test.ts`.
- **Manual smoke test** acceptable only when integration test is impractical, and only with exact steps + expected results in the PR body.
- **NO test that mocks every dependency** such that it can't fail in production. Mock the SDK boundary, not the logic.

### 2.4 Hebrew UI (G5)

- Every customer-facing string in Hebrew, RTL clean.
- Internal logs / code identifiers / comments / admin-only developer tooltips — English acceptable.
- New page declares `dir="rtl" lang="he"` at the `<html>` element.
- Direction-aware icons (chevrons, arrows) must be RTL-aware.

### 2.5 Accessibility (Design Bar)

- WCAG AA contrast on all text.
- `prefers-reduced-motion` respected — never hardcode literal `transition: 200ms ease`; use `var(--transition-smooth)` which respects the user's preference via the safety net in `design-system.css`.
- Every interactive element has accessible name (`aria-label` if not visually labeled).
- `:focus-visible` styling on all interactive elements.

### 2.6 Engineering Bar (backend)

- New backend code in TypeScript under `functions/src-ts/`, strict mode, `allowJs: false`.
- ESLint 0 errors enforced (warnings allowed, counted, not blocking).
- `no-restricted-syntax` forbids `console.*` in new TS code → use `require('../shared/logger')` shim.
- Zod for input validation on callables. `.strict()` schemas reject unknown fields.
- v2 Cloud Functions (`firebase-functions/v2/*`) for all new endpoints.
- `defineSecret` for v2 secrets; `process.env.X` only for v1 callables not being migrated.
- Test coverage target: 60% growing to 80%.

### 2.7 Design Bar (frontend, new pages)

- Extend `apps/admin-panel/css/design-system.css` tokens — never introduce parallel token files.
- Use `ModalManager` (`apps/admin-panel/js/ui/Modals.js`) for modals. Inline `<div class="modal">` is forbidden in new code.
- Existing 11 admin pages are grandfathered (per `docs/DESIGN_BAR.md`). New pages clear the bar from day one.

### 2.8 Public-repo discipline

- No PII in code fixtures (use `admin@example.com`, `target-uid-fixture-yy`, never real emails).
- No secrets in source. Service-account JSONs gitignored via `service-account*.json` / `firebase-admin-key.json`.
- No `process.env.*` values printed in logs (CI logs are world-readable).
- The repo is PUBLIC — assume every diff is read by competitors.

### 2.9 Per-PR governance

- Every PR has a rubric in `.claude/rubrics/` with MUST + SHOULD criteria.
- Every PR body has a `PRODUCT-GRADE GATES` section with each gate (G1–G7) marked PASS / N/A / FAIL.
- Any FAIL → grader FAIL → pre-PR hook (`require-outcomes-pass.sh`) blocks `gh pr create`.
- Every PR has a `Rollback` section with the exact `git revert` command(s).

---

## 3. Working Agreement

> Defined by Haim 2026-05-20: "אני מחפש צוות שנעבוד תמיד יחד אבל שתמיד יהיה בפעולה ועבודה". Confirmed in subsequent sessions.

### 3.1 Roles

- **Lead Agent (Claude Code session)** — orchestrates. Parses requests, decomposes into subtasks, spawns sub-agents in parallel, aggregates, presents to Haim. Never delegates orchestration to Haim. Reports to Haim, orchestrates on his behalf.
- **Haim — Product Owner**. Approves scope at checkpoints, approves PROD deploys (always explicit, never self-approved), approves architectural decisions. Does NOT mediate between sub-agents.
- **12 sub-agents** organized by function (see `@.claude/rules/agent-rules.md`).

### 3.2 Communication preferences

- **All `AskUserQuestion` in Hebrew.** All option labels Hebrew. All descriptions Hebrew.
- **Every AskUserQuestion has a recommendation** — the first option marked `(Recommended)` and justified by an agent verdict.
- **Decision-point rule** (`@.claude/rules/decision-point.md`): before any AskUserQuestion choosing approach/scope/architecture, Lead Agent MUST consult the relevant specialist agent first and present the verdict alongside the choices. Skipping is a process violation.
- **Exemption**: if Haim says "מהר" / "תחליט אתה" / "פשוט תעשה" → skip agent consultation. **Note the skip in the response** (auditable).
- **Status updates** in Hebrew. Tables, headers, lists welcome — Haim parses fast.
- **No emojis in code or files** unless Haim explicitly requests. Emojis in chat / status messages are fine.

### 3.3 Agent model selection

- **All sub-agents = Opus** by default.
- **Exception**: `effort-scaler` = Haiku (per spec — fast classification of LIGHT/MEDIUM/HEAVY).
- Per Haim 2026-05-27: "אוקיי מסכים איתך לגמרי איפה שיש נמלה לא צריך פטיש אבל איפה שכן אז כן ועדיף פטיש הכי מקצועי שיש".

### 3.4 Feature Protocol

Strict order, no skipping (see `@.claude/rules/feature-protocol.md`):

```
0 Gatekeeper → 1 Intent → 1a Effort-Scaler → 2 Investigation →
2a Completeness-Checker → 3 Checkpoint → 4 Plan → 5 Code →
6 Grader → 6a Evaluator-Optimizer (if grader = FAIL)
```

- **Effort-Scaler skipped** only if obviously LIGHT (single file, ≤20 lines change). Mark explicitly: "skipping effort-scaler — task is obviously LIGHT".
- **Completeness-checker findings MUST appear in the AskUserQuestion** of the checkpoint. Hidden findings = process violation.
- **No code before checkpoint approval.** Investigation produces findings, not patches.
- **No scope expansion mid-task.** New scope after checkpoint = new PR.

### 3.5 Production safety

- **10 daily users, 200+ active clients, 6 months in production.** No regressions tolerated.
- **Never `--admin`, never `--force`** to `main` or `production-stable`. Branch protection is sacred.
- **Never skip hooks** (`--no-verify`, `--no-gpg-sign`) unless Haim explicitly requests.
- **PROD action requires**: explicit target identification + dry-run + backup + Haim's explicit approval.
- **`main` = DEV, `production-stable` = PROD.** Feature branches off `main`, merged to `main`, then promoted to `production-stable`.

### 3.6 Honesty rules

- **Never assume missing information.** If uncertain, explicitly say `אין לי ודאות` (CLAUDE.md STRICT RULE).
- **Trust but verify** sub-agent outputs. A sub-agent's summary describes intent, not necessarily what happened. Lead Agent checks the actual changes.
- **Acknowledge process misses.** When the Lead Agent makes a mistake (e.g., Pre-H.0.0.B's CI miss — didn't run root-level type-check), name it explicitly and propose prevention. Don't paper over.

### 3.7 Tone

- Partnership. "מעולה סומך עלינו עלי ועלייך קלוד" (Haim 2026-05-27).
- Direct. No filler, no apologies for asking, no preamble before tables.
- Skeptical of own work — Lead Agent invokes `devils-advocate` before high-stakes decisions even when confident.

### 3.8 Standard-over-preference rule (operationalization of §2.0)

Concrete protocol the Lead Agent follows in every session:

1. **Trade-off detection**: before presenting options to Haim, the Lead Agent classifies the trade-off type:
   - **Type A — Time / scope / feature richness**: "ship now without H.7 vs. ship in 1 more week with H.7", "do A first or B first", "build the small page or the full dashboard". These are fine to offer.
   - **Type B — Quality / bar / standard**: "with tests vs. without tests", "audited vs. not audited", "Hebrew error vs. raw FirebaseError", "TypeScript strict vs. allow `any`", "v2 onCall vs. unauth onRequest". **These are NOT offered as choices.** The bar-preserving option is the only option.
2. **Refusal protocol**: if Haim asks for a Type B compromise, Lead Agent responds: "I understand the request. The bar (specifically: G[x] / Engineering Bar item / Design Bar item / standard line) forbids it. Here is the bar-preserving alternative that delivers the same business value." Then proposes the alternative.
3. **Speed exemption scope**: when Haim says "מהר" / "תחליט אתה" / "פשוט תעשה":
   - **Applies to**: skipping `AskUserQuestion`, skipping agent consultation on low-stakes decisions, going straight to code on tiny changes (≤20 lines, single file).
   - **Does NOT apply to**: skipping tests, skipping audit logs, skipping grader, merging without devils-advocate on high-stakes, bypassing branch protection, lowering any G1-G7 gate, pushing TS errors to "fix later".
4. **High-stakes auto-defense**: any of these triggers MANDATORY devils-advocate + full Feature Protocol regardless of speed pressure: merge to `production-stable`, schema change, security rule change, refactor >100 lines, data migration, new `auth.setCustomUserClaims` call, new Firestore document collection, new cross-project IAM grant, new Cloud Function with PII surface.
5. **Audit trail**: every refusal logged in the response so a future session reading the chat can verify the bar was preserved.

This protocol is the Lead Agent's job. **Haim does not need to remind the Lead Agent of the bar** — the Lead Agent enforces it proactively.

### 3.8.5 Override mechanism for Subjective refusals

> **Anchor — Anthropic "Building Effective Agents" (2024):** Following Anthropic's published guidance that agent systems need clear human oversight points, particularly where the agent might decline or err on the side of caution. The operational principle: provide explicit override paths with logging. Refusals without an override path convert reasonable disagreements into deadlocks. Paraphrased; see anthropic.com/engineering/building-effective-agents for the canonical framework.

When the Lead Agent refuses a Haim request based on the bar (§3.8), the refusal falls into one of two cases:

**CASE A — Mechanical refusal.**
The refusal cites a Mechanical bar item (see §2.0.2). The check is deterministic — a test fails, an ESLint rule errors, a grep matches a forbidden pattern.

→ **No override.** Haim cannot override a Mechanical refusal. The failure must be fixed. The bar item is engineering reality, not Claude opinion.

If Haim believes the Mechanical check is itself wrong (e.g., the ESLint rule is over-broad, the test is testing the wrong thing), the correct response is to **change the check via a Bar Revision** (see §15), not to override the result.

**CASE B — Subjective refusal.**
The refusal cites a Subjective bar item (see §2.0.2). The verdict is the Lead Agent's interpretation — different sessions could reasonably disagree.

→ **Override is available.** Haim may override with the following exact text format:

```
> I acknowledge the [G-X / Bar item Y] concern raised by the Lead Agent.
> I override for [specific business reason].
> Override classification: Subjective.
```

The override MUST be logged in the PR body under a heading "Subjective bar overrides". Example format:

```markdown
## Subjective bar overrides

- **Item:** G4 — "Test proves customer scenario"
- **Lead Agent's concern:** the integration test mocks the email-sending step, so it doesn't exercise the real delivery path.
- **Haim's override:** I acknowledge the G4 concern. I override because the email delivery path is owned by a third party (SendGrid) and is not under test in any of our other endpoints. Override classification: Subjective.
```

**The override creates an auditable trail.** A future Lead Agent reading the PR can see that the Subjective concern was raised, acknowledged, and consciously overridden — not silently ignored.

**No override of overrides.** Once Haim writes the override, the Lead Agent must accept it and proceed. The Lead Agent does not get to refuse the override itself.

**Mechanical vs Subjective is determined per §2.0.2.** If the Lead Agent claims a refusal is Mechanical but the item is classified as Subjective in §2.0.2's table, Haim may override. The classification table is the authority.

---

## 4. Hard Constraints

These are fixed for the entire initiative — do NOT relitigate per PR:

- **Production live**: 10 daily users, 200+ active clients, 6 months in production.
- **Repo is PUBLIC on GitHub** — CI logs world-readable.
- **`main` = DEV, `production-stable` = PROD.**
- **Branch protection is sacred.**
- **All sub-agents Opus** except `effort-scaler` (Haiku).
- **Feature Protocol is mandatory.**
- **7 PRODUCT-GRADE Gates** on every PR.
- **Audit-FIRST, mutation-SECOND, compensating-log-on-failure** for write paths.
- **The `partner` custom claim does NOT exist yet.** Do NOT build rules that depend on it until Pre-H.0.0.D/E/F land.
- **`tofes-mecher` data is accountant-verified.** Treat its sales_record state as authoritative for fee-paid amounts.
- **Cost stamping is by snapshot, never re-derived.** `costPerHourAtEntry` is immutable per timesheet entry.

---

## 5. Timeline

### 5.1 Estimate (sustainable cadence)

- **1 PR per 2-3 days** is bar-sustainable (Pre-H.0.0.B was 3 days, including review). Sprint mode (1 PR/day) is possible but raises burnout / scope-fatigue risk.
- Estimate below assumes sustainable cadence.

| Phase | Remaining PRs | Estimate | Target completion |
|---|---|---|---|
| Phase 1 (Pre-H.0.0.C–G) | 5 | ~2 weeks | **2026-06-12 to 2026-06-15** |
| Phase 2 (H.0–H.9) | 10 | ~6-8 weeks | **2026-07-15 to 2026-08-15** |
| **MVP complete** | — | **8-10 weeks from 2026-05-28** | **Early to mid August 2026** |

### 5.2 Risk factors

- **Production fires** — 10 daily users, 200+ clients. Estimated 1-2 days/month lost.
- **Scope expansion at checkpoints** — Pre-H.0.0.B grew from 1 function to 3 mid-investigation. Pattern likely to recur.
- **Holidays / court schedule** — Haim's calendar drives review cadence.
- **Phase 2 LARGE rocks** — H.1 (cross-project bridge), H.3 (profitability dashboard), H.6 (cutover), H.8 (AI chat) are each 1-2 week efforts on their own.

### 5.3 Acceleration levers

- **Parallel Phase 1 PRs** — C, F, G are technically independent. Could run 2 in parallel after C lands.
- **Defer H.7 + H.9** — Exception modal (H.7) and polish (H.9) are smallest. Could move post-MVP if pressure rises.

### 5.4 Visible Milestones in DEV (the "buds" / ניצנים)

Haim's question 2026-05-29: "מה בפועל אני יכול לראות בDEV את הניצנים?" — when does visible UI progress land in DEV?

Honest answer: **first major business-value bud lands Week 5-6** (Profitability Dashboard, H.3). Until then it's backend plumbing — invisible but foundational. This is unavoidable for the locked architecture (data must flow before it can be displayed).

Week-by-week visibility map (assumes sustainable cadence, no bud accelerators):

| Week | Target | What's visible in DEV |
|---|---|---|
| 1 | by 2026-06-05 | ❌ Backend only — Pre-H.0.0.C (`logCriticalAction`). Audit primitive — no UI |
| 1–2 | by 2026-06-09 | ❌ Backend only — Pre-H.0.0.D (`isPartner()` rule helper) |
| 2 | by 2026-06-12 | ❌ Backend only — Pre-H.0.0.G (`employee_costs` schema). Data layer ready, no UI |
| 2–3 | by 2026-06-16 | ❌ Backend only — Pre-H.0.0.E (claim shape consolidation) + F (`syncRoleClaims`) |
| 3 | by 2026-06-19 | ❌ Backend only — H.0 foundations (cross-project IAM, BigQuery dataset) |
| 4 | by 2026-06-26 | ❌ Backend only — H.1 bridge starts. tofes-mecher data starts flowing into BigQuery but is NOT shown anywhere in the admin panel |
| 5 | by 2026-07-03 | 🌱 **First bud**: H.2 done — `costPerHourAtEntry` stamped on every new timesheet entry. Visible only by inspecting Firestore docs (admin diagnostic) |
| 6 | by 2026-07-10 | 🌳 H.3 partial — **Profitability Dashboard preview** (sortable table, no alerts yet). FIRST major UI deliverable |
| 7 | by 2026-07-17 | 🌳 H.3 complete — **Full Profitability Dashboard** with color-coded alerts. H.4 budgeting starts |
| 8 | by 2026-07-24 | 🌳 H.4 complete — **Task budgeting workflow UI** (partner approval, auto-approve <3h). H.5 PDF check starts |
| 9 | by 2026-07-31 | 🌳 H.5 done + H.6 partial — **PDF signature presence check** working; gated cutover UI preview |
| 10 | by 2026-08-07 | 🌳 H.6 complete — **Gated client creation flow live in DEV**. H.7 reframed exception modal |
| 11 | by 2026-08-14 | 🌳 H.8 in progress — **AI Chat sidebar visible** (partial functionality) |
| 12 | by 2026-08-21 | 🌳 H.8 complete + H.9 polish — **MVP COMPLETE** |

**Bottom line**: 4 weeks of invisible backend → 1 small bud Week 5 → major UI deliverables every week from Week 6 onward.

### 5.5 Optional bud accelerators (bring visible progress forward)

If the 4-week backend stretch without visible progress is unacceptable, these optional bonus PRs land visible UI sooner. Each is +1 PR (~2-3 days), so all four = +2 weeks pushed to MVP date.

| Bonus | What | Week visible | Cost |
|---|---|---|---|
| **A — System Audit page** | Admin page showing `verifyClaims` output, recent `audit_log` entries, system status. Pure metadata. Demonstrates Phase 1 is real. | Week 1-2 | +1 PR |
| **B — Cost-per-Employee diagnostic** | Admin diagnostic page showing the `employee_costs` schema (after G). Read-only. | Week 3 | +1 PR |
| **C — tofes-mecher Sales Records Preview** | Read-only admin window into tofes-mecher data flowing via Pattern A. Lands during H.1. | Week 4 | +1 PR |
| **D — Thin-slice profitability on client page** | Just "expected profit" field on existing client detail page — not the full dashboard. Lands after H.2. | Week 4-5 | +1 PR |

**Status**: NOT in current plan. Decision deferred to Haim — if requested, schedule these as inserts between the corresponding backend PRs.

---

## 6. Phase 0 — Meta Infrastructure ✅ DONE

The cross-cutting standards that every later PR rests on.

| # | Title | PR | Status | Merged |
|---|---|---|---|---|
| 0.1 | `verifyClaims` read-only diagnostic | [#336](https://github.com/Chaim2045/law-office-system/pull/336) | ✅ merged | 2026-05-28 |
| 0.2 | META-6 — Engineering Bar (TypeScript infra) | [#337](https://github.com/Chaim2045/law-office-system/pull/337) | ✅ merged | 2026-05-28 |
| 0.3 | META-7 — Design Bar (UI standard) | [#338](https://github.com/Chaim2045/law-office-system/pull/338) | ✅ merged | 2026-05-28 |

**Phase 0 outcomes (referenced by Phase 1+):**
- `functions/src-ts/` TypeScript project. Strict mode, Zod, ts-jest, ESLint 0 errors enforced.
- `apps/admin-panel/css/design-system.css` tokens + `prefers-reduced-motion` safety net + `ModalManager` requirement.
- `functions/shared/logger.js` structured-logging shim with `firebase-functions/logger` underneath.
- `verifyClaims` callable: pure-read diagnostic of Auth custom claims vs `employees.role`.

---

## 7. Phase 1 — Foundational Safety (Pre-H.0.0) 🟡 IN PROGRESS (5/7)

### 7.1 Overview

Closes the security and audit gaps that block any commercial release. Every Phase 2 PR depends on these landing first.

| # | Title | PR | Status | Size | Depends on |
|---|---|---|---|---|---|
| A | `verifyClaims` callable | #336 | ✅ merged | (in Phase 0.1) | — |
| B | Admin-claim endpoint lockdown | [#339](https://github.com/Chaim2045/law-office-system/pull/339) | ✅ merged | LARGE | A |
| C | `logCriticalAction` audit primitive | [#342](https://github.com/Chaim2045/law-office-system/pull/342) | ✅ merged | LIGHT | B |
| D | `isPartner()` helper + rules-test infrastructure | [#343](https://github.com/Chaim2045/law-office-system/pull/343) | ✅ merged | MEDIUM | A |
| E | Claim shape consolidation | _deferred_ | ⏸️ BLOCKED (see §7.4) | MEDIUM | B + D + verifyClaims-PROD-output |
| F | `syncRoleClaims` utility | _pending_ | ⏸️ pending | MEDIUM | C + D + E |
| G | `employee_costs/{email}` schema | [#345](https://github.com/Chaim2045/law-office-system/pull/345) | ✅ merged | MEDIUM | C |

**Critical path:** C → D → E (sequential). F and G are independent of each other but both need C.

### 7.2 Pre-H.0.0.C — `logCriticalAction` audit primitive

**Why:** Pre-H.0.0.B introduced a local helper `writeAuditOrThrow` that writes audit-FIRST and rethrows on failure (so callers can abort the mutation). This pattern will be needed by every future write-critical endpoint (C, F, G, H.2, H.4, H.6, H.8). Canonicalize it now to prevent duplication and drift.

**Scope:**
- Add `functions/shared/auditCritical.js` (legacy JS to match `shared/audit.js` convention) OR `functions/src-ts/audit-critical.ts` (TS — preferred if we keep tightening the bar)
- Signature: `logCriticalAction(action: string, actorUid: string, payload: object): Promise<string>` (returns audit doc ID)
- Throws if Firestore write fails — caller catches and aborts mutation
- Co-located `.d.ts` for TS consumers if JS implementation chosen
- Update `set-admin-claims.ts` + `initialize-admin-claims.ts` to import from the canonical helper instead of the local `writeAuditOrThrow`
- Update `docs/ENGINEERING_BAR.md` with the audit-FIRST pattern as canonical for write paths
- Test: AST guard that asserts the canonical helper is used (no local `writeAuditOrThrow` clones)

**Estimated size:** LIGHT (~50-80 lines + small refactor of 2 callers).

**Locked decisions:**
- JS vs TS: TS (confirmed at investigation — backend-firebase-expert recommendation).
- Collection: stays `audit_log` (canonical, set by `shared/audit.js`).
- TWO exports (devils-advocate Attack #2): `logCriticalAction` (non-txn, safe for compensating audits) + `logCriticalActionInTxn` (transactional, pre-allocated doc id). Type-system prevents the compensating-audit-in-txn mistake.
- `schemaVersion: 1` (devils-advocate Attack #5) — forward-compat anchor for future fields.
- `actorUid` validation (devils-advocate Attack #3): `/^[\w-]{6,128}$/` OR `sys:<name>` prefix for system actors (cron jobs, triggers).
- Logger discipline: NEVER `error.message` in logger payload (devils-advocate Attack #4) — only `errorCode`.

**Implementation status:** ✅ Merged in [PR #342](https://github.com/Chaim2045/law-office-system/pull/342) (2026-05-29). 72 tests pass (21 new + 51 from Pre-H.0.0.B unchanged after refactor). lib/ committed per Pre-H.0.0.B decision.

### 7.3 Pre-H.0.0.D — `isPartner()` helper + rules-test infrastructure

**Why:** Phase 2 needs partner-only paths (task budgeting approval, profitability dashboard visibility). Currently `firestore.rules` only knows `isAdmin()`. Without `isPartner()`, every partner-gated rule has to inline the check. Also: the repo had ZERO automated `firestore.rules` testing — adding the helper without coverage would violate G4 (test proves customer scenario).

**Scope (expanded at Pre-H.0.0.D checkpoint 2026-05-29):**
- Add `function isPartner()` to `firestore.rules` with canonical-shape comment block + cross-reference to wildcard at `firestore.rules:239`
- Update `firestore.rules` header docblock (add 2026-05-29 entry + role list `admin|partner|employee`)
- Create `firestore.rules.test` (Strategy B — separate test ruleset; production rules stay clean)
- NEW test infrastructure (was not in repo before this PR):
  - Add `@firebase/rules-unit-testing@3.0.4` + `firebase-tools@14.20.0` (pinned) as devDeps
  - Add `.npmrc` with `legacy-peer-deps=true` (rules-unit-testing peers `firebase@^10`; repo has `firebase@9.23.0`; removable when Dependabot PR #251 lands)
  - Add `emulators` block to `firebase.json` (firestore:8080, auth:9099, ui:disabled)
  - Scripts: `test:rules` + `test:rules:emulator` in root `package.json`
  - `tests/rules/setup.ts` with HARD GUARDS (devils-advocate Attack #2): refuse to boot without `FIRESTORE_EMULATOR_HOST` + hardcoded `projectId: 'demo-rules-test'`
  - `tests/rules/isPartner.test.ts` — 11 scenarios (7 string-typed + 4 type-confusion per devils-advocate Attack #5)
  - `tests/unit/rules/rules-drift-guard.test.ts` — fast string-equality check between helper bodies in `firestore.rules` and `firestore.rules.test` (no emulator needed; runs as part of standard `npm test`)
- CI updates to `.github/workflows/pull-request.yml`:
  - JOB 5 timeout bumped 15→25min (Attack #3 — emulator cold-boot budget)
  - `actions/setup-java@v4` JDK 17 step before emulator (Attack #4 — required by Firestore Emulator)
  - `firebase emulators:exec` step running `npm run test:rules` BEFORE the existing root `npm test`
- Update `docs/PARTNER_CLAIM_DIAGNOSTIC.md` with Pre-H.0.0.D section (canonical literal + "F is the writer" coordination note + test infrastructure summary)
- **Does NOT yet write any `partner` claim** — that's F's job. D only defines the read-side helper.

**Estimated size:** MEDIUM (~30 rules lines + ~150 test+infra lines + CI + docs ≈ 400 LOC).

**Locked decisions:**
- Claim shape: `{role: 'partner'}` — matches the canonical `{role: 'admin'}` shape from Phase 1 B.
- No `{partner: true}` legacy shape — we are NOT introducing a new legacy.
- Test runner: **Vitest at root** (not Jest in functions/) — rules testing is system-level.
- Test ruleset location: **`firestore.rules.test`** at repo root (Strategy B — production rules stay free of test scaffolding).
- HARD GUARD on emulator-only execution (devils-advocate Attack #2): refuse without `FIRESTORE_EMULATOR_HOST` + `projectId: 'demo-rules-test'` (Firebase reserves `demo-*` prefix for emulator-only).
- Production-path sentinel test (devils-advocate Attack #1 partial defense): **DEFERRED** to the first PR that wires `isPartner()` into a real production rule (likely H.4 task budgeting or H.3 profitability). Until then, drift-guard + 11 helper scenarios cover the helper itself; production-path coverage comes when production consumers exist.
- 11 scenarios cover: unauth / no-role / cross-role (admin) / canonical partner / employee / empty / whitespace / null / array / object / numeric.

### 7.4 Pre-H.0.0.E — Claim shape consolidation

> **⏸️ STATUS: BLOCKED + DEFERRED (2026-05-31).** Investigated by 3 Opus agents (security / backend / data-investigator). E was deferred in favor of G (G is unblocked + on the critical path to the profitability dashboard, the first visible bud). **Two HARD PREREQUISITES before E can safely execute:**
> 1. **Haim must run `verifyClaims` in PROD** and capture `claimShapeBreakdown`. GO/NO-GO = `admin_boolean_only === 0`. If 0 (likely — admins re-granted post-B are `both_shapes`), the migration is a near-no-op. If >0, an expand migration is load-bearing. The Lead Agent CANNOT run this — it needs a logged-in admin.
> 2. **DEV and PROD share ONE Firebase project** (`law-office-system-e4801`) — confirmed by data-investigator. There is NO claim isolation; any `setCustomUserClaims` "in DEV" mutates PROD Auth. Only the Firestore Emulator (Pre-H.0.0.D) is safe for rehearsal.
>
> **Risk/value:** the `{admin:true}` residue is HARMLESS today (security audit: only consumer is `auth.js:424`, a fail-safe dual-read; rules/storage/User App use `token.role` only). E is cosmetic cleanup + drift-elimination, NOT a functional fix — hence safe to defer.
>
> **Circular-reference FIX:** the original step 3 below ("migrate via the F utility") was circular — F depends on E. Resolution (backend agent, adopted): **Option A** — E ships a one-shot `functions/scripts/migrate-claim-shape.js` (dry-run default + `--apply`, mirrors `grant-admin-emergency.js`). F remains the general partner+role sync utility, built later.
>
> **Expanded scope (completeness-checker NEEDS-EXPANSION):** beyond the 4-bullet original — (a) `grant-admin-emergency.js` is the 4th writer (must stop dual-writing); (b) 🔴 `initialize-admin-claims.ts` idempotency check (`existingClaims.admin === true && ...role==='admin'`) MUST change to `role`-only or it re-writes everyone post-contraction; (c) revoke-path semantics (`setAdminClaim` writes `{admin:false}` → decide `{}` full-removal); (d) `lib/` rebuild; (e) `master-admin-wrappers.js createUser/updateUser` already write `{role}`-only (E-compliant, self-healing); (f) G's callables (`set/get-employee-cost.ts`) dual-shape gate must be on E's consumer-sweep.
>
> **Expand-contract ordering (zero-downtime):** EXPAND (migrate-claim-shape.js ensures every admin has `role:'admin'`) → keep dual-read consumer → CONTRACT writers (drop `admin:true`) → CLEANUP (drop `auth.js:424` `admin:true` read + remove residue) as a SEPARATE follow-up PR after a token-refresh window. Removing the consumer's `admin:true` read in the SAME PR is unsafe (a not-yet-refreshed admin token loses its sole grant).

**Why (original plan — see Circular-reference FIX above for the corrected step 3):** After D, partner reads use `token.role`. After B, admin writes use `{admin:true, role:'admin'}` dual-shape. E retires the legacy `{admin:true}` field by:
1. Grepping all consumers — the only one is `apps/admin-panel/js/core/auth.js:424`
2. Updating that consumer to read only `token.role === 'admin'`
3. ~~Migrating via the F utility~~ → **Option A: one-shot `migrate-claim-shape.js`** (F is circular — see fix above)
4. Updating `setAdminClaim` (legacy singular) and the new TS endpoints to write only `{role:'admin'}` going forward
5. Final `verifyClaims` run — confirm `claimShapeBreakdown.admin_boolean_only` = 0

**Scope:**
- Modify `apps/admin-panel/js/core/auth.js:424` — remove `claims.admin === true` read
- Modify `functions/auth/index.js setAdminClaim` — remove `admin:true` from grant payload
- Modify `functions/src-ts/set-admin-claims.ts` — remove `admin:true` from grant payload + audit + response shape
- Modify `functions/src-ts/initialize-admin-claims.ts` — remove `admin:true`
- Run F utility with `--apply` to migrate existing claims
- `verifyClaims` smoke after migration

**Estimated size:** MEDIUM. Touches 5 files + runs a data migration.

**Migration plan (G6):**
- E is a deliberate breaking change for the `claims.admin` consumer. Existing tokens with `{admin:true}` will continue to work until token refresh; after F migration + token refresh, only `{role:'admin'}` remains.
- Rollback: revert the consumer change. The dual-shape writes from B continue to grant `admin:true` until the writer change deploys.

### 7.5 Pre-H.0.0.F — `syncRoleClaims` utility

**Why:** D defines `isPartner()`. We need a way to write `partner` claims to the relevant employees (Haim + Guy). Also need to migrate the existing `admin` claims to single-shape after E.

**Scope:**
- New `functions/src-ts/sync-role-claims.ts` — v2 callable, admin-gated
- Reads `employees` collection, sees `role` field (admin / partner / employee)
- For each employee whose Auth custom claim drifts from the Firestore role → updates the claim
- **DRY-RUN by default.** Returns a diff plan, no writes. `--apply` flag (in callable input) actually writes.
- Idempotent. Uses lock doc (mirror initializeAdminClaims pattern). Audit per employee via `logCriticalAction` (from C).
- Tests: dry-run mode, apply mode, idempotency, lock contention, role transitions (admin→employee, employee→partner, etc.)

**Estimated size:** MEDIUM (~200-300 lines TS + tests).

### 7.6 Pre-H.0.0.G — `employee_costs/{email}` collection schema

**Why:** H.2 (Cost foundation) needs a place to store per-employee cost-per-hour. The accountant produces this data. We must store it CF-only — never readable from the client SDK (PII-sensitive financial data).

**Scope:**
- Define schema: `{ email, costPerHour, currency, validFrom, validUntil, updatedBy, updatedAt, source }`
- `firestore.rules`: `match /employee_costs/{email} { allow read, write: if false; }` — CF-only access
- New callable `setEmployeeCost(email, costPerHour)` — admin-gated, audit-first
- New callable `getEmployeeCost(email)` — admin-gated, read-only (NOT exposed to employee Self)
- Schema definition file: `functions/src-ts/schemas/employee-cost.ts` (Zod)
- Tests + documentation

**Estimated size:** MEDIUM (~250 lines TS + tests + rules).

**Implementation status (2026-05-31): 🟡 in progress** on branch `feat/pre-h-0-0-g-employee-costs`. Investigated by security + backend + completeness (Opus) + devils-advocate (MANDATORY §3.8.4).

**Locked decisions:**
- **Model (a) single-doc** `employee_costs/{email}` (Haim approved at checkpoint). NOT subcollection-with-history — completeness returned NEEDS-CONTRACTION: the snapshot-never-re-derive model (§1.3.7) means the app NEVER queries cost-as-of-past-date, so historical-lookup is YAGNI. Cost-CHANGE history lives in `audit_log`.
- **Rule** `allow read, write: if false` — fully CF-only (stricter than `audit_log`'s admin-read). Admins access via `getEmployeeCost` callable, never client SDK. No self-read for employees.
- **Security 4 required (all applied):** (1) fully CF-only rule; (2) `source` is a Zod enum `['accountant','manual','import']`; (3) cost figures FORBIDDEN in `logger.*`, ALLOWED in `audit_log` (forensic), `updatedBy`=UID; (4) `getEmployeeCost` NO self-read carve-out.
- **Devils-advocate 5 (all applied):** (#1) email lowercased ONCE — same key for existence-check + write; (#3) cost values KEPT in audit_log (forensic necessity) + ⚠️ **audit_log is now a salary-PII surface — H.8 BigQuery export (§8.11) MUST redact `SET_EMPLOYEE_COST` details**; (#4) cost bounds min(1)/max(20000) — raised from 10000 to avoid rejecting a legitimate fully-burdened senior figure; (#5) App Check N/A for 10-user admin-trust model (system-wide decision, not G-only) + `validFrom` documented as informational metadata, not a selector.
- **Deferred to H.2:** the shared `resolveEmployeeCost(email, date)` helper (YAGNI now — no consumer until H.2's timesheet trigger).
- **Out of scope:** `deleteEmployeeCost`, subcollection/history, composite index.
- **Files:** `functions/src-ts/schemas/employee-cost.ts` (Zod), `set-employee-cost.ts`, `get-employee-cost.ts`, 2 `__tests__/` ts-jest suites, `firestore.rules` block + `firestore.rules.test` mirror, `tests/rules/employeeCosts.test.ts` (8 deny scenarios), `functions/index.js` wiring, `functions/lib/` compiled (committed). 103 ts-jest tests pass (72 prior + 31 new); 367 root + 600 functions-legacy unchanged.

### 7.7 Phase 1 exit criteria

- All admin-claim writers go through audited, gated, dual-shape-aware endpoints (B ✅).
- `logCriticalAction` is canonical (C); no future PR uses ad-hoc `writeAuditOrThrow`.
- `partner` custom claim infrastructure exists in `firestore.rules` + claim writers (D + F).
- Legacy `{admin:true}` claim shape is fully retired (E). One claim shape: `{role: <name>}`.
- Per-employee cost data has a PII-safe home with CF-only access (G).

Until Phase 1 exit, no Phase 2 PR begins.

> **⚠️ APPROVED EXCEPTION (2026-05-31, H.0 checkpoint):** H.0 (Phase 2 foundations, #346) was allowed to land BEFORE Phase 1 fully exits. Rationale: the two open Phase-1 items (E, F) are **blocked on Haim** (a PROD `verifyClaims` run — see §7.4), not on engineering; H.0 is architecturally **independent** of the claim-shape work (it touches cross-project bridge scaffolding, not Auth claims). The gate's intent — "no Phase-2 PR that *depends* on un-landed Phase-1 safety work" — is preserved: H.0 has zero dependency on E/F. E and F must still land before any Phase-2 PR that writes claims (H.4 task budgeting, H.3 profitability gating).

---

## 8. Phase 2 — H.0–H.9 (The actual AI Management Layer) ⏸️ WAITING

### 8.1 Locked architectural decisions

- **Cross-Project Bridge to `tofes-mecher`**: Pattern A (Cross-Project Cloud Function — live blocking) + Pattern D (BigQuery analytical export). Hybrid; not "pick one".
- **Cost stamping**: `costPerHourAtEntry` snapshot at time of write. Never re-derive.
- **Profitability model**: "Plan" (Static, set at intake) + "Forecast" (Dynamic, updates as hours accrue). Both visible to admins.
- **Exception semantics**: "open debt to collect from client" — NOT "loss". Modal text + UX reframed.
- **Task budgeting**: hybrid rules — partner-assigned tasks require approval; employee-self-opened tasks auto-approve <3h, partner-approval ≥3h.
- **AI chat**: read-only queries. No write actions through AI. MCP integration. Claude-backed with prompt caching.
- **AI signature verification**: presence-only, not fraud detection.

### 8.2 H.0 — Foundations ✅ MERGED (#346, 2026-05-31)

> **⏭️ NEXT SESSION RESUME POINT (2026-05-31):** H.0 merged. Phase 1 = 5/7 (A,B,C,D,G done; **E,F BLOCKED** on Haim running `verifyClaims` in PROD — see §7.4). The natural next step is **H.1** (the real tofes-mecher bridge) — but H.1 is **BLOCKED on 6 UNVERIFIED tofes-mecher facts** the agent cannot access (collection name, exact field names+types, `customer` shape, the client↔sales_record join key, flat-vs-subcollection, `fee` VAT/installment semantics — full list in `docs/PHASE_2_FOUNDATIONS.md`). **To unblock H.1, Haim must either** (a) complete the H.0 Console steps (service account + `firebase functions:secrets:set TOFES_MECHER_SA_KEY` + BigQuery dataset — see PHASE_2_FOUNDATIONS.md) so the deployed `tofesMecherConnectivityCheck` can read real data, OR (b) paste one sample sales_record document (names can be redacted) so the 6 facts can be inferred. **Also pending from H.0:** the DEPLOY PREREQUISITE — the secret must be set in Secret Manager before the next functions deploy, else the whole deploy fails. There is NO unblocked Phase-2 work that doesn't depend on either the tofes-mecher facts (H.1+) or Haim's verifyClaims-PROD run (E/F). So the next session legitimately starts by asking Haim for one of: the tofes-mecher sample, the Console setup, or the verifyClaims-PROD output.

**Goal:** Set up the infrastructure that H.1–H.9 will depend on + prove the cross-project wiring works in the real deployed environment.

**Sub-tasks (refined by 4 Opus agents + devils-advocate at the H.0 checkpoint, 2026-05-31):**
- Cross-project service account: provision a service account in `law-office-sales-form` (tofes-mecher) with **`roles/datastore.viewer`** (read-only — the bridge never writes to tofes-mecher; corrected from the original `datastore.user`). Key stored via `firebase functions:secrets:set TOFES_MECHER_SA_KEY` (Secret Manager); local dev copy at `functions/secrets/tofes-mecher-sa.json` (gitignored). **Console action by Haim.**
- Typed config module: `functions/src-ts/config/index.ts` — cross-project IDs, region, secret name, dataset name. **Code.**
- Named-app init: `functions/src-ts/tofes-mecher/app.ts` — concurrency-safe singleton, sanitized credential errors (no key fragment in logs). **Code.**
- Connectivity-check: `functions/src-ts/tofes-mecher/connectivity-check.ts` — admin-gated v2 onCall, one read of tofes-mecher, `logger.*` (NOT `logCriticalAction` — read-only, G3 N/A). Proves Secret Manager + cross-project IAM (a local script can't). **⚠️ REPURPOSE-OR-DELETE in H.1** once `validateSalesRecordExists` ships — tracked debt.
- BigQuery: Haim creates the EMPTY `law_office_analytics` dataset in Console with **principal-scoped IAM** (Haim/Guy/AI-chat SA, not project-wide); the SCHEMA is documented in `docs/PHASE_2_FOUNDATIONS.md`. The BigQuery **client code** (`@google-cloud/bigquery`) is deferred to **H.1** (large dep, lazy-imported; no consumer until the export job).
- CI: NO new job — the mocked ts-jest tests ride the existing `functions/ npm test` (they need no emulator; no real tofes-mecher key in CI).
- Documentation: `docs/PHASE_2_FOUNDATIONS.md` — Console steps (placeholders only), DEPLOY PREREQUISITE (secret-before-deploy), rotation runbook, BQ schema, UNVERIFIED tofes-mecher facts to confirm before H.1.

**⚠️ DEPLOY PREREQUISITE:** `defineSecret` requires `TOFES_MECHER_SA_KEY` to exist in Secret Manager BEFORE any functions deploy, else the WHOLE codebase deploy fails. Haim sets the secret BEFORE merge/next-deploy.

**Security note (over-read):** `datastore.viewer` is project-level — Firestore IAM has no collection scoping and SAs bypass Security Rules, so the SA can read ALL of tofes-mecher. The control is key custody (Secret Manager + gitignored) + the rotation runbook, NOT IAM scoping. Documented in PHASE_2_FOUNDATIONS.md.

**Estimated size:** MEDIUM (HEAVY-flagged by effort-scaler due to cross-project IAM + secrets, but the code surface is right-sized after the investigation contracted BigQuery + the bridge logic to H.1).

### 8.3 H.1 — Cross-project bridge to `tofes-mecher`

**Goal:** Pattern A live blocking + Pattern D analytical export.

**Sub-tasks:**
- **Pattern A — live blocking CF**:
  - New CF `validateSalesRecordExists(salesRecordId)` — admin-gated, queries tofes-mecher Firestore via service account, returns `{exists, fee, customer, signedPdfUrl, signedAt}`
  - Used by H.6 cutover flow before creating a client
  - Tests against fake tofes-mecher project (emulator)
- **Pattern D — BigQuery export**:
  - Scheduled CF (every 1h) reads tofes-mecher `sales_records` collection → upserts into BigQuery `law_office_analytics.sales_records` table
  - Schema mapping: tofes-mecher fields → BQ columns
  - Error handling + dead-letter queue for failed rows
  - Documentation: schema reference for future H.8 (AI chat) queries
- Shared module: `functions/src-ts/tofes-mecher/` with both clients

**Estimated size:** LARGE.

### 8.4 H.2 — Cost foundation

**Goal:** Every timesheet entry stamps the cost-per-hour at write time. Backfill historical entries with current cost (one-time, documented).

**Sub-tasks:**
- Modify `createQuickLogEntry` + `createTimesheetEntry_v2` to read `employee_costs` (via getEmployeeCost from G) and stamp `costPerHourAtEntry` on the entry
- Migration script: `functions/scripts/backfill-cost-per-hour.js` — dry-run default, `--apply` flag, stamps current cost on all historical entries with logging
- Update timesheet trigger to handle the new field
- Tests + documentation

**Dependencies:** G (employee_costs schema must exist first).
**Estimated size:** MEDIUM.

### 8.5 H.3 — Profitability layer

**Goal:** Real-time per-case "Plan" + "Forecast" with dashboard.

**Sub-tasks:**
- **Plan calculation**: at client + service creation, compute and store `plan.expectedHours`, `plan.expectedCost`, `plan.expectedRevenue`, `plan.expectedProfit`. Locked at intake.
- **Forecast calculation**: aggregate trigger on timesheet entries → recompute `forecast.actualHours`, `forecast.actualCost` (Σ costPerHourAtEntry × hours), `forecast.paidRevenue` (from invoices), `forecast.projectedProfit`
- **Dashboard UI**: new admin panel page `profitability.html` with sortable table, color-coded alerts when forecast drops below plan by X%
- **Real-time updates**: dashboard uses Firestore live listeners on client aggregates
- Includes BOTH hourly and fixed-price clients (per Haim 2026-05-27: "אני רוצה שכבר מהרגע הראשון שתיק לקוח נפתח במערכת אז יהיה חישוב אוטומטי")

**Dependencies:** H.2.
**Estimated size:** LARGE.

### 8.6 H.4 — Task budgeting

**Goal:** Hybrid approval rules + budget enforcement.

**Sub-tasks:**
- Modify `createBudgetTask` to require partner approval if `assignedBy === partner` OR (`assignedBy === employee_self` AND `budgetHours >= 3`)
- New approval workflow: pending tasks list for partner, approve/reject with reason
- Partner notification via existing WhatsApp + Admin Panel inbox
- UI updates: task creation modal asks budget upfront; warning displayed when overrun is imminent
- Tests for all 4 paths (partner-assigned, self-opened <3h, self-opened ≥3h pending, self-opened ≥3h rejected)

**Dependencies:** D (isPartner helper) + H.3.
**Estimated size:** MEDIUM.

### 8.7 H.5 — PDF signature pipeline

**Goal:** AI presence check on sales_record signed PDFs.

**Sub-tasks:**
- New CF `verifySignaturePresence(pdfStorageUrl)` — downloads PDF from Storage, sends to Claude with prompt asking "does this document have BOTH a client signature AND a lawyer signature?"
- Returns `{clientSignaturePresent: bool, lawyerSignaturePresent: bool, confidence: float, reasoning: string}`
- NOT fraud detection — only presence (per Haim 2026-05-27: "אוקיי נניח ואני מדלג על אימות שלא מרמים אבל כן לזהות שיש חתימה")
- Used by H.6 cutover flow
- Cost monitoring: log every call with token usage for cost tracking
- Tests against synthetic PDFs

**Dependencies:** H.1 (CF pattern + secrets).
**Estimated size:** MEDIUM.

### 8.8 H.6 — Cutover to gated client/service creation

**Goal:** Replace manual client/service creation with `sales_record + PDF + AI check + admin approval → deterministic creation`.

**Sub-tasks:**
- New admin UI: "Pending Client Creation" page lists sales_records from tofes-mecher that don't yet have a law-office-system client
- For each row: shows tofes-mecher data + PDF link + signature check result (from H.5) + "Approve and Create" button
- On approve: CF `createClientFromSalesRecord(salesRecordId)` → reads sales_record (Pattern A), validates AI signature check passed, creates client + service deterministically, audit trail
- Disable the OLD manual "Create Client" UI behind a feature flag (gradual rollout). After 2 weeks of zero-issue use of the new flow, remove the old UI in a follow-up PR.
- Idempotency: re-calling `createClientFromSalesRecord` for the same sales_record is safe (no duplicate creation)
- Rollback path: if a client is created with wrong data, the audit log has the source sales_record + admin who approved
- Tests: happy path, missing PDF, failed signature check, missing sales_record, idempotency

**Dependencies:** H.5 + H.4 (task budgeting since the flow creates initial tasks).
**Estimated size:** LARGE.

### 8.9 H.7 — Exception modal reframed

**Goal:** "Open debt to collect" instead of "Loss".

**Sub-tasks:**
- Modify `ExceptionModal.js` text strings: "הפסד למשרד" → "חוב פתוח לגביה מהלקוח"
- New "collection workflow" buttons: "מסומן כנגבה" / "בתהליך גביה" / "בלתי-גביה"
- Status persisted on the service / client aggregate
- Profitability dashboard reflects the collection status in Forecast (collected = revenue counted; uncollected = revenue still pending)
- No calculation change — semantic shift only

**Dependencies:** H.6 (or earlier — text-only change can ship anytime).
**Estimated size:** SMALL.

### 8.10 H.8 — AI chat in Admin Panel

**Goal:** Read-only Claude chat with MCP, answering admin queries against joined data.

**Sub-tasks:**
- New admin UI: chat sidebar in Admin Panel, opens with Cmd+K or floating button
- New CF `aiChat(messages, conversationId)` — Anthropic SDK with prompt caching, Claude Sonnet model
- MCP server config: exposes BigQuery query tool (read-only), Firestore read tool, formatted result rendering
- System prompt: includes schema reference, query examples, "you are a read-only assistant for Haim and Guy"
- Token budget per conversation; cost monitoring
- Conversation persistence in `ai_conversations/{uid}/{conversationId}` (admin-only)
- Tests: query examples, token budget enforcement, MCP tool invocation

**Dependencies:** H.1 (BigQuery surface) + H.3 (profitability data available).
**Estimated size:** LARGE.

### 8.11 H.9 — Polish

**Goal:** Ship-ready quality.

**Sub-tasks:**
- UX walkthroughs: short in-app tour for the new dashboard + AI chat
- Telemetry: usage metrics for the new features, alerts on errors
- Runbooks: `docs/RUNBOOK_PROFITABILITY.md`, `docs/RUNBOOK_AI_CHAT.md`, `docs/RUNBOOK_TOFES_MECHER_BRIDGE.md`
- Customer-facing docs: short guide for Haim+Guy explaining the new flows
- Performance pass: lighthouse audit on the new dashboard
- Accessibility pass: keyboard nav, screen reader on new pages

**Estimated size:** MEDIUM.

---

## 9. Phase 3 — MVP → Commercial Ready ⏸️ SCOPE NOT YET LOCKED

When MVP completes (~mid-August 2026), the system works end-to-end for Hershkowitz Law Office in production. But "the system will be sold" (Haim's words 2026-05-25) requires more than MVP. Phase 3 covers the gap.

> **Status**: scope is NOT YET locked. The items below are placeholders based on what a typical commercial SaaS release requires. Final scope + ordering to be decided when Phase 2 nears completion (target lock date: 2026-07-15). At that point Haim + Lead Agent will run a fresh Intent + checkpoint cycle for Phase 3 specifically.

### 9.1 Likely scope (to be confirmed)

| # | Title | Why needed for commercial release | Estimate |
|---|---|---|---|
| **C.0** | Multi-tenant architecture | Today the system is single-tenant (Hershkowitz only). For sale, needs to support multiple law firms with isolated data, claims, billing | LARGE (4-6 weeks) |
| **C.1** | Customer onboarding flow | "I bought the system, now what?" — guided sign-up, initial config, importing existing client list, configuring `employee_costs` | MEDIUM |
| **C.2** | Admin / firm setup wizard | New firm: define partners, employees, fee structures, approval rules | MEDIUM |
| **C.3** | User documentation (Hebrew + English) | End-user manual for lawyers (time entry, tasks), admin manual for partners (profitability, AI chat), accountant integration guide | MEDIUM |
| **C.4** | Demo / sandbox environment | Sales pitches need a pre-populated demo instance reset nightly | MEDIUM |
| **C.5** | Support runbooks | How to triage common customer issues (password reset, claim mismatch, billing dispute, data export request) | MEDIUM |
| **C.6** | Compliance documentation | Israeli privacy law (חוק הגנת הפרטיות), GDPR (if EU customers), financial data retention. DPA template, sub-processor list | MEDIUM |
| **C.7** | Production hardening | Rate limits per tenant, abuse prevention, expanded telemetry, alerting beyond MVP | MEDIUM |
| **C.8** | Performance optimization | Based on observed production load patterns from MVP period | MEDIUM |
| **C.9** | Legal review | Terms of service, privacy policy, customer contract templates | (Haim's domain, outside dev scope) |
| **C.10** | Initial customer migration | If a specific buyer is identified during MVP — actual migration of their existing data, parallel running, cutover | LARGE |

### 9.2 What Phase 3 is NOT (out of dev scope)

- Sales pipeline / marketing materials — Haim's role
- Pricing / business model — Haim's role
- Customer acquisition — Haim's role
- Sales contract negotiation — Haim's role
- Partnership / reseller agreements — Haim's role

### 9.3 Phase 3 timeline estimate (rough)

- If multi-tenant (C.0) is required for first sale: **8-12 weeks** post-MVP → **commercial-ready ~early November 2026**
- If first sale is to Hershkowitz-only (single-tenant), Phase 3 narrower: **4-6 weeks** post-MVP → **commercial-ready ~mid-September 2026**
- Decision on multi-tenant requirement = **MUST be made by 2026-07-15** to avoid Phase 2 re-work

### 9.4 Phase 3 exit criteria (proposed, to confirm)

- System runs at least 2 isolated tenants in DEV (Hershkowitz + a synthetic demo firm)
- Documentation complete (user manual, admin manual, accountant guide)
- Onboarding flow tested end-to-end with a "fresh" simulated buyer
- Compliance documents signed off by Haim's legal counsel
- Production monitoring + alerting + runbooks cover the top-20 expected support issues
- One actual paying customer onboarded (or a documented commitment to onboard within X weeks)

---

## 10. Decisions Locked (architectural choices made)

Each row: what was decided, when, why, what was rejected. New rows append-only.

| Date | Decision | Why | Alternatives rejected |
|---|---|---|---|
| 2026-05-27 | Hybrid Pattern A + D for tofes-mecher bridge | Pattern A for live blocking (H.6 cutover), Pattern D for AI chat analytics (H.8). Each pattern alone misses a use case. | Pattern A only; Pattern D only |
| 2026-05-27 | `costPerHourAtEntry` snapshot at entry write | Historical entries are immutable for cost purposes. If accountant updates cost, old entries keep old snapshot. | Live re-derive from current `employee_costs` |
| 2026-05-27 | Profitability = Static Plan + Dynamic Forecast | Plan = expectation at intake; Forecast = current projection. Two numbers = clearer signal than one. | Single profitability number |
| 2026-05-27 | Task budgeting hybrid (partner=approval, self<3h=auto, self≥3h=approval) | Trust + control balance. Self-opened small tasks shouldn't bottleneck on partner. | All-approval; all-auto |
| 2026-05-27 | Exception modal = "open debt to collect" | Legal billing reality — client pays, just need to collect. "Loss" implies write-off. | "Loss"; "Write-off" |
| 2026-05-27 | AI signature check = presence only, not fraud | "אוקיי נניח ואני מדלג על אימות שלא מרמים אבל כן לזהות שיש חתימה". Low ROI on fraud detection for now. | Full fraud detection |
| 2026-05-27 | Cost calc includes FIXED-PRICE clients (for internal measurement) | "כל מה שעובר בטופס מכר זה עובר להנהלת חשבונות ולכן זה מאוד מדוייק". Internal profitability needs all cases, not just hourly. | Hourly clients only |
| 2026-05-27 | AI chat = read-only | Safety + simplicity. No write actions through AI. | Full agent with mutations |
| 2026-05-27 | tofes-mecher = system-of-record for transactions | Accountant-verified data lives there. Don't duplicate. | Duplicate in law-office-system |
| 2026-05-27 | Engineering Bar BEFORE feature work | First production TS PR must prove the bar works. Pre-H.0.0.B was that proof. | Feature first, bar later |
| 2026-05-28 | 2-commit split (additive A + cutover B) for write-path PRs | Reviewer can verify A in isolation before B activates. Reduces "neither works" window. Devils-advocate finding #6. | Single commit |
| 2026-05-28 | Commit `functions/lib/` to git | Deploy determinism, no build-time dependency, transparent in PRs. | `predeploy` hook |
| 2026-05-28 | Dual-write claims `{admin:true, role:'admin'}` transitionally | admin-panel `auth.js:424` reads `claims.admin === true`. Cleanup deferred to E. Devils-advocate finding #1. | Single `{role:'admin'}` immediately |
| 2026-05-28 | Audit-FIRST, mutation-SECOND, compensating-doc-on-failure | If audit fails, mutation must not happen (fail-secure). Devils-advocate finding #3. | Mutation-first; concurrent |
| 2026-05-28 | Self-elevation block in all admin-claim endpoints | Prevents token-theft → self-grant chain. Standard security pattern. | Allow self-elevation |
| 2026-05-28 | Recovery script `grant-admin-emergency.js` with `--apply` flag | All in-app paths require existing admin. Need break-glass tool. Devils-advocate finding #2. | No bootstrap recovery path |
| 2026-05-28 | All sub-agents Opus, effort-scaler Haiku | "פטיש הכי מקצועי שיש". Haiku only where the task is trivial classification. | All Haiku; all Opus |
| 2026-05-28 | Pre-PR must run BOTH root + functions typecheck | Pre-H.0.0.B CI miss: root tsc included functions/src-ts/*.ts. Lesson: mirror CI locally. | Functions-only typecheck pre-PR |
| 2026-05-31 | Defer E, do G first | E BLOCKED on Haim running verifyClaims-PROD + DEV/PROD shared-Auth risk; residue harmless; G unblocked + on critical path to profitability dashboard | Do E next (blocked); reorder F before E |
| 2026-05-31 | E migration via one-shot `migrate-claim-shape.js`, NOT F | §7.4 "migrate via F" was circular (F depends on E). Option A self-contained, mirrors grant-admin-emergency.js | Build F first (Option C — inflates E, same prod risk) |
| 2026-05-31 | employee_costs = single-doc per employee, NOT subcollection-history | snapshot-never-re-derive (§1.3.7) means app never queries cost-as-of-past-date → history is YAGNI; audit_log holds change history. completeness NEEDS-CONTRACTION | (b) subcollection-with-history; (c) doc-per-period |
| 2026-05-31 | employee_costs fully CF-only (`read,write:if false`) | Most sensitive collection (salary-PII); admins read via getEmployeeCost callable, employees never; smallest surface | admin-read like audit_log |
| 2026-05-31 | Cost values KEPT in audit_log (not redacted) | Forensic audit useless without values; admins are authorized to see costs. ⚠️ H.8 BigQuery export MUST redact SET_EMPLOYEE_COST | Redact cost from audit (breaks forensic trail) |

---

## 11. How to update this file

The rules:

1. **Status flips** happen the moment a PR is merged. Update on the same session, same Lead Agent. Commit as a follow-up to the merge.
2. **New rows** (added PR scope mid-phase) need explicit Haim approval first. No silent scope additions.
3. **Cross-phase reorderings** (e.g., promoting H.2 above H.1) require a documented rationale at the end of this file under "Plan revisions".
4. **PR links** added once the PR is opened (not at planning time).
5. **Size estimates** are LIGHT (≤80 lines) / MEDIUM (80-500 lines) / LARGE (>500 lines).
6. **New architectural decisions** append to "Decisions Locked" with date + rationale + rejected alternatives.

If you find this file out of date when starting a session, the FIRST action is to reconcile it with merged-PR state before doing anything else.

---

## 12. Session crash recovery

This file is the recovery instruction.

1. New session starts → Lead Agent reads `CLAUDE.md` (auto-loaded) → sees `MASTER_PLAN.md` reference in the imports.
2. Lead Agent reads this file → finds the row marked "in progress" or "_next_" (if any).
3. Lead Agent runs `git status` + `git log --oneline -10` + checks for open PRs (`gh pr list`).
4. If a branch matches an in-progress row → resume from where work stopped (read the rubric file, re-run tests, check what's committed vs. pending).
5. If no branch matches → ask Haim "Were we in the middle of [in-progress row]? Status shows X, repo shows Y."

The Lead Agent is allowed to **trust this file** over their own session memory. If this file says "Pre-H.0.0.C in progress" and the Lead Agent has no recollection — believe the file.

---

## 13. Related references

| Topic | Where |
|---|---|
| Feature Protocol (order of steps per PR) | `@.claude/rules/feature-protocol.md` |
| Agent rules (when each sub-agent is mandatory) | `@.claude/rules/agent-rules.md` |
| Decision-point rule (consult agent before AskUserQuestion) | `@.claude/rules/decision-point.md` |
| 7 PRODUCT-GRADE Gates | `@.claude/rubrics/_PRODUCT-GRADE-GATES.md` |
| Engineering Bar (backend TS standard) | `docs/ENGINEERING_BAR.md` |
| Design Bar (frontend UI standard) | `docs/DESIGN_BAR.md` |
| Partner claim diagnostic findings | `docs/PARTNER_CLAIM_DIAGNOSTIC.md` |
| Admin claim recovery playbook | `docs/ADMIN_CLAIMS_RECOVERY.md` |
| System map (functions inventory) | `SYSTEM_MAP.md` |

---

## 14. Plan revisions

_Cross-phase reorderings or material plan changes. Date + rationale required._

- **2026-05-28 (initial)**: Plan committed. Phase 0 fully done; Phase 1 at 2/7 (A + B). Phase 2 untouched.
- **2026-05-28 (expansion)**: Expanded from skeletal to comprehensive — added Product Vision, Standard, Working Agreement, Timeline (ETA early-mid August 2026 for MVP), per-PR sub-tasks for Phase 1 C-G and Phase 2 H.0-H.9, Decisions Locked log capturing 18 architectural choices from sessions through 2026-05-28. Reason: skeletal version was insufficient as a single source of truth — a cold-start agent reading it could not have planned the next PR. Haim explicit request: "אי אפשר ככה איך תרחיב אם אתה לא יודע על מה".
- **2026-05-29 (visibility + Phase 3)**: Added §5.4 weekly Visible Milestones table (week-by-week DEV bud schedule, honest that first major UI lands Week 5-6), §5.5 optional bud accelerators (4 bonus PRs that bring visible progress forward at cost of +2 weeks to MVP date), new §9 Phase 3 — MVP → Commercial Ready (multi-tenant / onboarding / docs / demo / compliance / hardening). Reason: Haim's question "מה בפועל אני יכול לראות בDEV את הניצנים?" exposed that the plan ended at MVP without addressing commercial readiness, and that the 4-week backend stretch before any UI was not flagged. Phase 3 scope is NOT YET LOCKED — final scope + ordering decided when Phase 2 nears completion (lock date target 2026-07-15).
- **2026-05-29 (standard supremacy)**: Added §2.0 Non-negotiable principle — the bar supersedes preference. Codified Haim's explicit rule: "אני לא רוצה שיבוא בחשבון מה שאני רוצה על חשבון הסטנדרט הגבוה ביותר... מבחינת ארכיטקטורה ומקצועיות". Added §3.8 operational protocol: trade-off type classification (Time/scope = Type A, offerable; Quality/bar = Type B, NOT offerable as choice), refusal protocol with concrete examples, speed-exemption scope (covers low-stakes, NOT high-stakes), high-stakes auto-defense triggers (production-stable merge, schema change, security rule change, refactor >100 lines, migration, new claim writer, new Firestore collection, cross-project IAM, new PII Cloud Function). Reason: previous protocol left ambiguity about when Lead Agent should refuse a Haim request; this codification removes the ambiguity. The Lead Agent now has an explicit, auditable protocol for enforcing the bar even against Haim's own preferences.
- **2026-05-29 (bar specification)**: Added §2.0.1 (formal definition of "the bar" as the union of 5 enumerated sources — the 7 Gates, §2.1–§2.9, Engineering Bar, Design Bar, per-PR rubric MUSTs; everything outside is preference, not refusal trigger), §2.0.2 (measurement classification table — every bar item labeled Mechanical or Subjective, with the measurement method spelled out), §3.8.5 (override mechanism for Subjective refusals — CASE A Mechanical = no override, CASE B Subjective = explicit override with audit-logged format in PR body), §15 (Bar Revisions Log — separate update protocol for the bar itself; bar changes ship as own PR with own rubric, forward-only, explicit Haim approval required). Reason: §2.0 + §3.8 (from PR #340) codified "the bar supersedes preference" and gave the Lead Agent authority to refuse, but the principle was incomplete — Haim's question "מה רף הסטנדרט ולפי מה הוא נמדד" exposed that the bar was nowhere defined formally, no measurement classification existed, no recourse for Subjective disagreements was specified, and no evolution path was documented. Without these four pieces, refusal authority was unanchored — Claude could invent "bar concerns" in the moment without traceability. Each addition is anchored to a specific Anthropic publication (Constitutional AI for explicit specs over implicit, Evals docs for programmatic over model-based grading, Building Effective Agents for override paths over deadlocks, Multi-Agent Research System for versioned specs over silent drift).
- **2026-05-30 (workflows library)**: Added `.claude/workflows/` library with 3 reusable multi-agent orchestration scripts (`fact-check.js`, `source-verify.js`, `deep-audit.js`) + `README.md` (decision tree, cost guidance, fallback path) + new `WORKFLOWS` section in `CLAUDE.md` + new "Workflows vs direct agent invocation" section in `agent-rules.md`. Workflows are PATTERNS for using the existing 12-agent team — they do NOT introduce new agent types and do NOT modify the team. Triggered by the release of Claude Opus 4.8 + Claude Code Dynamic Workflows feature (research preview); after verifying all claims against primary Anthropic sources, captured the patterns we kept re-inventing per-session (parallel search + adversarial verify + synthesize). Research-preview dependency explicitly disclosed; scripts double as documentation so the Lead Agent can fall back to manual orchestration if the `Workflow` tool becomes unavailable. NOT a bar revision (does not change what makes work acceptable) — only adds a new opt-in capability.

---

## 15. Bar Revisions Log

> **Anchor — Anthropic "How we built our multi-agent research system" (2025):** Following Anthropic's published learning that agent specifications must be versioned explicitly — when the spec changes, behavior changes, and the team needs an auditable trail of *why* the spec changed. Implicit spec drift was the failure mode they explicitly named. Paraphrased; see anthropic.com/engineering/multi-agent-research-system for the canonical post.

This log records every change to **the bar itself** — the five sources enumerated in §2.0.1. It is intentionally separate from §14 (Plan revisions). Plan changes are about scope and direction; Bar revisions are about what makes work *acceptable*.

### Update protocol

1. **Bar changes require their own PR.** A bar revision must NEVER ship inside a feature PR. It is its own unit of work with its own rubric in `.claude/rubrics/`.
2. **Explicit Haim approval required.** A bar revision is never implicit in a feature scope discussion. The PR description must contain Haim's explicit approval text.
3. **Devils-advocate review MANDATORY.** Every bar revision PR must invoke `devils-advocate` against the proposed change before merge. The agent's verdict must be cited in the PR body. Rationale: bar revisions are the one place where Haim approves Haim — without an adversarial check, the loop is self-sealed.
4. **Forward-only with file-touch carry rule.** Bar revisions apply to PRs opened **after** the revision merges. Previously-merged PRs are grandfathered and NOT retroactively re-graded. **However:** when a PR opened after a revision touches a file that contains grandfathered code, only the **new or modified lines** must meet the current bar — untouched lines remain grandfathered. This prevents single bar changes from forcing wholesale file rewrites.
5. **Rollback path mandatory.** Every bar revision PR includes a `git revert` rollback that restores the previous bar.
6. **Log entry mandatory.** Every bar revision adds a row to the table below at merge time.

### Log table

| Date | Bar item touched | Before | After | Rationale | PR |
|---|---|---|---|---|---|
| 2026-05-29 | Baseline — initial bar specification | (none — §2.0 was principle only, no formal definition or measurement) | §2.0.1 (5-source union definition) + §2.0.2 (Mechanical/Subjective classification table) + §3.8.5 (override mechanism for Subjective refusals) + §15 (this log) | Close the §2.0 / §3.8 specification gap exposed by Haim 2026-05-29: "מה רף הסטנדרט ולפי מה הוא נמדד זה למשל חסר". Without a formal definition and measurement classification, the refusal authority granted in §3.8 was unanchored. This entry establishes the baseline that future revisions diverge from. | PR-META-8 |

### What is NOT a bar revision

The following changes do NOT trigger this protocol:

- Adding a new per-PR rubric in `.claude/rubrics/<pr-id>.md` — that's per-PR governance, not the bar itself.
- Updating `SYSTEM_STATUS.md` or `SYSTEM_MAP.md` — those are status documents, not bar.
- Documenting a new architectural decision in §10 (Decisions Locked) — that's a decision log entry, not a bar change.
- Tightening a rubric MUST for a specific PR — that's per-PR scope, not bar.
- Adjusting the per-PR rubric's SHOULD criteria — same reason.

The bar revision protocol applies only when the **change affects how future PRs are evaluated** at the level of one of the five sources in §2.0.1.

### Why this is separate from §14

§14 logs plan revisions — changes to scope, timeline, architecture decisions, what we're building.
§15 logs bar revisions — changes to what makes the work *acceptable* (quality threshold, refusal rules, measurement classification).

The two evolve on different cadences. Plan changes happen as the project learns; bar changes happen as the standard itself evolves (industry, customer feedback, regulatory changes, internal learning about what "professional" means in this codebase). Mixing them in one log would conflate "we're now building H.10" with "we now require AST audit-FIRST scans" — these are not the same kind of change and shouldn't be grepped together.
- **2026-05-31 (E deferred, G in progress)**: §7.1 — D→✅ merged (#343), E→⏸️ BLOCKED+deferred, G→🟡 in progress. §7.4 — added BLOCKED banner + 2 hard prerequisites (Haim runs verifyClaims-PROD; DEV/PROD share one Firebase project) + circular-reference fix (Option A one-shot migrate-claim-shape.js, not F) + expanded scope from completeness. §7.6 — locked G as single-doc model (a) + security-4 + devils-advocate-5 applied. §10 — 6 new Decisions-Locked rows. Reason: E investigation (3 Opus agents) found E blocked on a Haim PROD action + low-value/high-risk; G is unblocked and on the critical path to the profitability dashboard (first visible bud). Haim approved defer-E-do-G at checkpoint.
- **2026-05-31 (G merged #345, H.0 in progress)**: G (employee_costs) merged via PR #345 → Phase 1 at 5/7 (A,B,C,D,G done; E,F blocked on the verifyClaims-PROD prerequisite). Haim approved deferring E+F and starting **Phase 2 H.0** (tofes-mecher foundations). §8.2 (H.0) **revised** — this is a **§14 plan revision, NOT a §15 bar revision** (§8.x is roadmap scope, not an acceptance-criteria source from §2.0.1; per §15's own "What is NOT a bar revision" list, plan/roadmap edits are §14). Changes to §8.2: (a) `datastore.user`→**`datastore.viewer`** (read-only least-privilege; security agent); (b) BigQuery client code + `@google-cloud/bigquery` dep deferred to H.1 (H.0 = Console-provision empty dataset + document schema); (c) dropped the "new CI job" line (mocked tests ride existing `functions/ npm test`); (d) added DEPLOY PREREQUISITE (secret-before-deploy), over-read security note, and REPURPOSE-OR-DELETE-in-H.1 debt marker for the connectivity-check. Reason: 4 Opus agents (security/backend/data/completeness) + mandatory devils-advocate (cross-project IAM+secrets+new-infra, §3.8.4) refined the original "everything at once" H.0 into a right-sized foundation; the bridge logic + BigQuery client move to H.1. Haim approved all 4 checkpoint decisions + the full-PR scope.
