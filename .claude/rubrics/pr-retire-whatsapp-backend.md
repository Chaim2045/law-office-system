# Rubric — PR-2: Retire WhatsApp/Twilio backend surface

**Scope:** Cloud Functions (backend) only. Removes the obsolete WhatsApp-to-staff CFs + bot + Twilio dep. Twilio account is deleted → all 4 CFs are non-functional. PR-1 (#474) removed the admin frontend. `whatsappEnabled` field left INERT (no migration). Orphan log collections left in place (no data deletion).

**Context:** Decision by Haim 2026-07-28. Backend surface mapped by a read-only investigator. Merge AFTER PR-1.

## MUST

- **M1 — CFs + module removed.** `functions/whatsapp/index.js` (the 4 CFs: whatsappWebhook, sendBroadcastMessage, sendWhatsAppApprovalNotification, onApprovalCreated) deleted; the 4 exports removed from `functions/index.js`; `index.js` stays syntactically valid (`node --check` OK).
- **M2 — Bot removed, sole-consumer verified.** `functions/src/whatsapp-bot/WhatsAppBot.js` + `SessionManager.js` deleted ONLY after proving their sole live requirer was `whatsapp/index.js` (now deleted). No other live module requires either.
- **M3 — Dependency clean + CI-safe.** `twilio` removed from `functions/package.json` AND `functions/package-lock.json` reconciled (twilio subtree removed) so `npm ci` in CI stays green. No functions source relies on twilio's transitive deps (axios/dayjs/etc.) — verified none.
- **M4 — scheduled/ untouched.** No change under `functions/scheduled/` (its daily CFs write in-app notifications only, no Twilio). No other live CF/trigger/module affected.
- **M5 — Tests honest.** `whatsapp-bot-tz.test.js` deleted (bot-only). `quicklog-date-type.test.js`: Part A (quicklog date parsing, 11 tests) fully intact; only Part B (bot query/display, with its twilio+WhatsAppBot mocks) excised. `revoke-fee-agreement-acls.test.js`: WhatsAppBot.js removed from the fee-agreement-URL consumer AST-allowlist so the guard matches reality; the remaining consumers still guarded. No coverage weakened for surviving code.
- **M6 — Comment sync.** The cosmetic WhatsAppBot mentions in `get-fee-agreement-url.ts` are trimmed and the compiled `lib/.../get-fee-agreement-url.js` kept in sync (build not run).
- **M7 — No data deletion.** Orphan collections `whatsapp_approval_notifications` / `whatsapp_bot_interactions` left in place (no code reads them back; data cleanup out of scope).

## SHOULD

- **S1** — Residual grep clean except the documented `TWILIO_*` PII-guard example comment in `shared/logger.js:21` (illustrative, no code path).
- **S2** — PR body carries the supervised CF-deletion checklist (the 4 `firebase functions:delete` names) as a merge prerequisite.

## PRODUCT-GRADE GATES

- **G1 (errors):** N/A — removal only.
- **G2 (rollback):** `git revert <sha>` + redeploy re-creates the (non-functional) CFs; supervised `firebase functions:delete` was the forward step. Trivial code-level revert.
- **G3 (monitoring):** N/A — removes write paths (audit_log broadcast entry + whatsapp_* logs), adds none.
- **G4 (test):** jest not runnable in worktree (partial node_modules) → CI runs the functions suites (quicklog-date-type, revoke-fee-agreement-acls) — CI-green is the gate. Edits `node --check` OK + structurally consistent.
- **G5 (Hebrew):** N/A — backend, no customer-facing strings changed.
- **G6 (breaking change):** DECLARED — removes 4 DEPLOYED CFs (all non-functional; Twilio deleted). `onApprovalCreated` was a live trigger self-aborting to no-op; deleting stops wasted invocations. Migration = supervised `firebase functions:delete whatsappWebhook sendBroadcastMessage sendWhatsAppApprovalNotification onApprovalCreated --region us-central1` (CI deploy ABORTS on source-removed CFs — documented lesson). No live feature depends on these (the bot was reachable only via the now-dead webhook).
- **G7 (security):** PASS — net SECURITY IMPROVEMENT: removes an unauthenticated public webhook (`whatsappWebhook`, which lacked Twilio-signature validation) + a write path into core business collections (the bot wrote pending_task_approvals/budget_tasks/timesheet_entries/clients/employees). No auth/rules/claims/PII handling changed.

## Anti-premature-closure

- CI must be green (esp. `npm ci` + the functions jest suites) before merge — do NOT claim tests pass locally.
- MERGE ORDER: PR-1 (#474) FIRST, then this PR-2. Merging PR-2 first would delete the CFs the still-deployed admin dialog calls.
- The supervised `firebase functions:delete` ×4 is REQUIRED before/with the deploy or CI deploy aborts.
