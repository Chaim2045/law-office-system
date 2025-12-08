/**
 * 🔍 סקריפט בדיקת בעיית טבעות תאריך יעד - גרסה מתוקנת
 *
 * הוראות שימוש:
 * 1. פתח את index.html בדפדפן
 * 2. התחבר למערכת
 * 3. לחץ F12 לפתיחת Console
 * 4. העתק והדבק את כל הקוד הזה
 * 5. לחץ Enter
 */

(async function debugDeadlineIssue() {
  console.clear();
  console.log('%c🔍 מתחיל בדיקת טבעות תאריך יעד...', 'font-size: 18px; font-weight: bold; color: #2563eb;');

  const now = new Date();
  console.log('⏰ זמן עכשיו:', now.toLocaleString('he-IL'));

  // בדוק שיש גישה ל-Firebase
  if (!window.firebaseDB) {
    console.error('❌ Firebase DB לא זמין! וודא שאתה מחובר למערכת.');
    return;
  }

  try {
    console.log('\n📊 טוען משימות מ-Firestore...\n');

    // טען את כל משימות התקציב של חיים (עם המייל הנכון!)
    const snapshot = await window.firebaseDB
      .collection('budget_tasks')
      .where('employee', '==', 'haim@ghlawoffice.co.il')
      .get();

    console.log(`✅ נמצאו ${snapshot.size} משימות\n`);

    const results = {
      total: 0,
      withDeadline: 0,
      createdAfterDeadline: 0,
      lowProgressButOverdue: 0,
      bigDifference: 0,
      problems: [],
      ok: []
    };

    const tableData = [];

    snapshot.forEach((doc) => {
      const task = doc.data();
      results.total++;

      // רק משימות עם deadline
      if (!task.deadline) {
        return;
      }

      results.withDeadline++;

      // המרת תאריכים
      const deadline = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);
      const createdAt = task.createdAt
        ? (task.createdAt.toDate ? task.createdAt.toDate() : new Date(task.createdAt))
        : now;

      // 🔧 חישוב לפי הלוגיקה הנוכחית (הבעייתית)
      const startDate = createdAt < deadline ? createdAt : deadline;
      const totalDays = Math.max(1, (deadline - startDate) / (1000 * 60 * 60 * 24));
      const elapsedDays = (now - startDate) / (1000 * 60 * 60 * 24);
      const currentProgress = Math.max(0, Math.round((elapsedDays / totalDays) * 100));

      // ✅ חישוב נכון (מה שצריך להיות)
      const correctTotalDays = Math.max(1, (deadline - createdAt) / (1000 * 60 * 60 * 24));
      const correctElapsedDays = (now - createdAt) / (1000 * 60 * 60 * 24);
      const correctProgress = Math.max(0, Math.round((correctElapsedDays / correctTotalDays) * 100));

      const daysUntilDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      const isOverdue = daysUntilDeadline < 0;
      const isCreatedAfterDeadline = createdAt > deadline;
      const progressDiff = correctProgress - currentProgress;

      // זיהוי בעיות
      let problemType = '';
      let isProblem = false;

      if (isCreatedAfterDeadline) {
        problemType = '❌ נוצר אחרי יעד';
        isProblem = true;
        results.createdAfterDeadline++;
      } else if (isOverdue && currentProgress < 80) {
        problemType = '⚠️ איחור + % נמוך';
        isProblem = true;
        results.lowProgressButOverdue++;
      } else if (Math.abs(progressDiff) > 10) {
        problemType = '⚠️ הפרש גדול';
        isProblem = true;
        results.bigDifference++;
      }

      const taskInfo = {
        '🆔': doc.id.substring(0, 8),
        '📋 תיאור': (task.description || 'אין').substring(0, 40),
        '👤 לקוח': (task.clientName || 'לא צוין').substring(0, 20),
        '📅 נוצר': createdAt.toLocaleDateString('he-IL'),
        '⏰ יעד': deadline.toLocaleDateString('he-IL'),
        '⏱️ ימים': daysUntilDeadline + (isOverdue ? ' ⛔' : ' ✅'),
        '❌ נוכחי': currentProgress + '%',
        '✅ נכון': correctProgress + '%',
        '📊 הפרש': progressDiff + '%',
        '🔍 בעיה': problemType || '✅ תקין'
      };

      if (isProblem) {
        results.problems.push(taskInfo);
      } else {
        results.ok.push(taskInfo);
      }

      tableData.push(taskInfo);
    });

    // הצג סטטיסטיקות
    console.log('%c📊 סטטיסטיקות', 'font-size: 16px; font-weight: bold; color: #059669; background: #d1fae5; padding: 5px 10px; border-radius: 4px;');
    console.log(`  סה"כ משימות: ${results.total}`);
    console.log(`  עם תאריך יעד: ${results.withDeadline}`);
    console.log(`  %c❌ נוצרו אחרי יעד: ${results.createdAfterDeadline}`, 'color: #dc2626; font-weight: bold;');
    console.log(`  %c⚠️ איחור + % נמוך: ${results.lowProgressButOverdue}`, 'color: #ea580c; font-weight: bold;');
    console.log(`  %c⚠️ הפרש גדול (>10%): ${results.bigDifference}`, 'color: #f59e0b; font-weight: bold;');
    console.log(`  %c✅ תקינות: ${results.ok.length}`, 'color: #059669; font-weight: bold;');
    console.log('\n');

    // הצג משימות בעייתיות
    if (results.problems.length > 0) {
      console.log('%c❌ משימות בעייתיות (' + results.problems.length + ')', 'font-size: 16px; font-weight: bold; color: #dc2626; background: #fee2e2; padding: 5px 10px; border-radius: 4px;');
      console.table(results.problems);
      console.log('\n');
    }

    // הצג את כל המשימות
    console.log('%c📋 כל המשימות', 'font-size: 16px; font-weight: bold; color: #2563eb; background: #dbeafe; padding: 5px 10px; border-radius: 4px;');
    console.table(tableData);

    // סיכום הבעיה
    console.log('\n%c🎯 אבחון הבעיה:', 'font-size: 16px; font-weight: bold; color: #7c3aed; background: #ede9fe; padding: 5px 10px; border-radius: 4px;');

    if (results.createdAfterDeadline > 0) {
      console.log('%c❌ בעיה חמורה: יש משימות שנוצרו AFTER תאריך היעד!', 'color: #dc2626; font-weight: bold; font-size: 14px;');
      console.log('   הלוגיקה הנוכחית משתמשת ב-deadline בתור startDate במקרים אלה.');
      console.log('   זה גורם לחישובים שגויים לחלוטין!\n');
    }

    if (results.lowProgressButOverdue > 0) {
      console.log('%c⚠️ יש משימות באיחור אבל מציגות אחוזים נמוכים', 'color: #ea580c; font-weight: bold; font-size: 14px;');
      console.log('   המשתמש לא יודע שהמשימה באיחור כי הטבעת נראית כאילו רק התחילה!\n');
    }

    if (results.bigDifference > 0) {
      console.log('%c⚠️ יש הפרשים גדולים בין החישוב הנוכחי לנכון', 'color: #f59e0b; font-weight: bold; font-size: 14px;');
      console.log('   הטבעות מציגות מידע לא מדויק למשתמש.\n');
    }

    // המלצות
    console.log('\n%c💡 פתרון מומלץ:', 'font-size: 16px; font-weight: bold; color: #059669; background: #d1fae5; padding: 5px 10px; border-radius: 4px;');
    console.log('1. הסר את השורה: const startDate = createdAt < deadline ? createdAt : deadline;');
    console.log('2. תמיד השתמש ב-createdAt בתור תחילת החישוב');
    console.log('3. החישוב צריך להיות:');
    console.log('   const totalDays = (deadline - createdAt) / (1000 * 60 * 60 * 24);');
    console.log('   const elapsedDays = (now - createdAt) / (1000 * 60 * 60 * 24);');
    console.log('   const progress = (elapsedDays / totalDays) * 100;');
    console.log('\n✅ זה יתן תוצאות נכונות, כולל מעל 100% למשימות באיחור!');

  } catch (error) {
    console.error('❌ שגיאה:', error);
    console.error('פרטים:', error.message);
  }
})();
