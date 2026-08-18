# BUILD SPEC — Prevent the wrong-service error at task-open (User App)

**Status:** ready to build · **Scope:** Phase 1 only · **App:** User App (`apps/user-app/`) · **Environment:** DEV (`main`) → PROD via promotion
**Grounded on:** the authoritative UX research (NN/g, GOV.UK, W3C COGA) + the live-flow map of `origin/main` HEAD `62900bf` (both this session). Every file:line below is from that verified map.

---

## 1. Intent (one line)

Make it **hard to open a task on the wrong service**, and make the chosen service **unmistakable at every moment** — because in this system the service is chosen ONCE at task-open and every later hour silently inherits it, so a wrong choice corrupts the client's billing forever with no signal.

## 2. The root, in one paragraph

A user thinks "log work for client X"; the system makes them pick service → (stage) → package. The wrong-service error is a **slip** (right intent, wrong object). Today: (a) two `hours` services on one client render the **identical card title `"תוכנית שעות"`** — indistinguishable; (b) **nothing** confirms or displays the chosen service; (c) the success toast names only the client, so a wrong pick looks correct. The service binds at task-open (`main.js:1138-1141` → `createBudgetTask` `main.js:1170`) and every later `addTimeToTask` (`main.js:2970`) sends **no service** — it inherits silently.

## 3. Scope

**IN (Phase 1, Path A — the daily budget-task flow in the User App):**
1. Service-card distinguishability fix.
2. Persistent "רושם על: [שירות]" indicator (recognition-over-recall).
3. One targeted confirmation at task-open submit, naming the service.
4. Success feedback that names the service.
5. Rewritten empty-state + microcopy on the flow.

**OUT / deferred (declared so no one silently expands):**
- **Quick Log (Path B)** — admin-only, not a User-App training surface; its own wrong-service risk is a separate data-integrity item, NOT this spec.
- The orientation layer / "trust-account" analogy explainer — separate later spec.
- Guided tours / coach-mark walkthroughs / any JS tour library (Shepherd/Driver) — deferred per the research (this audience skips tours).
- Any backend (`functions/`) change — this spec is client-side only. The backend already receives `serviceId`/`serviceType`/`parentServiceId`; we change what the user sees and confirms, not the contract.

## 4. Component specs (behaviour, not code)

### 4.1 — Service cards must be visibly distinct  *(the cheapest, highest-value fix)*
**Where:** `apps/user-app/js/modules/service-card-renderer.js:148` (the `'תוכנית שעות'` constant title) + `renderServiceCards` in `client-case-selector.js:1051-1119`.
**Change:** an `hours` service card's **title must be the service's real name** (`service.name`), shown prominently — not the generic `"תוכנית שעות"` constant. If `service.name` is empty, fall back to a distinguishing descriptor (e.g. `שירות שעות · נותרו X ש'`), never a bare constant shared by two cards.
**Rule:** on a client with ≥2 services, **no two cards may render an identical title.** That is the acceptance test.

### 4.2 — Persistent "רושם על: [שירות]" indicator
**Where it attaches (from the map):**
- After a service is chosen, the selected-service view `showSelectedServiceOnly` (`client-case-selector.js:1271`, markup `:1453`) — turn the "שירות נבחר" card into an unmistakable banner reading the live values from `getSelectedValues()` (`:1576`): `serviceName` (+ for legal_procedure, the stage, from `parentServiceId`/`serviceName`).
- On the time-entry popup for an existing task (`addTimeToTask`, `main.js:2970`) — read `task.serviceName`/`task.serviceId` (already stamped at creation, read back at `budget-tasks.js:446`) and show "רושם על: [שירות]" so a task opened on the wrong service is visible **every time** hours are logged to it.
**Behaviour:** always visible while the form is open (not a tooltip, not hover) — in the Hebrew reading path, right-aligned start. Recognition-over-recall (NN/g): the user never has to remember which service is active.

