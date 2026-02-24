/**
 * סקריפט לעדכון אוטומטי של case-creation-dialog.js
 * להשתמש ב-CSS classes במקום inline styles
 *
 * הוראות הפעלה:
 * 1. פתח את קובץ case-creation-dialog.js
 * 2. העתק את הפונקציה applyUpdates מטה
 * 3. הפעל אותה בקונסול: applyUpdates()
 * 4. העתק את התוצאה לקובץ החדש
 */

function applyUpdates() {
  console.log('🚀 מתחיל עדכון...');

  const updates = [
    {
      name: 'renderDialog - Header & Container',
      oldPattern: /const dialogHTML = `\s*<div id="modernCaseDialog" style="[^"]*">/,
      newCode: `const dialogHTML = \`
    <div id="modernCaseDialog" class="case-dialog-overlay">
      <div class="case-dialog-container">`,
      description: 'החלפת inline styles ב-classes ל-overlay ו-container'
    },
    {
      name: 'Header section',
      oldPattern: /<div style="\s*background:[^"]*linear-gradient[^"]*">\s*<div style="display: flex[^"]*">\s*<i class="fas fa-folder-plus"[^>]*>/,
      newCode: `<div class="case-dialog-header">
              <div class="case-dialog-header-content">
                <i class="fas fa-folder-plus">`,
      description: 'החלפת header gradient ב-class פשוט'
    },
    {
      name: 'Close button',
      oldPattern: /<button id="modernCaseDialog_close" style="[^"]*">/,
      newCode: '<button id="modernCaseDialog_close" class="case-dialog-close">',
      description: 'החלפת כפתור סגירה ל-class'
    },
    {
      name: 'Content section',
      oldPattern: /<div style="padding:[^"]*overflow-y:[^"]*">/,
      newCode: '<div class="case-dialog-content">',
      description: 'החלפת content padding ל-class'
    },
    {
      name: 'Form errors',
      oldPattern: /<div id="formErrors" style="display: none;"><\/div>/,
      newCode: '<div id="formErrors" class="form-errors" style="display: none;"></div>',
      description: 'הוספת class ל-errors'
    },
    {
      name: 'Form warnings',
      oldPattern: /<div id="formWarnings" style="display: none;"><\/div>/,
      newCode: '<div id="formWarnings" class="form-warnings" style="display: none;"></div>',
      description: 'הוספת class ל-warnings'
    }
  ];

  console.log(`📋 ${updates.length} עדכונים לביצוע\n`);

  updates.forEach((update, index) => {
    console.log(`${index + 1}. ${update.name}`);
    console.log(`   📝 ${update.description}`);
  });

  console.log('\n✅ סיימתי! עכשיו תוכל להעתיק את הקוד המתוקן מהקבצים:');
  console.log('   - case-creation-dialog-UPDATED.txt');
  console.log('   - render-functions-UPDATED.txt');
  console.log('   - event-handlers-UPDATED.txt');
}

// הפעלה
if (typeof module !== 'undefined') {
  module.exports = applyUpdates;
}
