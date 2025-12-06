/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TASK FORM MANAGER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description Manager for task form operations (fill, clear, draft)
 * @version 2.0.0
 * @created 2025-01-20
 *
 * @features
 * - מילוי ערכי ברירת מחדל
 * - ניקוי הטופס
 * - שמירת וטעינת טיוטות
 * - קבלת נתוני הטופס
 */

const DRAFT_STORAGE_KEY = 'addTaskDraft';

/**
 * TaskFormManager Class
 * מחלקה לניהול טופס הוספת משימה
 */
export class TaskFormManager {
  constructor(formId = 'addTaskForm') {
    this.formId = formId;
    this.form = null;
  }

  /**
   * Initialize form reference
   * אתחול התייחסות לטופס
   */
  init() {
    this.form = document.getElementById(this.formId);
    if (!this.form) {
      console.warn(`⚠️ Form #${this.formId} not found`);
    }
  }

  /**
   * Fill form with default values
   * מילוי ערכי ברירת מחדל
   *
   * @param {Object} defaults - Default values
   */
  fillDefaults(defaults = {}) {
    if (!this.form) {
      console.error('❌ Form not initialized');
      return;
    }

    // Set default deadline (tomorrow at 17:00)
    if (!defaults.deadline) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(17, 0, 0, 0);

      const deadlineInput = this.form.querySelector('#taskDeadline');
      if (deadlineInput) {
        // Format for datetime-local input: YYYY-MM-DDTHH:MM
        const formattedDate = tomorrow.toISOString().slice(0, 16);
        deadlineInput.value = formattedDate;
      }
    }

    // Set default estimated time (60 minutes)
    if (!defaults.estimatedTime) {
      const timeInput = this.form.querySelector('#taskEstimatedTime');
      if (timeInput) {
        timeInput.value = '60';
      }
    }

