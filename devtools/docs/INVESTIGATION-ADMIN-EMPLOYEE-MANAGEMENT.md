# חקירה: סקשן ניהול עובדים - Admin Panel

**תאריך:** 2026-02-04
**חוקר:** Claude Sonnet 4.5
**ענף:** investigation/admin-employee-management
**סטטוס:** 🔍 בחקירה - אסור commit/deploy ללא אישור Tommy

---

## 🎯 מטרת החקירה

לבצע חקירה מקיפה של סקשן ניהול העובדים ב-Admin Panel:
1. **איך נמשכים הנתונים** מ-Firestore
2. **איך זה מוצג** למנהל (Tommy)
3. **אילו permissions** קיימים
4. **אילו לוגיקות** מעורבות

---

## 📂 מבנה הקבצים - Admin Panel

### Main Entry Point
**File:** `master-admin-panel/index.html`

**Purpose:** נקודת כניסה ראשית ל-Admin Panel

**Structure:**
```
├── Login Screen (id="loginScreen")
│   ├── Email input
│   ├── Password input
│   └── Remember Me checkbox
│
└── Dashboard Screen (id="dashboardScreen")
    ├── Navigation Bar
    └── Main Content (id="dashboardContent")
```

**Key Components Loaded:**
1. **Core:**
   - `js/core/firebase.js` - Firebase initialization
   - `js/core/auth.js` - Authentication system
   - `js/core/constants.js` - Constants

2. **Data Management:**
   - `js/managers/DataManager.js` - **נקודת משיכת נתונים מרכזית**
   - `js/managers/AuditLogger.js` - Audit logs
   - `js/managers/UsersActions.js` - User CRUD operations

3. **UI Components:**
   - `js/ui/Navigation.js` - Top navigation
   - `js/ui/DashboardUI.js` - Main dashboard orchestrator
   - `js/ui/StatsCards.js` - Statistics cards
   - `js/ui/UsersTable.js` - Users table display
   - `js/ui/FilterBar.js` - Search and filters
   - `js/ui/UserDetailsModal.js` - Employee details popup

---

## 🔍 Data Flow: איך נמשכים נתוני העובדים

### 1. **Entry Point: DataManager.loadUsers()**

**File:** `master-admin-panel/js/managers/DataManager.js`

**Method:** `loadUsers(forceRefresh = false)`

**Line:** 94-195

**Logic:**
```javascript
// 1. Check cache (5 minutes TTL)
if (!forceRefresh && this.isCacheValid()) {
    return cached data;
}

// 2. Fetch from Firestore - employees collection
const snapshot = await this.db.collection('employees').get();

// 3. Parse users and fetch statistics in parallel
snapshot.forEach(doc => {
    // ⚠️ FILTER: Skip inactive/suspended users
    if (userData.status === 'inactive' || userData.status === 'suspended') {
        return; // Skip
    }

    // Create user object with base data
    const user = {
        id: doc.id,
        email: doc.id,
        username: userData.username || doc.id.split('@')[0],
        role: userData.role || 'user',
        status: userData.status || 'active',
        createdAt: userData.createdAt || null,
        lastLogin: userData.lastLogin || null,
        lastSeen: userData.lastSeen || null,  // Real-time activity
        isOnline: userData.isOnline || false, // Online status
        phoneNumber: userData.phoneNumber || '',
        phone: userData.phone || '',
        whatsappEnabled: userData.whatsappEnabled || false,
        displayName: userData.displayName || userData.username,
        photoURL: userData.photoURL || null,
        dailyHoursTarget: userData.dailyHoursTarget || null,
        // Stats (will be filled):
        clientsCount: 0,
        tasksCount: 0,
        hoursThisWeek: 0,
        hoursThisMonth: 0
    };

    this.allUsers.push(user);
    statsPromises.push(this.fetchUserStats(userEmail, user));
});

// 4. Wait for all stats
await Promise.all(statsPromises);

// 5. Calculate statistics, apply filters, update cache
this.calculateStatistics();
this.applyFilters();
this.updateCache();
```

