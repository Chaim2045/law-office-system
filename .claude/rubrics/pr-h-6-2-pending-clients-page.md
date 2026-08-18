# PR H.6.2 — Pending Clients Admin Page

**Scope:** New admin-only page `pending-clients.html` + JS module + CSS that lists unlinked tofes-mecher sales records and lets an admin approve+create a client from each.

## MUST criteria

### M1 — Admin role gate (fail-closed)
The page MUST verify `claims.role === 'admin'` from the Firebase ID token BEFORE rendering any data or calling any CF. Non-admin → Hebrew access-denied state. Token-read failure → treat as non-admin.

### M2 — Calls the correct CFs
The page MUST call `listUnlinkedSalesRecords` (no input) to load data and `createClientFromSalesRecord({ salesRecordId })` on approve. Both via `firebase.functions().httpsCallable(...)`.

### M3 — Confirmation before create
The "approve" action MUST show a `ModalHelpers.confirm(...)` dialog (Hebrew) BEFORE calling `createClientFromSalesRecord`. The dialog MUST name the client and the amount.

### M4 — Idempotent handling
If `createClientFromSalesRecord` returns `{ created: false }`, the page MUST show a Hebrew info message (not an error) indicating the client was already created, and refresh the table.

### M5 — User-data escaping (XSS)
All user-controlled data rendered into the DOM MUST be escaped via `window.escapeHtml()`. No `innerHTML` with raw tofes data.

### M6 — Design Bar compliance
- RTL Hebrew (`<html lang="he" dir="rtl">`)
- CSS uses only `design-system.css` tokens (no hardcoded colors, spacing, or transition durations)
- Buttons have `:focus-visible` styling
- `prefers-reduced-motion` respected via `--transition-*` tokens
- Uses `ModalManager` (not inline modal HTML)

### M7 — Hebrew UI (G5)
All customer-facing strings MUST be in Hebrew. No English error messages, labels, or status text visible to the user.

### M8 — Error states (G1)
Loading failure, CF errors, and network issues MUST show Hebrew user-friendly messages with a next-action suggestion ("נסה שוב"). No stack traces, no raw FirebaseError, no `undefined`/`null`/`[object Object]`.

## SHOULD criteria

### S1 — Empty state
When `unlinkedRecords` is empty, the page SHOULD show a friendly Hebrew "אין רשומות ממתינות" message with an appropriate icon.

### S2 — Loading state
The page SHOULD show a loading indicator while fetching data.

### S3 — Amount formatting
Money amounts SHOULD be formatted with `₪` prefix and `toLocaleString('he-IL')` for readability.

### S4 — Capped indicator
If the response has `capped: true`, the page SHOULD show a notice that not all records are displayed.
