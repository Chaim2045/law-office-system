# Rubric — docs(master-plan): H.6.c closure sync (§11 status-flip)

**Scope:** Documentation-only. Sync `docs/MASTER_PLAN.md` (§8.8 banner + §8.9 H.7.b gate line + §14 dated plan-revision entry) with merged reality. No code, no behavior change.

**Type:** §14 plan-revision status sync (§11 "reconcile the stale plan FIRST" rule). NOT a §15 bar revision — no acceptance-criteria source changed.

## MUST

- **M1** — §8.8's `🟡 H.6.c — Signature-gate wiring IN PROGRESS` banner is replaced with a `✅ H.6.c — Signature-gate wiring DONE` banner. All 5 increments (c-1, c-2-backend, c-2-frontend, c-3, c-4, c-5) are marked merged, each with a working PR link + short SHA + a one-line "what it actually delivered" derived from the real merge diff (`git show <sha>`), not copied from the old plan text.
- **M2** — The banner states explicitly, with diff evidence, that the c-2 consistency gap described in the old banner (`listUnlinkedSalesRecords` keyed only on `sales_record_links`) was closed by #424 (`6aa680b`) — verified: the diff adds a `pending_signature_intents` id-set union into the exclusion set.
- **M3** — The banner states explicitly, with diff evidence, that the permanent `sales_record_links` write happens on release (c-3, #452 `5a53e70`) via `transaction.create()` — verified against `functions/src-ts/cutover/release-client-from-pending-signature.ts:421-437`.
- **M4** — The banner states what c-4 (#453 `2cd73a2`) actually shipped (enable-create-button + `lastModifiedBy` fix + intent cleanup) and explicitly records that the match-screen outcome-model decision from the old banner was **NOT** resolved by c-4 — verified absent from the #453 diff. No invented resolution.
- **M5** — The banner states the real status of the three H.5 live-egress engineering gates (cost-cap / never-persist-`reasoning` / identifier-wiring) per the #452 diff: identifier-wiring and never-persist-`reasoning` closed; cost/page-size cap beyond the existing 6MB byte ceiling still open (no page-count guard added).
- **M6** — §8.9's H.7.b deferral line is corrected: gate #2 no longer reads "H.6 landing `paidRevenue`" as a future/pending event. It now states H.6 is complete and did NOT deliver `paidRevenue`, citing `functions/src-ts/profitability/forecast-aggregation.ts:268` (`paidRevenue: null`), and reframes the dependency as a payments/invoicing source no phase currently owns. Gate #1 (OWN-*/single-owner session) is left untouched — not re-verified from git history in this PR.
- **M7** — §14 gains one new dated bullet (2026-07-19) recording: H.6.c closed (all 5 PRs + links), the `paidRevenue` finding and its effect on H.7.b's gate, that this is docs-only with no code/behavior change, the literal string `NOT a §15 bar revision (roadmap status sync, no acceptance-criteria source changed)`, and `⏭️ NEXT = H.8`.
- **M8** — Every factual claim in the diff is either backed by a `git show <sha>` diff actually read in this session, or is written as the literal Hebrew string `אין לי ודאות`. No invented status.
- **M9** — Only `docs/MASTER_PLAN.md` is modified. No code, no other doc, no rubric-adjacent file changed as part of the content edit (this rubric file itself is a new file, added alongside, not counted against M9).

## SHOULD

- **S1** — House style preserved: bilingual prose (Hebrew narrative + English identifiers/paths), blockquote banner style matching sibling H.6.a/H.6.b banners, dated §14 bullet style matching neighboring entries.
- **S2** — PR links use full GitHub URLs; commit SHAs match `git log` exactly (verified, not abbreviated-guessed).

## Out of scope

- No re-scoping of H.7.b (no new phase proposed, no acceptance criteria changed).
- No touching §8.10 (H.8) or §8.11 (H.9) content beyond the `⏭️ NEXT` pointer.
- No resolution of the match-screen outcome-model decision or the OWN-*/single-owner session status — both explicitly left open/unverified per the spec.

## Rollback

`git revert <merge-commit-sha>` — pure docs content, no data/schema/API surface, so a plain revert fully restores the prior banner/line/log text with no follow-up cleanup required.

## Self-grade

**VERDICT: PASS** — M1–M9 met; S1–S2 met. Docs-only; G1–G7 all N/A (no runtime, no data mutation, no UI string, no schema/API, no auth/PII). Every factual claim in the diff was independently verified against `git show` output for commits `20ae775`, `6aa680b`, `3219434`, `5a53e70`, `2cd73a2`, `aa4a6cd` and against the live `functions/src-ts/profitability/forecast-aggregation.ts:268` source, before being written. Two items were explicitly left unresolved rather than invented: the c-4 match-screen decision (verified absent from the diff, stated as still open) and gate #1's OWN-*/single-owner session status (left untouched per the spec's instruction, not re-verified from git history).
