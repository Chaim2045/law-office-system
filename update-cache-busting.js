#!/usr/bin/env node

/**
 * Cache Busting Script - Simple & Effective
 * עדכון אוטומטי של version parameters בכל הקבצים
 *
 * מה הסקריפט עושה:
 * 1. מנסה לקבל git commit hash (אם קיים)
 * 2. אם אין git - משתמש ב-timestamp
 * 3. מחליף את כל ה-?v=X.X.X עם ?v=[git-hash]
 * 4. שומר את הקובץ
 *
 * רץ אוטומטית לפני כל build
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ניסיון לקבל git commit hash
let version;
try {
  const gitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  version = `v=${gitHash}`;
  console.log(`🔄 מעדכן cache busting עם git hash: ${version}`);
} catch (error) {
  // אם אין git, משתמשים ב-timestamp
  const timestamp = Date.now();
  version = `v=${timestamp}`;
  console.log(`🔄 Git לא זמין, משתמש ב-timestamp: ${version}`);
}

// קבצים לעדכן
const filesToUpdate = [
  'apps/user-app/index.html',
  'master-admin-panel/index.html'
];

let totalUpdates = 0;
let filesUpdated = 0;

filesToUpdate.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);

  // בדיקה שהקובץ קיים
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  קובץ לא נמצא: ${filePath}`);
    return;
  }

  try {
    // קריאת הקובץ
    let content = fs.readFileSync(fullPath, 'utf8');

    // ספירת כמה החלפות נעשו
    const matches = content.match(/\?v=[^"'>]*/g);
    const count = matches ? matches.length : 0;

    // החלפה של כל ה-?v=XXX עם version חדש
    content = content.replace(/\?v=[^"'>]*/g, `?${version}`);

    // שמירת הקובץ
    fs.writeFileSync(fullPath, content, 'utf8');

    console.log(`✅ עודכן: ${filePath} (${count} קישורים)`);
    totalUpdates += count;
    filesUpdated++;
  } catch (error) {
    console.error(`❌ שגיאה בעדכון ${filePath}:`, error.message);
  }
});

console.log(`\n✨ הושלם! ${filesUpdated} קבצים עודכנו, ${totalUpdates} קישורים עם ${version}`);
