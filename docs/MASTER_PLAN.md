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

## 7. Phase 1 — Foundational Safety (Pre-H.0.0) 🏁 CLOSED (7/7, 2026-06-08)

### 7.1 Overview

Closes the security and audit gaps that block any commercial release. Every Phase 2 PR depends on these landing first.

| # | Title | PR | Status | Size | Depends on |
|---|---|---|---|---|---|
| A | `verifyClaims` callable | #336 | ✅ merged | (in Phase 0.1) | — |
| B | Admin-claim endpoint lockdown | [#339](https://github.com/Chaim2045/law-office-system/pull/339) | ✅ merged | LARGE | A |
| C | `logCriticalAction` audit primitive | [#342](https://github.com/Chaim2045/law-office-system/pull/342) | ✅ merged | LIGHT | B |
| D | `isPartner()` helper + rules-test infrastructure | [#343](https://github.com/Chaim2045/law-office-system/pull/343) | ✅ merged | MEDIUM | A |
| E | Claim shape consolidation | [#357](https://github.com/Chaim2045/law-office-system/pull/357) | ✅ merged + deployed + **G6-verified** (2026-06-05 — writer-contraction; Deploy-to-Production=success; PROD `verifyClaims` admin_boolean_only:0/both_shapes:0) | MEDIUM | B + D |
| F | `syncRoleClaims` utility | [#362](https://github.com/Chaim2045/law-office-system/pull/362) | ✅ merged + deployed + **`--apply` DONE** (2026-06-08 — removed 7 dormant `{role:'lawyer'}`; PROD `verifyClaims` mismatchCount:0, perfect canonical state). Partner-grant deferred to H.3 (Haim/Guy are role=admin) | MEDIUM | C + D + E |
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

> **✅ DONE — MERGED & DEPLOYED TO PROD (PR #357, 2026-06-04).** Writer-contraction shipped: all 4 admin-claim writers now emit `{role:'admin'}` only (revoke → `{}` full removal); the 2 idempotency guards contracted atomically to `role`-only. NEW `claim-shape-contraction-guard.test.ts` locks it (cross-writer role-only invariant + the **previously-untested v1 revoke→`{}`** + a **PII guard** that surfaced & redacted an employee email out of `logger.*` + a repo-wide backstop). Reviews: **outcomes-grader=PASS** (7/7 MUST, 2/2 SHOULD), **devils-advocate=GO-WITH-CHANGES** (folded #4 repo-wide guard + #5 stale test-name; **#2 revoke read-merge-write recorded as a HARD F prerequisite — §7.5**). CI `ci-cd-production` for the merge `fd776a1`: **Deploy to Production=success, Health Check=success, Automated Tests 759/759=success** (overall run reads "cancelled" only because the optional E2E Playwright job was cancelled — same pattern as #356; it does NOT gate the deploy). **✅ FINAL G6 EVIDENCE CAPTURED (PROD `verifyClaims`, 2026-06-05):** `{role_string_only:11, admin_boolean_only:0, both_shapes:0, no_claim:1, auth_user_missing:0}` — post-deploy the claim store is fully on the canonical single shape; no writer reintroduced the boolean. **E is closed with evidence.** **✅ FOLLOW-UP DONE — MERGED & DEPLOYED (PR #358, 2026-06-07).** Removed the legacy `admin:true` acceptance from all 7 consumers (admin-panel `auth.js` Layer-1 + the 6 v2/v1 gate halves) + the 2 dev diagnostics, WITH consumer-rejection tests (5 gate tests flipped to REJECT a `{admin:true}`-only token + an AST backstop in `claim-shape-contraction-guard.test.ts` group 5). The `verifyClaims adminBoolean` diagnostic was KEPT as the regression sensor. security-access-expert=GO, devils-advocate=GO-WITH-CHANGES, grader=PASS_WITH_WARNINGS; 766/766 tests; CI `ci-cd-production` for `10fd1ed`: Deploy-to-Production=success + Health-Check=success. **🎯 E IS NOW CLOSED END-TO-END — one claim shape system-wide: `{role:'admin'}`.** The historical READY-TO-CODE / full-scope content below is retained for reference.
>
> **LOCKED SCOPE = GO-WITH-SPLIT (writer-contraction ONLY).** Bar-mandated split (security + devils-advocate); backend's "one-PR" was OVERRULED — git `bd3ecd8` proves the legacy writers minted `admin:true`-only tokens, so a live JWT can be boolean-only until refresh → removing the consumer read in the same PR violates the §7.4 expand-contract = a §2.0 non-overridable bar item.
>
> **IN THIS E PR:**
> 1. Stop the **4 writers** emitting `admin:true` → write `{role:'admin'}` only: `functions/auth/index.js:236` (legacy `setAdminClaim` grant); `functions/src-ts/set-admin-claims.ts:137`(audit)/`154`(grant)/`58`+`197`(`claimShapeWritten` type+return); `functions/src-ts/initialize-admin-claims.ts:172`(audit)/`192-195`(grant); `functions/scripts/grant-admin-emergency.js:114`(grant).
> 2. **Fix 2 idempotency guards ATOMICALLY with the writers** (else every init/break-glass run re-writes all admins post-contraction → audit spam + forced token refresh): `initialize-admin-claims.ts:156` (`existingClaims.admin === true && role==='admin'` → `role`-only) + `grant-admin-emergency.js:97` (same).
> 3. **Revoke residue → `{}`** (NOT `{admin:false}`): `auth/index.js:237` resolve to full-removal `{}`, **with a test** (the v1 `setAdminClaim` revoke is currently untested; `setCustomUserClaims` is a full replace).
> 4. **Rebuild + commit 2 `lib/` files:** `lib/set-admin-claims.js` + `lib/initialize-admin-claims.js` (+ `.map`). (`auth/index.js` + `grant-admin-emergency.js` are not compiled.)
> 5. **Update 8 writer-side test AST-guards** asserting the OLD `{admin:true,role:'admin'}` literal (else red CI): `set-admin-claims.test.ts:94-98,151,260,269,278` + `initialize-admin-claims.test.ts:107-109,117,230,248-258,335,348` → assert `{role:'admin'}`-only; flip the `:117` idempotency assertion.
> 6. **Author `.claude/rubrics/pr-h-0-0-e.md`** (do NOT reuse the stale unrelated `pr-e.md`). Update stale docblocks in the 4 writer files; update `docs/PARTNER_CLAIM_DIAGNOSTIC.md` + `docs/ADMIN_CLAIMS_RECOVERY.md` (dual-shape → role-only). PII guard test (no claim values/emails into `logger.*`).
> 7. **Final `verifyClaims` at merge-moment** → confirm `admin_boolean_only` stays 0 (G6 evidence).
>
> **DO NOT touch in E** (deferred consumer-read sweep — their AST guards assert the dual string; removing now = the bar-violation): `apps/admin-panel/js/core/auth.js:426`; backend gate halves `|| claims.admin === true` at `set-admin-claims.ts:75`, `initialize-admin-claims.ts:69`, `get-employee-cost.ts:54`, `set-employee-cost.ts:61`, `connectivity-check.ts:66`, `verifyClaims` gate `auth/index.js:328`; KEEP `verifyClaims:399` `adminBoolean` diagnostic permanently. `devtools/debug-scripts/browser-check-guy.js:69` rides the same follow-up.
>
> **FOLLOW-UP PR (after a ≥1h, ideally ≥24h token-refresh window):** remove `auth.js:426` + the gate halves — **MUST add a consumer-rejection test** (a `{admin:true}`-only token is rejected) or the guard is silently lost.
>
> **DEFER TO F (§7.5):** the **7 redundant `{role:'lawyer'}` claims** (`firestore_employee_has_elevated_claim`) — inert today (rules test only `=='admin'`/`=='partner'`) but a **DORMANT escalation**: the day a `messages` doc carries `toRoles:['lawyer',…]` (`firestore.rules:239` dynamic membership) they'd grant read. F's §7.5 entry gains a **"blocks any `toRoles`-containing-lawyer feature"** dependency; F must REMOVE (not rewrite) claims for employees whose canonical state is no-claim.
>
> **Branch clean before starting** (regenerable `apps/user-app/dist/**` drift — don't sweep into the diff). Tracker tasks #63-67 are mislabeled (tracked the 2026-05-31 deferred-investigation, not this execution).
>
> **⏸️ STATUS (HISTORICAL, 2026-05-31 — superseded by the READY block above): BLOCKED + DEFERRED.** Investigated by 3 Opus agents (security / backend / data-investigator). E was deferred in favor of G (G is unblocked + on the critical path to the profitability dashboard, the first visible bud). **Two HARD PREREQUISITES before E can safely execute:**
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

> **✅✅ DONE — MERGED + DEPLOYED + `--apply` EXECUTED (PR #362, 2026-06-08). 🏁 PHASE 1 CLOSED.** `syncRoleClaims` shipped: reconciles `employees.role` → Auth `{role}` claim (admin/partner → claim; everything else → no claim), DRY-RUN default + strict `apply===true`, lock, per-employee audit-FIRST, fail-secure `messages.toRoles` probe, **read-merge-write** everywhere (shared `claim-writer.js` primitive → F + v1 `setAdminClaim` grant/revoke + `master-admin-wrappers` updateUser, which now filters to elevated so editing→lawyer/employee CLEARS the claim). `verifyClaims` extended to scan `'lawyer'`. Reviews: backend+security=GO-WITH-CONDITIONS (9 guards), devils-advocate=GO-WITH-CHANGES (folded updateUser elevated-filter + email-lowercase + lawyer-probe-is-observability; TOCTOU lock accepted), grader=PASS (8/8 MUST). 810/810 tests; CI `88436c5`: Deploy-to-Production=success + Health-Check=success.
>
> **✅ SUPERVISED `--apply` COMPLETE (PROD, 2026-06-08, Haim+Lead Agent):** DRY-RUN reviewed (clean: partnerCount=0, 7 lawyer removals, 0 failures) → `--apply` removed the **7 dormant `{role:'lawyer'}` claims**. **Post-`verifyClaims`: `role_string_only:4, no_claim:8, both_shapes:0, admin_boolean_only:0, mismatchCount:0, messagesWithLawyerToRoles:0`** — the claim store is now in PERFECT canonical state (only the 4 admins hold a role claim; all 12 employees reconciled to SSOT). Idempotency confirmed in PROD (a re-run = clean `noChange:12` no-op).
>
> **🔵 PARTNER-GRANT DEFERRED TO H.3 (architectural finding):** the DRY-RUN revealed Haim+Guy have `employees.role = "admin"` (NOT "partner") — and the single-role `{role:X}` model means admin (higher privilege) cannot coexist with partner. So **F correctly granted 0 partner claims** (no employee is role=partner). The partner claim INFRASTRUCTURE exists (D read-side + F write-side); the actual partner GRANT is deferred to H.3, where the profitability dashboard gates on **`isAdmin() || isPartner()`** (admins see it; a future non-admin partner gets the claim via F). Do NOT change Haim/Guy to role=partner — it would demote them from admin. The §7.5 revoke read-merge-write prerequisite is SATISFIED in F. The historical scope below is retained for reference.

**Why:** D defines `isPartner()`. We need a way to write `partner` claims to the relevant employees (Haim + Guy). ~~Also need to migrate the existing `admin` claims to single-shape after E.~~ (Struck — E already drove the store to single-shape; F is purely the role↔claim drift reconciler + first partner writer.)

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

## 8. Phase 2 — H.0–H.9 (The actual AI Management Layer) 🟡 IN PROGRESS

### 8.1 Locked architectural decisions

- **Cross-Project Bridge to `tofes-mecher`**: Pattern A (Cross-Project Cloud Function — live blocking) + Pattern D (BigQuery analytical export). Hybrid; not "pick one".
- **Cost stamping**: `costPerHourAtEntry` snapshot at time of write. Never re-derive.
- **Profitability model**: "Plan" (Static, set at intake) + "Forecast" (Dynamic, updates as hours accrue). Both visible to admins.
- **Exception semantics**: "open debt to collect from client" — NOT "loss". Modal text + UX reframed.
- **Task budgeting**: hybrid rules — partner-assigned tasks require approval; employee-self-opened tasks auto-approve <3h, partner-approval ≥3h.
- **AI chat**: read-only queries. No write actions through AI. MCP integration. Claude-backed with prompt caching.
- **AI signature verification**: presence-only, not fraud detection.

### 8.2 H.0 — Foundations ✅ MERGED (#346, 2026-05-31)

> **⏭️ NEXT SESSION RESUME POINT (updated 2026-06-01):** H.0 merged. Phase 1 = 5/7 (A,B,C,D,G done; **E,F BLOCKED** on Haim running `verifyClaims` in PROD — see §7.4). **✅ H.1 IS NOW UNBLOCKED:** the 6 previously-UNVERIFIED tofes-mecher facts were resolved on 2026-06-01 via a one-time **read-only schema probe** of `law-office-sales-form` (developer ADC, field names+types only, zero PII, probe deleted/never committed). Full verified schema in `docs/PHASE_2_FOUNDATIONS.md` ("✅ VERIFIED" section). Headlines: collection = `sales_records` (flat, top-level, auto-id docs); client fields are **FLAT** (no nested `customer`); money is **fully decomposed** (`amountBeforeVat`/`vatAmount`/`amountWithVat`/`amount`) — no VAT inference; `clientId` is tofes-**internal**, so the cross-system join needs a natural key — **`idNumber` (ת"ז) recommended**. **ONE open decision before H.1 code:** confirm how the main `law-office-system` `clients` store `idNumber` (presence+format) to lock the join. **Pre-H.1 non-PII follow-up (safe):** exact `date` format + enum value-sets (`transactionType`/`paymentMethod`/`clientStatus`). **Also still pending from H.0:** the DEPLOY PREREQUISITE — `TOFES_MECHER_SA_KEY` must be set in Secret Manager before the next functions deploy. **E/F remain blocked** on Haim's verifyClaims-PROD run. **UPDATE 2026-06-02:** the cross-system join was investigated (the main CRM does NOT store ת"ז today — verified) and the **cross-reference + fee-reconciliation architecture is now LOCKED in §8.2.5 ("DLR")** (Haim-approved). The H-sequence gained a prerequisite. **UPDATE 2026-06-02 (later):** **Pre-H.1.0a (backend) ✅ MERGED (#348)** — `isValidIsraeliId()` + `createClient` optional/validated/stored idNumber + `updateClient` immutable + PII guards (746/746, grader PASS). Investigation corrected the naive scope: the live client-creation UI is the **User App** (the Admin wizard is dead), `idNumber` already exists via an unvalidated bypass, and it is NOT unique (client=case). **⏭️ IMMEDIATE NEXT PR → Pre-H.1.0b (UI, User App):** add the ת"ז field to `apps/user-app/js/modules/case-creation/case-creation-dialog.js` (+ `case-form-validator.js` + `buildFirebaseData`), enforce **required**, reconcile the frontend Zod, handle `idType:'passport'` + the `validation-script.js` harness — FULL Feature Protocol. **Deferred & tracked (§8.2.5):** clients read-access (G7), SimpleClientDialog bypass, ~127-doc backfill, WhatsApp echo, and the `pull-request.yml` injection (spun off as a separate local task). **UPDATE 2026-06-03:** **Pre-H.1.0b (UI) ✅ MERGED (#353)** as **OPTIONAL** (not required) — devils-advocate STOP + live data (≥2/139 clients are companies; `required` would break ח.פ./passport intake; `required`+`idType` deferred to a future Pre-H.1.0c). Also merged: the `validation-script.js` harness fix (#354) and the `pull-request.yml` shell-injection fix (#352). **The full ת"ז intake slice (Pre-H.1.0) is now COMPLETE** (backend #348 + UI #353). **⏭️ NEXT MAJOR ROCK → H.1 (§8.3, cross-project bridge, LARGE), governed by §8.2.5 (DLR).** HARD PREREQUISITE before H.1 can DEPLOY: **Haim's H.0 Console setup** — (1) service account in `law-office-sales-form` with `datastore.viewer`; (2) `TOFES_MECHER_SA_KEY` in Secret Manager (deploy-blocker for the whole codebase); (3) empty `law_office_analytics` BigQuery dataset. H.1 *code* can start before that, but cannot be deployed/tested against real tofes-mecher until it's done. **🔴→✅ PROD-DEPLOY INCIDENT (2026-06-04 — RESOLVED):** discovered the CI `deploy-production` job had been FAILING on every push to `main` since **2026-05-28 (#339)** on TWO stacked blockers — **(A)** `setAdminClaims`/`initializeAdminClaims` 1st→2nd-Gen in-place upgrade conflict; **(B)** the H.0 connectivity-check's unset `TOFES_MECHER_SA_KEY` secret (fired first, masking A). So **~6 days of backend + firestore.rules never reached PROD** (Pre-H.0.0.B/C/G + #348 + the holidays train), and the **live unauthenticated `setAdminClaims` onRequest** (zero-auth admin-claim grant — the exact thing B was built to retire) stayed exposed the whole time. **Resolved (supervised, Haim's hands):** #355 un-exported the connectivity-check (cleared B); `firebase functions:delete setAdminClaims initializeAdminClaims` (cleared A + closed the vuln); chunked `firebase deploy --only firestore:rules` then `--only functions` released the full backlog. **Verified in PROD:** `setAdminClaims`/`initializeAdminClaims` now **v2 auth'd callables**, `getEmployeeCost`/`setEmployeeCost` live, `createClient` (#348 ת"ז) live, rules live; smoke `verifyClaims` responds. **Pre-flight `verifyClaims` PROD run captured → `admin_boolean_only:0` → E is now UNBLOCKED (near-no-op).** **🧠 LESSON (must enter the protocol): post-merge PROD-deploy verification is mandatory — the deploy-production job was red on every merge for 6 days and no session checked it; a recurrence of the documented 12-day incident (pull-request-workflow lines 415-419).** **✅ Pre-H.0.0.E MERGED + DEPLOYED (PR #357, 2026-06-04) — §7.4.** Writer-contraction to `{role:'admin'}`; CI `ci-cd-production` Deploy-to-Production=success + Health-Check=success (lesson applied: verified the deploy green post-merge). **Phase 1 = 6/7 (A,B,C,D,E,G done; only F remains).** **✅ E CLOSED END-TO-END (2026-06-07):** writers (#357) + G6 evidence (PROD verifyClaims `admin_boolean_only:0`) + consumer-contraction follow-up (#358, Deploy-to-Production=success). One claim shape system-wide: `{role:'admin'}`. **🏁 PHASE 1 CLOSED (2026-06-08).** F (PR #362) merged + deployed + the supervised `syncRoleClaims --apply` executed in PROD: removed the 7 dormant `{role:'lawyer'}` claims; `verifyClaims` confirms perfect canonical state (`role_string_only:4, no_claim:8, mismatchCount:0, messagesWithLawyerToRoles:0`). All 7 Phase-1 items done (A,B,C,D,E,F,G). Partner-claim INFRASTRUCTURE exists (D+F); the GRANT is deferred to H.3 (Haim/Guy are role=admin; dashboard gates on `isAdmin()||isPartner()`). **✅ H.0 CONSOLE SETUP COMPLETE (2026-06-08, Haim):** (1) SA `cross-project-reader` in `law-office-sales-form` w/ `roles/datastore.viewer`; (2) **`TOFES_MECHER_SA_KEY` set in Secret Manager** (firebase CLI confirmed `versions/1` — the DEPLOY PREREQUISITE is now SATISFIED, the 6-day-incident landmine is disarmed); (3) empty `law_office_analytics` BigQuery dataset created (principal-scoped IAM to be locked in H.1 before data lands). **⏭️ H.1 IN PROGRESS (3-PR split, §8.3):** **✅ H.1.a DONE (PR #363, 2026-06-08)** — re-enabled the connectivity-check (un-exported in #355) + de-staled the `TOFES_SALES_COLLECTION` config caveat; merged + deployed (Deploy-to-Production + Automated-Tests + Health-Check all success — the `defineSecret` landmine is confirmed disarmed). **Live Admin-console call returned `{ok:true, reachable:true, sawAtLeastOneDoc:true}`** → the cross-project wiring (Secret Manager → SA key → named app → tofes-mecher Firestore read) is PROVEN end-to-end against the deployed env; `sales_records` is LIVE-verified (has data); the v2 invoker IAM + runtime `secretAccessor` are confirmed working (no false-green — devils-advocate 🔴-2/🔴-5 both closed). Grader PASS, full suite 810/810. (One operational note: the first live call failed mid-deploy with a CORS/`internal` error — the invoker binding wasn't finalized yet; it succeeded immediately after the deploy completed, no manual invoker grant needed.) **✅ H.1.b DONE (PR #364, 2026-06-09)** — `validateSalesRecordExists`: admin-gated point-read of one `sales_records` doc; **field-minimized 9-field** return (allowlist projection, never `snap.data()`); `{exists:false}` + divergence warn; snapshot-never-re-derive (one transform Timestamp→ISO); Zod `.strict()` 20-char id; dual no-PII-in-logs guard; **non-PII access audit** per lookup (fail-secure — closes the IDOR-without-trace 🔴). DELETED the connectivity-check (REPURPOSE-OR-DELETE resolved). Grader PASS, 817/817. **Verified live in PROD** (`validateSalesRecordExists` deployed; `connectivity-check` removed). **🧠 Deploy lesson (NEW):** the merge hit 2 deploy aborts — a transient Google 503 on `firebaserules.googleapis.com` (re-run cleared it) + the **CF-deletion guard** (CI `firebase deploy` aborts rather than auto-delete a function removed from source → needs supervised `firebase functions:delete <name> --region us-central1` then re-run). **Any future PR that deletes a deployed CF must include this manual-delete step.** **✅ H.1.c DONE + DEPLOYED (PR #365, 2026-06-09)** — `exportSalesToBigQuery` (scheduled hourly v2, confirmed live): tofes-mecher `sales_records` → WRITE_TRUNCATE BigQuery mirror `law_office_analytics.sales_records`. Hardened (devils-advocate STOP → 3🔴 closed: all-or-nothing read, never-truncate-to-empty, reconciliation + run audit + dead-letter); raw_json OMITTED (19 typed cols, default-deny); `@google-cloud/bigquery` lazy-imported. Grader PASS, 836/836; deployed CLEAN first try. **✅ H.1.c VERIFIED-LIVE — 161 rows (2026-06-10):** the smoke exposed that the hourly export was FAILING every run (table empty) — root cause a tofes float-noise amount (`4249.6900000000005`) rejected by BigQuery NUMERIC(scale 9), aborting the whole load (maxBad=0). **Fixed in PR #367** (`numStrOrNull` → 2dp DECIMAL strings + `|v|≥1e15` magnitude guard; grader PASS_WITH_WARNINGS, hidden-failure-class lens = load-expected-to-succeed; 849/849). Merged+deployed (`f792edb`, Deploy-to-Production=success); Cloud Scheduler "Run now" → `SELECT COUNT(*)` = **161**. Pattern-D mirror is LIVE. (`jobUser` granted; the runtime SA's pre-existing `roles/editor` already covered `dataEditor`; principal-scoped `dataViewer` lock = optional hardening, owners read regardless.) **🧠 LESSON: a CF that deploys green can still fail at RUNTIME — live-smoke is the real verification for data-flow CFs, not deploy-green.**

**🏁🏁 H.1 CLOSED (3/3, 2026-06-09)** — the cross-project bridge to tofes-mecher is COMPLETE end-to-end: H.0 wiring proven live · H.1.a connectivity validated · H.1.b `validateSalesRecordExists` (Pattern A live read, field-minimized + audited) · H.1.c `exportSalesToBigQuery` (Pattern D hourly mirror, hardened). All merged + deployed to PROD.

**✅✅ H.2 DONE + DEPLOYED (PR #366, 2026-06-10).** Cost foundation shipped via **Option A** (§10 revision): the employee cost-per-hour is stamped for every NEW timesheet entry into a SEPARATE CF-only collection `timesheet_entry_costs/{entryId}` (NOT on the employee-readable entry doc — closes the §7.6 leak), written ATOMICALLY in the same transaction across all 3 create paths (`createQuickLogEntry`, `createTimesheetEntry_v2`, `addTimeToTaskWithTransaction`). `resolveEmployeeCost` never throws / never 0-by-default (null = "unknown"); static AST cost-stamping guard on every create path; 8-scenario deny suite + firestore.rules.test mirror; `backfill-cost-per-hour.js` (dry-run default + `--apply`, idempotent, `backfill_approx`, null-not-0, batched, gitignored email-bearing JSON backup). Reviews: outcomes-grader=**PASS_WITH_WARNINGS** (8/8 MUST, all G1-G7 PASS/NA, 0 blockers), security-access-expert + backend-firebase-expert=PASS, **devils-advocate=GO (5/5 attacks not-real)** — mandatory for the firestore.rules change. 847/847, tsc 0, ESLint 0. CI `Production CI/CD` for merge `7c52450`: **Deploy to Production=success, Automated Tests=success, Health Check=success** (overall reads "cancelled" only because the non-gating E2E job was cancelled — the documented pattern; deploy verified green per the 2026-06-04 lesson). **⏳ HISTORICAL BACKFILL = a SEPARATE supervised step (Haim's hands, non-blocking):** `node scripts/backfill-cost-per-hour.js` (dry-run) → review counts/plan JSON → `--apply`; new entries stamp automatically without it. **🔵 Carry to H.3:** the entry doc's `employee` field is stored raw `user.email` while the cost doc's `employee` is lowercased — H.3 MUST join on `entryId` (exact, per the design) or normalize both sides before any employee-string grouping.

**✅ H.3 — Profitability layer DONE (all 5 PRs merged + deployed, 2026-06-15 — see §8.5 for the closure). ⏭️ NEXT = H.4 — Task budgeting (§8.6).** H.3 delivered: Plan at intake (PR1) + the Forecast aggregate in the CF-only `client_profitability` collection + `getProfitability`/`recomputeProfitability` (PR3) + the dashboard bud `profitability.html` (PR4) + the nav tab (PR5); the partner-claim consumer was wired as the rule's `isAdmin() || isPartner()` gate (the FIRST production `isPartner()` consumer; the partner GRANT itself stays deferred per D-E). The supervised cost-population + backfill (to make the Forecast show real numbers) is non-blocking, Haim's hands. **✅ H.1.c retention/TTL follow-up DONE (PR #370, `chore/h-1-c-retention-ttl`, 2026-06-14):** BQ `sales_records` retention DECISION documented (derived + source-bounded, ≤1h staleness; dataset `max_time_travel_hours=48` to shrink the deleted-in-source PII tail; table default-expiration REJECTED — create-if-not-exists re-materializes it) + `tofes_export_deadletter` bounded by a Firestore TTL on a new `expireAt` field (90d; NOT `failedAt` — already-past → would purge immediately) + a no-PII payload AST lock + a brief triage runbook — all in `docs/PHASE_2_FOUNDATIONS.md` "Retention & TTL" (§10 row 2026-06-14). Console steps (TTL policy + time-travel) = Haim's hands (commands in the doc). H.8 carry-forward tracked there: hash `id_number` + drop name/phone/email so identifying PII never enters the time-travel tail. **The `SET_EMPLOYEE_COST` salary-redaction obligation remains OPEN** for the FUTURE H.8 `audit_log`→BQ export (NOT H.1.c — sales_records has no salary). **✅ H.1.c verified-live (2026-06-10):** the "Run now" smoke exposed a NUMERIC-scale load bug (a tofes float-noise amount) → fixed in PR #367 + deployed (`f792edb`); re-run → `SELECT COUNT(*)` = **161**. Pattern-D mirror is LIVE. (`jobUser` granted; the runtime SA's pre-existing `roles/editor` already covered `dataEditor`; the `dataViewer` principal-lock = optional hardening.)

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

### 8.2.5 Cross-Reference & Fee-Reconciliation Architecture — "DLR" (locked 2026-06-02)

**Status:** ✅ Architecture locked by Haim 2026-06-02 ("as long as it serves the project and doesn't change direction + stick to the MD protocol"). This is the GOVERNING design for HOW the tofes-mecher bridge (H.1) is consumed at client/service intake (feeds H.3 Plan + H.6 cutover). It does NOT change the locked direction (Pattern A+D, snapshot-never-re-derive, tofes-mecher = fee source-of-truth) — it specifies the *how*. Designed via data-investigator (as-is map) + devils-advocate (14 attacks on the naive "block-at-intake" design); architect pass folded into the constraints.

**Verified as-is reality this design must respect (data-investigator, 2026-06-02):**
- "Client" = "Case", doc keyed by 7-digit caseNumber; created via Admin Panel `case-creation-dialog.js` → CF `createClient` (`functions/clients/index.js:63`, write `:517`). Canonical writer: `functions/shared/client-writer.js`.
- **ת"ז is NOT captured at intake today**; phone/email only via `updateClient` (edit) → the join key does not yet exist on the law-office side.
- **No fee field exists.** Money = `fixedPrice` (inside `services[]`) + `ratePerHour` (default 800). **No VAT anywhere.** "Fee agreement" = a PDF, no number.
- A "service" = an element of the `services[]` array on the client doc; added via CF `addServiceToClient` (`functions/services/index.js:26`).
- Existing `_reconciledAt`/`_reconciledBy` on clients = HOURS reconciliation (different semantics — do NOT reuse the `_reconciled*` namespace).

**The principle (why it beats the naive design):**
> **Intake NEVER blocks on tofes-mecher. The link + fee-check happen asynchronously, beside intake — not as a synchronous gate.**
This one choice defuses most criticals: availability (a tofes outage can't stop client creation), VAT false-mismatches that would train users to dismiss the control, and the fee-spoofing death-spiral.

**Locked design constraints (each closes a devils-advocate critical):**
1. **Prerequisite — `idNumber` becomes a first-class, validated (ת"ז check-digit), immutable-after-link field on clients.** Without it there is nothing to join on. → new PR **Pre-H.1.0**.
2. **The link is explicit, human-confirmed, per-service, many-to-many.** Store a link record, not "the sale for this ת"ז": `feeReconciliation: { salesRecordId, agreedFeeSnapshot, feeFieldUsed, salesRecordUpdatedAt, snapshotAt, confirmedBy, state }` — on the SERVICE/link, NOT the client root, NOT bare `_reconciled*`.
3. **Reconciliation is a state machine:** `pending_match → matched | mismatch | overridden(reason,by,at) | no_sale(reason)`. `no_sale` (pro_bono/internal/retainer/pre_tofes_legacy) and `pending_match` are LEGITIMATE states, not errors.
4. **The signed sale is authoritative for the fee.** Agreed fee = the sale's snapshot, never the typed number (typed = cross-check only). **Override is partner-only** (`isPartner()` from D) + mandatory reason + audit-FIRST (`logCriticalAction`).
5. **VAT-explicit comparison:** canonical fee = **`amountBeforeVat`** (Decision D1) + small tolerance (₪1 rounding). Show all four amounts in the confirm UI; store `feeFieldUsed` so a future tofes schema change is detectable.
6. **Discover via the Pattern-D synced mirror; COMMIT via one live Pattern-A read** of the specific sale (mirror for availability, live read for an authoritative snapshot). Commit in a Firestore transaction; idempotency key = `salesRecordId + serviceId`; a sale links to ≤1 service unless explicitly `split_fee`.
7. **Drift job** re-checks each linked snapshot vs the live sale (cheap `salesRecordUpdatedAt` compare); divergence → `mismatch` + partner alert, never silent auto-update.
8. **PII discipline (PUBLIC repo):** AST guard on the new files — never pass `idNumber`/`amount*`/`clientName` to `logger.*` (errorCode only); reuse the H.0 no-secret-in-logs serialization test.
9. **Backfill (~200 legacy clients):** dry-run-by-default + `--apply`; auto-commit only exact single-sale + amount-matched + idNumber-present rows; everything else → partner manual queue; legacy with no sale → `no_sale: pre_tofes_legacy`.

**The 3 product-owner decisions (recommended defaults accepted 2026-06-02; re-confirmable at each PR checkpoint):**
- **D1 — which amount is "the fee"?** → **`amountBeforeVat`** (pre-VAT; VAT is a statutory pass-through, not firm revenue). _Haim to re-confirm net-vs-gross at the H.3 checkpoint._
- **D2 — on mismatch?** → **do NOT block intake**; flag for partner; override partner-only + audited.
- **D3 — signed sale mandatory?** → **No** — `no_sale` with a reason is allowed.

**Sequence impact:**
- **Pre-H.1.0 — `idNumber` on client intake** — split into two at the checkpoint (2026-06-02) after devils-advocate issued STOP on the full slice (dead admin-wizard surface; the live creator is the **User App**; the `SimpleClientDialog` unvalidated direct-write bypass; "required" incoherent vs `idType:'passport'`/`SYSTEM-INTERNAL`/legacy):
  - **Pre-H.1.0a (backend)** — ✅ **MERGED (#348, 2026-06-02).** `isValidIsraeliId()` (official ת"ז check-digit + zero-pad) in `functions/shared/validators.js`; `createClient` accepts/validates/stores an **OPTIONAL** `idNumber` (default `''`, NOT unique — client=case); `updateClient` rejects it (immutable-from-creation); 19 tests + a PII source-guard (value never logged/audited). Grader PASS, full suite 746/746, lint 0.
  - **Pre-H.1.0b (UI — User App)** — ✅ **MERGED (#353, 2026-06-03).** Added an **OPTIONAL** (NOT required) check-digit-validated ת"ז field to the LIVE wizard `case-creation-dialog.js` (validate-if-present in `validateCurrentStep` → `collectFormData` → `buildFirebaseData`); new shared `apps/user-app/js/modules/israeli-id.js` (exact mirror of backend `isValidIsraeliId`; `window.IsraeliId` for the classic-script dialog + ESM export); reconciled the orphaned frontend Zod (`schemas/index.ts` `/^\d{9}$/` → check-digit `.refine()` + corrected Hebrew message); 2 CI tests (cross-language drift-guard pinning `israeli-id.js` AND `ClientSchema` to the backend's 11 vectors; frontend PII source-guard). **Scope corrected "required" → OPTIONAL at the checkpoint:** 4-worker investigation + devils-advocate (STOP) + a live aggregate probe (≥2 of 139 clients are companies/nonprofits; only 1/139 has any `idNumber`) proved `required` would break corporate (ח.פ.)/foreign (passport) intake on a live commercial system and is incoherent without an `idType` model. Grader PASS_WITH_WARNINGS; vitest 398+2, tsc 0, lint 0; CI green. dist NOT rebuilt (orphaned schema; runtime validator is `israeli-id.js`).
  - **Pre-H.1.0c (UI — required + idType model)** — ⏭️ **DEFERRED (designed, not scheduled).** Enforcing ת"ז as **required** needs an `idType` selector (ת"ז / דרכון / ח.פ.) + backend `idType` support (which #348 deliberately omitted). Schedule only if/when the office confirms it wants a hard gate; until then OPTIONAL is the coherent, non-breaking state.
  - **Deferred (separate PRs, tracked):** `clients` read-access tightening (G7 — all-authenticated read today); `SimpleClientDialog` bypass (validate-or-retire); the ~127-doc backfill migration; the WhatsApp `idNumber` plaintext-echo + case-number overload; the `logger.js` Error-branch sanitize hardening; frontend `dist` hygiene. ✅ **RESOLVED:** the `validation-script.js` harness (#354, broken by #348) + the `pull-request.yml` PR-title shell-injection (#352).
- H.1 (§8.3) bridge: `validateSalesRecordExists` return shape = the VERIFIED schema (PHASE_2_FOUNDATIONS "✅ VERIFIED"), NOT the old `{fee, customer, signedPdfUrl}` guess; add the Pattern-D mirror as the discovery source.
- H.3 (§8.5) Plan: `expectedRevenue` = the linked sale's `amountBeforeVat` snapshot.
- H.6 (§8.8) cutover: becomes the human-confirm link/reconcile UI, governed by this state machine.

**The single biggest risk to never regress (devils-advocate):** a non-privileged user silently overriding the signed amount while the UI shows a green "matched" badge — institutionalizing the exact fee-drift the product is sold to prevent. Constraint #4 makes this impossible.

### 8.3 H.1 — Cross-project bridge to `tofes-mecher`

**Goal:** Pattern A live blocking + Pattern D analytical export. **Governed by §8.2.5 (DLR).**

**Decomposition (3 PRs, Haim-approved 2026-06-08):**
- **H.1.a — re-enable connectivity-check + validate live wiring** — ✅ **DONE (PR #363, 2026-06-08).** Re-enabled `tofesMecherConnectivityCheck` (un-exported in #355) + de-staled the `TOFES_SALES_COLLECTION` UNVERIFIED caveat. Merged + deployed (CI Deploy-to-Production + Automated-Tests + Health-Check all success — re-introducing `defineSecret` did NOT re-break the deploy; the secret landmine is disarmed). **Live Admin-console call returned `{ok:true, reachable:true, sawAtLeastOneDoc:true}`** → the cross-project wiring (Secret Manager → SA key → named app → tofes-mecher Firestore read) is PROVEN against the deployed env, and `sales_records` is LIVE-verified (has data). v2 invoker IAM + runtime `secretAccessor` confirmed working (no false-green; devils-advocate 🔴-2/🔴-5 both closed). Grader PASS; full suite 810/810. **REPURPOSE-OR-DELETE follow-up:** H.1.b deletes this export once `validateSalesRecordExists` proves the identical wiring.
- **H.1.b — Pattern A `validateSalesRecordExists`** — ✅ **DONE (PR #364, 2026-06-09).** Admin-gated v2 callable: point-read one `sales_records` doc by 20-char auto-id via the named app; returns a **field-minimized 9-field** snapshot (`clientName, idNumber, 4 amounts, transactionType, timestampIso`) — server-side allowlist projection, NEVER `snap.data()` (EXCLUDES address/phone/email/clientId); `{exists:false}` (not throw) + divergence warn; snapshot-never-re-derive (one transform: Timestamp→ISO); role-only gate; Zod `.strict()` `/^[A-Za-z0-9]{20}$/`; dual static+runtime no-PII-in-logs guard; **non-PII access audit** on every lookup (uid+salesRecordId+found, fail-secure — closes the IDOR-without-trace 🔴). **DELETED `tofesMecherConnectivityCheck`** (REPURPOSE-OR-DELETE resolved) + migrated its coverage. Grader PASS, suite 817/817. Checkpoint-locked: minimal 9-field + non-PII audit. **Verified live in PROD:** `validateSalesRecordExists` deployed (v2 callable), `connectivity-check` removed. **🧠 Deploy lesson:** the merge hit 2 deploy aborts — (1) a transient Google 503 on `firebaserules.googleapis.com` (re-run cleared it); (2) the CF-deletion guard — `firebase deploy` in CI (non-interactive) ABORTS rather than auto-delete a function removed from source. Fix = supervised manual `firebase functions:delete tofesMecherConnectivityCheck --region us-central1` (Haim's hands), then re-run. **Any future PR that DELETES a deployed CF must include this manual-delete step in its checklist** (same class as the 2026-06-04 incident).
- **H.1.c — Pattern D BigQuery export** — ✅ **DONE + DEPLOYED (PR #365, 2026-06-09).** Scheduled hourly v2 CF `exportSalesToBigQuery` (confirmed live, v2 scheduled): reads tofes-mecher `sales_records` (cross-project) → **WRITE_TRUNCATE** full-reload of the BigQuery mirror `law_office_analytics.sales_records` (MAIN, ADC). **Hardened (devils-advocate STOP → 3🔴 closed):** all-or-nothing read (a partial read never replaces the good mirror), never-truncate-to-empty guard, reconciliation counts (rowsRead/Mapped/Failed) + a durable `TOFES_BQ_EXPORT` run audit (sys actor, non-PII) on success AND failure + THROW-on-hard-failure (Cloud Scheduler metric), non-PII dead-letter (`tofes_export_deadletter`, CF-only rules block). **raw_json OMITTED** (checkpoint, default-deny → 19 typed columns). snapshot-never-re-derive (transforms: Timestamp→ISO, string→INT64 empty→null). `@google-cloud/bigquery` lazy-imported. Grader PASS, 836/836. **✅ VERIFIED-LIVE — 161 rows (2026-06-10).** The first hourly runs all FAILED (table empty): a tofes float-noise amount (`4249.6900000000005`) exceeded BigQuery NUMERIC scale-9 and aborted the whole load (maxBadRecords=0). **Fixed in PR #367** (`numStrOrNull` → 2dp DECIMAL strings + a `|v|≥1e15` magnitude guard; outcomes-grader PASS_WITH_WARNINGS + a hidden-failure-class lens = load-expected-to-succeed; 849/849; merge `f792edb`, Deploy-to-Production=success). `jobUser` granted; the runtime SA's pre-existing `roles/editor` already covered `dataEditor`. Smoke: Cloud Scheduler "Run now" → `SELECT COUNT(*)` = **161**. **🧠 LESSON (must enter the protocol): a CF that deploys green can still fail at RUNTIME — live-smoke (not deploy-green) is the real verification for a data-flow CF; H.1.c was marked "DONE+DEPLOYED" on deploy-green but was silently failing every hourly run for ~1 day until the smoke.** **🧠 Deploy note:** the original #365 merge deployed CLEAN on the first try (no 503, no CF-delete — it ADDS a function).

**Sub-tasks:**
- **Pattern A — live blocking CF**:
  - New CF `validateSalesRecordExists(salesRecordId)` — admin-gated, queries tofes-mecher Firestore via service account, returns the VERIFIED `sales_records` shape (see PHASE_2_FOUNDATIONS "✅ VERIFIED": `idNumber`, `clientName`, `amountBeforeVat`/`vatAmount`/`amountWithVat`/`amount`, `transactionType`, `timestamp`, …) — NOT the old `{fee, customer, signedPdfUrl}` guess. (Note: `sales_records` has NO signed-PDF-URL field — the signed PDF lives elsewhere; H.5 must source it separately.)
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

> **✅✅ DONE + DEPLOYED (PR #366, 2026-06-10).** Shipped via **Option A** (§10 revision 2026-06-10): the cost is stamped into a SEPARATE CF-only `timesheet_entry_costs/{entryId}` collection — **NOT** a `costPerHourAtEntry` field on the entry doc — because `timesheet_entries` is employee-readable and a flat field would leak the employee's own cost rate (§7.6). **The "stamp `costPerHourAtEntry` on the entry" wording in the Goal + Sub-tasks below is SUPERSEDED by Option A** (same snapshot semantics — immutable, per-entry, keyed by entryId — but written OFF the entry, atomic in the same txn across all 3 create paths). outcomes-grader=PASS_WITH_WARNINGS (8/8 MUST), devils-advocate=GO; 847/847; CI deploy verified green (Deploy/Tests/Health=success). Historical backfill = a separate supervised step (Haim's hands). Full closure note in §8.2.

**Goal:** Every timesheet entry stamps the cost-per-hour at write time. Backfill historical entries with current cost (one-time, documented).

**Sub-tasks:**
- Modify `createQuickLogEntry` + `createTimesheetEntry_v2` to read `employee_costs` (via getEmployeeCost from G) and stamp `costPerHourAtEntry` on the entry
- Migration script: `functions/scripts/backfill-cost-per-hour.js` — dry-run default, `--apply` flag, stamps current cost on all historical entries with logging
- Update timesheet trigger to handle the new field
- Tests + documentation

**Dependencies:** G (employee_costs schema must exist first).
**Estimated size:** MEDIUM.

### 8.5 H.3 — Profitability layer

> **🟢 INVESTIGATED + CHECKPOINT-APPROVED (2026-06-10).** 5-lens read-only investigation (backend/data/frontend/security/completeness) + Haim checkpoint. **The locked decisions below SUPERSEDE the original sub-tasks where they conflict.** devils-advocate is MANDATORY before PR3 lands (firestore.rules change + first production `isPartner()`).
>
> **Verified as-is:** GREENFIELD — a live probe of all 142 client docs found **0** with a `plan` field and **0** with `forecast`. **🔴 The load-bearing constraint:** `clients` is world-readable (`firestore.rules:147` `allow read: if isAuthenticated()`, read client-side by the User App) — so the cost/profit aggregate must NEVER sit on the client doc (single-employee case: `actualCost÷actualHours` = that employee's exact confidential rate, a §7.6 leak). **Cost coverage ≈ 0 today:** `employee_costs` = 0 docs, no UI to enter it, the H.2 backfill un-run → `actualCost` is system-wide `null` until PR2 lands.
>
> **Locked decisions (Haim-approved checkpoint):**
> - **D-A (storage):** the Forecast cost/profit aggregate lives in a **NEW CF-only collection** (e.g. `client_profitability/{caseNumber}`) with **`allow read: if isAdmin() || isPartner()`** (write: CF-only) — the gate enables real-time `onSnapshot` WITHOUT leaking to employees (a fully-locked `if false` collection can't be listened to). **NEVER** put `actualCost`/profit on the `clients` doc. Plan (non-cost) MAY live on the client doc.
> - **D-B (expectedRevenue, pre-H.6):** derive from EXISTING fee fields — fixed→`fixedPrice`, legal-hourly→`ratePerHour`×expectedHours; the ~90 plain `hours` services with no rate → `expectedRevenue=null` + an explicit **`pricing_missing`** flag (**NEVER 0, NEVER a silent 800**). Leave a seam to swap in the tofes `amountBeforeVat` snapshot at H.6 (§8.2.5 **D1 amountBeforeVat re-confirmed**).
> - **D-C (paidRevenue):** has **NO live source** (`totalPaid` init-only, no invoices/payments collection) → **DEFERRED to H.6**. `projectedProfit` must NOT be computed against a revenue≈0.
> - **D-D (mechanism):** `actualCost` via a **DEDICATED aggregation job** (the `dailyInvariantCheck` per-client-query shape), **NOT** the timesheet trigger (its CREATE branch is skipped when `deductedInTransaction===true` — every create path → would miss most costs). Compute `actualCost = Σ(live entry.minutes/60 × snapshot costPerHour)` **joined by `entryId`** (NOT the mixed-case employee string), excluding `null`-cost entries and emitting an explicit **un-costed-coverage %** (the cost doc is write-once → never read a stored cost×hours product).
> - **D-E (gate):** wire the rule+callable as **`isAdmin() || isPartner()`** (the first production `isPartner()` consumer Pre-H.0.0.D deferred here — dormant + fail-secure, resolves admin-only today since no employee is role=partner); keep the **UI admin-only**; do **NOT** grant a partner claim or touch the frontend role model in H.3 (a separate auth PR). Whether a future partner sees raw `actualCost` = a deferred §7.6 question.
>
> **Approved decomposition (5 PRs):** **PR1 — Plan** (backend, additive, through a CENTRALIZED write path so `createClient`'s direct `.create()` and `addServiceToClient`'s canonical writer don't drift; the independent first bud — no cost/rules/partner surface → no devils-advocate) **✅ DONE (#368, deployed 2026-06-11; warning-#1 follow-up = #369)** · **PR2 — Cost-entry admin UI** **✅ DONE (#371, 2026-06-11)** (admin-only `employee-costs.html`; the H.2 backfill `--apply` is a SEPARATE supervised step, run after costs are entered) · **PR3 — Forecast** (CF-only collection + rules + aggregation job + `getProfitability` callable; **devils-advocate + rules.test drift-guard + deny-tests MANDATORY**) **✅ DONE (#373, deployed 2026-06-15)** · **PR4 — Dashboard UI** (`profitability.html` from design-system tokens, admin-only gate, `onSnapshot`) **✅ DONE (#374, 2026-06-15)** · **PR5 — `רווחיות` nav tab** (tiny) **✅ DONE (#375, 2026-06-15)**. **🏁 ALL 5 PRs MERGED — H.3 CLOSED. Hard dependency:** a *reliable* Forecast needs `employee_costs` populated (accountant) + the backfill — PR1/Plan does not.
>
> **✅ PR1 (Plan) DONE — merged #368 (`4462edf`) + deployed (Deploy/Tests/Health = success), 2026-06-11.** `client.plan = {expectedHours, expectedRevenue, pricingComplete, pricingMissingCount, serviceCount, schemaVersion}` is now stamped on every client write (both intake routes, drift-free, RESTRICTED_KEYS-protected); cost/profit kept OFF the world-readable doc (§7.6 → PR3). grader=PASS_WITH_WARNINGS (3-lens: outcomes + backend-SSOT + confidentiality). **Follow-up PR #369 (`fix/pr-h-3-1-intake-rate`, OPEN — awaiting Haim merge)** reconciles the grader's warning #1: removes the legacy `ratePerHour || 800` silent default in `createClient` so a legal-hourly Plan revenue is never built on a fabricated rate, and makes both intake routes consistent (no explicit rate → `pricing_missing`, never `800×hours`).
>
> **✅ PR2 (Cost-entry UI) DONE — merged #371 (`39b7c1f`), 2026-06-11.** New admin-only `employee-costs.html` (mirrors `settings.html`; `ModalManager` set-cost form; explicit **fail-closed** `claims.role==='admin'` render-gate; `getEmployeeCost` pre-fill, `not-found`=empty "טרם הוגדרה עלות" state; `costPerHour` 1..20000 + `source` enum + fixed ILS; 🔴 cost value NEVER reaches client console/storage/URL/toast, cleared on every modal close; PII source-guard **5/5**; ESLint 0; additive **+1467/-0**, frontend-only → no devils-advocate). grader=PASS_WITH_WARNINGS (⚠️ the 3-lens workflow glitched on StructuredOutput → the verdict was **first-hand-verified** by the synthesizer + Lead-Agent review + the PII guard; the M2 fail-closed gate + M3 no-leak crux verified ×3). Built via a frontend agent + Lead-Agent review. **🅿️ verify the #371 (`39b7c1f`) deploy jobs green post-compact** (frontend/Netlify; Automated-Tests=success confirmed, Deploy-to-Production was mid-run at compact-time). **Merged alongside: #370 (`711eb7e`) — H.1.c dead-letter TTL + BQ-retention** (the deferred `tofes_export_deadletter` retention follow-up: `DEADLETTER_RETENTION_DAYS=90` + an `expireAt` TTL field).
>
> **🅿️ HISTORICAL BACKFILL — supervised (Haim's hands, non-blocking):** PR2 now lets you populate `employee_costs`. After ≥1 real cost is entered via the new page, run `node scripts/backfill-cost-per-hour.js` (dry-run) → review → `--apply` to stamp historical timesheet entries → unblocks a *reliable* Forecast (PR3). New cost entries already work without it.
>
> **✅ PR3 (Forecast) DONE — merged #373 (`8605f0c`) + deployed (Deploy-to-Production / Health-Check / Automated-Tests = success), 2026-06-15.** CF-only `client_profitability/{caseNumber}` collection (rule `allow read: if isAdmin() \|\| isPartner()` — the FIRST production `isPartner()` consumer, dormant/fail-secure; write CF-only, mirrored in `firestore.rules.test`) + a dedicated v2 `onSchedule` aggregation job (`aggregateClientProfitability`, daily 06:30 staggered, per-client isolated, `actualCost = Σ(entry.minutes/60 × snapshot costPerHour)` joined by **`entryId`**, **`null`≠0**, un-costed-coverage %, archived-parity with Plan, idempotent SET, run-audit + throw-on-systemic-failure-rate) + `getProfitability` (admin\|\|partner AUDITED read, `{exists:false}` on missing) + `recomputeProfitability` (admin\|\|partner audit-first on-demand). H.6 seams: `paidRevenue`/`projectedProfit` explicit `null`; `schemaVersion:1`. **devils-advocate DONE** (4 adversarial lenses; rules-leak=**GO** — byte-identical mirror + 9-scenario deny/allow suite; 1 🔴 rollback FIXED; partial-failure/scale/race yellows fixed-or-documented; the rules drift-guard **EXTENDED** to the `client_profitability` match block). **outcomes-grader=PASS** (6/6 MUST, 7/7 gates, 3/3 SHOULD, 0 warnings). CI added the rules-emulator deny-suite to the deploy gate. **🅿️ supervised live-smoke pending (Haim's hands):** Cloud Scheduler "Run now" on `aggregateClientProfitability` → confirm docs appear with the `actualCost:null`+coverage shape + the `PROFITABILITY_AGGREGATE` run-audit `clientsFailed=0` (the H.1.c lesson). **🔴 G2 rollback is NOT a pure `git revert`** — supervised `firebase functions:delete aggregateClientProfitability recomputeProfitability getProfitability --region us-central1` FIRST (deletes the 3 CFs + the Cloud Scheduler job), THEN `git revert` (the H.1.b CF-deletion incident).
>
> **✅ PR4 (Dashboard UI) DONE — merged #374 (`350955b`), 2026-06-15.** NEW admin-only `apps/admin-panel/profitability.html` — the FIRST major visible bud. ONE live `onSnapshot` on `client_profitability` + an in-memory JOIN to `client.plan` (a `clients.get()` with the internal-client filter — no 2nd listener, no plan snapshot). Fail-closed `role==='admin'` render-gate (stricter than the admin\|\|partner rule, D-E) + `teardown()` on logout; sortable table + search + status filter; per-row `recompute` (`recomputeProfitability`) + a per-case detail DRAWER (`getProfitability`, the audited fetch). 🔴 cost/profit value NEVER reaches client console/storage/URL/toast (widened PII source-guard over the page + the format module). Pure render rules (null≠0 → "עלות לא זמינה" NEVER ₪0, coverage badge, hours-vs-Plan color) extracted to `profitability-format.js` + **18 unit tests**; color on HOURS-vs-Plan ONLY (actualCost system-wide null today → no profit alert, X% deferred); profit HIDDEN ("בהמשך H.6"); honest-empty primary view. Frontend-only (**+1934/-0**) → **NO devils-advocate**. outcomes-grader=**PASS** (6/6 MUST, 7/7 gates, 3/3 SHOULD, 0 blockers); root vitest 442 green; ESLint 0. **🅿️ supervised live-smoke (Haim's hands):** open `profitability.html` (direct URL) → honest-empty grid → "חשב מחדש" → row repaints. **🅿️ verify the #374 (`350955b`) Netlify deploy green.**
>
> **✅ PR5 (`רווחיות` nav tab) DONE — merged #375 (`aaee4ac`), 2026-06-15.** One additive `navItems` entry in `Navigation.js` (`{ id:'profitability', label:'רווחיות', icon:'fa-money-bill-trend-up', href:'profitability.html' }`, after `workload`); active-state auto-works (the page calls `Navigation.init('profitability')`). Additive-only (no existing tab/behavior touched) + a static-scan guard (tab exists + href + id-matches-init + the 4 existing tabs intact). Frontend-only → no devils-advocate. outcomes-grader=**PASS**; root vitest 445 green; ESLint 0 (the 4 warnings are pre-existing untouched lines).
>
> **🏁🏁 H.3 — PROFITABILITY LAYER CLOSED (all 5 PRs, 2026-06-15).** End-to-end in DEV: **Plan** (PR1, on every client write) + **Cost-entry UI** (PR2) + **Forecast** (PR3 — CF-only `client_profitability` + the aggregation job + `getProfitability`/`recomputeProfitability`, the FIRST production `isPartner()` consumer) + **Dashboard** (PR4 — `profitability.html`, the first major visible bud) + **Nav tab** (PR5). Every PR ran the full Feature Protocol (multi-lens investigation → checkpoint → code → grader=PASS → PR), with a mandatory devils-advocate on PR3 (the rules change). All merged + deployed.
>
> **🅿️ REMAINING (supervised, Haim's hands, NON-blocking) — to make the Forecast show REAL numbers:** (1) verify the #374/#375 Netlify deploys green; (2) enter ≥1 real cost in the `employee-costs` page (PR2); (3) `node scripts/backfill-cost-per-hour.js` dry-run → `--apply` (stamps historical entries); (4) Cloud Scheduler "Run now" on `aggregateClientProfitability` (or the dashboard "חשב מחדש") → `client_profitability` populates → the dashboard's "עלות לא זמינה" becomes real ₪ cost + coverage. Until then the dashboard is correctly **honest-empty**.
>
> **⏭️ NEXT ROCK = H.4 — Task budgeting (§8.6).** A NEW phase (partner-approval rules + auto-approve <3h). Depends on D (the `isPartner()` helper — built) + H.3 (done). Needs its own Intent + checkpoint. Per §3.8.4 high-stakes auto-defense, the partner-approval write paths may warrant devils-advocate. Awaits Haim's go.

**Goal:** Real-time per-case "Plan" + "Forecast" with dashboard.

**Sub-tasks:**
- **Plan calculation**: at client + service creation, compute and store `plan.expectedHours`, `plan.expectedCost`, `plan.expectedRevenue`, `plan.expectedProfit`. Locked at intake.
- **Forecast calculation**: aggregate trigger on timesheet entries → recompute `forecast.actualHours`, `forecast.actualCost` (= Σ over entries of `cost × hours`, where the cost is read from `timesheet_entry_costs/{entryId}` via the Admin SDK — **NOT** a field on the entry; Option A, §10 2026-06-10), `forecast.paidRevenue` (from invoices), `forecast.projectedProfit`
- **Dashboard UI**: new admin panel page `profitability.html` with sortable table, color-coded alerts when forecast drops below plan by X%
- **Real-time updates**: dashboard uses Firestore live listeners on client aggregates
- Includes BOTH hourly and fixed-price clients (per Haim 2026-05-27: "אני רוצה שכבר מהרגע הראשון שתיק לקוח נפתח במערכת אז יהיה חישוב אוטומטי")

> **🔵 H.2 carry-notes (read before coding H.3):** (1) **Join on `entryId`** — the cost doc key == the timesheet entry id (exact). Do NOT join/group on the `employee` STRING: the entry stores raw `user.email` while `timesheet_entry_costs.employee` is lowercased (a mixed-case email would mismatch). (2) **`costPerHour` may be `null`** ("unknown" — no `employee_costs` doc, or a resolve error; `costSource ∈ {employee_costs, no_cost_doc, resolve_error, backfill_approx}`). NEVER treat `null` as `0` in the Σ — exclude un-costed entries and surface an "un-costed coverage" signal instead (a `0` would silently understate actualCost). (3) Backfilled stamps are marked `costSource:'backfill_approx'` (current-cost-on-historical approximation) — distinguishable from at-write snapshots. (4) The partner-claim **GRANT** is done HERE (D+F built the read+write infra; the dashboard gates on `isAdmin() || isPartner()`).

**Dependencies:** H.2.
**Estimated size:** LARGE.

### 8.6 H.4 — Task budgeting

> **🔄 REVISED 2026-06-15 (Haim, Product Owner) — "Model A: smart budget meter". The original "hybrid partner-APPROVAL gate" spec is SUPERSEDED + struck below.** Haim rejected approval-for-everything as operational friction ("it would paralyze the office"). New model: budget enforcement via VISIBILITY + WARNING, NOT a gate. (§14 plan revision.)
>
> **🟢 INVESTIGATED + CHECKPOINT-APPROVED (2026-06-15).** 5-lens read-only investigation (existing-approval-system / backend / overrun-UI / notifications / completeness) + Haim checkpoint. **Headline: Model A is ~90% ALREADY BUILT, and the original approval-gate was NEVER implemented (a dead/broken scaffold).**
>
> **Verified as-is:** (1) Budget is set upfront at task creation = `estimatedMinutes`/`estimatedHours` on `budget_tasks` — `createBudgetTask` hardcodes `status:'פעיל'` (NO gate, auto-active) + writes an `auto_approved` record; the §8.6 "require partner approval if assignedBy/budgetHours>=3" logic does NOT exist anywhere. (2) The overrun signal IS computed (`addTimeToTask_v2.js` → percentOfBudget/isOverBudget) + the User-App card already renders the warning (orange 85% / red 100% + "חריגת תקציב X%" badge + "עדכן תקציב"). (3) A daily `dailyBudgetWarnings` job already warns the WORKER at 80%/100%; (4) `completeTask` writes `task_completion_alerts` at gap≥50%. (5) **DEAD/BROKEN:** the `approveTaskBudget`/`rejectTaskBudget` CFs the frontend calls DO NOT EXIST (clicking approve/reject throws — latent G1); the "אישורי משימות" panel is a read-only auto-approved feed; the approval-system code is DUPLICATED in both apps. **NO new collection/rules/claim needed** — `budget_tasks` is already admin-readable (firestore.rules owner-or-admin).
>
> **Locked decisions (Haim-approved checkpoint 2026-06-15):**
> - **Model A flow:** budget upfront (exists, REQUIRED) → no gate → visual warning (worker card, exists) → overruns VISIBLE to admins (NEW) → optional silent partner notification (DEFERRED).
> - **Admin visibility (YES):** REPURPOSE the live "אישורי משימות" nav button + badge + side panel into a **"חריגות תקציב"** feed showing over-budget ACTIVE tasks (read from the admin-readable `budget_tasks`, compute overrun via a canonical helper). Closes the real gap (today only the worker sees task overruns).
> - **Notification (DEFER):** the feed + the H.3 dashboard + the existing worker warning suffice in a 10-user/2-partner office (the 2 partners ARE the admins). A daily-digest extension of `dailyBudgetWarnings` is the light follow-up if later wanted (NOT a per-event push — taxes the hot write path).
> - **Cleanup (default):** RETIRE the dead/broken approve/reject path in BOTH apps (the latent G1 error) + the orphaned `createApprovalRequest`.
> - **Canonical thresholds:** 85% (approaching) / 100% (over) — unify the frontend surfaces (card + feed + the new toast) to ONE helper mirroring H.3's `hoursStatus`. (The backend `dailyBudgetWarnings` 80% stays for v1 — a tracked minor inconsistency, kept to keep H.4 frontend-only.)
> - **No devils-advocate** — Model A adds no new gating write path, no firestore.rules/claims/auth change (confirmed §3.8.4). The partner notion is dormant (admins-only); the §8.6 "D (isPartner) dependency" is moot under Model A.
>
> **Approved decomposition (2 small PRs, both frontend, no devils-advocate):** **PR-a — Admin "חריגות תקציב" feed + dead-gate cleanup (admin):** repurpose the nav button/badge/side-panel to show over-budget active tasks; remove the broken approve/reject buttons + dead service methods (admin app); a canonical overrun helper + unit tests. (G6: the nav label changes.) · **PR-b — Worker polish + dead-gate cleanup (user app):** a moment-of-overrun toast on time-entry crossing (once per crossing, like the daily-meter guard); align the user-app threshold to the canonical 85/100; remove the dead user-app approval service. · **DEFERRED:** the partner notification (daily-digest), the backend threshold unification, and an H.3 dashboard task-overrun tile (would need a `budget_tasks`→dashboard aggregation — out of the light scope).
>
> **✅ PR-a (admin feed + dead-gate cleanup) DONE — merged #376 (`de0edf0`), 2026-06-15.** Repurposed the dormant "אישורי משימות" nav button/badge/side-panel into a live **"חריגות תקציב"** feed (`budget_tasks` `onSnapshot`, `status=='פעיל'`, client-filtered to over/approaching via the NEW canonical helper `apps/admin-panel/js/core/budget-status.js` — `budgetStatus(actual,est)`→`{level,label,percent,isOver}` at 85/100, 21 unit tests); the badge now counts over-budget active tasks; the broken approve/reject buttons + the dead `approveRequest`/`rejectRequest`/`createApprovalRequest` service methods were removed (latent G1) and `TaskApprovalDialog` reduced to an inert stub. Frontend-only → no devils-advocate. outcomes-grader=PASS (6/6 MUST, 7/7 gates, 97/97 admin tests, 0 lint).
>
> **✅ PR-b (worker toast + dead-gate cleanup + doc sweep) DONE — merged #377 (`49c665a`, merge `6d816f4`), 2026-06-15.** NEW pure helper `apps/user-app/js/modules/budget-crossing.js` (`detectBudgetCrossing(before,after,est)`→`'over'/'approaching'/null` at the canonical 85/100, dual-export ESM+window, mirrors PR-a's `budget-status.js`, **pinned by a drift-guard test**); a moment-of-overrun **toast** in `submitTimeEntry` (consumes the addTimeToTask txn's authoritative `newActualMinutes` as the AFTER, derives BEFORE = after − this entry → **stateless once-per-crossing**, no per-task flag; wrapped so a toast failure never breaks the save), with Hebrew `tasks.warning.*` messages reusing the canonical labels; aligned the one disagreeing per-task threshold (`budget-tasks.js` `levelForPercent` 80→85 — the card's row-bar amber now matches the toast); **deleted the dead `apps/user-app/components/task-approval-system/` folder** (9 files, zero live wiring; `notification-bell.js` untouched). 5-lens investigation; 127 new tests (23 behavior + 104 drift-guard), 243/243 user-app suite, 0 lint errors. Frontend-only → no devils-advocate. **Doc sweep:** `SYSTEM_MAP.md` staleness+correction banner, `.claude/NOTIFICATION-SYSTEM.md` corrected, `apps/admin-panel/components/README.md` deprecation banner. **G6 (behavioral change, declared):** a NEW worker toast surface + the 80→85 row-bar shift; no data/CF/rule/route contract changed. **🏁 PR-b closes H.4.** (Backend `dailyBudgetWarnings` 80% intentionally left for v1 — tracked drift, keeps H.4 frontend-only.)
>
> **🅿️ Haim action before retiring the panel:** check PROD `pending_task_approvals` for any doc in status `pending` (vs `auto_approved`) — if any exist they'd be stranded (migration note). **🅿️ Stale docs to fix in-PR:** `SYSTEM_MAP.md` (lists approveTaskBudget/rejectTaskBudget as live), `.claude/NOTIFICATION-SYSTEM.md` (points at a non-existent functions/index.js:5760).

**Goal (SUPERSEDED — see the Model-A revision above):** ~~Hybrid approval rules + budget enforcement.~~

**Sub-tasks (SUPERSEDED):**
- ~~Modify `createBudgetTask` to require partner approval if `assignedBy === partner` OR (`assignedBy === employee_self` AND `budgetHours >= 3`)~~
- ~~New approval workflow: pending tasks list for partner, approve/reject with reason~~
- ~~Partner notification via existing WhatsApp + Admin Panel inbox~~
- ~~UI updates: task creation modal asks budget upfront; warning displayed when overrun is imminent~~ (the budget field + warning ALREADY exist — Model A leverages them)
- ~~Tests for all 4 paths~~

**Dependencies:** H.3 (done). (D/isPartner moot under Model A — no partner-gate.)
**Estimated size:** LIGHT-MEDIUM (mostly cleanup + repurpose of existing infra, not a build).

### 8.7 H.5 — PDF signature pipeline

> **✅✅ DONE + MERGED ([PR #378](https://github.com/Chaim2045/law-office-system/pull/378), commit `6b961f1`, 2026-06-16). Shipped as PLUMBING — no live consumer until H.6.** `functions/src-ts/signatures/verify-signature-presence.ts` (+ the shared lazy SDK wrapper `anthropic-client.ts`, wired at `functions/index.js`): admin-gated v2 `onCall` (`maxInstances:3`), Zod `.strict()` input, `defineSecret(ANTHROPIC_API_KEY)`, **audit-FIRST via `logCriticalAction` BEFORE the PDF is downloaded/egressed** (fail-secure), confused-deputy path-pin to `${collection}/${clientId}/agreements/`, dual static+runtime no-PII-in-logs guard; the verdict is **returned to the caller and NEVER persisted**. Model `claude-opus-4-8` via `@anthropic-ai/sdk` structured outputs (`output_config.format` + `response.parsed_output`, with a `JSON.parse(text)` fallback — **verified correct/current** against the canonical claude-api reference 2026-06-21). 18 ts-jest tests (SDK boundary mocked, synthetic-PDF buffer); devils-advocate=GO-WITH-CHANGES (folded). Rubric `.claude/rubrics/pr-h-5-verify-signature-presence.md`.
>
> **⚠️ The "Sub-tasks" below are SUPERSEDED by the shipped reality on two points:** (1) **the input is NOT `pdfStorageUrl`** — it is `{ clientId, agreementId, collection?: 'clients'|'cases' }`; the CF resolves the trusted `feeAgreements[].storagePath` server-side. The signed PDF lives in the law-office `feeAgreements[]` array on `clients`/`cases`, **NOT** on the tofes `sales_record` (which has no PDF field — confirmed). (2) **Real PII egress is GATED ON H.6** — a DPA / sub-processor basis under חוק הגנת הפרטיות is a HARD H.6 prerequisite (`docs/PHASE_2_FOUNDATIONS.md`) before any real client PDF is sent to Anthropic. The original Goal/Sub-tasks are retained for reference.

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

> **🟡 IN PROGRESS — H.6.a DONE; the remaining cutover increments carry the open decisions below.** **✅ H.6.a MERGED ([PR #381](https://github.com/Chaim2045/law-office-system/pull/381), commit `251e459`, 2026-06-17)** — `createClientFromSalesRecord(salesRecordId)`: the deterministic create from a tofes-mecher sale (**Option A — does NOT yet gate on the H.5 signature check; that gate is a LATER H.6 increment, and no PDF/AI egress happens in H.6.a**). Also landed and not previously recorded here: **PR-SEC-2 ([#380](https://github.com/Chaim2045/law-office-system/pull/380), commit `4f4dfa1`)** cut fee-agreement PDFs over to signed URLs + an ACL-revocation migration — so the signed PDF is admin-protected (the `verifySignaturePresence` premise holds).
>
> **✅ H.6.b — Pending Client Creation UI DONE (3-PR slice, merged to DEV 2026-07-02).** The admin-facing cutover UI is now live in `main`: **PR1 = `listUnlinkedSalesRecords` CF** ([#417](https://github.com/Chaim2045/law-office-system/pull/417) — lists tofes `sales_records` with no matching law-office client, cross-referencing the CF-only `sales_record_links`) · **PR2 = the `pending-clients.html` admin page** ([#418](https://github.com/Chaim2045/law-office-system/pull/418), `26db84a` — admin fail-closed render-gate; calls `listUnlinkedSalesRecords` + `createClientFromSalesRecord`; `ModalHelpers.confirm` naming client+amount BEFORE create; idempotent `{created:false}` → Hebrew info-not-error + refresh; escape-at-sink for ALL tofes data incl. the modal message path; pure `pending-clients-format.js` + 12 unit tests; grader FAIL→fixed→**PASS** — closed 48 ESLint errors + a ModalHelpers XSS round-trip + added the test) · **PR3 = the `לקוחות ממתינים` nav entry** ([#420](https://github.com/Chaim2045/law-office-system/pull/420), `c14baff` — one additive `navItems` entry + static-scan guard; grader PASS). ⚠️ **This slice does NOT wire the H.5 signature gate** — it approve-and-creates via `createClientFromSalesRecord` (Option A, H.6.a), the same deterministic path, exposed through a UI. The signature-gate increment (H.6.c) is still separate. **🅿️ Haim's hands:** verify the #418/#420 Netlify DEV deploys green + smoke `pending-clients.html` (the tab appears between "ניהול לקוחות" and "ניתוח עומס"). **🧠 Process note:** #419 (the original PR3) was stacked on the PR2 branch and merged INTO it instead of `main` — the nav had to be re-landed via #420 straight off `main`; lesson = a stacked PR's base must be retargeted to `main` after its parent merges.
>
> **✅ DPA / PII-egress gate RESOLVED (2026-07-01)** — supersedes the 🔴 blocker in item 1 below: the Anthropic DPA is auto-incorporated via the Commercial Terms of Service (7-day API retention, no training on API data); a fee-agreement client-consent clause was drafted + approved by Haim. So the remaining H.6 signature-gate increment (H.6.c) is **no longer blocked on legal** — only on engineering (identifier wiring + cost cap + never-persist-`reasoning`, items 2-4 below).
>
> **✅ H.6.c — Signature-gate wiring DONE (all 5 increments merged, 2026-07-16).** לאחר שסגר ה-DPA נפתר (2026-07-01), H.6.c חיברה את בדיקת החתימה של H.5 ליצירת הלקוח. הארכיטקטורה ננעלה (חיים, 2026-07-02): **Option B — two-phase `pending_signature`** (create → verify → release), שנבחרה על פני Option A (clean staging) לאחר ניתוח-עיצוב + devils-advocate. פורקה ל-5 תוספות, **כל אחת עם Intent/checkpoint משלה** — verified against the real merge diffs (re-verified per this PR, not trusted from the old banner text):
>
> - **c-1 ✅ MERGED** ([#422](https://github.com/Chaim2045/law-office-system/pull/422), `20ae775`, 2026-07-02) — `createClientFromSalesRecord` יוצר כעת לקוח במצב `status:'pending_signature'` (שלב 1 בלבד — ללא בדיקת חתימה חיה, ללא כתיבת `sales_record_links`). grader=PASS_WITH_WARNINGS, devils-advocate=GO.
> - **c-2-backend ✅ MERGED** ([#424](https://github.com/Chaim2045/law-office-system/pull/424), `6aa680b`, 2026-07-05) — **מאומת ישירות מה-diff**: `aggregateClientProfitabilityHandler` מדלג (ברמת הלקוח, לפני קריאת entries/costs) על לקוח במצב `pending_signature` — לא נוצר עבורו מסמך `client_profitability`; `listUnlinkedSalesRecords` מאחד כעת את מזהי `pending_signature_intents` לתוך סט ההחרגה יחד עם `sales_record_links`. **פער העקביות שתואר בבאנר הישן (`listUnlinkedSalesRecords` מפתחת החרגה לפי `sales_record_links` בלבד, כך שמכר שכבר יצר לקוח ממתין חוזר להופיע כ"לא מקושר") נסגר ב-#424** — ה-diff מוסיף בדיוק את איחוד שני סטי ה-id (`functions/src-ts/tofes-mecher/list-unlinked-sales-records.ts`). 30 תרחישי בדיקה חדשים, 355/355 src-ts, ESLint 0.
> - **c-2-frontend ✅ MERGED** ([#426](https://github.com/Chaim2045/law-office-system/pull/426), `3219434`) — לימדה את ה-badge של `ClientsTable` ואת ה-guard ב-user-app להכיר במצב `pending_signature`.
> - **c-3 ✅ MERGED** ([#452](https://github.com/Chaim2045/law-office-system/pull/452), `5a53e70`, 2026-07-15) — CF חדש `releaseClientFromPendingSignature`: מאמת את הסכם שכר הטרחה החתום האחרון שהועלה דרך `verifySignatureCore` (הליבה המשותפת שחולצה מ-H.5), בודקת סטיית סכום (טולרנס ₪1) מול הרשומה החיה ב-tofes-mecher, ואם הכל תקין — הופכת את הלקוח ל-`active` **וכותבת את `sales_record_links/{salesRecordId}` באמצעות `.create()`** (race-safe, בתוך אותה טרנזקציה). **הכתיבה הקבועה של `sales_record_links` בשלב ה-release (scope של c-3) מאומתת ישירות מה-diff** — `functions/src-ts/cutover/release-client-from-pending-signature.ts` שורות 421-437 (`transaction.create(linksRef, ...)`). Audit-FIRST בתוך הטרנזקציה (`logCriticalActionInTxn`) לפני ה-mutation, בדיוק כפי שהוגדר בעקרון §2.2. 33 בדיקות, TypeScript/ESLint נקיים.
> - **c-4 ✅ MERGED** ([#453](https://github.com/Chaim2045/law-office-system/pull/453), `2cd73a2`, 2026-07-16) — הפעילה את כפתור "אשר וצור לקוח" ב-`pending-clients.html` (confirm dialog → callable → toast → refresh) + תיקנה שני ממצאי-שלמות שנותרו מ-c-3: `lastModifiedBy` ב-CF ה-release פותר כעת שם תצוגה של המנהל דרך חיפוש employee (במקום UID גולמי), ו-`pending_signature_intents` נמחקים בתוך טרנזקציית ה-release ברגע שהקישור הקבוע נכתב. **ההחלטה הפתוחה של מסך ההתאמה (match-screen outcome model / כיסוי `idNumber` ~1/139) שהבאנר הישן ציין כ"נדחית לצ'קפוינט של c-4" — לא טופלה ב-#453.** ה-diff של c-4 עוסק אך ורק בהפעלת כפתור היצירה + תיקוני שלמות טכניים; אין בו קוד הנוגע למסך התאמה, ל-`idNumber`, או ללקוח-קיים/שירות-נוסף. **ההחלטה נותרה פתוחה ונדחית — לא נפתרה בשום מקום בקוד שנבדק.**
> - **c-5 ✅ MERGED** ([#454](https://github.com/Chaim2045/law-office-system/pull/454), `aa4a6cd`, 2026-07-16) — מחקה את `SimpleClientDialog.js` (עוקף כתיבה ישירה ל-Firestore, ללא הפניות HTML חיות) ואת `case-creation-dialog.js` (אשף בן 2395 שורות שמעולם לא נטען מאף עמוד חי). ה-FAB ב-`clients.html` מנווט כעת ל-`pending-clients.html`.
>
> **שערי ה-live-egress של H.5 (cost-cap / never-persist-`reasoning` / identifier-wiring) — הסטטוס האמיתי לפי ה-diff של #452 (לא לפי הכוונה המקורית):**
> - **identifier-wiring: ✅ סגור.** c-3 פותרת את מרחב המזהים — `salesRecordId` (tofes-mecher) → `{caseNumber, serviceId}` (law-office) דרך `pending_signature_intents/{salesRecordId}` — ואז קוראת ל-`verifySignatureCore(callerUid, caseNumber, agreementId, 'clients')`.
> - **never-persist-`reasoning`: ✅ סגור.** מאומת מה-diff: `releaseClientFromPendingSignatureHandler` לעולם לא מחזיר ולעולם לא כותב את `verdict.reasoning`; רק `clientSignaturePresent` / `lawyerSignaturePresent` / `confidence` חוצים את הגבול, גם בפסילה וגם ב-audit.
> - **cost-cap: 🟡 עדיין פתוח — לא נסגר.** ה-diff של #452 מרחיב את `verifySignatureCore` אך אינו מוסיף שום בדיקת page-count/גודל מעבר לתקרת ה-6MB הקיימת מ-H.5 (`functions/src-ts/signatures/verify-signature-presence.ts:78`, "Hard size ceiling (bytes) — matches the fee-agreement upload cap (6MB)"). הסיכון המקורי מ-§8.8 סעיף 2 ("מסמך 100+ עמודים יקר, כדאי Sonnet") **נשאר לא-מטופל.**
>
> **⏭️ NEXT = H.8** (AI chat, §8.10) — H.7.b נותר חסום (ראו §8.9 למטה).
>
> **🔴 OPEN DECISIONS / GATES before the remaining H.6 increments wire live egress (surfaced by the H.5/H.6 investigation 2026-06-21):**
> 1. **DPA / PII-egress gate (🔴 — Haim's legal call):** before any REAL client PDF is sent to Anthropic, a documented legal basis (Anthropic as sub-processor, retention posture, privacy notice under חוק הגנת הפרטיות). This is THE blocker on H.6's live signature-gate increment; product/legal, not engineering.
> 2. **Cost cap (🟡):** beyond the 6MB byte cap, add a page/size sanity (a 6MB PDF can be 100+ pages → an expensive Opus document call); consider Sonnet for the presence check (the config already anticipates retuning).
> 3. **Never-persist `reasoning` (🟡):** if a verdict must be persisted in the cutover UI, store ONLY the booleans + confidence + `passed` — NEVER the free-text `reasoning` (it can quote PII off the document; §7.6 leak class).
> 4. **Identifier wiring (🟡):** H.6 sources data from a tofes `sales_record`, but `verifySignaturePresence` addresses the law-office `{clientId, agreementId}` — two different identifier spaces; the cutover must resolve the law-office side separately from the `salesRecordId`.
> 5. **Gate contract (reference):** H.6 should gate on the `passed` boolean from H.5 (`= clientPresent && lawyerPresent && confidence ≥ 0.8`, threshold centralized in `config/index.ts`) — never re-derive the threshold.

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

> **🟡 IN PROGRESS — split into H.7.a (DONE, the safe reframe) + H.7.b (DEFERRED). The "Sub-tasks" below are SUPERSEDED.** 3-lens read-only investigation (frontend-ui-expert + data-investigator + completeness-checker, 2026-06-25) overturned the §8.9 premise: **`ExceptionModal.js` does NOT exist, and the string "הפסד למשרד" exists ONLY in this plan — never in code.** The real LIVE overrun-framing surface is `apps/admin-panel/js/features/ServiceOverdraftResolution.js` (admin, on `clients.html`), which already said the NEUTRAL "חריגה" (overrun), not "loss". So the headline "reframe loss→debt" had almost no literal text to change. The investigation also found the §8.9 "persist + dashboard-reflect" half is **NOT** a text change: persisting a `collectionStatus` is a backend write through `clients/index.js`+`client-writer.js` (which the active OWN-*/single-owner backend session OWNS → collision risk), and "Forecast reflects collection" is **blocked on H.6** (the Forecast has no `paidRevenue` number yet — `forecast-aggregation.ts` hardcodes `null` until H.6, so "collected = revenue counted" has nothing to attach to).
>
> **✅ H.7.a — the safe SEMANTIC REFRAME (Haim-approved checkpoint "Option A", 2026-06-25; DONE — [PR #404](https://github.com/Chaim2045/law-office-system/pull/404), branch `feat/h-7a-overdraft-debt-reframe`).** DISPLAY-ONLY reframe of the ONE real surface (`ServiceOverdraftResolution.js`): 9 user-facing Hebrew strings + 2 stale comments, "חריגה" → **"חוב פתוח לגביה מהלקוח"** framing and the resolve/unresolve action → **"סמן כנגבה" / "החוב נגבה"** (warning, button, resolved-title, modal title, placeholder, success/unresolve toasts, the admin-only alert + confirm). **The BACKEND IS UNCHANGED** — the `setServiceOverdraftResolved` CF, the `resolved:true/false` payload, and the **count/filter key `overdraftResolved.isResolved`** are byte-intact → **NO admin count, filter, or aggregate moves** (ADMIN SAFETY: display-only, the resolve↔collected mapping is binary, same as before). `?v=` bumped on clients.html. NEW `overdraft-debt-reframe.test.ts` (5: behavioral — the rendered DOM shows the debt framing in both the open + settled states; + contract guards — the CF/payload/count-key are unchanged). admin-panel **195/195**, ESLint 0, `node --check` OK. Frontend-only, no rules/claims/migration → **no devils-advocate** (§3.8.4). outcomes-grader=PASS.
>
> **⏭️ H.7.b — DEFERRED (the collection WORKFLOW, not yet scheduled):** the 3-state buttons (`נגבה`/`בתהליך גביה`/`בלתי-גביה`) + persisting `collectionStatus` on the service aggregate + the dashboard Forecast reflection. **Gated on:** (1) the active OWN-*/single-owner backend session RELEASING `clients/index.js`+`client-writer.js` (1 session = 1 writer at a time); (2) **CORRECTED (2026-07-19):** ~~H.6 landing `paidRevenue`~~ — **H.6 is now complete (§8.8, all 5 c-1…c-5 increments merged) and did NOT deliver `paidRevenue`.** Verified: `functions/src-ts/profitability/forecast-aggregation.ts:268` still hardcodes `paidRevenue: null, // H.6 seam (D-C): no live payments source yet — NEVER 0`. H.6 delivered the *signature gate* (gated client creation from a tofes-mecher sale), not a payments/invoicing source. The Forecast-reflection half of H.7.b therefore now depends on a **payments/invoicing source that no phase currently owns** — not on H.6, and not yet scheduled anywhere in this plan. Also deferred (a vocabulary-harmonization nicety, NOT a "loss" problem): the factual "חריגה" status badges on `ClientsTable`/`ClientReportModal`/`service-card-renderer` — those say "overrun" (a fact), so they were intentionally left untouched in H.7.a to keep the diff tight + the count semantics stable.
>
> **The original SMALL/text-only/SHIP-ANYTIME framing below was WRONG** (the persist+dashboard half is MEDIUM + collision/H.6-gated). The historical sub-tasks are retained for reference.

**Goal (SUPERSEDED — see banner):** "Open debt to collect" instead of "Loss".

**Sub-tasks (SUPERSEDED — `ExceptionModal.js`/"הפסד" never existed; real surface = `ServiceOverdraftResolution.js`):**
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
| 2026-06-10 | **H.2 cost stored in a SEPARATE CF-only `timesheet_entry_costs/{entryId}` collection** (Option A), NOT as a flat field on the timesheet entry doc | **REVISION of the 2026-05-27 "snapshot at entry write" row.** Security found that `timesheet_entries` is employee-readable (`firestore.rules` + the User App reads them client-side), so a flat `costPerHourAtEntry` field would expose each employee's own confidential cost-per-hour — violating the locked §7.6 "cost NOT exposed to employee self". Option A keeps the snapshot semantics (immutable, per-entry, keyed by entryId, written ATOMICALLY in the same transaction) while moving it OFF the readable entry. The §7.6 confidentiality lock takes precedence over the literal "on the entry" wording. H.3's forecast aggregation joins entryId→cost server-side (Admin SDK). The §5.4 "bud" + §8.4/§1.3.7 wording are updated accordingly. | (B) admin-only entry read rule — breaks the employee's own-timesheet view; (C) subcollection — A-but-nested, no gain; (D) accept the leak — forbidden, violates §7.6 |
| 2026-06-10 | **H.3 Forecast cost/profit lives in a NEW CF-only `client_profitability/{caseNumber}` collection, read-gated `allow read: if isAdmin() \|\| isPartner()`** (write CF-only), NOT on the `clients` doc | `clients` is world-readable (`firestore.rules:147` `allow read: if isAuthenticated()`, read client-side by the User App), so a cost/profit aggregate there leaks each employee's confidential rate — in a single-employee case `actualCost÷actualHours` = the exact rate (same §7.6 leak class as H.2 Option A). The `isAdmin()\|\|isPartner()` read-gate (vs a fully-locked `if false`) is required to permit the §8.5 real-time `onSnapshot` dashboard WITHOUT exposing cost to employees; it is the first production `isPartner()` consumer (Pre-H.0.0.D deferred it here, dormant + fail-secure). `actualCost` is derived by a dedicated aggregation job (Σ live-minutes × snapshot cost, joined by `entryId`, null≠0, un-costed-coverage %), NOT the timesheet trigger. paidRevenue + tofes-sourced revenue deferred to H.6. Haim-approved at the 2026-06-10 H.3 checkpoint. | (a) on the `clients` doc — leaks (world-readable); (b) fully-locked `if false` collection — blocks real-time `onSnapshot`; (c) compute-on-demand only — no real-time + recompute cost; (d) extend the timesheet trigger — its CREATE branch is skipped for in-txn deductions → misses most costs |
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
| 2026-06-14 | **BQ `sales_records` mirror retention = indefinite, source-bounded (documented); dataset `max_time_travel_hours=48`; NO table expiration. `tofes_export_deadletter` = Firestore TTL on `expireAt` (90d), NOT `failedAt`** | The mirror is a self-refreshing WRITE_TRUNCATE derived view — a deleted-in-source row vanishes ≤1h, so no independent retention obligation beyond the source; "indefinite/source-bounded" is a defensible *documented* decision under חוק הגנת הפרטיות. Time-travel (7d) + fail-safe (~7d) keep deleted PII recoverable ~14d → `max_time_travel_hours=48` shrinks the configurable tail 7d→2d (fail-safe residual is non-configurable, accepted). Table-expiration is wrong (create-if-not-exists re-materializes). Deadletter TTL must target `expireAt` because `failedAt` (serverTimestamp at write) is already in the past → a policy on it purges immediately. security+backend specialists GO; Haim-ratified 2026-06-14 checkpoint. | (a) BQ table default-expiration (re-materializes); (b) TTL on `failedAt` (immediate purge); (c) a scheduled drain CF (extra function/cost — nothing to re-drive since the hourly reload self-heals); (d) leave time-travel at 168h default (larger PII tail) |

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
- **2026-06-14 (H.1.c retention/TTL follow-up)**: closed the two retention gaps deferred at the H.1.c checkpoint (§8.2/§8.3/§8.4 carry-note → DONE). Decided + documented the BQ `sales_records` retention posture (indefinite/source-bounded; `max_time_travel_hours=48`; no table-expiration) and bounded `tofes_export_deadletter` with a Firestore TTL on a new `expireAt` field (90d) + a no-PII payload AST lock + a brief triage runbook — `docs/PHASE_2_FOUNDATIONS.md` "Retention & TTL" + 1 new §10 Decisions-Locked row. Code surface = `expireAt` on the dead-letter write (+`DEADLETTER_RETENTION_DAYS`), a `firestore.rules` comment-only update, and the test mock/guard. Reason: deferred PII-at-rest hygiene under חוק הגנת הפרטיות. security + backend specialists consulted (GO); Haim ratified all 3 decisions (90d / include the PII-lock / set time-travel 48h) at the 2026-06-14 checkpoint. NOT a §15 bar revision (ops/docs, no acceptance-criteria source changed). The full bridge runbook stays scheduled for H.9 (§8.11).
- **2026-06-15 (H.3 CLOSED + H.4 reframed to "Model A")**: §8.5 — all 5 H.3 PRs merged+deployed (Plan #368 / Cost-UI #371 / Forecast #373 / Dashboard #374 / Nav #375); §8.5 + the §8.4 NEXT-pointer flipped to DONE; NEXT = H.4. §8.6 (H.4) REVISED by Haim (Product Owner): the original "hybrid partner-APPROVAL gate" is SUPERSEDED — Haim rejected approval-for-everything as operational friction ("it would paralyze the office"). New spec = **"Model A: smart budget meter"** (budget upfront + visual warning + an admin overrun-feed, NO gate). The 5-lens investigation found Model A is ~90% already built + the original approval-gate was NEVER implemented (a dead/broken scaffold — `approveTaskBudget`/`rejectTaskBudget` CFs don't exist). Decomposition: 2 LIGHT frontend PRs (admin "חריגות תקציב" feed + dead-gate cleanup; worker overrun-toast + cleanup); partner notification deferred; **NO devils-advocate** (no new gating write path / rules / claim). Reason: a Product-Owner operational-direction call (his domain — the bar governs quality/architecture, not product direction). NOT a §15 bar revision (scope/direction, no acceptance-criteria source changed).
- **2026-06-15 (🏁 H.4 CLOSED — both PRs merged)**: §8.6 — **PR-a merged (#376, `de0edf0`)** = admin "חריגות תקציב" feed (repurposed nav button/badge/side-panel) + the canonical `budget-status.js` helper (85/100, 21 tests) + removal of the dead approve/reject path (latent G1). **PR-b merged (#377, `49c665a`, merge `6d816f4`)** = the worker moment-of-overrun toast (`detectBudgetCrossing` pure helper, drift-guard-pinned to PR-a's thresholds; consumes the addTimeToTask txn's authoritative `newActualMinutes` → stateless once-per-crossing; never breaks the save) + the `levelForPercent` 80→85 alignment + deletion of the dead user-app `task-approval-system/` folder (9 files) + the doc sweep (SYSTEM_MAP / NOTIFICATION-SYSTEM / admin components README). Both frontend-only → no devils-advocate; PR-a grader=PASS, PR-b 127 new tests + 243/243 user-app suite + 0 lint. **🏁 H.4 — TASK BUDGETING (Model A) CLOSED on PR-b merge.** Each PR ran the full Feature Protocol (5-lens investigation → checkpoint-approved scope → code → grader → PR). DEFERRED (Haim, non-blocking): partner daily-digest notification, the backend `dailyBudgetWarnings` 80%→85% unification, an H.3-dashboard task-overrun tile. **⏭️ NEXT ROCK = H.5 (PDF signature pipeline, §8.7)** — depends on H.1 (done); needs its own Intent + checkpoint.
- **2026-06-18 (Security-Hardening track — documented for full-picture continuity; NOT a roadmap change)**: A parallel frontend security-hardening track was spun from PR #382's sibling chips (stored-XSS + CSV/formula-injection across admin-panel export/dialog paths). **⚠️ This is an ORTHOGONAL hardening track, NOT a change to the primary MVP sequence — `H.5 → H.9` REMAINS THE FOCUS. Do NOT over-prioritize hardening at the expense of the H-sequence, and do NOT let parallel work break other fronts.** DONE + merged to main: **#382** (ReportGenerator client-report XSS, 10 sinks), **#383** (WhatsApp dialog XSS), **#384** (SMS CSV + the canonical shared encoder `apps/admin-panel/js/core/csv-safe.js` → `window.CsvSafe.cell`), **#385** (ReportGenerator CSV → routed to CsvSafe, inline copy removed), **#386** (ClientsTable export CSV → CsvSafe — the worst LIVE sink, zero prior escaping). REMAINING (small/medium, non-blocking, tracked in the Lead-Agent memory files): `DataManager.exportToCsv` (last live CSV sink → route to `window.CsvSafe.cell`); `Notifications.js` XSS + `showNotification` API-mismatch; the **escapeHtml SSOT dedup** (~21-23 duplicated HTML-escapers → ONE `apps/admin-panel/js/core/escape-html.js` → `window.escapeHtml`, EXCLUDING the ClientsTable `data-tooltip-html` which packs pre-built HTML); and a PLANNED §15 Bar-Revision **"encoders are SSOT — route, never copy"** (frontend output-encoders live in ONE shared `js/core/` util, never re-copied per file — the rule that prevents this whole class of drift; to ship as its own bar-revision PR with devils-advocate). **Coordination lesson (codified):** chip-spawned parallel Claude sessions hit the SHARED git working tree and risked clobbering → adopt **1 session = 1 git worktree = 1 branch; one writer at a time** for all parallel work. Each security PR ran the full Feature Protocol (investigation → checkpoint → independent `outcomes-grader`=PASS → PR, CI-green). NOT a §15 bar revision (the iron rule itself is the future §15 entry; this row only documents the track for cross-session continuity). Reason: Haim asked that the canonical plan reflect the full picture so ANY session — including the original — is synced, WHILE keeping `H.5→H.9` as the primary focus.
- **2026-06-21 (📌 reconciliation — H.5 + H.6.a were built but unrecorded; §11-mandated sync)**: Two updates. (a) **Security sub-track CLOSED:** `DataManager.exportToCSV` → routed to `window.CsvSafe.cell` + fail-secure guard ([PR #388](https://github.com/Chaim2045/law-office-system/pull/388), `be3c986`) — the LAST live admin-panel CSV sink; every CSV exporter (SMS #384 / ReportGenerator #385 / ClientsTable #386 / DataManager #388) now routes through the one `CsvSafe` SSOT. (b) **Roadmap reconciliation (the headline):** a read-only investigation for the "next rock = H.5" kickoff discovered that **H.5 and H.6.a were already merged** and the plan was never updated — the §11 "if the file is out of date, reconcile FIRST" rule applied. Recorded as DONE banners on §8.7/§8.8 + here: **H.5 = [PR #378](https://github.com/Chaim2045/law-office-system/pull/378) (`6b961f1`, 2026-06-16)** — `verifySignaturePresence` shipped as plumbing (admin-gated, audit-FIRST-BEFORE-egress, confused-deputy-pinned, dual no-PII-in-logs, verdict-never-persisted, 18 tests; input is `{clientId, agreementId, collection?}` resolving the law-office `feeAgreements[].storagePath`, **NOT** the stale `pdfStorageUrl`, and **NOT** the tofes sale, which has no PDF field). **H.6.a = [PR #381](https://github.com/Chaim2045/law-office-system/pull/381) (`251e459`, 2026-06-17)** — `createClientFromSalesRecord` (Option A; does not yet gate on the signature check). **PR-SEC-2 = [#380](https://github.com/Chaim2045/law-office-system/pull/380)** (fee-agreement signed-URL cutover + ACL revocation) also landed unrecorded → the signed PDF is admin-protected. **One investigation finding was adversarially verified FALSE:** the alleged `output_config.format`/`response.parsed_output` "runtime bug" in H.5 is in fact the CORRECT, current Anthropic structured-outputs API for `claude-opus-4-8` (checked against the canonical claude-api reference) — no fix needed; verifying beat trusting. **⏭️ NEXT = the remaining H.6 cutover increments** (the Pending-Creation UI + the signature-gate wiring), whose LIVE part is BLOCKED on the §8.8 🔴 DPA / PII-egress decision (Haim's legal call). Docs-only; no code/behavior change. NOT a §15 bar revision.
- **2026-06-25 (Single-Owner Aggregate Redesign — parallel data-integrity track; documented for full-picture continuity, Haim-approved)**: A root-fix track for the hours-drift class (`timesheet_entry.minutes → package → service → client.hoursUsed`) — the strategic follow-up to the tactical DRIFT-2 repair. **Full detail lives in the Lead-Agent memory `project_aggregate_single_owner_redesign.md`; this entry syncs the canonical plan (§11 reconcile rule), like the 2026-06-18 security-hardening track.** **⚠️ This is an ORTHOGONAL data-integrity track — it does NOT change the `H.5→H.9` MVP focus.** Principle (Haim, "כל שירות עומד לגופו"): every hours number is a pure function of the ledger, written by ONE owner that recomputes-from-source, plus a reconciliation loop that auto-heals. **Shipped + live in PROD, all gated-safe:** **OWN-0** ([#398](https://github.com/Chaim2045/law-office-system/pull/398), stop minting `packageId:null` orphans + Check-7 detection) · **OWN-1** ([#399](https://github.com/Chaim2045/law-office-system/pull/399), the live recompute-from-ledger owner `writeServiceWithCanonicalPackages`, shipped as DEAD CODE) · **OWN-2** ([#400](https://github.com/Chaim2045/law-office-system/pull/400), the gated `reconcilePackageDrift` reconciliation loop — `system_settings/package_reconciliation` **default OFF**; never auto-blocks a client; **`dry_run` LIVE + clean since 2026-06-28**, monitored nightly before `enforce`). **OWN-3 RE-SCOPED** (effort-scaler-HEAVY + backend + data-investigator + security + completeness investigation → Haim-approved): the team found the literal "reroute the live writers" is a LESS-safe trade; "single owner" = the OWN-1 owner + OWN-2 running in `enforce` as the standing owner-of-record, with the live `+=delta` kept as a provisional number the loop reconciles. OWN-3 = (a) a supervised `dry_run→enforce` promotion (Haim's hands — `dry_run` LIVE + clean since 2026-06-28; `enforce` pending), (b) an **Admin-Panel control** (nav "סנכרון שעות": set off/dry_run/enforce + Run-now + see what was fixed) — **backend callables MERGED ([#401](https://github.com/Chaim2045/law-office-system/pull/401)); the frontend page is the next PR**, (c) doc fixes (design-§5 + provisioning-writers out-of-scope). **🔴 P0 caught + fixed BEFORE `enforce` ([#402](https://github.com/Chaim2045/law-office-system/pull/402)):** an independent 38-agent adversarial audit found a silent under-count — the engine's `ledgerTruth` excluded `unresolved` entries (an overdrawn service past the −10h floor), so the recompute could write `hoursUsed` below the true total and pass a clean invariant; engine-only fix (`ledgerTruth = Σ assigned+unresolved` → invariant flips false → owner/loop refuse). **HARMLESS in prod (the flag was OFF) — the gated-off + dry_run-first + independent-audit safety net caught it before any live write.** 100% compatible with H.3 profitability (fully decoupled — the forecast computes from the ledger, never reads `service.hoursUsed`) + all bar/protocol/gate constraints; **zero §10 locked-decision change.** Every PR ran the full Feature Protocol (investigation → checkpoint → grader → devils-advocate-on-write-paths). Each on its own branch off `origin/main` in the isolated worktree `lo-single-owner` (1 worktree = 1 branch). NOT a §15 bar revision (data-integrity track, no acceptance-criteria source changed). **NEXT** (all in the memory file): OWN-3 frontend page → supervised `dry_run→enforce` → OWN-4 (retire the incremental writers once OWN-2-enforce is the owner-of-record).
- **2026-06-25 (H.7 premise corrected + split; H.7.a shipped)**: §8.9 — a 3-lens read-only investigation (frontend-ui-expert + data-investigator + completeness-checker) overturned the H.7 premise: **`ExceptionModal.js` and the string "הפסד למשרד" never existed in code** (only in this plan); the real LIVE surface is `apps/admin-panel/js/features/ServiceOverdraftResolution.js`, already neutral "חריגה". The investigation also showed the §8.9 "persist + dashboard" half is NOT a text change — it is a backend write through `clients/index.js`/`client-writer.js` (collision with the active OWN-*/single-owner session) + a Forecast feature blocked on H.6 (`paidRevenue` is hardcoded `null` until H.6). **Haim approved "Option A" at the 2026-06-25 checkpoint: SPLIT H.7** into **H.7.a** (DONE — [PR #404](https://github.com/Chaim2045/law-office-system/pull/404), branch `feat/h-7a-overdraft-debt-reframe`; the safe DISPLAY-ONLY semantic reframe of the overdraft modal/warning/toasts, "חריגה" → "חוב פתוח לגביה"/"נגבה", 9 strings + 2 comments; backend CF + `resolved:true/false` payload + the `overdraftResolved.isResolved` count/filter key all byte-UNCHANGED → no admin count/filter/aggregate moves; `?v=` bumped; 5-test behavioral+contract guard `overdraft-debt-reframe.test.ts`; admin-panel 195/195, ESLint 0, node --check OK; frontend-only → no devils-advocate; grader=PASS) + **H.7.b** (DEFERRED — the 3-state collection workflow `נגבה`/`בתהליך`/`בלתי-גביה` + persisting `collectionStatus` on the service aggregate + the dashboard Forecast reflection; gated on the OWN-* backend session releasing `clients/index.js`/`client-writer.js` + H.6's `paidRevenue`; plus the deferred vocabulary-harmonization of the factual "חריגה" badges on ClientsTable/ClientReportModal/service-card-renderer). Reason: a §11 "reconcile the stale plan first" correction + a Product-Owner scope split (his domain). NOT a §15 bar revision (scope/direction, no acceptance-criteria source changed).
- **2026-06-28 (📌 §11 reconciliation — stale section headers + recent admin-panel merges synced)**: A pre-"next rock" deep-review pass (full `origin/main` audit: clean-room detached worktree + the 708-test unit suite green + 4 parallel read-only audit agents over the escapeHtml SSOT track, H.7.a, the OWN-x track, and plan coherence) found two **section headers** had drifted from merged reality — the §11 "reconcile FIRST" rule applied. Fixed in place: **§7 header `🟡 IN PROGRESS (5/7)` → `🏁 CLOSED (7/7, 2026-06-08)`** (the §7.1 table already showed all A–G ✅ merged; only the heading lagged) and **§8 header `⏸️ WAITING` → `🟡 IN PROGRESS`** (Phase 2 is well underway: H.0–H.5 CLOSED, H.6/H.7 in progress). Recorded here for full-picture continuity (no separate plan-item status line exists for these admin-panel merges): **OWN-3 frontend page SHIPPED — [PR #407](https://github.com/Chaim2045/law-office-system/pull/407)** (`e7ae1ef`, the admin "סנכרון שעות" reconciliation control page) — this **supersedes the "the frontend page is the next PR" note** in the 2026-06-25 single-owner entry above; the remaining OWN-3 step is now only the supervised `dry_run→enforce` promotion (Haim's hands, BC-5 partner sign-off). **Admin-report fixed-price awareness + null-aggregate guard — [PR #406](https://github.com/Chaim2045/law-office-system/pull/406)** (`0c5e01b`, the report crashed on FIXED-price procedures carrying a null `hoursRemaining` → `Number.isFinite` guard + a fixed-price branch). **Admin caseOpenDate save + client-report default range — [PR #408](https://github.com/Chaim2045/law-office-system/pull/408)** (`02a348d`, a dead `FirebaseService.call('updateClient')` reference → `firebaseFunctions.httpsCallable`; the client-report default quick-range `thisMonth`→`all`, display-default only). **Fluent report-modal clientId — [PR #409](https://github.com/Chaim2045/law-office-system/pull/409)** (`480efd6`, pass the client id, not the raw object, to the report modal). The escapeHtml SSOT dedup track (#390/#391/#393/#394) + H.7.a ([#404](https://github.com/Chaim2045/law-office-system/pull/404)) were independently re-verified intact in main (0 residual duplicate HTML-escapers; WorkloadCard onclick→delegation safe; H.7.a backend CF + `resolved:true/false` payload + the `overdraftResolved.isResolved` count-key byte-unchanged). Docs-only; no code/behavior change. NOT a §15 bar revision.
- **2026-07-02 (H.6.b — Pending Client Creation UI landed in DEV; §11 status-flip sync)**: §8.8 — recorded the 3-PR Pending-Creation UI slice as DONE in `main`: **PR1 `listUnlinkedSalesRecords` CF ([#417](https://github.com/Chaim2045/law-office-system/pull/417))** + **PR2 `pending-clients.html` admin page ([#418](https://github.com/Chaim2045/law-office-system/pull/418), `26db84a`)** + **PR3 `לקוחות ממתינים` nav entry ([#420](https://github.com/Chaim2045/law-office-system/pull/420), `c14baff`)**. Each ran the full Feature Protocol (investigation → checkpoint-approved 3-PR decomposition → code → outcomes-grader → gated PR); PR2's grader returned FAIL first (48 ESLint errors + a `ModalHelpers` XSS round-trip via a `data-` attribute + no test) → evaluator-optimizer round 1 fixed all three (rewrote ESLint-clean, escape-at-sink + records-map, extracted `pending-clients-format.js` + 12 tests) → re-grade **PASS**; PR3 grader PASS. The slice exposes `createClientFromSalesRecord` (Option A, H.6.a — the deterministic create) through an admin UI; it does **NOT** wire the H.5 signature gate (that stays the separate H.6.c increment). Also recorded: the **DPA / PII-egress gate is RESOLVED (2026-07-01)** — so H.6.c is no longer legal-blocked, only engineering-gated (identifier wiring + cost cap + never-persist-`reasoning`). **Process lesson captured in §8.8:** #419 (the original nav PR) was stacked on the PR2 branch and merged into it, not `main` — re-landed via #420 off `main`; a stacked PR's base must be retargeted to `main` after its parent merges. Reason: §11 status-flip on merge. NOT a §15 bar revision (roadmap status sync, no acceptance-criteria source changed). **⏭️ NEXT H.6 increment = H.6.c** (signature-gate wiring: resolve the tofes `salesRecordId` ↔ law-office `{clientId, agreementId}` identifier spaces + gate the create on H.5's `passed` boolean) — needs its own Intent + checkpoint.
- **2026-07-02 (H.6.c kickoff — Option B locked + c-1 merged; §11 status-flip)**: H.6.c (signature-gate wiring) opened after the DPA gate resolved (2026-07-01). Architecture locked = **Option B (two-phase `pending_signature`)** over Option A (clean staging), via design-analysis + devils-advocate; decomposed into 5 increments c-1…c-5, each with its own Intent/checkpoint. **c-1 merged ([PR #422](https://github.com/Chaim2045/law-office-system/pull/422), `20ae775`)** — `createClientFromSalesRecord` now creates in `status:'pending_signature'` (phase 1; grader=PASS_WITH_WARNINGS, devils-advocate=GO; 33/33 tests, drift-guard 8/8). c-2…c-5 pending. **c-2 scope refined by a post-c-1 read-only investigation:** besides the forecast skip-set + "ממתין לחתימה" badge, c-2 must fix `listUnlinkedSalesRecords` — c-1 moved the permanent `sales_record_links` write to c-3 but left the lister keyed on it, so a sale that already produced a pending client re-appears as "unlinked" (the `pending_signature_intents` idempotency still prevents a duplicate create → consistency gap, not data corruption). Live egress (c-3) still engineering-gated (cost-cap / never-persist-`reasoning` / identifier-wiring `salesRecordId`↔`{clientId,agreementId}`); DPA no longer a blocker. Open product decision (the match-screen outcome model; the person-match premise has an `idNumber`-coverage/backfill dependency — ~1/139 existing clients carry `idNumber` today) deferred to the c-4 checkpoint. Investigation-only; no code/behavior change in this PR. NOT a §15 bar revision (roadmap status sync, no acceptance-criteria source changed).
- **2026-07-19 (📌 §11 reconciliation — H.6.c CLOSED, all 5 increments merged; `paidRevenue` finding corrects H.7.b's gate)**: §8.8 banner + §8.9 line corrected — the plan still read "c-1 ✅ MERGED … c-2…c-5 not yet built", which was FALSE: all five H.6.c increments are merged to `main`. Re-verified in this PR directly against the merge diffs (`git show <sha>`), not trusted from prior plan text: **c-1** ([#422](https://github.com/Chaim2045/law-office-system/pull/422), `20ae775`) — creates client in `status:'pending_signature'`. **c-2-backend** ([#424](https://github.com/Chaim2045/law-office-system/pull/424), `6aa680b`) — Forecast job skips `pending_signature` clients; `listUnlinkedSalesRecords` unions `pending_signature_intents` into its exclusion set, **closing the consistency gap** the old banner flagged (verified from the diff). **c-2-frontend** ([#426](https://github.com/Chaim2045/law-office-system/pull/426), `3219434`) — `ClientsTable` badge + user-app guard learn `pending_signature`. **c-3** ([#452](https://github.com/Chaim2045/law-office-system/pull/452), `5a53e70`) — new `releaseClientFromPendingSignature` CF: verifies the signed fee agreement via the shared H.5 `verifySignatureCore`, checks fee drift, flips the client to `active`, and **writes `sales_record_links/{salesRecordId}` via `.create()` inside the transaction** (verified at `functions/src-ts/cutover/release-client-from-pending-signature.ts:421-437`), audit-FIRST via `logCriticalActionInTxn`, and **never returns or persists the model's `reasoning`** (verified from the diff). **c-4** ([#453](https://github.com/Chaim2045/law-office-system/pull/453), `2cd73a2`) — enables the "אשר וצור לקוח" button + fixes `lastModifiedBy` + intent cleanup; **does NOT resolve** the match-screen outcome-model decision (verified absent from the diff — that decision remains open/deferred). **c-5** ([#454](https://github.com/Chaim2045/law-office-system/pull/454), `aa4a6cd`) — retires `SimpleClientDialog.js` + `case-creation-dialog.js`; FAB now routes to `pending-clients.html`. **Of the three H.5 live-egress engineering gates named in the old banner:** identifier-wiring and never-persist-`reasoning` are closed (verified from the #452 diff); the cost/page-size cap beyond H.5's existing 6MB byte ceiling is **still open** (verified absent from the diff — no page-count guard was added). **Separately, a load-bearing finding:** `functions/src-ts/profitability/forecast-aggregation.ts:268` still hardcodes `paidRevenue: null, // H.6 seam (D-C): no live payments source yet — NEVER 0`. **H.6 landing did NOT unblock H.7.b.** §8.9's line naming H.7.b's gate #2 as "H.6 landing `paidRevenue`" is corrected: H.6 is now complete and delivered the *signature gate*, not a payments source — the Forecast-reflection half of H.7.b now depends on a payments/invoicing source that **no phase currently owns**. Gate #1 on that same line (the OWN-*/single-owner session holding `clients/index.js`+`client-writer.js`) is left as-is — `אין לי ודאות` on its current status; not re-verified from git history in this docs-only PR. This PR is **docs-only — no code, no behavior change** (only `docs/MASTER_PLAN.md` touched). **NOT a §15 bar revision** (roadmap status sync, no acceptance-criteria source changed). **⏭️ NEXT = H.8** (AI chat, §8.10) — H.7.b remains deferred per the corrected gate above.
- **2026-07-22 (Admin Panel `timesheet_entries`/`budget_tasks` query cap raised 5000→20000 + a loudness guard; runway extension, NOT the structural fix — deferral explicitly declared here per adversarial-review finding)**: `apps/admin-panel/js/managers/ClientsDataManager.js` queried both collections with a hard `.limit(5000)` and no truncation signal; Firestore silently returns the first N docs past that count, so the admin panel would have started rendering an INCOMPLETE dataset (oldest records missing from every screen, total, and export) with zero indication. PROD was measured 2026-07-22 at **4,962/5,000** `timesheet_entries` (~21 entries/day growth) — days from silently crossing the cliff. Branch `fix/admin-entry-limit-guard` (worktree `lo-limit`) shipped: (a) both caps raised 5000→20000; (b) a `warnIfTruncated(collectionName, snapshot, limit)` guard that fires a structured `console.error` + a non-auto-hiding admin toast (`window.notify.show({..., duration:0})`, closeable, never silently dismissed) whenever a query returns exactly its cap; (c) closed a test-fake gap an adversarial review caught — the Firestore-chain fake's `.limit()` previously discarded its argument, so a regression back to `.limit(5000)` while leaving `warnIfTruncated(...,20000)` untouched would have passed all 12 existing tests forever (docs.length would just never again equal the untouched limit) — the fake is now a spy, and the loader tests assert `.limit()`'s argument equals `warnIfTruncated`'s 3rd argument (coupling), verified by a temporary self-check mismatch that was confirmed to fail before being reverted; (d) two mislabelled tests fixed (a guard-existence test that proved nothing about behavior removed; a "negative count mismatch" test that actually fed `limit:0` — which satisfies `docs.length===limit` and fires a false positive the test never asserted on — fixed by making the guard require `limit > 0` before considering truncation, since both real call sites hardcode a positive cap and a non-positive limit is never a real query bound); (e) `devtools/docs/INVESTIGATION-ADMIN-CLIENTS-MANAGEMENT.md`'s three `.limit(5000)` mentions corrected to 20000 + the guard noted, so a future session doesn't read the old number as current. **Explicit deferral (this entry's purpose):** 20000 is a **runway extension of roughly two years at the current measured rate** — an estimate derived from exactly two data points (a single growth-rate sample), so treat it as a rough estimate, not a trend, and re-measure before trusting it further. It is **NOT** a structural fix. The real fix — per-client querying / pagination / date-bounded queries — is named in the branch's commit body and a code comment but was, until this entry, **not recorded in this plan**; declaring it here closes that gap so the deferral is visible rather than disguised as "done." **Out of scope (accepted, not fixed):** the `docs.length===limit` heuristic can false-positive on a collection of exactly 20000 (negligible probability, worst case is an extra warning, not a wrong number); `orderBy('date','desc')` silently omitting documents with no `date` field (pre-existing, unproven, unrelated to this fix). Frontend-only, no rules/claims/schema change → no devils-advocate required. NOT a §15 bar revision (the deferral is a roadmap/tech-debt declaration, not a change to an acceptance-criteria source).
