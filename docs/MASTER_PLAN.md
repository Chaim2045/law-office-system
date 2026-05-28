# MASTER PLAN — Law Office System

**Status anchor:** 2026-05-28
**Owner:** Haim (Product Owner)
**Orchestrator:** Lead Agent (Claude Code session)
**Purpose:** Single source of truth for the multi-phase initiative. Survives session resets, claims context after compaction, lets any new agent answer "where are we?" in 30 seconds.

> **Read this file FIRST** when a new session starts and the request mentions the AI Management Layer, profitability, tofes-mecher integration, or Pre-H.0.0 work. The Lead Agent's working memory of the plan ends when the session ends — this file is what persists.

---

## North star

Build an **AI Management Layer in the Admin Panel** (Claude-based, MCP integration, read-only chat for queries) that:
1. Bridges the existing `tofes-mecher` system (separate Firebase project `law-office-sales-form`) as the system-of-record for all transactions — eliminates manual client/service creation drift.
2. Provides real-time **per-case profitability** (cost-per-hour × hours-worked vs. fee paid), exposed as both Static Plan and Dynamic Forecast.
3. Replaces the current manual admin "create client → create service" flow with a **gated pipeline**: `sales_record` in tofes-mecher → signed PDF → AI signature-presence check → admin approval → deterministic creation.
4. Reframes the **Exception modal** from "loss" to "open debt to collect from client" (semantic clarity for legal-billing reality).
5. Centralizes **task budgeting** with hybrid rules (partner-assigned vs employee-self-opened with auto-approve <3h).

**Why this exists:** the system is being prepared for commercial sale. Internal-tool standards do not survive paying customers. The plan is structured to elevate the system to commercial-grade BEFORE expanding features.

---

## Hard constraints (apply to every PR in this plan)

These are fixed for the entire initiative — do NOT relitigate per PR:

- **Production live**: 10 daily users, 200+ active clients, 6 months in production. No regressions tolerated.
- **Repo is PUBLIC on GitHub** — CI logs world-readable. No secrets, no PII in log fields, no real client emails in code or fixtures.
- **`main` = DEV, `production-stable` = PROD.** Feature branches off `main`, merged back to `main`, then merged to `production-stable` with explicit Haim approval.
- **Branch protection is sacred.** Never `--admin`, never `--force` to main or production-stable. No bypassing hooks.
- **All sub-agents Opus** except `effort-scaler` (Haiku, per spec).
- **Feature Protocol is mandatory** (`@.claude/rules/feature-protocol.md`): Gatekeeper → Intent → Effort-Scaler → Investigation → Completeness-Checker → Checkpoint → Plan → Code → Grader. No code before checkpoint approval.
- **7 PRODUCT-GRADE Gates** (`@.claude/rubrics/_PRODUCT-GRADE-GATES.md`) on every PR.
- **Two-key flows for write-paths**: audit-FIRST, mutation-SECOND, compensating-log-on-failure. Established by Pre-H.0.0.B.
- **The `partner` custom claim does NOT exist yet.** Do NOT build rules that depend on it until Pre-H.0.0.D/E/F land.
- **`tofes-mecher` data is accountant-verified** — Haim has explicitly said this. Treat its sales_record state as authoritative for fee-paid amounts.

---

## Phase 0 — Meta Infrastructure ✅ DONE

The cross-cutting standards that every later PR rests on.