    // Set other defaults if provided
    if (defaults.branch) {
      const branchInput = this.form.querySelector('#taskBranch');
      if (branchInput) {
        branchInput.value = defaults.branch;
      }
    }
  }

  /**
   * Clear the entire form
   * ניקוי הטופס
   */
  clear() {
    if (!this.form) {
      console.error('❌ Form not initialized');
      return;
    }

    // Reset native form
    this.form.reset();

    // Clear ClientCaseSelector if exists
    if (window.ClientCaseSelectorsManager) {
      window.ClientCaseSelectorsManager.clearBudget?.();
    }

    // Clear description selector if exists
    const descSelector = this.form.querySelector('#taskDescriptionSelector');
    if (descSelector && window.SmartComboSelector) {
      // Reset selector - implementation depends on SmartComboSelector API
      const selectorInstance = descSelector._smartComboInstance;
      if (selectorInstance?.clear) {
        selectorInstance.clear();
      }
    }

    // Clear hidden inputs
    const hiddenInputs = this.form.querySelectorAll('input[type="hidden"]');
    hiddenInputs.forEach(input => input.value = '');

    console.log('✅ Form cleared');
  }

  /**
   * Save form data as draft
   * שמירת נתוני הטופס כטיוטה
   *
   * @returns {boolean} Success
   */
  saveDraft() {
    try {
      const formData = this.getFormData();

      const draft = {
        ...formData,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      console.log('✅ Draft saved');
      return true;
    } catch (error) {
      console.error('❌ Failed to save draft:', error);
      return false;
    }
  }

  /**
   * Load draft from storage
   * טעינת טיוטה מהאחסון
   *
   * @returns {Object|null} Draft data or null
   */
  loadDraft() {
    try {
      const draftJson = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!draftJson) {
        return null;
      }

      const draft = JSON.parse(draftJson);

      // Check if draft is not too old (7 days)
      const savedDate = new Date(draft.savedAt);
      const now = new Date();
      const daysDiff = (now - savedDate) / (1000 * 60 * 60 * 24);

      if (daysDiff > 7) {
        console.log('⏰ Draft is too old, clearing...');
        this.clearDraft();
        return null;
      }

      console.log('✅ Draft loaded');
      return draft;
    } catch (error) {
      console.error('❌ Failed to load draft:', error);
      return null;
    }
  }

  /**
   * Clear saved draft
   * ניקוי טיוטה שמורה
   */
  clearDraft() {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      console.log('✅ Draft cleared');
    } catch (error) {
      console.error('❌ Failed to clear draft:', error);
    }
  }

  /**
   * Fill form with draft data
   * מילוי הטופס עם נתוני טיוטה
   *
   * @param {Object} draft - Draft data
   */
  fillWithDraft(draft) {
    if (!this.form || !draft) {
      return;
    }

    // Fill basic fields
    if (draft.branch) {
      const branchInput = this.form.querySelector('#taskBranch');
      if (branchInput) branchInput.value = draft.branch;
    }

    if (draft.deadline) {
      const deadlineInput = this.form.querySelector('#taskDeadline');
      if (deadlineInput) deadlineInput.value = draft.deadline;
    }

    if (draft.estimatedTime) {
      const timeInput = this.form.querySelector('#taskEstimatedTime');
      if (timeInput) timeInput.value = draft.estimatedTime;
    }

    if (draft.description) {
      const descInput = this.form.querySelector('#taskDescription');
      if (descInput) descInput.value = draft.description;
    }

    console.log('✅ Form filled with draft data');
  }

  /**
   * Get all form data
   * קבלת כל נתוני הטופס
   *
   * @returns {Object} Form data
   */
  getFormData() {
    if (!this.form) {
      console.error('❌ Form not initialized');
      return {};
    }

    // Get ClientCaseSelector values
    const selectorValues = window.ClientCaseSelectorsManager?.getBudgetValues?.() || {};

    // Get form field values
    const branch = this.form.querySelector('#taskBranch')?.value || '';
    const deadline = this.form.querySelector('#taskDeadline')?.value || '';
    const estimatedTime = this.form.querySelector('#taskEstimatedTime')?.value || '';
    const description = this.form.querySelector('#taskDescription')?.value || '';
    const descriptionCategory = this.form.querySelector('#taskDescriptionCategory')?.value || '';

    return {
      // Client & Case
      ...selectorValues,

      // Task details
      branch,
      deadline,
      estimatedTime: parseInt(estimatedTime) || 0,
      description,
      categoryId: descriptionCategory,
      categoryName: this.getCategoryName(descriptionCategory)
    };
  }

  /**
   * Get category name by ID
   * קבלת שם קטגוריה לפי מזהה
   *
   * @param {string} categoryId - Category ID
   * @returns {string|null} Category name
   */
  getCategoryName(categoryId) {
    if (!categoryId || !window.WorkCategories) {
      return null;
    }

    const category = window.WorkCategories.getCategoryById(categoryId);
    return category?.name || null;
  }

  /**
   * Check if form has unsaved changes
   * בדיקה האם יש שינויים לא שמורים
   *
   * @returns {boolean} Has changes
   */
  hasUnsavedChanges() {
    const formData = this.getFormData();

    // Check if any field has value
    return !!(
      formData.description ||
      formData.branch ||
      formData.estimatedTime ||
      formData.clientId
    );
  }

  /**
   * Prompt user to save draft before leaving
   * שאלת המשתמש אם לשמור טיוטה לפני יציאה
   *
   * @returns {Promise<boolean>} Continue with action
   */
  async promptSaveDraft() {
    if (!this.hasUnsavedChanges()) {
      return true; // No changes, continue
    }

    // Use NotificationSystem if available
    if (window.NotificationSystem?.confirm) {
      return new Promise((resolve) => {
        window.NotificationSystem.confirm(
          'יש לך שינויים לא שמורים. האם לשמור כטיוטה?',
          () => {
            this.saveDraft();
            resolve(true);
          },
          () => {
            resolve(true);
          },
          {
            title: 'שמירת טיוטה',
            confirmText: 'כן, שמור',
            cancelText: 'לא, המשך בלי לשמור'
          }
        );
      });
    }

    // Fallback to confirm()
    const shouldSave = confirm('יש לך שינויים לא שמורים. האם לשמור כטיוטה?');
    if (shouldSave) {
      this.saveDraft();
    }
    return true;
  }
}

// Export for use
export default TaskFormManager;
