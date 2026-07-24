/**
 * Clients Data Manager
 * מנהל טעינת וניהול נתוני לקוחות
 *
 * נוצר: 23/11/2025
 * גרסה: 1.0.0
 * Phase: 5 - Clients Management
 *
 * תפקיד: טעינה, סינון, וניהול נתוני לקוחות מ-Firestore
 */

(function() {
    'use strict';

    /**
     * ClientsDataManager Class
     * מנהל נתוני לקוחות
     */
    class ClientsDataManager {
        constructor() {
            this.db = null;
            this.clients = [];
            this.filteredClients = [];
            this.timesheetEntries = [];
            this.budgetTasks = [];
            this.employees = [];

            // PR-REPORT-SSOT (2026-07-23): visibility flags for a failed
            // timesheet/budget-tasks load. A failed load leaves the array empty
            // and used to produce no error anywhere - every entry-derived number
            // (e.g. stage "used hours" in ClientReportModal) then silently read 0
            // as if it were genuinely zero. See loadTimesheetEntries/loadBudgetTasks.
            this.timesheetLoadFailed = false;
            this.budgetTasksLoadFailed = false;

            // Filters
            this.searchTerm = '';
            this.statusFilter = 'all';
            this.typeFilter = 'all';
            this.agreementFilter = 'all'; // פילטר הסכמי שכר טרחה
            this.sortBy = 'name';
            this.sortOrder = 'asc';

            // Pagination
            this.currentPage = 1;
            this.itemsPerPage = 20;

            // State
            this.isLoading = false;
            this.lastUpdated = null;

            // Real-time listeners
            this.clientsListener = null;
        }

        /**
         * Initialize Data Manager
         * אתחול מנהל הנתונים
         */
        async init() {
            try {
                console.log('🔄 ClientsDataManager: Initializing...');

                // Get Firestore instance
                if (!window.firebaseApp || !window.firebaseApp.firestore) {
                    throw new Error('Firestore not initialized');
                }

                this.db = window.firebaseApp.firestore();

                // Load all data
                await this.loadAllData();

                // ✅ Setup real-time listeners for automatic updates
                this.setupRealtimeListeners();

                console.log('✅ ClientsDataManager: Initialized successfully');
                console.log(`📊 Loaded ${this.clients.length} clients`);
                console.log('👂 Real-time listeners active');

                return { success: true };

            } catch (error) {
                console.error('❌ ClientsDataManager: Initialization error:', error);
                return { success: false, error: error.message };
            }
        }

        /**
         * Load all data
         * טעינת כל הנתונים
         */
        async loadAllData() {
            this.isLoading = true;
            this.showLoadingIndicator();

            try {
                // Load in parallel for better performance
                const [clientsResult, employeesResult, timesheetResult, tasksResult] = await Promise.all([
                    this.loadClients(),
                    this.loadEmployees(),
                    this.loadTimesheetEntries(),
                    this.loadBudgetTasks()
                ]);

                if (!clientsResult.success) {
                    throw new Error('Failed to load clients: ' + clientsResult.error);
                }

                // Calculate statistics
                this.calculateStatistics();

                // Apply filters
                this.applyFilters();

                // Update UI
                this.updateUI();

                this.lastUpdated = new Date();
                this.isLoading = false;
                this.hideLoadingIndicator();

                return { success: true };

            } catch (error) {
                console.error('❌ Error loading data:', error);
                this.isLoading = false;
                this.hideLoadingIndicator();
                return { success: false, error: error.message };
            }
        }

        /**
         * Determine whether a service contributes to client-level aggregates.
         * PR-G.3.14 (2026-05-27): archived services are excluded from client-level
         * totalHours / hoursRemaining / needsAttention / overdraft signals.
         *
         * Mirror of `NON_AGGREGATING_STATUSES` in functions/shared/aggregates.js.
         * Backend SSOT keeps the canonical list; frontend filter MUST stay in sync.
         * If you add another status (e.g. 'on_hold'), update BOTH places.
         *
         * Lifetime contract value (across all statuses) reachable via:
         *   client.services.reduce((s, svc) => s + (svc.totalHours || 0), 0)
         *
         * @param {Object} service - one entry from client.services[]
         * @returns {boolean} true if the service counts toward client-level aggregates
         */
        _isServiceCountedForClientAggregate(service) {
            if (!service) {
                return false;
            }
            const status = service.status || 'active';
            return status !== 'archived';
        }

        /**
         * Calculate remaining hours from services array
         * חישוב שעות נותרות מתוך מערך השירותים
         */
        calculateRemainingHoursFromServices(client) {
            if (!client.services || client.services.length === 0) {
                return client.hoursRemaining || 0;
            }

            let totalRemaining = 0;

            client.services.forEach(service => {
                // PR-G.3.14: skip archived services from client-level total
                if (!this._isServiceCountedForClientAggregate(service)) {
                    return;
                }
                // Check if this is a legal procedure with stages
                if (service.type === 'legal_procedure' && service.stages && Array.isArray(service.stages)) {
                    // For legal procedures: sum only ACTIVE stages
                    service.stages.forEach(stage => {
                        if (stage.status === 'active') {
                            totalRemaining += (stage.hoursRemaining || 0);
                        }
                    });
                } else {
                    // For regular services: add their hoursRemaining
                    totalRemaining += (service.hoursRemaining || 0);
                }
            });

            return totalRemaining;
        }

        /**
         * Calculate total hours from services array
         * חישוב סך השעות מתוך מערך השירותים
         */
        calculateTotalHoursFromServices(client) {
            if (!client.services || client.services.length === 0) {
                return client.totalHours || 0;
            }

            let totalHours = 0;

            client.services.forEach(service => {
                // PR-G.3.14: skip archived services from client-level total
                if (!this._isServiceCountedForClientAggregate(service)) {
                    return;
                }
                // Check if this is a legal procedure with stages
                if (service.type === 'legal_procedure' && service.stages && Array.isArray(service.stages)) {
                    // For legal procedures: sum only ACTIVE stages
                    service.stages.forEach(stage => {
                        if (stage.status === 'active') {
                            totalHours += (stage.totalHours || 0);
                        }
                    });
                } else {
                    // For regular services: add their totalHours
                    totalHours += (service.totalHours || service.hours || 0);
                }
            });

            return totalHours;
        }

        /**
         * Load clients from Firestore
         * טעינת לקוחות
         */
        async loadClients() {
            try {
                console.log('📥 Loading clients from Firestore...');

                const snapshot = await this.db.collection('clients').get();

                this.clients = snapshot.docs
                    .map(doc => {
                        const clientData = doc.data();

                        // ✅ Compute type display from services[] (canonical source of truth).
                        // Replaces legacy `type: clientData.type || 'hours'` default which
                        // wrongly defaulted every fixed client to 'hours' display.
                        // See apps/admin-panel/js/core/client-type-display.js.
                        const typeDisplay = window.ClientTypeDisplay
                            ? window.ClientTypeDisplay.computeClientTypeDisplay(clientData.services)
                            : { kind: 'none', label: 'ללא', icon: 'fa-question-circle', breakdown: [] };

                        const client = {
                            id: doc.id,
                            ...clientData,
                            // Ensure we have the correct field names
                            fullName: clientData.fullName || clientData.clientName || '',
                            caseNumber: clientData.caseNumber || '',
                            type: typeDisplay.kind,  // ← computed: 'hours'/'fixed'/'mixed'/'none' (was: legacy default 'hours')
                            typeDisplay: typeDisplay,  // ← full object with label/icon/breakdown for UI
                            isBlocked: clientData.isBlocked || false,
                            isCritical: clientData.isCritical || false,
                            // PR-A.4 (2026-05-16): manual freeze flag, orthogonal to derived isBlocked.
                            // === true coerces missing field (pre-migration clients) to false safely.
                            isOnHold: clientData.isOnHold === true,
                            status: clientData.status || 'active',
                            assignedTo: clientData.assignedTo || [],
                            services: clientData.services || [],
                            createdAt: clientData.createdAt,
                            lastActivity: clientData.lastActivity || clientData.lastModifiedAt
                        };

                        // Calculate hours dynamically from services
                        client.totalHours = this.calculateTotalHoursFromServices(client);
                        client.hoursRemaining = this.calculateRemainingHoursFromServices(client);

                        return client;
                    })
                    // ✅ סינון תיקים פנימיים - לא מציגים אותם ברשימת הלקוחות
                    .filter(client => !client.isInternal && client.clientType !== 'internal');

                console.log(`✅ Loaded ${this.clients.length} clients`);

                return { success: true, clients: this.clients };

            } catch (error) {
                console.error('❌ Error loading clients:', error);
                return { success: false, error: error.message };
            }
        }

        /**
         * Load employees
         * טעינת עובדים
         */
        async loadEmployees() {
            try {
                console.log('📥 Loading employees...');

                const snapshot = await this.db.collection('employees').get();

                this.employees = snapshot.docs.map(doc => ({
                    id: doc.id,
                    email: doc.data().email || doc.id,
                    username: doc.data().username || doc.data().name || '',
                    role: doc.data().role || 'employee',
                    lastLogin: doc.data().lastLogin || null
                }));

                console.log(`✅ Loaded ${this.employees.length} employees`);

                return { success: true, employees: this.employees };

            } catch (error) {
                console.error('❌ Error loading employees:', error);
                return { success: false, error: error.message };
            }
        }

        /**
         * Load timesheet entries
         * טעינת רשומות שעתון
         */
        async loadTimesheetEntries() {
            try {
                console.log('📥 Loading timesheet entries...');

                // Load all timesheet entries (we'll filter by client later)
                // Cap raised 5000 -> 10000 (2026-07-23): measured ~4,983/5,000 in PROD,
                // growing ~21/day -> the old cap would have been crossed within days.
                // 10,000 is Firestore's HARD MAXIMUM for a single query's limit() -
                // a value above it (the earlier 20,000) makes the query THROW
                // ("Limit value in the structured query is over the maximum value of
                // 10000"), which silently emptied timesheetEntries and broke every
                // client report. 10,000 leaves ~5,000 entries of headroom (~8 months
                // at the observed rate). This is NOT a fix for the underlying issue
                // (an unbounded client-side download) - it buys time, and the ceiling
                // is now Firestore's own wall. The real fix is per-client / paginated
                // querying (tracked separately, out of scope here).
                const timesheetLimit = 10000;
                const snapshot = await this.db.collection('timesheet_entries')
                    .orderBy('date', 'desc')
                    .limit(timesheetLimit)
                    .get();

                this.warnIfTruncated('timesheet_entries', snapshot, timesheetLimit);

                this.timesheetEntries = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.timesheetLoadFailed = false;

                console.log(`✅ Loaded ${this.timesheetEntries.length} timesheet entries`);

                return { success: true, entries: this.timesheetEntries };

            } catch (error) {
                // PR-REPORT-SSOT (2026-07-23): this used to fail silently - the caller
                // (loadAllData) never checked this result, this.timesheetEntries stayed
                // [], and every screen rendered as if there were genuinely zero hours.
                // Record the failure, log loudly, and surface a non-auto-hiding Hebrew
                // toast (mirrors the warnIfTruncated pattern below) - but never throw,
                // so the rest of the admin panel keeps working.
                console.error('❌ Error loading timesheet entries:', error);
                this.timesheetLoadFailed = true;
                if (typeof window !== 'undefined' && window.notify && typeof window.notify.show === 'function') {
                    window.notify.show({
                        type: 'error',
                        title: 'טעינת שעתון נכשלה',
                        message: 'טעינת רישומי השעתון נכשלה - נתוני השעות בכרטיסי השירות ובדוחות עלולים להיות שגויים. רענן את הדף או פנה לתמיכה הטכנית.',
                        duration: 0
                    });
                }
                return { success: false, error: error.message };
            }
        }

        /**
         * Load budget tasks
         * טעינת משימות
         */
        async loadBudgetTasks() {
            try {
                console.log('📥 Loading budget tasks...');

                // Cap set to 10000 (2026-07-23), same rationale as loadTimesheetEntries
                // above - 10,000 is Firestore's HARD MAXIMUM for a single query limit();
                // the earlier 20,000 threw and broke the load. budget_tasks is far from
                // its cap today (~704) but carries the identical trap. Kept in sync for
                // consistency; see warnIfTruncated for the loudness guard.
                const budgetTasksLimit = 10000;
                const snapshot = await this.db.collection('budget_tasks')
                    .limit(budgetTasksLimit)
                    .get();

                this.warnIfTruncated('budget_tasks', snapshot, budgetTasksLimit);

                this.budgetTasks = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.budgetTasksLoadFailed = false;

                console.log(`✅ Loaded ${this.budgetTasks.length} budget tasks`);

                return { success: true, tasks: this.budgetTasks };

            } catch (error) {
                // PR-REPORT-SSOT (2026-07-23): same silent-failure trap as
                // loadTimesheetEntries above - record + log loudly + a non-auto-hiding
                // toast, never throw (the rest of the admin panel must keep working).
                console.error('❌ Error loading budget tasks:', error);
                this.budgetTasksLoadFailed = true;
                if (typeof window !== 'undefined' && window.notify && typeof window.notify.show === 'function') {
                    window.notify.show({
                        type: 'error',
                        title: 'טעינת משימות נכשלה',
                        message: 'טעינת נתוני התקציב נכשלה - נתוני חריגות ומעקב תקציב עלולים להיות שגויים. רענן את הדף או פנה לתמיכה הטכנית.',
                        duration: 0
                    });
                }
                return { success: false, error: error.message };
            }
        }

        /**
         * Loudly flag a capped Firestore query that returned exactly `limit` docs.
         * When the returned count equals the limit, we cannot tell whether that's
         * a coincidence or silent truncation - so we must always assume truncation
         * and say so loudly. This must NEVER throw: it runs inside a data-load path,
         * and an exception here must not break the rest of the admin panel.
         *
         * החזרה שקטה של המספר המרבי מהשאילתה עשויה להעיד על קיטום שקט של נתונים -
         * לכן כל חריגה מהמגבלה חייבת להיזרק בקול רם ל-console.error, לעולם לא בשקט.
         *
         * @param {string} collectionName - Firestore collection name (no PII).
         * @param {object} snapshot - the Firestore QuerySnapshot (or malformed/undefined).
         * @param {number} limit - the `.limit()` value used for the query.
         */
        warnIfTruncated(collectionName, snapshot, limit) {
            try {
                const docs = snapshot && snapshot.docs;
                if (!Array.isArray(docs)) {
                    return;
                }

                // A non-positive limit is never a real query cap (both call sites pass a
                // hardcoded 20000) - treat it as "not applicable" rather than let
                // docs.length===0===limit produce a false-positive truncation warning.
                if (typeof limit === 'number' && limit > 0 && docs.length === limit) {
                    console.error(
                        `🔴 TRUNCATION: collection="${collectionName}" hit its query limit ` +
                        `(${limit} docs returned). Data shown in the admin panel is INCOMPLETE - ` +
                        'the oldest records are missing. Raise the limit or switch this loader ' +
                        'to per-client querying.'
                    );

                    // Also surface to the admin via the existing toast system (if loaded) -
                    // a console.error alone is invisible to anyone not watching devtools,
                    // and an admin reading a report built from truncated data has no other
                    // way to know the numbers are wrong. Reuses the app's existing
                    // notification mechanism (window.notify) rather than inventing a new one.
                    // Uses show() with duration:0 (never auto-hide) instead of the error()
                    // shorthand (hardcoded 6s) - this fires during loadAllData()'s initial
                    // load, while the admin is still watching a loading table, and every
                    // screen opened afterwards in that session would otherwise show
                    // truncated numbers with no visible trace once the toast disappears.
                    if (typeof window !== 'undefined' && window.notify && typeof window.notify.show === 'function') {
                        window.notify.show({
                            type: 'error',
                            title: 'נתונים חלקיים',
                            message: 'חלק מהנתונים ההיסטוריים לא נטענו עקב מגבלת כמות - הדוחות עשויים להיות חלקיים. פנה לתמיכה הטכנית.',
                            duration: 0
                        });
                    }
                }
            } catch (guardError) {
                // Never let the guard itself break the data-load path.
                console.error('❌ Error in warnIfTruncated guard:', guardError && guardError.message);
            }
        }

        /**
         * Check if client needs attention (low hours/stage ending)
         * בדיקה אם לקוח דורש תשומת לב (שעות נמוכות/שלב לפני סיום)
         */
        needsAttention(client) {
            // Only check active, non-blocked clients
            if (client.status !== 'active' || client.isBlocked) {
                return false;
            }

            const hoursRemaining = client.hoursRemaining || 0;
            const totalHours = client.totalHours || 0;

            // Case 1: Regular hourly client - low hours
            if (client.procedureType === 'hours') {
                // Less than 10 hours OR less than 10% remaining
                return hoursRemaining < 10 || (totalHours > 0 && (hoursRemaining / totalHours) < 0.1);
            }

            // Case 2: Legal procedure - hourly pricing
            if (client.procedureType === 'legal_procedure' && client.pricingType === 'hourly') {
                // Check total hours remaining for entire procedure
                if (hoursRemaining < 10) {
                    return true;
                }

                // Check current stage hours remaining
                if (client.services && client.services.length > 0) {
                    const legalService = client.services.find(s => s.type === 'legal_procedure');
                    if (legalService && legalService.stages) {
                        const currentStage = legalService.stages.find(s => s.status === 'active');
                        if (currentStage && currentStage.hoursRemaining < 5) {
                            return true;
                        }
                    }
                }
            }

            return false;
        }

        /**
         * Calculate statistics
         * חישוב סטטיסטיקות
         */
        calculateStatistics() {
            const stats = {
                total: this.clients.length,
                active: this.clients.filter(c => c.status === 'active').length,
                blocked: this.clients.filter(c => c.isBlocked === true).length,
                needsAttention: this.clients.filter(c => this.needsAttention(c)).length,
                noAgreement: this.clients.filter(c => !c.feeAgreements || c.feeAgreements.length === 0).length
            };

            // Update stats cards
            this.updateStatsCards(stats);

            return stats;
        }

        /**
         * Update stats cards
         * עדכון כרטיסי סטטיסטיקה
         */
        updateStatsCards(stats) {
            document.getElementById('totalClientsStat').textContent = stats.total;
            document.getElementById('activeClientsStat').textContent = stats.active;
            document.getElementById('blockedClientsStat').textContent = stats.blocked;

            // עדכון כרטיס דורש תשומת לב (החליף את קריטיים)
            const needsAttentionStat = document.getElementById('needsAttentionStat');
            if (needsAttentionStat) {
                needsAttentionStat.textContent = stats.needsAttention;
            }

            // עדכון כרטיס ללא הסכם שכר טרחה
            const noAgreementStat = document.getElementById('noAgreementClientsStat');
            if (noAgreementStat) {
                noAgreementStat.textContent = stats.noAgreement;
            }
        }

        /**
         * Apply filters
         * החלת פילטרים
         */
        applyFilters() {
            let filtered = [...this.clients];

            // Search filter
            if (this.searchTerm) {
                const term = this.searchTerm.toLowerCase();
                filtered = filtered.filter(client => {
                    return (
                        (client.fullName && client.fullName.toLowerCase().includes(term)) ||
                        (client.caseNumber && client.caseNumber.toLowerCase().includes(term)) ||
                        (client.idNumber && client.idNumber.includes(term))
                    );
                });
            }

            // Status filter
            if (this.statusFilter !== 'all') {
                if (this.statusFilter === 'blocked') {
                    filtered = filtered.filter(c => c.isBlocked === true);
                } else if (this.statusFilter === 'needs-attention') {
                    filtered = filtered.filter(c => this.needsAttention(c));
                } else {
                    filtered = filtered.filter(c => c.status === this.statusFilter);
                }
            }

            // Type filter
            if (this.typeFilter !== 'all') {
                filtered = filtered.filter(c => c.type === this.typeFilter);
            }

            // Agreement filter - בדיקה מדויקת
            if (this.agreementFilter !== 'all') {
                if (this.agreementFilter === 'no-agreement') {
                    // סנן רק לקוחות ללא הסכם שכר טרחה
                    filtered = filtered.filter(c => !c.feeAgreements || c.feeAgreements.length === 0);
                } else if (this.agreementFilter === 'has-agreement') {
                    // סנן רק לקוחות עם הסכם שכר טרחה
                    filtered = filtered.filter(c => c.feeAgreements && c.feeAgreements.length > 0);
                }
            }

            // Sort
            filtered.sort((a, b) => {
                let aValue, bValue;

                switch (this.sortBy) {
                    case 'name':
                        aValue = a.fullName || '';
                        bValue = b.fullName || '';
                        return this.sortOrder === 'asc'
                            ? aValue.localeCompare(bValue, 'he')
                            : bValue.localeCompare(aValue, 'he');

                    case 'caseNumber':
                        aValue = a.caseNumber || '';
                        bValue = b.caseNumber || '';
                        return this.sortOrder === 'asc'
                            ? aValue.localeCompare(bValue)
                            : bValue.localeCompare(aValue);

                    case 'hoursRemaining':
                        aValue = a.hoursRemaining || 0;
                        bValue = b.hoursRemaining || 0;
                        return this.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;

                    case 'lastActivity':
                        // Sort by latest login of team members
                        aValue = this.getLatestTeamLogin(a);
                        bValue = this.getLatestTeamLogin(b);
                        return this.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;

                    case 'createdAt':
                        aValue = a.createdAt ? a.createdAt.toMillis() : 0;
                        bValue = b.createdAt ? b.createdAt.toMillis() : 0;
                        return this.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;

                    default:
                        return 0;
                }
            });

            this.filteredClients = filtered;
        }

        /**
         * Get paginated clients
         * קבלת לקוחות עם Pagination
         */
        getPaginatedClients() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            const end = start + this.itemsPerPage;
            const clients = this.filteredClients.slice(start, end);

            return {
                clients,
                pagination: {
                    currentPage: this.currentPage,
                    totalPages: Math.ceil(this.filteredClients.length / this.itemsPerPage),
                    totalItems: this.filteredClients.length,
                    itemsPerPage: this.itemsPerPage,
                    startIndex: start + 1,
                    endIndex: Math.min(end, this.filteredClients.length)
                }
            };
        }

        /**
         * Get client by ID
         * קבלת לקוח לפי ID
         */
        getClientById(clientId) {
            return this.clients.find(c => c.id === clientId);
        }

        /**
         * Get timesheet entries for client
         * קבלת רשומות שעתון ללקוח
         */
        getClientTimesheetEntries(clientName, startDate = null, endDate = null) {
            let entries = this.timesheetEntries.filter(entry =>
                entry.clientName === clientName
            );

            // Filter by date range if provided
            if (startDate && endDate) {
                const start = new Date(startDate).getTime();
                const end = new Date(endDate).getTime();

                entries = entries.filter(entry => {
                    const entryDate = entry.date?.toMillis ? entry.date.toMillis() : new Date(entry.date).getTime();
                    return entryDate >= start && entryDate <= end;
                });
            }

            return entries;
        }

        /**
         * Get budget tasks for client
         * קבלת משימות ללקוח
         */
        getClientBudgetTasks(clientName, startDate = null, endDate = null) {
            let tasks = this.budgetTasks.filter(task =>
                task.clientName === clientName
            );

            // Filter by date range if provided
            if (startDate && endDate) {
                const start = new Date(startDate).getTime();
                const end = new Date(endDate).getTime();

                tasks = tasks.filter(task => {
                    const taskDate = task.createdAt?.toMillis ? task.createdAt.toMillis() : new Date(task.createdAt).getTime();
                    return taskDate >= start && taskDate <= end;
                });
            }

            return tasks;
        }

        /**
         * Get employee name by email
         * קבלת שם עובד לפי מייל
         */
        getEmployeeName(email) {
            const employee = this.employees.find(e => e.email === email);
            return employee ? employee.username : email;
        }

        /**
         * Get employee lastLogin by email
         * קבלת כניסה אחרונה של עובד לפי מייל
         */
        getEmployeeLastLogin(email) {
            const employee = this.employees.find(e => e.email === email);
            return employee ? employee.lastLogin : null;
        }

        /**
         * Get latest team login timestamp
         * קבלת זמן הכניסה האחרונה של חברי הצוות (למיון)
         */
        getLatestTeamLogin(client) {
            if (!client.assignedTo || client.assignedTo.length === 0) {
                return 0;
            }

            let latestLogin = 0;

            client.assignedTo.forEach(email => {
                const employeeLogin = this.getEmployeeLastLogin(email);
                if (employeeLogin) {
                    const loginTime = employeeLogin.toMillis ? employeeLogin.toMillis() : new Date(employeeLogin).getTime();
                    if (loginTime > latestLogin) {
                        latestLogin = loginTime;
                    }
                }
            });

            return latestLogin;
        }

        /**
         * Set search term
         */
        setSearch(term) {
            this.searchTerm = term;
            this.currentPage = 1; // Reset to first page
            this.applyFilters();
            this.updateUI();
        }

        /**
         * Set status filter
         */
        setStatusFilter(status) {
            this.statusFilter = status;
            this.currentPage = 1;
            this.applyFilters();
            this.updateUI();
        }

        /**
         * Set type filter
         */
        setTypeFilter(type) {
            this.typeFilter = type;
            this.currentPage = 1;
            this.applyFilters();
            this.updateUI();
        }

        /**
         * Set agreement filter
         * הגדרת פילטר הסכמי שכר טרחה
         */
        setAgreementFilter(filter) {
            this.agreementFilter = filter;
            this.currentPage = 1;
            this.applyFilters();
            this.updateUI();
        }

        /**
         * Set sort
         */
        setSort(sortBy, sortOrder = 'asc') {
            this.sortBy = sortBy;
            this.sortOrder = sortOrder;
            this.applyFilters();
            this.updateUI();
        }

        /**
         * Set page
         */
        setPage(page) {
            this.currentPage = page;
            this.updateUI();
        }

        /**
         * Set items per page
         */
        setItemsPerPage(itemsPerPage) {
            this.itemsPerPage = itemsPerPage;
            this.currentPage = 1;
            this.updateUI();
        }

        /**
         * Update UI
         * עדכון ממשק משתמש
         */
        updateUI() {
            // Dispatch event for table update
            window.dispatchEvent(new CustomEvent('clients:updated', {
                detail: this.getPaginatedClients()
            }));
        }

        /**
         * Refresh data
         * רענון נתונים
         */
        async refresh() {
            console.log('🔄 Refreshing clients data...');
            return await this.loadAllData();
        }

        /**
         * Show loading indicator
         */
        showLoadingIndicator() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'flex';
            }
        }

        /**
         * Hide loading indicator
         */
        hideLoadingIndicator() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
        }

        /**
         * Setup real-time listeners
         * הגדרת מאזינים בזמן אמת
         */
        setupRealtimeListeners() {
            console.log('👂 Setting up real-time listeners...');

            // Listen to clients collection changes
            this.clientsListener = this.db.collection('clients')
                .onSnapshot(
                    (snapshot) => {
                        console.log('🔄 Clients collection updated');
                        this.loadClients().then(() => {
                            this.calculateStatistics();
                            this.applyFilters();
                            this.updateUI();
                        });
                    },
                    (error) => {
                        console.error('❌ Error in clients listener:', error);
                    }
                );

            // ✅ NEW: Listen to employees collection changes
            // This enables real-time activity status updates (lastSeen/isOnline)
            this.employeesListener = this.db.collection('employees')
                .onSnapshot(
                    (snapshot) => {
                        console.log('🔄 Employees collection updated');
                        this.loadEmployees().then(() => {
                            // רק נרענן את הטבלה, לא צריך לחשב סטטיסטיקות מחדש
                            this.updateUI();
                        });
                    },
                    (error) => {
                        console.error('❌ Error in employees listener:', error);
                    }
                );

            console.log('✅ Real-time listeners active: clients + employees');
        }

        /**
         * Destroy
         * השמדה
         */
        destroy() {
            // Remove real-time listeners
            if (this.clientsListener) {
                this.clientsListener();
                this.clientsListener = null;
            }

            // ✅ NEW: Clean up employees listener
            if (this.employeesListener) {
                this.employeesListener();
                this.employeesListener = null;
            }

            console.log('🗑️ ClientsDataManager: Destroyed');
        }
    }

    // Create global instance
    const clientsDataManager = new ClientsDataManager();

    // Make available globally
    window.ClientsDataManager = clientsDataManager;

    // Export for ES6 modules (if needed)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = clientsDataManager;
    }

})();
