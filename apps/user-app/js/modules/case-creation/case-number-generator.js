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
      // 🚀 Cache for intelligent gap finder
      this.gapCache = null;
      this.gapCacheExpiry = 0;
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
     * 🎯 מסנן רק תיקים מהשנה הנוכחית (למניעת התערבות תיקים פנימיים)
     */
    setupRealtimeListener() {
      // 🛡️ Authentication Guard
      if (!this.isAuthenticated()) {
        Logger.log('⚠️ Cannot setup realtime listener - user not authenticated');
        return;
      }

      // 🎯 Get current year for filtering (same as updateLastCaseNumber)
      const currentYear = new Date().getFullYear();

      // מאזין רק ליצירת לקוחות חדשים מהשנה הנוכחית
      this.updateListener = window.firebaseDB
        .collection('clients')
        .where('caseNumber', '>=', `${currentYear}000`)
        .where('caseNumber', '<=', `${currentYear}999`)
        .orderBy('caseNumber', 'desc')
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
     * 🧠 Intelligent Gap Finder - Ultimate Edition
     * מוצא מספר תיק פנוי בצורה חכמה ומהירה
     *
     * Phase 1: Quick Check - בודק 10 מספרים אחרי האחרון (1-2 queries)
     * Phase 2: Smart Scan - טוען את כל המספרים ומוצא gap (1 query)
     * Cache: תוקף 30 שניות
     *
     * @returns {Promise<string>} מספר תיק פנוי
     */
    async findFirstAvailableNumberIntelligent() {
      const currentYear = new Date().getFullYear();
      const yearPrefix = currentYear.toString();

      // 🚀 Cache Check
      if (this.gapCache && Date.now() < this.gapCacheExpiry) {
        Logger.log('⚡ Using cached gap:', this.gapCache);
        return this.gapCache;
      }

      const opId = window.PerformanceMonitor?.start('intelligent-gap-finder');

      try {
        // 🎯 PHASE 1: Quick Check - בדוק אם יש מקום ליד המספר האחרון
        Logger.log('🎯 Phase 1: Quick check near last number...');

        const lastNum = parseInt(this.lastCaseNumber?.slice(-3) || '0');

        // בדוק את 10 המספרים הבאים
        for (let i = lastNum + 1; i <= Math.min(lastNum + 10, 999); i++) {
          const candidate = `${yearPrefix}${i.toString().padStart(3, '0')}`;
          const exists = await this.caseNumberExists(candidate);

          if (!exists) {
            Logger.log(`  ✅ Found quickly: ${candidate}`);

            // שמור ב-cache
            this.gapCache = candidate;
            this.gapCacheExpiry = Date.now() + 30000; // 30 שניות

            window.PerformanceMonitor?.success(opId, {
              method: 'quick',
              candidate,
              queries: i - lastNum
            });

            return candidate;
          }
        }

        Logger.log('  ⚠️ No quick match, moving to smart search...');

        // 🧠 PHASE 2: Smart Scan - טען את כל המספרים (קל!) ומצא gaps
        Logger.log('🧠 Phase 2: Smart scan...');

        const snapshot = await window.firebaseDB
          .collection('clients')
          .where('caseNumber', '>=', `${yearPrefix}000`)
          .where('caseNumber', '<=', `${yearPrefix}999`)
          .get();

        Logger.log(`  📦 Loaded ${snapshot.size} case numbers`);

        // בנה Set של המספרים הקיימים (מהיר!)
        const usedNumbers = new Set();
        snapshot.forEach(doc => {
          const num = parseInt(doc.data().caseNumber.slice(-3));
          usedNumbers.add(num);
        });

        // מצא את הראשון שחסר
        for (let i = 1; i <= 999; i++) {
          if (!usedNumbers.has(i)) {
            const result = `${yearPrefix}${i.toString().padStart(3, '0')}`;
            Logger.log(`  ✅ Found via smart scan: ${result}`);

            // שמור ב-cache
            this.gapCache = result;
            this.gapCacheExpiry = Date.now() + 30000;

            window.PerformanceMonitor?.success(opId, {
              method: 'smart',
              result,
              totalCases: snapshot.size,
              queries: 11 // 10 quick + 1 smart
            });

            return result;
          }
        }

        // 🚨 PHASE 3: Emergency - אין מספרים פנויים!
        Logger.log('🚨 Phase 3: No available numbers (999 limit reached)');

        const error = new Error('All case numbers (1-999) are taken. Please contact administrator.');
        window.PerformanceMonitor?.failure(opId, error);
        throw error;

      } catch (error) {
        console.error('❌ Intelligent gap finder error:', error);
        window.PerformanceMonitor?.failure(opId, error);
        throw error;
      }
    }

    /**
     * 🎯 קבלת מספר תיק הבא הזמין (עם בדיקת זמינות ב-Firebase)
     * 🚀 גרסה חכמה: משתמשת באלגוריתם דו-שלבי (Quick Check + Smart Scan)
     *
     * ⚠️ WARNING: פונקציה זו מיועדת רק להצגת PREVIEW ללקוח
     * השרת יקצה את המספר הסופי בעת יצירת התיק
     *
     * @returns {Promise<string>} מספר תיק חדש וזמין (preview)
     */
    async getNextAvailableCaseNumber() {
      // 🔍 Performance Monitoring - Start
      const opId = window.PerformanceMonitor?.start('case-number-generation', {
        action: 'getNextAvailableCaseNumber (Intelligent)',
        method: 'Multi-phase with cache'
      });

      try {
        Logger.log('🔍 Finding next available case number (intelligent mode)...');

        // רענון המספר האחרון מ-Firebase (בזמן אמת)
        await this.updateLastCaseNumber();

        // 🚀 שימוש באלגוריתם החכם עם Cache
        const availableNumber = await this.findFirstAvailableNumberIntelligent();

        if (availableNumber) {
          // ✅ מצאנו מספר פנוי!
          Logger.log(`  ✅ Case number ${availableNumber} is available (preview)!`);

          // 🔍 Performance Monitoring - Success
          window.PerformanceMonitor?.success(opId, {
            caseNumber: availableNumber,
            method: 'intelligent_finder',
            note: 'preview_only'
          });

          return availableNumber;
        }

        // 🚨 לא נמצא מספר זמין (מאוד לא סביר)
        console.error('🚨 CRITICAL: No available case numbers found (reached limit?)');

        const error = new Error('No available case numbers found');

        // 🔍 Performance Monitoring - Failure
        window.PerformanceMonitor?.failure(opId, error);

        // במקום לזרוק שגיאה, נחזיר null ונתן לשרת לטפל
        return null;

      } catch (error) {
        console.error('❌ Error finding available case number:', error);

        // 🔍 Performance Monitoring - Failure (if not already reported)
        if (window.PerformanceMonitor && opId) {
          const activeOps = window.PerformanceMonitor.getActiveOperations();
          if (activeOps.some(op => op.id === opId)) {
            window.PerformanceMonitor.failure(opId, error);
          }
        }

        // במקרה של שגיאה, נחזיר null ונתן לשרת לטפל
        Logger.log('⚠️ Preview failed - server will assign case number');
        return null;
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
