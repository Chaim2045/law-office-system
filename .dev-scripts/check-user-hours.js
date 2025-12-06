/**
 * בדיקת נתוני שעתון של משתמש חיים
 */

const admin = require('firebase-admin');

// Initialize without service account
admin.initializeApp();

const db = admin.firestore();

async function checkUserHours() {
  try {
    console.log('🔍 בודק רשומות שעתון של חיים...\n');

    // Find employee "חיים"
    const employeesSnapshot = await db.collection('employees')
      .where('name', '==', 'חיים פרץ')
      .limit(1)
      .get();

    if (employeesSnapshot.empty) {
      // Try different variations
      const allEmployees = await db.collection('employees').get();
      console.log('📋 רשימת כל העובדים:');
      allEmployees.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${doc.id}: ${data.name || 'ללא שם'}`);
      });
      return;
    }

    const employeeDoc = employeesSnapshot.docs[0];
    const employeeEmail = employeeDoc.id;
    console.log(`✅ נמצא עובד: ${employeeEmail}\n`);

    // Get timesheet entries
    const timesheetSnapshot = await db.collection('timesheet_entries')
      .where('employee', '==', employeeEmail)
      .orderBy('date', 'desc')
      .limit(20)
      .get();

    console.log(`📊 נמצאו ${timesheetSnapshot.size} רשומות אחרונות\n`);

    if (timesheetSnapshot.empty) {
      console.log('⚠️  אין רשומות שעתון');
      return;
    }

    console.log('📋 רשומות אחרונות:\n');
    timesheetSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. [${doc.id}]`);
      console.log(`   תאריך: ${data.date}`);
      console.log(`   hours: ${data.hours !== undefined ? data.hours : '❌ חסר'}`);
      console.log(`   minutes: ${data.minutes !== undefined ? data.minutes : '❌ חסר'}`);
      console.log(`   clientId: ${data.clientId || 'אין'}`);
      console.log(`   taskId: ${data.taskId || 'אין'}`);
      console.log(`   description: ${data.description || 'אין'}`);

      // Check for inconsistency
      if (data.hours !== undefined && data.minutes !== undefined) {
        const expectedHours = data.minutes / 60;
        const diff = Math.abs(data.hours - expectedHours);
        if (diff > 0.01) {
          console.log(`   ⚠️  אי-עקביות: hours=${data.hours}, צפוי=${expectedHours.toFixed(2)}`);
        }
      } else if (data.hours === undefined && data.minutes !== undefined) {
        console.log(`   ⚠️  חסר שדה hours! (יש רק minutes=${data.minutes})`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ שגיאה:', error);
  }

  process.exit(0);
}

checkUserHours();
