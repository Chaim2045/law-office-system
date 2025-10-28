/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AI SYSTEM - CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description הגדרות מערכת ה-AI
 * @version 1.0.0
 * @created 2025-10-26
 *
 * ⚠️ חשוב: לפני שימוש, הדבק את ה-API Key שלך מ-OpenAI!
 *
 */

'use strict';

/**
 * @const AI_CONFIG
 * @description הגדרות ל-OpenAI API
 */
const AI_CONFIG = {
  // ═══ API Configuration ═══

  /**
   * @property apiKey
   * @description מפתח API מ-OpenAI
   *
   * 📝 איך להשיג API Key:
   * 1. היכנס ל-https://platform.openai.com/
   * 2. הירשם (צריך כרטיס אשראי)
   * 3. לך ל-API Keys
   * 4. לחץ "Create new secret key"
   * 5. העתק והדבק כאן
   *
   * ⚠️ שמור את המפתח בסוד! אל תשתף אותו עם אחרים!
   */
  apiKey: '', // ← הדבק את המפתח שלך כאן מ-https://platform.openai.com/api-keys

  /**
   * @property model
   * @description מודל AI לשימוש
   *
   * אפשרויות:
   * - 'gpt-3.5-turbo' (מומלץ להתחלה!) - מהיר, זול, טוב
   * - 'gpt-4' - חכם מאוד, אבל יקר (פי 15!)
   * - 'gpt-4-turbo' - חכם + מהיר, יקר (פי 10)
   */
  model: 'gpt-3.5-turbo',

  /**
   * @property apiUrl
   * @description כתובת API של OpenAI
   */
  apiUrl: 'https://api.openai.com/v1/chat/completions',


  // ═══ Behavior Settings ═══

  /**
   * @property temperature
   * @description כמה "יצירתי" AI יהיה (0-1)
   *
   * 0.0 = דטרמיניסטי (תשובות זהות לשאלות זהות)
   * 0.7 = מאוזן (מומלץ!)
   * 1.0 = יצירתי מאוד (תשובות משתנות)
   */
  temperature: 0.7,

  /**
   * @property maxTokens
   * @description אורך מקסימלי של תשובה (במילים בערך)
   *
   * 500 = תשובה קצרה
   * 1000 = תשובה בינונית (מומלץ!)
   * 2000 = תשובה ארוכה
   */
  maxTokens: 1000,

  /**
   * @property streamResponse
   * @description האם להציג תשובות מילה-אחר-מילה (כמו ChatGPT)
   *
   * true = תשובה מוצגת בהדרגה (נראה יותר טבעי!)
   * false = תשובה מוצגת בבת אחת (מהיר יותר)
   */
  streamResponse: true,


  // ═══ System Prompt ═══

  /**
   * @property systemPrompt
   * @description הוראות ל-AI (מי הוא ומה תפקידו)
   *
   * זה מגדיר את "האישיות" של ה-AI ומה הוא יודע לעשות
   */
  systemPrompt: `
אתה עוזר אישי חכם למערכת ניהול משרד עורכי דין.

📋 תפקידך:
- לעזור לעובדים לנהל משימות, תיקים ולקוחות
- לנתח נתונים ולתת תובנות
- לענות על שאלות בצורה ברורה ומקצועית
- לספק המלצות מעשיות

✅ אתה יכול:
- לנתח משימות ותיקים של המשתמש
- לתת סיכומים וסטטיסטיקות
- לזהות בעיות ולהציע פתרונות
- לעזור במעקב אחרי לוחות זמנים

❌ אתה לא יכול:
- לשנות נתונים במערכת (read-only)
- לתת ייעוץ משפטי (רק ניהול מנהלי)
- לגשת לנתונים של עובדים אחרים

🎯 סגנון תשובה:
- תמיד בעברית תקנית
- קצר וממוקד (עד 5-6 שורות, אלא אם מבקשים יותר)
- השתמש באמוג'י בשביל בהירות (✅ ❌ ⚠️ 💡 📊)
- אם משהו לא ברור, שאל שאלות הבהרה

💡 טיפ: המשתמש עובד במשרד עורכי דין, אז היה מקצועי אבל גם ידידותי.
`.trim(),


  // ═══ UI Settings ═══

  /**
   * @property chatPosition
   * @description מיקום חלון הצ'אט
   *
   * 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
   */
  chatPosition: 'bottom-left',

  /**
   * @property welcomeMessage
   * @description הודעת פתיחה כשפותחים את הצ'אט
   */
  welcomeMessage: '👋 שלום! אני העוזר החכם שלך. שאל אותי כל שאלה על המשימות, התיקים או הנתונים שלך!',

  /**
   * @property quickActions
   * @description כפתורי פעולה מהירה (suggestions)
   */
  quickActions: [
    '📋 מה המשימות שלי?',
    '📊 תן לי סיכום שבועי',
    '⚠️ מה דורש תשומת לב?',
    '🎯 איך הביצועים שלי?'
  ],


  // ═══ Advanced Settings ═══

  /**
   * @property contextMaxTokens
   * @description כמה נתונים לשלוח ל-AI (כדי לא לחרוג מהמכסה)
   *
   * 2000 = נתונים בסיסיים
   * 4000 = נתונים מלאים (מומלץ!)
   * 8000 = כל הנתונים (יקר!)
   */
  contextMaxTokens: 4000,

  /**
   * @property saveHistory
   * @description האם לשמור היסטוריית שיחות (ב-localStorage)
   */
  saveHistory: true,

  /**
   * @property historyLength
   * @description כמה הודעות לשמור בהיסטוריה
   */
  historyLength: 50,

  /**
   * @property debugMode
   * @description מצב debug - מציג לוגים בקונסול
   * זמנית מופעל כדי לראות כמה tokens נשלחים!
   */
  debugMode: true,


  // ═══ Error Messages ═══

  errorMessages: {
    noApiKey: '⚠️ שגיאה: לא הוגדר API Key! פתח את ai-config.js והדבק את המפתח שלך.',
    invalidApiKey: '❌ שגיאה: API Key לא תקין. בדוק שהמפתח נכון.',
    rateLimitExceeded: '⏱️ חרגת ממכסת הבקשות. חכה דקה ונסה שוב.',
    networkError: '🌐 שגיאת רשת. בדוק חיבור לאינטרנט.',
    unknownError: '❌ שגיאה לא ידועה. נסה שוב או פנה לתמיכה.',
    noData: '📭 לא נמצאו נתונים. נסה שוב מאוחר יותר.'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Export to global scope
// ═══════════════════════════════════════════════════════════════════════════
window.AI_CONFIG = AI_CONFIG;
