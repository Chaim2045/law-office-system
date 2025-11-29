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

            // Filters
            this.searchTerm = '';
            this.statusFilter = 'all';
            this.typeFilter = 'all';
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
         * Load clients from Firestore
         * טעינת לקוחות
         */
        async loadClients() {
            try {
                console.log('📥 Loading clients from Firestore...');

                const snapshot = await this.db.collection('clients').get();

                this.clients = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    // Ensure we have the correct field names
                    fullName: doc.data().fullName || doc.data().clientName || '',
                    caseNumber: doc.data().caseNumber || '',
                    type: doc.data().type || 'hours',
                    totalHours: doc.data().totalHours || 0,
                    hoursRemaining: doc.data().hoursRemaining || 0,
                    isBlocked: doc.data().isBlocked || false,
                    isCritical: doc.data().isCritical || false,
                    status: doc.data().status || 'active',
                    assignedTo: doc.data().assignedTo || [],
                    services: doc.data().services || [],
                    createdAt: doc.data().createdAt,
                    lastActivity: doc.data().lastActivity || doc.data().lastModifiedAt,
                }));

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
                    email: doc.data().email,
                    username: doc.data().username || doc.data().name || '',
                    role: doc.data().role || 'employee',
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
                const snapshot = await this.db.collection('timesheet_entries')
                    .orderBy('date', 'desc')
                    .limit(5000) // Reasonable limit
                    .get();

                this.timesheetEntries = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                console.log(`✅ Loaded ${this.timesheetEntries.length} timesheet entries`);

                return { success: true, entries: this.timesheetEntries };

            } catch (error) {
                console.error('❌ Error loading timesheet entries:', error);
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

                const snapshot = await this.db.collection('budget_tasks')
                    .limit(5000)
                    .get();

                this.budgetTasks = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                console.log(`✅ Loaded ${this.budgetTasks.length} budget tasks`);

                return { success: true, tasks: this.budgetTasks };

            } catch (error) {
                console.error('❌ Error loading budget tasks:', error);
                return { success: false, error: error.message };
            }
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
                critical: this.clients.filter(c => c.isCritical === true && !c.isBlocked).length,
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
            document.getElementById('criticalClientsStat').textContent = stats.critical;
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
                } else if (this.statusFilter === 'critical') {
                    filtered = filtered.filter(c => c.isCritical === true && !c.isBlocked);
                } else {
                    filtered = filtered.filter(c => c.status === this.statusFilter);
                }
            }

            // Type filter
            if (this.typeFilter !== 'all') {
                filtered = filtered.filter(c => c.type === this.typeFilter);
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
                        aValue = a.lastActivity ? a.lastActivity.toMillis() : 0;
                        bValue = b.lastActivity ? b.lastActivity.toMillis() : 0;
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
                    endIndex: Math.min(end, this.filteredClients.length),
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
