# RUBRIC — PR-0: read-only baseline measurement of hours capacity

**Scope:** one script + offline tests. **Env:** DEV. **Behaviour change: none.**
**Branch:** `investigate/hours-capacity`. **Plan:** `docs/PLAN-HOURS-CAPACITY-DEFINITION-2026-08.md`.

## Why measurement came first

Every earlier statement about this problem was an estimate. The plan's own
success criterion had to be corrected before anything could be built, and the
designated first migration target turned out to be dead code. A frozen baseline
is what lets a later PR prove it moved nothing.

## MUST

| # | Criterion | How verified |
|---|---|---|
| M1 | **No write path exists at all** — no `--confirm`, no `--apply`, no transaction, no `set`/`update`/`delete` | grep of the whole file; it cannot mutate production even by mistake |
| M2 | No client cap — the 2026-05-14 script capped at 50 and silently truncated a 150-client office | reads the full collection |
| M3 | Total by construction: malformed stages degrade a bucket, never throw, never emit `NaN` | 9-case `test.each` |
| M4 | Every figure carries a rule + version stamp | report fields |
| M5 | The report is gitignored — it carries client names and the repo is PUBLIC | `.gitignore` |
| M6 | Three gating probes present: status-less stages · two-legal_procedure clients · service-vs-Σstages divergence | §8.0 of the plan |
| M7 | The bucket math is provable offline, with no Firestore | 21 tests |

## What it measured (executed 2026-08-16, 164 live clients)

| | |
|---|---|
| contract (today's rule) | 8,274h |
| active (the honest figure) | 6,470h |
| **phantom** | **1,804h** across 16 cases |
| shown solvent but over-drawn | 5 clients |
| probe A — status-less stages | **0** → the third bucket is a dead constant |
| probe B — clients with 2+ legal_procedure | **9** → a live identity bug, fixed in PR-A |
| probe C — service vs Σ stages | **0** → no pre-existing drift to confuse ours |

Probe B is the reason PR-A exists. Probe A killed a design debate with a
measurement instead of an argument.

## Rollback

Nothing to roll back — the script writes nothing. `git revert` removes the file.
