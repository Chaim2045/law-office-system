# Rubric — PR-SEC-C1 · Stored XSS via an unescaped client name (user-app)

**Scope:** `apps/user-app` — frontend, security. First PR of the PR-SEC-C program (the XSS class the
red-team sweep found). A reachability check (2026-08-11) confirmed a **live** stored XSS: a client's
`fullName` (persisted VERBATIM by `createClientFromSalesRecord` from the **authenticated** tofes sales
form — Haim-confirmed the form requires auth, so severity is **external-authenticated→lawyer**, HIGH,
not unauth) is rendered UNESCAPED in two user-app sinks every lawyer hits daily.

**Files:** `apps/user-app/js/modules/client-case-selector.js` (`fullName` :604, `caseTitle`/`caseNumber`
:821+:965, `currentStage` :816+:979, `id`/`phone` :607),
`apps/user-app/js/modules/case-creation/case-creation-dialog.js` (`highlightMatch`, reflected new-name,
`data-client-id`, `phone`), + 1 new vitest suite. **No** backend / CF / rules / data change.

**Completeness (devils-advocate GO-WITH-CHANGES, applied):** the first pass escaped only `fullName`. The
devils found `caseTitle` (`:965` selected-case info span, `:821` `<option>`) rendered RAW in the SAME two
files / same daily flow — and `caseTitle` = `sale.transactionType` is stored VERBATIM by the same writer
(`createClientFromSalesRecord`), i.e. the **same external-authenticated→lawyer vector** as `fullName`.
Also `client.phone`/`client.id`/`currentStage`. ALL now escaped; a final grep confirms only numeric
`hoursRemaining` + lookup ids remain raw (safe).

## MUST
- **M1 — client-case-selector sink escaped.** `:604` renders `${this.escapeHtml(client.fullName)}` (the
  file's existing local 5-entity escaper, matching the `safeText` SSOT). No raw `${client.fullName}` survives.
- **M2 — case-creation sinks escaped.** `highlightMatch` escapes the **no-match** return AND each segment
  (`before`/`match`/`after`) at assignment — the highlight `<span>` is the only markup, the name is inert
  text; the reflected typed `newName` (`:1757`) is escaped; the suggestion `data-client-id` is escaped
  (defense-in-depth). A local `escapeHtml` (5-entity, mirrors the sibling `ClientCaseSelector.escapeHtml`)
  is added to the class.
- **M3 — test.** Source lock (every sink wrapped; no raw interpolation survives) + behavioral mirror of the
  escape-then-wrap algorithm (a `<img onerror>` name → inert in both the no-match and matched paths; a
  benign match is still highlighted; a real `innerHTML` render yields no live `<img>`). Full `user-app`
  vitest suite green; ESLint 0 errors.

## Deferred (declared)
- **Backend writer-sanitize (defense-in-depth companion, separate PR).** `createClientFromSalesRecord`
  (`functions/src-ts/cutover/create-client-from-sales-record.ts` ~:231-233/:363-365) stores
  `clientName`/`caseTitle` unsanitized — unlike `createClient`, which wraps them in `sanitizeString`.
  Sanitizing at the writer closes the root and protects any future sink, but it is a **functions** change
  (own deploy + jest + rubric) — kept out of this frontend-only, Netlify-rollback-able PR.
- **C2** (Notifications.js primitive + the `updateTimesheetEntry` raw-`action` gap — a non-admin→admin
  escalation) and **C3** (the admin `username` sink + defense-in-depth batch) — sequenced after C1.
- The `data-client-name` attr at `:593` is read back via `dataset.clientName` and flows only to
  `searchInput.value` (a text property, not an HTML sink) — verified NOT an additional sink.

## Gate notes
- **G1/G5:** PASS — no customer-facing string changed; the name renders as inert text.
- **G2:** PASS — frontend-only, no data: `git revert <sha>` + supervised redeploy.
- **G3:** N/A — display-only; no write path touched.
- **G4:** PASS — source-lock + behavioral-mirror + DOM inert-render test.
- **G6:** PASS — no breaking change; escaping is display-only; benign names render unchanged (a name reaches
  these sinks raw, so a single escape is correct — no double-escape). No flow/nav/submission change
  (USER-APP BEHAVIORAL CHANGE RULE upheld).
- **G7 — SECURITY (this IS the fix):** stored-XSS output-encoding; **devils-advocate MANDATORY**.
