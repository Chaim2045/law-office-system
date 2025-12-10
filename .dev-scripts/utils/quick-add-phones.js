/**
 * Quick Phone Number Addition Script
 * ===================================
 * סקריפט מהיר להוספת מספרי טלפון - מריץ ישירות מהקונסול
 *
 * שימוש: העתק והדבק את כל הקוד בקונסול
 */

// רשימת העובדים עם המספרים
const PHONES_TO_ADD = [
  { email: 'guy@ghlawoffice.co.il', name: 'גיא', phone: '+972542400403' },
  { email: 'haim@ghlawoffice.co.il', name: 'חיים', phone: '+972549539238' },
  { email: 'marva@ghlawoffice.co.il', name: 'מרווה', phone: '+972523923173' },
  { email: 'miri@ghlawoffice.co.il', name: 'מירי', phone: '+972506470007' },
  { email: 'raad@ghlawoffice.co.il', name: 'ראיד', phone: '+972509247629' },
  { email: 'roi@ghlawoffice.co.il', name: 'רועי', phone: '+972508807935' },
  { email: 'shahar@ghlawoffice.co.il', name: 'שחר', phone: '+972523777295' },
  { email: 'uri@ghlawoffice.co.il', name: 'אורי', phone: '+972525014146' },
  { email: 'uzi@ghlawoffice.co.il', name: 'עוזי', phone: '+972523433379' }
];

// פונקציה להוספת המספרים
async function quickAddPhones() {
  console.log('🚀 מתחיל להוסיף מספרי טלפון...');
  console.log('━'.repeat(50));

  // בדיקה שFirebase זמין
  if (!window.firebase || !window.firebase.firestore) {
    console.error('❌ Firebase לא זמין. וודא שאתה בעמוד הנכון');
    return;
  }

  const db = firebase.firestore();
  const batch = db.batch();
  let successCount = 0;
  let skipCount = 0;

  for (const emp of PHONES_TO_ADD) {
    try {
      const docRef = db.collection('employees').doc(emp.email);
      const doc = await docRef.get();

      if (doc.exists) {
        const currentData = doc.data();

        // בדיקה אם כבר יש מספר
        if (currentData.phone && currentData.phone === emp.phone) {
          console.log(`✓ ${emp.name} - כבר יש את המספר הנכון`);
          skipCount++;
        } else if (currentData.phone) {
          console.log(`⚠️ ${emp.name} - יש מספר אחר: ${currentData.phone}`);
          console.log(`   מעדכן ל: ${emp.phone}`);
          batch.update(docRef, {
            phone: emp.phone,
            phoneVerified: false,
            phoneUpdatedAt: new Date()
          });
          successCount++;
        } else {
          // אין מספר - מוסיף
          batch.update(docRef, {
            phone: emp.phone,
            phoneVerified: false,
            phoneAddedAt: new Date()
          });
          console.log(`✅ ${emp.name} - נוסף מספר: ${emp.phone}`);
          successCount++;
        }
      } else {
        console.warn(`❌ ${emp.name} - לא נמצא במערכת (${emp.email})`);
      }
    } catch (error) {
      console.error(`❌ שגיאה עם ${emp.name}:`, error.message);
    }
  }

  // שמירת השינויים
  if (successCount > 0) {
    try {
      await batch.commit();
      console.log('━'.repeat(50));
      console.log(`✅ הושלם! עודכנו ${successCount} מספרים`);
      if (skipCount > 0) {
        console.log(`ℹ️ דולגו ${skipCount} (כבר היה מספר נכון)`);
      }
    } catch (error) {
      console.error('❌ שגיאה בשמירה:', error);
    }
  } else {
    console.log('━'.repeat(50));
    console.log('ℹ️ אין עדכונים לביצוע');
  }
}

// הרצה אוטומטית
quickAddPhones();