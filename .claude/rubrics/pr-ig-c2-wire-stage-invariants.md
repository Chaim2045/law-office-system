# Rubric — PR-IG-C2: wire the stage-invariants detector into the nightly check (DETECT-ONLY)

**Branch:** `feat/ig-c2-wire-stage-invariants` · **Commits:** `fe98384`, `b7be1f5`
**App:** Functions · **Environment:** DEV (`main`) — **CI deploys `functions` on push to `main`, so this reaches the PRODUCTION backend.**
**Size:** MEDIUM · **High-stakes:** modifies a LIVE nightly `onSchedule` function whose output feeds a WhatsApp alert the office depends on. `devils-advocate` REQUIRED (ran — GO-WITH-CHANGES; both findings closed in `b7be1f5`).

---

## Intent

`functions/shared/stage-invariants.js` (merged inert via PR #468) is a pure, detect-only semantic detector for the failure class that went undetected for five months (an open task deducting from a closed stage). Nothing ran it. This PR runs it nightly, inside `dailyInvariantCheck`, in **strict DETECT-AND-COUNT-ONLY mode**: its findings are written to a NEW, separate `stageInvariants` field on the `system_health_checks` document and are deliberately kept OUT of the shared `discrepancies[]` array, the `status`, and the outbox/WhatsApp path.

**Why detect-only first:** an unknown discrepancy `type` in the shared `discrepancies[]` array renders as a JSON blob in the Hebrew WhatsApp message AND triggers the bot's hard-coded (wrong-for-this-class) repair-advice footer. So this PR must not let a stage finding reach the bot. Enforcement + a coordinated bot-side label/footer change are a deliberate later PR (must be atomic across both repos).

---

## MUST (all required for PASS)

| # | Criterion | Verification |
|---|---|---|
| M1 | **Stage findings NEVER enter `discrepancies[]`, NEVER change `status`, NEVER change `discrepanciesCount`, NEVER reach the outbox.** This is the load-bearing guarantee. | Adversary traced every line: findings go only to `stageInvariantDiscrepancies` → the isolated `stageInvariants` field; status block reads only the 8-check `discrepancies`; outbox trigger references only `status`/`discrepanciesCount`/`discrepancies`/`message`. A stage-only finding stays `status='PASS'` → no outbox write → zero WhatsApp traffic. Locked by a test. |
| M2 | The detector runs **inside the existing per-client `try`** — a throw becomes `clientsScanErrored++` → PARTIAL, never a full-run crash. Earlier clients' findings survive a later client's throw. | Verified call site + the detector is defensively pure (no constructible malformed input throws). |
| M3 | **No new Firestore read.** `clientEntries` is built from the already-read `timesheetSnapshot.docs.map(...)`; no `.get()`/`.where()` added in the loop. | Verified — ≈0 extra reads/night. |
| M4 | **Census/honesty invariant preserved** (a MUST from PR-IG-A1): `checked+errored+skippedConfig+emptySkipped === total`; `MAX_POSSIBLE_CHECKS` 8→9; per-client `checksExecuted` +2→+3, consistent everywhere the count is encoded (including the census comment, fixed `(8)`→`(9)`). | Test asserts arithmetic + `checksExecuted===9`. |
| M5 | **Findings are actionable** — each stage discrepancy carries `clientId`. | `push({ ...d, clientId })`. Closed the review MAJOR. |
| M6 | **No PII.** `clientId` ONLY — never `clientName` — on the new path; the `console.warn` is counts-only; the detector emits ids/dates/hours only. The repo is PUBLIC. | Test asserts `clientId` present AND `clientName` absent on every stage discrepancy. Strictly cleaner than the pre-existing main path. |
| M7 | **1 MiB document cap.** Written array capped at `MAX_EMBEDDED_DISCREPANCIES` (200); `discrepanciesCount` carries the true uncapped length. Mirrors the existing pattern. | Verified. |
| M8 | Tests genuinely guard the separation — the load-bearing test fails against pre-change code (the field doesn't exist) and would fail if a finding leaked into `discrepancies`/flipped status. | Verified not a guard-that-guards-nothing. |
| M9 | No regression. | `cd functions && npx jest` → 83 suites / 1477 tests. ESLint from repo root → 0 errors. |
| M10 | Scope — only `functions/scheduled/index.js` + the two test files. The outbox trigger and the bot are untouched. | `git diff --stat` = 3 files. |

## SHOULD

| # | Criterion |
|---|---|
| S1 | `mode: 'detect_only'` + `schemaVersion: 1` on the written `stageInvariants` object, so a future enforce-PR can branch on it and the shape can evolve. |
| S2 | A `console.warn('STAGE_INVARIANTS_DETECTED', {counts})` so the detect-only output is visible in Cloud Logging without opening Firestore. |

---

## PRODUCT-GRADE GATES

- **G1 — N/A.** No customer-visible surface; the audience is Cloud Logging + the `system_health_checks` doc. The whole PR is designed so nothing new reaches the WhatsApp group.
- **G2 — PASS.** `git revert b7be1f5 fe98384` + redeploy. No schema migration, no CF added/deleted, no rule, no scheduler-job change (same `onSchedule`).
- **G3 — PASS.** This PR IS monitoring — it activates a dormant integrity check. Success/finding is logged (`STAGE_INVARIANTS_DETECTED`, ids+counts) and written to the health-check document.
- **G4 — PASS.** The load-bearing test builds a client that produces a stage finding and asserts it lands in `stageInvariants`, is absent from `discrepancies[]`, keeps status PASS, carries `clientId`, and has no `clientName`. Proven to fail pre-change.
- **G5 — N/A.** No user-facing string.
- **G6 — PASS, behavioural change declared.** The nightly now runs a 9th check and writes a new `stageInvariants` field; `checksExecuted`/`MAX_POSSIBLE_CHECKS` move 8→9 (truthful-about-itself, per PR-IG-A1). No existing field/contract changed; status, `discrepancies`, `discrepanciesCount`, and the outbox are byte-behaviour-identical for the 8 checks. The external WhatsApp consumer sees nothing new — by design.
- **G7 — N/A.** No auth, rules, permissions changed. PII surface is strictly reduced vs the pre-existing path (clientId only).

## Reviews

**`devils-advocate` — GO-WITH-CHANGES.** Verified the separation guarantee unbreakable (findings cannot reach `discrepancies[]`, status, or the bot — by trace + 14 green tests). Two findings, both closed in `b7be1f5`: MAJOR (stage findings lacked `clientId` → un-locatable) and MINOR (stale `(8)` census comment). What it tried to break and could not: detector throw containment, partial-results-on-later-throw, new-read, census arithmetic, PII, the 1 MiB cap, and the test being a real guard.

VERDICT: PASS
