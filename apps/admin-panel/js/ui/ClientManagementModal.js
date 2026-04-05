/**
 * Client Management Modal
 * מודאל ניהול לקוח מתקדם
 *
 * נוצר: 27/11/2025
 * גרסה: 1.0.0
 * Phase: 5 - Clients Management
 *
 * תפקיד: ניהול מלא של לקוח - שירותים, שלבים, חידוש שעות, סגירת תיק
 */

(function() {
    'use strict';

    /**
     * ClientManagementModal Class
     * מנהל את מודאל ניהול הלקוח
     */
    class ClientManagementModal {
        constructor() {
            this.modal = null;
            this.currentClient = null;
            this.dataManager = null;

            // DOM Elements
            this.modalElement = null;
            this.clientInfoContainer = null;
            this.servicesListContainer = null;
            this.closeButton = null;

            // ✅ Store ESC handler reference for cleanup
            this.escHandler = null;
        }

        /**
         * Initialize modal
         * אתחול המודאל
         */
        init() {
            console.log('🎨 ClientManagementModal: Initializing...');

            // Get DOM elements
            this.modalElement = document.getElementById('clientManagementModal');
            this.clientInfoContainer = document.getElementById('managementClientInfo');
            this.servicesListContainer = document.getElementById('managementServicesList');
            this.closeButton = document.getElementById('closeManagementModal');

            if (!this.modalElement) {
                console.error('❌ Management modal not found');
                return false;
            }

            // Setup event listeners
            this.setupEventListeners();

            console.log('✅ ClientManagementModal: Initialized');
            return true;
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEventListeners() {
            // Close button
            if (this.closeButton) {
                this.closeButton.addEventListener('click', () => this.close());
            }

            // Click outside to close
            this.modalElement.addEventListener('click', (e) => {
                if (e.target === this.modalElement) {
                    this.close();
                }
            });

            // ✅ ESC key to close - Store reference for cleanup
            this.escHandler = (e) => {
                if (e.key === 'Escape' && this.modalElement.style.display !== 'none') {
                    this.close();
                }
            };
            document.addEventListener('keydown', this.escHandler);

            // Quick action buttons
            const actionButtons = this.modalElement.querySelectorAll('[data-action]');
            actionButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const action = e.currentTarget.dataset.action;
                    this.handleQuickAction(action);
                });
            });
        }

        /**
         * Open modal for client
         * פתיחת המודאל ללקוח
         */
        open(client, dataManager) {
            if (!client) {
                console.error('❌ No client provided');
                return;
            }

            console.log('📂 Opening management modal for:', client.fullName);

            this.currentClient = client;
            this.dataManager = dataManager;

            // Render content
            this.renderClientInfo();
            this.renderServices();
            this.renderFeeAgreements();
            this.setupFeeAgreementListeners();

            // ✅ Re-attach ESC listener (in case it was removed by close())
            if (this.escHandler) {
                // Remove first to prevent duplicates
                document.removeEventListener('keydown', this.escHandler);
                document.addEventListener('keydown', this.escHandler);
            }

            // Show modal
            this.modalElement.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }

        /**
         * Close modal
         * סגירת המודאל
         */
        close() {
            this.modalElement.style.display = 'none';
            document.body.style.overflow = '';
            this.currentClient = null;

            // ✅ Remove ESC listener to prevent memory leak
            if (this.escHandler) {
                document.removeEventListener('keydown', this.escHandler);
            }
        }

        /**
         * Render client info header
         * רינדור כותרת מידע לקוח
         */
        async editCaseOpenDate() {
            const client = this.currentClient;
            const current = client.caseOpenDate
                ? new Date(client.caseOpenDate.seconds * 1000).toISOString().split('T')[0]
                : (client.createdAt
                    ? new Date(client.createdAt.seconds * 1000).toISOString().split('T')[0]
                    : '');

            const input = document.createElement('div');
            input.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.15);z-index:10000;min-width:280px;';
            input.innerHTML = `
                <div style="font-weight:600;margin-bottom:12px;font-size:15px;">עדכון תאריך פתיחת תיק</div>
                <input type="date" id="caseOpenDateInput" value="${current}" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;margin-bottom:16px;">
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button id="caseOpenDateCancel" style="padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;">ביטול</button>
                    <button id="caseOpenDateSave" style="padding:8px 16px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">שמור</button>
                </div>
            `;

            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;';
            document.body.appendChild(overlay);
            document.body.appendChild(input);

            const cleanup = () => {
 overlay.remove(); input.remove();
};

            document.getElementById('caseOpenDateCancel').addEventListener('click', cleanup);
            overlay.addEventListener('click', cleanup);

            document.getElementById('caseOpenDateSave').addEventListener('click', async () => {
                const val = document.getElementById('caseOpenDateInput').value;
                if (!val) {
return;
}

                const newDate = new Date(val);
                if (isNaN(newDate.getTime())) {
                    alert('תאריך לא תקין');
                    return;
                }

                try {
                    await FirebaseService.call('updateClient', {
                        clientId: client.id,
                        caseOpenDate: newDate.toISOString()
                    });

                    this.currentClient.caseOpenDate = { seconds: Math.floor(newDate.getTime() / 1000), nanoseconds: 0 };
                    cleanup();
                    this.renderClientInfo();
                    this.showNotification('תאריך פתיחת תיק עודכן', 'success');
                } catch (e) {
                    console.error('Error updating caseOpenDate:', e);
                    this.showNotification('שגיאה בעדכון התאריך', 'error');
                }
            });
        }

        showOverrideModal(active, serviceName) {
            return new Promise((resolve) => {
                const overlay = document.createElement('div');
                overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10300;';

                const modal = document.createElement('div');
                modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:24px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.15);z-index:10400;min-width:300px;direction:rtl;';

                if (active) {
                    modal.innerHTML = `
                        <div style="font-weight:600;margin-bottom:12px;font-size:15px;">אישור חריגה — ${serviceName}</div>
                        <input type="text" id="overrideNoteInput" placeholder="הערה (אופציונלי)" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;margin-bottom:16px;box-sizing:border-box;">
                        <div style="display:flex;gap:8px;justify-content:flex-end;">
                            <button id="overrideCancel" style="padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;">ביטול</button>
                            <button id="overrideConfirm" style="padding:8px 16px;background:#f59e0b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">אשר חריגה</button>
                        </div>`;
                } else {
                    modal.innerHTML = `
                        <div style="font-weight:600;margin-bottom:12px;font-size:15px;">ביטול חריגה — ${serviceName}</div>
                        <div style="color:#6b7280;margin-bottom:16px;font-size:14px;">האם לבטל את אישור החריגה לשירות זה?</div>
                        <div style="display:flex;gap:8px;justify-content:flex-end;">
                            <button id="overrideCancel" style="padding:8px 16px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;">ביטול</button>
                            <button id="overrideConfirm" style="padding:8px 16px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">בטל חריגה</button>
                        </div>`;
                }

                const cleanup = () => {
 overlay.remove(); modal.remove();
};

                document.body.appendChild(overlay);
                document.body.appendChild(modal);

                document.getElementById('overrideCancel').addEventListener('click', () => {
 cleanup(); resolve(null);
});
                overlay.addEventListener('click', () => {
 cleanup(); resolve(null);
});
                document.getElementById('overrideConfirm').addEventListener('click', () => {
                    const note = active ? (document.getElementById('overrideNoteInput')?.value || '') : '';
                    cleanup();
                    resolve(note);
                });
            });
        }

        async setServiceOverride(serviceId, active, serviceName) {
            const note = await this.showOverrideModal(active, serviceName);
            if (note === null) {
return;
}

            try {
                const setOverrideFn = window.firebaseFunctions.httpsCallable('setServiceOverride');
                const result = await setOverrideFn({
                    clientId: this.currentClient?.id || this.currentClient?.clientId,
                    serviceId,
                    active,
                    note
                });
                if (!result.data.success) {
                    throw new Error(result.data.message || 'שגיאה באישור חריגה');
                }

                // עדכון מקומי
                const services = this.currentClient.services || [];
                const idx = services.findIndex(s => s.id === serviceId);
                if (idx !== -1) {
                    services[idx].overrideActive = active;
                    if (active) {
                        services[idx].overrideNote = note;
                        services[idx].overrideApprovedAt = { seconds: Math.floor(Date.now() / 1000) };
                    }
                }

                this.renderClientInfo();
                this.renderServices();
                this.showNotification(
                    active ? `חריגה אושרה לשירות "${serviceName}"` : 'אישור חריגה בוטל',
                    'success'
                );
            } catch (e) {
                console.error('Error in setServiceOverride:', e);
                this.showNotification('שגיאה בעדכון החריגה', 'error');
            }
        }

        renderClientInfo() {
            if (!this.currentClient) {
return;
}

            const client = this.currentClient;
            const caseOpenDate = client.caseOpenDate
                ? new Date(client.caseOpenDate.seconds * 1000).toLocaleDateString('he-IL')
                : null;
            const createdDate = caseOpenDate || (client.createdAt
                ? new Date(client.createdAt.seconds * 1000).toLocaleDateString('he-IL')
                : '-');

            const totalServices = client.services?.length || 0;
            const activeServices = client.services?.filter(s => s.status === 'active').length || 0;

            // בדיקה - האם חסר הסכם שכר טרחה?
            const hasAgreement = client.feeAgreements && client.feeAgreements.length > 0;
            const noAgreementBadge = !hasAgreement ? `
                <span class="no-agreement-badge">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>חסר הסכם שכ"ט</span>
                </span>
            ` : '';

            this.clientInfoContainer.innerHTML = `
                <div class="management-client-name">
                    <i class="fas fa-user-circle"></i>
                    ${this.escapeHtml(client.fullName)}
                    ${noAgreementBadge}
                </div>
                <div class="management-client-meta">
                    <div class="management-client-meta-item">
                        <i class="fas fa-hashtag"></i>
                        <span>תיק: ${this.escapeHtml(client.caseNumber || '-')}</span>
                    </div>
                    <div class="management-client-meta-item">
                        <i class="fas fa-calendar"></i>
                        <span>נפתח: ${createdDate} <button class="edit-case-open-date-btn" title="ערוך תאריך פתיחה" style="background:none;border:none;cursor:pointer;padding:0 4px;color:#6b7280;">✏️</button></span>
                    </div>
                    <div class="management-client-meta-item">
                        <i class="fas fa-briefcase"></i>
                        <span>${activeServices} מתוך ${totalServices} שירותים פעילים</span>
                    </div>
                </div>
            `;

            const editBtn = this.clientInfoContainer.querySelector('.edit-case-open-date-btn');
            if (editBtn) {
                editBtn.addEventListener('click', () => this.editCaseOpenDate());
            }
        }

        /**
         * Render services list
         * רינדור רשימת שירותים
         */
        renderServices() {
            if (!this.currentClient) {
return;
}

            const services = this.currentClient.services || [];

            // 🔍 DEBUG: Check for duplicate services
            console.log('📊 Rendering services:', services.length);
            const serviceIds = services.map(s => s.id);
            const uniqueIds = [...new Set(serviceIds)];
            if (serviceIds.length !== uniqueIds.length) {
                console.warn('⚠️ DUPLICATE SERVICES DETECTED!', {
                    total: serviceIds.length,
                    unique: uniqueIds.length,
                    ids: serviceIds
                });
            }

            if (services.length === 0) {
                this.servicesListContainer.innerHTML = `
                    <div class="management-empty-state">
                        <i class="fas fa-inbox"></i>
                        <h4>אין שירותים פעילים</h4>
                        <p>הוסף שירות חדש כדי להתחיל</p>
                    </div>
                `;
                return;
            }

            const servicesHTML = services.map(service => this.renderServiceCard(service)).join('');
            this.servicesListContainer.innerHTML = servicesHTML;

            // Attach service action listeners
            this.attachServiceActionListeners();

            // Attach toggle listeners for expand/collapse
            this.attachServiceToggleListeners();
        }

        /**
         * Attach toggle listeners for service cards
         * צרף מאזינים להרחבה/כיווץ של כרטיסי שירות
         */
        attachServiceToggleListeners() {
            const serviceCards = this.servicesListContainer.querySelectorAll('.management-service-card');

            serviceCards.forEach(card => {
                const header = card.querySelector('.management-service-header');

                header.addEventListener('click', () => {
                    // Toggle expanded class
                    const wasExpanded = card.classList.contains('expanded');

                    // Close all other cards (optional - remove these 3 lines for multiple open cards)
                    serviceCards.forEach(c => c.classList.remove('expanded'));

                    // Toggle current card
                    if (!wasExpanded) {
                        card.classList.add('expanded');
                    }
                });
            });
        }

        /**
         * Render single service card
         * רינדור כרטיס שירות בודד
         */
        renderServiceCard(service) {
            const typeBadge = this.getServiceTypeBadge(service.type);
            const statusBadge = this.getServiceStatusBadge(service.status);
            const serviceInfo = this.getServiceInfo(service);
            const stagesHTML = service.type === 'legal_procedure' && service.stages
                ? this.renderStages(service.stages)
                : '';
            const actions = this.getServiceActions(service);

            return `
                <div class="management-service-card" data-service-id="${service.id}">
                    <div class="management-service-header">
                        <div class="management-service-header-left">
                            <div class="management-service-title">
                                <i class="fas ${this.getServiceIcon(service.type)}"></i>
                                שירות
                            </div>
                            ${statusBadge}
                            <span class="management-service-badge service-name" title="${service.name || 'ללא שם'}"><i class="fas fa-tag"></i> ${this.escapeHtml(this.truncateServiceName(service.name || 'ללא שם'))}</span>
                            ${typeBadge}
                        </div>
                        <i class="fas fa-chevron-down management-service-toggle"></i>
                    </div>

                    <div class="management-service-body">
                        <div class="management-service-content">
                            <div class="management-service-info">
                                ${serviceInfo}
                            </div>

                            ${stagesHTML}

                            <div class="management-service-actions">
                                ${actions}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Get service type badge
         * קבלת תג סוג שירות
         */
        getServiceTypeBadge(type) {
            const badges = {
                'hours': '<span class="management-service-badge hours"><i class="fas fa-clock"></i> שעות</span>',
                'legal_procedure': '<span class="management-service-badge legal"><i class="fas fa-gavel"></i> הליך משפטי</span>',
                'fixed': '<span class="management-service-badge fixed"><i class="fas fa-dollar-sign"></i> מחיר קבוע</span>'
            };
            return badges[type] || '';
        }

        /**
         * Get service status badge
         * קבלת תג סטטוס שירות
         */
        getServiceStatusBadge(status) {
            const badges = {
                'active': '<span class="service-status-badge status-active"><i class="fas fa-check-circle"></i> פעיל</span>',
                'completed': '<span class="service-status-badge status-completed"><i class="fas fa-lock"></i> הושלם</span>',
                'on_hold': '<span class="service-status-badge status-on-hold"><i class="fas fa-pause-circle"></i> בהמתנה</span>',
                'archived': '<span class="service-status-badge status-archived"><i class="fas fa-archive"></i> בארכיון</span>'
            };
            return badges[status || 'active'] || '';
        }

        /**
         * Get service icon
         * קבלת אייקון שירות
         */
        getServiceIcon(type) {
            const icons = {
                'hours': 'fa-clock',
                'legal_procedure': 'fa-gavel',
                'fixed': 'fa-dollar-sign'
            };
            return icons[type] || 'fa-briefcase';
        }

        /**
         * Get service info
         * קבלת מידע שירות
         */
        getServiceInfo(service) {
            if (service.type === 'hours') {
                const totalHours = service.totalHours || 0;
                const hoursRemaining = service.hoursRemaining || 0;
                const hoursUsed = totalHours - hoursRemaining;
                const percentage = totalHours > 0 ? ((hoursUsed / totalHours) * 100).toFixed(0) : 0;

                // Determine status class based on remaining hours
                let statusClass = 'success';
                if (hoursRemaining <= 0) {
                    statusClass = 'blocked';
                } else if (hoursRemaining <= 5) {
                    statusClass = 'critical';
                } else if (hoursRemaining <= 10) {
                    statusClass = 'warning';
                }

                // Format start date
                const startDate = service.startedAt || service.createdAt;
                let dateDisplay = '';
                if (startDate) {
                    const date = new Date(startDate);
                    dateDisplay = date.toLocaleDateString('he-IL', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    });
                }

                // Override UI for blocked services
                let overrideHTML = '';
                if (hoursRemaining <= 0) {
                    if (service.overrideActive) {
                        const overrideDate = service.overrideApprovedAt
                            ? new Date(service.overrideApprovedAt.seconds * 1000).toLocaleDateString('he-IL')
                            : '';
                        overrideHTML = `
                            <div style="margin-top:8px;padding:8px 12px;background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;">
                                <span style="background:#f59e0b;color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;">⚡ חריגה מאושרת</span>
                                <small style="color:#6b7280;display:block;margin-top:4px;">אושר ע"י: ${service.overrideApprovedBy || ''} | ${overrideDate}</small>
                                ${service.overrideNote ? `<small style="color:#6b7280;display:block;">הערה: ${service.overrideNote}</small>` : ''}
                                <button class="override-btn" data-service-id="${service.id}" data-active="false" data-name="${(service.name || '').replace(/"/g, '&quot;')}" style="padding:4px 10px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;margin-top:4px;">בטל חריגה</button>
                            </div>`;
                    } else {
                        overrideHTML = `
                            <div style="margin-top:8px;">
                                <button class="override-btn" data-service-id="${service.id}" data-active="true" data-name="${(service.name || '').replace(/"/g, '&quot;')}" style="padding:4px 10px;background:#f59e0b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">אפשר חריגה</button>
                            </div>`;
                    }
                }

                return `
                    <div class="management-service-info">
                        <div class="management-service-info-item">
                            <span class="management-service-info-label">תאריך פתיחה:</span>
                            <span class="management-service-info-value">${dateDisplay || 'לא זמין'}</span>
                        </div>
                    </div>

                    <div class="management-hours-progress">
                        <div class="management-hours-progress-title">
                            <i class="fas fa-clock"></i>
                            ניצול שעות
                        </div>
                        <div class="management-hours-progress-bar">
                            <div class="management-hours-progress-fill ${statusClass}" style="width: ${percentage}%">
                            </div>
                        </div>
                        <div class="management-hours-stats">
                            <div class="management-hours-percentage">${percentage}%</div>
                            <div class="management-hours-stat">
                                <span class="management-hours-stat-label">נרכשו:</span>
                                <span class="management-hours-stat-value">${totalHours.toFixed(1)}</span>
                            </div>
                            <div class="management-hours-stat">
                                <span class="management-hours-stat-label">נוצלו:</span>
                                <span class="management-hours-stat-value">${hoursUsed.toFixed(1)}</span>
                            </div>
                            <div class="management-hours-stat">
                                <span class="management-hours-stat-label">נותרו:</span>
                                <span class="management-hours-stat-value ${statusClass}">${hoursRemaining.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                    ${overrideHTML}
                `;
            } else if (service.type === 'legal_procedure') {
                const stages = service.stages || [];
                const totalStages = stages.length;
                const completedStages = stages.filter(s => s.status === 'completed').length;
                const activeStage = stages.find(s => s.status === 'active');

                return `
                    <div class="management-service-info-item">
                        <span class="management-service-info-label">התקדמות</span>
                        <span class="management-service-info-value">${completedStages}/${totalStages} שלבים</span>
                    </div>
                    <div class="management-service-info-item">
                        <span class="management-service-info-label">שלב נוכחי</span>
                        <span class="management-service-info-value">${activeStage ? activeStage.name : 'אין'}</span>
                    </div>
                    <div class="management-service-info-item">
                        <span class="management-service-info-label">תמחור</span>
                        <span class="management-service-info-value">${service.pricingType === 'hourly' ? 'שעתי' : 'קבוע'}</span>
                    </div>
                `;
            } else if (service.type === 'fixed') {
                return `
                    <div class="management-service-info-item">
                        <span class="management-service-info-label">מחיר</span>
                        <span class="management-service-info-value">₪${service.price || 0}</span>
                    </div>
                    <div class="management-service-info-item">
                        <span class="management-service-info-label">סטטוס</span>
                        <span class="management-service-info-value">${service.status === 'active' ? 'פעיל' : 'הושלם'}</span>
                    </div>
                `;
            }
            return '';
        }

        /**
         * Render stages for legal procedure
         * רינדור שלבים להליך משפטי
         */
        renderStages(stages) {
            if (!stages || stages.length === 0) {
return '';
}

            // Calculate progress percentage
            const completedCount = stages.filter(s => s.status === 'completed').length;
            const progressPercent = stages.length > 0 ? (completedCount / stages.length) * 100 : 0;

            const stagesHTML = stages.map(stage => {
                let icon = 'fa-circle';
                let stageClass = 'pending';

                if (stage.status === 'completed') {
                    icon = 'fa-check';
                    stageClass = 'completed';
                } else if (stage.status === 'active') {
                    icon = 'fa-circle-notch';
                    stageClass = 'active';
                }

                // תצוגת שעות - בדיקת כל השדות האפשריים
                let hoursInfo = '';
                const stageHours = stage.hours || stage.totalHours || stage.allocatedHours || stage.estimatedHours || 0;
                const hoursUsed = stage.hoursUsed || 0;
                const hoursRemaining = stage.hoursRemaining !== undefined
                    ? stage.hoursRemaining
                    : (stageHours - hoursUsed);

                if (stageHours > 0) {
                    if (stage.status === 'active') {
                        // שלב פעיל - הצג נותר/סך הכל
                        hoursInfo = `${hoursRemaining.toFixed(1)}/${stageHours.toFixed(1)}`;
                    } else if (stage.status === 'pending') {
                        // שלב ממתין - הצג רק סך הכל
                        hoursInfo = `${stageHours.toFixed(1)}`;
                    } else {
                        // שלב הושלם - הצג סך הכל
                        hoursInfo = `${stageHours.toFixed(1)}`;
                    }
                }

                console.log(`🔍 Stage: "${stage.name}", hours: ${stage.hours}, totalHours: ${stage.totalHours}, allocatedHours: ${stage.allocatedHours}, hoursRemaining: ${stage.hoursRemaining}, hoursUsed: ${stage.hoursUsed}, status: ${stage.status}, display: "${hoursInfo}"`);

                return `
                    <div class="management-stage ${stageClass}">
                        <div class="management-stage-icon">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="management-stage-info">
                            <div class="management-stage-name">${this.escapeHtml(stage.name || stage.description || 'שלב')}</div>
                            ${hoursInfo ? `<div class="management-stage-hours">${hoursInfo} שע׳</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="management-stages">
                    <div class="management-stages-title">
                        <i class="fas fa-layer-group"></i>
                        שלבי ההליך
                    </div>
                    <div class="management-stages-timeline">
                        <div class="management-stages-progress">
                            <div class="management-stages-progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <div class="management-stages-list">
                            ${stagesHTML}
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Get service actions
         * קבלת פעולות זמינות לשירות
         */
        getServiceActions(service) {
            const actions = [];

            if (service.type === 'hours') {
                actions.push(`<button class="management-service-action-btn primary" data-service-action="renew" data-service-id="${service.id}">
                    <i class="fas fa-plus"></i> חדש שעות
                </button>`);
            }

            if (service.type === 'legal_procedure') {
                const activeStage = service.stages?.find(s => s.status === 'active');
                if (activeStage) {
                    actions.push(`<button class="management-service-action-btn primary" data-service-action="next-stage" data-service-id="${service.id}">
                        <i class="fas fa-forward"></i> עבור לשלב הבא
                    </button>`);
                }
            }

            // Change status button (always visible)
            actions.push(`<button class="management-service-action-btn secondary" data-service-action="change-status" data-service-id="${service.id}">
                <i class="fas fa-exchange-alt"></i> שנה סטטוס
            </button>`);

            // Complete button (deprecated - now use change status)
            // Keeping for backward compatibility
            if (service.status === 'active') {
                actions.push(`<button class="management-service-action-btn secondary" data-service-action="complete" data-service-id="${service.id}">
                    <i class="fas fa-check"></i> סמן כהושלם
                </button>`);
            }

            actions.push(`<button class="management-service-action-btn danger" data-service-action="delete" data-service-id="${service.id}">
                <i class="fas fa-trash"></i> מחק שירות
            </button>`);

            return actions.join('');
        }

        /**
         * Attach service action listeners
         * חיבור מאזיני אירועים לפעולות שירות
         */
        attachServiceActionListeners() {
            const actionButtons = this.servicesListContainer.querySelectorAll('[data-service-action]');
            actionButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const action = e.currentTarget.dataset.serviceAction;
                    const serviceId = e.currentTarget.dataset.serviceId;
                    this.handleServiceAction(action, serviceId);
                });
            });

            // Override buttons
            this.servicesListContainer.querySelectorAll('.override-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const active = btn.dataset.active === 'true';
                    this.setServiceOverride(btn.dataset.serviceId, active, btn.dataset.name);
                });
            });
        }

        /**
         * Handle quick action
         * טיפול בפעולה מהירה
         */
        handleQuickAction(action) {
            console.log('🎯 Quick action:', action);

            switch (action) {
                case 'add-service':
                    this.addService();
                    break;
                case 'renew-hours':
                    this.renewHours();
                    break;
                case 'change-status':
                    this.changeStatus();
                    break;
                case 'close-case':
                    this.closeCase();
                    break;
            }
        }

        /**
         * Handle service action
         * טיפול בפעולה על שירות
         */
        handleServiceAction(action, serviceId) {
            console.log('🎯 Service action:', action, 'for service:', serviceId);

            const service = this.currentClient.services?.find(s => s.id === serviceId);
            if (!service) {
                console.error('❌ Service not found:', serviceId);
                return;
            }

            switch (action) {
                case 'renew':
                    this.renewServiceHours(service);
                    break;
                case 'next-stage':
                    this.moveToNextStage(service);
                    break;
                case 'change-status':
                    this.changeServiceStatus(service);
                    break;
                case 'complete':
                    this.completeService(service);
                    break;
                case 'delete':
                    this.deleteService(service);
                    break;
            }
        }

        /**
         * Quick Actions Implementation
         * מימוש פעולות מהירות
         */

        /**
         * Add Service - Opens modal for adding new service
         * הוספת שירות חדש
         */
        addService() {
            console.log('🎨 Opening Add Service Modal');

            // Get modal elements
            const modal = document.getElementById('addServiceModal');
            const serviceTypeSelect = document.getElementById('serviceType');
            const serviceNameInput = document.getElementById('serviceName');
            const closeBtn = document.getElementById('closeAddServiceModal');
            const cancelBtn = document.getElementById('cancelAddService');
            const saveBtn = document.getElementById('saveNewService');

            if (!modal) {
                console.error('❌ Add Service Modal not found');
                return;
            }

            // Reset form
            this.resetAddServiceForm();

            // Show modal
            modal.style.display = 'flex';

            // Setup event listeners (one-time setup)
            if (!this._addServiceListenersSetup) {
                // Service type change - show/hide relevant fields
                serviceTypeSelect.addEventListener('change', (e) => {
                    this.toggleServiceTypeFields(e.target.value);
                });

                // Close button
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                    this.resetAddServiceForm();
                });

                // Cancel button
                cancelBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                    this.resetAddServiceForm();
                });

                // Save button
                saveBtn.addEventListener('click', () => {
                    this.saveNewService();
                });

                // Click outside to close
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.style.display = 'none';
                        this.resetAddServiceForm();
                    }
                });

                this._addServiceListenersSetup = true;
            }
        }

        /**
         * Toggle service type fields based on selection
         */
        toggleServiceTypeFields(serviceType) {
            const hoursFields = document.getElementById('hoursServiceFields');
            const legalFields = document.getElementById('legalProcedureFields');
            const fixedFields = document.getElementById('fixedServiceFields');

            // Hide all
            hoursFields.style.display = 'none';
            legalFields.style.display = 'none';
            fixedFields.style.display = 'none';

            // Show relevant fields
            switch (serviceType) {
                case 'hours':
                    hoursFields.style.display = 'block';
                    break;
                case 'legal_procedure':
                    legalFields.style.display = 'block';
                    break;
                case 'fixed':
                    fixedFields.style.display = 'block';
                    break;
            }
        }

        /**
         * Reset add service form
         */
        resetAddServiceForm() {
            document.getElementById('serviceType').value = '';
            document.getElementById('serviceName').value = '';
            document.getElementById('totalHours').value = '';
            document.getElementById('procedureName').value = '';
            document.getElementById('stagesInput').value = '';
            document.getElementById('serviceDescription').value = '';
            document.getElementById('fixedPrice').value = '';

            this.toggleServiceTypeFields('');
        }

        /**
         * Save new service to Firebase
         */
        async saveNewService() {
            const serviceType = document.getElementById('serviceType').value;
            const serviceName = document.getElementById('serviceName').value.trim();

            // Validation
            if (!serviceType) {
                this.showNotification('יש לבחור סוג שירות', 'warning');
                return;
            }

            if (!serviceName) {
                this.showNotification('יש להזין שם שירות', 'warning');
                return;
            }

            // Build service object based on type
            const newService = {
                id: 'service_' + Date.now(),
                serviceName: serviceName,
                serviceType: serviceType,
                type: serviceType,
                status: 'active',
                createdAt: new Date().toISOString(),
                startedAt: new Date().toISOString()
            };

            switch (serviceType) {
                case 'hours':
                    const totalHours = parseFloat(document.getElementById('totalHours').value) || 0;
                    if (totalHours <= 0) {
                        this.showNotification('יש להזין מספר שעות תקין', 'warning');
                        return;
                    }
                    newService.totalHours = totalHours;
                    newService.hoursRemaining = totalHours;
                    newService.hoursUsed = 0;
                    break;

                case 'legal_procedure':
                    const procedureName = document.getElementById('procedureName').value.trim();
                    const stagesInput = document.getElementById('stagesInput').value.trim();

                    if (!procedureName) {
                        this.showNotification('יש להזין סוג הליך', 'warning');
                        return;
                    }

                    if (!stagesInput) {
                        this.showNotification('יש להזין שלבים', 'warning');
                        return;
                    }

                    // Parse stages from comma-separated input
                    const stageNames = stagesInput.split(',').map(s => s.trim()).filter(s => s);
                    if (stageNames.length === 0) {
                        this.showNotification('יש להזין לפחות שלב אחד', 'warning');
                        return;
                    }

                    newService.procedureType = procedureName;
                    newService.stages = stageNames.map((name, index) => ({
                        id: `stage_${Date.now()}_${index}`,
                        name: name,
                        status: index === 0 ? 'active' : 'pending',
                        startedAt: index === 0 ? new Date().toISOString() : null,
                        completedAt: null
                    }));
                    break;

                case 'fixed':
                    const description = document.getElementById('serviceDescription').value.trim();
                    const fixedPrice = parseFloat(document.getElementById('fixedPrice').value) || 0;

                    if (fixedPrice < 0) {
                        this.showNotification('מחיר קבוע חייב להיות חיובי', 'warning');
                        return;
                    }

                    newService.description = description;
                    newService.fixedPrice = fixedPrice;
                    newService.work = { totalMinutesWorked: 0, entriesCount: 0 };
                    newService.completedAt = null;
                    break;
            }

            // Save to Firebase
            try {
                this.showLoading('מוסיף שירות...');
                const db = window.firebaseApp.firestore();
                const clientRef = db.collection('clients').doc(this.currentClient.id);

                const updatedServices = [...(this.currentClient.services || []), newService];

                // ✅ Calculate totals from all services for backward compatibility
                const totalHoursFromAllServices = this.calculateTotalHoursFromServices(updatedServices);
                const totalRemainingFromAllServices = this.calculateRemainingHoursFromServices(updatedServices);

                // Prepare update object
                const updateData = {
                    services: updatedServices,
                    updatedAt: new Date().toISOString()
                };

                // ✅ If this is an hours-based service, sync direct fields for User Interface compatibility
                if (newService.serviceType === 'hours') {
                    const clientIsBlocked = (totalRemainingFromAllServices <= 0) && (this.currentClient.type === 'hours');
                    const clientIsCritical = (!clientIsBlocked) && (totalRemainingFromAllServices <= 5) && (totalRemainingFromAllServices > 0) && (this.currentClient.type === 'hours');

                    updateData.totalHours = totalHoursFromAllServices;
                    updateData.hoursRemaining = totalRemainingFromAllServices;
                    updateData.minutesRemaining = Math.round(totalRemainingFromAllServices * 60);
                    updateData.isBlocked = clientIsBlocked;
                    updateData.isCritical = clientIsCritical;
                    updateData.type = 'hours'; // Ensure client type is set
                }

                await clientRef.update(updateData);

                // Update local state
                this.currentClient.services = updatedServices;
                if (newService.serviceType === 'hours') {
                    this.currentClient.totalHours = totalHoursFromAllServices;
                    this.currentClient.hoursRemaining = totalRemainingFromAllServices;
                    this.currentClient.minutesRemaining = Math.round(totalRemainingFromAllServices * 60);
                }
                this.renderServices();

                // Close modal
                document.getElementById('addServiceModal').style.display = 'none';
                this.resetAddServiceForm();

                this.hideLoading();
                this.showNotification('השירות נוסף בהצלחה', 'success');

                // Refresh parent data
                if (window.ClientsDataManager && typeof window.ClientsDataManager.loadClients === 'function') {
                    await window.ClientsDataManager.loadClients();
                }

            } catch (error) {
                console.error('❌ Error adding service:', error);
                this.hideLoading();
                this.showNotification('שגיאה בהוספת שירות: ' + error.message, 'error');
            }
        }

        renewHours() {
            // Find all hours-based services and prompt for renewal
            const hoursServices = this.currentClient.services.filter(s => s.type === 'hours' || s.serviceType === 'hours');

            if (hoursServices.length === 0) {
                this.showNotification('אין שירותי שעות פעילים', 'info');
                return;
            }

            // If multiple services, let user choose
            if (hoursServices.length > 1) {
                this.showNotification('יש יותר משירות שעות אחד. השתמש בכפתור חידוש בתוך כל שירות.', 'info');
                return;
            }

            // Renew the single hours service
            this.renewServiceHours(hoursServices[0]);
        }

        /**
         * Change client status
         * שינוי סטטוס לקוח
         */
        async changeStatus() {
            console.log('🔄 Changing client status');

            const currentStatus = this.currentClient.status || 'active';
            const isBlocked = this.currentClient.isBlocked || false;
            const isCritical = this.currentClient.isCritical || false;

            // Build status display text
            let currentStatusText = 'פעיל';
            if (isBlocked) {
                currentStatusText = 'חסום';
            } else if (isCritical) {
                currentStatusText = 'קריטי';
            } else if (currentStatus === 'inactive') {
                currentStatusText = 'לא פעיל';
            }

            // Prompt for new status
            const message = `סטטוס נוכחי: ${currentStatusText}\n\nבחר סטטוס חדש:\n1 - פעיל\n2 - לא פעיל\n3 - חסום\n4 - קריטי`;
            const choice = prompt(message, '1');

            if (!choice) {
return;
} // User cancelled

            const choiceNum = parseInt(choice);
            if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > 4) {
                this.showNotification('בחירה לא תקינה', 'warning');
                return;
            }

            // Map choice to status
            let newStatus = 'active';
            let newIsBlocked = false;
            let newIsCritical = false;
            let statusText = '';

            switch (choiceNum) {
                case 1: // Active
                    newStatus = 'active';
                    newIsBlocked = false;
                    newIsCritical = false;
                    statusText = 'פעיל';
                    break;
                case 2: // Inactive
                    newStatus = 'inactive';
                    newIsBlocked = false;
                    newIsCritical = false;
                    statusText = 'לא פעיל';
                    break;
                case 3: // Blocked
                    newStatus = 'active';
                    newIsBlocked = true;
                    newIsCritical = false;
                    statusText = 'חסום';
                    break;
                case 4: // Critical
                    newStatus = 'active';
                    newIsBlocked = false;
                    newIsCritical = true;
                    statusText = 'קריטי';
                    break;
            }

            if (!confirm(`האם לשנות סטטוס ל-"${statusText}"?`)) {
                return;
            }

            try {
                this.showLoading('משנה סטטוס...');

                // Call CF instead of direct Firestore write
                const changeStatusFn = window.firebaseFunctions.httpsCallable('changeClientStatus');
                const result = await changeStatusFn({
                    clientId: this.currentClient.id,
                    newStatus: newStatus,
                    isBlocked: newIsBlocked,
                    isCritical: newIsCritical
                });

                if (!result.data.success) {
                    throw new Error(result.data.message || 'שגיאה בשינוי סטטוס');
                }

                // Update local state from CF response
                this.currentClient.status = result.data.newStatus;
                this.currentClient.isBlocked = result.data.isBlocked;
                this.currentClient.isCritical = result.data.isCritical;

                // Re-render client info
                this.renderClientInfo();

                this.hideLoading();
                this.showNotification(result.data.message, 'success');

                // Refresh parent data
                if (window.ClientsDataManager && typeof window.ClientsDataManager.loadClients === 'function') {
                    await window.ClientsDataManager.loadClients();
                }

            } catch (error) {
                console.error('❌ Error changing status:', error);
                this.hideLoading();
                this.showNotification('שגיאה בשינוי סטטוס: ' + error.message, 'error');
            }
        }

        /**
         * Close case - archive client and all services
         * סגירת תיק - העברה לארכיון
         */
        async closeCase() {
            console.log('📦 Closing case');

            const clientName = this.currentClient.name || 'לקוח';
            const message = `האם אתה בטוח שברצונך לסגור את תיק "${clientName}"?\n\nפעולה זו תבצע:\n- סימון כל השירותים כהושלמו\n- שינוי סטטוס ללקוח ללא פעיל\n- העברה לארכיון\n\nשים לב: ניתן יהיה לפתוח מחדש בעתיד`;

            if (!confirm(message)) {
                return;
            }

            try {
                this.showLoading('סוגר תיק...');

                // Call CF instead of direct Firestore write
                const closeCaseFn = window.firebaseFunctions.httpsCallable('closeCase');
                const result = await closeCaseFn({ clientId: this.currentClient.id });
                const responseData = result.data;

                // Update local state from CF response
                this.currentClient.status = 'inactive';
                this.currentClient.isArchived = true;
                this.currentClient.isBlocked = false;
                this.currentClient.isCritical = false;
                this.currentClient.services = (this.currentClient.services || []).map(service => {
                    if (service.status !== 'completed') {
                        return { ...service, status: 'completed', completedAt: responseData.closedAt };
                    }
                    return service;
                });
                if (responseData.clientAggregates) {
                    this.currentClient.totalHours = responseData.clientAggregates.totalHours;
                    this.currentClient.hoursUsed = responseData.clientAggregates.hoursUsed;
                    this.currentClient.hoursRemaining = responseData.clientAggregates.hoursRemaining;
                    this.currentClient.minutesRemaining = responseData.clientAggregates.minutesRemaining;
                    this.currentClient.totalServices = responseData.clientAggregates.totalServices;
                    this.currentClient.activeServices = responseData.clientAggregates.activeServices;
                }

                // Re-render
                this.renderClientInfo();
                this.renderServices();

                this.hideLoading();

                // Notification with budget_tasks warning if needed
                let notification = responseData.message || 'התיק נסגר והועבר לארכיון';
                if (responseData.activeBudgetTasks > 0) {
                    notification += `\n⚠️ ${responseData.activeBudgetTasks} משימות תקציב עדיין פעילות — יש לטפל בהן ידנית`;
                }
                this.showNotification(notification, 'success');

                // Refresh parent data
                if (window.ClientsDataManager && typeof window.ClientsDataManager.loadClients === 'function') {
                    await window.ClientsDataManager.loadClients();
                }

                // Close modal after a delay
                setTimeout(() => {
                    this.close();
                }, 2000);

            } catch (error) {
                console.error('❌ Error closing case:', error);
                this.hideLoading();
                const errorMsg = error.message || 'שגיאה בסגירת תיק';
                this.showNotification(errorMsg, 'error');
            }
        }

        /**
         * Calculate total hours from all services
         * חישוב סך השעות מכל השירותים
         */
        calculateTotalHoursFromServices(services) {
            return services.reduce((sum, service) => {
                if (service.type === 'hours' || service.serviceType === 'hours') {
                    return sum + (service.totalHours || 0);
                }
                return sum;
            }, 0);
        }

        /**
         * Calculate remaining hours from all services
         * חישוב שעות נותרות מכל השירותים
         */
        calculateRemainingHoursFromServices(services) {
            return services.reduce((sum, service) => {
                if (service.type === 'hours' || service.serviceType === 'hours') {
                    return sum + (service.hoursRemaining || 0);
                }
                return sum;
            }, 0);
        }

        async renewServiceHours(service) {
            // Prompt for hours to add
            const hoursToAdd = prompt(`כמה שעות להוסיף לשירות "${service.serviceName}"?`, '10');

            if (!hoursToAdd || isNaN(hoursToAdd) || parseFloat(hoursToAdd) <= 0) {
                if (hoursToAdd !== null) { // User didn't click cancel
                    this.showNotification('יש להזין מספר שעות תקין', 'warning');
                }
                return;
            }

            const hours = parseFloat(hoursToAdd);

            if (!confirm(`האם להוסיף ${hours} שעות לשירות "${service.serviceName}"?`)) {
                return;
            }

            try {
                this.showLoading('מוסיף שעות...');

                // Call Cloud Function instead of direct Firestore write
                const addPackageFn = window.firebaseFunctions.httpsCallable('addPackageToService');
                const result = await addPackageFn({
                    clientId: this.currentClient.id,
                    serviceId: service.id,
                    hours: hours,
                    description: `חידוש שעות - ${new Date().toLocaleDateString('he-IL')}`
                });

                if (!result.data.success) {
                    throw new Error(result.data.message || 'שגיאה בהוספת שעות');
                }

                // Update local state from CF result
                const localService = this.currentClient.services.find(s => s.id === service.id);
                if (localService) {
                    localService.totalHours = result.data.service.totalHours;
                    localService.hoursRemaining = result.data.service.hoursRemaining;
                    if (!localService.packages) {
localService.packages = [];
}
                    localService.packages.push(result.data.package);
                }

                this.renderServices();
                this.renderClientInfo();
                this.hideLoading();
                this.showNotification(`נוספו ${hours} שעות בהצלחה`, 'success');

                if (window.ClientsDataManager && typeof window.ClientsDataManager.loadClients === 'function') {
                    await window.ClientsDataManager.loadClients();
                }

            } catch (error) {
                console.error('❌ Error renewing hours:', error);
                this.hideLoading();
                this.showNotification('שגיאה בהוספת שעות: ' + error.message, 'error');
            }
        }

        async moveToNextStage(service) {
            if (!service.stages || service.stages.length === 0) {
                this.showNotification('אין שלבים בשירות זה', 'warning');
                return;
            }

            // Find active stage index
            const activeStageIndex = service.stages.findIndex(s => s.status === 'active');
            if (activeStageIndex === -1) {
                this.showNotification('אין שלב פעיל', 'warning');
                return;
            }

            // Check if there's a next stage
            if (activeStageIndex >= service.stages.length - 1) {
                this.showNotification('זה השלב האחרון', 'info');
                return;
            }

            const currentStage = service.stages[activeStageIndex];
            const nextStage = service.stages[activeStageIndex + 1];

            if (!confirm(`האם לעבור משלב "${currentStage.name}" לשלב "${nextStage.name}"?`)) {
                return;
            }

            try {
                this.showLoading('מעדכן שלב...');

                const moveToNextStageFn = window.firebaseFunctions.httpsCallable('moveToNextStage');
                const result = await moveToNextStageFn({
                    clientId: this.currentClient.id,
                    serviceId: service.id
                });

                if (!result.data.success) {
                    throw new Error(result.data.message || 'שגיאה במעבר שלב');
                }

                // Update local data from CF response
                const localService = this.currentClient.services.find(s => s.id === service.id);
                if (localService && result.data.updatedStages) {
                    localService.stages = result.data.updatedStages;
                }
                if (result.data.toStage) {
                    this.currentClient.currentStage = result.data.toStage.id;
                    this.currentClient.currentStageName = result.data.toStage.name;
                }

                this.renderServices();
                this.hideLoading();
                this.showNotification(`עברת לשלב "${result.data.toStage?.name || nextStage.name}"`, 'success');

                if (window.ClientsDataManager && typeof window.ClientsDataManager.loadClients === 'function') {
                    await window.ClientsDataManager.loadClients();
                }

            } catch (error) {
                console.error('❌ Error moving to next stage:', error);
                this.hideLoading();
                this.showNotification('שגיאה במעבר לשלב הבא: ' + error.message, 'error');
            }
        }

        async completeService(service) {
            if (!confirm(`האם לסמן את השירות "${service.serviceName}" כהושלם?`)) {
                return;
            }

            try {
                this.showLoading('מסמן כהושלם...');

                const completeServiceFn = window.firebaseFunctions.httpsCallable('completeService');
                const result = await completeServiceFn({
                    clientId: this.currentClient.id,
                    serviceId: service.id
                });

                if (!result.data.success) {
                    throw new Error(result.data.message || 'שגיאה בסימון שירות');
                }

                // Update local data from CF response
                const localService = this.currentClient.services.find(s => s.id === service.id);
                if (localService) {
                    localService.status = 'completed';
                    localService.completedAt = result.data.completedAt;
                }

                // Update client-level aggregates from CF response
                if (result.data.clientAggregates) {
                    this.currentClient.totalHours = result.data.clientAggregates.totalHours;
                    this.currentClient.hoursRemaining = result.data.clientAggregates.hoursRemaining;
                    this.currentClient.minutesRemaining = result.data.clientAggregates.minutesRemaining;
                    this.currentClient.isBlocked = result.data.clientAggregates.isBlocked;
                    this.currentClient.isCritical = result.data.clientAggregates.isCritical;
                }

                this.renderServices();
                this.renderClientInfo();
                this.hideLoading();
                this.showNotification(result.data.message || 'השירות סומן כהושלם', 'success');

                if (window.ClientsDataManager && typeof window.ClientsDataManager.loadClients === 'function') {
                    await window.ClientsDataManager.loadClients();
                }

            } catch (error) {
                console.error('❌ Error completing service:', error);
                this.hideLoading();
                this.showNotification('שגיאה בסימון השירות: ' + error.message, 'error');
            }
        }

        /**
         * Change service status - Interactive modal
         * שינוי סטטוס שירות - מודל אינטראקטיבי
         */
        async changeServiceStatus(service) {
            console.log('🔄 Changing service status for:', service.serviceName || service.name);

            const currentStatus = service.status || 'active';

            // Status options - compact
            const statusOptions = {
                'active': { label: 'פעיל', icon: 'fa-check-circle', color: '#10b981' },
                'completed': { label: 'הושלם', icon: 'fa-lock', color: '#6366f1' },
                'on_hold': { label: 'בהמתנה', icon: 'fa-pause-circle', color: '#f59e0b' },
                'archived': { label: 'בארכיון', icon: 'fa-archive', color: '#6b7280' }
            };

            // Build compact modal HTML
            const modalHTML = `
                <div class="status-change-modal-overlay" id="statusChangeModalOverlay">
                    <div class="status-change-modal">
                        <div class="status-change-modal-header">
                            <h3><i class="fas fa-exchange-alt"></i> שינוי סטטוס</h3>
                            <button class="status-change-modal-close" onclick="document.getElementById('statusChangeModalOverlay').remove()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="status-change-modal-body">
                            <div class="status-change-service-info">
                                <i class="fas fa-briefcase"></i>
                                <span>${this.escapeHtml(service.serviceName || service.name || 'שירות')}</span>
                            </div>
                            <div class="status-change-current">
                                <span class="status-change-label">נוכחי:</span>
                                <span class="status-change-badge" style="background: ${statusOptions[currentStatus]?.color || '#6b7280'}">
                                    <i class="fas ${statusOptions[currentStatus]?.icon || 'fa-circle'}"></i>
                                    ${statusOptions[currentStatus]?.label || currentStatus}
                                </span>
                            </div>
                            <div class="status-change-buttons">
                                ${Object.entries(statusOptions).map(([key, opt]) => `
                                    <button class="status-change-option ${key === currentStatus ? 'current' : ''}"
                                            data-status="${key}" style="--status-color: ${opt.color}"
                                            ${key === currentStatus ? 'disabled' : ''}>
                                        <i class="fas ${opt.icon}"></i>
                                        <span>${opt.label}</span>
                                        ${key === currentStatus ? '<span class="current-badge">נוכחי</span>' : ''}
                                    </button>
                                `).join('')}
                            </div>
                            <textarea id="statusChangeNote" placeholder="הערה (אופציונלי)" rows="2"></textarea>
                        </div>
                        <div class="status-change-modal-footer">
                            <button class="btn-secondary" onclick="document.getElementById('statusChangeModalOverlay').remove()">ביטול</button>
                            <button class="btn-primary" id="statusChangeConfirmBtn" disabled>שמור</button>
                        </div>
                    </div>
                </div>
            `;

            // Insert modal into DOM
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Get modal elements
            const overlay = document.getElementById('statusChangeModalOverlay');
            const confirmBtn = document.getElementById('statusChangeConfirmBtn');
            const noteTextarea = document.getElementById('statusChangeNote');
            const optionButtons = overlay.querySelectorAll('.status-change-option:not([disabled])');

            let selectedStatus = null;

            // Handle option selection
            optionButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Remove active class from all
                    optionButtons.forEach(b => b.classList.remove('active'));

                    // Add active class to selected
                    button.classList.add('active');
                    selectedStatus = button.dataset.status;

                    // Enable confirm button
                    confirmBtn.disabled = false;
                });
            });

            // Handle confirm
            confirmBtn.addEventListener('click', async () => {
                if (!selectedStatus) {
                    return;
                }

                const note = noteTextarea.value.trim();

                try {
                    // Disable button and show loading
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר...';

                    // Call CF instead of direct Firestore write
                    const changeStatusFn = window.firebaseFunctions.httpsCallable('changeServiceStatus');
                    const result = await changeStatusFn({
                        clientId: this.currentClient.id,
                        serviceId: service.id,
                        newStatus: selectedStatus,
                        note: note || null
                    });

                    if (!result.data.success) {
                        throw new Error(result.data.message || 'שגיאה בשינוי סטטוס');
                    }

                    // Update local service data from CF response
                    const localService = this.currentClient.services.find(s => s.id === service.id);
                    if (localService) {
                        localService.status = result.data.newStatus;
                        localService.statusChangedAt = result.data.statusChangedAt;
                        localService.previousStatus = result.data.previousStatus;
                    }

                    // Update client-level aggregates from CF response
                    if (result.data.clientAggregates) {
                        this.currentClient.totalHours = result.data.clientAggregates.totalHours;
                        this.currentClient.hoursUsed = result.data.clientAggregates.hoursUsed;
                        this.currentClient.hoursRemaining = result.data.clientAggregates.hoursRemaining;
                        this.currentClient.minutesRemaining = result.data.clientAggregates.minutesRemaining;
                        this.currentClient.isBlocked = result.data.clientAggregates.isBlocked;
                        this.currentClient.isCritical = result.data.clientAggregates.isCritical;
                        this.currentClient.totalServices = result.data.clientAggregates.totalServices;
                        this.currentClient.activeServices = result.data.clientAggregates.activeServices;
                    }

                    // Close modal
                    overlay.remove();

                    // Re-render UI with updated data
                    this.renderServices();
                    this.renderClientInfo();

                    // Show success
                    this.showNotification(result.data.message, 'success');

                    // Refresh parent data
                    if (window.ClientsDataManager && typeof window.ClientsDataManager.loadClients === 'function') {
                        await window.ClientsDataManager.loadClients();
                    }

                } catch (error) {
                    console.error('❌ Error changing service status:', error);
                    this.showNotification('שגיאה בשינוי סטטוס: ' + error.message, 'error');

                    // Re-enable button
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = 'שמור';
                }
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.remove();
                }
            });

            // Close on ESC key
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    overlay.remove();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        }

        async deleteService(service) {
            if (!confirm(`האם למחוק את השירות "${service.serviceName}"?\n\nשים לב: הפעולה בלתי הפיכה!`)) {
                return;
            }

            try {
                this.showLoading('מוחק שירות...');

                // Call CF instead of direct Firestore write
                const deleteServiceFn = window.firebaseFunctions.httpsCallable('deleteService');
                const result = await deleteServiceFn({
                    clientId: this.currentClient.id,
                    serviceId: service.id,
                    confirmDelete: true
                });

                if (!result.data.success) {
                    throw new Error(result.data.message || 'שגיאה במחיקת שירות');
                }

                // Remove from local data
                this.currentClient.services = this.currentClient.services.filter(
                    s => s.id !== service.id
                );

                // Update client-level aggregates from CF response
                if (result.data.clientAggregates) {
                    this.currentClient.totalHours = result.data.clientAggregates.totalHours;
                    this.currentClient.hoursUsed = result.data.clientAggregates.hoursUsed;
                    this.currentClient.hoursRemaining = result.data.clientAggregates.hoursRemaining;
                    this.currentClient.minutesRemaining = result.data.clientAggregates.minutesRemaining;
                    this.currentClient.isBlocked = result.data.clientAggregates.isBlocked;
                    this.currentClient.isCritical = result.data.clientAggregates.isCritical;
                    this.currentClient.totalServices = result.data.clientAggregates.totalServices;
                    this.currentClient.activeServices = result.data.clientAggregates.activeServices;
                }

                this.renderServices();
                this.renderClientInfo();
                this.hideLoading();
                this.showNotification(result.data.message, 'success');

                if (window.ClientsDataManager && typeof window.ClientsDataManager.loadClients === 'function') {
                    await window.ClientsDataManager.loadClients();
                }

            } catch (error) {
                console.error('❌ Error deleting service:', error);
                this.hideLoading();

                // Friendly message for referential integrity rejection
                const errorMsg = error.message || '';
                if (errorMsg.includes('ארכיון') || errorMsg.includes('רישומי שעות')) {
                    this.showNotification('לא ניתן למחוק שירות עם רישומי שעות. שנה את הסטטוס ל-"ארכיון" במקום.', 'error');
                } else {
                    this.showNotification('שגיאה במחיקת השירות: ' + errorMsg, 'error');
                }
            }
        }

        /**
         * Escape HTML
         * בריחת תווי HTML
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * Truncate service name for badge display
         * קיצור שם שירות לתצוגה בבאדג'
         */
        truncateServiceName(name) {
            const maxLength = 20;
            if (name.length <= maxLength) {
                return name;
            }
            return name.substring(0, maxLength) + '...';
        }

        /**
         * Show loading indicator
         * הצגת אינדיקטור טעינה
         */
        showLoading(message = 'טוען...') {
            if (!window.showLoadingIndicator) {
                console.warn('Loading indicator not available');
                return;
            }
            window.showLoadingIndicator(message);
        }

        /**
         * Hide loading indicator
         * הסתרת אינדיקטור טעינה
         */
        hideLoading() {
            if (!window.hideLoadingIndicator) {
                console.warn('Loading indicator not available');
                return;
            }
            window.hideLoadingIndicator();
        }

        /**
         * Show notification
         * הצגת הודעה
         */
        showNotification(message, type = 'info') {
            if (window.NotificationsUI && typeof window.NotificationsUI.show === 'function') {
                window.NotificationsUI.show(message, type);
            } else {
                // Fallback to alert
                alert(message);
            }
        }

        // ===============================
        // Fee Agreements Functions - הסכמי שכר טרחה
        // ===============================

        /**
         * Render fee agreements list
         * רינדור רשימת הסכמי שכר טרחה
         */
        renderFeeAgreements() {
            const container = document.getElementById('feeAgreementsList');
            if (!container) {
return;
}

            const agreements = this.currentClient?.feeAgreements || [];

            if (agreements.length === 0) {
                container.innerHTML = `
                    <div class="fee-agreements-empty">
                        <div class="empty-state-icon">
                            <i class="fas fa-file-contract"></i>
                        </div>
                        <div class="empty-state-content">
                            <h4 class="empty-state-title">אין הסכמי שכר טרחה</h4>
                            <p class="empty-state-text">העלה הסכם שכר טרחה כדי להתחיל</p>
                            <button class="empty-state-btn" onclick="document.getElementById('uploadFeeAgreementBtn').click()">
                                <i class="fas fa-cloud-upload-alt"></i>
                                <span>העלאת הסכם</span>
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            const agreementsHTML = agreements.map(agreement => {
                const isPdf = agreement.fileType === 'application/pdf';
                const iconClass = isPdf ? 'pdf' : 'image';
                const icon = isPdf ? 'fa-file-pdf' : 'fa-file-image';

                // Format date
                let uploadDate = '-';
                if (agreement.uploadedAt) {
                    const date = agreement.uploadedAt.seconds
                        ? new Date(agreement.uploadedAt.seconds * 1000)
                        : new Date(agreement.uploadedAt);
                    uploadDate = date.toLocaleDateString('he-IL');
                }

                // Format file size
                const fileSize = this.formatFileSize(agreement.fileSize);

                return `
                    <div class="fee-agreement-item" data-agreement-id="${agreement.id}">
                        <div class="fee-agreement-info">
                            <div class="fee-agreement-icon ${iconClass}">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div class="fee-agreement-details">
                                <div class="fee-agreement-name" title="${this.escapeHtml(agreement.originalName || agreement.fileName)}">
                                    ${this.escapeHtml(agreement.originalName || agreement.fileName)}
                                </div>
                                <div class="fee-agreement-meta">
                                    <span><i class="fas fa-calendar-alt"></i> ${uploadDate}</span>
                                    <span><i class="fas fa-hdd"></i> ${fileSize}</span>
                                </div>
                            </div>
                        </div>
                        <div class="fee-agreement-actions">
                            <button class="fee-agreement-action-btn view" data-action="view" data-agreement-id="${agreement.id}" title="צפה בהסכם">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="fee-agreement-action-btn delete" data-action="delete" data-agreement-id="${agreement.id}" title="מחק הסכם">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = `
                ${agreementsHTML}
                <button class="fee-agreement-add-btn" onclick="document.getElementById('uploadFeeAgreementBtn').click()">
                    <i class="fas fa-plus"></i>
                    <span>הוסף הסכם נוסף</span>
                </button>
            `;

            // Attach action listeners
            this.attachFeeAgreementActionListeners();
        }

        /**
         * Setup fee agreement upload listeners
         * הגדרת מאזינים להעלאת הסכם
         */
        setupFeeAgreementListeners() {
            const uploadBtn = document.getElementById('uploadFeeAgreementBtn');
            const fileInput = document.getElementById('feeAgreementInput');

            if (!uploadBtn || !fileInput) {
return;
}

            // Remove existing listeners to prevent duplicates
            uploadBtn.replaceWith(uploadBtn.cloneNode(true));
            fileInput.replaceWith(fileInput.cloneNode(true));

            // Get fresh references
            const newUploadBtn = document.getElementById('uploadFeeAgreementBtn');
            const newFileInput = document.getElementById('feeAgreementInput');

            // Upload button click
            newUploadBtn.addEventListener('click', () => {
                newFileInput.click();
            });

            // File selected
            newFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.uploadFeeAgreement(file);
                }
                // Reset input
                newFileInput.value = '';
            });
        }

        /**
         * Attach fee agreement action listeners
         * חיבור מאזיני אירועים לפעולות הסכם
         */
        attachFeeAgreementActionListeners() {
            const container = document.getElementById('feeAgreementsList');
            if (!container) {
return;
}

            const actionButtons = container.querySelectorAll('[data-action]');
            actionButtons.forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const action = e.currentTarget.dataset.action;
                    const agreementId = e.currentTarget.dataset.agreementId;

                    if (action === 'view') {
                        this.viewFeeAgreement(agreementId);
                    } else if (action === 'delete') {
                        await this.deleteFeeAgreement(agreementId);
                    }
                });
            });
        }

        /**
         * Upload fee agreement
         * העלאת הסכם שכר טרחה
         */
        async uploadFeeAgreement(file) {
            // Validate file type
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                this.showNotification('סוג קובץ לא נתמך. יש להעלות PDF או תמונה', 'error');
                return;
            }

            // Validate file size (max 6MB)
            const maxSize = 6 * 1024 * 1024;
            if (file.size > maxSize) {
                this.showNotification('הקובץ גדול מדי. גודל מקסימלי: 6MB', 'error');
                return;
            }

            try {
                this.showLoading('מעלה הסכם...');

                // Convert file to base64
                const base64Data = await this.fileToBase64(file);

                // Call Cloud Function
                const uploadFeeAgreementFn = window.firebaseFunctions.httpsCallable('uploadFeeAgreement');
                const result = await uploadFeeAgreementFn({
                    clientId: this.currentClient.id,
                    fileName: file.name,
                    fileData: base64Data,
                    fileType: file.type,
                    fileSize: file.size
                });

                if (result.data.success) {
                    // Add to local state
                    if (!this.currentClient.feeAgreements) {
                        this.currentClient.feeAgreements = [];
                    }
                    this.currentClient.feeAgreements.push(result.data.agreement);

                    // Re-render
                    this.renderFeeAgreements();
                    this.renderClientInfo(); // עדכן את הכותרת כדי להסיר את תג האזהרה

                    this.hideLoading();
                    this.showNotification('ההסכם הועלה בהצלחה', 'success');

                    // Refresh parent data
                    if (window.ClientsDataManager && typeof window.ClientsDataManager.loadClients === 'function') {
                        await window.ClientsDataManager.loadClients();
                    }
                } else {
                    throw new Error(result.data.message || 'שגיאה בהעלאה');
                }

            } catch (error) {
                console.error('❌ Error uploading fee agreement:', error);
                this.hideLoading();
                this.showNotification(`שגיאה בהעלאת הסכם: ${error.message}`, 'error');
            }
        }

        /**
         * View fee agreement
         * צפייה בהסכם שכר טרחה
         */
        viewFeeAgreement(agreementId) {
            const agreement = this.currentClient?.feeAgreements?.find(a => a.id === agreementId);

            if (!agreement || !agreement.downloadUrl) {
                this.showNotification('לא ניתן לפתוח את ההסכם', 'error');
                return;
            }

            // Open in new tab
            window.open(agreement.downloadUrl, '_blank');
        }

        /**
         * Delete fee agreement
         * מחיקת הסכם שכר טרחה
         */
        async deleteFeeAgreement(agreementId) {
            const agreement = this.currentClient?.feeAgreements?.find(a => a.id === agreementId);

            if (!agreement) {
                this.showNotification('הסכם לא נמצא', 'error');
                return;
            }

            const confirmMessage = `האם למחוק את ההסכם "${agreement.originalName || agreement.fileName}"?\n\nשים לב: הפעולה בלתי הפיכה!`;

            if (!confirm(confirmMessage)) {
                return;
            }

            try {
                this.showLoading('מוחק הסכם...');

                // Call Cloud Function
                const deleteFeeAgreementFn = window.firebaseFunctions.httpsCallable('deleteFeeAgreement');
                const result = await deleteFeeAgreementFn({
                    clientId: this.currentClient.id,
                    agreementId: agreementId
                });

                if (result.data.success) {
                    // Remove from local state
                    this.currentClient.feeAgreements = this.currentClient.feeAgreements.filter(
                        a => a.id !== agreementId
                    );

                    // Re-render
                    this.renderFeeAgreements();
                    this.renderClientInfo(); // עדכן את הכותרת (אם זה היה ההסכם האחרון - יופיע תג אזהרה)

                    this.hideLoading();
                    this.showNotification('ההסכם נמחק בהצלחה', 'success');

                    // Refresh parent data
                    if (window.ClientsDataManager && typeof window.ClientsDataManager.loadClients === 'function') {
                        await window.ClientsDataManager.loadClients();
                    }
                } else {
                    throw new Error(result.data.message || 'שגיאה במחיקה');
                }

            } catch (error) {
                console.error('❌ Error deleting fee agreement:', error);
                this.hideLoading();
                this.showNotification(`שגיאה במחיקת הסכם: ${error.message}`, 'error');
            }
        }

        /**
         * Convert file to base64
         * המרת קובץ ל-base64
         */
        fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                    // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = error => reject(error);
            });
        }

        /**
         * Format file size
         * פורמט גודל קובץ
         */
        formatFileSize(bytes) {
            if (!bytes || bytes === 0) {
return '0 B';
}

            const units = ['B', 'KB', 'MB', 'GB'];
            let unitIndex = 0;
            let size = bytes;

            while (size >= 1024 && unitIndex < units.length - 1) {
                size /= 1024;
                unitIndex++;
            }

            return `${size.toFixed(1)} ${units[unitIndex]}`;
        }
    }

    // Export to global scope
    window.ClientManagementModal = new ClientManagementModal();

})();
