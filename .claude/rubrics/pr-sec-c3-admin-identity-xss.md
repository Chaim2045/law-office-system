# Rubric — PR-SEC-C3 · Escape admin identity/activity sinks (defense-in-depth)

**Scope:** `apps/admin-panel` — frontend, security defense-in-depth. Final PR of the PR-SEC-C program.
A reachability check (2026-08-11) established these sinks are **admin→admin at most**: `firestore.rules`
blocks non-admins from writing `displayName`/`username`/`photoURL`, and `activity_log` is `<>`-sanitized
at write by `logActivity`. The one genuinely stored-XSS-capable sink is **`user.username`** (rendered raw,
stored UNSANITIZED). This PR escapes ALL of them **at the sink** — the durable control, since the write-side
sanitize is a fragile single point (relies on every writer remembering it).

**Files (index.html is the sole loader of all three):**
- `js/ui/UserDetailsModal.js` — `username` (`:502` caller), avatar `photoURL`+`displayName` (`renderUserAvatar`),
  activity `actionText` (`:2240`) + `formatActivityDetails` label/value (`:2365`).
- `js/ui/UsersTable.js` — avatar `photoURL`+`displayName` (`renderAvatar`).
- `js/ui/DeleteDataSidePanel.js` — the delete-panel header `displayName`.
- `index.html` — `?v=` on the 3 files. **No** backend / CF / rules / data change.

## MUST
- **M1 — username escaped.** `:502` → `renderInfoRow('שם משתמש', this.escapeHtml(user.username || 'לא הוגדר'))`.
  Escaped **at the caller**, NOT inside the generic `renderInfoRow` (another caller passes `formatLastSeenStatus`,
  which may be HTML — escaping the helper would break it). This is the one stored-unsanitized capable sink.
- **M2 — avatars escaped.** Both `renderUserAvatar` (UserDetailsModal) and `renderAvatar` (UsersTable):
  `src="${this.escapeHtml(user.photoURL)}" alt="${this.escapeHtml(user.displayName)}"` — closes the attribute
  break-out vector (a `"` in the value). No raw `${user.photoURL}`/`${user.displayName}` survives.
- **M3 — delete-header escaped.** `DeleteDataSidePanel` header → `מחיקת נתונים: ${this.escapeHtml(displayName)}`.
- **M4 — activity escaped.** `actionText` and each `formatActivityDetails` `label`/`displayValue` routed through
  `this.escapeHtml` (the free-text `clientName`/`description`/`taskDescription` fields).
- **M5 — cache-bust.** `?v=20260811-pr-sec-c3` on the 3 files in `index.html` (their only loader).
- **M6 — test.** Source lock (all 6 sinks route through `this.escapeHtml`; no raw interpolation survives) +
  behavioral mirror (a `displayName` breaking out of `alt` → exactly one `<img>`, no `onerror`; a malicious
  activity `clientName` → inert text). Full `admin-panel` vitest suite green; ESLint 0 errors.

## Gate notes
- **G1/G5:** PASS — no customer-facing string changed; values render as the same visible text.
- **G2:** PASS — frontend-only, no data: `git revert <sha>` + supervised Netlify redeploy.
- **G3:** N/A — display-only; no write path touched.
- **G4:** PASS — source-lock + behavioral mirror (attribute break-out + activity text).
- **G6:** PASS — no breaking change; display-only. The generic `renderInfoRow` is **untouched** (escape applied at
  the username caller), so its other callers (role/status/date/last-seen, incl. possibly-HTML `formatLastSeenStatus`)
  render exactly as before. `getInitials`/badges unaffected. No count/filter/aggregate change (ADMIN SAFETY RULE).
- **G7 — SECURITY (defense-in-depth):** escape-at-sink hardening of admin identity/activity sinks; **devils-advocate MANDATORY**.

## Note
This is the **last** planned security-hardening PR of the red-team track. Remaining (out of scope): the
non-security "phantom notification" bug (`window.NotificationsUI` undefined → toasts silently don't display).
