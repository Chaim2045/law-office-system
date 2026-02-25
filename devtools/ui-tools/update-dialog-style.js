/**
 * סקריפט Node.js לעדכון הדיאלוג - רק header + buttons
 * עדכון זהיר לפי כללי הפרויקט
 */

const fs = require('fs');
const path = require('path');

function updateDialogFile() {
  console.log('🚀 מתחיל עדכון...\n');

  const filePath = path.join(__dirname, 'js', 'modules', 'case-creation', 'case-creation-dialog.js');

  // קריאת הקובץ
  let content = fs.readFileSync(filePath, 'utf-8');

  // ✅ שינוי 1: Overlay div
  content = content.replace(
    /<div id="modernCaseDialog" style="[^"]*">/,
    '<div id="modernCaseDialog" class="case-dialog-overlay">'
  );

  // ✅ שינוי 2: Container div
  content = content.replace(
    /(<div id="modernCaseDialog"[^>]*>\s*)<div style="\s*background: white;[\s\S]*?animation: slideUp[^"]*">/,
    '$1<div class="case-dialog-container">'
  );

  // ✅ שינוי 3: Header section
  content = content.replace(
    /<!-- Header -->\s*<div style="[\s\S]*?linear-gradient[\s\S]*?">/,
    '<!-- Header -->\n            <div class="case-dialog-header">'
  );

  // ✅ שינוי 4: Header content div
  content = content.replace(
    /(<div class="case-dialog-header">\s*)<div style="display: flex;[^"]*">/,
    '$1<div class="case-dialog-header-content">'
  );

  // ✅ שינוי 5: הסרת style מהאייקון בheader
  content = content.replace(
    /<i class="fas fa-folder-plus" style="[^"]*">/,
    '<i class="fas fa-folder-plus">'
  );

  // ✅ שינוי 6: הסרת style מה-h2
  content = content.replace(
    /<h2 style="[^"]*">תיק חדש<\/h2>/,
    '<h2>תיק חדש</h2>'
  );

  // ✅ שינוי 7: כפתור סגירה
  content = content.replace(
    /<button id="modernCaseDialog_close" style="[\s\S]*?">/,
    '<button id="modernCaseDialog_close" class="case-dialog-close">'
  );

  // ✅ שינוי 8: Content div
  content = content.replace(
    /<!-- Content -->\s*<div style="padding:[^"]*">/,
    '<!-- Content -->\n            <div class="case-dialog-content">'
  );

  // ✅ שינוי 9: Buttons container
  content = content.replace(
    /<div style="\s*display: flex;[\s\S]*?justify-content: flex-end;[\s\S]*?">/,
    '<div class="case-dialog-actions">'
  );

  // ✅ שינוי 10: כפתור ביטול
  content = content.replace(
    /<button type="button" id="modernCaseDialog_cancel" style="[\s\S]*?">/,
    '<button type="button" id="modernCaseDialog_cancel" class="btn btn-secondary">'
  );

  // ✅ שינוי 11: כפתור שמירה
  content = content.replace(
    /<button type="submit" style="[\s\S]*?linear-gradient[\s\S]*?">/,
    '<button type="submit" class="btn btn-primary">'
  );

  // ✅ שינוי 12: הסרת style מאייקון השמירה
  content = content.replace(
    /<i class="fas fa-save" style="[^"]*">/,
    '<i class="fas fa-save">'
  );

  // ✅ שינוי 13: הסרת <style> בסוף
  content = content.replace(
    /<style>[\s\S]*?@keyframes[\s\S]*?<\/style>/,
    '<!-- Animations moved to case-creation-dialog.css -->'
  );

  // שמירת הקובץ
  fs.writeFileSync(filePath, content, 'utf-8');

  console.log('✅ הקובץ עודכן בהצלחה!');
  console.log(`📁 ${filePath}\n`);
  console.log('🔍 שינויים שבוצעו:');
  console.log('  1. ✅ Overlay div → class="case-dialog-overlay"');
  console.log('  2. ✅ Container div → class="case-dialog-container"');
  console.log('  3. ✅ Header section → class="case-dialog-header"');
  console.log('  4. ✅ Header content → class="case-dialog-header-content"');
  console.log('  5. ✅ Close button → class="case-dialog-close"');
  console.log('  6. ✅ Content div → class="case-dialog-content"');
  console.log('  7. ✅ Buttons container → class="case-dialog-actions"');
  console.log('  8. ✅ Cancel button → class="btn btn-secondary"');
  console.log('  9. ✅ Submit button → class="btn btn-primary"');
  console.log(' 10. ✅ הסרת inline styles מאייקונים');
  console.log(' 11. ✅ הסרת <style> tags (אנימציות)\n');
  console.log('🎨 עכשיו הדיאלוג משתמש בסטייל Linear/Vercel!');
  console.log('\n📝 לבדיקה:');
  console.log('   1. פתח את הדפדפן');
  console.log('   2. לחץ על "תיק חדש"');
  console.log('   3. בדוק את העיצוב החדש');
}

try {
  updateDialogFile();
} catch (error) {
  console.error('❌ שגיאה:', error.message);
  console.error(error.stack);
  process.exit(1);
}