---

### 2. **Statistics Fetching: fetchUserStats()**

**File:** `master-admin-panel/js/managers/DataManager.js`

**Method:** `fetchUserStats(email, userObject)`

**Line:** 201-249

**Queries Executed (per user):**

#### A. **Clients Count**
```javascript
const clientsSnapshot = await this.db.collection('clients')
    .where('assignedTo', 'array-contains', email)
    .get();
userObject.clientsCount = clientsSnapshot.size;
```

**Collection:** `clients`
**Field:** `assignedTo` (array)
**Logic:** Count how many clients are assigned to this employee

---

#### B. **Tasks Count**
```javascript
const tasksSnapshot = await this.db.collection('budget_tasks')
    .where('employee', '==', email)
    .get();
userObject.tasksCount = tasksSnapshot.size;
```

**Collection:** `budget_tasks`
**Field:** `employee` (string)
**Logic:** Count active tasks for this employee

---

#### C. **Hours This Week**
```javascript
const startOfWeek = new Date(now);
startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
startOfWeek.setHours(0, 0, 0, 0);

const weekTimesheetSnapshot = await this.db.collection('timesheet_entries')
    .where('employee', '==', email)
    .where('date', '>=', startOfWeek.toISOString().split('T')[0])
    .get();

let weekMinutes = 0;
weekTimesheetSnapshot.forEach(doc => {
    weekMinutes += doc.data().minutes || 0;
});
userObject.hoursThisWeek = Math.round((weekMinutes / 60) * 100) / 100;
```

**Collection:** `timesheet_entries`
**Fields:** `employee`, `date`, `minutes`
**Logic:** Sum all minutes since Sunday, convert to hours (rounded to 2 decimals)

---

#### D. **Hours This Month**
```javascript
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

const monthTimesheetSnapshot = await this.db.collection('timesheet_entries')
    .where('employee', '==', email)
    .where('date', '>=', startOfMonthStr)
    .get();

let monthMinutes = 0;
monthTimesheetSnapshot.forEach(doc => {
    monthMinutes += doc.data().minutes || 0;
});
userObject.hoursThisMonth = Math.round((monthMinutes / 60) * 100) / 100;
```

**Collection:** `timesheet_entries`
**Fields:** `employee`, `date`, `minutes`
**Logic:** Sum all minutes since 1st of month, convert to hours (rounded to 2 decimals)

---

## 📊 Data Structure

### User Object (as seen by Admin)

```javascript
{
    // Identity
    id: "email@example.com",           // Document ID (email)
    email: "email@example.com",        // Email
    username: "EmployeeName",          // Display name
    displayName: "Full Name",          // Alternative display name

    // Role & Status
    role: "user" | "admin" | "lawyer", // User role
    status: "active" | "blocked" | "inactive" | "suspended",

    // Timestamps
    createdAt: Timestamp,              // Account creation
    lastLogin: Timestamp,              // Last authentication
    lastSeen: Timestamp,               // Real-time activity (updated every 5 min)
    isOnline: boolean,                 // Currently online?

    // Contact
    phoneNumber: "+972...",            // Phone number
    phone: "+972...",                  // WhatsApp number
    whatsappEnabled: boolean,          // WhatsApp bot enabled?

    // Media
    photoURL: "https://...",           // Profile photo

    // Work Settings
    dailyHoursTarget: 7.5,             // Daily work quota (hours)

    // Statistics (calculated)
    clientsCount: 15,                  // Total assigned clients
    tasksCount: 42,                    // Total active tasks
    hoursThisWeek: 28.5,               // Hours logged this week
    hoursThisMonth: 105.25             // Hours logged this month
}
```

---

## 🚨 חשוב: Filters & Data Visibility

### Active Filter (Line 125-128)

