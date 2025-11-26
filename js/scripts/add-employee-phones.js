/**
 * Employee Phone Number Mapping Script
 * ======================================
 * סקריפט להוספת מספרי טלפון לעובדים קיימים
 *
 * @version 1.0.0
 * @created 2025-11-26
 * @author Law Office System
 *
 * שימוש:
 * ------
 * 1. פתח את הקונסול בדפדפן (F12)
 * 2. התחבר למערכת כמנהל
 * 3. הרץ את הקוד הבא:
 *    await addPhoneNumbersToEmployees()
 *
 * הערה: יש לעדכן את מספרי הטלפון הרלוונטיים לפני הרצה
 */

// ==========================================
// רשימת עובדים ומספרי טלפון
// ==========================================

const EMPLOYEE_PHONE_MAPPING = [
  // עורכי דין ראשיים
  {
    email: 'guy@law.co.il',
    name: 'גיא הרשקוביץ',
    phone: '+972501234567',  // 📱 החלף למספר האמיתי
    role: 'partner'
  },
  {
    email: 'haim@law.co.il',
    name: 'חיים פרץ',
    phone: '+972521234567',  // 📱 החלף למספר האמיתי
    role: 'partner'
  },

  // עובדים נוספים
  {
    email: 'sarah@law.co.il',
    name: 'שרה כהן',
    phone: '+972531234567',  // 📱 החלף למספר האמיתי
    role: 'employee'
  },
  {
    email: 'david@law.co.il',
    name: 'דוד לוי',
    phone: '+972541234567',  // 📱 החלף למספר האמיתי
    role: 'employee'
  },
  {
    email: 'rachel@law.co.il',
    name: 'רחל ישראלי',
    phone: '+972551234567',  // 📱 החלף למספר האמיתי
    role: 'secretary'
  },

  // מנהל מערכת
  {
    email: 'admin@law.co.il',
    name: 'מנהל מערכת',
    phone: '+972501234500',  // 📱 החלף למספר האמיתי
    role: 'admin'
  }
];

// ==========================================
// פונקציה ראשית להוספת מספרי טלפון
// ==========================================

async function addPhoneNumbersToEmployees() {
  console.log('🚀 מתחיל תהליך הוספת מספרי טלפון לעובדים...');
  console.log('━'.repeat(50));

  // בדיקת הרשאות
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    console.error('❌ אתה לא מחובר למערכת. אנא התחבר תחילה.');
    return;
  }

  // בדיקת Firebase
  if (!firebase || !firebase.firestore) {
    console.error('❌ Firebase לא מאותחל');
    return;
  }

  const db = firebase.firestore();
  const batch = db.batch();

  let successCount = 0;
  let errorCount = 0;
  const results = [];

  // עיבוד כל עובד
  for (const employee of EMPLOYEE_PHONE_MAPPING) {
    try {
      // בדיקה אם העובד קיים
      const docRef = db.collection('employees').doc(employee.email);
      const doc = await docRef.get();

      if (doc.exists) {
        const currentData = doc.data();

        // בדיקה אם כבר יש מספר טלפון
        if (currentData.phone) {
          console.log(`ℹ️  ${employee.name} - כבר יש מספר: ${currentData.phone}`);
          results.push({
            email: employee.email,
            name: employee.name,
            status: 'exists',
            currentPhone: currentData.phone,
            newPhone: employee.phone
          });
        } else {
          // הוספת מספר טלפון
          batch.update(docRef, {
            phone: employee.phone,
            phoneVerified: false,  // דורש אימות
            phoneAddedAt: firebase.firestore.FieldValue.serverTimestamp(),
            phoneAddedBy: currentUser.email
          });

          console.log(`✅ ${employee.name} - נוסף מספר: ${employee.phone}`);
          results.push({
            email: employee.email,
            name: employee.name,
            status: 'added',
            phone: employee.phone
          });
          successCount++;
        }
      } else {
        console.warn(`⚠️  ${employee.name} - לא נמצא במערכת`);
        results.push({
          email: employee.email,
          name: employee.name,
          status: 'not_found'
        });
        errorCount++;
      }

    } catch (error) {
      console.error(`❌ שגיאה בעיבוד ${employee.name}:`, error);
      results.push({
        email: employee.email,
        name: employee.name,
        status: 'error',
        error: error.message
      });
      errorCount++;
    }
  }

  // ביצוע העדכונים
  if (successCount > 0) {
    try {
      await batch.commit();
      console.log('━'.repeat(50));
      console.log(`✅ העדכון הושלם בהצלחה!`);
      console.log(`   📊 נוספו: ${successCount} מספרים`);
      console.log(`   ⚠️  שגיאות: ${errorCount}`);
    } catch (error) {
      console.error('❌ שגיאה בשמירת הנתונים:', error);
    }
  } else {
    console.log('━'.repeat(50));
    console.log('ℹ️  אין עדכונים לביצוע');
  }

  // הצגת סיכום
  displaySummary(results);

  return results;
}

// ==========================================
// פונקציית עזר להצגת סיכום
// ==========================================