### 4.3 — Smart default (mostly already correct — formalise it)
- **Exactly one active service** → keep the existing silent auto-select (`client-case-selector.js:1142-1153`), BUT surface it in the 4.2 banner so "silent" becomes "shown" ("רושם על: [the only service]").
- **≥2 services** → **no pre-selection** (keep today's behaviour) — forcing a conscious choice is correct here; do NOT guess a default when the choice is genuinely ambiguous.

### 4.4 — One confirmation at task-open submit  *(the guard — and ONLY here)*
**Where:** the budget-task submit path — `main.js:1069` `getBudgetValues()` → before `main.js:1170` `createBudgetTask`.
**Behaviour:** a single confirmation dialog that **names the specific service and client and the consequence** — NOT a generic "אתה בטוח?". Fire it **only** on this action (task-open), never on routine saves, or habituation destroys it (NN/g "confirmation fatigue").
**Fires when:** the client has **≥2 services** (where the error is possible). For a single-service client (auto-selected) the confirmation is redundant noise — **skip it**; the 4.2 banner is enough.
**Buttons:** specific verbs, not OK/Cancel (Apple Alerts): primary `כן, פתח משימה על [שירות]`, secondary `חזרה לבחירה`.

### 4.5 — Success feedback names the service
**Where:** budget success — `main.js:1210` `msgs.success.created(...)` (today names client + description only).
**Change:** the toast must name the **service**: "המשימה נפתחה על שירות [X] של [לקוח]." So a wrong pick no longer produces a correct-looking success.

### 4.6 — Empty states + microcopy
**Where:** the flow's empty/instruction copy in `client-case-selector.js` (e.g. the case/service empty states `:799`, the required-field labels `:401`) and the service-selection hint.
**Change:** on the service step, a persistent low-contrast hint in the reading path (NN/g lower-literacy: put the cue in the line they plow): "ללקוח הזה יש כמה שירותים — בחר את זה שהעבודה שייכת אליו." Empty states instruct the next action, not just "ריק".

## 5. Exact Hebrew strings (the deliverable-critical part — 80% of success)

Write to the rule: one idea per sentence, important words first, no software jargon, name the consequence.

| Where | String |
|---|---|
| Service-step hint (≥2 services) | `ללקוח הזה יש כמה שירותים — בחר את זה שהעבודה שייכת אליו.` |
| Persistent banner | `רושם על: [שם השירות]` · for legal: `רושם על: [שם ההליך] · שלב [X]` |
| Confirmation title | `לפתוח משימה על השירות הזה?` |
| Confirmation body | `המשימה תיפתח על שירות "[X]" של [לקוח]. כל השעות שתרשום על המשימה ייכנסו לשירות הזה.` |
| Confirmation primary btn | `כן, פתח על "[X]"` |
| Confirmation secondary btn | `חזרה לבחירה` |
| Success toast | `המשימה נפתחה על שירות "[X]" של [לקוח].` |
| Banner on time-entry popup | `רושם שעות על: [שם השירות]` |

*(Bracketed values are interpolated; keep the service name inside quotes so it stands out in the RTL line. Test bidi rendering — service names + hours mix LTR digits into RTL.)*

## 6. Technical constraints

- **CSP-locked / self-hosted** → all of the above are **in-house components** (banner, confirmation dialog, hint text). NO external library, NO Shepherd/Driver for Phase 1. The confirmation is a standard in-house modal (the app already has modal patterns).
- **RTL/Hebrew** → banner and confirmation primary button at the reading-start (right); no "left/right" words in copy; bidi-isolate interpolated numerals.
- **Fields the choice lands in** (do not change): `hours`/`fixed` → `_serviceId`=service, `_parentServiceId`=''; `legal_procedure` → `_serviceId`=stage, `_parentServiceId`=parent service (`client-case-selector.js:1223-1236`). The banner/confirmation READ these; they do not alter the contract.
- **Where NOT to add friction:** single-service clients (auto-select) — banner only, no confirmation.

## 7. Acceptance criteria (how we know it's built right)

1. On a client with 2 `hours` services, the two service cards show **different titles** (real names) — never both `"תוכנית שעות"`.
2. After choosing a service, a **persistent "רושם על: [name]"** banner is visible until submit, and again on the time-entry popup of that task.
3. Opening a task on a **≥2-service** client shows a confirmation that **names the chosen service**; a single-service client shows **no** confirmation.
4. The success toast **names the service**, not just the client.
5. The confirmation does NOT fire on routine hour-logging (`addTimeToTask`) — only at task-open.
6. All new strings are Hebrew, RTL-clean, no `undefined`/`NaN`, no software jargon.
7. No backend/contract change; `serviceId`/`serviceType`/`parentServiceId` sent exactly as today.

## 8. Source anchors

- **Research (why):** NN/g Slips (constraints+defaults+recognition, not warnings); NN/g Confirmation Dialogs (rare + specific, or habituation kills it); NN/g Recognition-over-Recall; NN/g Empty States; GOV.UK Writing for UIs (one idea/sentence, front-load, no direction words); W3C COGA (clear words, feedback, findable help). Full cited report: scratchpad research deliverable, this session.
- **Live flow (where):** the map of `origin/main` `62900bf` — Path A submit `main.js:1069-1173`; service cards `client-case-selector.js:1051`, `service-card-renderer.js:137-199`; selected view `:1271`/`:1453`; values `:1576`; add-time `main.js:2970`; success `main.js:1210`.

## 9. Handoff note

This spec is Phase-1 only and touches **User-App frontend only**. It should run the normal Feature Protocol in the building session (investigation is already done — this spec IS it; go to checkpoint → code → grader → devils-advocate is N/A for a display/confirmation change with no rules/claims/schema, but the wrong-service-is-billing-critical framing means the grader must verify criteria 5 and 7 specifically). A separate later spec covers: the orientation "trust-account" explainer, and the Quick Log (admin) wrong-service risk.
