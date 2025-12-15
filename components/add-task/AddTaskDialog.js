/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADD TASK DIALOG - MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description Main dialog component for adding new budget tasks
 * @version 2.0.0
 * @created 2025-01-20
 *
 * @features
 * - דיאלוג פופאפ מלא להוספת משימה
 * - אינטגרציה עם ClientCaseSelector
 * - אינטגרציה עם SmartComboSelector
 * - ולידציה מלאה
 * - שמירת טיוטות
 * - Backward compatibility
 */

import { TaskFormValidator } from './TaskFormValidator.js';
import { TaskFormManager } from './TaskFormManager.js';
import { buildTaskData, validateTaskData } from './utils/task-data-builder.js';

/**
 * AddTaskDialog Class
 * קומפוננטת דיאלוג להוספת משימה חדשה
 */
export class AddTaskDialog {
  constructor(manager, options = {}) {
    this.manager = manager;
    this.options = {
      onSuccess: options.onSuccess || null,
      onError: options.onError || null,
      onCancel: options.onCancel || null,
      enableDrafts: options.enableDrafts !== false, // default true
      ...options
    };

    this.validator = new TaskFormValidator();
    this.formManager = new TaskFormManager('addTaskForm');

    this.overlay = null;
    this.isVisible = false;
    this.clientCaseSelector = null;
    this.descriptionSelector = null;

    console.log('✅ AddTaskDialog instance created');
  }

