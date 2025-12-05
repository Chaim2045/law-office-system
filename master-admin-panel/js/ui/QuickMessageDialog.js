/**
 * QuickMessageDialog
 * דיאלוג שליחת הודעה מהירה מהקשר
 *
 * Created: 2025-12-01
 * Phase: UI Layer
 *
 * זה הדיאלוג שנפתח כשהמנהל רוצה לשלוח הודעה מהירה לעובד
 * על סמך התראה או בעיה
 */

(function() {
    'use strict';

    class QuickMessageDialog {
        constructor() {
            this.isOpen = false;
            this.dialogElement = null;
            this.currentData = null;

            // References to managers
            this.alertCommManager = window.alertCommManager;

            // Create dialog element
            this.createDialog();
        }

        /**
         * Create dialog element
         */
        createDialog() {
            const dialog = document.createElement('div');
            dialog.className = 'quick-message-dialog';
            dialog.style.display = 'none';
            dialog.innerHTML = `
                <div class="dialog-overlay"></div>
                <div class="dialog-content">
                    <div class="dialog-header">
                        <h3>
                            <i class="fas fa-paper-plane"></i>
                            שלח הודעה מהירה
                        </h3>
                        <button class="close-dialog-btn" aria-label="סגור">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="dialog-body">
                        <!-- Recipient info -->
                        <div class="recipient-info">
                            <i class="fas fa-user"></i>
                            <span class="recipient-name"></span>
                        </div>

                        <!-- Alert context (if any) -->
                        <div class="alert-context" style="display: none;">
                            <div class="context-badge">
                                <i class="fas fa-exclamation-circle"></i>
                                <span class="context-text"></span>
                            </div>
                        </div>

                        <!-- Message type selector -->
                        <div class="form-group">
                            <label for="messageType">סוג הודעה</label>
                            <select id="messageType" class="form-control">
                                <option value="reminder">תזכורת</option>
                                <option value="warning">אזהרה</option>
                                <option value="urgent">דחוף</option>
                                <option value="info">מידע</option>
                            </select>
                        </div>

                        <!-- Message title -->
                        <div class="form-group">
                            <label for="messageTitle">כותרת</label>
                            <input
                                type="text"
                                id="messageTitle"
                                class="form-control"
                                placeholder="כותרת ההודעה"
                                required
                            />
                        </div>

                        <!-- Message body -->
                        <div class="form-group">
                            <label for="messageBody">תוכן ההודעה</label>
                            <textarea
                                id="messageBody"
                                class="form-control message-textarea"
                                placeholder="כתוב את ההודעה כאן..."
                                rows="6"
                                required
                            ></textarea>
                            <div class="char-count">
                                <span class="current-count">0</span> / 1000
                            </div>
                        </div>

                        <!-- Options removed: Thread system deleted -->

                        <!-- Error message -->
                        <div class="error-message" style="display: none;">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span class="error-text"></span>
                        </div>
                    </div>

                    <div class="dialog-footer">
                        <button class="btn btn-secondary cancel-btn">
                            ביטול
                        </button>
                        <button class="btn btn-primary send-btn">
                            <i class="fas fa-paper-plane"></i>
                            שלח הודעה
                        </button>
                    </div>

                    <!-- Loading overlay -->
                    <div class="dialog-loading" style="display: none;">
                        <div class="spinner"></div>
                        <p>שולח הודעה...</p>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);
            this.dialogElement = dialog;

            // Attach event listeners
            this.attachEventListeners();
        }

        /**
         * Attach event listeners
         */
        attachEventListeners() {
            // Close buttons
            const closeBtn = this.dialogElement.querySelector('.close-dialog-btn');
            const cancelBtn = this.dialogElement.querySelector('.cancel-btn');
            const overlay = this.dialogElement.querySelector('.dialog-overlay');

            closeBtn.addEventListener('click', () => this.close());
            cancelBtn.addEventListener('click', () => this.close());
            overlay.addEventListener('click', () => this.close());

            // Send button
            const sendBtn = this.dialogElement.querySelector('.send-btn');
            sendBtn.addEventListener('click', () => this.send());

            // Character count
            const textarea = this.dialogElement.querySelector('#messageBody');
            textarea.addEventListener('input', () => this.updateCharCount());

            // Enter to send (Ctrl+Enter)
            textarea.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    this.send();
                }
            });

            // Escape to close
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            });
        }

        /**
         * Show dialog
         * @param {Object} data - Dialog data
         */
        async show(data) {
            try {
                console.log('📖 QuickMessageDialog: Opening...', data);

                this.currentData = data;

                // Update recipient info
                const recipientName = this.dialogElement.querySelector('.recipient-name');
                recipientName.textContent = data.userName;

                // Update alert context (if any)
                if (data.alertTitle) {
                    const alertContext = this.dialogElement.querySelector('.alert-context');
                    const contextText = this.dialogElement.querySelector('.context-text');
                    alertContext.style.display = 'flex';
                    contextText.textContent = data.alertTitle;
                }

                // Pre-fill title
                const titleInput = this.dialogElement.querySelector('#messageTitle');
                titleInput.value = data.alertTitle || '';

                // Pre-fill message body
                const bodyTextarea = this.dialogElement.querySelector('#messageBody');
                bodyTextarea.value = data.messageBody || '';
                this.updateCharCount();

                // Set message type based on alert
                if (data.alert) {
                    const messageType = this.dialogElement.querySelector('#messageType');
                    if (data.alert.isCritical && data.alert.isCritical()) {
                        messageType.value = 'urgent';
                    } else if (data.alert.severity === 'warning') {
                        messageType.value = 'warning';
                    } else {
                        messageType.value = 'reminder';
                    }
                }

                // Show dialog
                this.dialogElement.style.display = 'flex';
                this.isOpen = true;

                // Focus on message body
                bodyTextarea.focus();
                bodyTextarea.setSelectionRange(bodyTextarea.value.length, bodyTextarea.value.length);

                console.log('✅ QuickMessageDialog: Opened');

            } catch (error) {
                console.error('❌ QuickMessageDialog: Failed to show:', error);
                this.showError('שגיאה בפתיחת הדיאלוג');
            }
        }

        /**
         * Close dialog
         */
        close() {
            console.log('🚪 QuickMessageDialog: Closing...');

            this.dialogElement.style.display = 'none';
            this.isOpen = false;
            this.currentData = null;

            // Clear form
            this.clearForm();

            // Hide error
            this.hideError();
        }

        /**
         * Send message
         */
        async send() {
            try {
                console.log('📤 QuickMessageDialog: Sending message...');

                // Validate
                if (!this.validate()) {
                    return;
                }

                // Show loading
                this.showLoading();

                // Get form data
                const messageType = this.dialogElement.querySelector('#messageType').value;
                const title = this.dialogElement.querySelector('#messageTitle').value.trim();
                const body = this.dialogElement.querySelector('#messageBody').value.trim();

                // Check if alertCommManager is available
                if (!window.alertCommManager) {
                    throw new Error('Alert Communication Manager not initialized');
                }

                // Map message type to AlertCommunicationManager format
                const typeMap = {
                    'reminder': 'info',
                    'warning': 'warning',
                    'urgent': 'alert',
                    'info': 'info'
                };

                const priorityMap = {
                    'reminder': 1,
                    'warning': 3,
                    'urgent': 10,
                    'info': 1
                };

                // Combine title and body into message
                const messageText = `${title}\n\n${body}`;

                // Send message using AlertCommunicationManager
                const messageId = await window.alertCommManager.sendMessage(
                    this.currentData.userEmail,
                    messageText,
                    {
                        type: typeMap[messageType] || 'info',
                        priority: priorityMap[messageType] || 1
                    }
                );

                console.log('✅ Message sent:', messageId);

                // Hide loading
                this.hideLoading();

                // Show success
                this.showSuccess('הודעה נשלחה בהצלחה');

                // Close dialog
                setTimeout(() => {
                    this.close();
                }, 1000);

                // Callback if provided
                if (this.currentData.onSent) {
                    this.currentData.onSent({ id: messageId });
                }

            } catch (error) {
                console.error('❌ QuickMessageDialog: Send failed:', error);
                this.hideLoading();
                this.showError('שגיאה בשליחת ההודעה: ' + error.message);
            }
        }

        /**
         * Validate form
         */
        validate() {
            const title = this.dialogElement.querySelector('#messageTitle').value.trim();
            const body = this.dialogElement.querySelector('#messageBody').value.trim();

            if (!title) {
                this.showError('נא להזין כותרת');
                return false;
            }

            if (title.length < 3) {
                this.showError('כותרת חייבת להכיל לפחות 3 תווים');
                return false;
            }

            if (!body) {
                this.showError('נא להזין תוכן הודעה');
                return false;
            }

            if (body.length < 10) {
                this.showError('ההודעה חייבת להכיל לפחות 10 תווים');
                return false;
            }

            if (body.length > 1000) {
                this.showError('ההודעה ארוכה מדי (מקסימום 1000 תווים)');
                return false;
            }

            return true;
        }

        /**
         * Clear form
         */
        clearForm() {
            this.dialogElement.querySelector('#messageTitle').value = '';
            this.dialogElement.querySelector('#messageBody').value = '';
            this.dialogElement.querySelector('#messageType').value = 'reminder';
            this.dialogElement.querySelector('.alert-context').style.display = 'none';
            this.updateCharCount();
        }

        /**
         * Update character count
         */
        updateCharCount() {
            const textarea = this.dialogElement.querySelector('#messageBody');
            const currentCount = this.dialogElement.querySelector('.current-count');
            currentCount.textContent = textarea.value.length;

            // Color code
            const charCount = this.dialogElement.querySelector('.char-count');
            if (textarea.value.length > 1000) {
                charCount.style.color = '#ef4444';
            } else if (textarea.value.length > 900) {
                charCount.style.color = '#f59e0b';
            } else {
                charCount.style.color = '#6b7280';
            }
        }

        /**
         * Show loading
         */
        showLoading() {
            const loading = this.dialogElement.querySelector('.dialog-loading');
            loading.style.display = 'flex';
        }

        /**
         * Hide loading
         */
        hideLoading() {
            const loading = this.dialogElement.querySelector('.dialog-loading');
            loading.style.display = 'none';
        }

        /**
         * Show error
         */
        showError(message) {
            const errorDiv = this.dialogElement.querySelector('.error-message');
            const errorText = this.dialogElement.querySelector('.error-text');
            errorText.textContent = message;
            errorDiv.style.display = 'flex';
        }

        /**
         * Hide error
         */
        hideError() {
            const errorDiv = this.dialogElement.querySelector('.error-message');
            errorDiv.style.display = 'none';
        }

        /**
         * Show success
         */
        showSuccess(message) {
            // Use existing notification system if available
            if (window.showNotification) {
                window.showNotification(message, 'success');
            } else if (window.showMessage) {
                window.showMessage(message, 'success');
            } else {
                alert(message);
            }
        }

        /**
         * Destroy dialog
         */
        destroy() {
            if (this.dialogElement) {
                this.dialogElement.remove();
                this.dialogElement = null;
            }
            this.isOpen = false;
            this.currentData = null;
        }
    }

    // Auto-initialize singleton
    if (!window.quickMessageDialog) {
        window.quickMessageDialog = new QuickMessageDialog();
        console.log('✅ QuickMessageDialog initialized');
    }

})();
