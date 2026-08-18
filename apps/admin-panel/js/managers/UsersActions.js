/**
 * Users Actions Manager
 * מנהל פעולות משתמשים
 *
 * נוצר: 31/10/2025
 * גרסה: 1.0.0
 * Phase: 3 - User Management Logic
 *
 * תפקיד: קישור Actions Menu לפעולות אמיתיות
 */

(function() {
    'use strict';

    /**
     * UsersActionsManager Class
     * מנהל את כל הפעולות על משתמשים
     */
    class UsersActionsManager {
        constructor() {
            this.setupEventListeners();
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEventListeners() {
            // Listen to user action events
            window.addEventListener('user:action', (e) => {
                this.handleAction(e.detail);
            });

            console.log('✅ UsersActionsManager: Event listeners setup');
        }

        /**
         * Handle user action
         * טיפול בפעולת משתמש
         */
        async handleAction(detail) {
            const { action, userEmail } = detail;

            console.log(`🔧 Handling action: ${action} for ${userEmail}`);

            switch (action) {
                case 'view':
                    await this.viewUser(userEmail);
                    break;
                case 'edit':
                    await this.editUser(userEmail);
                    break;
                case 'block':
                    await this.toggleBlockUser(userEmail);
                    break;
                case 'delete':
                    await this.deleteUser(userEmail);
                    break;
                case 'delete-data':
                    await this.deleteUserData(userEmail);
                    break;
                default:
                    console.warn(`⚠️ Unknown action: ${action}`);
            }
        }

        /**
         * View user details
         * הצגת פרטי משתמש
         */
        async viewUser(userEmail) {
            try {
                // Get user from DataManager
                const user = window.DataManager.getUserByEmail(userEmail);

                if (!user) {
                    throw new Error('משתמש לא נמצא');
                }

                // Open UserDetailsModal
                window.UserDetailsModal.open(user);

                console.log(`✅ Viewing user: ${userEmail}`);

            } catch (error) {
                console.error('❌ Error viewing user:', error);
                window.notify.error(error.message || 'שגיאה בהצגת פרטי משתמש');
            }
        }

        /**
         * Edit user
         * עריכת משתמש
         */
        async editUser(userEmail) {
            try {
                // Get user from DataManager
                const user = window.DataManager.getUserByEmail(userEmail);

                if (!user) {
                    throw new Error('משתמש לא נמצא');
                }

                // Open UserForm in edit mode
                window.UserForm.open(user);

                console.log(`✅ Editing user: ${userEmail}`);

            } catch (error) {
                console.error('❌ Error editing user:', error);
                window.notify.error(error.message || 'שגיאה בעריכת משתמש');
            }
        }

        /**
         * Toggle block user
         * חסימה/ביטול חסימת משתמש
         */
        async toggleBlockUser(userEmail) {
            try {
                // Get user from DataManager
                const user = window.DataManager.getUserByEmail(userEmail);

                if (!user) {
                    throw new Error('משתמש לא נמצא');
                }

                const isBlocked = user.status === window.ADMIN_PANEL_CONSTANTS.USER_STATUS.BLOCKED;
                const action = isBlocked ? 'unblock' : 'block';
                const actionText = isBlocked ? 'הסרת חסימה' : 'חסימה';

                // Confirm action
                const confirmed = await window.ModalHelpers.confirm({
                    title: `${actionText} של משתמש`,
                    message: `האם אתה בטוח שברצונך ${isBlocked ? 'להסיר את החסימה של' : 'לחסום את'} ${user.displayName || user.email}?`,
                    icon: 'ban',
                    iconClass: isBlocked ? 'icon-success' : 'icon-warning',
                    confirmText: actionText,
                    confirmClass: isBlocked ? 'btn-success' : 'btn-danger'
                });

                if (!confirmed) {
                    return;
                }

                // Show loading
                const loadingId = window.notify.loading(`${actionText}...`);

                try {
                    // Call Cloud Function
                    const blockUserFunction = window.firebaseFunctions.httpsCallable('blockUser');

                    await blockUserFunction({
                        email: userEmail,
                        block: !isBlocked
                    });

                    // Hide loading
                    window.notify.hide(loadingId);

                    // Show success
                    window.notify.success(`המשתמש ${isBlocked ? 'הוסר מחסימה' : 'נחסם'} בהצלחה`);

                    // Refresh data
                    window.dispatchEvent(new CustomEvent('data:refresh'));

                    console.log(`✅ User ${action}ed: ${userEmail}`);

                } catch (error) {
                    // Hide loading
                    window.notify.hide(loadingId);

                    // Phase 4 fallback
                    console.warn('⚠️ Cloud Function not available (Phase 4)');
                    throw new Error('חסימת משתמשים תהיה זמינה ב-Phase 4 (Cloud Functions)');
                }

            } catch (error) {
                console.error('❌ Error blocking user:', error);
                window.notify.error(error.message || 'שגיאה בחסימת משתמש');
            }
        }

        /**
         * Delete user
         * מחיקת משתמש
         */
        async deleteUser(userEmail) {
            try {
                // Get user from DataManager
                const user = window.DataManager.getUserByEmail(userEmail);

                if (!user) {
                    throw new Error('משתמש לא נמצא');
                }

                // Confirm action - First confirmation
                const confirmed1 = await window.ModalHelpers.confirm({
                    title: 'מחיקת משתמש',
                    message: `האם אתה בטוח שברצונך למחוק את ${user.displayName || user.email}?<br><br><strong>פעולה זו לא ניתנת לביטול!</strong>`,
                    icon: 'exclamation-triangle',
                    iconClass: 'icon-danger',
                    confirmText: 'המשך למחיקה',
                    confirmClass: 'btn-danger'
                });

                if (!confirmed1) {
                    return;
                }

                // Second confirmation with user email input
                const confirmed2 = await this.confirmDeleteWithEmail(user);

                if (!confirmed2) {
                    return;
                }

                // Show loading
                const loadingId = window.notify.loading('מוחק משתמש...');

                try {
                    // Call Cloud Function
                    const deleteUserFunction = window.firebaseFunctions.httpsCallable('deleteUser');

                    await deleteUserFunction({
                        email: userEmail
                    });

                    // Hide loading
                    window.notify.hide(loadingId);

                    // Show success
                    window.notify.success('המשתמש נמחק בהצלחה');

                    // Refresh data
                    window.dispatchEvent(new CustomEvent('data:refresh'));

                    console.log(`✅ User deleted: ${userEmail}`);

                } catch (error) {
                    // Hide loading
                    window.notify.hide(loadingId);

                    // Phase 4 fallback
                    console.warn('⚠️ Cloud Function not available (Phase 4)');
                    throw new Error('מחיקת משתמשים תהיה זמינה ב-Phase 4 (Cloud Functions)');
                }

            } catch (error) {
                console.error('❌ Error deleting user:', error);
                window.notify.error(error.message || 'שגיאה במחיקת משתמש');
            }
        }

        /**
         * Confirm delete with email input
         * אישור מחיקה עם הזנת אימייל
         */
        async confirmDeleteWithEmail(user) {
            return new Promise((resolve) => {
                const modalId = window.ModalManager.create({
                    title: 'אישור מחיקה סופי',
                    content: `
                        <div class="delete-confirm-content">
                            <i class="fas fa-exclamation-triangle icon-danger" style="font-size: 64px; color: var(--red); margin-bottom: var(--space-4);"></i>
                            <p style="margin-bottom: var(--space-4); font-size: var(--text-base); color: var(--gray-700);">
                                למחיקת המשתמש <strong>${user.displayName || user.email}</strong>,<br>
                                אנא הקלד את כתובת האימייל:
                            </p>
                            <input
                                type="text"
                                id="deleteConfirmEmail"
                                class="form-input"
                                placeholder="${user.email}"
                                style="margin-bottom: var(--space-2); text-align: center;"
                            >
                            <div id="deleteEmailError" class="form-error" style="display: none;">כתובת האימייל אינה תואמת</div>
                        </div>
                    `,
                    footer: `
                        <button class="btn btn-secondary" id="deleteConfirmCancelBtn">
                            <i class="fas fa-times"></i>
                            <span>ביטול</span>
                        </button>
                        <button class="btn btn-danger" id="deleteConfirmBtn">
                            <i class="fas fa-trash"></i>
                            <span>מחק סופית</span>
                        </button>
                    `,
                    size: 'small',
                    closeOnBackdrop: false,
                    onOpen: () => {
                        const modal = window.ModalManager.getElement(modalId);

                        // Cancel button
                        const cancelBtn = modal.querySelector('#deleteConfirmCancelBtn');
                        cancelBtn.addEventListener('click', () => {
                            window.ModalManager.close(modalId);
                            resolve(false);
                        });

                        // Confirm button
                        const confirmBtn = modal.querySelector('#deleteConfirmBtn');
                        const emailInput = modal.querySelector('#deleteConfirmEmail');
                        const errorDiv = modal.querySelector('#deleteEmailError');

                        confirmBtn.addEventListener('click', () => {
                            const enteredEmail = emailInput.value.trim();

                            if (enteredEmail === user.email) {
                                window.ModalManager.close(modalId);
                                resolve(true);
                            } else {
                                errorDiv.style.display = 'block';
                                emailInput.classList.add('input-error');
                            }
                        });

                        // Clear error on input
                        emailInput.addEventListener('input', () => {
                            errorDiv.style.display = 'none';
                            emailInput.classList.remove('input-error');
                        });

                        // Focus input
                        emailInput.focus();
                    },
                    onClose: () => {
                        resolve(false);
                    }
                });
            });
        }

        /**
         * Delete user data (tasks and timesheets) - SELECTIVE
         * מחיקת נתוני משתמש סלקטיבית
         */
        async deleteUserData(userEmail) {
            try {
                // Get user
                const user = window.DataManager.getUserByEmail(userEmail);

                if (!user) {
                    throw new Error('משתמש לא נמצא');
                }

                // Open new DeleteDataSidePanel with selective deletion
                if (window.DeleteDataSidePanel) {
                    window.DeleteDataSidePanel.open(user);
                } else {
                    console.error('❌ DeleteDataSidePanel not loaded');
                    window.notify.error('מודול מחיקה לא נטען');
                }

            } catch (error) {
                console.error('❌ Error opening delete data side panel:', error);
                window.notify.error(error.message || 'שגיאה בפתיחת פאנל מחיקה');
            }
        }

        /**
         * Show modal to select what data to delete
         * הצגת מודאל לבחירת נתונים למחיקה
         */
        async showDeleteDataModal(user) {
            return new Promise((resolve) => {
                const modalId = window.ModalManager.create({
                    title: `מחיקת נתונים: ${user.displayName || user.email}`,
                    content: `
                        <div class="delete-data-modal">
                            <p style="margin-bottom: 20px; font-size: 16px; color: var(--gray-700);">
                                בחר אילו נתונים למחוק:
                            </p>
                            <div class="checkbox-group" style="text-align: right;">
                                <label class="checkbox-label" style="display: block; margin-bottom: 15px; font-size: 15px;">
                                    <input type="checkbox" id="deleteTasks" checked>
                                    <span style="margin-right: 10px;">מחק את כל המשימות (budget_tasks)</span>
                                </label>
                                <label class="checkbox-label" style="display: block; margin-bottom: 15px; font-size: 15px;">
                                    <input type="checkbox" id="deleteTimesheets" checked>
                                    <span style="margin-right: 10px;">מחק את כל השעתונים (timesheet_entries)</span>
                                </label>
                                <label class="checkbox-label" style="display: block; margin-bottom: 15px; font-size: 15px;">
                                    <input type="checkbox" id="deleteApprovals" checked>
                                    <span style="margin-right: 10px;">מחק את כל אישורי המשימות (pending_task_approvals)</span>
                                </label>
                            </div>
                            <p style="margin-top: 20px; font-size: 14px; color: var(--orange);">
                                <i class="fas fa-info-circle"></i>
                                הלקוחות לא יימחקו
                            </p>
                        </div>
                    `,
                    footer: `
                        <button class="btn btn-secondary" id="deleteDataCancelBtn">
                            <i class="fas fa-times"></i>
                            <span>ביטול</span>
                        </button>
                        <button class="btn btn-danger" id="deleteDataConfirmBtn">
                            <i class="fas fa-trash"></i>
                            <span>המשך</span>
                        </button>
                    `,
                    size: 'medium',
                    onOpen: () => {
                        const modal = window.ModalManager.getElement(modalId);

                        // Cancel button
                        const cancelBtn = modal.querySelector('#deleteDataCancelBtn');
                        cancelBtn.addEventListener('click', () => {
                            window.ModalManager.close(modalId);
                            resolve(null);
                        });

                        // Confirm button
                        const confirmBtn = modal.querySelector('#deleteDataConfirmBtn');
                        confirmBtn.addEventListener('click', () => {
                            const tasks = modal.querySelector('#deleteTasks').checked;
                            const timesheets = modal.querySelector('#deleteTimesheets').checked;
                            const approvals = modal.querySelector('#deleteApprovals').checked;

                            if (!tasks && !timesheets && !approvals) {
                                window.notify.warning('יש לבחור לפחות פריט אחד למחיקה');
                                return;
                            }

                            window.ModalManager.close(modalId);
                            resolve({ tasks, timesheets, approvals });
                        });
                    }
                });
            });
        }

        /**
         * Add new user (triggered from FilterBar)
         * הוספת משתמש חדש
         */
        addNewUser() {
            try {
                console.log('🟢 [UsersActions] addNewUser() called');
                console.trace('📍 Call stack trace');

                // Check if UserForm exists
                if (!window.UserForm) {
                    throw new Error('UserForm לא נטען');
                }

                // Open UserForm in create mode
                window.UserForm.open(null);

                console.log('✅ Opening new user form');

            } catch (error) {
                console.error('❌ Error opening new user form:', error);
                window.notify.error('שגיאה בפתיחת טופס משתמש חדש');
            }
        }
    }

    // Create global instance
    const usersActionsManager = new UsersActionsManager();

    // Make UsersActionsManager available globally
    window.UsersActionsManager = usersActionsManager;

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = usersActionsManager;
    }

})();
