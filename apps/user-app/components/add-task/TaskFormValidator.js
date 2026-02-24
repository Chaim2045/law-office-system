/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TASK FORM VALIDATOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description Validation logic for add task form
 * @version 2.0.0
 * @created 2025-01-20
 *
 * @features
 * - ולידציה מלאה של כל שדות הטופס
 * - הודעות שגיאה ברורות בעברית
 * - תמיכה ב-real-time validation
 * - עיצוב ויזואלי לשדות לא תקינים
 */

/**
 * TaskFormValidator Class
 * מחלקה לולידציה של טופס הוספת משימה
 */
export class TaskFormValidator {
  constructor() {
    this.errors = [];
  }

  /**
   * Validate client and case selection
   * ולידציה לבחירת לקוח ותיק
   *
   * @param {Object} selectorValues - Values from ClientCaseSelector
   * @returns {boolean} Is valid
   */
  validateClientCase(selectorValues) {
    if (!selectorValues) {
      this.errors.push('חובה לבחור לקוח ותיק');
      return false;
    }

    if (!selectorValues.clientId || !selectorValues.clientName) {
      this.errors.push('חובה לבחור לקוח');
      return false;
    }

    if (!selectorValues.caseId) {
      this.errors.push('חובה לבחור תיק');
      return false;
    }

    return true;
  }

  /**
   * Validate branch selection
   * ולידציה לבחירת סניף
   *
   * @param {string} branch - Selected branch
   * @returns {boolean} Is valid
   */
  validateBranch(branch) {
    if (!branch || branch.trim() === '') {
      this.errors.push('חובה לבחור סניף מטפל');
      return false;
    }

    const validBranches = ['רחובות', 'תל אביב'];
    if (!validBranches.includes(branch)) {
      this.errors.push('סניף לא תקין. אנא בחר מהרשימה');
      return false;
    }

    return true;
  }

  /**
   * Validate deadline
   * ולידציה לתאריך יעד
   *
   * @param {string} deadline - Deadline datetime-local value
   * @returns {boolean} Is valid
   */
  validateDeadline(deadline) {
    if (!deadline || deadline.trim() === '') {
      this.errors.push('חובה לבחור תאריך יעד');
      return false;
    }

    const deadlineDate = new Date(deadline);
    const now = new Date();

    // Check if deadline is in the past (allow today)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (deadlineDate < todayStart) {
      this.errors.push('תאריך היעד לא יכול להיות בעבר');
      return false;
    }

    return true;
  }

  /**
   * Validate estimated time
   * ולידציה לזמן משוער
   *
   * @param {number|string} estimatedTime - Estimated time in minutes
   * @returns {boolean} Is valid
   */
  validateEstimatedTime(estimatedTime) {
    const minutes = parseInt(estimatedTime);

    if (!estimatedTime || isNaN(minutes)) {
      this.errors.push('חובה להזין זמן משוער בדקות');
      return false;
    }

    if (minutes < 1) {
      this.errors.push('זמן משוער חייב להיות לפחות 1 דקה');
      return false;
    }

    if (minutes > 9999) {
      this.errors.push('זמן משוער גבוה מדי (מקסימום 9999 דקות)');
      return false;
    }

    return true;
  }

  /**
   * Validate task description
   * ולידציה לתיאור המשימה
   *
   * @param {string} description - Task description
   * @returns {boolean} Is valid
   */
  validateDescription(description) {
    if (!description || description.trim().length < 3) {
      this.errors.push('תיאור המשימה חייב להכיל לפחות 3 תווים');
      return false;
    }

    if (description.trim().length > 500) {
      this.errors.push('תיאור המשימה ארוך מדי (מקסימום 500 תווים)');
      return false;
    }

    return true;
  }

  /**
   * Validate all form fields
   * ולידציה מלאה של כל השדות
   *
   * @param {Object} formData - All form data
   * @param {Object} formData.selectorValues - Client/Case selector values
   * @param {string} formData.branch - Branch
   * @param {string} formData.deadline - Deadline
   * @param {number} formData.estimatedTime - Estimated time
   * @param {string} formData.description - Description
   * @returns {Object} { isValid: boolean, errors: string[] }
   */
  validateAll(formData) {
    // Reset errors
    this.errors = [];

    // Validate each field
    this.validateClientCase(formData.selectorValues);
    this.validateBranch(formData.branch);
    this.validateDeadline(formData.deadline);
    this.validateEstimatedTime(formData.estimatedTime);
    this.validateDescription(formData.description);

    return {
      isValid: this.errors.length === 0,
      errors: [...this.errors]
    };
  }

  /**
   * Show validation errors to user
   * הצגת שגיאות ולידציה למשתמש
   *
   * @param {string[]} errors - Array of error messages
   * @param {HTMLElement} container - Container to show errors in
   */
  showErrors(errors, container = null) {
    if (!errors || errors.length === 0) {
      return;
    }

    // Use NotificationSystem if available
    if (window.NotificationSystem) {
      const errorMessage = errors.join('\n');
      window.NotificationSystem.show(errorMessage, 'error', 5000);
      return;
    }

    // Fallback: show in container or alert
    if (container) {
      container.innerHTML = `
        <div class="validation-errors" style="background: #fee2e2; border: 2px solid #ef4444; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h4 style="color: #dc2626; margin: 0 0 12px 0; font-size: 16px;">
            <i class="fas fa-exclamation-triangle"></i>
            יש לתקן את השגיאות הבאות:
          </h4>
          <ul style="margin: 0; padding-right: 20px; color: #991b1b;">
            ${errors.map(err => `<li style="margin-bottom: 8px;">${err}</li>`).join('')}
          </ul>
        </div>
      `;
    } else {
      alert('שגיאות בטופס:\n\n' + errors.join('\n'));
    }
  }

  /**
   * Clear validation errors display
   * ניקוי תצוגת שגיאות ולידציה
   *
   * @param {HTMLElement} container - Container with errors
   */
  clearErrors(container = null) {
    this.errors = [];

    if (container) {
      const errorDiv = container.querySelector('.validation-errors');
      if (errorDiv) {
        errorDiv.remove();
      }
    }
  }

  /**
   * Highlight invalid field
   * סימון ויזואלי של שדה לא תקין
   *
   * @param {HTMLElement} field - Input field element
   */
  markInvalid(field) {
    if (!field) {
return;
}

    field.classList.add('invalid');
    field.style.borderColor = '#ef4444';
    field.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
  }

  /**
   * Remove invalid highlight from field
   * הסרת סימון שגיאה מהשדה
   *
   * @param {HTMLElement} field - Input field element
   */
  markValid(field) {
    if (!field) {
return;
}

    field.classList.remove('invalid');
    field.style.borderColor = '';
    field.style.boxShadow = '';
  }

  /**
   * Setup real-time validation for a field
   * הגדרת ולידציה בזמן אמת לשדה
   *
   * @param {HTMLElement} field - Input field element
   * @param {Function} validator - Validation function
   */
  setupRealTimeValidation(field, validator) {
    if (!field || !validator) {
return;
}

    field.addEventListener('blur', () => {
      const isValid = validator(field.value);
      if (isValid) {
        this.markValid(field);
      } else {
        this.markInvalid(field);
      }
    });

    field.addEventListener('input', () => {
      // Clear invalid state when user starts typing
      if (field.classList.contains('invalid')) {
        this.markValid(field);
      }
    });
  }
}

// Export for use
export default TaskFormValidator;
