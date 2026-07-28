# Rubric — Health-Map docs sync (Wave-1 close)

**Scope:** DOCS-ONLY. Lands the Wave-1 deliverables into `docs/` as the SSOT + records the cleanup track in MASTER_PLAN §14. No code, no rules, no schema, no data. Effort = LIGHT → self-graded (no separate grader/devils-advocate for a docs-only sync).

## MUST
- **M1** — `docs/HEALTH-MAP-2026-07.md` + `docs/PLAN-SYSTEM-HEALTH-TS-MIGRATION.md` added, verbatim from the Haim-reviewed scratchpad versions (map incl. the §9.5 Surfaced-Items Log; framing plan incl. §9 surfaced-item procedure + §7.1 delete-list safelist).
- **M2** — MASTER_PLAN §14 entry (2026-07-28) is factually accurate: Wave-1 map done; the 2 security "criticals" dissolved (Twilio deleted; 0 cleartext passwords via probe); WhatsApp retirement #474+#475 merged + 4 CFs deleted + deploy green; marked ORTHOGONAL to the H-sequence; "NOT a §15 bar revision".
- **M3** — Nothing outside these 3 doc files changed. No safelisted doc altered except the intended MASTER_PLAN §14 append (additive; existing entries untouched).

## PRODUCT-GRADE GATES
- **G1** N/A · **G2** PASS (`git revert` — docs-only) · **G3** N/A · **G4** N/A (no code) · **G5** N/A (internal docs, Hebrew+English as-authored) · **G6** N/A (additive docs, no contract) · **G7** N/A (no auth/PII/rules).

**VERDICT: PASS** (self-graded; docs-only, additive, verbatim copy + accurate §14 record).
