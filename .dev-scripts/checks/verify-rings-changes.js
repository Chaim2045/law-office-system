/**
 * 🔍 סקריפט בדיקת שינויים בטבעות - התקציב ותאריך היעד
 *
 * הוראות שימוש:
 * 1. פתח את index.html בדפדפן
 * 2. התחבר למערכת
 * 3. עבור לתצוגת כרטיסיות
 * 4. לחץ F12 לפתיחת Console
 * 5. העתק והדבק את כל הקוד הזה
 * 6. לחץ Enter
 * 7. תקבל דוח מפורט על כל הרינגים בדף
 */

(function verifyRingsChanges() {
  console.clear();
  console.log('%c🔍 בודק שינויים ברינגים...', 'font-size: 18px; font-weight: bold; color: #2563eb;');

  const results = {
    budgetRings: {
      total: 0,
      grayBg: 0,
      grayText: 0,
      coloredFill: 0,
      issues: []
    },
    deadlineRings: {
      total: 0,
      grayBg: 0,
      grayText: 0,
      coloredFill: 0,
      hasDate: 0,
      hasDaysBelow: 0,
      issues: []
    }
  };

  // בדוק את כל הטבעות בדף
  const allRingContainers = document.querySelectorAll('.svg-ring-container');

  console.log(`\n📊 נמצאו ${allRingContainers.length} רינגים בסך הכל\n`);

  allRingContainers.forEach((container, index) => {
    const svg = container.querySelector('svg.svg-ring');
    if (!svg) {
      console.warn(`⚠️ רינג ${index + 1}: לא נמצא SVG`);
      return;
    }

    // זיהוי סוג הרינג - לפי התווית
    const label = container.querySelector('.svg-ring-label')?.textContent.trim() || '';
    const isBudgetRing = label.includes('תקציב') || label.includes('משימה');
    const isDeadlineRing = label.includes('תאריך') || label.includes('יעד');

    const ringType = isBudgetRing ? 'תקציב משימה' : isDeadlineRing ? 'תאריך יעד' : 'לא ידוע';

    // שלוף את המעגלים
    const circles = svg.querySelectorAll('circle');
    const bgCircle = circles[0]; // המעגל הראשון = רקע
    const fillCircle = circles[1]; // המעגל השני = מילוי

    if (!bgCircle || !fillCircle) {
      console.warn(`⚠️ רינג ${index + 1}: לא נמצאו מספיק מעגלים`);
      return;
    }

    // קבל את הצבעים
    const bgStroke = bgCircle.getAttribute('stroke');
    const fillStroke = fillCircle.getAttribute('stroke');

    // בדוק טקסט
    const textElement = isBudgetRing
      ? container.querySelector('.svg-ring-percentage')
      : svg.querySelector('text');

    const textColor = textElement
      ? window.getComputedStyle(textElement).color || textElement.getAttribute('fill')
      : null;

    const iconElement = svg.querySelector('.svg-ring-icon');
    const iconColor = iconElement ? iconElement.getAttribute('fill') : null;

    // המר RGB ל-HEX אם צריך
    const rgbToHex = (rgb) => {
      if (!rgb) {
return null;
}
      if (rgb.startsWith('#')) {
return rgb.toLowerCase();
}
      const match = rgb.match(/\d+/g);
      if (!match) {
return null;
}
      const [r, g, b] = match.map(Number);
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    };

    const textColorHex = rgbToHex(textColor);
    const iconColorHex = rgbToHex(iconColor);

    // בדיקות ספציפיות לפי סוג
    if (isBudgetRing) {
      results.budgetRings.total++;

      // בדוק רקע אפור
      if (bgStroke === '#e5e7eb') {
        results.budgetRings.grayBg++;
      } else {
        results.budgetRings.issues.push({
          index: index + 1,
          issue: `רקע לא אפור: ${bgStroke} (צריך #e5e7eb)`
        });
      }

      // בדוק טקסט אפור
      const isTextGray = textColorHex === '#6b7280';
      const isIconGray = iconColorHex === '#6b7280';

      if (isTextGray && isIconGray) {
        results.budgetRings.grayText++;
      } else {
        results.budgetRings.issues.push({
          index: index + 1,
          issue: `טקסט לא אפור - אחוזים: ${textColorHex}, אייקון: ${iconColorHex} (צריך #6b7280)`
        });
      }

      // בדוק מילוי צבעוני
      if (fillStroke && fillStroke.includes('url(')) {
        results.budgetRings.coloredFill++;
      } else {
        results.budgetRings.issues.push({
          index: index + 1,
          issue: `מילוי לא צבעוני: ${fillStroke}`
        });
      }

    } else if (isDeadlineRing) {
      results.deadlineRings.total++;

      // בדוק רקע אפור
      if (bgStroke === '#e5e7eb') {
        results.deadlineRings.grayBg++;
      } else {
        results.deadlineRings.issues.push({
          index: index + 1,
          issue: `רקע לא אפור: ${bgStroke} (צריך #e5e7eb)`
        });
      }

      // בדוק טקסט אפור
      if (textColorHex === '#6b7280') {
        results.deadlineRings.grayText++;
      } else {
        results.deadlineRings.issues.push({
          index: index + 1,
          issue: `טקסט תאריך לא אפור: ${textColorHex} (צריך #6b7280)`
        });
      }

      // בדוק מילוי צבעוני
      if (fillStroke && fillStroke.includes('url(')) {
        results.deadlineRings.coloredFill++;
      } else {
        results.deadlineRings.issues.push({
          index: index + 1,
          issue: `מילוי לא צבעוני: ${fillStroke}`
        });
      }

      // בדוק תאריך בתוך הרינג
      const dateText = textElement?.textContent.trim();
      if (dateText && dateText.match(/\d+\.\d+/)) {
        results.deadlineRings.hasDate++;
      } else {
        results.deadlineRings.issues.push({
          index: index + 1,
          issue: `לא נמצא תאריך בפורמט הנכון בתוך הרינג: "${dateText}"`
        });
      }

      // בדוק טקסט ימים מתחת
      const valueText = container.querySelector('.svg-ring-value')?.textContent.trim();
      if (valueText && (valueText.includes('ימים') || valueText.includes('איחור') || valueText.includes('היום'))) {
        results.deadlineRings.hasDaysBelow++;
      } else {
        results.deadlineRings.issues.push({
          index: index + 1,
          issue: `לא נמצא טקסט ימים מתחת לרינג: "${valueText}"`
        });
      }
    }

    // לוג מפורט לכל רינג
    console.log(`\n📍 רינג ${index + 1} (${ringType}):`);
    console.log(`  רקע: ${bgStroke}`);
    console.log(`  מילוי: ${fillStroke?.substring(0, 40)}...`);
    if (isBudgetRing) {
      console.log(`  טקסט אחוזים: ${textColorHex}`);
      console.log(`  אייקון: ${iconColorHex}`);
    } else if (isDeadlineRing) {
      const valueText = container.querySelector('.svg-ring-value')?.textContent.trim();
      console.log(`  טקסט תאריך: ${textColorHex}`);
      console.log(`  תוכן תאריך: "${textElement?.textContent.trim()}"`);
      console.log(`  טקסט ימים: "${valueText}"`);
    }
  });

  // הצג סיכום
  console.log('\n\n%c📊 סיכום תוצאות', 'font-size: 16px; font-weight: bold; color: #2563eb; background: #dbeafe; padding: 5px 10px; border-radius: 4px;');

  console.log('\n%c💰 רינגי תקציב משימה:', 'font-weight: bold; color: #059669;');
  console.log(`  סה"כ: ${results.budgetRings.total}`);
  console.log(`  %c✅ רקע אפור: ${results.budgetRings.grayBg}/${results.budgetRings.total}`, results.budgetRings.grayBg === results.budgetRings.total ? 'color: #059669;' : 'color: #dc2626;');
  console.log(`  %c✅ טקסט אפור: ${results.budgetRings.grayText}/${results.budgetRings.total}`, results.budgetRings.grayText === results.budgetRings.total ? 'color: #059669;' : 'color: #dc2626;');
  console.log(`  %c✅ מילוי צבעוני: ${results.budgetRings.coloredFill}/${results.budgetRings.total}`, results.budgetRings.coloredFill === results.budgetRings.total ? 'color: #059669;' : 'color: #dc2626;');

  console.log('\n%c📅 רינגי תאריך יעד:', 'font-weight: bold; color: #2563eb;');
  console.log(`  סה"כ: ${results.deadlineRings.total}`);
  console.log(`  %c✅ רקע אפור: ${results.deadlineRings.grayBg}/${results.deadlineRings.total}`, results.deadlineRings.grayBg === results.deadlineRings.total ? 'color: #059669;' : 'color: #dc2626;');
  console.log(`  %c✅ טקסט אפור: ${results.deadlineRings.grayText}/${results.deadlineRings.total}`, results.deadlineRings.grayText === results.deadlineRings.total ? 'color: #059669;' : 'color: #dc2626;');
  console.log(`  %c✅ מילוי צבעוני: ${results.deadlineRings.coloredFill}/${results.deadlineRings.total}`, results.deadlineRings.coloredFill === results.deadlineRings.total ? 'color: #059669;' : 'color: #dc2626;');
  console.log(`  %c✅ תאריך בפנים: ${results.deadlineRings.hasDate}/${results.deadlineRings.total}`, results.deadlineRings.hasDate === results.deadlineRings.total ? 'color: #059669;' : 'color: #dc2626;');
  console.log(`  %c✅ ימים מתחת: ${results.deadlineRings.hasDaysBelow}/${results.deadlineRings.total}`, results.deadlineRings.hasDaysBelow === results.deadlineRings.total ? 'color: #059669;' : 'color: #dc2626;');

  // הצג בעיות
  if (results.budgetRings.issues.length > 0) {
    console.log('\n%c❌ בעיות ברינגי תקציב:', 'font-weight: bold; color: #dc2626; background: #fee2e2; padding: 5px 10px; border-radius: 4px;');
    console.table(results.budgetRings.issues);
  }

  if (results.deadlineRings.issues.length > 0) {
    console.log('\n%c❌ בעיות ברינגי תאריך יעד:', 'font-weight: bold; color: #dc2626; background: #fee2e2; padding: 5px 10px; border-radius: 4px;');
    console.table(results.deadlineRings.issues);
  }

  // מסקנה סופית
  const allBudgetPass =
    results.budgetRings.grayBg === results.budgetRings.total &&
    results.budgetRings.grayText === results.budgetRings.total &&
    results.budgetRings.coloredFill === results.budgetRings.total;

  const allDeadlinePass =
    results.deadlineRings.grayBg === results.deadlineRings.total &&
    results.deadlineRings.grayText === results.deadlineRings.total &&
    results.deadlineRings.coloredFill === results.deadlineRings.total &&
    results.deadlineRings.hasDate === results.deadlineRings.total &&
    results.deadlineRings.hasDaysBelow === results.deadlineRings.total;

  console.log('\n\n%c🎯 מסקנה:', 'font-size: 16px; font-weight: bold; color: #7c3aed; background: #ede9fe; padding: 5px 10px; border-radius: 4px;');

  if (allBudgetPass && allDeadlinePass) {
    console.log('%c✅ מעולה! כל השינויים עובדים בצורה מושלמת!', 'font-size: 14px; font-weight: bold; color: #059669;');
  } else {
    if (!allBudgetPass) {
      console.log('%c⚠️ יש בעיות ברינגי התקציב - בדוק את הפרטים למעלה', 'font-size: 14px; font-weight: bold; color: #ea580c;');
    }
    if (!allDeadlinePass) {
      console.log('%c⚠️ יש בעיות ברינגי תאריך היעד - בדוק את הפרטים למעלה', 'font-size: 14px; font-weight: bold; color: #ea580c;');
    }
  }

})();
