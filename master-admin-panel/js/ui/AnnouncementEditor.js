/**
 * Announcement Editor Component - Split View
 * עורך הודעות מערכת - תצוגת חלוקת מסך
 *
 * Created: 2025-12-15
 * Version: 3.0.0 - Split View Design
 */

(function() {
    'use strict';

    class AnnouncementEditor {
        constructor() {
            this.panel = null;
            this.currentAnnouncement = null;
            this.mode = 'create'; // 'create' or 'edit'
            this.onSave = null;
            this.onCancel = null;
        }

        /**
         * Open editor panel
         * @param {SystemAnnouncement} announcement - For edit mode (null for create)
         * @param {Object} handlers - { onSave, onCancel }
         */
        open(announcement = null, handlers = {}) {
            this.mode = announcement ? 'edit' : 'create';
            this.currentAnnouncement = announcement;
            this.onSave = handlers.onSave || null;
            this.onCancel = handlers.onCancel || null;

            this.render();
            this.setupEventListeners();

            // Pre-fill form if editing
            if (announcement) {
                this.fillForm(announcement);
            } else {
                // Set default start date to now for new announcements
                this.setDefaultStartDate();
            }

            // Show panel with animation
            setTimeout(() => {
                this.panel.classList.add('visible');
            }, 10);
        }

        /**
         * Close editor panel
         */
        close() {
            if (!this.panel) {
return;
}

            this.panel.classList.remove('visible');

            setTimeout(() => {
                if (this.panel && this.panel.parentNode) {
                    this.panel.parentNode.removeChild(this.panel);
                }
                this.panel = null;
            }, 300);
        }

        /**
         * Render editor panel
         */
        render() {
            // Remove existing panel if any
            const existing = document.getElementById('announcementEditorPanel');
            if (existing) {
                existing.parentNode.removeChild(existing);
            }

            // Create panel HTML
            const panelHTML = `
                <div id="announcementEditorPanel" class="editor-split-view">
                    <!-- Overlay (dims the background) -->
                    <div class="split-overlay"></div>

                    <!-- Editor Panel (Left Side) -->
                    <div class="editor-panel">
                        <!-- Header -->
                        <div class="panel-header">
                            <div class="header-content">
                                <div class="header-icon">
                                    <i class="fas ${this.mode === 'create' ? 'fa-bullhorn' : 'fa-edit'}"></i>
                                </div>
                                <div class="header-text">
                                    <h2 class="header-title">${this.mode === 'create' ? 'הודעת מערכת חדשה' : 'עריכת הודעה'}</h2>
                                    <p class="header-subtitle">${this.mode === 'create' ? 'צור הודעה חדשה למשתמשי המערכת' : 'ערוך את פרטי ההודעה'}</p>
                                </div>
                            </div>
                            <button class="btn-close-panel" id="editorCloseBtn" title="סגור">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>

                        <!-- Form Content -->
                        <div class="panel-content">
                            <form id="announcementEditorForm" class="editor-form">

                                <!-- Basic Info -->
                                <div class="form-card">
                                    <div class="card-header">
                                        <i class="fas fa-info-circle"></i>
                                        <span>מידע בסיסי</span>
                                    </div>
                                    <div class="card-body">
                                        <!-- Message (Ticker Text) -->
                                        <div class="form-group">
                                            <label class="form-label">
                                                תוכן ההודעה (טקסט הטיקר) <span class="required">*</span>
                                            </label>
                                            <textarea
                                                id="announcementMessage"
                                                class="form-textarea"
                                                placeholder="לדוגמה: עדכון מערכת - המערכת תעבור שדרוג ביום ראשון בשעה 22:00..."
                                                required
                                                rows="3"
                                                maxlength="500"
                                            ></textarea>
                                            <div class="form-hint">עד 500 תווים - זה הטקסט שיופיע בטיקר הרץ</div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Settings -->
                                <div class="form-card">
                                    <div class="card-header">
                                        <i class="fas fa-sliders-h"></i>
                                        <span>הגדרות</span>
                                    </div>
                                    <div class="card-body">
                                        <div class="form-row">
                                            <!-- Type -->
                                            <div class="form-group">
                                                <label class="form-label">
                                                    סוג הודעה <span class="required">*</span>
                                                </label>
                                                <select id="announcementType" class="form-select" required>
                                                    <option value="info">ℹ️ מידע</option>
                                                    <option value="success">✓ הצלחה</option>
                                                    <option value="warning">⚠ אזהרה</option>
                                                    <option value="error">✕ שגיאה</option>
                                                </select>
                                            </div>

                                            <!-- Priority -->
                                            <div class="form-group">
                                                <label class="form-label">
                                                    עדיפות <span class="required">*</span>
                                                </label>
                                                <select id="announcementPriority" class="form-select" required>
                                                    <option value="1">1 - נמוכה מאוד</option>
                                                    <option value="2">2 - נמוכה</option>
                                                    <option value="3">3 - בינונית נמוכה</option>
                                                    <option value="4">4 - בינונית</option>
                                                    <option value="5" selected>5 - רגילה</option>
                                                    <option value="6">6 - בינונית גבוהה</option>
                                                    <option value="7">7 - גבוהה</option>
                                                    <option value="8">8 - גבוהה מאוד</option>
                                                    <option value="9">9 - דחופה</option>
                                                    <option value="10">10 - קריטית</option>
                                                </select>
                                            </div>
                                        </div>

                                        <!-- Target Audience -->
                                        <div class="form-group">
                                            <label class="form-label">
                                                קהל יעד <span class="required">*</span>
                                            </label>
                                            <select id="announcementAudience" class="form-select" required>
                                                <option value="all">◉ כל המשתמשים</option>
                                                <option value="employees">◎ עובדים בלבד</option>
                                                <option value="admins">◈ מנהלים בלבד</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <!-- Date Range -->
                                <div class="form-card">
                                    <div class="card-header">
                                        <i class="fas fa-calendar-alt"></i>
                                        <span>תקופת תצוגה</span>
                                    </div>
                                    <div class="card-body">
                                        <div class="form-row">
                                            <!-- Start Date -->
                                            <div class="form-group">
                                                <label class="form-label">
                                                    תאריך התחלה <span class="required">*</span>
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    id="announcementStartDate"
                                                    class="form-input"
                                                    required
                                                />
                                            </div>

                                            <!-- End Date -->
                                            <div class="form-group">
                                                <label class="form-label">
                                                    תאריך סיום <span class="optional">(אופציונלי)</span>
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    id="announcementEndDate"
                                                    class="form-input"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Display Options -->
                                <div class="form-card">
                                    <div class="card-header">
                                        <i class="fas fa-eye"></i>
                                        <span>אפשרויות תצוגה</span>
                                    </div>
                                    <div class="card-body">
                                        <div class="options-list">
                                            <!-- Show on Login -->
                                            <label class="option-item">
                                                <input type="checkbox" id="displayShowOnLogin" checked />
                                                <span class="option-check"></span>
                                                <span class="option-label">
                                                    <i class="fas fa-sign-in-alt"></i>
                                                    הצג בכניסה למערכת
                                                </span>
                                            </label>

                                            <!-- Show in Header -->
                                            <label class="option-item">
                                                <input type="checkbox" id="displayShowInHeader" checked />
                                                <span class="option-check"></span>
                                                <span class="option-label">
                                                    <i class="fas fa-window-maximize"></i>
                                                    הצג בכותרת עליונה
                                                </span>
                                            </label>

                                            <!-- Dismissible -->
                                            <label class="option-item">
                                                <input type="checkbox" id="displayDismissible" checked />
                                                <span class="option-check"></span>
                                                <span class="option-label">
                                                    <i class="fas fa-times-circle"></i>
                                                    אפשר סגירה למשתמש
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <!-- Active Status -->
                                <div class="status-card">
                                    <label class="status-toggle">
                                        <input type="checkbox" id="announcementActive" checked />
                                        <span class="toggle-slider"></span>
                                        <span class="toggle-label">
                                            <i class="fas fa-power-off"></i>
                                            <span>ההודעה פעילה</span>
                                        </span>
                                    </label>
                                </div>

                                <!-- Error Message -->
                                <div id="editorErrorMessage" class="error-message" style="display: none;">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <span id="editorErrorText"></span>
                                </div>
                            </form>
                        </div>

                        <!-- Footer Actions -->
                        <div class="panel-footer">
                            <button type="button" class="btn btn-cancel" id="editorCancelBtn">
                                <i class="fas fa-times"></i>
                                <span>ביטול</span>
                            </button>
                            <button type="submit" form="announcementEditorForm" class="btn btn-save" id="editorSaveBtn">
                                <i class="fas ${this.mode === 'create' ? 'fa-plus-circle' : 'fa-save'}"></i>
                                <span>${this.mode === 'create' ? 'צור הודעה' : 'שמור שינויים'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Append to body
            document.body.insertAdjacentHTML('beforeend', panelHTML);
            this.panel = document.getElementById('announcementEditorPanel');

            // Inject styles
            this.injectStyles();
        }

        /**
         * Setup event listeners
         */
        setupEventListeners() {
            if (!this.panel) {
return;
}

            // Close buttons
            const closeBtn = this.panel.querySelector('#editorCloseBtn');
            const cancelBtn = this.panel.querySelector('#editorCancelBtn');
            const overlay = this.panel.querySelector('.split-overlay');

            closeBtn.addEventListener('click', () => this.handleCancel());
            cancelBtn.addEventListener('click', () => this.handleCancel());
            overlay.addEventListener('click', () => this.handleCancel());

            // Form submission
            const form = this.panel.querySelector('#announcementEditorForm');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSave();
            });

            // ESC key to close
            this.escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    this.handleCancel();
                }
            };
            document.addEventListener('keydown', this.escapeHandler);

            // Character counters
            this.setupCharacterCounters();
        }

        /**
         * Setup character counter for message
         */
        setupCharacterCounters() {
            const messageInput = this.panel.querySelector('#announcementMessage');

            const updateCounter = (input, maxLength) => {
                const hint = input.parentElement.querySelector('.form-hint');
                const remaining = maxLength - input.value.length;
                hint.textContent = `${remaining} תווים נותרו - זה הטקסט שיופיע בטיקר הרץ`;

                if (remaining < 50) {
                    hint.style.color = '#ef4444';
                } else if (remaining < 100) {
                    hint.style.color = '#f97316';
                } else {
                    hint.style.color = '#94a3b8';
                }
            };

            messageInput.addEventListener('input', () => updateCounter(messageInput, 500));
        }

        /**
         * Set default start date to now
         */
        setDefaultStartDate() {
            if (!this.panel) {
return;
}

            const startDateInput = this.panel.querySelector('#announcementStartDate');
            const now = new Date();
            startDateInput.value = this.formatDatetimeLocal(now);
        }

        /**
         * Fill form with announcement data (for edit mode)
         * @param {SystemAnnouncement} announcement
         */
        fillForm(announcement) {
            if (!this.panel) {
return;
}

            // Basic fields
            this.panel.querySelector('#announcementMessage').value = announcement.message;
            this.panel.querySelector('#announcementType').value = announcement.type;
            this.panel.querySelector('#announcementPriority').value = announcement.priority;
            this.panel.querySelector('#announcementAudience').value = announcement.targetAudience;
            this.panel.querySelector('#announcementActive').checked = announcement.active;

            // Dates
            const startDate = announcement.startDate instanceof Date ?
                announcement.startDate : new Date(announcement.startDate);
            this.panel.querySelector('#announcementStartDate').value =
                this.formatDatetimeLocal(startDate);

            if (announcement.endDate) {
                const endDate = announcement.endDate instanceof Date ?
                    announcement.endDate : new Date(announcement.endDate);
                this.panel.querySelector('#announcementEndDate').value =
                    this.formatDatetimeLocal(endDate);
            }

            // Display settings
            this.panel.querySelector('#displayShowOnLogin').checked =
                announcement.displaySettings.showOnLogin;
            this.panel.querySelector('#displayShowInHeader').checked =
                announcement.displaySettings.showInHeader;
            this.panel.querySelector('#displayDismissible').checked =
                announcement.displaySettings.dismissible;
        }

        /**
         * Format date to datetime-local input format
         * @param {Date} date
         * @returns {string}
         */
        formatDatetimeLocal(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }

        /**
         * Handle save button click
         */
        async handleSave() {
            try {
                // Hide previous errors
                this.hideError();

                // Disable save button
                const saveBtn = this.panel.querySelector('#editorSaveBtn');
                const originalContent = saveBtn.innerHTML;
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>שומר...</span>';

                // Get form values
                const formData = this.getFormData();

                // Create announcement object
                const announcementData = {
                    message: formData.message,
                    type: formData.type,
                    priority: parseInt(formData.priority),
                    active: formData.active,
                    startDate: new Date(formData.startDate),
                    endDate: formData.endDate ? new Date(formData.endDate) : null,
                    targetAudience: formData.audience,
                    displaySettings: {
                        showOnLogin: formData.showOnLogin,
                        showInHeader: formData.showInHeader,
                        dismissible: formData.dismissible
                    }
                };

                // If editing, preserve ID and creation info
                if (this.mode === 'edit' && this.currentAnnouncement) {
                    announcementData.id = this.currentAnnouncement.id;
                    announcementData.createdBy = this.currentAnnouncement.createdBy;
                    announcementData.createdAt = this.currentAnnouncement.createdAt;
                } else {
                    // For new announcements, set creator
                    const currentUser = window.firebaseAuth?.currentUser;
                    announcementData.createdBy = currentUser?.email || 'Unknown';
                }

                // Create SystemAnnouncement instance
                const announcement = new window.SystemAnnouncement(announcementData);

                // Validate
                const validation = announcement.validate();
                if (!validation.valid) {
                    this.showError(validation.errors.join('<br>'));
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalContent;
                    return;
                }

                // Call save handler
                if (this.onSave) {
                    await this.onSave(announcement, this.mode);
                }

                // Close panel
                this.close();

            } catch (error) {
                console.error('❌ Error saving announcement:', error);
                this.showError(error.message || 'שגיאה בשמירת ההודעה');

                // Re-enable save button
                const saveBtn = this.panel.querySelector('#editorSaveBtn');
                saveBtn.disabled = false;
                const icon = this.mode === 'create' ? 'fa-plus-circle' : 'fa-save';
                const text = this.mode === 'create' ? 'צור הודעה' : 'שמור שינויים';
                saveBtn.innerHTML = `<i class="fas ${icon}"></i><span>${text}</span>`;
            }
        }

        /**
         * Handle cancel button click
         */
        handleCancel() {
            if (this.onCancel) {
                this.onCancel();
            }
            this.close();
        }

        /**
         * Get form data
         * @returns {Object}
         */
        getFormData() {
            if (!this.panel) {
return {};
}

            return {
                message: this.panel.querySelector('#announcementMessage').value.trim(),
                type: this.panel.querySelector('#announcementType').value,
                priority: this.panel.querySelector('#announcementPriority').value,
                audience: this.panel.querySelector('#announcementAudience').value,
                startDate: this.panel.querySelector('#announcementStartDate').value,
                endDate: this.panel.querySelector('#announcementEndDate').value,
                active: this.panel.querySelector('#announcementActive').checked,
                showOnLogin: this.panel.querySelector('#displayShowOnLogin').checked,
                showInHeader: this.panel.querySelector('#displayShowInHeader').checked,
                dismissible: this.panel.querySelector('#displayDismissible').checked
            };
        }

        /**
         * Show error message
         * @param {string} message
         */
        showError(message) {
            if (!this.panel) {
return;
}

            const errorDiv = this.panel.querySelector('#editorErrorMessage');
            const errorText = this.panel.querySelector('#editorErrorText');

            errorText.innerHTML = message;
            errorDiv.style.display = 'flex';

            // Scroll to error
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        /**
         * Hide error message
         */
        hideError() {
            if (!this.panel) {
return;
}

            const errorDiv = this.panel.querySelector('#editorErrorMessage');
            errorDiv.style.display = 'none';
        }

        /**
         * Inject styles
         */
        injectStyles() {
            if (document.getElementById('announcementEditorStyles')) {
return;
}

            const style = document.createElement('style');
            style.id = 'announcementEditorStyles';
            style.textContent = `
                /* ========================================
                   SPLIT VIEW CONTAINER
                   ======================================== */

                .editor-split-view {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10000;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.3s ease, visibility 0.3s ease;
                }

                .editor-split-view.visible {
                    opacity: 1;
                    visibility: visible;
                }

                /* Overlay (dims the right side) */
                .split-overlay {
                    position: absolute;
                    top: 0;
                    left: 50%;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(4px);
                    cursor: pointer;
                }

                /* ========================================
                   EDITOR PANEL (Left Side)
                   ======================================== */

                .editor-panel {
                    position: absolute;
                    top: 0;
                    left: 0;
                    bottom: 0;
                    width: 50%;
                    background: #f8fafc;
                    box-shadow: 4px 0 30px rgba(0, 0, 0, 0.2);
                    display: flex;
                    flex-direction: column;
                    transform: translateX(-100%);
                    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .editor-split-view.visible .editor-panel {
                    transform: translateX(0);
                }

                /* ========================================
                   PANEL HEADER
                   ======================================== */

                .panel-header {
                    background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
                    padding: 1.5rem 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                    border-bottom: 3px solid rgba(255, 255, 255, 0.2);
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    flex: 1;
                }

                .header-icon {
                    width: 50px;
                    height: 50px;
                    background: rgba(255, 255, 255, 0.25);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 22px;
                    flex-shrink: 0;
                }

                .header-text {
                    flex: 1;
                }

                .header-title {
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: white;
                    margin: 0 0 0.25rem 0;
                }

                .header-subtitle {
                    font-size: 0.875rem;
                    color: rgba(255, 255, 255, 0.85);
                    margin: 0;
                }

                .btn-close-panel {
                    width: 40px;
                    height: 40px;
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    border-radius: 10px;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .btn-close-panel:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: rotate(90deg);
                }

                /* ========================================
                   PANEL CONTENT (Scrollable)
                   ======================================== */

                .panel-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.5rem;
                    min-height: 0;
                }

                .editor-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                /* ========================================
                   FORM CARDS
                   ======================================== */

                .form-card {
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                    border: 1px solid #e2e8f0;
                }

                .card-header {
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    padding: 1rem 1.25rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-size: 1rem;
                    font-weight: 700;
                    color: #1e293b;
                    border-bottom: 1px solid #e2e8f0;
                }

                .card-header i {
                    color: #4f46e5;
                    font-size: 1.125rem;
                }

                .card-body {
                    padding: 1.25rem;
                }

                /* ========================================
                   FORM ELEMENTS
                   ======================================== */

                .form-group {
                    margin-bottom: 1rem;
                }

                .form-group:last-child {
                    margin-bottom: 0;
                }

                .form-label {
                    display: block;
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #334155;
                    margin-bottom: 0.5rem;
                }

                .required {
                    color: #ef4444;
                    font-weight: 700;
                }

                .optional {
                    color: #94a3b8;
                    font-size: 0.75rem;
                    font-weight: 500;
                }

                .form-input,
                .form-textarea,
                .form-select {
                    width: 100%;
                    padding: 0.75rem;
                    border: 2px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 0.875rem;
                    color: #1e293b;
                    background: white;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }

                .form-input:hover,
                .form-textarea:hover,
                .form-select:hover {
                    border-color: #cbd5e1;
                }

                .form-input:focus,
                .form-textarea:focus,
                .form-select:focus {
                    outline: none;
                    border-color: #4f46e5;
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
                }

                .form-textarea {
                    resize: vertical;
                    min-height: 80px;
                    line-height: 1.5;
                }

                .form-select {
                    cursor: pointer;
                }

                .form-hint {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    margin-top: 0.375rem;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                /* ========================================
                   OPTIONS LIST (Checkboxes)
                   ======================================== */

                .options-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .option-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.875rem;
                    background: #f8fafc;
                    border: 2px solid #e2e8f0;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .option-item:hover {
                    background: #f1f5f9;
                    border-color: #cbd5e1;
                }

                .option-item input[type="checkbox"] {
                    display: none;
                }

                .option-check {
                    width: 20px;
                    height: 20px;
                    border: 2px solid #cbd5e1;
                    border-radius: 6px;
                    position: relative;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                }

                .option-item input:checked ~ .option-check {
                    background: #4f46e5;
                    border-color: #4f46e5;
                }

                .option-item input:checked ~ .option-check::after {
                    content: '✓';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: white;
                    font-size: 12px;
                    font-weight: bold;
                }

                .option-label {
                    font-size: 0.875rem;
                    color: #475569;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .option-label i {
                    color: #94a3b8;
                }

                /* ========================================
                   STATUS TOGGLE
                   ======================================== */

                .status-card {
                    background: white;
                    border-radius: 12px;
                    padding: 1.25rem;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                    border: 1px solid #e2e8f0;
                }

                .status-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                }

                .status-toggle input[type="checkbox"] {
                    display: none;
                }

                .toggle-slider {
                    width: 48px;
                    height: 26px;
                    background: #cbd5e1;
                    border-radius: 13px;
                    position: relative;
                    transition: all 0.3s ease;
                    flex-shrink: 0;
                }

                .status-toggle input:checked ~ .toggle-slider {
                    background: #22c55e;
                }

                .toggle-slider::before {
                    content: '';
                    position: absolute;
                    width: 20px;
                    height: 20px;
                    background: white;
                    border-radius: 50%;
                    top: 3px;
                    right: 3px;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }

                .status-toggle input:checked ~ .toggle-slider::before {
                    right: 25px;
                }

                .toggle-label {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-size: 1rem;
                    font-weight: 600;
                    color: #1e293b;
                    flex: 1;
                }

                .toggle-label i {
                    color: #64748b;
                }

                .status-toggle input:checked ~ * .toggle-label i {
                    color: #22c55e;
                }

                /* ========================================
                   ERROR MESSAGE
                   ======================================== */

                .error-message {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1rem;
                    background: #fef2f2;
                    border: 2px solid #fca5a5;
                    border-radius: 8px;
                    color: #991b1b;
                    font-size: 0.875rem;
                    animation: errorShake 0.4s ease;
                }

                @keyframes errorShake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }

                .error-message i {
                    font-size: 18px;
                    color: #dc2626;
                }

                /* ========================================
                   PANEL FOOTER
                   ======================================== */

                .panel-footer {
                    padding: 1.25rem 2rem;
                    background: white;
                    border-top: 2px solid #e2e8f0;
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.75rem;
                    flex-shrink: 0;
                }

                .btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.5rem;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.938rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    min-width: 120px;
                }

                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .btn-cancel {
                    background: white;
                    color: #64748b;
                    border: 2px solid #e2e8f0;
                }

                .btn-cancel:hover:not(:disabled) {
                    background: #f8fafc;
                    border-color: #cbd5e1;
                }

                .btn-save {
                    background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
                    color: white;
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
                }

                .btn-save:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
                }

                .btn-save:active:not(:disabled) {
                    transform: translateY(0);
                }

                /* ========================================
                   SCROLLBAR
                   ======================================== */

                .panel-content::-webkit-scrollbar {
                    width: 8px;
                }

                .panel-content::-webkit-scrollbar-track {
                    background: #f1f5f9;
                }

                .panel-content::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }

                .panel-content::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }

                /* ========================================
                   RESPONSIVE (Mobile)
                   ======================================== */

                @media (max-width: 1024px) {
                    .editor-panel {
                        width: 60%;
                    }

                    .split-overlay {
                        left: 60%;
                    }
                }

                @media (max-width: 768px) {
                    .editor-panel {
                        width: 100%;
                    }

                    .split-overlay {
                        display: none;
                    }

                    .panel-header {
                        padding: 1.25rem 1.5rem;
                    }

                    .header-icon {
                        width: 45px;
                        height: 45px;
                        font-size: 20px;
                    }

                    .header-title {
                        font-size: 1.25rem;
                    }

                    .panel-content {
                        padding: 1rem;
                    }

                    .form-row {
                        grid-template-columns: 1fr;
                    }

                    .panel-footer {
                        padding: 1rem 1.5rem;
                        flex-direction: column-reverse;
                    }

                    .btn {
                        width: 100%;
                    }
                }
            `;

            document.head.appendChild(style);
        }

        /**
         * Cleanup
         */
        cleanup() {
            if (this.escapeHandler) {
                document.removeEventListener('keydown', this.escapeHandler);
            }
            this.close();
        }
    }

    // Export globally
    window.AnnouncementEditor = AnnouncementEditor;

    console.log('✅ AnnouncementEditor v3.0 loaded - Split View Design');

})();
