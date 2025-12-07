# 🔔 Notification System Documentation

## Overview
The Law Office Management System uses a **single, unified notification system** based on `NotificationBellSystem`.

**Last Updated:** 2025-12-07
**Status:** Active, Production-Ready
**Version:** 2.0 (Unified)

---

## 📚 Table of Contents
- [Architecture](#architecture)
- [Firestore Schema](#firestore-schema)
- [UI Elements](#ui-elements)
- [Code Locations](#code-locations)
- [Usage Guide](#usage-guide)
- [Troubleshooting](#troubleshooting)
- [Migration History](#migration-history)

---

## 🏗️ Architecture

### Single Source of Truth
The system uses **NotificationBellSystem** only (`js/modules/notification-bell.js`).

### Data Flow
```
┌─────────────────────────────────────────────────────────────┐
│                    NOTIFICATION FLOW                         │
└─────────────────────────────────────────────────────────────┘

1. CREATION
   ┌──────────────────────────────────────────────┐
   │ Admin Panel / Cloud Function                 │
   │ → Creates message in Firestore               │
   │   Collection: user_messages                  │
   │   Field: status = 'unread'                   │
   └──────────────────────────────────────────────┘
                        ↓
2. REAL-TIME SYNC
   ┌──────────────────────────────────────────────┐
   │ NotificationBellSystem.startListeningTo...   │
   │ → Firestore onSnapshot listener              │
   │ → Query: where('status', '==', 'unread')     │
   └──────────────────────────────────────────────┘
                        ↓
3. DISPLAY
   ┌──────────────────────────────────────────────┐
   │ User Interface                                │
   │ → Top bar envelope icon 📧                   │
   │ → Badge shows count                          │
   │ → Dropdown shows messages                    │
   └──────────────────────────────────────────────┘
                        ↓
4. DISMISSAL
   ┌──────────────────────────────────────────────┐
   │ User clicks X                                 │
   │ → Update Firestore: status = 'dismissed'     │
   │ → Listener auto-removes from local array     │
   │ → UI updates immediately                     │
   └──────────────────────────────────────────────┘
```

---

## 🗄️ Firestore Schema

### Collection: `user_messages`

```javascript
{
  // Recipient
  to: "user@example.com",           // Required - User email
  toName: "שם המשתמש",               // Optional - User display name

  // Sender
  from: "admin@example.com",         // Required - Sender email or "system"
  fromName: "שם האדמין",             // Required - Sender display name

  // Content
  message: "תוכן ההודעה",            // Required - Message text
  type: "info",                      // Required - Message type

  // Status (CRITICAL - must use 'status' field!)
  status: "unread",                  // Required - 'unread' | 'dismissed' | 'responded'

  // Timestamps
  createdAt: Timestamp,              // Required - Server timestamp
  dismissedAt: Timestamp,            // Optional - When dismissed
  respondedAt: Timestamp,            // Optional - When responded

  // Optional fields
  response: "תגובת המשתמש",          // Optional - User's response
  priority: 5,                       // Optional - 0-10 (5+ = urgent)
  taskId: "task123",                 // Optional - Related task ID
  approvalId: "approval123"          // Optional - Related approval ID
}
```

### Message Types
- `info` - General information
- `warning` - Warning message
- `urgent` - Urgent message
- `task_approval` - Task budget approved
- `task_rejection` - Task budget rejected

### Status Values
- `unread` - New message, not yet read
- `dismissed` - User clicked X to dismiss
- `responded` - User sent a reply

---

## 🎨 UI Elements

### Required Elements (DO NOT REMOVE!)

#### 1. AI Floating Button (Primary Interface)
**File:** `js/modules/ai-system/ai-chat-ui.js:131-134`
```html
<button class="ai-float-btn" id="aiFloatBtn" onclick="window.aiChat.toggle()">
  <i class="fas fa-robot"></i>
  <span class="ai-float-notification-badge" id="aiFloatNotificationBadge"></span>
</button>
```
- **Purpose:** Floating AI chat button - main entry point for notifications
- **Badge:** `aiFloatNotificationBadge` - shows total unread count (admin + system)
- **Updated by:** `NotificationBell.updateMessagesIconBadge()`

#### 2. AI Chat Header - Admin Messages Button
**File:** `js/modules/ai-system/ai-chat-ui.js:77-80`
```html
<button class="ai-header-btn ai-messages-btn" id="aiMessagesBtn"
        onclick="window.aiChat.openAdminMessages()" title="הודעות מהמנהל">
  <i class="fas fa-envelope"></i>
  <span class="ai-notification-badge" id="aiMessagesBadge"></span>
</button>
```
- **Purpose:** Envelope icon - opens admin messages view
- **Badge:** `aiMessagesBadge` - shows unread admin messages count
- **Updated by:** `NotificationBell.updateMessagesIconBadge()`
- **Filters:** Shows only `isAdminMessage === true`

#### 3. AI Chat Header - System Notifications Button
**File:** `js/modules/ai-system/ai-chat-ui.js:81-84`
```html
<button class="ai-header-btn ai-notifications-btn" id="aiNotificationsBtn"
        onclick="window.aiChat.openNotifications()" title="התראות מערכת">
  <i class="fas fa-bell"></i>
  <span class="ai-notification-badge" id="aiNotificationBadge"></span>
</button>
```
- **Purpose:** Bell icon - opens system notifications view
- **Badge:** `aiNotificationBadge` - shows system notifications count
- **Updated by:** `NotificationBell.updateMessagesIconBadge()`
- **Filters:** Shows only `isAdminMessage !== true`

---

## 📂 Code Locations

### Client-Side

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| **NotificationBellSystem** | `js/modules/notification-bell.js` | 1-520 | Main notification system |
| **Initialization** | `js/main.js` | 130, 217 | Creates instance, starts listening |
| **UI Components** | `index.html` | 191-211, 443-444 | HTML elements |
| **AI Integration** | `js/modules/ai-system/ai-chat-ui.js` | 78-85 | AI chat badges |

### Server-Side (Cloud Functions)

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| **approveTaskBudget** | `functions/index.js` | 5760-5850 | Creates approval message |
| **rejectTaskBudget** | `functions/index.js` | 5860-5940 | Creates rejection message |

### Admin Panel

| Component | File | Purpose |
|-----------|------|---------|
| **AlertCommunicationManager** | `master-admin-panel/js/managers/AlertCommunicationManager.js` | Sends messages to users |

---

## 📖 Usage Guide

### For Developers

#### Creating a Notification (Admin Panel)
```javascript
// From Admin Panel
const alertManager = window.alertCommunicationManager;
await alertManager.sendMessage(
  'user@example.com',
  'תוכן ההודעה',
  {
    type: 'info',      // or 'warning', 'urgent'
    priority: 5        // 0-10 (5+ = urgent)
  }
);
```

#### Creating a Notification (Cloud Functions)
```javascript
// From Firebase Functions
const messageRef = db.collection('user_messages').doc();
await messageRef.set({
  to: 'user@example.com',
  from: 'system',
  fromName: 'מערכת',
  message: 'תוכן ההודעה',
  type: 'info',
  status: 'unread',  // CRITICAL - must use 'status'!
  createdAt: admin.firestore.FieldValue.serverTimestamp()
});
```

#### Listening to Notifications (Client)
```javascript
// Automatically initialized in main.js:217
this.notificationBell.startListeningToAdminMessages(user, window.firebaseDB);

// Or manually:
const notificationBell = new NotificationBellSystem();
notificationBell.startListeningToAdminMessages(user, db);
```

#### Dismissing a Notification
```javascript
// User clicks X - handled automatically
// Or programmatically:
await window.notificationBell.removeNotification('msg_xyz123');
```

---

## 🔧 Troubleshooting

### Notifications not appearing?

**Check 1: Firestore field**
```javascript
// ❌ WRONG - will NOT work
{ read: false }

// ✅ CORRECT - will work
{ status: 'unread' }
```

**Check 2: Element IDs**
```javascript
// Required elements must exist:
document.getElementById('messagesCountBadge')     // Top bar badge
document.getElementById('notificationsDropdown')  // Dropdown
```

**Check 3: Console errors**
```
Open DevTools → Console
Look for: "NotificationBell: Cannot listen to messages"
```

---

### Notifications returning after refresh?

**Cause:** Message has `status: 'unread'` instead of `'dismissed'`

**Fix:** Check that dismiss function updates Firestore:
```javascript
// Should see in Firestore:
status: 'dismissed',
dismissedAt: serverTimestamp()
```

---

### Badge not updating?

**Check:** Is the badge element present?
```javascript
const badge = document.getElementById('messagesCountBadge');
console.log(badge); // Should NOT be null
```

---

## 📜 Migration History

### Version 2.0 (2025-12-07) - Current
**Changes:**
- ✅ Removed duplicate `UserAlertsPanel` system
- ✅ Unified to single `NotificationBellSystem`
- ✅ Standardized on `status` field
- ✅ Fixed: Notifications returning after refresh

**Files Removed:**
- `js/managers/UserAlertsPanel.js` (659 lines)
- `js/init-user-alerts.js` (77 lines)

**Benefits:**
- Single source of truth
- Consistent field usage
- No duplicate Firestore listeners
- Reduced codebase by 740 lines

### Version 1.0 (Pre-2025-12-07) - Deprecated
**Issues:**
- Two separate notification systems
- Inconsistent field usage (`read` vs `status`)
- Duplicate Firestore listeners
- Notifications returning after refresh

---

## ⚠️ Important Notes

### DO NOT:
- ❌ Create new notification systems
- ❌ Use `read: true/false` field (deprecated)
- ❌ Remove HTML elements listed above
- ❌ Modify Firestore queries without updating docs

### DO:
- ✅ Always use `status: 'unread'` for new messages
- ✅ Use `NotificationBellSystem` for client-side
- ✅ Use `AlertCommunicationManager` for admin-side
- ✅ Test after any notification-related changes

---

## 🆘 Support

### Quick Reference
```bash
# Check system status
grep -r "NotificationBellSystem" js/

# Verify elements exist
grep "messagesCountBadge\|notificationsDropdown" index.html

# Check Firestore structure
# Go to Firebase Console → Firestore → user_messages
```

### Rollback (if needed)
```bash
# Restore old system
git revert a44a156

# Or restore from backup
cp .backup/deprecated-notifications-2025-12-07/* js/managers/
```

---

## 📞 Contact
For questions or issues, check `.claude/` documentation or contact the development team.

**Last Reviewed:** 2025-12-07
**Next Review:** TBD
