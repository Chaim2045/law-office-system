# Rubric — PR: wrong-service prevention guardrails (User App, Phase 1)

**Branch:** `feat/user-app-wrong-service-guard` · **Commits:** `aaf6006`, `3d9a7fd` · **Target:** `main` (DEV)
**App:** User App (`apps/user-app/`) · **Size:** MEDIUM · **Nature:** billing-critical UX guard, display + confirmation only, zero backend contract change.

---

## Intent

A user thinks "log work for client X"; the system makes them pick a **service** (a client may have several — each is a separate billing pocket). Picking the **wrong service** corrupts the client's billing, and today nothing prevents it: two `hours` services render the identical card title `"תוכנית שעות"`, no confirmation, no persistent "which service" indicator, and the success toast names only the client. The service is chosen ONCE at task-open and every later hour silently inherits it. This PR (Phase 1) makes the wrong choice hard to make and the chosen service unmistakable — grounded in an authoritative UX-research pass (NN/g slips + confirmation-dialogs + recognition-over-recall; GOV.UK plain-language; W3C COGA) and a verified live-flow map. **User-App frontend only; no backend, no rule, no contract change.**

## MUST (all required for PASS)

| # | Criterion | Verification |
|---|---|---|
| M1 | On a client with ≥2 `hours` services, no two selection cards share an identical title — each shows its real `service.name`. | `service-card-renderer.js:148` title = `service.name` (fallback distinguishing descriptor); generic constant moved to subtitle. |
| M2 | A persistent "רושם על: [שירות]" indicator is shown after selection and on the time-entry popup, and is **suppressed** (no dangling label) when no name exists. | `client-case-selector.js` selected-view banner + `dialogs.js` time-entry banner; empty-name suppression verified. |
| M3 | Exactly ONE confirmation, at task-open, **only when the client has ≥2 selectable options**, naming the specific service. **Never** on routine hour-logging (`addTimeToTask`). | `main.js addBudgetTask` awaits `window.showConfirm`; not present in `submitTimeEntry`/`addTimeToTask`. Adversarial review confirmed. |
| M4 | The confirmation fires **iff the user sees ≥2 selectable cards** — no missed guard, no spurious 1-card confirmation. | `countSelectableServices` (`service-count.js`) mirrors `renderServiceCards`' render gate; reviewer verified count == rendered cards on every shape. |
| M5 | The gating logic is **tested** with hard expected values, and the test is load-bearing (fails if the count breaks). | `tests/unit/user-app/service-count.test.ts` — 14 tests, all shapes; red→green demonstrated against a deliberate break; I re-ran 14/14 green. |
| M6 | Success toast names the **service**, not just the client. | `notification-messages.js tasks.success.created(...)` gains `serviceName`, opens with the §5 string. |
| M7 | **No backend / contract change.** Callables still receive `serviceId`/`serviceType`/`parentServiceId` unchanged; the title/banner/confirmation are display only. | `git diff --stat` — no `functions/`; fields passed unchanged (`main.js`). |
| M8 | Interpolated values (service/client name) are escaped at every sink — a service named with HTML cannot inject. | reviewer traced `safeText`/`sanitizeHTML`/`escapeHtml` on banner + confirmation. |
| M9 | The confirmation cannot break the submit: clean cancel (no half-created task), safe degrade if `showConfirm` missing, single create on confirm. | reviewer traced the `try/finally` lock + idempotency key; no double-create, no stuck state. |
| M10 | Hebrew strings are verbatim from the approved spec §5; no `undefined`/`NaN` reaches the user (fallbacks everywhere). | grep the shipped strings vs the spec. |
| M11 | No regression, 0 new ESLint errors. | root vitest 906/906 (+14 new), user-app 299/299; ESLint 0 errors (Finding 3 removed 3 warnings). |

## SHOULD

| # | Criterion |
|---|---|
| S1 | The count logic routes through the house `window.BUSINESS_RULES` predicates when present; the inline fallback (User App doesn't wire the adapter) is `eslint-disable`d with a one-line reason, not a silent violation. |
| S2 | The spec is committed alongside the code (`docs/SPEC-user-app-wrong-service-prevention.md`) so the decisions and their sources survive. |

---

## PRODUCT-GRADE GATES

- **G1 — PASS.** New user-visible strings are Hebrew, name the consequence, no stack trace / `undefined` / raw error. Banner suppresses rather than showing a dangling label.
- **G2 — PASS.** Rollback: `git revert 3d9a7fd aaf6006` + redeploy. Frontend only — no schema, no CF, no rule, no scheduler.
- **G3 — N/A.** No data mutation added; the confirmation gates an existing write, adds no new write path.
- **G4 — PASS.** The gating logic (the piece that decides whether the guard fires) has a load-bearing unit test proven to fail on a break; the customer scenario (≥2 services → confirmation names the service) is the acceptance walk-through.
- **G5 — PASS.** All new user-facing strings Hebrew, RTL, verbatim from the spec.
- **G6 — PASS, behavioural change declared.** New surfaces: distinct card titles, a persistent "רושם על" banner, a confirmation at task-open for multi-service clients, a service-named success toast. No data/contract/route change; the confirmation adds friction ONLY on the ambiguous case, deliberately not on single-service or routine hour-logging (per the research: rare + specific, or habituation kills it).
- **G7 — N/A.** No auth, rules, permissions, or PII surface touched. Injection sinks verified escaped.

## Reviews

**Adversarial review — GO-WITH-CHANGES**, no blocker. Verified: the confirmation fires exactly when the user sees ≥2 selectable cards (count == rendered, and more correct than the renderer's own internal counter); cannot break the submit; never on `addTimeToTask`; no backend change; every injection sink escaped. Its four findings — no test on the gating logic (the important one), a cosmetic title inconsistency, an inline-classification house-rule violation, and a banner empty-name fallback — are all closed in `3d9a7fd`, with the gating logic now extracted to a pure tested helper.

VERDICT: PASS