| # | Title | PR | Status | Date |
|---|---|---|---|---|
| 0.1 | `verifyClaims` read-only diagnostic | [#336](https://github.com/Chaim2045/law-office-system/pull/336) | ✅ merged | 2026-05-26 |
| 0.2 | META-6 — Engineering Bar (TypeScript infra) | [#337](https://github.com/Chaim2045/law-office-system/pull/337) | ✅ merged | 2026-05-27 |
| 0.3 | META-7 — Design Bar (UI standard) | [#338](https://github.com/Chaim2045/law-office-system/pull/338) | ✅ merged | 2026-05-28 |

**Phase 0 outcomes (referenced by Phase 1+):**
- `functions/src-ts/` TypeScript project. Strict mode, Zod, ts-jest, ESLint 0 errors enforced. Spec: `docs/ENGINEERING_BAR.md`.
- `apps/admin-panel/css/design-system.css` tokens + `prefers-reduced-motion` safety net + `ModalManager` requirement. Spec: `docs/DESIGN_BAR.md`.
- `functions/shared/logger.js` structured-logging shim with `firebase-functions/logger` underneath.
- `verifyClaims` callable: pure-read diagnostic of Auth custom claims vs `employees.role`. Used by every subsequent claim-related PR to validate the production state.

---

## Phase 1 — Foundational Safety (Pre-H.0.0) 🟡 IN PROGRESS (2/7)

Closes the security and audit gaps that block any commercial release. Every Phase 2 PR depends on these landing first.

| # | Title | PR | Status | Size | Depends on |
|---|---|---|---|---|---|
| A | `verifyClaims` callable | #336 | ✅ merged | (in Phase 0.1) | — |
| B | Admin-claim endpoint lockdown (TS port + dual-write + audit-first) | [#339](https://github.com/Chaim2045/law-office-system/pull/339) | ✅ merged | LARGE (2174 lines) | A |
| **C** | `logCriticalAction` audit primitive (throws on failure) | _next_ | ⏸️ pending | LIGHT (~50 lines) | B |
| **D** | `isPartner()` helper in `firestore.rules` + tests | _pending_ | ⏸️ pending | LIGHT | A (diagnostic data) |
| **E** | Claim shape consolidation — retire legacy `{admin:true}` field | _pending_ | ⏸️ pending | MEDIUM (data migration) | B + D + admin-panel auth.js:424 cleanup |
| **F** | `syncRoleClaims` utility (dryRun default, `--apply` flag) | _pending_ | ⏸️ pending | MEDIUM | C + D + E |
| **G** | `employee_costs/{email}` collection schema (CF-only access) | _pending_ | ⏸️ pending | MEDIUM | C |

**Phase 1 critical path:** C → D → E (sequential; each unblocks the next). F and G are independent of each other but both need C.

**Phase 1 exit criteria:**
- All admin-claim writers go through audited, gated, dual-shape-aware endpoints (B ✅).
- `logCriticalAction` is canonical (C); no future PR uses ad-hoc `writeAuditOrThrow`.
- `partner` custom claim infrastructure exists in `firestore.rules` + claim writers (D + F).
- Legacy `{admin:true}` claim shape is fully retired (E). One claim shape: `{role: <name>}`.
- Per-employee cost data has a PII-safe home with CF-only access (G).

Until Phase 1 exit, no Phase 2 PR begins.

---

## Phase 2 — H.0 → H.9 (The actual AI Management Layer) ⏸️ WAITING

Real feature delivery. Locked architectural decisions:

- **Cross-Project Bridge to `tofes-mecher`**: Pattern A (Cross-Project Cloud Function — live blocking) + Pattern D (BigQuery analytical export). Hybrid; not "pick one".
- **Cost stamping**: `costPerHourAtEntry` snapshot at time of write. Never re-derive from current `employee_costs` (historical entries don't re-price).
- **Profitability model**: "Plan" (Static, set at intake) + "Forecast" (Dynamic, updates as hours accrue). Both visible to admins.
- **Exception semantics**: "open debt to collect from client" — NOT "loss". Modal text + UX reframed.
- **Task budgeting**: hybrid rules — partner-assigned tasks require approval; employee-self-opened tasks auto-approve <3h, partner-approval ≥3h.
- **AI chat**: read-only queries. No write actions through AI. MCP integration. Claude-backed with prompt caching.

| # | Title | Size | Depends on |
|---|---|---|---|
| **H.0** | Foundations — project structure, secrets vault, env config | MEDIUM | Phase 1 complete |
| **H.1** | Cross-project bridge to `tofes-mecher` (Pattern A + D) | LARGE | H.0 |
| **H.2** | Cost foundation — `costPerHour` + `costPerHourAtEntry` snapshot | MEDIUM | H.0 + G |
| **H.3** | Profitability layer — Static Plan + Dynamic Forecast + dashboard | LARGE | H.2 |
| **H.4** | Task budgeting — hybrid rules + auto-approve <3h | MEDIUM | D + H.3 |
| **H.5** | PDF signature pipeline — AI presence check on sales_record PDFs | MEDIUM | H.1 |
| **H.6** | Cutover — replace manual client/service creation with gated flow | LARGE | H.5 + H.4 |
| **H.7** | Exception modal reframed — "open debt", not "loss" | SMALL | H.6 |
| **H.8** | AI chat in Admin Panel — Claude + MCP, read-only | LARGE | H.1 + H.3 (BigQuery surface) |
| **H.9** | Polish — UX, telemetry, runbooks, customer documentation | MEDIUM | All H.0–H.8 |

**Phase 2 staging assumption**: ~1 PR per week sustainable cadence. If pace exceeds that, deferred items go to Phase 3 (post-MVP).

---

## How to update this file

This file is the plan, not a changelog. The rules:

1. **Status flips** happen the moment a PR is merged. Update on the same session, same Lead Agent. Commit the status update as a follow-up commit to the merge.
2. **New rows** (added PR scope mid-phase) need explicit Haim approval first. No silent scope additions.
3. **Cross-phase reorderings** (e.g., promoting H.2 above H.1) require a documented rationale at the end of this file under "Plan revisions".
4. **PR links** added once the PR is opened (not at planning time — PRs are real artifacts, not placeholders).
5. **Size estimates** are LIGHT (≤80 lines) / MEDIUM (80-500 lines) / LARGE (>500 lines). Used by the Lead Agent to decide if `effort-scaler` is needed (LIGHT skips effort-scaler with declaration).

If you (Lead Agent or Haim) find this file out of date when starting a session, the FIRST action is to reconcile it with merged-PR state before doing anything else.

---

## What happens if the session crashes mid-PR?

This file is the recovery instruction.

1. New session starts → Lead Agent reads `CLAUDE.md` (auto-loaded) → sees `MASTER_PLAN.md` reference in the imports.
2. Lead Agent reads this file → finds the row marked "in progress" (if any).
3. Lead Agent runs `git status` + `git log --oneline -10` + checks for open PRs (`gh pr list`).
4. If a branch matches the in-progress row → resume from where work stopped (read the rubric file, re-run tests, check what's committed vs. pending).
5. If no branch matches → ask Haim "Were we in the middle of [in-progress row]? Status shows X, repo shows Y."

The Lead Agent is allowed to **trust this file** over their own session memory. If this file says "Pre-H.0.0.C in progress" and the Lead Agent has no recollection — believe the file.

---

## Related references

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

---

## Plan revisions

_Document any cross-phase reorderings or material plan changes here. Date + rationale required._

- **2026-05-28**: Initial plan committed. Based on accumulated Intent decisions from sessions through 2026-05-28 + Pre-H.0.0.B merge. Phase 0 fully done; Phase 1 at 2/7 (A + B). Phase 2 untouched.
