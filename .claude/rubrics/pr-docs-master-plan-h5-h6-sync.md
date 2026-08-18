# Rubric — PR-DOCS-MASTER-PLAN-H5-H6-SYNC

**Title:** docs(master-plan): reconcile §8.7/§8.8 — H.5 (#378) + H.6.a (#381) were merged but unrecorded; flag the H.6 open decisions
**App:** Docs / Full System · **Env:** N/A (canonical plan file) · **Docs-only, insert/append-only**

**Scope:** The §11 "if the file is out of date, reconcile FIRST" rule. Add (a) a DONE banner to §8.7 (H.5) recording [PR #378](https://github.com/Chaim2045/law-office-system/pull/378) + correcting the stale `verifySignaturePresence(pdfStorageUrl)` signature to the shipped `{clientId, agreementId, collection?}` (PDF lives in law-office `feeAgreements[]`, not the tofes sale); (b) a status banner to §8.8 (H.6) recording H.6.a [#381](https://github.com/Chaim2045/law-office-system/pull/381) + PR-SEC-2 [#380](https://github.com/Chaim2045/law-office-system/pull/380), and the 5 open decisions/gates for the remaining H.6 increments (🔴 the DPA/PII-egress gate first); (c) one dated §14 plan-revision entry covering the DataManager #388 sub-track closure + this reconciliation. **Pure documentation — no code, data, schema, rule, UI, or behavior change.**

## MUST (block on FAIL)
- **M1** — accurate: PR/commit references match git/origin-main — H.5 = #378 (`6b961f1`), H.6.a = #381 (`251e459`), PR-SEC-2 = #380 (`4f4dfa1`), DataManager = #388 (`be3c986`). No overclaim.
- **M2** — insert/append-only: NO existing MASTER_PLAN content removed; the §8.7/§8.8 original Goal/Sub-tasks are RETAINED (marked superseded where the shipped reality differs, not deleted); exactly one new §14 entry appended.
- **M3** — the §8.7 signature-drift correction is correct: input is `{ clientId, agreementId, collection? }` (NOT `pdfStorageUrl`); the signed PDF is in the law-office `feeAgreements[]` array, NOT on the tofes `sales_record`.
- **M4** — the §8.8 open-decisions match the investigation: 🔴 DPA/PII-egress gate (Haim's legal call) is THE blocker on the live increment; cost-cap, never-persist-`reasoning`, identifier-wiring, `passed`-gate-contract all present.
- **M5** — classification correct: filed as a §14 plan-revision (status flips of merged PRs + reconciliation), explicitly NOT a §15 bar revision (no acceptance-criteria source from §2.0.1 touched).
- **M6** — honesty: the §14 entry records that the alleged H.5 `output_config.format`/`parsed_output` "runtime bug" was adversarially VERIFIED FALSE (it is the correct current Anthropic structured-outputs API) — no overstatement of risk.

## Rollback
`git revert <merge-commit>` — pure docs, no runtime impact.

## PRODUCT-GRADE GATES
- **G1 N/A** — docs-only, no customer-facing code path.
- **G2 PASS** — `git revert` rollback.
- **G3 N/A** — no data mutation.
- **G4 N/A** — docs-only; accuracy verified against git (`gh pr list`/`git log`) + the canonical claude-api reference, not a code path.
- **G5 N/A** — internal planning doc (English/Hebrew mix is the established MASTER_PLAN convention; not customer-facing).
- **G6 N/A** — no contract/schema/route/behavior change.
- **G7 N/A** — no auth/PII/permissions/code touched (documents a security/egress posture, does not change security code).

VERDICT: PASS
