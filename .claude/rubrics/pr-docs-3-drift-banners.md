# Rubric — PR-DOCS-3: doc-drift banners + retire dead-feature docs (גל-3ד, part 3 — CLOSES the wave)

**Scope:** DOCS-ONLY. Closes גל-3ד. Handles the 5 docs that mention dismantled features, split by a read-only investigation (verified against current code):
- **ARCHIVE (3 wholly-dead-feature docs → `git mv` to `docs/archive/`):** `FUNCTION_MONITOR_README.md`, `ANALYTICS_DASHBOARD_GUIDE.md` (both docs of the retired function-monitor POC — S1 #477 + S3 #479), `WHATSAPP-PDF-UPLOAD-FEATURE.md` (WhatsApp/Twilio, removed #474/#475). Nothing they document still exists → archive, don't banner.
- **BANNER (2 live reference docs):** `SYSTEM_MAP.md` + `SYSTEM_STATUS.md` — overwhelmingly describe live state; only WhatsApp/Twilio/function-monitor lines are stale → a scoped staleness banner + inline `[הוסר]` marks, NOT archive.

**Haim approved the SYSTEM_STATUS edit explicitly** (CLAUDE.md SYSTEM_STATUS RULE — what-changed: scoped WhatsApp/Twilio staleness banner + 3 line marks; system-impact: zero, docs-only; state: DEV=PROD, feature already gone). No devils-advocate (pure docs, no rules/schema/code).

## MUST
- **M1 — 3 archives are `git mv` R100 + 2 banner edits + docs.** `git diff --cached --name-status` = 3 `R100` (the dead docs → docs/archive/) + `M` on `SYSTEM_MAP.md`, `SYSTEM_STATUS.md`, `docs/archive/README.md`, `docs/HEALTH-MAP-2026-07.md` + `A` on this rubric. NO code/CI/rules/*.js/*.ts/*.html file touched.
- **M2 — the 3 archived docs are wholly-dead (verified).** 0 non-`.md` code reference to `FunctionMonitorHelper` / `function-monitor-analytics` / `whatsappWebhook` / `handleMediaMessage` (the features they document are deleted). `function_monitor_logs` survives only as a `firestore.rules if false` lockdown + its deny-test. Archiving (not bannering) is correct — there is no live doc to keep current.
- **M3 — SYSTEM_MAP banner is ADDITIVE + accurate.** A new correction paragraph appended after the existing H.4 correction (the file already carries a STALE-SNAPSHOT banner + an approveTaskBudget correction). It marks the 4 WhatsApp CFs (`whatsappWebhook`/`sendBroadcastMessage`/`sendWhatsAppApprovalNotification`/`onApprovalCreated`) + the function-monitor rows + the 3 orphaned collections as HISTORICAL. No existing inventory row deleted (the file stays a point-in-time snapshot; the banner reframes it). **ADMIN SAFETY:** display/doc-only — SYSTEM_MAP is a reference inventory, not a live count/filter; nothing computes off it.
- **M4 — SYSTEM_STATUS banner is SCOPED + Haim-approved + changelog-safe.** A scoped staleness banner after the header, + 3 inline `[הוסר]`/`[לא רלוונטי]` marks on exactly the 3 stale current-state lines (the `whatsapp/` arch-tree row, the `SMS Twilio` debt row, the `dailyInvariantCheck — WhatsApp התראות` debt row). The HISTORICAL changelog entries (#134/#164 that legitimately record past WhatsApp/function-monitor work) are UNTOUCHED — they are correct as history. The `dailyInvariantCheck` mark clarifies the JOB itself is still live (only its WhatsApp-alert path is gone). **CLAUDE.md SYSTEM_STATUS RULE satisfied:** Haim's explicit approval obtained at checkpoint before the edit.
- **M5 — no live reference breaks from the 3 moves.** The only inbound refs to the 3 archived docs are backlog/tracking docs (HEALTH-MAP, the S3 rubric, PR-DOCS rubrics) — no live code/CLAUDE/MASTER_PLAN/enforced-rubric link. `.claude/WHATSAPP-PDF-UPLOAD-FEATURE.md` moving out of `.claude/` breaks nothing (no loader reads it).
- **M6 — archive README indexes the 3 (a new §6).** `docs/archive/README.md` gains a §6 "retired-feature docs" table (feature + why-dead + read-instead) for the 3 arrivals. Additive.
- **M7 — exec-log maintained (+ CLOSES גל-3ד).** `docs/HEALTH-MAP` exec-log gains the PR-DOCS-3 row (marking גל-3ד CLOSED) + flips PR-DOCS-2 #494 to ✅ merged. Additive.

## PRODUCT-GRADE GATES
- **G1/G3/G4/G7** N/A — docs move + doc content edits; no customer path, data, auth/PII/rules.
- **G2 (rollback):** `git revert <sha>` restores the 3 files to their old paths + reverts the 2 banners. Trivial.
- **G5 (Hebrew):** the banners are Hebrew (SYSTEM_STATUS is a Hebrew doc; SYSTEM_MAP correction is English matching the file). Doc-only, not customer-facing UI.
- **G6** N/A — no data schema / API / route / behavior contract changes; the docs describe removed features, the running system already reflects the removal.

## Anti-premature-closure
- CI green — moving unreferenced markdown + editing 2 reference docs cannot break a build/test/deploy path; verified 0 live code references.
- **The BANNER-vs-ARCHIVE split is evidence-based, not assumed:** each of the 3 archived docs was grep-verified to document a feature with 0 surviving code; each of the 2 bannered docs was verified to still describe substantial live system → kept in place.
- **🏁 CLOSES גל-3ד (docs):** PR-DOCS-1 (#493, deletions) + PR-DOCS-2 (#494, archive consolidation) + PR-DOCS-3 (this — drift banners + retire dead-feature docs). **NEXT wave = גל-3ה (TS migration)** — the final wave (order: logger → business-rules → validators → hours-core).
