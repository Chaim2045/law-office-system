/**
 * Case Form Validator
 * ולידציה מרכזית לטופס יצירת תיק
 *
 * @module case-form-validator
 * @version 3.0.0
 */

(function() {
  'use strict';

  class CaseFormValidator {

    /**
     * ולידציה מלאה של טופס יצירת תיק
     * @param {object} formData - נתוני הטופס
     * @returns {object} { isValid, errors, warnings }
     */
    static validateCaseForm(formData) {
      const errors = [];
      const warnings = [];

      // בדיקת מצב לקוח (חדש/קיים)
      if (formData.isNewClient) {
        const clientValidation = this.validateNewClient(formData.client);
        errors.push(...clientValidation.errors);
        warnings.push(...clientValidation.warnings);
      } else {
        const existingValidation = this.validateExistingClient(formData.client);
        errors.push(...existingValidation.errors);
      }

      // בדיקת פרטי תיק
      const caseValidation = this.validateCaseDetails(formData.case);
      errors.push(...caseValidation.errors);
      warnings.push(...caseValidation.warnings);

      // בדיקת שירות לפי סוג
      if (formData.case.procedureType === 'hours') {
        const hoursValidation = this.validateHoursService(formData.service);
        errors.push(...hoursValidation.errors);
      } else if (formData.case.procedureType === 'legal_procedure') {
        const legalValidation = this.validateLegalProcedure(formData.service);
        errors.push(...legalValidation.errors);
        warnings.push(...legalValidation.warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    }

    /**
     * ולידציה של לקוח חדש
     */
    static validateNewClient(clientData) {
      const errors = [];
      const warnings = [];

      // שם לקוח
      if (!clientData.name || clientData.name.trim().length < 2) {
        errors.push('שם לקוח חייב להכיל לפחות 2 תווים');
      }

      if (clientData.name && clientData.name.trim().length > 100) {
        errors.push('שם לקוח ארוך מדי (מקסימום 100 תווים)');
      }

      // טלפון (אופציונלי אבל אם מולא צריך להיות תקין)
      if (clientData.phone) {
        if (!this.isValidIsraeliPhone(clientData.phone)) {
          errors.push('מספר טלפון לא תקין. יש להזין מספר ישראלי תקין (050-1234567)');
        }
      } else {
        warnings.push('לא הוזן מספר טלפון - מומלץ להוסיף');
      }

      // אימייל (אופציונלי אבל אם מולא צריך להיות תקין)
      if (clientData.email) {
        if (!this.isValidEmail(clientData.email)) {
          errors.push('כתובת אימייל לא תקינה');
        }
      }

      return { errors, warnings };
    }

    /**
     * ולידציה של לקוח קיים
     */
    static validateExistingClient(clientData) {
      const errors = [];

      if (!clientData.id) {
        errors.push('חובה לבחור לקוח מהרשימה');
      }

      return { errors };
    }

    /**
     * ולידציה של פרטי תיק
     */
    static validateCaseDetails(caseData) {
      const errors = [];
      const warnings = [];

      // מספר תיק
      if (!caseData.caseNumber) {
        errors.push('חובה מספר תיק');
      } else if (!window.CaseNumberGenerator?.isValidCaseNumber(caseData.caseNumber)) {
        errors.push('מספר תיק לא תקין');
      }

      // כותרת תיק
      if (!caseData.title || caseData.title.trim().length < 3) {
        errors.push('כותרת תיק חייבת להכיל לפחות 3 תווים');
      }

      if (caseData.title && caseData.title.trim().length > 200) {
        errors.push('כותרת תיק ארוכה מדי (מקסימום 200 תווים)');
      }

      // סוג הליך
      if (!caseData.procedureType || !['hours', 'legal_procedure'].includes(caseData.procedureType)) {
        errors.push('סוג הליך לא תקין');
      }

      // תיאור (אופציונלי)
      if (caseData.description && caseData.description.length > 1000) {
        errors.push('תיאור ארוך מדי (מקסימום 1000 תווים)');
      }

      if (!caseData.description) {
        warnings.push('לא הוזן תיאור לתיק');
      }

      return { errors, warnings };
    }

    /**
     * ולידציה של שירות שעות
     */
    static validateHoursService(serviceData) {
      const errors = [];

      if (!serviceData.totalHours || serviceData.totalHours <= 0) {
        errors.push('חובה להזין כמות שעות תקינה (מינימום 1)');
      }

      if (serviceData.totalHours && serviceData.totalHours > 10000) {
        errors.push('כמות שעות גבוהה מדי (מקסימום 10,000)');
      }

      // בדיקת מספרים שלמים או עשרוניים תקינים
      if (serviceData.totalHours && !this.isValidNumber(serviceData.totalHours)) {
        errors.push('כמות שעות חייבת להיות מספר תקין');
      }

      return { errors };
    }

    /**
     * ולידציה של הליך משפטי
     */
    static validateLegalProcedure(serviceData) {
      const errors = [];
      const warnings = [];

      // בדיקת סוג תמחור
      if (!serviceData.pricingType || !['hourly', 'fixed'].includes(serviceData.pricingType)) {
        errors.push('חובה לבחור סוג תמחור (שעתי/פיקס)');
      }

      // בדיקת 3 שלבים
      const stages = ['stageA', 'stageB', 'stageC'];
      const stageNames = ['שלב א\'', 'שלב ב\'', 'שלב ג\''];

      stages.forEach((stageKey, index) => {
        const stage = serviceData[stageKey];
        const stageName = stageNames[index];

        if (!stage) {
          errors.push(`חסר ${stageName}`);
          return;
        }

        // תיאור שלב
        if (!stage.description || stage.description.trim().length < 2) {
          errors.push(`${stageName}: חובה להזין תיאור (לפחות 2 תווים)`);
        }

        // תמחור שעתי - שעות
        if (serviceData.pricingType === 'hourly') {
          if (!stage.hours || stage.hours <= 0) {
            errors.push(`${stageName}: חובה להזין כמות שעות תקינה`);
          }

          if (stage.hours && stage.hours > 5000) {
            errors.push(`${stageName}: כמות שעות גבוהה מדי (מקסימום 5,000)`);
          }
        }

        // תמחור פיקס - מחיר
        if (serviceData.pricingType === 'fixed') {
          if (!stage.fixedPrice || stage.fixedPrice <= 0) {
            errors.push(`${stageName}: חובה להזין מחיר תקין`);
          }

          if (stage.fixedPrice && stage.fixedPrice > 10000000) {
            errors.push(`${stageName}: מחיר גבוה מדי`);
          }
        }
      });

      return { errors, warnings };
    }

    /**
     * בדיקת מספר טלפון ישראלי
     */
    static isValidIsraeliPhone(phone) {
      // הסרת מקפים, רווחים ותווים מיוחדים
      const cleaned = phone.replace(/[\s\-()]/g, '');

      // בדיקת פורמט
      const regex = /^(0\d{1,2}-?\d{7}|0\d{9})$/;
      return regex.test(cleaned);
    }

    /**
     * בדיקת אימייל
     */
    static isValidEmail(email) {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    }

    /**
     * בדיקת מספר תקין
     */
    static isValidNumber(value) {
      const num = parseFloat(value);
      return !isNaN(num) && isFinite(num) && num >= 0;
    }

    /**
     * בדיקה מהירה של שדה בודד
     */
    static validateField(fieldName, value, rules = {}) {
      const errors = [];

      if (rules.required && (!value || value.toString().trim().length === 0)) {
        errors.push(`${fieldName} הוא שדה חובה`);
        return { isValid: false, errors };
      }

      if (rules.minLength && value && value.length < rules.minLength) {
        errors.push(`${fieldName} חייב להכיל לפחות ${rules.minLength} תווים`);
      }

      if (rules.maxLength && value && value.length > rules.maxLength) {
        errors.push(`${fieldName} ארוך מדי (מקסימום ${rules.maxLength} תווים)`);
      }

      if (rules.min && parseFloat(value) < rules.min) {
        errors.push(`${fieldName} חייב להיות לפחות ${rules.min}`);
      }

      if (rules.max && parseFloat(value) > rules.max) {
        errors.push(`${fieldName} לא יכול להיות יותר מ-${rules.max}`);
      }

      if (rules.type === 'email' && value && !this.isValidEmail(value)) {
        errors.push(`${fieldName} לא תקין`);
      }

      if (rules.type === 'phone' && value && !this.isValidIsraeliPhone(value)) {
        errors.push(`${fieldName} לא תקין`);
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    }

    /**
     * הצגת שגיאות למשתמש
     */
    static displayErrors(errors, containerId = 'formErrors') {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (errors.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
      }

      const html = `
        <div style="
          background: #fef2f2;
          border: 2px solid #fca5a5;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        ">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <i class="fas fa-exclamation-circle" style="color: #dc2626; font-size: 20px; margin-top: 2px;"></i>
            <div style="flex: 1;">
              <h4 style="margin: 0 0 8px 0; color: #dc2626; font-size: 16px;">
                יש לתקן את השגיאות הבאות:
              </h4>
              <ul style="margin: 0; padding: 0; list-style: none;">
                ${errors.map(error => `
                  <li style="padding: 4px 0; color: #991b1b; font-size: 14px;">
                    • ${this.escapeHtml(error)}
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;
      container.style.display = 'block';

      // גלילה לשגיאות
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * הצגת אזהרות למשתמש
     */
    static displayWarnings(warnings, containerId = 'formWarnings') {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (warnings.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
      }

      const html = `
        <div style="
          background: #fffbeb;
          border: 2px solid #fcd34d;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        ">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <i class="fas fa-exclamation-triangle" style="color: #f59e0b; font-size: 20px; margin-top: 2px;"></i>
            <div style="flex: 1;">
              <h4 style="margin: 0 0 8px 0; color: #f59e0b; font-size: 16px;">
                שים לב:
              </h4>
              <ul style="margin: 0; padding: 0; list-style: none;">
                ${warnings.map(warning => `
                  <li style="padding: 4px 0; color: #92400e; font-size: 14px;">
                    • ${this.escapeHtml(warning)}
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>
        </div>
      `;

      container.innerHTML = html;
      container.style.display = 'block';
    }

    /**
     * Escape HTML
     */
    static escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  // ✅ Export
  window.CaseFormValidator = CaseFormValidator;

  Logger.log('✅ CaseFormValidator module loaded');

})();
