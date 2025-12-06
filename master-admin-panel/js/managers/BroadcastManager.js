/**
 * ═══════════════════════════════════════════════════════════════
 * 📢 Broadcast Manager - WhatsApp Message Broadcasting
 * ═══════════════════════════════════════════════════════════════
 *
 * Manages sending WhatsApp broadcast messages to selected employees
 * from the Master Admin Panel
 *
 * Features:
 * - Message template selection
 * - Employee multi-select
 * - Custom message support
 * - Real-time sending progress
 * - Success/failure reporting
 *
 * Created: 2025-12-06
 * Version: 1.0.0
 */

window.BroadcastManager = (function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // MESSAGE TEMPLATES
    // ═══════════════════════════════════════════════════════════

    const MESSAGE_TEMPLATES = {
        DAILY_REMINDER: {
            id: 'DAILY_REMINDER',
            name: 'תזכורת יומית',
            icon: '⏰',
            description: 'תזכורת לרישום שעות היום',
            requiresCustomText: false
        },
        WEEKLY_SUMMARY: {
            id: 'WEEKLY_SUMMARY',
            name: 'סיכום שבועי',
            icon: '📅',
            description: 'בקשה לסיכום שעות השבוע',
            requiresCustomText: false
        },
        SYSTEM_ANNOUNCEMENT: {
            id: 'SYSTEM_ANNOUNCEMENT',
            name: 'הודעת מערכת',
            icon: '📢',
            description: 'הודעה כללית מהמערכת',
            requiresCustomText: true
        },
        CUSTOM: {
            id: 'CUSTOM',
            name: 'הודעה מותאמת אישית',
            icon: '✉️',
            description: 'הודעה חופשית',
            requiresCustomText: true
        }
    };

    // ═══════════════════════════════════════════════════════════
    // STATE MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    let state = {
        selectedEmployees: new Set(),
        selectedTemplate: null,
        customMessage: '',
        isSending: false,
        allEmployees: []
    };

    // ═══════════════════════════════════════════════════════════
    // UI RENDERING
    // ═══════════════════════════════════════════════════════════

    function renderBroadcastUI() {
        const container = document.getElementById('broadcast-section');
        if (!container) {
            console.error('❌ Broadcast section container not found');
            return;
        }

        container.innerHTML = `
            <div class="broadcast-container">
                <!-- Header -->
                <div class="broadcast-header">
                    <h2>
                        <i class="fas fa-bullhorn"></i>
                        שליחת הודעות WhatsApp
                    </h2>
                    <p class="broadcast-subtitle">
                        שלח הודעות לעובדים שבחרת דרך WhatsApp Bot
                    </p>
                </div>

                <!-- Template Selection -->
                <div class="broadcast-section">
                    <h3 class="section-title">
                        <i class="fas fa-file-lines"></i>
                        בחר תבנית הודעה
                    </h3>
                    <div class="template-grid" id="templateGrid">
                        ${Object.values(MESSAGE_TEMPLATES).map(template => `
                            <div class="template-card" data-template="${template.id}">
                                <div class="template-icon">${template.icon}</div>
                                <div class="template-name">${template.name}</div>
                                <div class="template-description">${template.description}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Custom Message (Hidden by default) -->
                <div class="broadcast-section" id="customMessageSection" style="display: none;">
                    <h3 class="section-title">
                        <i class="fas fa-message"></i>
                        תוכן ההודעה
                    </h3>
                    <textarea
                        id="customMessageInput"
                        class="custom-message-input"
                        placeholder="הכנס את תוכן ההודעה כאן..."
                        rows="5"
                    ></textarea>
                    <div class="message-hint">
                        💡 שם העובד ולינק למערכת יתוספו אוטומטית להודעה
                    </div>
                </div>

                <!-- Employee Selection -->
                <div class="broadcast-section">
                    <h3 class="section-title">
                        <i class="fas fa-users"></i>
                        בחר עובדים
                        <span id="selectedCount" class="selected-count">0 נבחרו</span>
                    </h3>

                    <!-- Select All / Deselect All -->
                    <div class="selection-actions">
                        <button id="selectAllBtn" class="btn-secondary btn-sm">
                            <i class="fas fa-check-double"></i>
                            בחר הכל
                        </button>
                        <button id="deselectAllBtn" class="btn-secondary btn-sm">
                            <i class="fas fa-times"></i>
                            בטל בחירה
                        </button>
                        <button id="selectWhatsAppEnabledBtn" class="btn-secondary btn-sm">
                            <i class="fab fa-whatsapp"></i>
                            רק עם WhatsApp מופעל
                        </button>
                    </div>

                    <!-- Employee List -->
                    <div class="employee-list" id="employeeList">
                        <!-- Will be populated dynamically -->
                    </div>
                </div>

                <!-- Send Button -->
                <div class="broadcast-actions">
                    <button id="sendBroadcastBtn" class="btn-primary btn-lg" disabled>
                        <i class="fas fa-paper-plane"></i>
                        שלח הודעות
                    </button>
                </div>

                <!-- Progress Section (Hidden by default) -->
                <div id="sendingProgress" class="sending-progress" style="display: none;">
                    <div class="progress-header">
                        <i class="fas fa-spinner fa-spin"></i>
                        שולח הודעות...
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill" style="width: 0%"></div>
                    </div>
                    <div class="progress-text" id="progressText">0 / 0</div>
                </div>

                <!-- Results Section (Hidden by default) -->
                <div id="sendingResults" class="sending-results" style="display: none;">
                    <!-- Will be populated after sending -->
                </div>
            </div>
        `;

        attachEventListeners();
        loadEmployees();
    }

    // ═══════════════════════════════════════════════════════════
    // EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════

    function attachEventListeners() {
        // Template selection
        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                const templateId = card.dataset.template;
                selectTemplate(templateId);
            });
        });

        // Selection buttons
        document.getElementById('selectAllBtn')?.addEventListener('click', selectAll);
        document.getElementById('deselectAllBtn')?.addEventListener('click', deselectAll);
        document.getElementById('selectWhatsAppEnabledBtn')?.addEventListener('click', selectWhatsAppEnabled);

        // Custom message input
        document.getElementById('customMessageInput')?.addEventListener('input', (e) => {
            state.customMessage = e.target.value;
            updateSendButton();
        });

        // Send button
        document.getElementById('sendBroadcastBtn')?.addEventListener('click', sendBroadcast);
    }

    // ═══════════════════════════════════════════════════════════
    // TEMPLATE SELECTION
    // ═══════════════════════════════════════════════════════════

    function selectTemplate(templateId) {
        // Update state
        state.selectedTemplate = templateId;

        // Update UI - remove active class from all cards
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('active');
        });

        // Add active class to selected card
        document.querySelector(`.template-card[data-template="${templateId}"]`)?.classList.add('active');

        // Show/hide custom message section
        const template = MESSAGE_TEMPLATES[templateId];
        const customSection = document.getElementById('customMessageSection');
        if (template.requiresCustomText) {
            customSection.style.display = 'block';
        } else {
            customSection.style.display = 'none';
            state.customMessage = '';
        }

        updateSendButton();
    }

    // ═══════════════════════════════════════════════════════════
    // EMPLOYEE LOADING & SELECTION
    // ═══════════════════════════════════════════════════════════

    async function loadEmployees() {
        try {
            if (!window.DataManager) {
                console.error('❌ DataManager not available');
                return;
            }

            // Get all employees from DataManager
            const allUsers = window.DataManager.getAllUsers();
            const employees = allUsers.filter(user => user.role === 'employee');

            state.allEmployees = employees;

            renderEmployeeList(employees);
        } catch (error) {
            console.error('❌ Error loading employees:', error);
            showNotification('שגיאה בטעינת רשימת עובדים', 'error');
        }
    }

    function renderEmployeeList(employees) {
        const container = document.getElementById('employeeList');
        if (!container) return;

        if (employees.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users-slash"></i>
                    <p>לא נמצאו עובדים במערכת</p>
                </div>
            `;
            return;
        }

        container.innerHTML = employees.map(emp => {
            const hasWhatsApp = emp.whatsappEnabled && emp.phone;
            const isActive = emp.isActive !== false;

            return `
                <div class="employee-item ${!isActive ? 'inactive' : ''} ${!hasWhatsApp ? 'no-whatsapp' : ''}"
                     data-email="${emp.email}">
                    <label class="employee-checkbox">
                        <input
                            type="checkbox"
                            class="employee-select"
                            value="${emp.email}"
                            ${!hasWhatsApp || !isActive ? 'disabled' : ''}
                        >
                        <span class="employee-info">
                            <span class="employee-name">
                                ${emp.name || emp.email}
                                ${!isActive ? '<span class="badge badge-inactive">לא פעיל</span>' : ''}
                            </span>
                            <span class="employee-details">
                                ${emp.phone || 'אין מספר טלפון'}
                                ${hasWhatsApp ? '<i class="fab fa-whatsapp text-success"></i>' : '<i class="fas fa-times-circle text-muted"></i>'}
                            </span>
                        </span>
                    </label>
                </div>
            `;
        }).join('');

        // Add event listeners to checkboxes
        container.querySelectorAll('.employee-select').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    state.selectedEmployees.add(e.target.value);
                } else {
                    state.selectedEmployees.delete(e.target.value);
                }
                updateSelectedCount();
                updateSendButton();
            });
        });
    }

    function selectAll() {
        document.querySelectorAll('.employee-select:not(:disabled)').forEach(checkbox => {
            checkbox.checked = true;
            state.selectedEmployees.add(checkbox.value);
        });
        updateSelectedCount();
        updateSendButton();
    }

    function deselectAll() {
        document.querySelectorAll('.employee-select').forEach(checkbox => {
            checkbox.checked = false;
        });
        state.selectedEmployees.clear();
        updateSelectedCount();
        updateSendButton();
    }

    function selectWhatsAppEnabled() {
        deselectAll();
        document.querySelectorAll('.employee-select:not(:disabled)').forEach(checkbox => {
            const email = checkbox.value;
            const employee = state.allEmployees.find(e => e.email === email);
            if (employee?.whatsappEnabled && employee?.phone) {
                checkbox.checked = true;
                state.selectedEmployees.add(email);
            }
        });
        updateSelectedCount();
        updateSendButton();
    }

    function updateSelectedCount() {
        const countElement = document.getElementById('selectedCount');
        if (countElement) {
            countElement.textContent = `${state.selectedEmployees.size} נבחרו`;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // SEND BUTTON STATE
    // ═══════════════════════════════════════════════════════════

    function updateSendButton() {
        const btn = document.getElementById('sendBroadcastBtn');
        if (!btn) return;

        const hasTemplate = state.selectedTemplate !== null;
        const hasEmployees = state.selectedEmployees.size > 0;
        const template = MESSAGE_TEMPLATES[state.selectedTemplate];
        const hasCustomMessage = !template?.requiresCustomText || state.customMessage.trim().length > 0;

        btn.disabled = !(hasTemplate && hasEmployees && hasCustomMessage);
    }

    // ═══════════════════════════════════════════════════════════
    // SEND BROADCAST
    // ═══════════════════════════════════════════════════════════

    async function sendBroadcast() {
        if (state.isSending) return;

        // Confirm before sending
        const count = state.selectedEmployees.size;
        const confirmed = confirm(`האם אתה בטוח שברצונך לשלוח הודעה ל-${count} עובדים?`);
        if (!confirmed) return;

        state.isSending = true;

        // Show progress section
        const progressSection = document.getElementById('sendingProgress');
        progressSection.style.display = 'block';

        // Hide results from previous send
        const resultsSection = document.getElementById('sendingResults');
        resultsSection.style.display = 'none';

        // Disable send button
        const sendBtn = document.getElementById('sendBroadcastBtn');
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שולח...';

        try {
            // Call Cloud Function
            const sendBroadcastMessage = window.firebaseFunctions.httpsCallable('sendBroadcastMessage');

            const result = await sendBroadcastMessage({
                employeeEmails: Array.from(state.selectedEmployees),
                templateType: state.selectedTemplate,
                customMessage: state.customMessage
            });

            console.log('✅ Broadcast result:', result.data);

            // Show results
            displayResults(result.data);

        } catch (error) {
            console.error('❌ Error sending broadcast:', error);
            showNotification(`שגיאה בשליחת הודעות: ${error.message}`, 'error');
        } finally {
            state.isSending = false;
            progressSection.style.display = 'none';
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> שלח הודעות';
        }
    }

    // ═══════════════════════════════════════════════════════════
    // RESULTS DISPLAY
    // ═══════════════════════════════════════════════════════════

    function displayResults(data) {
        const resultsSection = document.getElementById('sendingResults');

        const { totalSent, totalFailed, results } = data;

        resultsSection.innerHTML = `
            <div class="results-header">
                <h3>
                    <i class="fas fa-chart-pie"></i>
                    תוצאות שליחה
                </h3>
            </div>

            <div class="results-stats">
                <div class="stat-card success">
                    <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-value">${totalSent}</div>
                    <div class="stat-label">נשלחו בהצלחה</div>
                </div>
                <div class="stat-card error">
                    <div class="stat-icon"><i class="fas fa-times-circle"></i></div>
                    <div class="stat-value">${totalFailed}</div>
                    <div class="stat-label">נכשלו</div>
                </div>
            </div>

            ${totalFailed > 0 ? `
                <div class="failed-list">
                    <h4><i class="fas fa-exclamation-triangle"></i> הודעות שנכשלו:</h4>
                    <ul>
                        ${results.failed.map(item => `
                            <li>
                                <strong>${item.name || item.email}</strong>
                                <span class="error-reason">${item.error}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        `;

        resultsSection.style.display = 'block';

        // Show success notification
        showNotification(
            `נשלחו ${totalSent} הודעות בהצלחה${totalFailed > 0 ? `, ${totalFailed} נכשלו` : ''}`,
            totalFailed > 0 ? 'warning' : 'success'
        );

        // Reset selections
        deselectAll();
        state.selectedTemplate = null;
        state.customMessage = '';
        document.querySelectorAll('.template-card').forEach(card => card.classList.remove('active'));
        document.getElementById('customMessageSection').style.display = 'none';
        document.getElementById('customMessageInput').value = '';
    }

    // ═══════════════════════════════════════════════════════════
    // NOTIFICATION HELPER
    // ═══════════════════════════════════════════════════════════

    function showNotification(message, type = 'info') {
        if (window.Notifications) {
            window.Notifications.show(message, type);
        } else {
            alert(message);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════

    return {
        init: renderBroadcastUI,
        refresh: loadEmployees
    };

})();
