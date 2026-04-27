/**
 * Reconcile drifted tasks — קובע מה מקור-האמת לכל משימה.
 *
 * READ-ONLY — לא כותב כלום.
 *
 * לכל משימה עם drift, סוכם את כל timesheet_entries המקושרים אליה,
 * ומשווה ל-3 נתונים:
 *   1. actualMinutes (במשימה)
 *   2. actualHours * 60 (במשימה)
 *   3. SUM(timesheet_entries.minutes) — מקור-האמת האמיתי
 *
 * מסווג כל משימה לאחת מהקטגוריות:
 *   - actualMinutes_correct: actualMinutes תואם ל-SUM(entries)
 *   - actualHours_correct: actualHours*60 תואם ל-SUM(entries)
 *   - both_wrong: שניהם לא תואמים ל-SUM(entries)
 *   - no_entries: אין timesheet_entries בכלל (משימה יתומה?)
 *
 * שימוש:
 *   node scripts/reconcile-drifted-tasks-2026-04-27.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const TOLERANCE_MIN = 1; // סובלנות של דקה אחת

async function reconcileTask(taskId, taskData) {
  // שאילתה ל-timesheet_entries
  const tsSnap = await db.collection('timesheet_entries')
    .where('taskId', '==', taskId)
    .get();

  let sumEntriesMin = 0;
  const entries = [];
  tsSnap.forEach(doc => {
    const e = doc.data();
    const min = Number(e.minutes) || 0;
    sumEntriesMin += min;
    entries.push({
      id: doc.id,
      minutes: min,
      action: e.action,
      date: e.date && e.date.toDate ? e.date.toDate().toISOString().split('T')[0] : e.date
    });
  });

  const actualMinutes = Number(taskData.actualMinutes) || 0;
  const actualHours = Number(taskData.actualHours) || 0;
  const actualHoursAsMinutes = actualHours * 60;

  const diffMinutes = Math.abs(actualMinutes - sumEntriesMin);
  const diffHours = Math.abs(actualHoursAsMinutes - sumEntriesMin);

  let category;
  if (entries.length === 0) {
    category = 'no_entries';
  } else if (diffMinutes <= TOLERANCE_MIN && diffHours <= TOLERANCE_MIN) {
    category = 'both_correct';
  } else if (diffMinutes <= TOLERANCE_MIN) {
    category = 'actualMinutes_correct';
  } else if (diffHours <= TOLERANCE_MIN) {
    category = 'actualHours_correct';
  } else {
    category = 'both_wrong';
  }

  return {
    taskId,
    name: taskData.title || taskData.taskName || taskData.taskDescription || taskData.description || '<no-name>',
    employee: taskData.employee,
    status: taskData.status,
    actualMinutes,
    actualHours,
    actualHoursAsMinutes,
    sumEntriesMin,
    entriesCount: entries.length,
    diffFromMinutes: diffMinutes,
    diffFromHours: diffHours,
    category,
    entries
  };
}

async function main() {
  console.log('═'.repeat(70));
  console.log('🔬 Reconcile drifted tasks — חוקר מה מקור-האמת');
  console.log('═'.repeat(70));

  console.log('\n📥 שולף את כל המשימות עם drift...');
  const allSnap = await db.collection('budget_tasks').get();
  const drifted = [];

  allSnap.forEach(doc => {
    const t = doc.data();
    const m = Number(t.actualMinutes) || 0;
    const h = Number(t.actualHours) || 0;
    const hoursDiff = Math.abs(h * 60 - m);
    if (hoursDiff > TOLERANCE_MIN) {
      drifted.push({ id: doc.id, data: t });
    }
  });

  console.log(`   נמצאו ${drifted.length} משימות עם drift\n`);

  const results = [];
  for (const { id, data } of drifted) {
    const result = await reconcileTask(id, data);
    results.push(result);
  }

  // סיווג לפי קטגוריה
  const byCategory = {};
  results.forEach(r => {
    if (!byCategory[r.category]) {
byCategory[r.category] = [];
}
    byCategory[r.category].push(r);
  });

  console.log('📊 סיווג לפי מקור-אמת:');
  console.log('─'.repeat(70));
  Object.keys(byCategory).sort().forEach(cat => {
    console.log(`   ${cat}: ${byCategory[cat].length} משימות`);
  });

  console.log('\n' + '═'.repeat(70));
  console.log('🔍 פירוט מלא:');
  console.log('═'.repeat(70));

  // מציג טבלה ברורה
  console.table(results.map(r => ({
    id: r.taskId,
    name: r.name.length > 40 ? r.name.slice(0, 37) + '...' : r.name,
    actualMin: r.actualMinutes,
    actualHrs: Number(r.actualHours.toFixed(2)),
    sumEntries: r.sumEntriesMin,
    entries: r.entriesCount,
    diffMin: r.diffFromMinutes,
    diffHrs: r.diffFromHours,
    category: r.category,
    status: r.status
  })));

  // המלצה לכל קטגוריה
  console.log('\n' + '═'.repeat(70));
  console.log('💡 המלצות לפי קטגוריה:');
  console.log('═'.repeat(70));

  if (byCategory.actualMinutes_correct) {
    console.log(`\n✅ actualMinutes_correct (${byCategory.actualMinutes_correct.length} משימות):`);
    console.log('   actualMinutes הוא הנכון — המיגרציה תתקן את actualHours בבטחה.');
    console.log('   המשימות:');
    byCategory.actualMinutes_correct.forEach(r => {
      console.log(`      ${r.taskId} | ${r.name} | min=${r.actualMinutes} hrs=${r.actualHours.toFixed(2)} entries=${r.sumEntriesMin}`);
    });
  }

  if (byCategory.actualHours_correct) {
    console.log(`\n⚠️  actualHours_correct (${byCategory.actualHours_correct.length} משימות):`);
    console.log('   actualHours הוא הנכון — המיגרציה תיצור regression!');
    console.log('   המשימות (אסור להפעיל עליהן את המיגרציה הרגילה):');
    byCategory.actualHours_correct.forEach(r => {
      console.log(`      ${r.taskId} | ${r.name} | min=${r.actualMinutes} hrs=${r.actualHours.toFixed(2)} entries=${r.sumEntriesMin}`);
    });
  }

  if (byCategory.both_wrong) {
    console.log(`\n🚨 both_wrong (${byCategory.both_wrong.length} משימות):`);
    console.log('   שני השדות שגויים — דורש בדיקה ידנית של חיים!');
    console.log('   המשימות:');
    byCategory.both_wrong.forEach(r => {
      console.log(`      ${r.taskId} | ${r.name}`);
      console.log(`         employee=${r.employee} status=${r.status}`);
      console.log(`         actualMinutes=${r.actualMinutes} actualHours=${r.actualHours.toFixed(2)} (=${r.actualHoursAsMinutes.toFixed(0)} min)`);
      console.log(`         SUM(entries)=${r.sumEntriesMin} (${r.entriesCount} רישומים)`);
      console.log(`         פער מ-actualMinutes: ${r.diffFromMinutes.toFixed(0)} min`);
      console.log(`         פער מ-actualHours: ${r.diffFromHours.toFixed(0)} min`);
    });
  }

  if (byCategory.no_entries) {
    console.log(`\n❓ no_entries (${byCategory.no_entries.length} משימות):`);
    console.log('   אין רישומי timesheet — איך הגיעו ל-actualMinutes/actualHours גדולים מ-0?');
    console.log('   המשימות:');
    byCategory.no_entries.forEach(r => {
      console.log(`      ${r.taskId} | ${r.name} | min=${r.actualMinutes} hrs=${r.actualHours.toFixed(2)}`);
    });
  }

  console.log('\n' + '═'.repeat(70));

  process.exit(0);
}

main().catch(err => {
  console.error('❌ שגיאה:', err);
  process.exit(1);
});
