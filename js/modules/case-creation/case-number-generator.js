/**
 * Case Number Generator
 * מחולל מספרי תיק חכם עם cache
 *
 * @module case-number-generator
 * @version 3.0.0
 */

(function() {
  'use strict';

  class CaseNumberGenerator {
    constructor() {
      this.lastCaseNumber = null;
      this.isInitialized = false;
      this.updateListener = null;
    }

    /**
     * בדיקה אם המשתמש מחובר
     * @returns {boolean}
     */
    isAuthenticated() {
      return window.firebaseAuth && window.firebaseAuth.currentUser !== null;
    }

    /**
     * בדיקה אם השגיאה ניתנת לתיקון (recoverable)
     * @param {Error} error
     * @returns {boolean}
     */
    isRecoverableError(error) {
      // שגיאות רשת - אפשר לנסות שוב
      if (error.code === 'unavailable') {
return true;
}
      if (error.code === 'deadline-exceeded') {
return true;
}
      if (error.code === 'resource-exhausted') {
return true;
}

      // שגיאות הרשאות - לא אפשר לתקן ב-retry
      if (error.code === 'permission-denied') {
return false;
}
      if (error.code === 'unauthenticated') {
return false;
}

      return false;
    }

    /**
     * המתנה (delay) - לשימוש ב-retry logic
     * @param {number} ms - מילישניות
     * @returns {Promise<void>}
     */
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * אתחול המחולל - טוען את המספר האחרון מ-Firebase
     * 🛡️ דורש authentication!
     */
    async initialize() {
      if (this.isInitialized) {
        return;
      }

      // 🛡️ Authentication Guard
      if (!this.isAuthenticated()) {
        Logger.log('⚠️ CaseNumberGenerator: User not authenticated - skipping initialization');
        return;
      }

      try {
        await this.updateLastCaseNumber();
        this.setupRealtimeListener();
        this.isInitialized = true;

        Logger.log('✅ CaseNumberGenerator initialized. Last number:', this.lastCaseNumber);
      } catch (error) {
        console.error('❌ Error initializing CaseNumberGenerator:', error);
        throw error;
      }
    }

    /**
     * עדכון מספר תיק אחרון מ-Firebase
     * 🛡️ עם Authentication Guard ו-Error Handling חכם
     * @param {number} retries - מספר ניסיונות (ברירת מחדל: 3)
     */
    async updateLastCaseNumber(retries = 3) {
      // 🛡️ Authentication Guard
      if (!this.isAuthenticated()) {
        Logger.log('⚠️ User not authenticated - cannot update case number');
        this.lastCaseNumber = null;
        return;
      }

      // 🔍 Performance Monitoring - Start
      const opId = window.PerformanceMonitor?.start('case-number-query', {
        action: 'updateLastCaseNumber',
        retries: retries
      });

      // 🎯 Get current year for filtering
      const currentYear = new Date().getFullYear();

      // Retry Loop
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const snapshot = await window.firebaseDB
            .collection('clients')
            .where('caseNumber', '>=', `${currentYear}000`)
            .where('caseNumber', '<=', `${currentYear}999`)
            .orderBy('caseNumber', 'desc')
            .limit(1)
            .get();

          if (!snapshot.empty) {
            const lastCase = snapshot.docs[0].data();
            // שמירה כ-string (כי זה הפורמט: "2025042")
            this.lastCaseNumber = lastCase.caseNumber || null;
          } else {
            this.lastCaseNumber = null; // אין תיקים עדיין
          }

          Logger.log('📊 Updated last case number:', this.lastCaseNumber);

          // 🔍 Performance Monitoring - Success
          window.PerformanceMonitor?.success(opId, {
            lastCaseNumber: this.lastCaseNumber,
            attempts: attempt
          });

          return; // ✅ הצלחה!

        } catch (error) {
          // 🎯 הבחנה בין סוגי שגיאות
          if (this.isRecoverableError(error) && attempt < retries) {
            Logger.log(`⚠️ Attempt ${attempt} failed (${error.code}), retrying...`);
            await this.delay(1000 * attempt); // exponential backoff
            continue;
          }

          // שגיאה שאין מנה לתקן או שנגמרו הניסיונות
          console.error('❌ Error updating last case number:', error);

          // 🔍 Performance Monitoring - Failure
          window.PerformanceMonitor?.failure(opId, error);

          // הודעה למשתמש בהתאם לסוג השגיאה
          if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
            Logger.log('🔒 Permission denied - user may need to re-login');
            window.NotificationSystem?.show('נדרשת התחברות מחדש', 'warning');
          } else {
            Logger.log('⚠️ Failed to load case number - using fallback');
          }

          // fallback - אין מספר
          this.lastCaseNumber = null;
          break;
        }
      }
    }

    /**
     * הקמת listener לעדכונים בזמן אמת
     * 🛡️ עם Authentication Guard
     */
    setupRealtimeListener() {
      // 🛡️ Authentication Guard
      if (!this.isAuthenticated()) {
        Logger.log('⚠️ Cannot setup realtime listener - user not authenticated');
        return;
      }

      // מאזין רק ליצירת לקוחות חדשים
      this.updateListener = window.firebaseDB
        .collection('clients')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .onSnapshot(
          (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const newCase = change.doc.data();
                const newNumber = newCase.caseNumber;

                // עדכון רק אם המספר החדש גדול יותר (השוואה לקסיקוגרפית)
                if (newNumber && (!this.lastCaseNumber || newNumber > this.lastCaseNumber)) {
                  this.lastCaseNumber = newNumber;
                  Logger.log('🔄 Case number updated in real-time:', this.lastCaseNumber);
                }
              }
            });
          },
          (error) => {
            // Error handler
            console.error('❌ Realtime listener error:', error);
            if (error.code === 'permission-denied') {
              Logger.log('🔒 Realtime listener: Permission denied');
              window.NotificationSystem?.show('אין הרשאות גישה לנתונים', 'error');
            }
          }
        );
    }

    /**
     * קבלת מספר התיק הבא (מ-cache)
     * 🎯 לוגיקה זהה לשרת (functions/index.js:286-335)
     * @returns {string} מספר תיק חדש
     */
    getNextCaseNumber() {
      if (!this.isInitialized) {
        console.warn('⚠️ CaseNumberGenerator not initialized. Using fallback.');
        return '2025001';
      }

      const currentYear = new Date().getFullYear();
      const yearPrefix = currentYear.toString();

      // אם אין מספר אחרון, התחל מ-001
      if (!this.lastCaseNumber) {
        return `${yearPrefix}001`;
      }

      const lastCaseNumber = this.lastCaseNumber.toString();

      // חילוץ המספר הסידורי (3 הספרות האחרונות)
      const lastSequential = parseInt(lastCaseNumber.slice(-3));

      let nextNumber = 1; // ברירת מחדל

      // אם המספר האחרון מהשנה הנוכחית, נמשיך את הסדרה
      if (lastCaseNumber.startsWith(yearPrefix)) {
        nextNumber = lastSequential + 1;
      }
      // אחרת (שנה חדשה), נתחיל מ-1

      // יצירת מספר תיק: שנה + 3 ספרות סידוריות
      const caseNumber = `${yearPrefix}${nextNumber.toString().padStart(3, '0')}`;

      return caseNumber;
    }

    /**
     * 🎯 קבלת מספר תיק הבא הזמין (עם בדיקת זמינות ב-Firebase)
     * פונקציה חכמה שבודקת בזמן אמת מה המספר האחרון ומוודאת שהמספר החדש פנוי
     * @param {number} maxRetries - מספר ניסיונות מקסימלי (ברירת מחדל: 10)
     * @returns {Promise<string>} מספר תיק חדש וזמין
     */
    async getNextAvailableCaseNumber(maxRetries = 10) {
      // 🔍 Performance Monitoring - Start
      const opId = window.PerformanceMonitor?.start('case-number-generation', {
        action: 'getNextAvailableCaseNumber',
        maxRetries: maxRetries
      });

      try {
        Logger.log('🔍 Finding next available case number...');

        // רענון המספר האחרון מ-Firebase (בזמן אמת)
        await this.updateLastCaseNumber();

        // קבלת מספר מועמד
        let candidateNumber = this.getNextCaseNumber();

        // בדיקת זמינות עם retry logic
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          Logger.log(`  🔎 Attempt ${attempt}: Checking if ${candidateNumber} is available...`);

          const exists = await this.caseNumberExists(candidateNumber);

          if (!exists) {
            // ✅ מצאנו מספר פנוי!
            Logger.log(`  ✅ Case number ${candidateNumber} is available!`);

            // עדכון ה-cache כדי למנוע התנגשויות עתידיות
            this.lastCaseNumber = candidateNumber;

            // 🔍 Performance Monitoring - Success
            window.PerformanceMonitor?.success(opId, {
              caseNumber: candidateNumber,
              attempts: attempt
            });

            return candidateNumber;
          }

          // ❌ המספר תפוס, ננסה את הבא
          Logger.log(`  ⚠️ Case number ${candidateNumber} is taken, trying next...`);

          // עדכון lastCaseNumber למספר הנוכחי (התפוס) ונסיון הבא
          this.lastCaseNumber = candidateNumber;
          candidateNumber = this.getNextCaseNumber();
        }

        // אם הגענו לכאן, כל הניסיונות נכשלו
        const error = new Error(`Failed to find available case number after ${maxRetries} attempts`);

        // 🔍 Performance Monitoring - Failure
        window.PerformanceMonitor?.failure(opId, error);

        throw error;

      } catch (error) {
        console.error('❌ Error finding available case number:', error);

        // 🔍 Performance Monitoring - Failure (if not already reported)
        if (window.PerformanceMonitor && opId) {
          const activeOps = window.PerformanceMonitor.getActiveOperations();
          if (activeOps.some(op => op.id === opId)) {
            window.PerformanceMonitor.failure(opId, error);
          }
        }

        // Fallback: מספר עם timestamp
        const currentYear = new Date().getFullYear();
        const fallback = `${currentYear}${Math.floor(Math.random() * 900) + 100}`;
        Logger.log(`⚠️ Using fallback case number: ${fallback}`);

        return fallback;
      }
    }

    /**
     * רזרבציה של מספר תיק (למניעת כפילויות)
     * @returns {string} מספר תיק ייחודי
     */
    reserveNextNumber() {
      const reserved = this.getNextCaseNumber();
      this.lastCaseNumber = reserved; // שמירה כ-string
      Logger.log('🔒 Reserved case number:', reserved);
      return reserved;
    }

    /**
     * ולידציה של מספר תיק
     * פורמט: שנה (4 ספרות) + מספר סידורי (3 ספרות) = 7 ספרות
     * דוגמה: 2025042
     * @param {string|number} caseNumber - מספר תיק לבדיקה
     * @returns {boolean}
     */
    isValidCaseNumber(caseNumber) {
      if (!caseNumber) {
return false;
}

      const caseStr = caseNumber.toString();

      // בדיקה: בדיוק 7 ספרות
      if (caseStr.length !== 7) {
return false;
}

      // בדיקה: כל התווים הם ספרות
      if (!/^\d{7}$/.test(caseStr)) {
return false;
}

      // חילוץ שנה ומספר סידורי
      const year = parseInt(caseStr.substring(0, 4));
      const sequential = parseInt(caseStr.substring(4, 7));

      // בדיקת שנה סבירה (2024-2030)
      if (year < 2024 || year > 2030) {
return false;
}

      // בדיקת מספר סידורי תקין (1-999)
      if (sequential < 1 || sequential > 999) {
return false;
}

      return true;
    }

    /**
     * בדיקה אם מספר תיק קיים כבר
     * 🛡️ עם Authentication Guard
     * @param {string|number} caseNumber
     * @returns {Promise<boolean>}
     */
    async caseNumberExists(caseNumber) {
      // 🛡️ Authentication Guard
      if (!this.isAuthenticated()) {
        Logger.log('⚠️ Cannot check case number existence - user not authenticated');
        return false;
      }

      // 🔍 Performance Monitoring - Start
      const opId = window.PerformanceMonitor?.start('case-number-existence-check', {
        caseNumber: caseNumber.toString()
      });

      try {
        const doc = await window.firebaseDB
          .collection('clients')
          .doc(caseNumber.toString())
          .get();

        const exists = doc.exists;

        // 🔍 Performance Monitoring - Success
        window.PerformanceMonitor?.success(opId, { exists: exists });

        return exists;
      } catch (error) {
        console.error('❌ Error checking case number existence:', error);

        // 🔍 Performance Monitoring - Failure
        window.PerformanceMonitor?.failure(opId, error);

        return false;
      }
    }

    /**
     * ניקוי והשבתת listener
     */
    cleanup() {
      if (this.updateListener) {
        this.updateListener();
        this.updateListener = null;
      }

      this.isInitialized = false;
      Logger.log('🧹 CaseNumberGenerator cleaned up');
    }

    /**
     * רענון ידני של המספר האחרון
     */
    async refresh() {
      await this.updateLastCaseNumber();
    }
  }

  // ✅ יצירת instance גלובלי יחיד (Singleton)
  window.CaseNumberGenerator = window.CaseNumberGenerator || new CaseNumberGenerator();

  // 🎯 אתחול מתבצע ב-main.js לאחר Authentication
  // הסרנו auto-initialization כדי למנוע race condition

  Logger.log('✅ CaseNumberGenerator module loaded');

})();
