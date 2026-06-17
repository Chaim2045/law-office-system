# Rubric — PR-SEC-XSS-WHATSAPP-DIALOG

**Title:** Escape the user-controllable display name in the WhatsApp message dialog (stored-XSS fix)
**Branch:** security/whatsapp-dialog-xss-escape
**Base:** main
**Scope:** Output-encode the one user-controllable string (`userName`) interpolated into the modal HTML that `showDialog` injects via `document.body.insertAdjacentHTML(...)` inside `apps/admin-panel/js/managers/WhatsAppMessageDialog.js`, using a module-private `escapeHtml` helper byte-identical to `ReportGenerator.escapeHtml`. Adds a vitest unit suite proving the escaping at the real sink. Frontend-only, additive, no behavior change for benign data. Sibling of PR #382 (ReportGenerator) — the #382 rubric tracked this exact sink as the follow-up.

**Reachability:** `userName` is the employee display name carried on the `user:action` CustomEvent (`init()` ~line 290), falling back to `userEmail`. It was interpolated RAW into `<strong>${userName}</strong>` (line 72) of the `dialogHTML` string, which is written to the live DOM via `insertAdjacentHTML('beforeend', dialogHTML)` (line ~129/146 post-fix). A display name containing markup executes when an admin opens the WhatsApp dialog for that user.

## MUST criteria (block on FAIL)

### M1 — the line-72 sink is escaped
**Rule:** the `userName` interpolation in the `modal-subtitle` `<strong>` is wrapped in `escapeHtml(...)`.
**Evidence required:** `WhatsAppMessageDialog.js` — `<strong>${escapeHtml(userName)}</strong>`.

### M2 — the helper mirrors the canonical escaper, module-private, no new surface
**Rule:** a private `escapeHtml(text)` is added inside the IIFE, mapping `& < > " '` → entities and returning `''` for falsy — byte-identical to `ReportGenerator.escapeHtml` (ReportGenerator.js ~1666). It is NOT attached to `window`. No new dependency, no new collection/rule/claim.
**Evidence required:** the helper definition in the diff; no `window.` assignment of it; no import added.

### M3 — sink completeness (no other user-controllable HTML interpolation missed)
**Rule:** every other interpolation reaching the `insertAdjacentHTML` sink is a hardcoded constant and is correctly left untouched: `${template.id}` / `${template.icon}` / `${template.name}` (lines ~85-87, from the `MESSAGE_TEMPLATES` constant) and the `${templateId}` CSS selector at ~186 (derived from `dataset.template` = the constant id, not an HTML sink).
**Evidence required:** diff touches only line 72 + the helper; G7 security-access-expert confirmation that line 72 is the sole user-controllable HTML sink.

### M4 — out-of-scope sink left untouched (different file/sink)
**Rule:** the `showNotification` → `window.Notifications.show` path (lines ~243/246/251, different file `Notifications.js`) is NOT modified in this PR; it is tracked as a sibling follow-up.
**Evidence required:** diff does not touch `Notifications.js` or the `showNotification` calls.

### M5 — test proves the customer scenario
**Rule:** a vitest suite drives `showDialog(email, '<img src=x onerror=alert(1)>')` and asserts: no live `<img>` element is created in the injected modal; the subtitle renders the payload as inert text (`textContent` === the raw string); the serialized DOM contains the escaped form and never the live tag. A benign name renders unchanged.
**Evidence required:** `tests/unit/admin-panel/whatsapp-message-dialog-escaping.test.ts` green; `report-generator-escaping.test.ts` (sibling) still green.

### M6 — no new lint errors / no benign-data behavior change
**Rule:** 0 new ESLint errors on changed lines; pre-existing `no-console`/`no-alert` warnings on untouched lines are not introduced by this PR; benign display names render identically.
**Evidence required:** `eslint` on the two files = 0 errors; the only test-file warnings are the `any` window-read (matches the sibling test precedent).

## SHOULD criteria (warning on FAIL)

### S1 — G1 alignment for missing name
**Rule:** a missing/`undefined` `userName` renders empty (not the literal string `"undefined"`) — a minor G1 improvement over the pre-fix behavior.
**Evidence required:** test assertion (`textContent === ''`, body has no `"undefined"`).

### S2 — modal integrity preserved
**Rule:** the 4 hardcoded `MESSAGE_TEMPLATES` buttons still render after the fix (the escape did not break the modal body).
**Evidence required:** test assertion (`.template-btn` count === 4).

## Out of scope

- `Notifications.show` API-mismatch + any `Notifications.js` innerHTML audit (sibling sink, different file — tracked as a follow-up chip).
- Consolidating the duplicated `escapeHtml` copies (ReportGenerator + this file + others) into a shared util (tracked separately, as in #382).
- The other admin-panel innerHTML sinks (CSV-injection etc.) tracked from #382.

## Rollback

`git revert <commit>` + redeploy (code-only, frontend; Netlify auto-redeploys from main). No data migration, no schema change.

## Notes for grader

- security-access-expert verdict: **GO**. Line 72 `userName` is the sole user-controllable raw interpolation reaching the `insertAdjacentHTML` sink; `template.*`/`templateId` are hardcoded constants (non-exploitable). The 5-char `escapeHtml` is sufficient for the `<strong>` element-text context (no attribute/URL/JS/CSS context for `userName`); falsy→`''` is safe and a minor G1 improvement. Excluding the `Notifications.show` path is defensible (different file/sink + caller/callee API mismatch) but must be tracked.
- G6 = N/A (no data schema / API contract / route change — adding output-encoding does not change any contract).
- G7 = PASS (this IS the security fix; agent reviewed).