function displaySummary(results) {
  console.log('\n📋 סיכום פעולות:');
  console.log('━'.repeat(50));

  // קיבוץ לפי סטטוס
  const grouped = results.reduce((acc, item) => {
    if (!acc[item.status]) acc[item.status] = [];
    acc[item.status].push(item);
    return acc;
  }, {});

  // הצגת תוצאות
  if (grouped.added) {
    console.log('\n✅ מספרים שנוספו:');
    grouped.added.forEach(item => {
      console.log(`   • ${item.name}: ${item.phone}`);
    });
  }

  if (grouped.exists) {
    console.log('\n📱 כבר יש מספר טלפון:');
    grouped.exists.forEach(item => {
      console.log(`   • ${item.name}: ${item.currentPhone}`);
      if (item.currentPhone !== item.newPhone) {
        console.log(`     (מספר חדש מוצע: ${item.newPhone})`);
      }
    });
  }

  if (grouped.not_found) {
    console.log('\n⚠️  עובדים לא נמצאו:');
    grouped.not_found.forEach(item => {
      console.log(`   • ${item.name} (${item.email})`);
    });
  }

  if (grouped.error) {
    console.log('\n❌ שגיאות:');
    grouped.error.forEach(item => {
      console.log(`   • ${item.name}: ${item.error}`);
    });
  }

  console.log('━'.repeat(50));
}

// ==========================================
// פונקציה לבדיקת מספרי טלפון
// ==========================================

async function verifyPhoneNumbers() {
  console.log('🔍 בודק מספרי טלפון של עובדים...');
  console.log('━'.repeat(50));

  const db = firebase.firestore();
  const snapshot = await db.collection('employees').get();

  const employees = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    employees.push({
      email: doc.id,
      name: data.name || data.username,
      phone: data.phone,
      phoneVerified: data.phoneVerified,
      role: data.role
    });
  });

  // מיון לפי סטטוס
  const withPhone = employees.filter(e => e.phone);
  const withoutPhone = employees.filter(e => !e.phone);

  console.log(`📊 סטטיסטיקה:`);
  console.log(`   • סה"כ עובדים: ${employees.length}`);
  console.log(`   • עם מספר טלפון: ${withPhone.length}`);
  console.log(`   • ללא מספר טלפון: ${withoutPhone.length}`);

  if (withPhone.length > 0) {
    console.log('\n✅ עובדים עם מספר טלפון:');
    withPhone.forEach(e => {
      const verified = e.phoneVerified ? '✓' : '✗';
      console.log(`   ${verified} ${e.name}: ${e.phone}`);
    });
  }

  if (withoutPhone.length > 0) {
    console.log('\n⚠️  עובדים ללא מספר טלפון:');
    withoutPhone.forEach(e => {
      console.log(`   • ${e.name} (${e.email})`);
    });
  }

  console.log('━'.repeat(50));

  return { withPhone, withoutPhone };
}

// ==========================================
// פונקציה לעדכון מספר בודד
// ==========================================

async function updateSingleEmployeePhone(email, phone) {
  try {
    const db = firebase.firestore();
    const docRef = db.collection('employees').doc(email);

    await docRef.update({
      phone: phone,
      phoneVerified: false,
      phoneUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ מספר הטלפון של ${email} עודכן ל-${phone}`);
    return true;

  } catch (error) {
    console.error(`❌ שגיאה בעדכון:`, error);
    return false;
  }
}

// ==========================================
// פונקציה למחיקת מספר טלפון
// ==========================================

async function removeEmployeePhone(email) {
  try {
    const db = firebase.firestore();
    const docRef = db.collection('employees').doc(email);

    await docRef.update({
      phone: firebase.firestore.FieldValue.delete(),
      phoneVerified: firebase.firestore.FieldValue.delete()
    });

    console.log(`✅ מספר הטלפון של ${email} הוסר`);
    return true;

  } catch (error) {
    console.error(`❌ שגיאה במחיקה:`, error);
    return false;
  }
}

// ==========================================
// מספרי בדיקה למצב פיתוח
// ==========================================

const TEST_PHONE_NUMBERS = {
  '+972501234567': '123456',  // מספר בדיקה 1
  '+972521234567': '111111',  // מספר בדיקה 2
  '+972531234567': '222222',  // מספר בדיקה 3
  '+972541234567': '333333',  // מספר בדיקה 4
  '+972551234567': '444444'   // מספר בדיקה 5
};

// ==========================================
// Export לשימוש גלובלי
// ==========================================

if (typeof window !== 'undefined') {
  window.phoneManagement = {
    addPhoneNumbersToEmployees,
    verifyPhoneNumbers,
    updateSingleEmployeePhone,
    removeEmployeePhone,
    EMPLOYEE_PHONE_MAPPING,
    TEST_PHONE_NUMBERS
  };

  console.log('📱 Phone Management Script Loaded');
  console.log('   השתמש ב: phoneManagement.addPhoneNumbersToEmployees()');
  console.log('   לבדיקה: phoneManagement.verifyPhoneNumbers()');
}

// הוראות הרצה
console.log(`
╔════════════════════════════════════════════════════╗
║          📱 הוראות להוספת מספרי טלפון              ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║  1. עדכן את המספרים ב-EMPLOYEE_PHONE_MAPPING      ║
║  2. פתח את הקונסול (F12)                          ║
║  3. התחבר כמנהל                                    ║
║  4. הרץ:                                           ║
║     await phoneManagement.addPhoneNumbersToEmployees() ║
║                                                    ║
║  לבדיקת מצב:                                       ║
║     await phoneManagement.verifyPhoneNumbers()     ║
║                                                    ║
╚════════════════════════════════════════════════════╝
`);