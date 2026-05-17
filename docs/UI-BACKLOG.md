# UI Backlog

UX/UI improvement requests that surface during regular work but aren't blocking. **Treated in a dedicated UI polish phase**, NOT during structural work.

**Rule for adding entries:** if a UI/UX bug actively misleads the user (wrong info displayed, broken modal, security risk) → fix now. If it's aesthetic, redundancy, or "could be cleaner" → log here.

---

## Format

```
### YYYY-MM-DD — short title
**Scope:** which screen / component
**Symptom:** what user sees
**Severity:** low / medium / high
**Proposed change:** option(s)
**Decision:** (pending / accepted / rejected) — defer to UI phase
```

---

## Open

### 2026-05-17 — "שינוי סטטוס לקוח" appears in two places
**Scope:** Admin Panel `clients.html` — client row dropdown + `ClientManagementModal`
**Symptom:** Two entry points to the same flow. Surfaced during PR-A.6 smoke. Not a code duplicate (both call `changeStatus()`), but two visible buttons can confuse admin.
**Severity:** low (both work; just redundant)
**Proposed change:**
- (A) Keep both — flexibility
- (B) Remove from `ClientManagementModal`, keep in row dropdown (cleaner)
- (C) Remove from row dropdown, keep only inside `ClientManagementModal` (centralized)
**Decision:** pending — defer to UI polish phase after PR-A-E + deep audit.

---

## Closed (for historical record)

_None yet._

---

## When to address

After the **structural-treatment series** completes:
- PR-A.* (helper + isOnHold + Rules + violations + kill-switch) ✅ done
- PR-B (refactor 13 remaining callsites)
- PR-C (scanner + WhatsApp + dashboard)
- PR-D (repair 23 victims)
- PR-E (TypeScript discriminated union)
- Deep audit of time-tracking flow

Then a focused UI polish phase tackles this backlog in batches.