  /**
   * Show the dialog
   * הצגת הדיאלוג
   */
  show() {
    console.log('🔍 AddTaskDialog.show() called');

    if (this.isVisible) {
      console.warn('⚠️ Dialog is already visible');
      return;
    }

    try {
      console.log('🔍 Calling render()...');
      this.render();
      this.isVisible = true;
      console.log('✅ Add Task Dialog shown successfully');
    } catch (error) {
      console.error('❌ Error showing Add Task Dialog:', error);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  /**
   * Hide the dialog
   * הסתרת הדיאלוג - בדיוק כמו המקור (רק הוספת class hidden)
   */
  async hide() {
    if (!this.isVisible) {
      return;
    }

    // Check for unsaved changes
    if (this.options.enableDrafts && this.formManager.hasUnsavedChanges()) {
      const shouldContinue = await this.formManager.promptSaveDraft();
      if (!shouldContinue) {
        return; // User cancelled
      }
    }

    // ✅ הסתרה בדיוק כמו המקור - רק הוספת class hidden
    if (this.overlay) {
      this.overlay.classList.add('hidden');
    }

    this.isVisible = false;

    // Call onCancel callback
    if (this.options.onCancel) {
      this.options.onCancel();
    }

    console.log('✅ Add Task Dialog hidden');
  }

  /**
   * Render the dialog HTML
   * בניית HTML של הדיאלוג - inline בדיוק כמו המקור
   */
  render() {
    console.log('🔍 render() called');

    try {
      const html = this.buildHTML();
      console.log('✅ buildHTML() completed');

      // ✅ חפש את המיקום המקורי של הטופס (לפני budgetTab content)
      const budgetTab = document.getElementById('budgetTab');
      if (!budgetTab) {
        console.error('❌ budgetTab not found - element does not exist in DOM');
        console.log('Available elements:', document.querySelectorAll('[id*="budget"]'));
        throw new Error('budgetTab element not found');
      }
      console.log('✅ budgetTab found:', budgetTab);

      // יצירת הטופס
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      this.overlay = tempDiv.firstElementChild;
      console.log('✅ overlay created:', this.overlay);

      // הוספת הטופס בתחילת budgetTab (כמו המקור)
      budgetTab.insertBefore(this.overlay, budgetTab.firstChild);
      console.log('✅ overlay inserted into budgetTab');

      // הסרת class hidden להצגת הטופס
      this.overlay.classList.remove('hidden');
      console.log('✅ hidden class removed');

      // Initialize form manager
      this.formManager.init();
      console.log('✅ form manager initialized');

      // Setup event listeners
      this.setupEventListeners();
      console.log('✅ event listeners setup');

      // Initialize selectors
      setTimeout(() => this.initializeSelectors(), 100);
      console.log('✅ selectors initialization scheduled');

      // Load draft if enabled
      if (this.options.enableDrafts) {
        const draft = this.formManager.loadDraft();
        if (draft) {
          this.showDraftPrompt(draft);
        } else {
          // No draft - fill defaults
          this.formManager.fillDefaults();
        }
      } else {
        this.formManager.fillDefaults();
      }
      console.log('✅ render() completed successfully');

    } catch (error) {
      console.error('❌ Error in render():', error);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  /**
   * Build dialog HTML
   * בניית HTML של הדיאלוג - זהה 100% למקור ב-index.html
   *
   * @returns {string} HTML string
   */
  buildHTML() {
    // ✅ זהה לחלוטין ל-index.html שורות 507-582
    return `
      <div class="compact-form" id="budgetFormContainer">
        <form id="budgetForm">
          <!-- ✅ NEW: Unified Client-Case Selector -->
          <div id="budgetClientCaseSelector"></div>

          <!-- Compact Row: סניף + תאריך + דקות - הכל בשורה אחת מאוזנת -->
          <div class="form-row" style="grid-template-columns: 1fr 1fr 160px; gap: 12px;">
            <div class="form-group">
              <label for="budgetBranch">
                <i class="fas fa-map-marker-alt"></i> סניף מטפל
                <span class="category-required">*</span>
              </label>
              <select id="budgetBranch" required>
                <option value="">בחר סניף</option>
                <option value="רחובות">רחובות</option>
                <option value="תל אביב">תל אביב</option>
              </select>
            </div>
            <div class="form-group">
              <label for="budgetDeadline">
                <i class="fas fa-calendar-alt"></i> תאריך יעד
                <span class="category-required">*</span>
              </label>
              <input
                type="datetime-local"
                id="budgetDeadline"
                required
              />
            </div>
            <div class="form-group">
              <label for="estimatedTime">
                <i class="fas fa-hourglass-half"></i> דקות
                <span class="category-required">*</span>
              </label>
              <input
                type="number"
                id="estimatedTime"
                placeholder="120"
                min="1"
                max="99999"
                autocomplete="off"
                required
              />
            </div>
          </div>

          <!-- תיאור המשימה - Smart Selector -->
          <div class="form-row">
            <div class="form-group">
              <label for="budgetDescriptionSelector">
                <i class="fas fa-align-right"></i> תיאור המשימה
                <span class="category-required">*</span>
              </label>
              <div id="budgetDescriptionSelector"></div>
              <!-- Hidden inputs for validation -->
              <input type="hidden" id="budgetDescription" required>
              <input type="hidden" id="budgetDescriptionCategory">
            </div>
          </div>

          <div class="form-buttons">
            <button type="submit" class="btn btn-primary">
              <i class="fas fa-plus"></i>
              הוסף לתקצוב
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              onclick="window.AddTaskSystem.hide()"
            >
              <i class="fas fa-times"></i>
              ביטול
            </button>
          </div>
        </form>
      </div>
    `;
  }

  /**
   * Setup event listeners
   * הגדרת מאזינים לאירועים
   */
  setupEventListeners() {
    const form = document.getElementById('addTaskForm');
    if (!form) {
return;
}

    // Form submit
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // Close on overlay click
    if (this.overlay) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.hide();
        }
      });
    }

    // Escape key to close
    document.addEventListener('keydown', this.handleEscapeKey.bind(this));

    console.log('✅ Event listeners setup');
  }

  /**
   * Handle Escape key press
   * טיפול בלחיצה על Escape
   */
  handleEscapeKey(e) {
    if (e.key === 'Escape' && this.isVisible) {
      this.hide();
    }
  }

  /**
   * Initialize selectors (ClientCase & Description)
   * אתחול בוחרים (לקוח/תיק ותיאור)
   */
  async initializeSelectors() {
    try {
      // Initialize ClientCaseSelector
      await this.initClientCaseSelector();

      // Initialize Description Selector
      await this.initDescriptionSelector();

      console.log('✅ Selectors initialized');
    } catch (error) {
      console.error('❌ Error initializing selectors:', error);
    }
  }

