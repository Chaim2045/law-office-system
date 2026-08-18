# Rubric — PR-1: Retire WhatsApp/Twilio admin surface (frontend)

**Scope:** Admin Panel (frontend only). Remove the obsolete WhatsApp-to-staff feature (Twilio account deleted → feature non-functional). Backend CFs are a separate PR-2. `whatsappEnabled` field left INERT (no data migration). `phone`/`phoneNumber` are SHARED — must be preserved.

**Context:** Decision by Haim 2026-07-28 ("WhatsApp-לצוות מיושן לחלוטין"). Surface mapped by 3 read-only investigators. Twilio dead → nothing here is functional today.

## MUST

- **M1 — Full UI removal.** WhatsAppMessageDialog.js + BroadcastManager.js deleted; index.html script+init removed; UserForm whatsappEnabled toggle (block+listener+populate+getFormData+both CF payloads) removed; UsersTable per-user whatsapp action removed; UsersActions `whatsapp` case removed; DataManager whatsappEnabled normalization removed. No residual LIVE reference to a removed symbol.
- **M2 — Shared assets preserved.** `.toggle-label` KEPT in components.css (SMSManagement.js:64/577 depends on it). `phone` AND `phoneNumber` fields KEPT everywhere (phone underpins OTP auth + profile-completeness — a shared field).
- **M3 — User-management modal integrity (admin-critical).** Removing the toggle leaves the create/edit user modal layout intact; no other field, validation, or column affected. No admin count/filter/sort touches whatsappEnabled (confirmed).
- **M4 — Payload contract.** createUser/updateUser CF payloads simply OMIT `whatsappEnabled`; no other payload key added/renamed/removed. (Backend tolerance of the missing field is PR-2's concern; frontend stopping-to-send is safe.)
- **M5 — Tests honest.** `whatsapp-message-dialog-escaping.test.ts` deleted (imported the deleted dialog). `escapehtml-ssot-pr2-routing.test.ts` edited to drop ONLY the WhatsAppMessageDialog rows + adjust the count assertion to the true new count — no unrelated coverage weakened, no assertion bypassed. `messaging-decommission-removed.test.ts` untouched + still asserts the actions column survives.
- **M6 — CSS surgical.** Only whatsapp/broadcast-named selectors + the WhatsApp toggle-switch block deleted. No shared/generic selector removed that a live page uses. Braces balanced.
- **M7 — Cache-bust.** `?v=` bumped (date-descriptor convention) on the changed admin includes so PROD picks up the change.

## SHOULD

- **S1** — messaging-modals.css deleted only after confirming zero `<link>` references (whatsapp-only dead CSS).
- **S2** — Dead-but-harmless generic CSS left under the former broadcast section (non-whatsapp-named utilities) is acceptable to leave for a later sweep rather than risk over-deletion — note it.
- **S3** — Residual grep clean except documented false-positives (BroadcastChannel tab-sync in auth.js/idle-timeout; the `// WhatsApp Bot field` comment on the shared `phone`).

## PRODUCT-GRADE GATES

- **G1 (errors):** N/A — removal only; no new customer-facing code path.
- **G2 (rollback):** `git revert <sha>` + redeploy (frontend static) — pure code removal, trivial.
- **G3 (monitoring):** N/A — no data-mutating path added; removes write paths, adds none.
- **G4 (test):** existing admin tests adjusted + CI runs full suite; the retired surface had test coverage that is removed/trimmed alongside its code.
- **G5 (Hebrew):** N/A — removing UI strings, not adding.
- **G6 (breaking change):** DECLARED — removes the admin WhatsApp toggle + per-user send + broadcast (all already non-functional; Twilio deleted). Migration: `whatsappEnabled` field left INERT on existing employee docs (no reader remains after PR-2); admins lose a dead toggle (intended). No schema/route/contract consumed by another live feature is changed.
- **G7 (security):** touches the user-management form + DataManager but changes NO auth, rules, claims, or PII handling. Net effect REDUCES attack surface (removes a public webhook + a Twilio send path in PR-2). No security-agent gate needed for the frontend removal.

## Anti-premature-closure

- vitest not runnable in the worktree (partial node_modules) — CI must run the admin-panel suite green before merge. Do NOT claim tests pass locally.
- PR-2 (backend CF deletion + supervised `firebase functions:delete` ×4) is REQUIRED to finish the retirement; PR-1 alone leaves 4 dead CFs deployed (harmless, non-functional) until PR-2.
