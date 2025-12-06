/**
 * ════════════════════════════════════════════════════════════════
 * Task Completion Validation Module
 * ════════════════════════════════════════════════════════════════
 *
 * מודול לניהול תהליך סיום משימה עם ולידציה של פער בין זמן משוער למבוצע
 *
 * תכונות:
 * - חישוב פער אחוזי בין זמן מתוכנן לזמן בפועל
 * - 3 רמות חומרה: OK (<20%), Warning (20-50%), Critical (50%+)
 * - דיאלוגים מותאמים לכל רמת חומרה
 * - דרישת הסברים חובה לפער גדול
 * - שליחת התראות למנהל במקרה של פער קריטי
 * - תעוד מלא בהיסטוריית המשימה
 *
 * @version 1.0.0
 * @created 2025-11-12
 * ════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  /**
   * Validation thresholds
   */
  const THRESHOLDS = {
    OK: 20,        // Less than 20% gap - no validation needed
    WARNING: 50,   // 20-50% gap - show warning dialog
    CRITICAL: 50   // 50%+ gap - require explanation
  };

  /**
   * Pre-defined gap reasons (user can select)
   */
  const GAP_REASONS = {
    UNDERESTIMATED: {
      he: 'חשבתי שייקח לי יותר זמן',
      en: 'Underestimated time required'
    },
    OVERESTIMATED: {
      he: 'הערכתי יותר מדי זמן',
      en: 'Overestimated time required'
    },
    USED_EXISTING: {
      he: 'השתמשתי בפתרון קיים',
      en: 'Used existing solution'
    },
    SCOPE_CHANGED: {
      he: 'ההיקף השתנה במהלך הביצוע',
      en: 'Scope changed during execution'
    },
    FOUND_SHORTCUT: {
      he: 'מצאתי דרך קצרה יותר',
      en: 'Found more efficient approach'
    },
    COMPLICATIONS: {
      he: 'נתקלתי בקשיים בלתי צפויים',
      en: 'Encountered unexpected complications'
    },
    REQUIREMENTS_CHANGED: {
      he: 'דרישות השתנו',
      en: 'Requirements changed'
    },
    OTHER: {
      he: 'אחר (הסבר בהערות)',
      en: 'Other (explain in notes)'
    }
  };

  /**
   * Calculate time gap validation result
   * @param {Object} task - Task object with estimatedMinutes and actualMinutes
   * @returns {Object} Validation result
   */
  function validateTaskCompletion(task) {
    const estimatedMinutes = task.estimatedMinutes || 0;
    const actualMinutes = task.actualMinutes || 0;

    // If no estimate, allow completion
    if (estimatedMinutes === 0) {
      return {
        canComplete: true,
        severity: 'OK',
        gapPercent: 0,
        gapMinutes: 0,
        requiresExplanation: false
      };
    }

    const gapMinutes = actualMinutes - estimatedMinutes;
    const gapPercent = Math.abs((gapMinutes / estimatedMinutes) * 100);
    const isUnder = gapMinutes < 0;
    const isOver = gapMinutes > 0;

    // Determine severity
    let severity = 'OK';
    let requiresExplanation = false;

    if (gapPercent >= THRESHOLDS.CRITICAL) {
      severity = 'CRITICAL';
      requiresExplanation = true;
    } else if (gapPercent >= THRESHOLDS.OK) {
      severity = 'WARNING';
      requiresExplanation = false;
    }

    return {
      canComplete: true, // Always allow, but show dialog
      severity,
      gapPercent: Math.round(gapPercent),
      gapMinutes: Math.abs(gapMinutes),
      isUnder,
      isOver,
      requiresExplanation,
      estimatedMinutes,
      actualMinutes
    };
  }

  /**
   * Show completion dialog based on validation severity
   * @param {Object} task - Task object
   * @param {Object} validation - Validation result
   * @param {Object} manager - Manager instance
   */
  function showCompletionDialog(task, validation, manager) {
    if (validation.severity === 'OK') {
      // No gap issue - show standard completion modal
      if (window.DialogsModule && window.DialogsModule.showTaskCompletionModal) {
        window.DialogsModule.showTaskCompletionModal(task, manager);
      }
      return;
    }

    if (validation.severity === 'WARNING') {
      showWarningDialog(task, validation, manager);
    } else if (validation.severity === 'CRITICAL') {
      showCriticalDialog(task, validation, manager);
    }
  }

  /**
   * Show warning dialog (20-50% gap)
   * @param {Object} task - Task object
   * @param {Object} validation - Validation result
   * @param {Object} manager - Manager instance
   */
  function showWarningDialog(task, validation, manager) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay task-completion-validation-overlay';
    overlay.style.zIndex = '10001';

    const gapDirection = validation.isOver ? 'חרגת' : 'סיימת מהר יותר';
    const gapColor = validation.isOver ? '#f59e0b' : '#3b82f6';
    const gapIcon = validation.isOver ? 'fa-exclamation-triangle' : 'fa-bolt';

    overlay.innerHTML = `
      <div class="popup completion-validation-popup" style="max-width: 600px; animation: slideInUp 0.3s ease-out;">
        <!-- Header -->
        <div class="popup-header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas ${gapIcon}" style="font-size: 24px;"></i>
            <span style="font-size: 18px; font-weight: 600;">שים לב - פער בזמן</span>
          </div>
        </div>

        <div class="popup-content" style="padding: 30px;">
          <!-- Task Info -->
          <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin-bottom: 25px; border: 1px solid #e5e7eb;">
            <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 18px; font-weight: 700;">
              ${window.safeText(task.taskDescription || task.description || '')}
            </h3>
            <div style="color: #6b7280; font-size: 14px; display: flex; align-items: center; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-building" style="color: #3b82f6;"></i>
                <span>${window.safeText(task.clientName || '')}</span>
              </div>
            </div>
          </div>

          <!-- Gap Warning -->
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; margin-bottom: 25px; border: 2px solid #fbbf24;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
              <div style="width: 48px; height: 48px; border-radius: 50%; background: #f59e0b; display: flex; align-items: center; justify-content: center;">
                <i class="fas ${gapIcon}" style="font-size: 24px; color: white;"></i>
              </div>
              <div>
                <div style="font-size: 16px; font-weight: 700; color: #92400e; margin-bottom: 4px;">
                  ${gapDirection} ב-${validation.gapPercent}%
                </div>
                <div style="font-size: 14px; color: #78350f;">
                  פער של ${validation.gapMinutes} דקות (${Math.round(validation.gapMinutes / 60 * 10) / 10} שעות)
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 14px;">
              <div style="background: white; padding: 12px; border-radius: 8px;">
                <div style="color: #6b7280; margin-bottom: 4px;">זמן משוער:</div>
                <div style="font-weight: 600; color: #1f2937; font-size: 16px;">${validation.estimatedMinutes} דק'</div>
              </div>
              <div style="background: white; padding: 12px; border-radius: 8px;">
                <div style="color: #6b7280; margin-bottom: 4px;">זמן בפועל:</div>
                <div style="font-weight: 600; color: ${gapColor}; font-size: 16px;">${validation.actualMinutes} דק'</div>
              </div>
            </div>
          </div>

          <!-- Message -->
          <div style="background: #f0f9ff; padding: 16px; border-radius: 10px; border: 1px solid #bae6fd; margin-bottom: 25px;">
            <div style="display: flex; align-items: start; gap: 12px;">
              <i class="fas fa-info-circle" style="color: #0284c7; font-size: 20px; margin-top: 2px;"></i>
              <div style="color: #0c4a6e; font-size: 14px; line-height: 1.6;">
                <strong>אפשר להמשיך ולסיים את המשימה</strong>, אך מומלץ לבדוק אם הערכת הזמן הייתה מדויקת.
                ${validation.isOver ? 'פער גדול עלול להשפיע על תכנון עתידי.' : 'סיום מהיר - מעולה! אולי תוכל לחסוך זמן גם במשימות דומות.'}
              </div>
            </div>
          </div>

          <!-- Optional Notes -->
          <div style="margin-bottom: 0;">
            <label style="display: block; margin-bottom: 10px; font-weight: 600; color: #374151; font-size: 14px; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-pen" style="color: #f59e0b;"></i>
              הערות (אופציונלי)
            </label>
            <textarea
              id="warningCompletionNotes"
              rows="3"
              placeholder="למה היה פער בזמן? (אופציונלי)"
              style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; font-family: inherit; resize: vertical; transition: all 0.2s;"
              onfocus="this.style.borderColor='#f59e0b'; this.style.boxShadow='0 0 0 3px rgba(245, 158, 11, 0.1)'"
              onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'"
            ></textarea>
          </div>
        </div>

        <div class="popup-buttons" style="padding: 20px 30px; background: #f9fafb; border-top: 1px solid #e5e7eb; display: flex; gap: 12px;">
          <button
            class="popup-btn popup-btn-confirm"
            onclick="window.TaskCompletionValidation.proceedWithCompletion('${task.id}', false)"
            style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); flex: 1; padding: 15px; font-size: 16px; font-weight: 600; border-radius: 10px;">
            <i class="fas fa-check"></i> המשך לסיום משימה
          </button>
          <button
            class="popup-btn popup-btn-cancel"
            onclick="this.closest('.popup-overlay').remove()"
            style="flex: 0.4; padding: 15px; border-radius: 10px;">
            <i class="fas fa-times"></i> ביטול
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // ✅ תיקון: הסרת class .hidden כדי שהפופאפ יופיע
    setTimeout(() => overlay.classList.add('show'), 10);
  }

  /**
   * Show critical dialog (50%+ gap) - requires explanation
   * @param {Object} task - Task object
   * @param {Object} validation - Validation result
   * @param {Object} manager - Manager instance
   */
  function showCriticalDialog(task, validation, manager) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay task-completion-validation-overlay';
    overlay.style.zIndex = '10001';

    const gapDirection = validation.isOver ? 'חריגה משמעותית' : 'סיום מהיר במיוחד';
    const gapColor = validation.isOver ? '#dc2626' : '#059669';
    const gapIcon = validation.isOver ? 'fa-exclamation-circle' : 'fa-rocket';

    overlay.innerHTML = `
      <div class="popup completion-validation-popup" style="max-width: 650px; animation: slideInUp 0.3s ease-out;">
        <!-- Header -->
        <div class="popup-header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas ${gapIcon}" style="font-size: 24px;"></i>
            <span style="font-size: 18px; font-weight: 600;">נדרש הסבר - פער משמעותי בזמן</span>
          </div>
        </div>

        <div class="popup-content" style="padding: 30px;">
          <!-- Task Info -->
          <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin-bottom: 25px; border: 1px solid #e5e7eb;">
            <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 18px; font-weight: 700;">
              ${window.safeText(task.taskDescription || task.description || '')}
            </h3>
            <div style="color: #6b7280; font-size: 14px; display: flex; align-items: center; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-building" style="color: #3b82f6;"></i>
                <span>${window.safeText(task.clientName || '')}</span>
              </div>
            </div>
          </div>

          <!-- Critical Gap Warning -->
          <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); padding: 24px; border-radius: 12px; margin-bottom: 25px; border: 2px solid #f87171;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 18px;">
              <div style="width: 56px; height: 56px; border-radius: 50%; background: #dc2626; display: flex; align-items: center; justify-content: center;">
                <i class="fas ${gapIcon}" style="font-size: 28px; color: white;"></i>
              </div>
              <div>
                <div style="font-size: 18px; font-weight: 700; color: #991b1b; margin-bottom: 6px;">
                  ${gapDirection}: ${validation.gapPercent}%
                </div>
                <div style="font-size: 15px; color: #7f1d1d; font-weight: 500;">
                  פער של ${validation.gapMinutes} דקות (${Math.round(validation.gapMinutes / 60 * 10) / 10} שעות)
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 14px;">
              <div style="background: white; padding: 14px; border-radius: 8px;">
                <div style="color: #6b7280; margin-bottom: 6px;">זמן משוער:</div>
                <div style="font-weight: 700; color: #1f2937; font-size: 18px;">${validation.estimatedMinutes} דק'</div>
                <div style="color: #9ca3af; font-size: 12px; margin-top: 2px;">${Math.round(validation.estimatedMinutes / 60 * 10) / 10} שעות</div>
              </div>
              <div style="background: white; padding: 14px; border-radius: 8px;">
                <div style="color: #6b7280; margin-bottom: 6px;">זמן בפועל:</div>
                <div style="font-weight: 700; color: ${gapColor}; font-size: 18px;">${validation.actualMinutes} דק'</div>
                <div style="color: #9ca3af; font-size: 12px; margin-top: 2px;">${Math.round(validation.actualMinutes / 60 * 10) / 10} שעות</div>
              </div>
            </div>
          </div>

          <!-- Required Explanation Notice -->
          <div style="background: #fef2f2; padding: 18px; border-radius: 10px; border: 2px solid #fca5a5; margin-bottom: 25px;">
            <div style="display: flex; align-items: start; gap: 12px;">
              <i class="fas fa-exclamation-triangle" style="color: #dc2626; font-size: 22px; margin-top: 2px;"></i>
              <div style="color: #7f1d1d; font-size: 15px; line-height: 1.7;">
                <strong style="display: block; margin-bottom: 8px;">הסבר נדרש לפני סיום המשימה</strong>
                פער משמעותי בזמן דורש תיעוד והסבר. זה עוזר לשפר תכנון עתידי ולהבין טוב יותר את זרימת העבודה.
                ${validation.isOver ? '<br><br><strong>שים לב:</strong> מנהל המערכת יקבל התראה על סיום זה.' : ''}
              </div>
            </div>
          </div>

          <!-- Reason Selection -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 12px; font-weight: 600; color: #374151; font-size: 15px; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-list-ul" style="color: #dc2626;"></i>
              סיבת הפער
              <span style="color: #dc2626;">*</span>
            </label>
            <select
              id="criticalGapReason"
              required
              style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; font-family: inherit; transition: all 0.2s; background: white;"
              onfocus="this.style.borderColor='#dc2626'; this.style.boxShadow='0 0 0 3px rgba(220, 38, 38, 0.1)'"
              onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'"
              onchange="document.getElementById('criticalCompletionNotes').focus()">
              <option value="">בחר סיבה...</option>
              ${Object.keys(GAP_REASONS).map(key =>
                `<option value="${key}">${GAP_REASONS[key].he}</option>`
              ).join('')}
            </select>
          </div>

          <!-- Detailed Explanation -->
          <div style="margin-bottom: 0;">
            <label style="display: block; margin-bottom: 12px; font-weight: 600; color: #374151; font-size: 15px; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-pen" style="color: #dc2626;"></i>
              הסבר מפורט
              <span style="color: #dc2626;">*</span>
            </label>
            <textarea
              id="criticalCompletionNotes"
              rows="5"
              required
              minlength="20"
              placeholder="נא להסביר בפירוט מה גרם לפער הזמן... (מינימום 20 תווים)"
              style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; font-family: inherit; resize: vertical; transition: all 0.2s;"
              onfocus="this.style.borderColor='#dc2626'; this.style.boxShadow='0 0 0 3px rgba(220, 38, 38, 0.1)'"
              onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'"
            ></textarea>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #6b7280; margin-top: 6px;">
              <span id="criticalNotesCounter">0</span>
              <span id="criticalNotesValidation" style="color: #dc2626;"></span>
            </div>
          </div>
        </div>

        <div class="popup-buttons" style="padding: 20px 30px; background: #f9fafb; border-top: 1px solid #e5e7eb; display: flex; gap: 12px;">
          <button
            class="popup-btn popup-btn-confirm"
            id="criticalCompleteBtn"
            disabled
            onclick="window.TaskCompletionValidation.proceedWithCompletion('${task.id}', true)"
            style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); flex: 1; padding: 15px; font-size: 16px; font-weight: 600; border-radius: 10px; opacity: 0.5; cursor: not-allowed;">
            <i class="fas fa-check"></i> המשך לסיום משימה
          </button>
          <button
            class="popup-btn popup-btn-cancel"
            onclick="this.closest('.popup-overlay').remove()"
            style="flex: 0.4; padding: 15px; border-radius: 10px;">
            <i class="fas fa-times"></i> ביטול
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // ✅ תיקון: הסרת class .hidden כדי שהפופאפ יופיע
    setTimeout(() => overlay.classList.add('show'), 10);

    // Add validation logic
    const textarea = overlay.querySelector('#criticalCompletionNotes');
    const select = overlay.querySelector('#criticalGapReason');
    const counter = overlay.querySelector('#criticalNotesCounter');
    const validationMsg = overlay.querySelector('#criticalNotesValidation');
    const confirmBtn = overlay.querySelector('#criticalCompleteBtn');

    function validateForm() {
      const text = textarea.value.trim();
      const reason = select.value;
      const isValid = text.length >= 20 && reason !== '';

      counter.textContent = `${text.length} / 20 תווים מינימום`;

      if (text.length > 0 && text.length < 20) {
        validationMsg.textContent = 'עוד ' + (20 - text.length) + ' תווים נדרשים';
        validationMsg.style.color = '#dc2626';
      } else if (text.length >= 20 && !reason) {
        validationMsg.textContent = 'נא לבחור סיבה';
        validationMsg.style.color = '#dc2626';
      } else if (isValid) {
        validationMsg.textContent = '✓ הסבר מספק';
        validationMsg.style.color = '#059669';
      } else {
        validationMsg.textContent = '';
      }

      if (isValid) {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.style.cursor = 'pointer';
      } else {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.style.cursor = 'not-allowed';
      }
    }

    textarea.addEventListener('input', validateForm);
    select.addEventListener('change', validateForm);
  }

  /**
   * Proceed with task completion after validation
   * @param {string} taskId - Task ID
   * @param {boolean} isCritical - Whether this is a critical gap requiring admin notification
   */
  async function proceedWithCompletion(taskId, isCritical) {
    const overlay = document.querySelector('.task-completion-validation-overlay');

    // Get notes and reason
    let completionNotes = '';
    let gapReason = '';

    if (isCritical) {
      const notesField = document.getElementById('criticalCompletionNotes');
      const reasonField = document.getElementById('criticalGapReason');
      completionNotes = notesField?.value?.trim() || '';
      gapReason = reasonField?.value || '';

      // Validate
      if (completionNotes.length < 20 || !gapReason) {
        if (window.manager && window.manager.showNotification) {
          window.manager.showNotification('נא למלא הסבר מפורט וסיבה', 'error');
        }
        return;
      }
    } else {
      const notesField = document.getElementById('warningCompletionNotes');
      completionNotes = notesField?.value?.trim() || '';
    }

    // Close validation overlay
    if (overlay) {
      overlay.remove();
    }

    // Store completion metadata for later use
    window._taskCompletionMetadata = {
      gapReason,
      gapNotes: completionNotes,
      isCritical
    };

    // Show standard completion modal
    if (window.manager && window.manager.budgetTasks) {
      const task = window.manager.budgetTasks.find(t => t.id === taskId);
      if (task && window.DialogsModule && window.DialogsModule.showTaskCompletionModal) {
        window.DialogsModule.showTaskCompletionModal(task, window.manager);

        // Pre-fill notes if provided
        setTimeout(() => {
          const standardNotesField = document.getElementById('completionNotes');
          if (standardNotesField && completionNotes) {
            const existingNotes = standardNotesField.value.trim();
            const reasonText = gapReason ? `[סיבת פער: ${GAP_REASONS[gapReason].he}]\n` : '';
            standardNotesField.value = existingNotes ?
              `${reasonText}${completionNotes}\n\n${existingNotes}` :
              `${reasonText}${completionNotes}`;
            // Trigger counter update
            standardNotesField.dispatchEvent(new Event('input'));
          }
        }, 100);
      }
    }
  }

  /**
   * Initialize validation on task completion
   * @param {Object} task - Task object
   * @param {Object} manager - Manager instance
   * @returns {boolean} Whether to proceed with standard flow
   */
  function initiateTaskCompletion(task, manager) {
    const validation = validateTaskCompletion(task);
    showCompletionDialog(task, validation, manager);
    return validation.severity === 'OK'; // Only proceed directly if OK
  }

  // Export module
  window.TaskCompletionValidation = {
    validateTaskCompletion,
    initiateTaskCompletion,
    showCompletionDialog,
    proceedWithCompletion,
    THRESHOLDS,
    GAP_REASONS
  };

  console.log('✅ Task Completion Validation module loaded');
})();
