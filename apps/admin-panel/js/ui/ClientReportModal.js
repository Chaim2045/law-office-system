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

            // Event listeners tracking for cleanup
            this.eventListeners = [];

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
                generateBtn.addEventListener('click', () => this.showTimesheetPreview());
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

            // Cleanup event listeners to prevent memory leak
            this.eventListeners.forEach(({ element, event, handler }) => {
                if (element) {
                    element.removeEventListener(event, handler);
                }
            });
            this.eventListeners = [];

            console.log('✖️ Closed report modal (cleaned up event listeners)');
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
                            status: stageData.status || 'active',
                            pricingType: client.pricingType || stageData.pricingType || (totalHours > 0 ? 'hourly' : 'fixed')
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
                                status: 'active',
                                pricingType: client.pricingType || (typeof stageData === 'object' ? stageData.pricingType : null) || (totalHours > 0 ? 'hourly' : 'fixed')
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
                                    serviceId: service.id,
                                    pricingType: service.pricingType || client.pricingType || (totalHours > 0 ? 'hourly' : 'fixed')
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
                        status: service.status || 'active',
                        pricingType: service.pricingType || (serviceType === 'legal_procedure' && totalHours > 0 ? 'hourly' : service.pricingType || null)
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
            }

            // 🚫 REMOVED "All Services" option as per user request
            // Previously: Added "כל השירותים" option for hour package clients
            // Reason for removal: User requested to remove this feature entirely

            console.log(`📦 DEBUG: servicesMap size = ${servicesMap.size}`);
            console.log('📦 DEBUG: servicesMap contents:', Array.from(servicesMap.entries()));

            // Create service cards with proper info
            if (servicesMap.size === 0) {
                console.error('❌ ERROR: servicesMap is EMPTY! No service cards will be created!');
                console.error('Client data:', {
                    fullName: client.fullName,
                    type: client.type,
                    services: client.services,
                    hasServices: client.services?.length > 0
                });
            }

            Array.from(servicesMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([serviceKey, serviceInfo], index) => {
                console.log(`📋 Creating card ${index + 1}:`, { serviceKey, serviceInfo });
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
        /**
         * Create service card - Soft Minimal Design
         * יצירת כרטיס שירות - עיצוב מינימליסטי רך
         *
         * Uses CSS classes from report-service-cards.css (no inline styles!)
         */
        createServiceCard(serviceInfo, index) {
            // 🎯 Validate and sanitize data
            const usedHours = parseFloat(serviceInfo.usedHours) || 0;
            const totalHours = parseFloat(serviceInfo.totalHours) || 0;

            // 🎯 Detect service type and pricing
            const isLegalProcedure = serviceInfo.type === 'legal_procedure';
            const isFixedPrice = serviceInfo.pricingType === 'fixed';
            const isHourlyBased = !isFixedPrice; // שעתי או הליך משפטי שעתי

            const hasOverdraft = serviceInfo.overdraftResolved?.isResolved !== true &&
                                usedHours > totalHours && totalHours > 0;

            // Calculate progress percentage
            const progressPercent = totalHours > 0
                ? Math.round((usedHours / totalHours) * 100)
                : 0;

            // ═══════════════════════════════════════
            // CARD CONTAINER
            // ═══════════════════════════════════════
            const card = document.createElement('div');
            card.className = 'report-service-card';

            // Add variant classes
            if (isFixedPrice) {
card.classList.add('fixed');
}
            if (hasOverdraft) {
card.classList.add('overdraft');
}
            if (serviceInfo.overdraftResolved?.isResolved) {
card.classList.add('resolved');
}

            // Data attributes for selection
            card.dataset.serviceName = serviceInfo.displayName;
            card.dataset.serviceId = serviceInfo.stage || serviceInfo.serviceKey;
            card.dataset.serviceIndex = index;
            card.dataset.serviceType = serviceInfo.type;

            // ═══════════════════════════════════════
            // CARD HEADER
            // ═══════════════════════════════════════
            const header = document.createElement('div');
            header.className = 'report-card-header';

            const mainSection = document.createElement('div');
            mainSection.className = 'report-card-main';

            const cardName = document.createElement('div');
            cardName.className = 'report-card-name';
            cardName.textContent = serviceInfo.displayName;

            const cardMeta = document.createElement('div');
            cardMeta.className = 'report-card-meta';

            // Determine service description
            let serviceDescription = '';
            if (isLegalProcedure && isFixedPrice) {
                serviceDescription = 'הליך משפטי • פיקס';
            } else if (isLegalProcedure && isHourlyBased) {
                serviceDescription = 'הליך משפטי • שעתי';
            } else if (isFixedPrice) {
                serviceDescription = 'תמחור פיקס';
            } else {
                serviceDescription = 'שירות שעות';
            }

            // Build cardMeta safely (preventing XSS)
            const icon = document.createElement('i');
            icon.className = 'fas fa-circle';
            const span = document.createElement('span');
            span.textContent = serviceDescription;
            cardMeta.appendChild(icon);
            cardMeta.appendChild(span);

            mainSection.appendChild(cardName);
            mainSection.appendChild(cardMeta);
            header.appendChild(mainSection);

            // ═══════════════════════════════════════
            // BADGES
            // ═══════════════════════════════════════
            // Create badges container
            const badgesContainer = document.createElement('div');
            badgesContainer.style.display = 'flex';
            badgesContainer.style.gap = '0.5rem';
            badgesContainer.style.flexWrap = 'wrap';

            // Badge priority order: resolved > overdraft > pricing-type > current-stage

            // 1. Status badges (highest priority)
            if (serviceInfo.overdraftResolved?.isResolved) {
                const badge = document.createElement('div');
                badge.className = 'report-card-badge resolved';
                badge.textContent = 'הוסדר';
                badgesContainer.appendChild(badge);
            } else if (hasOverdraft) {
                const badge = document.createElement('div');
                badge.className = 'report-card-badge overdraft';
                badge.textContent = 'חריגה';
                badgesContainer.appendChild(badge);
            }

            // 2. Pricing type badge (ALWAYS show - this is critical info!)
            const pricingBadge = document.createElement('div');
            if (isLegalProcedure && isFixedPrice) {
                pricingBadge.className = 'report-card-badge fixed';
                pricingBadge.innerHTML = '<i class="fas fa-gavel"></i> פיקס';
            } else if (isLegalProcedure && isHourlyBased) {
                pricingBadge.className = 'report-card-badge legal-hourly';
                pricingBadge.innerHTML = '<i class="fas fa-gavel"></i> שעתי';
            } else if (isFixedPrice) {
                pricingBadge.className = 'report-card-badge fixed';
                pricingBadge.innerHTML = '<i class="fas fa-dollar-sign"></i> פיקס';
            } else {
                pricingBadge.className = 'report-card-badge hours';
                pricingBadge.innerHTML = '<i class="fas fa-clock"></i> שעות';
            }
            badgesContainer.appendChild(pricingBadge);

            // 3. Current stage indicator (lowest priority)
            if (serviceInfo.isCurrentStage && !hasOverdraft && !serviceInfo.overdraftResolved?.isResolved) {
                const badge = document.createElement('div');
                badge.className = 'report-card-badge current-stage';
                badge.textContent = 'שלב נוכחי';
                badgesContainer.appendChild(badge);
            }

            header.appendChild(badgesContainer);

            card.appendChild(header);

            // ═══════════════════════════════════════
            // TIME TRACKER (Fixed Price Only)
            // ═══════════════════════════════════════
            if (isFixedPrice) {
                const timeTracker = document.createElement('div');
                timeTracker.className = 'report-card-time-tracker';

                const trackerHeader = document.createElement('div');
                trackerHeader.className = 'report-card-time-tracker-header';
                trackerHeader.innerHTML = `
                    <div class="report-card-time-tracker-icon">
                        <i class="fas fa-stopwatch"></i>
                    </div>
                    <div class="report-card-time-tracker-label">מעקב זמן</div>
                `;

                const trackerValue = document.createElement('div');
                trackerValue.className = 'report-card-time-tracker-value';
                trackerValue.innerHTML = `
                    <div class="report-card-time-tracker-hours">${usedHours.toFixed(1)}</div>
                    <div class="report-card-time-tracker-unit">שעות עבודה</div>
                `;

                timeTracker.appendChild(trackerHeader);
                timeTracker.appendChild(trackerValue);
                card.appendChild(timeTracker);
            }

            // ═══════════════════════════════════════
            // STATS GRID (For non-fixed pricing)
            // ═══════════════════════════════════════
            if (!isFixedPrice) {
                const stats = document.createElement('div');
                stats.className = 'report-card-stats';

                const statTotal = document.createElement('div');
                statTotal.className = 'report-card-stat';
                statTotal.innerHTML = `
                    <div class="report-card-stat-label">סה״כ שעות</div>
                    <div class="report-card-stat-value">
                        ${totalHours.toFixed(1)}<span class="report-card-stat-unit">שע׳</span>
                    </div>
                `;

                const statUsed = document.createElement('div');
                statUsed.className = 'report-card-stat';
                statUsed.innerHTML = `
                    <div class="report-card-stat-label">בשימוש</div>
                    <div class="report-card-stat-value">
                        ${usedHours.toFixed(1)}<span class="report-card-stat-unit">שע׳</span>
                    </div>
                `;

                const remaining = totalHours - usedHours;
                const statRemaining = document.createElement('div');
                statRemaining.className = 'report-card-stat';
                statRemaining.innerHTML = `
                    <div class="report-card-stat-label">${hasOverdraft ? 'חריגה' : 'נותר'}</div>
                    <div class="report-card-stat-value">
                        ${Math.abs(remaining).toFixed(1)}<span class="report-card-stat-unit">שע׳</span>
                    </div>
                `;

                stats.appendChild(statTotal);
                stats.appendChild(statUsed);
                stats.appendChild(statRemaining);
                card.appendChild(stats);
            }

            // ═══════════════════════════════════════
            // PROGRESS BAR (For non-fixed pricing)
            // ═══════════════════════════════════════
            if (!isFixedPrice) {
                const progress = document.createElement('div');
                progress.className = 'report-card-progress';

                const progressHeader = document.createElement('div');
                progressHeader.className = 'report-card-progress-header';
                progressHeader.innerHTML = `
                    <div class="report-card-progress-label">התקדמות</div>
                    <div class="report-card-progress-value">${progressPercent}%</div>
                `;

                const progressTrack = document.createElement('div');
                progressTrack.className = 'report-card-progress-track';

                const progressBar = document.createElement('div');
                progressBar.className = 'report-card-progress-bar';
                progressBar.style.width = `${Math.min(progressPercent, 100)}%`;

                progressTrack.appendChild(progressBar);
                progress.appendChild(progressHeader);
                progress.appendChild(progressTrack);
                card.appendChild(progress);
            }

            // ═══════════════════════════════════════
            // SELECTION INDICATOR
            // ═══════════════════════════════════════
            const selectedIndicator = document.createElement('div');
            selectedIndicator.className = 'report-card-selected-indicator';
            selectedIndicator.innerHTML = '<i class="fas fa-check"></i>';
            card.appendChild(selectedIndicator);

            // ═══════════════════════════════════════
            // EVENT HANDLERS
            // ═══════════════════════════════════════
            const clickHandler = (e) => {
                e.preventDefault();
                this.selectServiceCard(card, serviceInfo.displayName);
            };
            card.addEventListener('click', clickHandler);

            // Track listener for cleanup
            this.eventListeners.push({
                element: card,
                event: 'click',
                handler: clickHandler
            });

            return card;
        }

        /**
         * Select service card
         * בחירת כרטיס שירות
         */
        selectServiceCard(card, serviceName) {
            // Remove selection from all cards (using CSS class only)
            const allCards = this.serviceCardsContainer.querySelectorAll('.report-service-card');
            allCards.forEach(c => {
                c.classList.remove('selected');
            });

            // Mark this card as selected (CSS will handle styling)
            card.classList.add('selected');

            // Update hidden input with sanitized value
            this.selectedServiceInput.value = this.sanitizeInput(serviceName);
            this.selectedServiceInput.dataset.serviceId = card.dataset.serviceId || '';

            console.log('✅ Selected service:', serviceName, '| serviceId:', card.dataset.serviceId);
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

            // Update active state on buttons
            const quickButtons = document.querySelectorAll('.btn-quick-date');
            quickButtons.forEach(btn => {
                const btnRange = btn.getAttribute('data-range');
                if (btnRange === range) {
                    // Add active class
                    btn.classList.add('active');
                    btn.style.background = '#1877F2';
                    btn.style.color = 'white';
                    btn.style.fontWeight = '600';
                } else {
                    // Remove active class
                    btn.classList.remove('active');
                    btn.style.background = '';
                    btn.style.color = '';
                    btn.style.fontWeight = '';
                }
            });
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
                serviceId: this.selectedServiceInput?.dataset.serviceId || '',
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
         * Escape HTML to prevent XSS
         * מניעת XSS על ידי escape של HTML
         */
        escapeHtml(text) {
            if (!text) {
return '';
}
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * Show timesheet preview with edit options
         * הצגת תצוגה מקדימה של רשומות שעתון עם אפשרות עריכה
         */
        async showTimesheetPreview() {
            console.log('👁️ Showing timesheet preview...');

            const formData = this.getFormData();
            console.log('📋 Form data:', formData);

            if (!this.validateForm(formData)) {
                console.log('❌ Form validation failed');
                return;
            }

            try {
                this.showLoading('טוען נתונים...');
                console.log('⏳ Loading data...');

                // Fetch data for preview
                const reportData = await window.ReportGenerator.fetchReportData(formData);
                console.log('✅ Data fetched:', reportData);

                this.hideLoading();

                if (!reportData || !reportData.timesheetEntries || reportData.timesheetEntries.length === 0) {
                    console.log('⚠️ No timesheet entries found');
                    alert('לא נמצאו רשומות שעתון לתקופה זו');
                    return;
                }

                console.log('🎨 Rendering preview modal...');
                // Show preview modal
                this.renderTimesheetPreviewModal(reportData, formData);
                console.log('✅ Preview modal rendered');

            } catch (error) {
                console.error('❌ Error showing preview:', error);
                this.hideLoading();
                alert('שגיאה בטעינת הנתונים: ' + error.message);
            }
        }

        /**
         * Render timesheet preview modal
         * רינדור מודל תצוגה מקדימה
         */
        renderTimesheetPreviewModal(reportData, formData) {
            console.log('🎨 renderTimesheetPreviewModal - reportData:', reportData);
            const { client, timesheetEntries } = reportData;
            console.log('👤 Client from reportData:', client);

            // Get client name - support both 'name' and 'fullName' fields
            const clientName = client?.name || client?.fullName || this.currentClient?.name || this.currentClient?.fullName || 'לקוח';
            console.log('📝 Client name to display:', clientName);

            // Close the report modal first
            this.close();

            // Store data for later use
            this.previewData = { reportData, formData };

            // Build table HTML with side panel approach
            const tableHTML = `
                <div class="modal-overlay modal-show" id="timesheetPreviewOverlay" style="display: flex; z-index: 10001; background: rgba(0,0,0,0.5);">
                    <div style="position: fixed; right: 0; top: 0; height: 100%; width: 600px; max-width: 90%; background: white; box-shadow: -2px 0 10px rgba(0,0,0,0.1); display: flex; flex-direction: column;">
                        <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid #e5e7eb; flex-shrink: 0;">
                            <h2 style="margin: 0; font-size: 1.25rem;"><i class="fas fa-list-alt"></i> תצוגה מקדימה - ${clientName}</h2>
                            <button class="close-btn" onclick="window.ClientReportModal.closePreview()" style="position: absolute; left: 1rem; top: 1.5rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                            <p style="margin-bottom: 1rem; color: #666; padding: 0.75rem; background: #f0f7ff; border-radius: 4px; border-right: 3px solid #1877F2;">
                                <i class="fas fa-info-circle"></i>
                                ניתן לערוך כל רשומה לפני הפקת הדוח הסופי
                            </p>
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                                        <th style="padding: 10px 8px; text-align: right; font-size: 0.85rem;">תאריך</th>
                                        <th style="padding: 10px 8px; text-align: right; font-size: 0.85rem;">תיאור</th>
                                        <th style="padding: 10px 8px; text-align: right; font-size: 0.85rem;">דקות</th>
                                        <th style="padding: 10px 8px; text-align: center; font-size: 0.85rem; width: 70px;">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody id="preview-tbody">
                                </tbody>
                            </table>
                        </div>
                        <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; gap: 1rem; flex-shrink: 0;">
                            <button class="btn btn-secondary" onclick="window.ClientReportModal.closePreview()">
                                ביטול
                            </button>
                            <button class="btn btn-primary" onclick="window.ClientReportModal.proceedToGenerateReport()">
                                <i class="fas fa-file-pdf"></i> המשך להפקת דוח
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Add to DOM
            document.body.insertAdjacentHTML('beforeend', tableHTML);

            // Now add rows dynamically to avoid string escaping issues
            const tbody = document.getElementById('preview-tbody');
            timesheetEntries.forEach((entry, index) => {
                const action = entry.action || entry.taskDescription || entry.description || '-';
                const minutes = entry.minutes || 0;

                // Create row
                const row = document.createElement('tr');
                row.style.borderBottom = '1px solid #e5e7eb';

                // Create cells safely using textContent (no XSS)
                const dateCell = document.createElement('td');
                dateCell.style.cssText = 'padding: 10px 8px; font-size: 0.85rem;';
                dateCell.textContent = this.formatDate(entry.date);

                const actionCell = document.createElement('td');
                actionCell.style.cssText = 'padding: 10px 8px; font-size: 0.85rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
                actionCell.textContent = action;
                actionCell.title = action; // Safe - browser handles escaping

                const minutesCell = document.createElement('td');
                minutesCell.style.cssText = 'padding: 10px 8px; font-size: 0.85rem;';
                minutesCell.textContent = String(minutes);

                const actionsCell = document.createElement('td');
                actionsCell.style.cssText = 'padding: 10px 8px; text-align: center;';

                const editBtn = document.createElement('button');
                editBtn.className = 'btn-edit-entry';
                editBtn.style.cssText = 'background: #1877F2; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;';
                editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                editBtn.addEventListener('click', () => {
                    this.editEntryFromPreview(
                        entry.id,
                        entry.employee,
                        formData.clientId,
                        action,
                        entry.date,
                        minutes
                    );
                });

                actionsCell.appendChild(editBtn);
                row.appendChild(dateCell);
                row.appendChild(actionCell);
                row.appendChild(minutesCell);
                row.appendChild(actionsCell);

                tbody.appendChild(row);
            });
        }

        /**
         * Close preview panel
         * סגירת פאנל תצוגה מקדימה
         */
        closePreview() {
            const overlay = document.getElementById('timesheetPreviewOverlay');
            if (overlay) {
                overlay.remove();
            }
            // Re-open report modal
            this.open(this.currentClient);
        }

        /**
         * Edit entry from preview
         * עריכת רשומה מתצוגה מקדימה
         */
        editEntryFromPreview(entryId, employeeId, clientId, action, date, minutes) {
            const employeeName = this.dataManager.getEmployeeName(employeeId);

            this.openEditTimesheetModal({
                id: entryId,
                employee: employeeId,
                employeeName: employeeName,
                clientId: clientId,
                action: action,
                date: this.formatDate(date),
                minutes: minutes
            });
        }

        /**
         * Proceed to generate report after preview
         * המשך להפקת דוח אחרי תצוגה מקדימה
         */
        async proceedToGenerateReport() {
            console.log('🚀 Proceeding to generate report...');

            // Get form data from stored preview data
            if (!this.previewData || !this.previewData.formData) {
                console.error('❌ No preview data found');
                alert('שגיאה: נתוני תצוגה מקדימה לא נמצאו');
                return;
            }

            const formData = this.previewData.formData;

            // Close preview modal
            const previewOverlay = document.getElementById('timesheetPreviewOverlay');
            if (previewOverlay) {
                previewOverlay.remove();
            }

            // Check if ReportGenerator exists
            if (!window.ReportGenerator) {
                console.error('❌ ReportGenerator not loaded');
                alert('מערכת הדוחות לא נטענה');
                return;
            }

            try {
                // Show loading
                this.showLoading('מפיק דוח...');

                // Generate report using stored formData
                await window.ReportGenerator.generate(formData);

                // Hide loading
                this.hideLoading();

                if (window.notify) {
                    window.notify.success('הדוח הופק בהצלחה', 'הצלחה');
                }

            } catch (error) {
                console.error('❌ Error generating report:', error);
                this.hideLoading();
                alert('שגיאה בהפקת הדוח: ' + error.message);
            }
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

        /**
         * Show save spinner on button
         * הצגת ספינר על כפתור השמירה
         */
        showSaveSpinner() {
            const btn = document.getElementById('saveTimesheetBtn');
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.7';
                btn.style.cursor = 'not-allowed';
                btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-left: 6px;"></i> שומר...';
            }
        }

        /**
         * Show success toast notification
         * הצגת הודעת הצלחה
         */
        showSuccessToast(message) {
            this.showToast(message, 'success');
        }

        /**
         * Show error toast notification
         * הצגת הודעת שגיאה
         */
        showErrorToast(message) {
            this.showToast(message, 'error');
        }

        /**
         * Show warning toast notification
         * הצגת הודעת אזהרה
         */
        showWarningToast(message) {
            this.showToast(message, 'warning');
        }

        /**
         * Show toast notification
         * הצגת הודעת טוסט
         */
        showToast(message, type = 'success') {
            // Remove existing toast if any
            const existingToast = document.getElementById('successToast');
            if (existingToast) {
                existingToast.remove();
            }

            // Configure colors based on type
            let gradient, icon, duration;
            switch (type) {
                case 'success':
                    gradient = 'linear-gradient(to right, #10b981, #059669)';
                    icon = 'fa-check';
                    duration = 3000;
                    break;
                case 'error':
                    gradient = 'linear-gradient(to right, #ef4444, #dc2626)';
                    icon = 'fa-exclamation-triangle';
                    duration = 4000;
                    break;
                case 'warning':
                    gradient = 'linear-gradient(to right, #f59e0b, #d97706)';
                    icon = 'fa-exclamation-circle';
                    duration = 3500;
                    break;
                default:
                    gradient = 'linear-gradient(to right, #3b82f6, #2563eb)';
                    icon = 'fa-info-circle';
                    duration = 3000;
            }

            // Create toast HTML
            const toastHTML = `
                <div id="successToast" style="
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    background: ${gradient};
                    color: white;
                    padding: 16px 20px;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1);
                    z-index: 10003;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 14px;
                    font-weight: 500;
                    min-width: 280px;
                    max-width: 400px;
                    animation: slideInRight 0.3s ease-out;
                ">
                    <div style="
                        width: 32px;
                        height: 32px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    ">
                        <i class="fas ${icon}" style="font-size: 16px;"></i>
                    </div>
                    <span style="flex: 1;">${message}</span>
                </div>
                <style>
                    @keyframes slideInRight {
                        from {
                            transform: translateX(400px);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                    @keyframes slideOutRight {
                        from {
                            transform: translateX(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateX(400px);
                            opacity: 0;
                        }
                    }
                </style>
            `;

            // Add to body
            document.body.insertAdjacentHTML('beforeend', toastHTML);

            // Auto remove after duration
            setTimeout(() => {
                const toast = document.getElementById('successToast');
                if (toast) {
                    toast.style.animation = 'slideOutRight 0.3s ease-in';
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
        }

        /**
         * Open edit timesheet entry modal
         * פתיחת מודל עריכת רשומת שעתון
         */
        openEditTimesheetModal(entryData) {
            console.log('🖊️ Opening edit timesheet modal:', entryData);

            // Remove any existing edit modal first
            const existingModal = document.getElementById('editTimesheetOverlay');
            if (existingModal) {
                existingModal.remove();
            }

            // Create modal HTML with modern clean design
            const modalHTML = `
                <div class="modal-overlay modal-show" id="editTimesheetOverlay" style="display: flex; z-index: 10002;">
                    <div class="modal-content" style="max-width: 520px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);">
                        <div class="modal-header" style="border-bottom: 1px solid #e5e7eb; padding: 16px 20px; background: linear-gradient(to bottom, #ffffff, #f9fafb);">
                            <h2 style="font-size: 17px; font-weight: 600; color: #1f2937; margin: 0; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-edit" style="color: #3b82f6; font-size: 16px;"></i>
                                עריכת רשומת שעתון
                            </h2>
                            <button class="close-btn" id="closeEditModalBtn" style="width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: #f3f4f6; border: none; cursor: pointer; transition: all 0.2s;">
                                <i class="fas fa-times" style="color: #6b7280; font-size: 14px;"></i>
                            </button>
                        </div>
                        <div class="modal-body" style="padding: 18px 20px 16px 20px; background: #ffffff;">
                            <!-- תאריך ועובד בשורה אחת -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div class="form-group" style="margin: 0;">
                                    <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                                        <i class="fas fa-calendar" style="color: #6b7280; width: 14px; font-size: 12px;"></i>
                                        תאריך
                                    </label>
                                    <input type="text" id="editEntryDate" value="${this.escapeHtml(entryData.date)}" disabled class="form-control" style="background: #f9fafb; color: #6b7280; cursor: not-allowed; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; font-size: 13px; width: 100%;">
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                                        <i class="fas fa-user" style="color: #6b7280; width: 14px; font-size: 12px;"></i>
                                        עובד
                                    </label>
                                    <input type="text" id="editEntryEmployee" value="${this.escapeHtml(entryData.employeeName)}" disabled class="form-control" style="background: #f9fafb; color: #6b7280; cursor: not-allowed; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; font-size: 13px; width: 100%;">
                                </div>
                            </div>

                            <!-- דקות -->
                            <div class="form-group" style="margin-bottom: 12px;">
                                <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                                    <i class="fas fa-clock" style="color: #3b82f6; width: 14px; font-size: 12px;"></i>
                                    דקות
                                </label>
                                <input type="number" id="editEntryMinutes" value="${entryData.minutes}" class="form-control" min="1" style="border: 2px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; font-size: 14px; transition: all 0.2s; font-weight: 500; width: 120px;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';">
                            </div>

                            <!-- תיאור הפעולה -->
                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                                    <i class="fas fa-file-alt" style="color: #3b82f6; width: 14px; font-size: 12px;"></i>
                                    תיאור הפעולה
                                </label>
                                <textarea id="editEntryAction" class="form-control" rows="3" placeholder="תיאור הפעולה..." style="border: 2px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; font-size: 13px; line-height: 1.4; resize: vertical; height: 70px; max-height: 200px; transition: all 0.2s; font-family: inherit; width: 100%;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer" style="border-top: 1px solid #e5e7eb; padding: 14px 20px; background: #f9fafb; display: flex; gap: 10px; justify-content: flex-end;">
                            <button class="btn btn-secondary" id="cancelEditTimesheetBtn" style="padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 500; border: 1px solid #d1d5db; background: white; color: #374151; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f3f4f6';" onmouseout="this.style.background='white';">
                                <i class="fas fa-times" style="margin-left: 6px; font-size: 12px;"></i>
                                ביטול
                            </button>
                            <button class="btn btn-primary" id="saveTimesheetBtn" style="padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 500; border: none; background: linear-gradient(to bottom, #3b82f6, #2563eb); color: white; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(59, 130, 246, 0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(59, 130, 246, 0.2)';">
                                <i class="fas fa-save" style="margin-left: 6px; font-size: 12px;"></i>
                                שמור שינויים
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Add to body
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Set textarea value safely using textContent (prevents XSS)
            const textarea = document.getElementById('editEntryAction');
            if (textarea) {
                textarea.value = entryData.action || '';
            }

            // Add event listeners securely (prevents XSS from inline onclick)
            const closeModalBtn = document.getElementById('closeEditModalBtn');
            const cancelBtn = document.getElementById('cancelEditTimesheetBtn');
            const saveBtn = document.getElementById('saveTimesheetBtn');

            const closeHandler = () => {
                const modal = document.getElementById('editTimesheetOverlay');
                if (modal) {
modal.remove();
}
            };

            const saveHandler = () => {
                this.saveTimesheetEdit(entryData.id, entryData.employee, entryData.clientId);
            };

            if (closeModalBtn) {
closeModalBtn.addEventListener('click', closeHandler);
}
            if (cancelBtn) {
cancelBtn.addEventListener('click', closeHandler);
}
            if (saveBtn) {
saveBtn.addEventListener('click', saveHandler);
}

            // Track for cleanup
            this.eventListeners.push(
                { element: closeModalBtn, event: 'click', handler: closeHandler },
                { element: cancelBtn, event: 'click', handler: closeHandler },
                { element: saveBtn, event: 'click', handler: saveHandler }
            );
        }

        /**
         * Save timesheet entry edit
         * שמירת עריכת רשומת שעתון
         */
        async saveTimesheetEdit(entryId, employeeId, clientId) {
            try {
                console.log('💾 Saving timesheet edit:', { entryId, employeeId, clientId });

                // Get values
                const minutes = parseInt(document.getElementById('editEntryMinutes').value);
                const action = document.getElementById('editEntryAction').value.trim();

                // Validate
                if (!action || action.length < 3) {
                    this.showWarningToast('תיאור הפעולה חייב להכיל לפחות 3 תווים');
                    return;
                }

                if (!minutes || minutes < 1) {
                    this.showWarningToast('מספר דקות חייב להיות לפחות 1');
                    return;
                }

                // Show spinner on save button
                this.showSaveSpinner();

                // Get current entry for audit trail
                const entryDoc = await firebase.firestore()
                    .collection('timesheet_entries')
                    .doc(entryId)
                    .get();

                if (!entryDoc.exists) {
                    throw new Error('רשומת שעתון לא נמצאה');
                }

                const currentEntry = entryDoc.data();

                // Prepare edit history (without server timestamp - will be added by Cloud Function)
                const editHistory = currentEntry.editHistory || [];
                const newEdit = {
                    editedBy: firebase.auth().currentUser.uid,
                    editedAt: new Date().toISOString(), // Use ISO string instead of server timestamp
                    oldAction: currentEntry.action || currentEntry.taskDescription || currentEntry.description || '',
                    newAction: action,
                    oldMinutes: currentEntry.minutes,
                    newMinutes: minutes
                };
                editHistory.push(newEdit);

                console.log('📤 Sending update to Cloud Function:', {
                    entryId,
                    minutes,
                    action,
                    editHistoryLength: editHistory.length,
                    note: 'minutesDiff will be calculated on server'
                });

                // Call Cloud Function (server will calculate minutesDiff)
                const updateTimesheetEntry = firebase.functions().httpsCallable('updateTimesheetEntry');
                const result = await updateTimesheetEntry({
                    entryId: entryId,
                    date: currentEntry.date,
                    minutes: minutes,
                    // minutesDiff removed - server calculates it
                    action: action,
                    editHistory: editHistory,
                    taskId: currentEntry.taskId || null,
                    autoGenerated: currentEntry.autoGenerated || false,
                    clientId: currentEntry.clientId || clientId || null,
                    serviceId: currentEntry.serviceId || currentEntry.service || null
                });

                console.log('📥 Response from Cloud Function:', result);

                console.log('✅ Timesheet entry updated:', result.data);

                // Close edit modal
                const editModal = document.getElementById('editTimesheetOverlay');
                if (editModal) {
                    editModal.remove();
                }

                // Show success toast
                this.showSuccessToast('השינויים נשמרו בהצלחה!');

                // Refresh preview if it's open
                const previewOverlay = document.getElementById('timesheetPreviewOverlay');
                if (previewOverlay && this.previewData) {
                    console.log('🔄 Refreshing preview...');
                    // Re-show preview with updated data
                    setTimeout(async () => {
                        // Close old preview
                        previewOverlay.remove();
                        // Fetch fresh data and show new preview
                        try {
                            const reportData = await window.ReportGenerator.fetchReportData(this.previewData.formData);
                            this.renderTimesheetPreviewModal(reportData, this.previewData.formData);
                        } catch (error) {
                            console.error('❌ Error refreshing preview:', error);
                        }
                    }, 300);
                }

            } catch (error) {
                console.error('❌ Error saving timesheet edit:', error);

                // Re-enable button
                const btn = document.getElementById('saveTimesheetBtn');
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                    btn.innerHTML = '<i class="fas fa-save" style="margin-left: 6px;"></i> שמור שינויים';
                }

                // Show error toast
                this.showErrorToast('שגיאה בשמירת השינויים: ' + error.message);
            }
        }

        /**
         * Format date for display
         * פורמט תאריך לתצוגה
         */
        formatDate(date) {
            if (!date) {
return '-';
}

            // Handle Firestore Timestamp
            if (date.toDate && typeof date.toDate === 'function') {
                date = date.toDate();
            }

            // Handle string dates
            if (typeof date === 'string') {
                date = new Date(date);
            }

            // Handle Date objects
            if (date instanceof Date) {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            }

            return '-';
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