  /**
   * Initialize ClientCaseSelector
   * אתחול בוחר לקוח/תיק
   */
  async initClientCaseSelector() {
    if (!window.ClientCaseSelectorsManager) {
      console.error('❌ ClientCaseSelectorsManager not available');
      return;
    }

    const container = document.getElementById('addTaskClientCaseSelector');
    if (!container) {
return;
}

    try {
      await window.ClientCaseSelectorsManager.initializeBudgetSelector(
        this.manager.clients,
        this.manager.currentUser
      );

      this.clientCaseSelector = window.ClientCaseSelectorsManager;
      console.log('✅ ClientCaseSelector initialized');
    } catch (error) {
      console.error('❌ Error initializing ClientCaseSelector:', error);
    }
  }

  /**
   * Initialize SmartComboSelector for description
   * אתחול בוחר חכם לתיאור
   */
  async initDescriptionSelector() {
    if (!window.SmartComboSelector) {
      console.warn('⚠️ SmartComboSelector not available');
      return;
    }

    const container = document.getElementById('taskDescriptionSelector');
    if (!container) {
return;
}

    try {
      this.descriptionSelector = new window.SmartComboSelector('taskDescriptionSelector', {
        required: true,
        placeholder: 'בחר או הקלד תיאור עבודה...',
        suggestLastUsed: true,
        autoSelectSuggestion: false
      });

      console.log('✅ Description selector initialized');
    } catch (error) {
      console.error('❌ Error initializing description selector:', error);
    }
  }

  /**
   * Handle form submit
   * טיפול בשליחת הטופס
   */
  async handleSubmit() {
    try {
      console.log('📝 Processing form submission...');

      // Get form data
      const formData = this.formManager.getFormData();

      // Validate
      const validation = this.validator.validateAll({
        selectorValues: formData,
        branch: formData.branch,
        deadline: formData.deadline,
        estimatedTime: formData.estimatedTime,
        description: formData.description
      });

      if (!validation.isValid) {
        const errorContainer = document.getElementById('taskFormErrors');
        this.validator.showErrors(validation.errors, errorContainer);
        return;
      }

      // Build task data
      const taskData = buildTaskData(formData, this.manager.currentUser);

      // Final validation
      const dataValidation = validateTaskData(taskData);
      if (!dataValidation.isValid) {
        const errorContainer = document.getElementById('taskFormErrors');
        this.validator.showErrors(dataValidation.errors, errorContainer);
        return;
      }

      // Disable submit button
      const submitBtn = document.getElementById('addTaskSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר...';
      }

      // Call the manager's method to save
      await this.saveTask(taskData);

    } catch (error) {
      console.error('❌ Error submitting form:', error);

      if (window.NotificationSystem) {
        window.NotificationSystem.show(
          'שגיאה בשמירת המשימה: ' + error.message,
          'error'
        );
      } else {
        alert('שגיאה בשמירת המשימה: ' + error.message);
      }

      // Re-enable submit button
      const submitBtn = document.getElementById('addTaskSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> הוסף לתקצוב';
      }

      // Call onError callback
      if (this.options.onError) {
        this.options.onError(error);
      }
    }
  }

