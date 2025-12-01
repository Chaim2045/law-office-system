/**
 * Message Composer
 * מנהל חלון שליחת הודעות
 *
 * נוצר: 2025
 * גרסה: 1.0.0
 * Phase: Messaging System
 *
 * תפקיד: ממשק גרפי לשליחת הודעות מהמנהל לעובדים
 */

(function() {
    'use strict';

    /**
     * MessageComposer Class
     * מנהל את חלון שליחת ההודעות
     */
    class MessageComposer {
        constructor() {
            this.messagingManager = null;
            this.employees = []; // רשימת העובדים
        }

        /**
         * Initialize
         */
        async init() {
            this.messagingManager = window.messagingManager;
            if (!this.messagingManager) {
                console.warn('⚠️ MessagingManager לא זמין');
            }

            // Load employees list for dropdown
            await this.loadEmployees();
        }

        /**
         * טען רשימת עובדים
         */
        async loadEmployees() {
            try {
                const db = window.firebaseDB || firebase.firestore();
                const snapshot = await db.collection('employees').get();

                this.employees = [];
                snapshot.forEach(doc => {
                    const employee = doc.data();
                    this.employees.push({
                        uid: doc.id,
                        email: employee.email || doc.id,
                        name: employee.name || employee.username || 'לא ידוע',
                        role: employee.role || 'employee'
                    });
                });

                console.log(`✅ נטענו ${this.employees.length} עובדים`);
            } catch (error) {
                console.error('❌ שגיאה בטעינת עובדים:', error);
                this.employees = [];
            }
        }

        /**
         * הצג חלון שליחת הודעה
         */
        showComposeDialog() {
            const overlay = document.createElement('div');
            overlay.className = 'popup-overlay message-composer-overlay';

            overlay.innerHTML = `
                <div class="popup message-composer-popup">
                    <div class="popup-header">
                        <i class="fas fa-envelope"></i>
                        שליחת הודעה
                    </div>

                    <div class="popup-content">
                        <!-- בחירת נמען -->
                        <div class="form-group">
                            <label for="messageRecipientType">
                                <i class="fas fa-users"></i>
                                שלח ל:
                            </label>
                            <select id="messageRecipientType" class="form-control">
                                <option value="all">כל המשתמשים (שידור)</option>
                                <option value="role">תפקיד מסוים</option>
                                <option value="user">משתמש ספציפי</option>
                            </select>
                        </div>

                        <!-- בחירת משתמש/תפקיד -->
                        <div id="recipientSelector" class="form-group" style="display: none;">
                            <label for="specificRecipient">
                                <i class="fas fa-user"></i>
                                בחר:
                            </label>
                            <select id="specificRecipient" class="form-control">
                                <!-- Will be populated dynamically -->
                            </select>
                        </div>

                        <!-- כותרת -->
                        <div class="form-group">
                            <label for="messageTitle">
                                <i class="fas fa-heading"></i>
                                כותרת:
                            </label>
                            <input
                                type="text"
                                id="messageTitle"
                                class="form-control"
                                placeholder="עדכון חשוב..."
                                maxlength="100"
                            />
                        </div>

                        <!-- תוכן ההודעה -->
                        <div class="form-group">
                            <label for="messageBody">
                                <i class="fas fa-comment-dots"></i>
                                הודעה:
                            </label>
                            <textarea
                                id="messageBody"
                                class="form-control"
                                rows="5"
                                placeholder="נא לעדכן את השעתון עד סוף השבוע..."
                                maxlength="500"
                            ></textarea>
                            <small class="char-counter">
                                <span id="charCount">0</span>/500 תווים
                            </small>
                        </div>

                        <!-- סוג ההודעה -->
                        <div class="form-group">
                            <label for="messageType">
                                <i class="fas fa-tag"></i>
                                סוג:
                            </label>
                            <select id="messageType" class="form-control">
                                <option value="info">מידע</option>
                                <option value="alert">התראה</option>
                                <option value="warning">אזהרה</option>
                                <option value="urgent">דחוף</option>
                            </select>
                        </div>

                        <!-- עדיפות -->
                        <div class="form-group">
                            <label for="messagePriority">
                                <i class="fas fa-exclamation-circle"></i>
                                עדיפות:
                            </label>
                            <select id="messagePriority" class="form-control">
                                <option value="low">נמוכה</option>
                                <option value="medium" selected>בינונית</option>
                                <option value="high">גבוהה</option>
                                <option value="urgent">דחופה</option>
                            </select>
                        </div>
                    </div>

                    <div class="popup-buttons">
                        <button class="popup-btn popup-btn-confirm" id="btnSendMessage">
                            <i class="fas fa-paper-plane"></i>
                            שלח
                        </button>
                        <button class="popup-btn popup-btn-cancel" id="btnCancelMessage">
                            <i class="fas fa-times"></i>
                            ביטול
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Attach event listeners
            this.attachEventListeners(overlay);

            // Show overlay with animation
            setTimeout(() => overlay.classList.add('show'), 10);
        }

        /**
         * צור את האופציות לתפקידים
         */
        getRoleOptions() {
            return `
                <option value="lawyer">עורכי דין</option>
                <option value="secretary">מזכירות</option>
                <option value="admin">מנהלים</option>
                <option value="employee">עובדים</option>
            `;
        }

        /**
         * צור את האופציות למשתמשים
         */
        getUserOptions() {
            return this.employees
                .map(emp => `<option value="${emp.uid}" data-email="${emp.email}">${emp.name} (${emp.email})</option>`)
                .join('');
        }

        /**
         * צרף event listeners
         */
        attachEventListeners(overlay) {
            const recipientType = overlay.querySelector('#messageRecipientType');
            const recipientSelector = overlay.querySelector('#recipientSelector');
            const specificRecipient = overlay.querySelector('#specificRecipient');
            const messageBody = overlay.querySelector('#messageBody');
            const charCount = overlay.querySelector('#charCount');
            const btnSend = overlay.querySelector('#btnSendMessage');
            const btnCancel = overlay.querySelector('#btnCancelMessage');

            // בחירת סוג נמען
            recipientType.addEventListener('change', (e) => {
                const type = e.target.value;

                if (type === 'all') {
                    recipientSelector.style.display = 'none';
                } else {
                    recipientSelector.style.display = 'block';

                    // עדכן את האופציות
                    if (type === 'role') {
                        specificRecipient.innerHTML = this.getRoleOptions();
                    } else if (type === 'user') {
                        specificRecipient.innerHTML = this.getUserOptions();
                    }
                }
            });

            // ספירת תווים
            if (messageBody && charCount) {
                messageBody.addEventListener('input', () => {
                    charCount.textContent = messageBody.value.length;
                });
            }

            // כפתור שליחה
            btnSend.addEventListener('click', () => this.sendMessage(overlay));

            // כפתור ביטול
            btnCancel.addEventListener('click', () => this.closeDialog(overlay));

            // סגירה בלחיצה על הרקע
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeDialog(overlay);
                }
            });

            // ESC key
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.closeDialog(overlay);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        }

        /**
         * שלח הודעה
         */
        async sendMessage(overlay) {
            const type = overlay.querySelector('#messageRecipientType').value;
            const title = overlay.querySelector('#messageTitle').value.trim();
            const body = overlay.querySelector('#messageBody').value.trim();
            const messageType = overlay.querySelector('#messageType').value;
            const priority = overlay.querySelector('#messagePriority').value;

            // Validation
            if (!title) {
                this.showError('נא להזין כותרת');
                return;
            }

            if (!body) {
                this.showError('נא להזין תוכן הודעה');
                return;
            }

            // Check if MessagingManager is available
            if (!this.messagingManager && !window.messagingManager) {
                this.showError('מערכת ההודעות לא זמינה כרגע. נא לרענן את הדף.');
                return;
            }

            // Update reference if it was initialized after this component
            if (!this.messagingManager) {
                this.messagingManager = window.messagingManager;
            }

            // Get current user's display name
            const currentUser = window.firebaseAuth?.currentUser;
            const fromName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'מנהל המערכת';

            const messageData = {
                title,
                body,
                type: messageType,
                priority,
                fromName: fromName
            };

            try {
                // הצג loading
                const btnSend = overlay.querySelector('#btnSendMessage');
                btnSend.disabled = true;
                btnSend.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שולח...';

                let result;

                if (type === 'all') {
                    // שידור לכולם
                    result = await this.messagingManager.broadcastMessage(messageData);
                } else if (type === 'user') {
                    // משתמש ספציפי
                    const userId = overlay.querySelector('#specificRecipient').value;
                    const selectedOption = overlay.querySelector('#specificRecipient').selectedOptions[0];
                    const userEmail = selectedOption?.getAttribute('data-email') || '';

                    messageData.recipientEmail = userEmail;
                    messageData.recipientName = selectedOption?.textContent.split('(')[0].trim() || 'משתמש';

                    result = await this.messagingManager.sendMessageToUser(userId, messageData);
                } else if (type === 'role') {
                    // תפקיד
                    const role = overlay.querySelector('#specificRecipient').value;
                    result = await this.messagingManager.sendMessageToRole(role, messageData);
                }

                if (result.success) {
                    this.showSuccess(result.message || 'ההודעה נשלחה בהצלחה!');
                    this.closeDialog(overlay);
                } else {
                    throw new Error(result.message || 'שגיאה לא ידועה');
                }

            } catch (error) {
                console.error('❌ שגיאה בשליחת הודעה:', error);
                this.showError('שגיאה בשליחת הודעה: ' + error.message);

                // Restore button
                const btnSend = overlay.querySelector('#btnSendMessage');
                btnSend.disabled = false;
                btnSend.innerHTML = '<i class="fas fa-paper-plane"></i> שלח';
            }
        }

        /**
         * סגור את החלון
         */
        closeDialog(overlay) {
            overlay.classList.remove('show');
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        }

        /**
         * הצג הודעת שגיאה
         */
        showError(message) {
            if (window.notificationsUI) {
                window.notificationsUI.show(message, 'error');
            } else {
                alert(message);
            }
        }

        /**
         * הצג הודעת הצלחה
         */
        showSuccess(message) {
            if (window.notificationsUI) {
                window.notificationsUI.show(message, 'success');
            } else {
                alert(message);
            }
        }
    }

    // Make available globally
    window.MessageComposer = MessageComposer;
    window.messageComposer = new MessageComposer();

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.messageComposer.init();
        });
    } else {
        window.messageComposer.init();
    }

})();
