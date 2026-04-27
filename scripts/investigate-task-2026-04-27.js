/**
 * חקירת משימה — read-only
 *
 * שימוש:
 *   node scripts/investigate-task-2026-04-27.js <taskId>
 *   node scripts/investigate-task-2026-04-27.js --search "עריכת בקשה להבהרה"
 *   node scripts/investigate-task-2026-04-27.js --case 2025897
 *
 * מטרה: לאבחן למה completeTask מחזיר "לא ניתן לסיים משימה ללא רישומי זמן"
 * בודק:
 *   1. מסמך המשימה ב-budget_tasks (actualHours / actualMinutes / title / timeEntries)
 *   2. רישומי timesheet_entries המקושרים ל-taskId
 *   3. drift בין מקור-אמת (timesheet_entries) לאגרגט (actualMinutes במשימה)
 *
 * READ-ONLY — לא כותב כלום.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function fmt(v) {
  if (v === undefined) {
return '<undefined>';
}
  if (v === null) {
return '<null>';
}
  if (v && typeof v.toDate === 'function') {
return v.toDate().toISOString();
}
  if (typeof v === 'object') {
return JSON.stringify(v);
}
  return String(v);
}

async function inspectTask(taskId) {
  console.log('═'.repeat(70));
  console.log(`🔍 בודק משימה: ${taskId}`);
  console.log('═'.repeat(70));

  const taskDoc = await db.collection('budget_tasks').doc(taskId).get();
  if (!taskDoc.exists) {
    console.log(`❌ משימה לא נמצאה ב-budget_tasks/${taskId}`);
    return;
  }

  const t = taskDoc.data();
  console.log('\n📄 שדות במסמך המשימה:');
  console.log(`   title:           ${fmt(t.title)}`);
  console.log(`   taskName:        ${fmt(t.taskName)}`);
  console.log(`   name:            ${fmt(t.name)}`);
  console.log(`   description:     ${fmt(t.description)}`);
  console.log(`   employee:        ${fmt(t.employee)}`);
  console.log(`   clientId:        ${fmt(t.clientId)}`);
  console.log(`   caseNumber:      ${fmt(t.caseNumber)}`);
  console.log(`   status:          ${fmt(t.status)}`);
  console.log(`   budgetHours:     ${fmt(t.budgetHours)}`);
  console.log(`   actualHours:     ${fmt(t.actualHours)}`);
  console.log(`   actualMinutes:   ${fmt(t.actualMinutes)}`);
  console.log(`   timeEntries:     ${Array.isArray(t.timeEntries) ? `array(${t.timeEntries.length})` : fmt(t.timeEntries)}`);
  console.log(`   createdAt:       ${fmt(t.createdAt)}`);
  console.log(`   lastModifiedAt:  ${fmt(t.lastModifiedAt)}`);

  console.log('\n📋 כל השדות במסמך (raw):');
  Object.keys(t).sort().forEach(k => {
    if (k === 'timeEntries') {
return;
}
    console.log(`   ${k}: ${fmt(t[k])}`);
  });

  if (Array.isArray(t.timeEntries) && t.timeEntries.length > 0) {
    console.log(`\n📝 timeEntries (${t.timeEntries.length} פריטים):`);
    t.timeEntries.forEach((e, i) => {
      console.log(`   [${i}] minutes=${e.minutes} date=${fmt(e.date)} user=${e.user || e.userEmail || '?'}`);
    });
    const sumMinutes = t.timeEntries.reduce((s, e) => s + (Number(e.minutes) || 0), 0);
    console.log(`   סכום דקות ב-timeEntries: ${sumMinutes}`);
  }

  console.log('\n' + '─'.repeat(70));
  console.log('🔎 חיפוש ב-timesheet_entries לפי taskId...');

  const tsSnap = await db.collection('timesheet_entries')
    .where('taskId', '==', taskId)
    .get();

  if (tsSnap.empty) {
    console.log(`   ❌ אין שום רישום ב-timesheet_entries עם taskId=${taskId}`);
  } else {
    console.log(`   ✅ נמצאו ${tsSnap.size} רישומי זמן:`);
    let totalMinutes = 0;
    tsSnap.forEach(d => {
      const e = d.data();
      const min = Number(e.minutes) || 0;
      totalMinutes += min;
      console.log(`      [${d.id}] minutes=${min} date=${fmt(e.date)} action=${e.action} user=${e.userEmail || e.user}`);
    });
    console.log(`   📊 סך הכל דקות: ${totalMinutes} = ${(totalMinutes / 60).toFixed(2)} שעות`);

    const taskActualMin = Number(t.actualMinutes) || 0;
    if (totalMinutes !== taskActualMin) {
      console.log('\n   ⚠️  DRIFT זוהה!');
      console.log(`      timesheet_entries מסכמים ל-${totalMinutes} דקות`);
      console.log(`      task.actualMinutes = ${taskActualMin} דקות`);
      console.log(`      הפרש: ${totalMinutes - taskActualMin} דקות`);
    } else {
      console.log(`\n   ✅ אין drift — task.actualMinutes (${taskActualMin}) תואם לסכום timesheet_entries`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🎯 אבחנה:');
  const ah = Number(t.actualHours) || 0;
  if (ah === 0) {
    console.log('   completeTask נחסם כי task.actualHours === 0');
    console.log(`   שדה השם שמופיע ב-undefined: title=${fmt(t.title)} (אבל taskName=${fmt(t.taskName)})`);
  } else {
    console.log(`   task.actualHours = ${ah} — לא אמור להיחסם. בדוק שוב.`);
  }
  console.log('═'.repeat(70));
}

async function searchByName(needle) {
  console.log(`🔎 מחפש משימות עם שם שמכיל: "${needle}"`);
  const snap = await db.collection('budget_tasks').get();
  const matches = [];
  snap.forEach(d => {
    const t = d.data();
    const fields = [t.title, t.taskName, t.name, t.description].filter(Boolean).join(' | ');
    if (fields.includes(needle)) {
      matches.push({ id: d.id, fields, employee: t.employee, status: t.status });
    }
  });
  console.log(`   נמצאו ${matches.length} התאמות:`);
  matches.forEach(m => {
    console.log(`   - ${m.id} | employee=${m.employee} | status=${m.status} | ${m.fields}`);
  });
  return matches;
}

async function searchByCase(caseNumber) {
  console.log(`🔎 מחפש משימות לפי caseNumber=${caseNumber}`);
  const snap = await db.collection('budget_tasks')
    .where('caseNumber', '==', caseNumber)
    .get();
  if (snap.empty) {
    console.log('   לא נמצא — מנסה גם כמספר...');
    const snap2 = await db.collection('budget_tasks')
      .where('caseNumber', '==', Number(caseNumber))
      .get();
    if (snap2.empty) {
      console.log('   ❌ לא נמצאו משימות לתיק זה');
      return [];
    }
    snap2.forEach(d => {
      const t = d.data();
      console.log(`   - ${d.id} | ${t.title || t.taskName || '<no-name>'} | employee=${t.employee} | status=${t.status}`);
    });
    return snap2.docs;
  }
  snap.forEach(d => {
    const t = d.data();
    console.log(`   - ${d.id} | ${t.title || t.taskName || '<no-name>'} | employee=${t.employee} | status=${t.status}`);
  });
  return snap.docs;
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--search' && args[1]) {
    await searchByName(args[1]);
  } else if (args[0] === '--case' && args[1]) {
    const docs = await searchByCase(args[1]);
    if (docs && docs.length === 1) {
      console.log('\n→ נמצאה משימה אחת, בודק אותה במלואה:\n');
      await inspectTask(docs[0].id);
    }
  } else if (args[0]) {
    await inspectTask(args[0]);
  } else {
    console.log('שימוש:');
    console.log('  node scripts/investigate-task-2026-04-27.js <taskId>');
    console.log('  node scripts/investigate-task-2026-04-27.js --search "<name fragment>"');
    console.log('  node scripts/investigate-task-2026-04-27.js --case <caseNumber>');
    process.exit(1);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ שגיאה:', err);
  process.exit(1);
});