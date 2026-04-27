/**
 * Targeted backup — מייצא ל-JSON את כל המשימות שיש להן drift
 * בין actualMinutes ל-actualHours.
 *
 * READ-ONLY — לא כותב כלום ל-Firestore.
 *
 * מטרה: backup ממוקד לפני הרצת migration 001.
 * אם המיגרציה משבשת משימה, אפשר לשחזר ערכים מדויקים מה-JSON הזה.
 *
 * שימוש:
 *   node scripts/backup-drifted-tasks-2026-04-27.js
 *
 * פלט: backups/drifted-tasks-2026-04-27-<timestamp>.json
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  console.log('═'.repeat(70));
  console.log('💾 Targeted backup — drifted tasks');
  console.log('═'.repeat(70));

  // יוצר תיקייה אם לא קיימת
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log('\n📥 סורק את כל budget_tasks...');
  const snap = await db.collection('budget_tasks').get();
  console.log(`   נמצאו ${snap.size} משימות`);

  const drifted = [];

  snap.forEach(doc => {
    const t = doc.data();
    const m = Number(t.actualMinutes) || 0;
    const h = Number(t.actualHours) || 0;
    const hoursDiff = Math.abs(h * 60 - m);

    // אותה לוגיקה בדיוק כמו migration 001 (functions/migrations/001_fix_task_hours_minutes.js:84-86)
    if (hoursDiff > 1) {
      drifted.push({
        id: doc.id,
        beforeMigration: {
          actualMinutes: t.actualMinutes,
          actualHours: t.actualHours,
          hoursDiff: hoursDiff
        },
        contextSnapshot: {
          title: t.title,
          taskName: t.taskName,
          taskDescription: t.taskDescription,
          description: t.description,
          employee: t.employee,
          status: t.status,
          clientId: t.clientId,
          caseNumber: t.caseNumber,
          createdAt: t.createdAt && t.createdAt.toDate ? t.createdAt.toDate().toISOString() : t.createdAt,
          lastModifiedAt: t.lastModifiedAt && t.lastModifiedAt.toDate ? t.lastModifiedAt.toDate().toISOString() : t.lastModifiedAt
        },
        // המסמך המלא לצורכי שחזור מדויק
        fullDocument: t
      });
    }
  });

  console.log(`\n   🚨 נמצאו ${drifted.length} משימות עם drift > 1 דקה`);

  if (drifted.length === 0) {
    console.log('   אין מה לגבות. יוצא.');
    process.exit(0);
  }

  // Timestamp ב-ISO format (ידידותי לעין)
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const filename = `drifted-tasks-2026-04-27_${ts}.json`;
  const filepath = path.join(backupDir, filename);

  const backup = {
    metadata: {
      createdAt: new Date().toISOString(),
      purpose: 'Pre-migration-001 backup of budget_tasks with actualHours/actualMinutes drift',
      project: 'law-office-system-e4801',
      collection: 'budget_tasks',
      driftCriterion: 'Math.abs(actualHours * 60 - actualMinutes) > 1',
      taskCount: drifted.length,
      operator: 'haim@ghlawoffice.co.il',
      relatedMigration: '001_fix_task_hours_minutes'
    },
    tasks: drifted
  };

  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf8');

  console.log(`\n✅ Backup נשמר: ${filepath}`);
  console.log(`   גודל: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);

  console.log('\n📊 סיכום ה-drift:');
  console.table(drifted.map(d => ({
    id: d.id,
    actualMin: d.beforeMigration.actualMinutes,
    actualHrs: d.beforeMigration.actualHours,
    diff: d.beforeMigration.hoursDiff.toFixed(2),
    name: d.contextSnapshot.title || d.contextSnapshot.taskName || d.contextSnapshot.taskDescription || d.contextSnapshot.description || '<no-name>',
    status: d.contextSnapshot.status,
    employee: d.contextSnapshot.employee
  })));

  console.log('\n' + '═'.repeat(70));
  console.log('✅ Backup הושלם — מוכן להרצת dry-run של המיגרציה');
  console.log('═'.repeat(70));

  process.exit(0);
}

main().catch(err => {
  console.error('❌ שגיאה:', err);
  process.exit(1);
});
