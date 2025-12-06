/**
 * ═══════════════════════════════════════════════════════════════
 * LEGACY CODE - addBudgetTask() Function
 * ═══════════════════════════════════════════════════════════════
 *
 * מקור: js/main.js שורות 690-834
 * תאריך העברה: 2025-12-07
 * הועבר ל: components/add-task/AddTaskDialog.js (handleSubmit + saveTask)
 *
 * ⚠️ קוד זה לא בשימוש יותר - נשמר לבטיחות בלבד!
 */

async addBudgetTask() {
  // ✅ Prevent race conditions - block if operation already in progress
  if (this.isTaskOperationInProgress) {
    this.showNotification('אנא המתן לסיום הפעולה הקודמת', 'warning');
    return;
  }

  this.isTaskOperationInProgress = true;

  try {
    // ✅ NEW: Get values from ClientCaseSelector
    const selectorValues = window.ClientCaseSelectorsManager?.getBudgetValues();

    if (!selectorValues) {
      this.showNotification('חובה לבחור לקוח ותיק', 'error');
      return;
    }

  // Validate other form fields
  const description = document.getElementById('budgetDescription')?.value?.trim();
  const descriptionCategory = document.getElementById('budgetDescriptionCategory')?.value || null;
  const estimatedMinutes = parseInt(document.getElementById('estimatedTime')?.value);
  const deadline = document.getElementById('budgetDeadline')?.value;

  // ✅ Get category name for display purposes
  let categoryName = null;
  if (descriptionCategory && window.WorkCategories) {
    const cat = window.WorkCategories.getCategoryById(descriptionCategory);
    categoryName = cat?.name || null;
  }

  if (!description || description.length < 3) {
    this.showNotification('חובה להזין תיאור משימה (לפחות 3 תווים)', 'error');
    return;
  }

  if (!estimatedMinutes || estimatedMinutes < 1) {
    this.showNotification('חובה להזין זמן משוער', 'error');
    return;
  }

  if (!deadline) {
    this.showNotification('חובה לבחור תאריך יעד', 'error');
    return;
  }

  // ✅ Get branch value
  const branch = document.getElementById('budgetBranch')?.value;
  if (!branch) {
    this.showNotification('חובה לבחור סניף מטפל', 'error');
    return;
  }

    // ✅ NEW: Use ActionFlowManager for consistent UX with NotificationMessages
    const msgs = window.NotificationMessages.tasks;

    await ActionFlowManager.execute({
      ...msgs.loading.create(selectorValues.clientName),
      action: async () => {
        const taskData = {
          description: description,
          categoryId: descriptionCategory,  // ✅ NEW: Work category ID for context-aware filtering
          categoryName: categoryName,       // ✅ NEW: Work category name for display
          clientName: selectorValues.clientName,
          clientId: selectorValues.clientId,
          caseId: selectorValues.caseId,
          caseNumber: selectorValues.caseNumber,
          caseTitle: selectorValues.caseTitle,
          serviceId: selectorValues.serviceId,  // ✅ שירות/שלב נבחר (stage.id עבור הליך משפטי)
          serviceName: selectorValues.serviceName,  // ✅ שם השירות
          serviceType: selectorValues.serviceType,  // ✅ סוג השירות (legal_procedure/hours)
          parentServiceId: selectorValues.parentServiceId,  // ✅ service.id עבור הליך משפטי
          branch: branch,  // ✅ סניף מטפל
          estimatedMinutes: estimatedMinutes,
          originalEstimate: estimatedMinutes, // ✅ NEW: originalEstimate for v2.0
          deadline: deadline,
          employee: this.currentUser,
          status: 'active',
          timeSpent: 0,
          timeEntries: [],
          createdAt: new Date()
        };

        Logger.log('📝 Creating budget task with data:', taskData);
        console.log('🔍 FULL taskData:', JSON.stringify(taskData, null, 2));
        console.log('🔍 serviceType:', taskData.serviceType);
        console.log('🔍 parentServiceId:', taskData.parentServiceId);
        console.log('🔍 serviceId:', taskData.serviceId);

        // Architecture v2.0 - FirebaseService with retry
        Logger.log('  🚀 [v2.0] Using FirebaseService.call');

        const result = await window.FirebaseService.call('createBudgetTask', taskData, {
          retries: 3,
          timeout: 15000
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to create budget task');
        }

        // Emit EventBus event
        window.EventBus.emit('task:created', {
          taskId: result.data?.taskId || 'unknown',
          clientId: taskData.clientId,
          clientName: taskData.clientName,
          employee: taskData.employee,
          originalEstimate: taskData.estimatedMinutes
        });
        Logger.log('  🚀 [v2.0] EventBus: task:created emitted');

        // ✅ Invalidate cache to force fresh data on next load (all filters)
        this.dataCache.invalidate(`budgetTasks:${this.currentUser}:active`);
        this.dataCache.invalidate(`budgetTasks:${this.currentUser}:completed`);
        this.dataCache.invalidate(`budgetTasks:${this.currentUser}:all`);

        // Reload tasks with cache (will fetch fresh because invalidated)
        this.budgetTasks = await this.dataCache.get(`budgetTasks:${this.currentUser}:${this.currentTaskFilter}`, () =>
          this.integrationManager?.loadBudgetTasks(this.currentUser, this.currentTaskFilter)
            || BudgetTasks.loadBudgetTasksFromFirebase(this.currentUser, this.currentTaskFilter, 50)
        );
        this.filterBudgetTasks();
      },
      successMessage: msgs.success.created(selectorValues.clientName, description),
      errorMessage: msgs.error.createFailed,
      onSuccess: () => {
        // Clear form and hide
        Forms.clearBudgetForm(this);
        document.getElementById('budgetFormContainer')?.classList.add('hidden');

        // Remove active class from plus button
        const plusButton = document.getElementById('smartPlusBtn');
        if (plusButton) {
          plusButton.classList.remove('active');
        }

        // Clear selector
        window.ClientCaseSelectorsManager?.clearBudget();
      }
    });
  } finally {
    // ✅ Always release the lock
    this.isTaskOperationInProgress = false;
  }
}
