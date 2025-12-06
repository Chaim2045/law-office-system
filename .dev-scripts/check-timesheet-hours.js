/**
 * Script to check for timesheet entries missing 'hours' field
 * בדיקת רשומות שעות ללא שדה hours
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkTimesheetEntries() {
  console.log('🔍 בודק רשומות שעתון...\n');

  try {
    const snapshot = await db.collection('timesheet_entries').get();

    console.log(`📊 סה"כ רשומות: ${snapshot.size}\n`);

    if (snapshot.size === 0) {
      console.log('⚠️  אין רשומות בקולקציה timesheet_entries');
      return;
    }

    let missingHours = 0;
    let missingMinutes = 0;
    let missingBoth = 0;
    let validEntries = 0;
    let inconsistent = 0;

    const problems = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      const hasHours = data.hours !== undefined && data.hours !== null;
      const hasMinutes = data.minutes !== undefined && data.minutes !== null;

      // בדיקת עקביות
      if (hasHours && hasMinutes) {
        const calculatedHours = data.minutes / 60;
        const diff = Math.abs(data.hours - calculatedHours);

        if (diff > 0.001) { // טעות עיגול מותרת
          inconsistent++;
          problems.push({
            id: doc.id,
            issue: 'אי-עקביות',
            minutes: data.minutes,
            hours: data.hours,
            expected: calculatedHours,
            employee: data.employee || data.lawyer,
            date: data.date
          });
        } else {
          validEntries++;
        }
      } else if (!hasHours && !hasMinutes) {
        missingBoth++;
        problems.push({
          id: doc.id,
          issue: 'חסר hours ו-minutes',
          employee: data.employee || data.lawyer,
          date: data.date
        });
      } else if (!hasHours) {
        missingHours++;
        problems.push({
          id: doc.id,
          issue: 'חסר hours',
          minutes: data.minutes,
          employee: data.employee || data.lawyer,
          date: data.date
        });
      } else if (!hasMinutes) {
        missingMinutes++;
        problems.push({
          id: doc.id,
          issue: 'חסר minutes',
          hours: data.hours,
          employee: data.employee || data.lawyer,
          date: data.date
        });
      }
    });

    console.log('📈 תוצאות:\n');
    console.log(`✅ רשומות תקינות: ${validEntries}`);
    console.log(`❌ חסר hours: ${missingHours}`);
    console.log(`❌ חסר minutes: ${missingMinutes}`);
    console.log(`❌ חסר שניהם: ${missingBoth}`);
    console.log(`⚠️  אי-עקביות: ${inconsistent}`);

    if (problems.length > 0) {
      console.log('\n🔴 רשימת בעיות:\n');
      problems.slice(0, 10).forEach((p, i) => {
        console.log(`${i + 1}. [${p.id}]`);
        console.log(`   בעיה: ${p.issue}`);
        console.log(`   עובד: ${p.employee || 'לא ידוע'}`);
        console.log(`   תאריך: ${p.date || 'לא ידוע'}`);
        if (p.minutes !== undefined) console.log(`   minutes: ${p.minutes}`);
        if (p.hours !== undefined) console.log(`   hours: ${p.hours}`);
        if (p.expected !== undefined) console.log(`   צפוי: ${p.expected}`);
        console.log('');
      });

      if (problems.length > 10) {
        console.log(`... ועוד ${problems.length - 10} בעיות\n`);
      }
    }

    console.log('\n✅ הבדיקה הושלמה!');

  } catch (error) {
    console.error('❌ שגיאה:', error);
  }

  process.exit(0);
}

checkTimesheetEntries();
