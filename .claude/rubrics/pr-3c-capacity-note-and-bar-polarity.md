# RUBRIC — PR-3c: the phantom line + the progress-bar polarity fix

**Scope:** Admin Panel (`clients.html`). **Env:** DEV (`main`). **No backend change.**
**Branch:** `investigate/hours-capacity`. **Plan:** ruling P1 (explicit phantom indicator), P3 (fix the inverted bar).

## The two changes

**1. The phantom line** — the first reader of `hoursCapacity` anywhere in the
system. A second line under the hours figure: *"זמינות כעת 235.0 מתוך 355.0 ·
120.0 נעולות"*, with a Hebrew tooltip explaining what "locked" means.

**2. The bar polarity.** It filled with `remaining / total` — a *fullness* bar,
unique in this codebase; every other hours meter fills with consumption. That
mattered the moment capacity became a moving number: **shrinking a client's real
capacity made the bar fill MORE**, so an over-drawn client looked healthier.
Exactly backwards from what this work exists to surface. Now `used / total`,
clamped to 0..100 so a negative balance is a full bar rather than a >100%
overflow.

## Why the note is additive and nothing else moved

`activeHours` is a **capacity** figure; `remaining` is a **balance**. They are
not interchangeable, and there is no `activeRemaining` — deliberately, because
`hoursUsed` also sums all stages, so pairing a stage-filtered numerator with an
unfiltered denominator would drive every client past stage A negative and block
them (plan §4, ruling P4).

Concretely, on the five exposed clients this PR changes the **denominator line
and the bar geometry only**. No badge, no colour, no icon, no counter, no
filter, no sort, no CSV cell. Those move in PR-5, paired.

## MUST

| # | Criterion | Verified by |
|---|---|---|
| M1 | The note names available, contracted and locked hours | 4 assertions on the rendered string |
| M2 | **Presence, never `|| 0`** — an absent field renders nothing | 3 assertions. `activeHours: 0` is legitimate; treating absent as 0 would put a false alert on nearly every client until PR-3b runs |
| M3 | No phantom → renders nothing. Silence is the correct output | 1 assertion |
| M4 | Malformed input never breaks a row | 5 shapes, none throw, all render '' |
| M5 | Bar fills with consumption; the old formula is gone | source assertions + 6 boundary cases incl. the −40h client |
| M6 | Clamped 0..100 | boundary case `pct(100, -40) === 100` |
| M7 | `hoursCapacity` is read in **exactly one place** | a count assertion — the guard against quiet spread |
| M8 | Warning icon, badges, counters, filters, sort and CSV untouched | 4 assertions incl. "CSV does not mention the field" |
| M9 | Hebrew only, with an explanation | 2 assertions, one rejecting any Latin letter |
| M10 | Design tokens, no hardcoded colours | CSS assertions |
| M11 | Root suite green | 1289 (+16) |

## Deliberate design choices

- **Absent renders nothing, not a placeholder.** A "טרם חושב" marker on 164 rows
  would be noise; the materialization script (PR-3b) closes the gap properly.
- **Informational, not an alarm.** These are contracted hours, not an error. The
  row's existing badges own alerting; muted weight keeps the note subordinate.
- **`--text-tertiary` is not used** — it is referenced elsewhere in this app but
  never actually defined. Referencing a phantom token in a PR about phantom
  hours would be its own small joke.

## Rollback

Frontend-only. `git revert <merge-sha>` + redeploy. The bar returns to the
inverted formula and the note disappears; no data is affected.

## Follow-ups (filed, not fixed here)

- The same inverted-bar polarity may exist on other screens — not surveyed.
- `FluentDataGrid` (frozen page) still runs its own broken recompute; a PR-4
  deletion candidate rather than a migration target.
- The employee-facing labels (`client-case-selector.js`, `quick-log.js`) read the
  raw stale field and are the next migration target after PR-3b runs.
