# RUBRIC — PR-3b: materialize `hoursCapacity` onto existing clients

**Scope:** a supervised script + its helper tests. **Env:** DEV/PROD share one Firebase project.
**Branch:** `investigate/hours-capacity`. **Plan:** ruling P6.
**Execution is Haim's hands** — the harness blocks Claude from production writes.

## Why a script is required at all

`hoursCapacity` is **persisted**, not computed on read. It appears only when a
client is next written for some other reason, and
`functions/admin/repair-aggregates.js` states the deliberate policy: *"There is
intentionally NO batch endpoint — Haim runs repair per-client after reviewing
audit output, preventing mass-write incidents."*

Without this, the field arrives one client at a time, by accident, indefinitely
— and no reader can distinguish **"not yet computed"** from **"genuinely nothing
available"**. Those differ: `activeHours: 0` is legitimate (every service
closed). That is why a reader must branch on **presence**, and why `|| 0` would
put a false red alert on nearly every client.

## The one design rule

**The script does not compute capacity.** It re-writes each client through
`writeClientWithCanonicalAggregates` with an EMPTY partial update; the canonical
writer derives the field exactly as a live write would. A second implementation
here would create the sixth competing definition this plan exists to remove.

## MUST

| # | Criterion | Verified by |
|---|---|---|
| M1 | Dry-run by default; `--apply` is the only write gate | grep of every write path; the sentinel abort |
| M2 | No client cap | the 2026-05-14 script capped at 50 and silently truncated a 150-client office |
| M3 | Per-client transaction — one failure isolates | `processClient` catches and records, the loop continues |
| M4 | **No `auditMeta`** — a system backfill must not overwrite `lastModifiedBy` on 164 clients | the canonical writer stamps those only when auditMeta is present |
| M5 | Every aggregate movement is reported BEFORE `--apply` | `diffWatched` + the `movements` array; 8 tests |
| M6 | A flipped `isBlocked` is always surfaced | dedicated test — it changes who can log hours |
| M7 | Sub-cent float noise is NOT reported | otherwise the report is noise nobody reads |
| M8 | Importing the module has no side effects | Firestore initialised inside `main()`, not at load |
| M9 | The report is gitignored — it carries client names, the repo is PUBLIC | `.gitignore` |
| M10 | Suites green | functions 1737 (+8) |

## What `--apply` actually changes, stated plainly

Re-writing recomputes **all** aggregates, not just the new field. A client whose
stored figures had drifted gets **corrected**. That is desirable — but it is a
number moving on a live system, so the dry-run lists every one of them and the
run is not approved until that list is read.

`aggregatesWouldMove` is the line to read first. If it is 0, `--apply` only adds
the new field and nothing else moves.

## Supervised run order

```bash
node scripts/materialize-hours-capacity-2026-08-17.js            # dry-run
# read the report: aggregatesWouldMove, failures
node scripts/materialize-hours-capacity-2026-08-17.js --case=2025006   # one client
node scripts/materialize-hours-capacity-2026-08-17.js --apply    # all
```

Re-running `scripts/measure-hours-capacity-2026-08-16.js` afterwards confirms
the field landed and the phantom figure is unchanged.

## Rollback

The script only re-derives from `services[]`; it introduces no new source of
truth. To undo, revert the code that writes the field and the orphan value stops
being refreshed. No inverse migration is needed — nothing reads it yet.
