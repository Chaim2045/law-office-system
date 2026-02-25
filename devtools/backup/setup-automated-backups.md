# 🔐 מדריך הגדרת גיבויים אוטומטיים ל-Firestore

## 📋 תוכן עניינים
1. [הפעלת Point-in-Time Recovery (PITR)](#1-pitr)
2. [הגדרת גיבויים יומיים אוטומטיים](#2-daily-backups)
3. [גיבוי מקומי (אופציונלי)](#3-local-backup)
4. [שחזור נתונים](#4-restore)

---

## 🎯 אסטרטגיית הגיבוי המומלצת

### **המלצה: שילוב של 3 שכבות**

| שכבה | מה? | למה? | עלות/חודש |
|------|-----|------|-----------|
| **1️⃣ PITR** | Point-in-Time Recovery | שחזור מהיר (7 ימים) | ~$2-5 |
| **2️⃣ Daily Export** | גיבוי יומי ל-Cloud Storage | ארכיון ארוך טווח (30+ ימים) | ~$1-3 |
| **3️⃣ Local Backup** | גיבוי שבועי למחשב | בטיחות מקסימלית | חינם |

**סה"כ עלות משוערת: $3-8/חודש** (עבור ~5GB נתונים)

---

## 1️⃣ הפעלת Point-in-Time Recovery (PITR)

### מה זה PITR?
- שחזור לכל שנייה ב-**7 ימים** האחרונים
- אוטומטי לחלוטין (Google מנהל)
- מושלם למקרי מחיקה בטעות

### 🚀 הפעלה (פעם אחת):

```bash
# התחבר ל-Firebase
firebase login

# הפעל PITR
gcloud firestore databases update \
  --database="(default)" \
  --type=firestore-native \
  --enable-pitr \
  --project=law-office-system-e4801

# בדוק שהופעל
gcloud firestore databases describe \
  --database="(default)" \
  --project=law-office-system-e4801
```

**✅ תוצאה צפויה:**
```
earliestVersionTime: '2024-12-01T00:00:00.000000Z'
pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED
```

### 📊 עלות PITR:
- **$0.18/GB/חודש** (עבור נתונים מעל ה-GB הראשון)
- דוגמה: 5GB נתונים = **$0.72/חודש**

---

## 2️⃣ הגדרת גיבויים יומיים אוטומטיים

### אופציה A: Cloud Scheduler (מומלץ - בענן)

#### שלב 1: יצירת Bucket לגיבויים

```bash
# צור Bucket ב-Google Cloud Storage
gsutil mb -p law-office-system-e4801 \
  -l us-central1 \
  gs://law-office-system-e4801-backups

# הגדר מחזור חיים (30 ימים)
cat > lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 30}
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://law-office-system-e4801-backups
```

#### שלב 2: יצירת Cloud Function לגיבוי

```bash
# צור תיקייה לפונקציה
mkdir -p functions-backup
cd functions-backup

# צור package.json
cat > package.json <<EOF
{
  "name": "firestore-backup",
  "version": "1.0.0",
  "dependencies": {
    "@google-cloud/firestore": "^7.0.0",
    "firebase-admin": "^12.0.0"
  }
}
EOF

# צור index.js
cat > index.js <<'EOF'
const functions = require('@google-cloud/functions-framework');
const firestore = require('@google-cloud/firestore');
const client = new firestore.v1.FirestoreAdminClient();

const PROJECT_ID = 'law-office-system-e4801';
const DATABASE_NAME = '(default)';
const BUCKET = 'gs://law-office-system-e4801-backups';

functions.http('backupFirestore', async (req, res) => {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const outputUriPrefix = `${BUCKET}/backups/${timestamp}`;

  const databaseName = client.databasePath(PROJECT_ID, DATABASE_NAME);

  try {
    const [response] = await client.exportDocuments({
      name: databaseName,
      outputUriPrefix: outputUriPrefix,
      collectionIds: [] // Empty = export all collections
    });

    console.log(`✅ Backup started: ${response.name}`);
    res.json({
      success: true,
      operation: response.name,
      path: outputUriPrefix
    });
  } catch (error) {
    console.error('❌ Backup failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
EOF

# Deploy Cloud Function
gcloud functions deploy backupFirestore \
  --runtime=nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --project=law-office-system-e4801 \
  --region=us-central1 \
  --entry-point=backupFirestore
```

#### שלב 3: הגדרת Cloud Scheduler (ריצה אוטומטית)

```bash
# צור Job שרץ כל יום ב-2 בלילה
gcloud scheduler jobs create http daily-firestore-backup \
  --schedule="0 2 * * *" \
  --time-zone="Asia/Jerusalem" \
  --uri="https://us-central1-law-office-system-e4801.cloudfunctions.net/backupFirestore" \
  --http-method=POST \
  --project=law-office-system-e4801

# הפעל את ה-Scheduler
gcloud scheduler jobs run daily-firestore-backup \
  --project=law-office-system-e4801
```

**✅ עכשיו הגיבוי ירוץ אוטומטית כל לילה ב-2:00!**

---

### אופציה B: GitHub Actions (חינם אבל צריך Secrets)

צור קובץ `.github/workflows/backup-firestore.yml`:

```yaml
name: Daily Firestore Backup

on:
  schedule:
    # כל יום ב-2:00 בלילה (UTC+2 = 00:00)
    - cron: '0 0 * * *'
  workflow_dispatch: # אפשרות להפעלה ידנית

jobs:
  backup:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Google Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: law-office-system-e4801

      - name: Run Firestore Export
        run: |
          TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
          gcloud firestore export \
            gs://law-office-system-e4801-backups/backups/$TIMESTAMP \
            --project=law-office-system-e4801 \
            --database="(default)"

      - name: Notify Success
        if: success()
        run: echo "✅ Backup completed successfully"

      - name: Notify Failure
        if: failure()
        run: echo "❌ Backup failed!"
```

**הגדרת Secret:**
1. לך ל-GitHub → Settings → Secrets → Actions
2. הוסף Secret: `GCP_SA_KEY`
3. העתק את ה-Service Account JSON

---

## 3️⃣ גיבוי מקומי שבועי (אופציונלי)

### למה כדאי?
- 🏠 גיבוי **במחשב שלך** (לא בענן)
- 🔒 בטיחות מקסימלית (offline backup)
- 💰 **חינם לחלוטין**

### סקריפט גיבוי מקומי:

צור קובץ `scripts/local-backup.sh`:

```bash
#!/bin/bash

# הגדרות
PROJECT_ID="law-office-system-e4801"
BACKUP_DIR="$HOME/law-office-backups"
DATE=$(date +"%Y-%m-%d")

# צור תיקייה לגיבויים
mkdir -p "$BACKUP_DIR/$DATE"

echo "🔐 Starting local backup..."

# Export collections (דוגמה)
collections=("clients" "budget_tasks" "timesheet_entries" "employees" "audit_log")

for collection in "${collections[@]}"; do
    echo "📥 Downloading $collection..."

    # Export collection to JSON using Firebase CLI
    firebase firestore:export \
        --collection="$collection" \
        --output="$BACKUP_DIR/$DATE/$collection.json" \
        --project="$PROJECT_ID"
done

# דחיסה (חיסכון במקום)
echo "📦 Compressing backup..."
cd "$BACKUP_DIR"
tar -czf "backup-$DATE.tar.gz" "$DATE/"
rm -rf "$DATE"

echo "✅ Backup saved to: $BACKUP_DIR/backup-$DATE.tar.gz"

# מחיקת גיבויים ישנים (שמור רק 4 שבועות)
find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +28 -delete

echo "🎉 Local backup completed!"
```

**הפעלה:**
```bash
chmod +x scripts/local-backup.sh
./scripts/local-backup.sh
```

---

## 4️⃣ שחזור נתונים (Recovery)

### תרחיש 1: שחזור מ-PITR (7 ימים אחרונים)

```bash
# שחזור לתאריך ספציפי
gcloud firestore databases restore \
  --source-database="(default)" \
  --destination-database="(default)" \
  --restore-timestamp="2024-12-01T10:30:00Z" \
  --project=law-office-system-e4801
```

### תרחיש 2: שחזור מ-Cloud Storage Backup

```bash
# מצא את הגיבוי הרצוי
gsutil ls gs://law-office-system-e4801-backups/backups/

# שחזר
gcloud firestore import \
  gs://law-office-system-e4801-backups/backups/2024-12-01_02-00-00 \
  --project=law-office-system-e4801 \
  --database="(default)"
```

### תרחיש 3: שחזור מגיבוי מקומי

```bash
# חלץ את הגיבוי
cd ~/law-office-backups
tar -xzf backup-2024-12-01.tar.gz

# Upload חזרה ל-Firestore (collection אחד בכל פעם)
firebase firestore:import \
  --collection="clients" \
  --input="2024-12-01/clients.json" \
  --project=law-office-system-e4801
```

---

## 📊 השוואת אופציות

| תכונה | PITR | Cloud Export | Local Backup |
|-------|------|--------------|--------------|
| **תדירות** | Continuous | יומי | שבועי |
| **Retention** | 7 ימים | 30+ ימים | ללא הגבלה |
| **מהירות שחזור** | ⚡ דקות | 🐢 שעה | 🐌 שעות |
| **עלות** | $2-5/חודש | $1-3/חודש | חינם |
| **אוטומטי** | ✅ | ✅ | ❌ (ידני) |
| **Offline** | ❌ | ❌ | ✅ |

---

## 🎯 ההמלצה הסופית שלי

### **לעסק שלך (משרד עו"ד):**

1. **✅ הפעל PITR** - $2-5/חודש
   - מגן מפני טעויות אנוש (מחיקה בטעות)
   - שחזור מהיר (דקות)

2. **✅ הגדר Cloud Scheduler** - $1-3/חודש
   - גיבוי יומי אוטומטי
   - שמירת 30 ימים

3. **🤔 גיבוי מקומי** - חינם (אופציונלי)
   - פעם בשבוע/חודש ידנית
   - רק אם אתה רוצה **ביטחון נוסף**

**סה"כ: $3-8/חודש = ביטוח מצוין!** 🛡️

---

## 🚨 מתי כדאי גיבוי מקומי?

**כדאי אם:**
- ✅ יש לך נתונים רגישים מאוד (רפואה, משפט)
- ✅ אתה רוצה להיות 100% בטוח
- ✅ אתה רוצה גיבוי שלא תלוי בגוגל

**לא חובה אם:**
- ❌ אתה סומך על Google (99.999% reliability)
- ❌ PITR + Cloud Export מספיקים לך
- ❌ אין לך זמן לניהול ידני

---

## 📞 עזרה ותמיכה

בעיות נפוצות:

1. **"Permission denied" בעת Export**
   ```bash
   # הוסף הרשאות ל-Service Account
   gcloud projects add-iam-policy-binding law-office-system-e4801 \
     --member=serviceAccount:firebase-adminsdk@law-office-system-e4801.iam.gserviceaccount.com \
     --role=roles/datastore.importExportAdmin
   ```

2. **"Bucket not found"**
   ```bash
   # צור את ה-Bucket
   gsutil mb gs://law-office-system-e4801-backups
   ```

3. **בדיקת סטטוס של Export**
   ```bash
   gcloud firestore operations list --project=law-office-system-e4801
   ```

---

## ✅ Checklist סופי

- [ ] PITR מופעל
- [ ] Cloud Storage Bucket נוצר
- [ ] Cloud Function לגיבוי deployed
- [ ] Cloud Scheduler מוגדר (יומי)
- [ ] בדיקה ידנית: הרץ גיבוי אחד
- [ ] בדיקה: שחזור test collection
- [ ] (אופציונלי) גיבוי מקומי ראשון

**סיימת? מעולה! המערכת שלך מוגנת! 🎉**
