/**
 * Debug Tool for Task Creation
 * כלי לאיתור בעיות ביצירת משימות
 *
 * שימוש:
 * 1. פתח את הקונסול (F12)
 * 2. טען את הקובץ: <script src="debug-task-creation.js"></script>
 * 3. או העתק את הקוד הזה לקונסול
 * 4. הרץ: window.debugTaskCreation()
 */

window.debugTaskCreation = function() {
  console.log('🔍 ===== Task Creation Debug Tool =====');
  console.log('');

  // בדיקה 1: האם Manager קיים?
  if (!window.manager) {
    console.error('❌ window.manager לא קיים!');
    return;
  }
  console.log('✅ Manager קיים');

  // בדיקה 2: כמה משימות יש?
  const tasks = window.manager.budgetTasks || [];
  console.log(`✅ סה"כ משימות: ${tasks.length}`);

  if (tasks.length === 0) {
    console.warn('⚠️ אין משימות בכלל! האם השמירה הצליחה?');
  } else {
    console.log('');
    console.log('📋 ===== המשימה האחרונה =====');
    const lastTask = tasks[0];

    console.log('תיאור:', lastTask.description || '❌ חסר');
    console.log('לקוח:', lastTask.clientName || '❌ חסר');
    console.log('מס\' תיק:', lastTask.caseNumber || '❌ חסר');
    console.log('Service ID:', lastTask.serviceId || '❌ חסר');
    console.log('Service Name:', lastTask.serviceName || '❌ חסר');

    console.log('');
    console.log('🔍 ===== ניתוח =====');

    if (!lastTask.caseNumber) {
      console.error('❌ caseNumber חסר - Badge סגול לא יופיע!');
    } else {
      console.log('✅ caseNumber קיים - Badge סגול אמור להופיע');
    }

    if (!lastTask.serviceId || !lastTask.serviceName) {
      console.error('❌ serviceId/serviceName חסרים - Badge ירוק לא יופיע!');
      console.log('💡 סיבה אפשרית: לא בחרת שירות/שלב בסלקטור');
    } else {
      console.log('✅ serviceId ו-serviceName קיימים - Badge ירוק אמור להופיע');
    }
  }

  console.log('');
  console.log('🔍 ===== בדיקת Selector =====');

  const selector = window.clientCaseSelectors?.budget;
  if (!selector) {
    console.error('❌ Budget selector לא קיים!');
    return;
  }
  console.log('✅ Budget selector קיים');

  // בדיקת ערכים נוכחיים
  const values = selector.getSelectedValues();
  if (!values) {
    console.warn('⚠️ אין ערכים נבחרים כרגע (הטופס סגור?)');
  } else {
    console.log('');
    console.log('📋 ===== ערכים נבחרים כרגע =====');
    console.log('Client ID:', values.clientId || '❌ לא נבחר');
    console.log('Client Name:', values.clientName || '❌ לא נבחר');
    console.log('Case ID:', values.caseId || '❌ לא נבחר');
    console.log('Case Number:', values.caseNumber || '❌ לא נבחר');
    console.log('Service ID:', values.serviceId || '❌ לא נבחר');
    console.log('Service Name:', values.serviceName || '❌ לא נבחר');

    if (!values.serviceId) {
      console.log('');
      console.log('💡 ===== הוראות =====');
      console.log('1. אם יש מספר שירותים/שלבים - חייב לבחור אחד!');
      console.log('2. לחץ על אחד הכרטיסים הירוקים בסלקטור');
      console.log('3. ואז נסה שוב ליצור משימה');
    }
  }

  console.log('');
  console.log('🔍 ===== בדיקת Rendering =====');

  // בדוק אם פונקציות הרינדור קיימות
  if (typeof createCaseNumberBadge === 'undefined') {
    console.error('❌ createCaseNumberBadge לא מוגדר!');
  } else {
    console.log('✅ createCaseNumberBadge קיים');
  }

  if (typeof createServiceBadge === 'undefined') {
    console.error('❌ createServiceBadge לא מוגדר!');
  } else {
    console.log('✅ createServiceBadge קיים');
  }

  console.log('');
  console.log('✅ ===== בדיקה הושלמה =====');
  console.log('');
  console.log('📝 הרץ את הפקודה הזו אחרי שתיצור משימה חדשה:');
  console.log('   debugTaskCreation()');
};

// בדיקה מיידית
console.log('✅ Debug tool loaded!');
console.log('🔍 הרץ: debugTaskCreation()');
console.log('');

// Auto-run if manager exists
if (window.manager) {
  console.log('🔍 ===== Auto-Running Debug =====');
  window.debugTaskCreation();
}
