/**
 * Client Report Modal
 * מודל הפקת דוח ללקוח
 *
 * נוצר: 23/11/2025
 * גרסה: 1.0.0
 * Phase: 5 - Clients Management
 *
 * תפקיד: טיפול בממשק הפקת דוחות ללקוח
 */

(function() {
    'use strict';

    /**
     * ClientReportModal Class
     * מודל דוח לקוח
     */
    class ClientReportModal {
        constructor() {
            this.dataManager = null;
            this.currentClient = null;

            // DOM Elements
            this.modal = null;
            this.reportClientName = null;
            this.reportClientDetails = null;
            this.reportForm = null;
            this.startDateInput = null;
            this.endDateInput = null;
            this.serviceFilter = null;
            this.quickDateButtons = null;

            this.isInitialized = false;
        }

        /**
         * Initialize Modal
         * אתחול המודל
         */
        init() {
            try {
                console.log('🎨 ClientReportModal: Initializing...');

                // Wait for Data Manager
                if (!window.ClientsDataManager) {
                    console.error('❌ ClientsDataManager not found');
                    return false;
                }

                this.dataManager = window.ClientsDataManager;

                // Get DOM elements
                this.getDOMElements();

                // Setup event listeners
                this.setupEventListeners();

                this.isInitialized = true;

                console.log('✅ ClientReportModal: Initialized successfully');

                return true;

            } catch (error) {
                console.error('❌ ClientReportModal: Initialization error:', error);
                return false;
            }
        }

        /**
         * Get DOM elements
         * קבלת אלמנטים מה-DOM
         */
        getDOMElements() {
            this.modal = document.getElementById('clientReportModal');
            this.reportClientName = document.getElementById('reportClientName');
            this.reportClientRegistrationDate = document.getElementById('reportClientRegistrationDate');
            this.reportClientCaseNumber = document.getElementById('reportClientCaseNumber');
            this.reportForm = document.getElementById('reportForm');
            this.startDateInput = document.getElementById('reportStartDate');
            this.endDateInput = document.getElementById('reportEndDate');
            this.serviceCardsContainer = document.getElementById('reportServiceCards');
            this.selectedServiceInput = document.getElementById('reportSelectedService');
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEventListeners() {
            // Close button
            const closeBtn = document.getElementById('closeReportModal');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.close());
            }

            // Cancel button
            const cancelBtn = document.getElementById('cancelReportBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.close());
            }

            // Generate report button
            const generateBtn = document.getElementById('generateReportBtn');
            if (generateBtn) {
                generateBtn.addEventListener('click', () => this.generateReport());
            }

            // Email report button
            const emailBtn = document.getElementById('emailReportBtn');
            if (emailBtn) {
                emailBtn.addEventListener('click', () => this.generateAndEmailReport());
            }

            // Quick date buttons
            const quickButtons = document.querySelectorAll('.btn-quick-date');
            quickButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const range = e.target.getAttribute('data-range');
                    this.setQuickDateRange(range);
                });
            });

            // Close on background click
            if (this.modal) {
                this.modal.addEventListener('click', (e) => {
                    if (e.target === this.modal) {
                        this.close();
                    }
                });
            }

            // Prevent form submission
            if (this.reportForm) {
                this.reportForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                });
            }
        }

        /**
         * Open modal
         * פתיחת המודל
         */
        open(clientId) {
            if (!clientId) {
                console.error('❌ No client ID provided');
                return;
            }

            const client = this.dataManager.getClientById(clientId);
            if (!client) {
                console.error('❌ Client not found:', clientId);
                return;
            }

            this.currentClient = client;

            // Update client info
            this.updateClientInfo(client);

            // Populate service cards
            this.populateServiceCards(client);

            // Set default date range (this month)
            this.setQuickDateRange('thisMonth');

            // Show modal
            if (this.modal) {
                this.modal.style.display = 'flex';
            }

            console.log('📄 Opened report modal for:', client.fullName);
        }

        /**
         * Close modal
         * סגירת המודל
         */
        close() {
            if (this.modal) {
                this.modal.style.display = 'none';
            }

            this.currentClient = null;

            // Reset form
            if (this.reportForm) {
                this.reportForm.reset();
            }

            console.log('✖️ Closed report modal');
        }

        /**
         * Update client info
         * עדכון מידע לקוח
         */
        updateClientInfo(client) {
            // Debug log to see what we're getting
            console.log('📋 Client data received:', {
                fullName: client.fullName,
                caseNumber: client.caseNumber,
                createdAt: client.createdAt,
                registrationDate: client.registrationDate
            });

            if (this.reportClientName) {
                this.reportClientName.textContent = client.fullName;
            }

            // Registration date
            if (this.reportClientRegistrationDate) {
                let registrationDate = '-';
                if (client.createdAt) {
                    try {
                        // Handle Firebase timestamp
                        const date = client.createdAt.toDate ? client.createdAt.toDate() :
                                   client.createdAt.seconds ? new Date(client.createdAt.seconds * 1000) :
                                   new Date(client.createdAt);
                        registrationDate = date.toLocaleDateString('he-IL');
                    } catch (err) {
                        console.error('Error parsing createdAt:', err);
                    }
                } else if (client.registrationDate) {
                    try {
                        const date = new Date(client.registrationDate);
                        registrationDate = date.toLocaleDateString('he-IL');
                    } catch (err) {
                        console.error('Error parsing registrationDate:', err);
                    }
                }
                this.reportClientRegistrationDate.textContent = registrationDate;
            }

            // Case number
            if (this.reportClientCaseNumber) {
                this.reportClientCaseNumber.textContent = client.caseNumber || '-';
            }
        }

        /**
         * Populate services as cards
         * מילוי כרטיסיות שירותים
         */
        async populateServiceCards(client) {
            if (!this.serviceCardsContainer) {
return;
}

            // Clear existing cards
            this.serviceCardsContainer.innerHTML = '';
            this.selectedServiceInput.value = '';

            const servicesMap = new Map(); // Map to store service info

            console.log('🔍 Analyzing client data:', {
                clientName: client.fullName,
                services: client.services,
                type: client.type,
                procedureType: client.procedureType,
                hourlyPackage: client.hourlyPackage,
                legalProcedure: client.legalProcedure,
                stages: client.stages,
                allClientData: client
            });

            // Check if this is a legal procedure client
            const isLegalProcedure = client.procedureType === 'legal_procedure' ||
                                    client.type === 'legal_procedure' ||
                                    client.legalProcedure;

            // Check for legal procedure stages in various possible locations
            if (isLegalProcedure) {
                // Check for stages in various formats
                const possibleStages = ['stage_a', 'stage_b', 'stage_c', 'stageA', 'stageB', 'stageC', 'שלב_א', 'שלב_ב', 'שלב_ג'];

                possibleStages.forEach(stageName => {
                    // Check in client.stages
                    if (client.stages && client.stages[stageName]) {
                        const stageData = client.stages[stageName];
                        const displayName = this.getStageName(stageName);
                        const totalHours = stageData.hours || stageData.totalHours || stageData.allocatedHours || 0;

                        servicesMap.set(displayName, {
                            displayName: displayName,
                            totalHours: totalHours,
                            remainingHours: 0,
                            usedHours: 0,
                            type: 'legal_procedure',
                            stage: stageName,
                            status: stageData.status || 'active'
                        });

                        console.log(`📋 Found stage ${stageName} with ${totalHours} hours`);
                    }

                    // Check in client object directly
                    if (client[stageName]) {
                        const stageData = client[stageName];
                        const displayName = this.getStageName(stageName);
                        const totalHours = typeof stageData === 'object' ?
                            (stageData.hours || stageData.totalHours || stageData.allocatedHours || 0) :
                            (typeof stageData === 'number' ? stageData : 0);

                        if (totalHours > 0 && !servicesMap.has(displayName)) {
                            servicesMap.set(displayName, {
                                displayName: displayName,
                                totalHours: totalHours,
                                remainingHours: 0,
                                usedHours: 0,
                                type: 'legal_procedure',
                                stage: stageName,
                                status: 'active'
                            });

                            console.log(`📋 Found stage ${stageName} directly with ${totalHours} hours`);
                        }
                    }
                });
            }

            // Check for hour packages directly in client data
            if (client.hourlyPackage) {
                const packageData = client.hourlyPackage;
                const packageName = packageData.name || 'תוכנית שעות';
                const totalHours = packageData.hours || packageData.totalHours || packageData.allocatedHours || 0;

                if (totalHours > 0) {
                    servicesMap.set(packageName, {
                        displayName: packageName,
                        totalHours: totalHours,
                        remainingHours: 0,
                        usedHours: 0,
                        type: 'hours',
                        stage: null,
                        status: packageData.status || 'active'
                    });

                    console.log(`📦 Found hour package ${packageName} with ${totalHours} hours`);
                }
            }

            // Add services from client.services array
            if (client.services && client.services.length > 0) {
                client.services.forEach(service => {
                    // ✅ NEW ARCHITECTURE: Check if this is a legal procedure with stages array
                    if (service.type === 'legal_procedure' && service.stages && Array.isArray(service.stages)) {
                        // Legal procedure with multiple stages
                        service.stages.forEach(stage => {
                            // Only show active stages (or completed if needed)
                            if (stage.status === 'active' || stage.status === 'completed') {
                                const displayName = this.getStageName(stage.id);
                                const totalHours = stage.totalHours || stage.hours || 0;
                                const isCurrentStage = client.currentStage === stage.id;

                                // ✅ Calculate used hours from timesheet entries
                                let usedMinutes = 0;
                                if (window.ClientsDataManager) {
                                    const timesheetEntries = window.ClientsDataManager.getClientTimesheetEntries(client.fullName);
                                    timesheetEntries.forEach(entry => {
                                        // Match by stage ID or stage name
                                        const entryStage = entry.serviceId || entry.stageName;
                                        const entryDuration = entry.minutes || entry.duration || entry.hours || 0;

                                        if (entryStage === stage.id || entryStage === displayName) {
                                            if (typeof entryDuration === 'number') {
                                                usedMinutes += entryDuration;
                                            } else if (entry.hours) {
                                                usedMinutes += (entry.hours * 60);
                                            }
                                        }
                                    });
                                }

                                const usedHours = (usedMinutes / 60).toFixed(1);
                                const remainingHours = (totalHours - parseFloat(usedHours)).toFixed(1); // 🔥 Allow negative for overage

                                servicesMap.set(stage.id, {
                                    displayName: displayName,
                                    totalHours: totalHours,
                                    remainingHours: remainingHours,
                                    usedHours: usedHours,
                                    type: 'legal_procedure',
                                    stage: stage.id,
                                    status: stage.status,
                                    isCurrentStage: isCurrentStage,
                                    serviceName: service.name,
                                    serviceId: service.id
                                });

                                console.log(`📋 Legal procedure stage ${stage.id}:`, {
                                    name: displayName,
                                    totalHours: totalHours,
                                    usedHours: usedHours,
                                    remainingHours: remainingHours,
                                    status: stage.status,
                                    isCurrentStage: isCurrentStage
                                });
                            }
                        });
                        return; // Skip old logic for this service
                    }

                    // ✅ OLD ARCHITECTURE FALLBACK: Support old format
                    // Determine the service key and display name
                    let serviceKey = '';
                    let displayName = '';
                    let serviceType = 'hours'; // default
                    let stage = null;

                    if (service.serviceName) {
                        serviceKey = service.serviceName;
                        displayName = service.serviceName;
                        serviceType = 'hours';
                    } else if (service.name) {
                        serviceKey = service.name;
                        displayName = service.name;
                        serviceType = service.type || 'hours';
                    }

                    // Check if this is a legal procedure stage (OLD FORMAT)
                    if (service.stage || service.stageName) {
                        stage = service.stage || service.stageName;
                        displayName = this.getStageName(stage);
                        serviceType = 'legal_procedure';
                        serviceKey = displayName; // Use stage name as key
                    }

                    if (!serviceKey) {
return;
} // Skip if no valid key

                    // Calculate hours for this service/stage
                    let usedMinutes = 0;
                    let totalHours = 0;

                    // Get total hours based on type with extensive checking
                    if (serviceType === 'legal_procedure' && stage) {
                        // For legal procedures, check all possible hour fields
                        totalHours = service.hours ||
                                   service.totalHours ||
                                   service.stageHours ||
                                   service.maxHours ||
                                   service.allocatedHours ||
                                   service.budgetHours || 0;

                        console.log(`📊 Legal procedure stage ${stage}:`, {
                            hours: service.hours,
                            totalHours: service.totalHours,
                            stageHours: service.stageHours,
                            maxHours: service.maxHours,
                            allocatedHours: service.allocatedHours,
                            budgetHours: service.budgetHours,
                            finalTotal: totalHours
                        });
                    } else {
                        // For regular hour packages
                        totalHours = service.hours ||
                                   service.totalHours ||
                                   service.packageHours ||
                                   service.allocatedHours || 0;

                        console.log(`📦 Hour package ${displayName}:`, {
                            hours: service.hours,
                            totalHours: service.totalHours,
                            packageHours: service.packageHours,
                            allocatedHours: service.allocatedHours,
                            finalTotal: totalHours
                        });
                    }

                    // Calculate used hours from timesheet entries
                    if (window.ClientsDataManager) {
                        const timesheetEntries = window.ClientsDataManager.getClientTimesheetEntries(client.fullName);

                        console.log(`⏱️ Timesheet entries for ${client.fullName}:`, timesheetEntries);

                        timesheetEntries.forEach(entry => {
                            const entryService = entry.serviceName || entry.service || entry.stage;
                            // החשוב: minutes הוא השדה העיקרי במערכת שלכם!
                            const entryDuration = entry.minutes || entry.duration || entry.hours || 0;

                            console.log('  Checking entry:', {
                                service: entryService,
                                duration: entryDuration,
                                stage: entry.stage,
                                comparing_with: {
                                    serviceKey: serviceKey,
                                    displayName: displayName,
                                    stage: stage
                                }
                            });

                            // Match by service name or stage
                            if ((serviceType === 'legal_procedure' && entry.serviceId === stage) ||
                                (entryService === serviceKey) ||
                                (entryService === displayName)) {
                                // Handle different duration formats
                                if (typeof entryDuration === 'number') {
                                    usedMinutes += entryDuration;
                                } else if (entry.hours) {
                                    usedMinutes += (entry.hours * 60);
                                }
                                console.log(`    ✅ Matched! Added ${entryDuration} minutes. Total: ${usedMinutes}`);
                            }
                        });
                    }

                    const usedHours = (usedMinutes / 60).toFixed(1);
                    const remainingHours = (totalHours - parseFloat(usedHours)).toFixed(1); // 🔥 Allow negative for overage

                    servicesMap.set(serviceKey, {
                        displayName: displayName,
                        totalHours: totalHours,
                        remainingHours: remainingHours,
                        usedHours: usedHours,
                        type: serviceType,
                        stage: stage,
                        status: service.status || 'active'
                    });
                });
            }

            // Also check timesheet entries for services not in the services array
            if (window.ClientsDataManager) {
                const timesheetEntries = window.ClientsDataManager.getClientTimesheetEntries(client.fullName);
                timesheetEntries.forEach(entry => {
                    const serviceName = entry.serviceName || entry.service;
                    if (serviceName && serviceName !== '-' && serviceName !== 'לא מוגדר') {
                        // If not already in map, add it with unknown total hours
                        if (!servicesMap.has(serviceName)) {
                            // Calculate used hours for this service
                            let usedMinutes = 0;
                            timesheetEntries.forEach(e => {
                                const entryService = e.serviceName || e.service;
                                if (entryService === serviceName) {
                                    usedMinutes += (e.minutes || e.duration || 0);
                                }
                            });
                            const usedHours = (usedMinutes / 60).toFixed(1);

                            servicesMap.set(serviceName, {
                                totalHours: 0, // Unknown total
                                remainingHours: 0,
                                usedHours: usedHours
                            });
                        }
                    }
                });
            }

            // Recalculate hours for all services after collection
            if (servicesMap.size > 0) {
                let allTimesheetEntries = [];

                // Try different methods to get timesheet entries
                if (window.ClientsDataManager && window.ClientsDataManager.getClientTimesheetEntries) {
                    allTimesheetEntries = window.ClientsDataManager.getClientTimesheetEntries(client.fullName);
                    console.log('🔄 Got entries from ClientsDataManager.getClientTimesheetEntries');
                } else if (window.ClientsDataManager && window.ClientsDataManager.timesheetEntries) {
                    // Fallback: filter timesheet entries manually
                    allTimesheetEntries = window.ClientsDataManager.timesheetEntries.filter(entry =>
                        entry.clientName === client.fullName
                    );
                    console.log('🔄 Got entries from ClientsDataManager.timesheetEntries');
                } else if (client.timesheetEntries) {
                    // Fallback: check if client object has timesheet entries
                    allTimesheetEntries = client.timesheetEntries;
                    console.log('🔄 Got entries from client.timesheetEntries');
                }

                console.log(`🔄 Recalculating hours for all services. Total timesheet entries: ${allTimesheetEntries.length}`);

                // Log first few entries to understand structure
                if (allTimesheetEntries.length > 0) {
                    console.log('📝 Sample timesheet entries:', allTimesheetEntries.slice(0, 3));
                }

                servicesMap.forEach((serviceInfo, serviceKey) => {
                    let totalUsedMinutes = 0;

                    allTimesheetEntries.forEach(entry => {
                        const entryService = entry.serviceName || entry.service || entry.stage;
                        const entryDuration = entry.minutes || entry.duration || entry.hours || 0;

                        // Check if this entry matches this service
                        if (entryService === serviceKey ||
                            entryService === serviceInfo.displayName ||
                            (serviceInfo.stage && entry.serviceId === serviceInfo.stage)) {

                            if (typeof entryDuration === 'number') {
                                totalUsedMinutes += entryDuration;
                            } else if (entry.hours) {
                                totalUsedMinutes += (entry.hours * 60);
                            }
                        }
                    });

                    const recalcUsedHours = (totalUsedMinutes / 60).toFixed(1);
                    const recalcRemainingHours = Math.max(0, serviceInfo.totalHours - parseFloat(recalcUsedHours)).toFixed(1);

                    // Update the service info
                    serviceInfo.usedHours = recalcUsedHours;
                    serviceInfo.remainingHours = recalcRemainingHours;

                    console.log(`📊 Service: ${serviceKey}`, {
                        totalHours: serviceInfo.totalHours,
                        usedHours: recalcUsedHours,
                        remainingHours: recalcRemainingHours,
                        totalMinutes: totalUsedMinutes
                    });
                });
            }

            // ════════════════════════════════════════════════════════════════
            // 🎯 LEGAL PROCEDURE REPORT FIX: Auto-Select Active Stage Only
            // ════════════════════════════════════════════════════════════════
            //
            // BUSINESS REQUIREMENT:
            // - Client pays per stage (שלב א', שלב ב', etc.) as they progress
            // - Report should show ONLY the currently active stage hours
            // - NOT the sum of all stages (confusing and incorrect)
            //
            // TECHNICAL APPROACH:
            // - For legal procedures: Show ONLY stages with status='active'
            // - For hour packages: Show all services + "כל השירותים" option
            //
            // DATA MODEL:
            // - Each stage has: { status: 'active' | 'completed' | 'pending' }
            // - Only ONE stage should be 'active' at a time
            // - Reference: ClientManagementModal.js:356 uses same pattern
            //
            // IMPLEMENTATION:
            // 1. If legal procedure: Filter to show ONLY active stages
            // 2. If hour package: Show all + "כל השירותים" option
            //
            // WHY THIS APPROACH:
            // - Principle of Least Surprise: User sees what they're paying for NOW
            // - Data Integrity: Prevents summing unrelated stage budgets
            // - User requested: "רק בשלב א ולא סהכ" (only stage A, not total)
            // ════════════════════════════════════════════════════════════════

            if (isLegalProcedure) {
                // For legal procedures: Keep ONLY the active stage
                const activeStages = Array.from(servicesMap.entries()).filter(([key, service]) =>
                    service.status === 'active'
                );

                if (activeStages.length > 0) {
                    // Clear map and add only active stages
                    servicesMap.clear();
                    activeStages.forEach(([key, service]) => {
                        servicesMap.set(key, service);
                    });
                    console.log(`🎯 Legal procedure: Showing ${activeStages.length} active stage(s) only`);
                } else {
                    // Fallback: No active stage found, show all (shouldn't happen in production)
                    console.warn('⚠️ No active stage found for legal procedure client. Showing all stages as fallback.');
                }
            } else {
                // For hour package clients: Add "All Services" option
                if (servicesMap.size > 1) {
                    servicesMap.set('כל השירותים', {
                        displayName: 'כל השירותים',
                        totalHours: 0, // Will be calculated in report
                        remainingHours: 0,
                        usedHours: 0,
                        type: 'all',
                        stage: null,
                        status: 'active'
                    });
                    console.log('📋 Hour package: Added "All Services" option');
                }
            }

            // Create service cards with proper info
            Array.from(servicesMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([serviceKey, serviceInfo], index) => {
                const card = this.createServiceCard(serviceInfo, index);
                this.serviceCardsContainer.appendChild(card);
            });

            console.log(`📦 Found ${servicesMap.size} services for client ${client.fullName}`);
        }

        /**
         * Get stage display name
         * קבלת שם תצוגה לשלב
         */
        getStageName(stage) {
            const stageNames = {
                'stage_a': "הליך משפטי - שלב א'",
                'stage_b': "הליך משפטי - שלב ב'",
                'stage_c': "הליך משפטי - שלב ג'",
                'stageA': "הליך משפטי - שלב א'",
                'stageB': "הליך משפטי - שלב ב'",
                'stageC': "הליך משפטי - שלב ג'",
                'a': "הליך משפטי - שלב א'",
                'b': "הליך משפטי - שלב ב'",
                'c': "הליך משפטי - שלב ג'"
            };
            return stageNames[stage] || stage || 'הליך משפטי';
        }

        /**
         * Create service card with security
         * יצירת כרטיס שירות מאובטח
         */
        createServiceCard(serviceInfo, index) {
            const card = document.createElement('div');

            // Security: Use data attributes instead of inline onclick
            card.dataset.serviceName = serviceInfo.displayName;
            card.dataset.serviceIndex = index;
            card.dataset.serviceType = serviceInfo.type;

            // Calculate progress percentage
            const progressPercent = serviceInfo.totalHours > 0
                ? Math.round((parseFloat(serviceInfo.usedHours) / serviceInfo.totalHours) * 100)
                : 0;

            // Minimalist design - subtle grays with single accent
            let statusColor = '#64748b'; // Neutral gray
            let iconClass = 'fas fa-briefcase'; // Default icon
            let progressColor = '#e2e8f0'; // Light gray for progress
            let borderColor = '#e2e8f0'; // Default border
            let currentStageBadge = ''; // Badge for current stage

            if (serviceInfo.type === 'legal_procedure') {
                iconClass = 'fas fa-balance-scale'; // Legal icon
                statusColor = '#475569'; // Darker gray for legal procedures

                // ✅ Highlight current stage
                if (serviceInfo.isCurrentStage) {
                    borderColor = '#3b82f6'; // Blue border for current stage
                    currentStageBadge = '<span style="position: absolute; top: 0.5rem; right: 0.5rem; background: #3b82f6; color: white; font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 600;">שלב נוכחי</span>';
                }
            }

            // Use blue as default with color accents for critical states
            if (serviceInfo.totalHours > 0) {
                if (progressPercent >= 90) {
                    progressColor = '#ef4444'; // Red for critical
                    statusColor = '#dc2626'; // Red text
                } else if (progressPercent >= 75) {
                    progressColor = '#f97316'; // Orange for warning
                    statusColor = '#ea580c'; // Orange text
                } else {
                    progressColor = '#3b82f6'; // Blue - default color
                }
            } else {
                // For services without total hours, use light blue
                progressColor = '#60a5fa';
            }

            card.style.cssText = `
                border: 2px solid ${borderColor};
                border-radius: 6px;
                padding: 0.75rem;
                background: white;
                cursor: pointer;
                transition: all 0.15s ease;
                position: relative;
                min-height: 100px;
                ${serviceInfo.isCurrentStage ? 'box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);' : ''}
            `;

            // Create card content with textContent for security
            const cardInner = document.createElement('div');

            // Service name header
            const header = document.createElement('div');
            header.style.cssText = 'margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;';

            const leftSide = document.createElement('div');
            leftSide.style.cssText = 'display: flex; align-items: center;';

            const icon = document.createElement('i');
            icon.className = iconClass;
            icon.style.cssText = `color: ${statusColor}; margin-left: 0.4rem; font-size: 0.9rem;`;

            const title = document.createElement('h5');
            title.textContent = serviceInfo.displayName; // Security: textContent prevents XSS
            title.style.cssText = 'font-weight: 600; font-size: 0.85rem; margin: 0; display: inline-block;';

            leftSide.appendChild(icon);
            leftSide.appendChild(title);
            header.appendChild(leftSide);

            // ✅ Add current stage badge
            if (serviceInfo.isCurrentStage) {
                const badge = document.createElement('span');
                badge.textContent = 'שלב נוכחי';
                badge.style.cssText = 'background: #3b82f6; color: white; font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 600;';
                header.appendChild(badge);
            }

            // Progress bar
            const progressContainer = document.createElement('div');
            progressContainer.style.cssText = `
                background: #f1f5f9;
                height: 6px;
                border-radius: 3px;
                overflow: hidden;
                margin: 0.6rem 0;
            `;

            const progressBar = document.createElement('div');
            progressBar.style.cssText = `
                height: 100%;
                background: ${progressColor};
                width: ${progressPercent}%;
                transition: width 0.3s ease;
            `;
            progressContainer.appendChild(progressBar);

            // Hours info
            const infoContainer = document.createElement('div');
            infoContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem;';

            const hoursLeft = document.createElement('div');
            hoursLeft.style.cssText = `color: ${statusColor}; font-weight: 600; font-size: 0.75rem;`;

            const clockIcon = document.createElement('i');
            clockIcon.className = 'fas fa-clock';
            clockIcon.style.cssText = 'margin-left: 0.2rem; font-size: 0.65rem;';

            const hoursText = document.createElement('span');
            const hasOverage = parseFloat(serviceInfo.usedHours) > parseFloat(serviceInfo.totalHours);
            const overageText = hasOverage ? ' ⚠️ חריגה' : '';

            if (isFixedPrice) {
                // 🎯 Fixed Price: Show ONLY hours worked, NO total, NO overdraft warning
                hoursText.textContent = `עבדו ${serviceInfo.usedHours} שעות`;
            } else if (serviceInfo.type === 'legal_procedure') {
                // For legal procedures with hourly pricing, show stage-specific hours
                if (serviceInfo.totalHours > 0) {
                    hoursText.textContent = `${serviceInfo.usedHours} מתוך ${serviceInfo.totalHours} שעות בשלב${overageText}`;
                } else {
                    hoursText.textContent = `${serviceInfo.usedHours} שעות בשימוש בשלב`;
                }
            } else {
                // For regular hour packages
                if (serviceInfo.totalHours > 0) {
                    hoursText.textContent = `${serviceInfo.usedHours} מתוך ${serviceInfo.totalHours} שעות${overageText}`;
                } else {
                    hoursText.textContent = `${serviceInfo.usedHours} שעות בשימוש`;
                }
            }

            // 🔥 Change color if overage (but NOT for Fixed Price)
            if (hasOverage && !isFixedPrice) {
                hoursLeft.style.color = '#ef4444'; // Red
            }

            hoursLeft.appendChild(clockIcon);
            hoursLeft.appendChild(hoursText);

            const percentText = document.createElement('div');
            percentText.style.cssText = 'color: #64748b; font-size: 0.65rem;';
            percentText.textContent = serviceInfo.totalHours > 0 ? `${progressPercent}%` : '';

            infoContainer.appendChild(hoursLeft);
            // Show percentage ONLY for Hourly/Legal Procedure services, NOT for Fixed Price
            if (serviceInfo.totalHours > 0 && !isFixedPrice) {
                infoContainer.appendChild(percentText);
            }

            // 🎯 Overdraft Warning Box - ONLY for Hourly/Legal Procedure with negative hours
            const overdraftWarning = document.createElement('div');
            if (!isFixedPrice && hasOverage && serviceInfo.totalHours > 0) {
                const overdraftAmount = (parseFloat(serviceInfo.usedHours) - parseFloat(serviceInfo.totalHours)).toFixed(1);
                overdraftWarning.style.cssText = `
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    border-radius: 6px;
                    padding: 0.5rem 0.75rem;
                    margin-top: 0.6rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                `;

                const warningIcon = document.createElement('i');
                warningIcon.className = 'fas fa-exclamation-triangle';
                warningIcon.style.cssText = 'color: #ef4444; font-size: 0.85rem;';

                const warningText = document.createElement('span');
                warningText.style.cssText = 'color: #dc2626; font-size: 0.75rem; font-weight: 600;';
                warningText.textContent = `חריגה: +${overdraftAmount} שעות מעבר לתקציב`;

                overdraftWarning.appendChild(warningIcon);
                overdraftWarning.appendChild(warningText);
            } else {
                overdraftWarning.style.display = 'none';
            }

            // Selected indicator - minimal checkmark
            const selectedBadge = document.createElement('div');
            selectedBadge.className = 'selected-badge';
            selectedBadge.style.cssText = `
                position: absolute;
                top: 0.4rem;
                left: 0.4rem;
                background: #3b82f6;
                color: white;
                border-radius: 3px;
                width: 16px;
                height: 16px;
                display: none;
                align-items: center;
                justify-content: center;
            `;
            selectedBadge.innerHTML = '<i class="fas fa-check" style="font-size: 0.5rem;"></i>';

            // Assemble card
            cardInner.appendChild(header);
            cardInner.appendChild(progressContainer);
            cardInner.appendChild(infoContainer);
            cardInner.appendChild(overdraftWarning); // Add overdraft warning box
            card.appendChild(cardInner);
            card.appendChild(selectedBadge);

            // Add secure click handler
            card.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectServiceCard(card, serviceInfo.displayName);
            });

            // Add subtle hover effect
            card.addEventListener('mouseenter', () => {
                if (!card.classList.contains('selected')) {
                    card.style.borderColor = '#cbd5e1';
                    card.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                }
            });

            card.addEventListener('mouseleave', () => {
                if (!card.classList.contains('selected')) {
                    card.style.borderColor = '#e2e8f0';
                    card.style.boxShadow = 'none';
                }
            });

            return card;
        }

        /**
         * Select service card
         * בחירת כרטיס שירות
         */
        selectServiceCard(card, serviceName) {
            // Remove selection from all cards
            const allCards = this.serviceCardsContainer.querySelectorAll('div[data-service-name]');
            allCards.forEach(c => {
                c.classList.remove('selected');
                c.style.borderColor = '#e5e7eb';
                c.style.backgroundColor = 'white';
                const badge = c.querySelector('.selected-badge');
                if (badge) {
badge.style.display = 'none';
}
            });

            // Mark this card as selected with subtle styling
            card.classList.add('selected');
            card.style.borderColor = '#94a3b8';
            card.style.backgroundColor = '#f8fafc';
            const badge = card.querySelector('.selected-badge');
            if (badge) {
badge.style.display = 'flex';
}

            // Update hidden input with sanitized value
            this.selectedServiceInput.value = this.sanitizeInput(serviceName);

            console.log('✅ Selected service:', serviceName);
        }

        /**
         * Sanitize input to prevent XSS
         * ניקוי קלט למניעת XSS
         */
        sanitizeInput(input) {
            if (!input) {
return '';
}
            return input.toString()
                .replace(/[<>]/g, '') // Remove angle brackets
                .replace(/javascript:/gi, '') // Remove javascript: protocol
                .replace(/on\w+=/gi, '') // Remove event handlers
                .trim();
        }

        /**
         * Set quick date range
         * הגדרת טווח תאריכים מהיר
         */
        setQuickDateRange(range) {
            const now = new Date();
            let startDate, endDate;

            switch (range) {
                case 'thisMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = now;
                    break;

                case 'lastMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                    break;

                case 'last3Months':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                    endDate = now;
                    break;

                case 'thisYear':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = now;
                    break;

                case 'all':
                    // Set to client creation date or 1 year ago
                    const clientCreated = this.currentClient?.createdAt?.toDate?.() || new Date(now.getFullYear() - 1, 0, 1);
                    startDate = clientCreated;
                    endDate = now;
                    break;

                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = now;
            }

            // Set input values
            if (this.startDateInput) {
                this.startDateInput.value = this.formatDateForInput(startDate);
            }

            if (this.endDateInput) {
                this.endDateInput.value = this.formatDateForInput(endDate);
            }
        }

        /**
         * Format date for input
         * עיצוב תאריך לשדה קלט
         */
        formatDateForInput(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        /**
         * Get form data
         * קבלת נתוני הטופס
         */
        getFormData() {
            // Report type is always 'hours' in the new design
            const reportType = document.querySelector('input[name="reportType"]')?.value || 'hours';
            const reportFormat = document.querySelector('input[name="reportFormat"]:checked')?.value || 'pdf';

            return {
                clientId: this.currentClient.id,
                clientName: this.currentClient.fullName,
                startDate: this.startDateInput?.value,
                endDate: this.endDateInput?.value,
                service: this.selectedServiceInput?.value || '',
                reportType,
                reportFormat
            };
        }

        /**
         * Validate form
         * אימות טופס
         */
        validateForm(formData) {
            // Check if service is selected (required in new design)
            if (!formData.service || formData.service === '') {
                // גלול לקטע השירותים והדגש אותו
                if (this.serviceCardsContainer) {
                    this.serviceCardsContainer.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });

                    // הדגש זמנית את הקטע
                    this.serviceCardsContainer.style.outline = '2px solid #ef4444';
                    this.serviceCardsContainer.style.outlineOffset = '4px';
                    this.serviceCardsContainer.style.borderRadius = '8px';

                    setTimeout(() => {
                        this.serviceCardsContainer.style.outline = '';
                        this.serviceCardsContainer.style.outlineOffset = '';
                    }, 2000);
                }

                if (window.notify) {
                    window.notify.error('נא לבחור שירות', 'שגיאה');
                } else {
                    alert('נא לבחור שירות');
                }
                return false;
            }

            if (!formData.startDate || !formData.endDate) {
                // גלול לקטע התאריכים
                if (this.startDateInput) {
                    this.startDateInput.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }

                if (window.notify) {
                    window.notify.error('נא לבחור תקופה', 'שגיאה');
                } else {
                    alert('נא לבחור תקופה');
                }
                return false;
            }

            const start = new Date(formData.startDate);
            const end = new Date(formData.endDate);

            if (start > end) {
                // גלול לקטע התאריכים
                if (this.startDateInput) {
                    this.startDateInput.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }

                if (window.notify) {
                    window.notify.error('תאריך התחלה חייב להיות לפני תאריך סיום', 'שגיאה');
                } else {
                    alert('תאריך התחלה חייב להיות לפני תאריך סיום');
                }
                return false;
            }

            return true;
        }

        /**
         * Generate report
         * הפקת דוח
         */
        async generateReport() {
            console.log('📄 Generating report...');

            const formData = this.getFormData();

            if (!this.validateForm(formData)) {
                return;
            }

            // Check if ReportGenerator exists
            if (!window.ReportGenerator) {
                console.error('❌ ReportGenerator not loaded');
                if (window.notify) {
                    window.notify.error('מערכת הדוחות לא נטענה', 'שגיאה');
                } else {
                    alert('מערכת הדוחות לא נטענה');
                }
                return;
            }

            try {
                // Show loading
                this.showLoading();

                // Generate report
                await window.ReportGenerator.generate(formData);

                // Close modal
                this.close();

                // Hide loading
                this.hideLoading();

                if (window.notify) {
                    window.notify.success('הדוח הופק בהצלחה', 'הצלחה');
                }

            } catch (error) {
                console.error('❌ Error generating report:', error);

                this.hideLoading();

                if (window.notify) {
                    window.notify.error('שגיאה בהפקת הדוח: ' + error.message, 'שגיאה');
                } else {
                    alert('שגיאה בהפקת הדוח');
                }
            }
        }

        /**
         * Generate and email report
         * הפקה ושליחת דוח במייל
         */
        async generateAndEmailReport() {
            console.log('📧 Generating and emailing report...');

            const formData = this.getFormData();

            if (!this.validateForm(formData)) {
                return;
            }

            // Check if ReportGenerator exists
            if (!window.ReportGenerator) {
                console.error('❌ ReportGenerator not loaded');
                if (window.notify) {
                    window.notify.error('מערכת הדוחות לא נטענה', 'שגיאה');
                } else {
                    alert('מערכת הדוחות לא נטענה');
                }
                return;
            }

            try {
                // Show loading
                this.showLoading();

                // Generate and email report
                await window.ReportGenerator.generateAndEmail(formData);

                // Close modal
                this.close();

                // Hide loading
                this.hideLoading();

                if (window.notify) {
                    window.notify.success('הדוח נשלח בהצלחה ללקוח', 'הצלחה');
                }

            } catch (error) {
                console.error('❌ Error emailing report:', error);

                this.hideLoading();

                if (window.notify) {
                    window.notify.error('שגיאה בשליחת הדוח: ' + error.message, 'שגיאה');
                } else {
                    alert('שגיאה בשליחת הדוח');
                }
            }
        }

        /**
         * Show loading
         * הצגת טעינה
         */
        showLoading() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'flex';
            }
        }

        /**
         * Hide loading
         * הסתרת טעינה
         */
        hideLoading() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
        }
    }

    // Create global instance
    const clientReportModal = new ClientReportModal();

    // Make available globally
    window.ClientReportModal = clientReportModal;

    // Export for ES6 modules (if needed)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = clientReportModal;
    }

})();
