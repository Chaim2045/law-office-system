# Rubric — docs(master-plan): H.6.c kickoff sync (Option B locked + c-1 merged)

**Scope:** Documentation-only. Sync `docs/MASTER_PLAN.md` (§8.8 banner + §14 plan-revision entry) with merged reality. No code, no behavior change.

**Type:** §14 plan-revision status sync (§11 "reconcile the stale plan on merge"). NOT a §15 bar revision.

## MUST

- **M1** — §8.8 gains an H.6.c banner recording: Option B (two-phase `pending_signature`) locked over Option A; the 5-increment decomposition (c-1…c-5); c-1 MERGED (#422, `20ae775`).
- **M2** — The banner is **proportional** to the sibling H.6.a/H.6.b banners (one blockquote paragraph) — no disproportionate "spotlight" weight, and c-2…c-5 are marked "not yet built / each with its own Intent+checkpoint" so they are not read as locked.
- **M3** — The c-1 reader-side seam (`listUnlinkedSalesRecords` still keys on `sales_record_links` while c-1 moved that write to c-3) is recorded honestly and scoped as a c-2 fix. Severity accurate: consistency gap, NOT a duplicate-create (the `pending_signature_intents` idempotency holds).
- **M4** — The open product decision (match-screen outcome model) is marked deferred to the c-4 checkpoint, incl. the `idNumber`-coverage/backfill dependency.
- **M5** — A §14 entry mirrors the above and is dated + labelled "NOT a §15 bar revision".
- **M6** — Every factual claim grounded: c-1 seam verified against `create-client-from-sales-record.ts` + `list-unlinked-sales-records.ts`. `idNumber` coverage from the plan's own §8.2.5 probe.

## SHOULD

- **S1** — House style preserved (English prose + Hebrew UI terms; blockquote banner; dated §14 bullet).
- **S2** — Links use full GitHub URLs.

## Self-grade

**VERDICT: PASS** — M1–M6 met; S1–S2 met. Docs-only; G1–G7 all N/A (no runtime, no data mutation, no UI string, no schema/API, no auth/PII). c-1 seam claim independently verified against source before writing. Text pre-approved verbatim by Haim (Product Owner) at the 2026-07-02 checkpoint, including the proportionality constraint (M2).
