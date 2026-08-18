# Rubric — PR docs-archive (superseded documentation → `docs/archive/`)

**Title:** docs: archive 4 superseded documents with an index and inbound-reference sweep
**Branch:** `chore/docs-archive`
**Base:** `main`
**Scope:** Documentation only. Moves four `.md` documents that read as authoritative but are factually wrong about the deployed system into a new `docs/archive/`, via `git mv`. Adds `docs/archive/README.md` as the index, a deprecation header inside each archived file, a forward-pointing header on one dated-but-current document, one pointer correction in `docs/architecture/SERVICE_TYPES.md`, and one line in `CLAUDE.md`. Updates every inbound reference to a moved file. **No file is deleted. No executable line changes.**

## MUST criteria (block on FAIL)

### M1 — Every archive verdict is backed by a spot-check against deployed code
**Rule:** For each archived document, `docs/archive/README.md` names at least one concrete claim that is false today, with the `file:line` of the code that contradicts it. No document is archived on vibes or on the audit's say-so.
**Evidence required:** Read `docs/archive/README.md`; each of the four entries cites code. The four citations are `functions/shared/constants.js:34`, `functions/addTimeToTask_v2.js:559-570`, `functions/clients/index.js:65` + `functions/timesheet/index.js:304`, and the five non-existent link targets.

### M2 — History follows the files
**Rule:** `git status` / `git diff --stat` show renames (`R`), never delete + add.
**Evidence required:** `git diff --cached --name-status` shows `R093`, `R091`, `R091`, `R082` for the four moves.

### M3 — Zero dangling references
**Rule:** `git grep -n "<old-filename>"` for each moved file returns no hit that still points at the old path. Every surviving mention carries the new `docs/archive/` path.
**Evidence required:** The four `git grep` outputs in the PR body.

### M4 — No executable line changed
**Rule:** The diff touches `.md` files only. No `.js`, `.ts`, `.css`, `.html`, `.json`, `.rules`. The permitted exception (a comment inside a source file citing a moved path) was not needed — no source file referenced a moved document.
**Evidence required:** `git diff --stat` in the PR body — 15 files, all `.md`.

### M5 — A direct-link reader is warned in place
**Rule:** Each archived file carries a deprecation block at the very top: archived, date, why, where to go instead. A reader arriving from a bookmark or search engine sees it without opening the index.
**Evidence required:** First ~20 lines of each file in `docs/archive/`.

### M6 — Nothing current was archived
**Rule:** The documents named as current (`SERVICE_TYPES.md`, `SINGLE-OWNER-AGGREGATE-DESIGN.md`, the two 2026-07 PLANs, the two 2026-07 FINDINGS, `MASTER_PLAN.md`) are untouched except the single pointer correction in `SERVICE_TYPES.md`. When in doubt, the document stayed.
**Evidence required:** `git diff --cached --name-status` — none of those paths appear except `SERVICE_TYPES.md` (4 lines).

### M7 — The `SERVICE_TYPES.md` pointer correction is verified, not copied
**Rule:** The claim that `isFixedService` moved out of `aggregates.js:23-26` was checked against the code before the doc was edited, and the correction names the real canonical location.
**Evidence required:** `functions/shared/aggregates.js:23` is `const { isFixedService } = require('./business-rules/service-classification');`. The canonical SOT is the repo-root `shared/business-rules/service-classification.js`; `functions/shared/business-rules/service-classification.js` is its deploy-bundle mirror (its own header says so). The corrected table names all three with their roles.

## SHOULD criteria

### S1 — Index language matches the house convention
**Rule:** `docs/archive/README.md` is written in Hebrew, matching the surrounding documentation, rather than imposing English.
**Evidence required:** Read the file.

### S2 — The judgement call is justified, not silently resolved
**Rule:** `TIME-TRACKING-FLOW.md` was a close call. The decision (keep + header, not archive) and its reasoning are recorded in both the header and the index's "what was not archived" section.
**Evidence required:** Read both.

### S3 — Historical records are not falsified
**Rule:** Where a moved filename appears inside a record of a past reorganisation (`MD_FILES_ORGANIZATION_*`), the historical `mv` command is annotated, not rewritten. The record still says what was done in 2025-12; it just no longer misleads about where the file is now.
**Evidence required:** `docs/MD_FILES_ORGANIZATION_SUMMARY.md:318`.

## Out of scope

- Writing a new service-types map (landing separately).
- Rewriting the content of any document that stays, beyond the M7 pointer correction and the forward-pointing headers.
- Any code change.
- Archiving the ~190 remaining historical `.md` files under `docs/`, `docs/fixes/`, `docs/analysis/`, `devtools/docs/`. Those are dated records of work done, not descriptions of the current system, so they do not mislead the way an "Official Standard" does. Listed for the owner in the PR body.

## Rollback

`git revert <merge-commit>` — restores the four files to their original paths, removes `docs/archive/`, reverts the reference edits, the header, the pointer correction, and the `CLAUDE.md` line. Docs only: no code, no data, no deploy, no migration. Under 1 minute.

## Verification performed

- `npm test` (root vitest) from the worktree root: **51 files, 892 passed, 2 skipped**. No test asserts on a `docs/` path — checked; `functions/tests/revoke-fee-agreement-acls.test.js` reads repo files but only `.js` source paths, and `tests/unit/user-app/openai-chat-removed.test.ts` asserts on `apps/user-app/**` `.md` paths, none of which moved.
- `git grep` per moved filename — output in the PR body.
- `git diff --stat` — 15 files, all `.md`.

VERDICT: PASS