  /**
   * Save task to Firebase
   * שמירת משימה ל-Firebase - עם בקשת אישור תקציב
   *
   * @param {Object} taskData - Task data object
   */
  async saveTask(taskData) {
    try {
      console.log('💾 Saving task with approval request...', taskData);

      // ✅ שלב 1: שמור את המשימה עם סטטוס pending_approval
      const taskDataWithApproval = {
        ...taskData,
        status: 'pending_approval', // ❗ שינוי סטטוס
        requestedMinutes: taskData.estimatedMinutes, // שמור תקציב מקורי
        approvedMinutes: null, // יעודכן אחרי אישור
        approvalId: null // יעודכן אחרי יצירת בקשה
      };

      // Use FirebaseService if available
      if (window.FirebaseService) {
        const result = await window.FirebaseService.call('createBudgetTask', taskDataWithApproval, {
          retries: 3,
          timeout: 15000
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to create task');
        }

        const taskId = result.data?.taskId;
        console.log('✅ Task created with pending_approval status:', taskId);

        // ✅ שלב 2: צור בקשת אישור ב-pending_task_approvals
        try {
          // Import TaskApprovalService dynamically
          const { taskApprovalService } = await import('../task-approval-system/services/task-approval-service.js');

          // Initialize if needed
          if (window.firebaseDB && this.manager.currentUser) {
            taskApprovalService.init(window.firebaseDB, this.manager.currentUser);
          }

          // Create approval request
          const approvalId = await taskApprovalService.createApprovalRequest(
            taskId,
            taskData,
            this.manager.currentUser.email || this.manager.currentUser,
            this.manager.currentUser.displayName || this.manager.currentUser.email || 'משתמש'
          );

          console.log('✅ Approval request created:', approvalId);

          // Update task with approvalId
          if (window.firebaseDB) {
            await window.firebaseDB.collection('budget_tasks').doc(taskId).update({
              approvalId: approvalId
            });
          }

        } catch (approvalError) {
          console.error('⚠️ Error creating approval request:', approvalError);
          // Continue anyway - המשימה נוצרה, רק בקשת האישור נכשלה
        }

        // Emit EventBus event if available
        if (window.EventBus) {
          window.EventBus.emit('task:created', {
            taskId: taskId || 'unknown',
            clientId: taskData.clientId,
            clientName: taskData.clientName,
            employee: taskData.employee,
            status: 'pending_approval'
          });
        }

        // Success - clear draft
        if (this.options.enableDrafts) {
          this.formManager.clearDraft();
        }

        // ✅ Show UPDATED success message - כולל הודעה על אישור
        if (window.NotificationSystem) {
          window.NotificationSystem.show(
            `המשימה הועברה למנהל לאישור תקציב\n\nתקציב מבוקש: ${taskData.estimatedMinutes} דקות\n\nתקבל התראה באייקון המעטפה כשהמנהל יאשר`,
            'success',
            5000 // 5 seconds - longer to read
          );
        }

        // Call onSuccess callback
        if (this.options.onSuccess) {
          this.options.onSuccess(taskData);
        }

        // ✅ OPTIMIZATION: No need to manually refresh - Real-time listener handles it
        // Real-time listener already updates the UI when tasks change
        // Removed: await this.manager.refreshBudgetTasks()
        // This saves ~1 second and prevents unnecessary Firestore read

        // Close dialog
        this.hide();

      } else {
        throw new Error('FirebaseService לא זמין');
      }

    } catch (error) {
      console.error('❌ Error saving task:', error);
      throw error;
    }
  }

  /**
   * Show draft prompt to user
   * הצגת הודעה על טיוטה קיימת
   *
   * @param {Object} draft - Draft data
   */
  showDraftPrompt(draft) {
    if (!window.NotificationSystem?.confirm) {
      // Fallback: just fill with draft
      this.formManager.fillWithDraft(draft);
      return;
    }

    window.NotificationSystem.confirm(
      'נמצאה טיוטה שמורה. האם לטעון אותה?',
      () => {
        // Load draft
        this.formManager.fillWithDraft(draft);
      },
      () => {
        // Clear draft and use defaults
        this.formManager.clearDraft();
        this.formManager.fillDefaults();
      },
      {
        title: 'טיוטה שמורה',
        confirmText: 'כן, טען',
        cancelText: 'לא תודה'
      }
    );
  }

  /**
   * Cleanup resources
   * ניקוי משאבים
   */
  cleanup() {
    // Remove escape key listener
    document.removeEventListener('keydown', this.handleEscapeKey.bind(this));

    // Cleanup selectors
    this.clientCaseSelector = null;
    this.descriptionSelector = null;

    console.log('✅ AddTaskDialog cleaned up');
  }
}

// Export for use
export default AddTaskDialog;