```javascript
// 🔒 FILTER: Skip inactive users (soft-deleted)
if (userData.status === 'inactive' || userData.status === 'suspended') {
    console.log(`⏭️ Skipping inactive user: ${userEmail}`);
    return; // Skip this user
}
```

**מה זה אומר:**
- Admin **לא רואה** עובדים עם status:
  - `inactive` (מחוק soft)
  - `suspended` (מושעה)
- Admin **רואה רק** עובדים עם status:
  - `active` (פעיל)
  - `blocked` (חסום)

---

## 🔄 Real-time Updates

### Setup (to be investigated)

**Component:** DataManager
**Method:** `setupRealtimeListeners()` (needs investigation)

**Expected Behavior:**
- Listen to changes in `employees` collection
- Auto-refresh user list when changes detected
- Update statistics when timesheet/tasks change

**Status:** 🔍 **Needs investigation**

---

## 🎨 UI Display

### Dashboard Layout

**File:** `master-admin-panel/js/ui/DashboardUI.js`

**Components:**
1. **StatsCards** - Shows aggregate statistics
   - Total users
   - Active users
   - Blocked users
   - New users (last 7 days)

2. **FilterBar** - Search and filters
   - Search by name/email
   - Filter by role (all/user/admin/lawyer)
   - Filter by status (all/active/blocked)
   - Sort options

3. **UsersTable** - Main data grid
   - Displays all filtered users
   - Shows columns: username, email, role, status, stats
   - Actions: Edit, Block/Unblock, Delete

4. **Pagination** - Page navigation
   - 25 users per page (configurable)

---

## 🔐 Permissions & Access

### Authentication

**File:** `master-admin-panel/js/core/auth.js`

**Login Flow:**
1. User enters email + password
2. Firebase Authentication verifies credentials
3. Check if user has admin privileges (needs investigation)
4. If authorized → Show dashboard
5. If unauthorized → Show error

**Status:** 🔍 **Needs investigation** - How is admin role verified?

---

## 📝 Summary So Far

### ✅ What We Know

1. **Data Source:** `employees` collection in Firestore
2. **Statistics Sources:**
   - `clients` (assignedTo array)
   - `budget_tasks` (employee field)
   - `timesheet_entries` (employee + date fields)

3. **Data Flow:**
   ```
   Firestore (employees)
       ↓
   DataManager.loadUsers()
       ↓
   Filter inactive/suspended
       ↓
   Fetch stats (parallel)
       ↓
   Cache (5 minutes)
       ↓
   Apply filters
       ↓
   Display in UsersTable
   ```

4. **Visibility:**
   - Admin sees: `active` + `blocked` users
   - Admin doesn't see: `inactive` + `suspended` users

5. **Statistics:**
   - Client count
   - Task count
   - Hours this week (Sunday-now)
   - Hours this month (1st-now)

---

### 🔍 Needs Investigation

1. **Admin Permissions:**
   - How is admin role verified?
   - What custom claims are used?
   - File: `js/core/auth.js`

2. **Real-time Listeners:**
   - Are there real-time updates?
   - What triggers re-fetching?
   - File: `js/managers/DataManager.js`

3. **User Actions:**
   - How does Edit/Block/Delete work?
   - What Cloud Functions are called?
   - File: `js/managers/UsersActions.js`

4. **UI Components:**
   - How is the table rendered?
   - What filters are available?
   - Files: `js/ui/UsersTable.js`, `js/ui/FilterBar.js`

---

## 🎯 Next Steps

1. ✅ Map Admin Panel structure
2. ✅ Trace data fetching (DataManager)
3. ✅ Document Firestore queries
4. ⏳ Investigate permissions (auth.js)
5. ⏳ Map UI components (UsersTable, FilterBar)
6. ⏳ Document user actions (UsersActions)
7. ⏳ Create final report

---

**חשוב: לא לבצע commit או deploy ללא אישור מפורש מ-Tommy!**

---

**סוף חלק 1 של החקירה**
