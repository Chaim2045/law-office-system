/**
 * בדיקה האם migration 001_fix_task_hours_minutes רצה אי-פעם
 *
 * READ-ONLY — לא כותב כלום
 *
 * בודק:
 * 1. כמה משימות עם _migrationVersion === 1 (סימן שהמיגרציה רצה)
 * 2. כמה משימות עם actualMinutes > 0 ו-actualHours === 0 (תרחיש מרווה)
 * 3. כמה משימות עם hoursDiff > 1 (תרחיש כללי שהמיגרציה הייתה אמורה לתפוס)
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  console.log('═'.repeat(70));
  console.log('🔍 בדיקת סטטוס migration 001');
  console.log('═'.repeat(70));

  // בדיקה 1: האם המיגרציה רצה?
  console.log('\n[1/3] בודק האם migration 001 רצה...');
  const migratedSnap = await db.collection('budget_tasks')
    .where('_migrationVersion', '==', 1)
    .get();
  console.log(`   משימות עם _migrationVersion=1: ${migratedSnap.size}`);
  if (migratedSnap.size > 0) {
    console.log('   ✅ המיגרציה רצה (לפחות חלקית)');
    const sample = migratedSnap.docs[0].data();
    console.log(`   דוגמה — taskId: ${migratedSnap.docs[0].id}`);
    console.log(`            _migratedAt: ${sample._migratedAt && sample._migratedAt.toDate ? sample._migratedAt.toDate().toISOString() : sample._migratedAt}`);
    console.log(`            _oldActualHours: ${sample._oldActualHours}`);
  } else {
    console.log('   ❌ המיגרציה מעולם לא רצה ב-Firestore הזה');
  }

  // בדיקה 2: כמה משימות במצב מרווה (actualMinutes > 0, actualHours === 0)?
  console.log('\n[2/3] סורק משימות לזיהוי מצבי drift...');
  const allSnap = await db.collection('budget_tasks').get();
  console.log(`   סך הכל משימות: ${allSnap.size}`);

  let marwaPattern = 0;          // actualMinutes > 0, actualHours === 0
  let driftPattern = 0;          // hoursDiff > 1 minute
  let noActivity = 0;             // actualMinutes === 0, actualHours === 0
  let cleanPattern = 0;           // both > 0 and aligned
  const marwaSamples = [];

  allSnap.forEach(doc => {
    const t = doc.data();
    const m = Number(t.actualMinutes) || 0;
    const h = Number(t.actualHours) || 0;
    const hoursDiff = Math.abs(h * 60 - m);

    if (m === 0 && h === 0) {
      noActivity++;
    } else if (m > 0 && h === 0) {
      marwaPattern++;
      if (marwaSamples.length < 10) {
        marwaSamples.push({
          id: doc.id,
          actualMinutes: m,
          actualHours: h,
          name: t.title || t.taskName || t.description || '<no-name>',
          status: t.status,
          createdAt: t.createdAt && t.createdAt.toDate ? t.createdAt.toDate().toISOString().split('T')[0] : t.createdAt,
          employee: t.employee
        });
      }
    } else if (hoursDiff > 1) {
      driftPattern++;
    } else {
      cleanPattern++;
    }
  });

  console.log(`\n   ✅ תקין (actualHours == actualMinutes/60): ${cleanPattern}`);
  console.log(`   ⚪ ללא פעילות (שניהם 0): ${noActivity}`);
  console.log(`   🚨 תרחיש מרווה (actualMinutes>0, actualHours=0): ${marwaPattern}`);
  console.log(`   ⚠️  drift אחר (אי-תאימות > 1 דקה): ${driftPattern}`);

  // בדיקה 3: דוגמאות מתרחיש מרווה
  if (marwaSamples.length > 0) {
    console.log('\n[3/3] דוגמאות לתרחיש מרווה:');
    console.table(marwaSamples);
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🎯 סיכום:');
  if (migratedSnap.size === 0 && marwaPattern > 0) {
    console.log(`   המיגרציה לא רצה. ${marwaPattern} משימות במצב שמונע סיום.`);
  } else if (migratedSnap.size > 0 && marwaPattern > 0) {
    console.log(`   המיגרציה רצה (${migratedSnap.size} תוקנו), אבל ${marwaPattern} משימות חדשות שוב במצב הזה.`);
    console.log('   זה אומר ש-flow כלשהו עדיין יוצר drift אחרי המיגרציה.');
  } else if (migratedSnap.size > 0 && marwaPattern === 0) {
    console.log('   המיגרציה רצה והכל נקי. תרחיש מרווה לא אמור לקרות.');
  } else {
    console.log('   אין drift כרגע.');
  }
  console.log('═'.repeat(70));

  process.exit(0);
}

main().catch(err => {
  console.error('❌ שגיאה:', err);
  process.exit(1);
});