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

            // ESC key to close
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.modalElement.style.display !== 'none') {
                    this.close();
                }
            });

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
        }

        /**
         * Render client info header
         * רינדור כותרת מידע לקוח
         */
        renderClientInfo() {
            if (!this.currentClient) {
return;
}

            const client = this.currentClient;
            const createdDate = client.createdAt
                ? new Date(client.createdAt.seconds * 1000).toLocaleDateString('he-IL')
                : '-';

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
                        <span>נפתח: ${createdDate}</span>
                    </div>
                    <div class="management-client-meta-item">
                        <i class="fas fa-briefcase"></i>
                        <span>${activeServices} מתוך ${totalServices} שירותים פעילים</span>
                    </div>
                </div>
            `;
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
                    const price = parseFloat(document.getElementById('fixedPrice').value) || 0;

                    newService.description = description;
                    newService.price = price;
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
                    updateData.totalHours = totalHoursFromAllServices;
                    updateData.hoursRemaining = totalRemainingFromAllServices;
                    updateData.minutesRemaining = Math.round(totalRemainingFromAllServices * 60);
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
            const hoursServices = this.currentClient.services.filter(s => s.serviceType === 'hours');

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
                const db = window.firebaseApp.firestore();
                const clientRef = db.collection('clients').doc(this.currentClient.id);

                await clientRef.update({
                    status: newStatus,
                    isBlocked: newIsBlocked,
                    isCritical: newIsCritical,
                    updatedAt: new Date().toISOString()
                });

                // Update local state
                this.currentClient.status = newStatus;
                this.currentClient.isBlocked = newIsBlocked;
                this.currentClient.isCritical = newIsCritical;

                // Re-render client info
                this.renderClientInfo();

                this.hideLoading();
                this.showNotification(`הסטטוס שונה ל-"${statusText}"`, 'success');

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
                const db = window.firebaseApp.firestore();
                const clientRef = db.collection('clients').doc(this.currentClient.id);

                // Complete all active services
                const updatedServices = this.currentClient.services.map(service => {
                    if (service.status !== 'completed') {
                        return {
                            ...service,
                            status: 'completed',
                            completedAt: new Date().toISOString()
                        };
                    }
                    return service;
                });

                // Update client to inactive and archived
                await clientRef.update({
                    status: 'inactive',
                    isArchived: true,
                    archivedAt: new Date().toISOString(),
                    services: updatedServices,
                    updatedAt: new Date().toISOString()
                });

                // Update local state
                this.currentClient.status = 'inactive';
                this.currentClient.isArchived = true;
                this.currentClient.services = updatedServices;

                // Re-render
                this.renderClientInfo();
                this.renderServices();

                this.hideLoading();
                this.showNotification('התיק נסגר והועבר לארכיון', 'success');

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
                this.showNotification('שגיאה בסגירת תיק: ' + error.message, 'error');
            }
        }

        /**
         * Calculate total hours from all services
         * חישוב סך השעות מכל השירותים
         */
        calculateTotalHoursFromServices(services) {
            return services.reduce((sum, service) => {
                if (service.serviceType === 'hours') {
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
                if (service.serviceType === 'hours') {
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
                // Show loading
                this.showLoading('מוסיף שעות...');

                // Get Firestore instance
                const db = window.firebaseApp.firestore();

                // Update service hours
                const clientRef = db.collection('clients').doc(this.currentClient.id);
                const updatedServices = this.currentClient.services.map(s => {
                    if (s.id === service.id) {
                        const currentTotal = s.totalHours || 0;
                        const currentRemaining = s.hoursRemaining || 0;

                        return {
                            ...s,
                            totalHours: currentTotal + hours,
                            hoursRemaining: currentRemaining + hours,
                            lastRenewalDate: new Date().toISOString(),
                            renewalHistory: [
                                ...(s.renewalHistory || []),
                                {
                                    date: new Date().toISOString(),
                                    hours: hours,
                                    addedBy: window.currentUser?.email || 'admin'
                                }
                            ]
                        };
                    }
                    return s;
                });

                // ✅ Calculate totals from all services for backward compatibility
                const totalHoursFromAllServices = this.calculateTotalHoursFromServices(updatedServices);
                const totalRemainingFromAllServices = this.calculateRemainingHoursFromServices(updatedServices);

                await clientRef.update({
                    services: updatedServices,
                    // ✅ Sync direct fields for User Interface compatibility
                    totalHours: totalHoursFromAllServices,
                    hoursRemaining: totalRemainingFromAllServices,
                    minutesRemaining: Math.round(totalRemainingFromAllServices * 60),
                    type: 'hours', // Ensure client type is set
                    updatedAt: new Date().toISOString()
                });

                // Update local data
                this.currentClient.services = updatedServices;
                this.currentClient.totalHours = totalHoursFromAllServices;
                this.currentClient.hoursRemaining = totalRemainingFromAllServices;
                this.currentClient.minutesRemaining = Math.round(totalRemainingFromAllServices * 60);

                // Re-render services
                this.renderServices();

                // Show success message
                this.hideLoading();
                this.showNotification(`נוספו ${hours} שעות בהצלחה`, 'success');

                // Refresh data in parent component
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
                // Show loading
                this.showLoading('מעדכן שלב...');

                // Get Firestore instance
                const db = window.firebaseApp.firestore();

                // Update stages
                const clientRef = db.collection('clients').doc(this.currentClient.id);
                const updatedServices = this.currentClient.services.map(s => {
                    if (s.id === service.id) {
                        const updatedStages = s.stages.map((stage, index) => {
                            if (index === activeStageIndex) {
                                // Mark current stage as completed
                                return {
                                    ...stage,
                                    status: 'completed',
                                    completedAt: new Date().toISOString()
                                };
                            } else if (index === activeStageIndex + 1) {
                                // Mark next stage as active
                                return {
                                    ...stage,
                                    status: 'active',
                                    startedAt: new Date().toISOString()
                                };
                            }
                            return stage;
                        });

                        return {
                            ...s,
                            stages: updatedStages
                        };
                    }
                    return s;
                });

                // ✅ FIX BUG #1: Update currentStage field
                const updateData = {
                    services: updatedServices,
                    updatedAt: new Date().toISOString()
                };

                // If this client has a currentStage field (legal_procedure), update it
                if (this.currentClient.procedureType === 'legal_procedure' || this.currentClient.type === 'legal_procedure') {
                    updateData.currentStage = nextStage.id;
                }

                await clientRef.update(updateData);

                // Update local data
                this.currentClient.services = updatedServices;
                if (updateData.currentStage) {
                    this.currentClient.currentStage = updateData.currentStage;
                }

                // Re-render services
                this.renderServices();

                // Show success message
                this.hideLoading();
                this.showNotification(`עברת לשלב "${nextStage.name}"`, 'success');

                // Refresh data in parent component
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
                // Show loading
                this.showLoading('מסמן כהושלם...');

                // Get Firestore instance
                const db = window.firebaseApp.firestore();

                // Update service status
                const clientRef = db.collection('clients').doc(this.currentClient.id);
                const updatedServices = this.currentClient.services.map(s => {
                    if (s.id === service.id) {
                        return {
                            ...s,
                            status: 'completed',
                            completedAt: new Date().toISOString()
                        };
                    }
                    return s;
                });

                await clientRef.update({
                    services: updatedServices,
                    updatedAt: new Date().toISOString()
                });

                // Update local data
                this.currentClient.services = updatedServices;

                // Re-render services
                this.renderServices();

                // Show success message
                this.hideLoading();
                this.showNotification('השירות סומן כהושלם', 'success');

                // Refresh data in parent component
                if (window.ClientsDataManager && typeof window.ClientsDataManager.loadClients === 'function') {
                    await window.ClientsDataManager.loadClients();
                }

            } catch (error) {
                console.error('❌ Error completing service:', error);
                this.hideLoading();
                this.showNotification('שגיאה בסימון השירות: ' + error.message, 'error');
            }
        }

        async deleteService(service) {
            if (!confirm(`האם למחוק את השירות "${service.serviceName}"?\n\nשים לב: הפעולה בלתי הפיכה!`)) {
                return;
            }

            try {
                // Show loading
                this.showLoading('מוחק שירות...');

                // Get Firestore instance
                const db = window.firebaseApp.firestore();

                // Delete service from client's services array
                const clientRef = db.collection('clients').doc(this.currentClient.id);
                const updatedServices = this.currentClient.services.filter(s => s.id !== service.id);

                await clientRef.update({
                    services: updatedServices,
                    updatedAt: new Date().toISOString()
                });

                // Update local data
                this.currentClient.services = updatedServices;

                // Re-render services
                this.renderServices();

                // Show success message
                this.hideLoading();
                this.showNotification('השירות נמחק בהצלחה', 'success');

                // Refresh data in parent component
                if (window.ClientsDataManager && typeof window.ClientsDataManager.loadClients === 'function') {
                    await window.ClientsDataManager.loadClients();
                }

            } catch (error) {
                console.error('❌ Error deleting service:', error);
                this.hideLoading();
                this.showNotification('שגיאה במחיקת השירות: ' + error.message, 'error');
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
