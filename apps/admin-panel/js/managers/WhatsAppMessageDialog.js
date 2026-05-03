/**
 * ═══════════════════════════════════════════════════════════════
 * 💬 WhatsApp Message Dialog - Simple Single User Messaging
 * ═══════════════════════════════════════════════════════════════
 *
 * Simple dialog for sending WhatsApp messages to a single user
 *
 * Created: 2025-12-06
 * Version: 2.0.0 (Simplified)
 */

window.WhatsAppMessageDialog = (function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // MESSAGE TEMPLATES
    // ═══════════════════════════════════════════════════════════

    const MESSAGE_TEMPLATES = {
        DAILY_REMINDER: {
            id: 'DAILY_REMINDER',
            name: 'תזכורת יומית',
            icon: '⏰'
        },
        WEEKLY_SUMMARY: {
            id: 'WEEKLY_SUMMARY',
            name: 'סיכום שבועי',
            icon: '📅'
        },
        SYSTEM_ANNOUNCEMENT: {
            id: 'SYSTEM_ANNOUNCEMENT',
            name: 'הודעת מערכת',
            icon: '📢'
        },
        CUSTOM: {
            id: 'CUSTOM',
            name: 'הודעה מותאמת אישית',
            icon: '✉️'
        }
    };

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    let currentUser = null;
    let selectedTemplate = null;
    let customMessage = '';

    // ═══════════════════════════════════════════════════════════
    // SHOW DIALOG
    // ═══════════════════════════════════════════════════════════

    function showDialog(userEmail, userName) {
        console.log('🟢 showDialog called with:', { userEmail, userName });

        currentUser = { email: userEmail, name: userName };
        selectedTemplate = null;
        customMessage = '';

        const dialogHTML = `
            <div class="modal-overlay modal-show" id="whatsappMessageModal">
                <div class="modal-backdrop"></div>
                <div class="modal-container modal-medium whatsapp-message-modal">
                    <div class="modal-header">
                        <div class="modal-header-content">
                            <div class="modal-icon" style="background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);">
                                <i class="fab fa-whatsapp"></i>
                            </div>
                            <div class="modal-title-wrapper">
                                <h2 class="modal-title">שלח הודעת WhatsApp</h2>
                                <p class="modal-subtitle">שליחה אל: <strong>${userName}</strong></p>
                            </div>
                        </div>
                        <button class="modal-close-btn" id="closeWhatsAppModal" aria-label="Close modal">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="modal-body">
                        <div class="template-selection">
                            <label class="field-label">בחר תבנית הודעה:</label>
                            <div class="template-buttons">
                                ${Object.values(MESSAGE_TEMPLATES).map(template => `
                                    <button class="template-btn" data-template="${template.id}">
                                        <span class="template-icon">${template.icon}</span>
                                        <span class="template-name">${template.name}</span>
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <div class="custom-message-field" id="customMessageField" style="display: none;">
                            <label class="field-label" for="customMessageText">תוכן ההודעה:</label>
                            <textarea
                                id="customMessageText"
                                class="message-textarea"
                                placeholder="הכנס את תוכן ההודעה כאן..."
                                rows="5"
                            ></textarea>
                            <div class="field-hint">
                                💡 שם המשתמש ולינק למערכת יתוספו אוטומטית
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="cancelWhatsAppBtn">
                            <i class="fas fa-times"></i>
                            <span>ביטול</span>
                        </button>
                        <button class="btn btn-primary" id="sendWhatsAppBtn" disabled>
                            <i class="fab fa-whatsapp"></i>
                            <span>שלח הודעה</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('whatsappMessageModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        console.log('🟢 Adding modal to body...');
        document.body.insertAdjacentHTML('beforeend', dialogHTML);

        // Verify modal was added
        const addedModal = document.getElementById('whatsappMessageModal');
        console.log('🟢 Modal added:', addedModal ? 'YES' : 'NO');

        // Attach event listeners
        console.log('🟢 Attaching event listeners...');
        attachDialogEventListeners();
        console.log('🟢 showDialog completed!');
    }

    // ═══════════════════════════════════════════════════════════
    // EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════

    function attachDialogEventListeners() {
        // Close buttons
        document.getElementById('closeWhatsAppModal')?.addEventListener('click', closeDialog);
        document.getElementById('cancelWhatsAppBtn')?.addEventListener('click', closeDialog);

        // Click outside to close
        document.getElementById('whatsappMessageModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'whatsappMessageModal') {
                closeDialog();
            }
        });

        // Template buttons
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const templateId = btn.dataset.template;
                selectTemplate(templateId);
            });
        });

        // Custom message input
        document.getElementById('customMessageText')?.addEventListener('input', (e) => {
            customMessage = e.target.value;
            updateSendButton();
        });

        // Send button
        document.getElementById('sendWhatsAppBtn')?.addEventListener('click', sendMessage);
    }

    // ═══════════════════════════════════════════════════════════
    // TEMPLATE SELECTION
    // ═══════════════════════════════════════════════════════════

    function selectTemplate(templateId) {
        selectedTemplate = templateId;

        // Update UI
        document.querySelectorAll('.template-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-template="${templateId}"]`)?.classList.add('active');

        // Show/hide custom message field
        const customField = document.getElementById('customMessageField');
        const template = MESSAGE_TEMPLATES[templateId];

        if (template && (templateId === 'SYSTEM_ANNOUNCEMENT' || templateId === 'CUSTOM')) {
            customField.style.display = 'block';
        } else {
            customField.style.display = 'none';
            customMessage = '';
            document.getElementById('customMessageText').value = '';
        }

        updateSendButton();
    }

    // ═══════════════════════════════════════════════════════════
    // SEND BUTTON STATE
    // ═══════════════════════════════════════════════════════════

    function updateSendButton() {
        const btn = document.getElementById('sendWhatsAppBtn');
        if (!btn) {
return;
}

        const hasTemplate = selectedTemplate !== null;
        const needsCustom = selectedTemplate === 'SYSTEM_ANNOUNCEMENT' || selectedTemplate === 'CUSTOM';
        const hasCustom = customMessage.trim().length > 0;

        btn.disabled = !hasTemplate || (needsCustom && !hasCustom);
    }

    // ═══════════════════════════════════════════════════════════
    // SEND MESSAGE
    // ═══════════════════════════════════════════════════════════

    async function sendMessage() {
        const btn = document.getElementById('sendWhatsAppBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שולח...';

        try {
            // Call Cloud Function
            const sendBroadcastMessage = window.firebaseFunctions.httpsCallable('sendBroadcastMessage');

            const result = await sendBroadcastMessage({
                employeeEmails: [currentUser.email],
                templateType: selectedTemplate,
                customMessage: customMessage
            });

            console.log('✅ Message sent:', result.data);

            // Show success
            if (result.data.totalSent > 0) {
                showNotification(`ההודעה נשלחה בהצלחה ל-${currentUser.name}`, 'success');
                closeDialog();
            } else {
                showNotification(`שגיאה: ${result.data.results.failed[0]?.error || 'לא ניתן לשלוח'}`, 'error');
            }

        } catch (error) {
            console.error('❌ Error sending message:', error);
            showNotification(`שגיאה בשליחת הודעה: ${error.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fab fa-whatsapp"></i> שלח הודעה';
        }
    }

    // ═══════════════════════════════════════════════════════════
    // CLOSE DIALOG
    // ═══════════════════════════════════════════════════════════

    function closeDialog() {
        const modal = document.getElementById('whatsappMessageModal');
        if (modal) {
            modal.remove();
        }
        currentUser = null;
        selectedTemplate = null;
        customMessage = '';
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
    // INITIALIZE - Listen to user:action events
    // ═══════════════════════════════════════════════════════════

    function init() {
        window.addEventListener('user:action', (e) => {
            const { action, userEmail, userName } = e.detail;

            if (action === 'whatsapp') {
                const finalUserName = userName || userEmail;
                console.log(`📱 Opening WhatsApp dialog for: ${finalUserName} (${userEmail})`);
                showDialog(userEmail, finalUserName);
            }
        });

        console.log('✅ WhatsApp Message Dialog initialized');
    }

    // ═══════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════

    return {
        init,
        showDialog
    };

})();
