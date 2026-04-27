/**
 * Deep investigation — חקירה עמוקה של 17 המשימות עם drift
 *
 * READ-ONLY — לא כותב כלום.
 *
 * לכל משימה בודק:
 * 1. כל timesheet_entries שלה — תאריך יצירה, editHistory, שדות חשודים
 * 2. task.timeEntries array — תואם לקולקציה?
 * 3. תאריכי יצירה של ה-entries (לפני/אחרי 2026-03-01 שזה תאריך יצירת ה-trigger)
 * 4. שדות חשודים במסמך המשימה (_legacyHours, imported, etc)
 *
 * מטרה: למצוא הסבר ל-13h drift של חזי מאנע ושאר המשימות.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TRIGGER_INTRO_DATE = new Date('2026-03-01T21:02:43Z'); // commit b47a2ee
const ADD_TIME_FIX_DATE = new Date('2026-03-29T00:09:12Z'); // commit 0626a47

const TASK_IDS = [
  '2W5Wg1fIG4cUp0ztIaf3',
  '3WDSI9wXvmTEKqwyq88b',
  'BpBMUVqAH91FIf1xCeC3',
  'CT4OsYVCjsLnFwmFCGMW',
  'Frny7mO0CPX1YvomNGrF',
  'IGiYD36ACFfYvUoZPEqb',
  'LHMmuAhTBjPgilsUqTyV',
  'OVoJoXQVcAejVAi3to0K',
  'Ui4uAACrLGPjULXISiPG',
  'Xu37x7Xz699WY18KZnCy',
  'bWxybxmEU4TEwyI3pwrG',
  'gMJm6Jz3RYzNikM4rlGF',
  'gtVMonmFjQFOK3FCdipN',
  'mvKdFsLgiKnKXFCMQtVd',
  'oObFT88iKgna0eR5gzFm',
  'xEGU4HH93cuotp3Eulq8',
  'zzfq2SBHg0b9cQvA3eMD'
];

function fmtDate(v) {
  if (!v) {
return null;
}
  if (v.toDate) {
return v.toDate().toISOString();
}
  if (typeof v === 'string') {
return v;
}
  if (v.seconds) {
return new Date(v.seconds * 1000).toISOString();
}
  return String(v);
}

function dateAsObj(v) {
  if (!v) {
return null;
}
  if (v.toDate) {
return v.toDate();
}
  if (typeof v === 'string') {
return new Date(v);
}
  if (v.seconds) {
return new Date(v.seconds * 1000);
}
  return null;
}

async function investigateTask(taskId) {
  const taskDoc = await db.collection('budget_tasks').doc(taskId).get();
  if (!taskDoc.exists) {
return null;
}

  const task = taskDoc.data();
  const taskCreatedAt = dateAsObj(task.createdAt);
  const taskName = task.title || task.taskName || task.taskDescription || task.description || '<no-name>';

  // שדות חשודים שיכולים להעיד על import / legacy
  const suspiciousFields = {};
  ['_legacyHours', '_originalActualHours', '_imported', '_migratedFrom',
   '_importBatch', 'legacyMinutes', 'importedFrom', 'historicalActualHours',
   '_oldActualHours', '_oldActualMinutes', 'manualOverride', 'adjustedHours'].forEach(field => {
    if (task[field] !== undefined) {
suspiciousFields[field] = task[field];
}
  });

  // task.timeEntries array
  const taskTimeEntries = Array.isArray(task.timeEntries) ? task.timeEntries : [];
  const taskTimeEntriesSum = taskTimeEntries.reduce((s, e) => s + (Number(e.minutes) || 0), 0);

  // timesheet_entries collection
  const entriesSnap = await db.collection('timesheet_entries').where('taskId', '==', taskId).get();
  const entries = [];
  entriesSnap.forEach(d => {
    const e = d.data();
    entries.push({
      id: d.id,
      minutes: Number(e.minutes) || 0,
      date: e.date,
      createdAt: dateAsObj(e.createdAt),
      lastModifiedAt: dateAsObj(e.lastModifiedAt),
      editHistory: e.editHistory,
      isQuickLog: e.isQuickLog,
      action: e.action,
      hasSuspicious: !!(e._imported || e._legacy || e._migrated || e.manualEdit)
    });
  });

  const entriesSum = entries.reduce((s, e) => s + e.minutes, 0);
  const entriesBeforeTrigger = entries.filter(e => e.createdAt && e.createdAt < TRIGGER_INTRO_DATE);
  const entriesAfterTrigger = entries.filter(e => e.createdAt && e.createdAt >= TRIGGER_INTRO_DATE);
  const entriesNoCreatedAt = entries.filter(e => !e.createdAt);
  const entriesEdited = entries.filter(e => Array.isArray(e.editHistory) && e.editHistory.length > 0);
  const entriesQuickLog = entries.filter(e => e.isQuickLog);

  return {
    taskId,
    taskName,
    taskCreatedAt: fmtDate(task.createdAt),
    actualMinutes: Number(task.actualMinutes) || 0,
    actualHours: Number(task.actualHours) || 0,
    actualHoursAsMinutes: (Number(task.actualHours) || 0) * 60,
    suspiciousFields,
    taskTimeEntries: {
      count: taskTimeEntries.length,
      sumMinutes: taskTimeEntriesSum
    },
    entriesCollection: {
      count: entries.length,
      sumMinutes: entriesSum,
      beforeTrigger: entriesBeforeTrigger.length,
      afterTrigger: entriesAfterTrigger.length,
      noCreatedAt: entriesNoCreatedAt.length,
      edited: entriesEdited.length,
      quickLog: entriesQuickLog.length
    },
    diagnostics: {
      taskTimeEntries_vs_collection: taskTimeEntriesSum - entriesSum,
      collection_vs_actualMinutes: entriesSum - (Number(task.actualMinutes) || 0),
      actualHours_vs_collection: ((Number(task.actualHours) || 0) * 60) - entriesSum,
      driftMinutes: ((Number(task.actualHours) || 0) * 60) - (Number(task.actualMinutes) || 0)
    },
    editedEntriesDetails: entriesEdited.map(e => ({
      id: e.id,
      currentMinutes: e.minutes,
      editCount: e.editHistory.length,
      firstEdit: e.editHistory[0]
    }))
  };
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🔬 Deep investigation — מקור ה-drift');
  console.log('═'.repeat(80));
  console.log(`Trigger נוצר: ${TRIGGER_INTRO_DATE.toISOString()}`);
  console.log(`addTimeToTask actualHours fix: ${ADD_TIME_FIX_DATE.toISOString()}`);
  console.log('═'.repeat(80));

  const results = [];
  for (const taskId of TASK_IDS) {
    const r = await investigateTask(taskId);
    if (r) {
results.push(r);
}
  }

  // ───────────────────────────────────────────
  // ניתוח 1: שדות חשודים במשימות
  // ───────────────────────────────────────────
  console.log('\n📋 [1/5] שדות חשודים במסמכי המשימות:');
  console.log('─'.repeat(80));
  let foundAny = false;
  results.forEach(r => {
    if (Object.keys(r.suspiciousFields).length > 0) {
      foundAny = true;
      console.log(`   ${r.taskId} (${r.taskName.slice(0, 40)}):`);
      Object.entries(r.suspiciousFields).forEach(([k, v]) => {
        console.log(`      ${k} = ${JSON.stringify(v)}`);
      });
    }
  });
  if (!foundAny) {
console.log('   ✅ אין שדות חשודים (legacy/imported/migrated) במשימות');
}

  // ───────────────────────────────────────────
  // ניתוח 2: סנכרון בין task.timeEntries ל-collection
  // ───────────────────────────────────────────
  console.log('\n📋 [2/5] task.timeEntries (array פנימי) vs timesheet_entries (collection):');
  console.log('─'.repeat(80));
  console.log('   diff = task.timeEntries.sum - collection.sum');
  console.log('   אם ≠ 0: יש פער בין ה-array הפנימי לבין הקולקציה.\n');

  console.table(results.map(r => ({
    id: r.taskId.slice(0, 8) + '..',
    'task.te.count': r.taskTimeEntries.count,
    'task.te.sum': r.taskTimeEntries.sumMinutes,
    'coll.count': r.entriesCollection.count,
    'coll.sum': r.entriesCollection.sumMinutes,
    diff: r.diagnostics.taskTimeEntries_vs_collection
  })));

  // ───────────────────────────────────────────
  // ניתוח 3: timing של ה-entries (לפני/אחרי trigger)
  // ───────────────────────────────────────────
  console.log('\n📋 [3/5] תאריכי יצירת timesheet_entries (לפני/אחרי 2026-03-01):');
  console.log('─'.repeat(80));
  console.table(results.map(r => ({
    id: r.taskId.slice(0, 8) + '..',
    name: r.taskName.slice(0, 30),
    taskCreated: r.taskCreatedAt ? r.taskCreatedAt.slice(0, 10) : '?',
    entries: r.entriesCollection.count,
    beforeTrig: r.entriesCollection.beforeTrigger,
    afterTrig: r.entriesCollection.afterTrigger,
    noDate: r.entriesCollection.noCreatedAt,
    edited: r.entriesCollection.edited,
    quickLog: r.entriesCollection.quickLog
  })));

  // ───────────────────────────────────────────
  // ניתוח 4: עריכות
  // ───────────────────────────────────────────
  console.log('\n📋 [4/5] רישומים שעברו עריכה (editHistory):');
  console.log('─'.repeat(80));
  let editFound = false;
  results.forEach(r => {
    if (r.editedEntriesDetails.length > 0) {
      editFound = true;
      console.log(`\n   ${r.taskId} (${r.taskName.slice(0, 40)}):`);
      console.log(`      drift: ${r.diagnostics.driftMinutes.toFixed(0)} min`);
      r.editedEntriesDetails.forEach(e => {
        console.log(`      ${e.id}: currentMinutes=${e.currentMinutes}, editCount=${e.editCount}`);
        console.log(`         firstEdit: ${JSON.stringify(e.firstEdit).slice(0, 200)}`);
      });
    }
  });
  if (!editFound) {
console.log('   ✅ אין עריכות מתועדות באף רישום');
}

  // ───────────────────────────────────────────
  // ניתוח 5: סיכום diagnostics לכל משימה
  // ───────────────────────────────────────────
  console.log('\n📋 [5/5] Diagnostics — איפה ה-drift?');
  console.log('─'.repeat(80));
  console.log('   coll-actMin  = SUM(entries) - actualMinutes  (אם 0 → סנכרון תקין בין collection ל-actualMinutes)');
  console.log('   actHrs-coll  = actualHours*60 - SUM(entries) (אם ≠ 0 → ה-drift מקורו פה)');
  console.log('   drift        = actualHours*60 - actualMinutes (הפער שזיהינו)');
  console.log('');

  console.table(results.map(r => ({
    id: r.taskId.slice(0, 8) + '..',
    actualMin: r.actualMinutes,
    actualHrsAsMin: r.actualHoursAsMinutes.toFixed(0),
    SUMentries: r.entriesCollection.sumMinutes,
    'coll-actMin': r.diagnostics.collection_vs_actualMinutes,
    'actHrs-coll': r.diagnostics.actualHours_vs_collection.toFixed(1),
    drift: r.diagnostics.driftMinutes.toFixed(1)
  })));

  // ───────────────────────────────────────────
  // סיכום
  // ───────────────────────────────────────────
  console.log('\n' + '═'.repeat(80));
  console.log('🎯 סיכום:');
  console.log('═'.repeat(80));

  const allEntriesAfterTrigger = results.every(r =>
    r.entriesCollection.beforeTrigger === 0 && r.entriesCollection.noCreatedAt === 0
  );
  const anyEdited = results.some(r => r.entriesCollection.edited > 0);
  const anySuspicious = results.some(r => Object.keys(r.suspiciousFields).length > 0);
  const allCollectionMatchesMin = results.every(r => r.diagnostics.collection_vs_actualMinutes === 0);

  console.log(`   ✓ כל ה-entries אחרי 2026-03-01 (trigger קיים): ${allEntriesAfterTrigger ? 'כן' : 'לא'}`);
  console.log(`   ✓ יש רישומים עם editHistory: ${anyEdited ? 'כן' : 'לא'}`);
  console.log(`   ✓ יש שדות חשודים במשימות: ${anySuspicious ? 'כן' : 'לא'}`);
  console.log(`   ✓ SUM(entries) === actualMinutes ב-100%: ${allCollectionMatchesMin ? 'כן' : 'לא'}`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ שגיאה:', err);
  process.exit(1);
});
