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
     * אתחול המחולל - טוען את המספר האחרון מ-Firebase
     */
    async initialize() {
      if (this.isInitialized) {
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
     */
    async updateLastCaseNumber() {
      try {
        const snapshot = await firebase.firestore()
          .collection('clients')
          .orderBy('caseNumber', 'desc')
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const lastCase = snapshot.docs[0].data();
          this.lastCaseNumber = parseInt(lastCase.caseNumber) || 24000;
        } else {
          this.lastCaseNumber = 24000; // מספר התחלתי
        }

        Logger.log('📊 Updated last case number:', this.lastCaseNumber);
      } catch (error) {
        console.error('❌ Error updating last case number:', error);
        // fallback למספר ברירת מחדל
        this.lastCaseNumber = 24000;
      }
    }

    /**
     * הקמת listener לעדכונים בזמן אמת
     */
    setupRealtimeListener() {
      // מאזין רק ליצירת לקוחות חדשים
      this.updateListener = firebase.firestore()
        .collection('clients')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .onSnapshot((snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const newCase = change.doc.data();
              const newNumber = parseInt(newCase.caseNumber);

              if (newNumber && newNumber > this.lastCaseNumber) {
                this.lastCaseNumber = newNumber;
                Logger.log('🔄 Case number updated in real-time:', this.lastCaseNumber);
              }
            }
          });
        });
    }

    /**
     * קבלת מספר התיק הבא
     * @returns {string} מספר תיק חדש
     */
    getNextCaseNumber() {
      if (!this.isInitialized) {
        console.warn('⚠️ CaseNumberGenerator not initialized. Using fallback.');
        return '24001';
      }

      const nextNumber = (this.lastCaseNumber || 24000) + 1;
      return nextNumber.toString();
    }

    /**
     * רזרבציה של מספר תיק (למניעת כפילויות)
     * @returns {string} מספר תיק ייחודי
     */
    reserveNextNumber() {
      const reserved = this.getNextCaseNumber();
      this.lastCaseNumber = parseInt(reserved);
      Logger.log('🔒 Reserved case number:', reserved);
      return reserved;
    }

    /**
     * ולידציה של מספר תיק
     * @param {string|number} caseNumber - מספר תיק לבדיקה
     * @returns {boolean}
     */
    isValidCaseNumber(caseNumber) {
      const num = parseInt(caseNumber);
      return !isNaN(num) && num > 24000 && num < 999999;
    }

    /**
     * בדיקה אם מספר תיק קיים כבר
     * @param {string|number} caseNumber
     * @returns {Promise<boolean>}
     */
    async caseNumberExists(caseNumber) {
      try {
        const doc = await firebase.firestore()
          .collection('clients')
          .doc(caseNumber.toString())
          .get();

        return doc.exists;
      } catch (error) {
        console.error('❌ Error checking case number existence:', error);
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

  // ✅ אתחול אוטומטי כשהמודול נטען
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      await window.CaseNumberGenerator.initialize();
    } catch (error) {
      console.error('❌ Failed to initialize CaseNumberGenerator:', error);
    }
  });

  Logger.log('✅ CaseNumberGenerator module loaded');

})();
