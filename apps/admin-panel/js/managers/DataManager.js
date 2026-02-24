/**
 * Data Manager
 * מנהל נתונים - שליפה, עיבוד, ו-Caching
 *
 * נוצר: 31/10/2025
 * גרסה: 1.0.0
 * Phase: 2 - Dashboard UI
 *
 * תפקיד: ניהול כל הנתונים מ-Firestore, Cache, Statistics
 */

(function() {
    'use strict';

    /**
     * DataManager Class
     * מנהל את כל פעולות הנתונים
     */
    class DataManager {
        constructor() {
            this.db = null;
            this.auth = null;

            // Data storage
            this.allUsers = [];
            this.filteredUsers = [];
            this.statistics = {
                total: 0,
                active: 0,
                blocked: 0,
                new: 0
            };

            // Cache management
            this.cache = new Map();
            this.cacheExpiry = window.ADMIN_PANEL_CONSTANTS.CACHE.EXPIRY_MS;
            this.lastFetchTime = null;

            // Filters state
            this.currentFilters = {
                search: '',
                role: 'all',
                status: 'all',
                sortBy: 'username',
                sortOrder: 'asc'
            };

            // Pagination state
            this.pagination = {
                currentPage: 1,
                itemsPerPage: 25,
                totalPages: 0,
                totalItems: 0
            };

            // Loading state
            this.isLoading = false;

            // Real-time listener unsubscribe function
            this.unsubscribe = null;
        }

        /**
         * Initialize DataManager
         * אתחול מנהל הנתונים
         */
        init() {
            try {
                // Wait for Firebase
                if (!window.FirebaseManager || !window.FirebaseManager.initialized) {
                    console.warn('⏳ DataManager: Waiting for Firebase...');
                    window.addEventListener('firebase:ready', () => this.init());
                    return;
                }

                // Get Firebase instances
                this.db = window.firebaseDB;
                this.auth = window.firebaseAuth;

                console.log('✅ DataManager initialized successfully');

                return true;

            } catch (error) {
                console.error('❌ DataManager initialization error:', error);
                return false;
            }
        }

        /**
         * Load all users from Firestore
         * שליפת כל המשתמשים
         */
        async loadUsers(forceRefresh = false) {
            try {
                // Check cache
                if (!forceRefresh && this.isCacheValid()) {
                    console.log('📦 DataManager: Using cached data');
                    return {
                        success: true,
                        users: this.allUsers,
                        statistics: this.statistics,
                        fromCache: true
                    };
                }

                this.isLoading = true;

                console.log('🔄 DataManager: Fetching users from Firestore...');

                // Fetch from Firestore - employees collection
                const snapshot = await this.db.collection('employees').get();

                // Parse users
                this.allUsers = [];

                // Fetch statistics for all users in parallel
                const statsPromises = [];
                snapshot.forEach(doc => {
                    const userData = doc.data();
                    const userEmail = doc.id;

                    // 🔒 FILTER: Skip inactive users (soft-deleted)
                    // Allow showing only active users unless explicitly requested
                    if (userData.status === 'inactive' || userData.status === 'suspended') {
                        console.log(`⏭️ Skipping inactive user: ${userEmail}`);
                        return; // Skip this user
                    }

                    // Create base user object
                    const user = {
                        id: doc.id,
                        email: doc.id,
                        username: userData.username || doc.id.split('@')[0],
                        role: userData.role || 'user',
                        status: userData.status || 'active',
                        createdAt: userData.createdAt || null,
                        lastLogin: userData.lastLogin || null,
                        lastSeen: userData.lastSeen || null,        // ✅ NEW: Real-time activity (updated every 5 min)
                        isOnline: userData.isOnline || false,       // ✅ NEW: Online status
                        phoneNumber: userData.phoneNumber || '',
                        phone: userData.phone || '',  // WhatsApp Bot field
                        whatsappEnabled: userData.whatsappEnabled || false,  // WhatsApp Bot toggle
                        displayName: userData.displayName || userData.username || doc.id.split('@')[0],
                        photoURL: userData.photoURL || null,
                        dailyHoursTarget: userData.dailyHoursTarget || null,  // Daily hours target for work quota
                        // Will be filled by stats
                        clientsCount: 0,
                        tasksCount: 0,
                        hoursThisWeek: 0,
                        hoursThisMonth: 0
                    };

                    this.allUsers.push(user);

                    // Fetch stats in parallel (lightweight queries)
                    statsPromises.push(this.fetchUserStats(userEmail, user));
                });

                // Wait for all stats to load
                console.log('📊 DataManager: Loading statistics for all users...');
                await Promise.all(statsPromises);

                console.log(`✅ DataManager: Loaded ${this.allUsers.length} users with statistics`);

                // Calculate statistics
                this.calculateStatistics();

                // Apply current filters
                this.applyFilters();

                // Update cache
                this.updateCache();

                this.isLoading = false;

                return {
                    success: true,
                    users: this.allUsers,
                    statistics: this.statistics,
                    fromCache: false
                };

            } catch (error) {
                console.error('❌ DataManager: Error loading users:', error);
                this.isLoading = false;

                return {
                    success: false,
                    error: error.message,
                    users: [],
                    statistics: this.getEmptyStatistics()
                };
            }
        }

        /**
         * Fetch user statistics
         * טעינת סטטיסטיקות משתמש
         */
        async fetchUserStats(email, userObject) {
            try {
                const now = new Date();
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
                startOfWeek.setHours(0, 0, 0, 0);

                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

                // Count clients (where assignedTo array contains this email)
                const clientsSnapshot = await this.db.collection('clients')
                    .where('assignedTo', 'array-contains', email)
                    .get();
                userObject.clientsCount = clientsSnapshot.size;

                // Count tasks
                const tasksSnapshot = await this.db.collection('budget_tasks')
                    .where('employee', '==', email)
                    .get();
                userObject.tasksCount = tasksSnapshot.size;

                // Calculate hours this week
                const weekTimesheetSnapshot = await this.db.collection('timesheet_entries')
                    .where('employee', '==', email)
                    .where('date', '>=', startOfWeek.toISOString().split('T')[0])
                    .get();

                let weekMinutes = 0;
                weekTimesheetSnapshot.forEach(doc => {
                    const data = doc.data();
                    weekMinutes += data.minutes || 0;
                });
                userObject.hoursThisWeek = Math.round((weekMinutes / 60) * 100) / 100;

                // Calculate hours this month
                const monthTimesheetSnapshot = await this.db.collection('timesheet_entries')
                    .where('employee', '==', email)
                    .where('date', '>=', startOfMonthStr)
                    .get();

                let monthMinutes = 0;
                monthTimesheetSnapshot.forEach(doc => {
                    const data = doc.data();
                    monthMinutes += data.minutes || 0;
                });
                userObject.hoursThisMonth = Math.round((monthMinutes / 60) * 100) / 100;

            } catch (error) {
                console.warn(`⚠️ Could not load stats for ${email}:`, error.message);
                // Keep default values (0)
            }
        }

        /**
         * Calculate statistics
         * חישוב סטטיסטיקות
         */
        calculateStatistics() {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

            this.statistics = {
                total: this.allUsers.length,
                active: this.allUsers.filter(
                    u => u.status === window.ADMIN_PANEL_CONSTANTS.USER_STATUS.ACTIVE
                ).length,
                blocked: this.allUsers.filter(
                    u => u.status === window.ADMIN_PANEL_CONSTANTS.USER_STATUS.BLOCKED
                ).length,
                new: this.allUsers.filter(u => {
                    if (!u.createdAt) {
return false;
}
                    const createdDate = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
                    return createdDate >= thirtyDaysAgo;
                }).length,
                activeLastWeek: this.allUsers.filter(u => {
                    if (!u.lastLogin) {
return false;
}
                    const lastLoginDate = u.lastLogin.toDate ? u.lastLogin.toDate() : new Date(u.lastLogin);
                    return lastLoginDate >= sevenDaysAgo;
                }).length
            };

            console.log('📊 Statistics calculated:', this.statistics);
        }

        /**
         * Apply filters to users
         * החלת פילטרים
         */
        applyFilters() {
            let filtered = [...this.allUsers];

            // Search filter
            if (this.currentFilters.search) {
                const searchLower = this.currentFilters.search.toLowerCase();
                filtered = filtered.filter(user =>
                    user.username.toLowerCase().includes(searchLower) ||
                    user.email.toLowerCase().includes(searchLower) ||
                    (user.displayName && user.displayName.toLowerCase().includes(searchLower))
                );
            }

            // Role filter
            if (this.currentFilters.role !== 'all') {
                filtered = filtered.filter(user => user.role === this.currentFilters.role);
            }

            // Status filter
            if (this.currentFilters.status !== 'all') {
                filtered = filtered.filter(user => user.status === this.currentFilters.status);
            }

            // Sort
            filtered.sort((a, b) => {
                const aVal = a[this.currentFilters.sortBy] || '';
                const bVal = b[this.currentFilters.sortBy] || '';

                if (this.currentFilters.sortOrder === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });

            this.filteredUsers = filtered;

            // Update pagination
            this.updatePagination();

            console.log(`🔍 Filters applied: ${filtered.length}/${this.allUsers.length} users`);
        }

        /**
         * Set search filter
         * הגדרת חיפוש
         */
        setSearch(searchTerm) {
            this.currentFilters.search = searchTerm;
            this.applyFilters();
            return this.getPaginatedUsers();
        }

        /**
         * Set role filter
         * הגדרת סינון לפי תפקיד
         */
        setRoleFilter(role) {
            this.currentFilters.role = role;
            this.pagination.currentPage = 1; // Reset to page 1
            this.applyFilters();
            return this.getPaginatedUsers();
        }

        /**
         * Set status filter
         * הגדרת סינון לפי סטטוס
         */
        setStatusFilter(status) {
            this.currentFilters.status = status;
            this.pagination.currentPage = 1; // Reset to page 1
            this.applyFilters();
            return this.getPaginatedUsers();
        }

        /**
         * Set sort
         * הגדרת מיון
         */
        setSort(sortBy, sortOrder = 'asc') {
            this.currentFilters.sortBy = sortBy;
            this.currentFilters.sortOrder = sortOrder;
            this.applyFilters();
            return this.getPaginatedUsers();
        }

        /**
         * Toggle sort order
         * החלפת כיוון מיון
         */
        toggleSortOrder(sortBy) {
            if (this.currentFilters.sortBy === sortBy) {
                // Toggle order
                this.currentFilters.sortOrder = this.currentFilters.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                // New sort field
                this.currentFilters.sortBy = sortBy;
                this.currentFilters.sortOrder = 'asc';
            }
            this.applyFilters();
            return this.getPaginatedUsers();
        }

        /**
         * Update pagination
         * עדכון מידע Pagination
         */
        updatePagination() {
            this.pagination.totalItems = this.filteredUsers.length;
            this.pagination.totalPages = Math.ceil(this.filteredUsers.length / this.pagination.itemsPerPage);

            // Ensure current page is valid
            if (this.pagination.currentPage > this.pagination.totalPages) {
                this.pagination.currentPage = Math.max(1, this.pagination.totalPages);
            }
        }

        /**
         * Get paginated users
         * קבלת משתמשים עם Pagination
         */
        getPaginatedUsers() {
            const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
            const endIndex = startIndex + this.pagination.itemsPerPage;

            return {
                users: this.filteredUsers.slice(startIndex, endIndex),
                pagination: { ...this.pagination },
                filters: { ...this.currentFilters },
                statistics: { ...this.statistics }
            };
        }

        /**
         * Set page
         * מעבר לעמוד
         */
        setPage(pageNumber) {
            if (pageNumber >= 1 && pageNumber <= this.pagination.totalPages) {
                this.pagination.currentPage = pageNumber;
                return this.getPaginatedUsers();
            }
            return null;
        }

        /**
         * Set items per page
         * הגדרת מספר פריטים בעמוד
         */
        setItemsPerPage(count) {
            this.pagination.itemsPerPage = count;
            this.pagination.currentPage = 1; // Reset to page 1
            this.updatePagination();
            return this.getPaginatedUsers();
        }

        /**
         * Next page
         * עמוד הבא
         */
        nextPage() {
            return this.setPage(this.pagination.currentPage + 1);
        }

        /**
         * Previous page
         * עמוד קודם
         */
        previousPage() {
            return this.setPage(this.pagination.currentPage - 1);
        }

        /**
         * Get statistics
         * קבלת סטטיסטיקות
         */
        getStatistics() {
            return { ...this.statistics };
        }

        /**
         * Get empty statistics
         * קבלת סטטיסטיקות ריקות
         */
        getEmptyStatistics() {
            return {
                total: 0,
                active: 0,
                blocked: 0,
                new: 0,
                activeLastWeek: 0
            };
        }

        /**
         * Check if cache is valid
         * בדיקה אם Cache תקף
         */
        isCacheValid() {
            if (!this.lastFetchTime) {
return false;
}
            const now = Date.now();
            return (now - this.lastFetchTime) < this.cacheExpiry;
        }

        /**
         * Update cache timestamp
         * עדכון זמן Cache
         */
        updateCache() {
            this.lastFetchTime = Date.now();
        }

        /**
         * Clear cache
         * ניקוי Cache
         */
        clearCache() {
            this.lastFetchTime = null;
            this.cache.clear();
            console.log('🗑️ Cache cleared');
        }

        /**
         * Refresh data
         * רענון נתונים (force refresh)
         */
        async refresh() {
            console.log('🔄 Refreshing data...');
            this.clearCache();
            return await this.loadUsers(true);
        }

        /**
         * Get loading state
         * קבלת מצב טעינה
         */
        isDataLoading() {
            return this.isLoading;
        }

        /**
         * Get user by email
         * קבלת משתמש לפי אימייל
         *
         * @param {string} email - User email
         * @returns {Object|null} User object or null if not found
         */
        getUserByEmail(email) {
            if (!email) {
return null;
}

            return this.allUsers.find(user => user.email === email) || null;
        }

        /**
         * Get current filtered users
         * קבלת משתמשים מסוננים נוכחיים
         */
        getCurrentUsers() {
            return this.filteredUsers;
        }

        /**
         * Get all users
         * קבלת כל המשתמשים
         */
        getAllUsers() {
            return this.allUsers;
        }

        /**
         * Setup real-time listeners for employees collection
         * הגדרת מאזינים לזמן אמת לשינויים במשתמשים
         */
        setupRealtimeListeners() {
            // ════════════════════════════════════════════════════════════════════════
            // 🔧 GUARD ADDED (2025-12-17) - Prevent duplicate listeners
            // ════════════════════════════════════════════════════════════════════════
            // If listener already active, skip setup to prevent:
            // - Multiple listeners on same collection
            // - Duplicate real-time callbacks
            // - QUIC Protocol Errors from too many concurrent connections
            // - Memory leaks from unmanaged listeners
            if (this.unsubscribe) {
                console.warn('⚠️ DataManager: Real-time listeners already active, skipping setup');
                return;
            }

            if (!this.db) {
                console.warn('⚠️ DataManager: Cannot setup listeners - DB not initialized');
                return;
            }

            console.log('🔊 DataManager: Setting up real-time listeners...');

            try {
                // Listen to changes in employees collection
                this.unsubscribe = this.db.collection('employees').onSnapshot(
                    (snapshot) => {
                        console.log(`📡 Real-time update: ${snapshot.docChanges().length} changes detected`);

                        let hasChanges = false;

                        snapshot.docChanges().forEach((change) => {
                            const userData = change.doc.data();
                            const email = change.doc.id;

                            if (change.type === 'added') {
                                console.log('➕ New user added:', email);
                                hasChanges = true;
                            }
                            if (change.type === 'modified') {
                                console.log('✏️ User modified:', email);
                                hasChanges = true;
                            }
                            if (change.type === 'removed') {
                                console.log('🗑️ User removed:', email);
                                hasChanges = true;
                            }
                        });

                        // Only reload if there were actual changes (not the initial load)
                        if (hasChanges && this.allUsers.length > 0) {
                            console.log('🔄 Reloading users due to real-time changes...');
                            this.invalidateCache();
                            this.loadUsers(true).catch(err => {
                                console.error('❌ Error reloading users after real-time update:', err);
                            });
                        }
                    },
                    (error) => {
                        console.error('❌ Real-time listener error:', error);
                    }
                );

                console.log('✅ Real-time listeners activated');

            } catch (error) {
                console.error('❌ Error setting up real-time listeners:', error);
            }
        }

        /**
         * Cleanup - Disconnect real-time listeners
         * ניקוי - ניתוק מאזינים לזמן אמת
         */
        cleanup() {
            if (this.unsubscribe) {
                console.log('🔇 DataManager: Disconnecting real-time listeners...');
                this.unsubscribe();
                this.unsubscribe = null;
                console.log('✅ Real-time listeners disconnected');
            }
        }

        /**
         * Invalidate cache
         * ביטול תוקף ה-Cache
         */
        invalidateCache() {
            this.lastFetchTime = null;
            this.cache.clear();
            console.log('🗑️ Cache invalidated');
        }

        /**
         * Export users to CSV file
         * ייצוא משתמשים לקובץ CSV
         */
        exportToCSV() {
            try {
                console.log('📥 Exporting users to CSV...');

                const users = this.filteredUsers;

                if (users.length === 0) {
                    window.notify.warning('אין משתמשים לייצוא', 'ייצוא לקובץ');
                    return;
                }

                // CSV Headers (in Hebrew)
                const headers = [
                    'שם',
                    'אימייל',
                    'תפקיד',
                    'סטטוס',
                    'לקוחות',
                    'משימות',
                    'שעות בשבוע',
                    'שעות בחודש',
                    'כניסה אחרונה'
                ];

                // Build rows
                const rows = users.map(u => [
                    u.username || u.name || 'ללא שם',
                    u.email,
                    this.getRoleText(u.role),
                    u.isActive ? 'פעיל' : 'לא פעיל',
                    u.clientsCount || 0,
                    u.tasksCount || 0,
                    (u.hoursThisWeek || 0).toFixed(2),
                    (u.hoursThisMonth || 0).toFixed(2),
                    u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('he-IL') : 'אף פעם'
                ]);

                // Build CSV content
                const csvContent = [
                    headers.join(','),
                    ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
                ].join('\n');

                // Create Blob with UTF-8 BOM for Excel compatibility
                const blob = new Blob(['\ufeff' + csvContent], {
                    type: 'text/csv;charset=utf-8;'
                });

                // Create download link
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.href = url;

                // Generate filename with timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                link.download = `users_export_${timestamp}.csv`;

                // Trigger download
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Clean up URL
                URL.revokeObjectURL(url);

                console.log(`✅ Exported ${users.length} users to CSV successfully`);

                // Show success notification (if available)
                if (window.NotificationsUI) {
                    window.NotificationsUI.showSuccess(`${users.length} משתמשים יוצאו בהצלחה`);
                }

            } catch (error) {
                console.error('❌ Error exporting to CSV:', error);
                window.notify.error('שגיאה בייצוא לExcel. נסה שוב', 'שגיאה');
            }
        }

        /**
         * Get role text in Hebrew
         * קבלת תפקיד בעברית
         *
         * @param {string} role - Role key
         * @returns {string} Hebrew role text
         */
        getRoleText(role) {
            const roles = {
                'admin': 'מנהל',
                'lawyer': 'עורך דין',
                'employee': 'עובד',
                'intern': 'מתמחה'
            };
            return roles[role] || role || 'לא מוגדר';
        }
    }

    // Create global instance
    const dataManager = new DataManager();

    // Make DataManager available globally
    window.DataManager = dataManager;

    // Auto-initialize when Firebase is ready
    if (window.FirebaseManager && window.FirebaseManager.initialized) {
        dataManager.init();
    } else {
        window.addEventListener('firebase:ready', () => {
            dataManager.init();
        });
    }

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = dataManager;
    }

})();
