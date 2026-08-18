# Rubric — PR-SEC-C2b · Sanitize timesheet `action` on write (stored-XSS root)

**Scope:** `functions/` — backend security. The root-cause companion to PR-SEC-C2 (#540). The create
paths sanitize the timesheet `action` (`timesheet/index.js:477` createQuickLogEntry, `:1078`
createTimesheetEntry_v2), but three writes stored it RAW: `:1562`/`:1585` (`updateTimesheetEntry` — the
entry write + the `task.timeEntries` mirror) and `:1193` (the audit-event payload inside
createTimesheetEntry_v2). A non-admin could persist `<img onerror=…>` in their OWN entry's `action`; an
admin then rendered it (the delete-hour confirm — the live sink already output-encoded in #540). This PR
closes the **root** so the payload never reaches storage.

**Files:** `functions/timesheet/index.js` (3 sanitize wraps + a type guard + a gating fix),
`functions/addTimeToTask_v2.js` (the 4th raw create path), + the characterization suite
`functions/tests/timesheet-update-entry-payload.test.js` (extended). **No** rules / schema / new-field /
API-shape change.

**devils-advocate GO-WITH-CHANGES (all applied):** the first commit sanitized only the 3
`timesheet/index.js` sites and wrongly claimed "closes the root." The devils found (1) a **4th** live raw
create path — `addTimeToTask_v2.js:706` wrote `timesheet_entries.action` raw; (2) a **type bypass** —
`updateTimesheetEntry` had no `typeof === 'string'` guard, and `sanitizeString` passes non-strings through;
(3) an entry-doc/mirror **gating asymmetry**. All three fixed.

## MUST
- **M1 — every raw `action` write sanitized (4 sites).** `timesheet/index.js`: `:1193`
  `sanitizeString(data.action)` (create audit event), the update entry write `sanitizeString(data.action)`,
  the task-mirror (see M1c). `addTimeToTask_v2.js:706`: `sanitizeString(data.description || taskData.description)`
  using **that file's local sanitizeString** (strips `< >` AND coerces non-string → `''`, so it is itself
  bypass-safe; in-file consistency with its description handling). NOTE — a deliberate form difference:
  timesheet paths **escape** (`<`→`&lt;`), addTimeToTask **strips**; both render inert at the (already-escaped)
  sinks, and harmonizing the two sanitizers is an optional non-security cleanup, not this PR.
- **M1b — type guard (no bypass).** `updateTimesheetEntry` now rejects a non-string `action`
  (`if (data.action !== undefined && typeof data.action !== 'string') throw invalid-argument`) before the
  sanitize sites — mirrors the create-path guard, keeps `action` optional on update.
- **M1c — entry-doc/mirror consistency.** The task-mirror write is
  `data.action !== undefined ? sanitizeString(data.action) : entry.action` — matching the entry-doc's
  `if (data.action !== undefined)` gating, so the two representations never diverge on an unrelated edit.
- **M1-import.** `sanitizeString` is already imported in `timesheet/index.js:9`; `addTimeToTask_v2.js` uses its own local one.
- **M2 — safe in a hazardous file (verified).** `sanitizeString` (`shared/validators.js:41`) escapes ONLY
  `<`/`>` (NOT `&`) and returns non-strings as-is. Two consequences, both required:
  (a) **Idempotent** — re-storing an already-sanitized `entry.action` (holds `&lt;`, no literal `<`) is a
  no-op → **no double-encoding drift**; (b) **null-safe** — never throws on `undefined`/`null`/number.
  CREATE path: unchanged (already sanitized). UPDATE path: `action` with `<`/`>` is now stored escaped
  (**declared behavioral hardening** — no change for normal Hebrew descriptions). DELETE: N/A (no action write).
  Existing data: old raw entries are corrected on their next update (not retroactive; the frontend sinks in
  #539/#540 already render any residual raw value inert). No aggregate/hours impact (`action` is a description).
- **M3 — test proves it.** The characterization suite flips its file-wide pass-through `sanitizeString`
  mock to the REAL escape behaviour and asserts: a malicious `action` is escaped in the entry write AND the
  task-mirror; the update routes `action` through `sanitizeString` (calling-site proof); an already-sanitized
  fallback is a no-op (idempotency). Full `functions` jest suite green (1641); ESLint 0.

## Gate notes
- **G1:** N/A — no customer error path; server-side data hygiene.
- **G2:** PASS — `git revert <sha>` + supervised functions redeploy (code-only; idempotent, so no data cleanup needed).
- **G3 — data-mutating:** PASS — write path; the existing success `console.log` is preserved (now logging the
  sanitized value); no new unlogged write introduced.
- **G5:** N/A — no customer-facing string added.
- **G6 — behavioral change (DECLARED, not breaking):** on update, `action` containing `<`/`>` is now stored
  escaped to match the create paths. No schema/contract/field-shape change (`action` stays a string); idempotent;
  backward-compatible (old data fixed on next write, and already rendered inert by the #539/#540 sink escaping).
- **G7 — SECURITY (this IS the root fix):** closes the stored-XSS write gap. **devils-advocate MANDATORY** (backend write path).

## Note
The frontend sink (Notifications.confirm, #540) already stops the live exploit; devils-advocate verified every
site rendering the stored `action` is already escaped. This PR is the **defense-in-depth root** so the payload
is never stored, protecting any future sink.
