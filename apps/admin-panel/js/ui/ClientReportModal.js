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

            // Set default date range ('all' = since case-open date) so the FULL client
            // history is visible by default. Was 'thisMonth', which hid older entries
            // and made staff think older time logs were "missing".
            this.setQuickDateRange('all');

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

                                // PR-REPORT-SSOT (2026-07-23): read the stored aggregate directly,
                                // mirroring functions/src/modules/aggregation/index.js (~line 170):
                                // fixed-price stages maintain totalHoursWorked; hourly stages maintain
                                // hoursUsed. The prior client-side timesheet recompute (removed) read 0
                                // silently whenever that array failed to load or an entry lacked
                                // serviceId - see ClientsDataManager.loadTimesheetEntries / warnIfTruncated.
                                const usedHours = (stage.pricingType === 'fixed'
                                    ? (stage.totalHoursWorked || 0)
                                    : (stage.hoursUsed || 0)).toFixed(1);

                                servicesMap.set(stage.id, {
                                    displayName: displayName,
                                    totalHours: totalHours,
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
                    // PR-G.3.13 (2026-05-27): usedMinutes recomputation removed.
                    // service.hoursUsed is SSOT per SYSTEM_STATUS.md:251-254 +
                    // functions/shared/aggregates.js:43-73. Prior name-matching recalc was
                    // unreliable when service.name is undefined (e.g. legacy serviceName-only docs).
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

                    // PR-G.3.13: read SSOT hoursUsed / hoursRemaining directly from the service doc.
                    // functions/shared/aggregates.js maintains these values transactionally on every
                    // timesheet write — UI MUST NOT recompute (recompute was failing for services
                    // with undefined `name`, and was masking overdraft via Math.max(0, …) clamp).
                    const usedHoursNumeric = parseFloat(service.hoursUsed) || 0;
                    const usedHours = usedHoursNumeric.toFixed(1);
                    const remainingHours = (
                        typeof service.hoursRemaining === 'number'
                            ? service.hoursRemaining
                            : (totalHours - usedHoursNumeric) // 🔥 Allow negative for overage
                    ).toFixed(1);

                    servicesMap.set(serviceKey, {
                        displayName: displayName,
                        totalHours: totalHours,
                        remainingHours: remainingHours,
                        usedHours: usedHours,
                        type: serviceType,
                        stage: stage,
                        serviceId: service.id,
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

            // PR-G.3.13 (2026-05-27): UI-side timesheet recalc REMOVED.
            //
            // Previously this block walked timesheet entries and matched them to services by
            // `entry.serviceName === serviceKey || === displayName` — which silently produced
            // usedHours = 0 whenever the service had no `name` field (only legacy `serviceName`).
            // It also CLAMPED hoursRemaining with `Math.max(0, …)`, hiding overdraft.
            //
            // Both fields are now read directly from `service.hoursUsed` / `service.hoursRemaining`
            // at populate time (see OLD ARCHITECTURE FALLBACK above). `functions/shared/aggregates.js`
            // is the SSOT and updates these fields transactionally on every timesheet write.
            // See SYSTEM_STATUS.md:251-254.

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
            // Legacy format mapping to canonical stage IDs
            const legacyMap = {
                'stageA': 'stage_a', 'stageB': 'stage_b', 'stageC': 'stage_c',
                'a': 'stage_a', 'b': 'stage_b', 'c': 'stage_c'
            };
            const canonicalId = legacyMap[stage] || stage;
            const baseName = window.SystemConstantsHelpers?.getStageName?.(canonicalId);
            if (baseName && baseName !== canonicalId) {
                return 'הליך משפטי - ' + baseName;
            }
            return stage || 'הליך משפטי';
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
            // PR-A.4.1 (2026-05-16): use canonical isFixedService check.
            // BUG fixed: prior `pricingType === 'fixed'` only matched legal_procedure+fixed
            // and missed plain `type === 'fixed'` services (e.g. שירות קבוע / "פתיחת חברת יחיד").
            // Result was the badge falling through to "שעות" + clock icon, despite the
            // Client Management modal correctly showing "מחיר קבוע".
            // Canonical check mirrors functions/shared/aggregates.js:isFixedService.
            const isLegalProcedure = serviceInfo.type === 'legal_procedure';
            const isFixedPrice = (window.ClientTypeDisplay && window.ClientTypeDisplay.isFixedService)
                ? window.ClientTypeDisplay.isFixedService(serviceInfo)
                : (serviceInfo.type === 'fixed' ||
                    (serviceInfo.type === 'legal_procedure' && serviceInfo.pricingType === 'fixed'));
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
            card.dataset.serviceId = serviceInfo.serviceId || serviceInfo.stage || '';
            card.dataset.stage = serviceInfo.stage || '';
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

            // Badge priority order: service-status > resolved > overdraft > pricing-type > current-stage
            //
            // PR-G.3.13 (2026-05-27): archived/completed badge added — parity with
            // ClientManagementModal.js:479-487 getServiceStatusBadge. Service-level status
            // (archived/completed) is the highest-priority visual marker because it tells staff
            // the service is closed; overdraft/resolved are secondary to that fact.

            // 0. Service status badge (archived/completed) — highest priority for non-active services
            if (serviceInfo.status === 'archived') {
                const badge = document.createElement('div');
                badge.className = 'report-card-badge archived';
                badge.innerHTML = '<i class="fas fa-archive"></i> בארכיון';
                badgesContainer.appendChild(badge);
            } else if (serviceInfo.status === 'completed') {
                const badge = document.createElement('div');
                badge.className = 'report-card-badge completed';
                badge.innerHTML = '<i class="fas fa-lock"></i> הושלם';
                badgesContainer.appendChild(badge);
            }

            // 1. Status badges (overdraft / resolved)
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
            this.selectedServiceInput.dataset.stage = card.dataset.stage || '';

            console.log('✅ Selected service:', serviceName, '| serviceId:', card.dataset.serviceId, '| stage:', card.dataset.stage);
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
                    const clientCreated =
                        this.currentClient?.caseOpenDate?.toDate?.() ||
                        this.currentClient?.createdAt?.toDate?.() ||
                        new Date(now.getFullYear() - 1, 0, 1);
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
                stage: this.selectedServiceInput?.dataset.stage || '',
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
        /**
         * Show timesheet preview — delegated to ReportPreview (extracted in PR-U3).
         * Kept on ClientReportModal so the #generateReportBtn handler keeps resolving.
         */
        showTimesheetPreview() {
            return window.ReportPreview.showTimesheetPreview();
        }

        /**
         * Close preview — delegated to ReportPreview (extracted PR-U3).
         */
        closePreview() {
            return window.ReportPreview.closePreview();
        }

        /**
         * Proceed to generate report — delegated to ReportPreview (extracted PR-U3).
         */
        proceedToGenerateReport() {
            return window.ReportPreview.proceedToGenerateReport();
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
         * Open edit-entry modal — delegated to ReportPreview (extracted PR-U3).
         * ReportGenerator.editTimesheetEntry still calls this on ClientReportModal.
         */
        openEditTimesheetModal(entryData) {
            return window.ReportPreview.openEditModal(entryData);
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
