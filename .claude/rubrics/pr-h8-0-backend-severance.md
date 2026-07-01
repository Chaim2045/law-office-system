# PR Rubric — H.8.0 PR3: Backend Severance of `user_messages`

**Scope:** `functions/src/whatsapp-bot/WhatsAppBot.js` + `functions/admin/master-admin-wrappers.js`
**Type:** Dead-code removal + behavioral change (WhatsApp bot admin menu 6→4 items)
**App:** Functions (backend)
**Branch:** `lo-h8-cleanup`

---

## MUST criteria

| # | Criterion | Pass condition |
|---|---|---|
| M1 | Zero `user_messages` references in functions/ | `grep -r user_messages functions/` = empty |
| M2 | Bot dispatches only 4 live items (1=stats, 2=timesheets, 3=tasks, 4=help) | Confirmed by dispatch block inspection |
| M3 | `showMainMenu` shows only 4 items, no `getPendingTasksCount` call | Confirmed by method body inspection |
| M4 | `getUserFullDetails` CF returns without `messages` field (5-element Promise.all → 4) | Confirmed by master-admin-wrappers.js inspection |
| M5 | Removed dead methods: showPendingTasks, handlePendingTasksContext, showTaskDetails, handleQuickApproval, approveTask, rejectTask, getPendingTasksCount, handleSendMessage, isApprovalCommand, notifyOtherAdmins | grep for each = empty |
| M6 | `showHelp` text references only the 4 live menu items | Confirmed by method body |
| M7 | `node --check` passes on both files | syntax check green |
| M8 | Root vitest suite green (808/808+) | `npx vitest run` all pass |

## SHOULD criteria

| # | Criterion |
|---|---|
| S1 | No orphaned references to removed methods anywhere in the file |
| S2 | `handleSendMessage` stub is removed (was "feature in development") |

---

## PRODUCT-GRADE GATES

| Gate | Status | Notes |
|---|---|---|
| G1 Customer-visible errors | PASS | Bot error paths unchanged; `showHelp` is Hebrew only; removed "feature in development" stub |
| G2 Rollback | PASS | Pure dead-code removal; `git revert` restores all removed methods |
| G3 Monitoring | N/A | No write paths added or modified; removed methods were the write paths |
| G4 Customer scenario test | N/A | WhatsApp bot unit tests not in the suite; behavioral change covered by manual smoke (admin sends "תפריט" → gets 4 items) |
| G5 Hebrew UI | PASS | `showMainMenu` + `showHelp` are Hebrew throughout |
| G6 Breaking change | PASS (declared) | Admin bot menu renumbered 6→4; old items 1 (משימות לאישור) and 5 (שלח הודעה לעובד) removed; the 2 partners (Haim+Guy) are the only users of the admin WhatsApp bot — no external consumers |
| G7 Security | N/A | No auth/PII/permissions surface changed |
