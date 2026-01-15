# 📊 Workload Analytics — Required Firestore Indexes

## ⚠️ **Index Requirements**

The `getTeamWorkloadData` Cloud Function performs the following queries:

---

### **1. Employees Collection** ✅ No index needed
```javascript
employees.where(FieldPath.documentId(), 'in', [emails])
```
- **Index:** Built-in (document ID)
- **Status:** ✅ No action required

---

### **2. Budget Tasks Collection** ⚠️ May need index
```javascript
budget_tasks
  .where('employee', 'in', [emails])
```
- **Index:** `employee` (single field)
- **Status:** ✅ Likely exists (common query)
- **Fallback:** Client-side filtering by `status === 'פעיל'`

**If error occurs:**
```
The query requires an index. You can create it here: https://console.firebase.google.com/...
```

**Required index:**
- **Collection:** `budget_tasks`
- **Fields:** `employee` (Ascending)
- **Status:** Single-field index (usually auto-created)

---

### **3. Timesheet Entries Collection** ⚠️ Composite index needed
```javascript
timesheet_entries
  .where('employee', 'in', [emails])
  .where('date', '>=', '2026-01-01')
```

**This requires a composite index:**

- **Collection:** `timesheet_entries`
- **Fields:**
  - `employee` (Ascending)
  - `date` (Ascending)
- **Query scopes:** Collection

**How to create:**

1. **Option A: Run the function and get the auto-generated link**
   - Firestore will return an error with a direct link to create the index
   - Click the link and it will pre-fill the index configuration

2. **Option B: Manually create via Firebase Console**
   - Go to: [Firestore Console → Indexes](https://console.firebase.google.com/project/_/firestore/indexes)
   - Click "Create Index"
   - **Collection ID:** `timesheet_entries`
   - **Fields to index:**
     - Field: `employee`, Order: Ascending
     - Field: `date`, Order: Ascending
   - **Query scope:** Collection
   - Click "Create"

3. **Option C: Use Firebase CLI**
   ```bash
   # Check current indexes
   firebase firestore:indexes

   # Deploy index from firestore.indexes.json
   firebase deploy --only firestore:indexes
   ```

---

## 🔍 **How to Check if Indexes Exist**

### Via Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project
3. Go to **Firestore Database → Indexes**
4. Look for:
   - Collection: `timesheet_entries`
   - Fields: `employee (ASC), date (ASC)`

### Via Firebase CLI:
```bash
firebase firestore:indexes
```

---

## 📝 **Expected Index Configuration (firestore.indexes.json)**

If using `firestore.indexes.json`, add:

```json
{
  "indexes": [
    {
      "collectionGroup": "timesheet_entries",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "employee",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "date",
          "order": "ASCENDING"
        }
      ]
    }
  ]
}
```

---

## ⚡ **Index Build Time**

- **Small collections (<1000 docs):** ~1-2 minutes
- **Medium collections (1000-10000 docs):** ~5-10 minutes
- **Large collections (>10000 docs):** ~15-30 minutes

**Note:** The function will fail until the index is fully built.

---

## 🧪 **Testing Without Deploy**

To test locally with emulator (no index needed):

```bash
cd functions
npm run serve
```

Then call the function via the local emulator endpoint.

---

## 📚 **Additional Resources**

- [Firestore Indexing Overview](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Index Types](https://firebase.google.com/docs/firestore/query-data/index-overview)
- [Managing Indexes](https://firebase.google.com/docs/firestore/manage-indexes)
