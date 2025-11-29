/**
 * Dashboard UI Manager
 * מנהל תצוגת Dashboard
 *
 * נוצר: 31/10/2025
 * גרסה: 1.0.0
 * Phase: 2 - Dashboard UI
 *
 * תפקיד: ניהול תצוגת Dashboard, תיאום בין קומפוננטות
 */

(function() {
    'use strict';

    /**
     * DashboardUI Class
     * מנהל את תצוגת הדשבורד
     */
    class DashboardUI {
        constructor() {
            this.dataManager = null;
            this.statsCards = null;
            this.usersTable = null;
            this.filterBar = null;
            this.pagination = null;

            // DOM Elements
            this.dashboardContent = null;
            this.loadingIndicator = null;
            this.errorMessage = null;

            // State
            this.isInitialized = false;
            this.isRendered = false;
        }

        /**
         * Initialize Dashboard UI
         * אתחול ממשק הדשבורד
         */
        async init() {
            try {
                console.log('🎨 DashboardUI: Initializing...');

                // Wait for DataManager
                if (!window.DataManager) {
                    console.error('❌ DashboardUI: DataManager not found');
                    return false;
                }

                this.dataManager = window.DataManager;

                // Wait for other UI components
                this.statsCards = window.StatsCards;
                this.usersTable = window.UsersTable;
                this.filterBar = window.FilterBar;
                this.pagination = window.PaginationUI;

                // Get DOM elements
                this.getDOMElements();

                // Setup event listeners
                this.setupEventListeners();

                this.isInitialized = true;

                console.log('✅ DashboardUI: Initialized successfully');

                // Auto-render
                await this.render();

                return true;

            } catch (error) {
                console.error('❌ DashboardUI: Initialization error:', error);
                return false;
            }
        }

        /**
         * Get DOM elements
         * קבלת אלמנטים מה-DOM
         */
        getDOMElements() {
            this.dashboardContent = document.getElementById('dashboardContent');

            // Create main containers if they don't exist
            if (this.dashboardContent) {
                this.dashboardContent.innerHTML = `
                    <div class="dashboard-inner">
                        <!-- Loading Indicator -->
                        <div id="dashboardLoading" class="dashboard-loading" style="display: none;">
                            <div class="loading-spinner">
                                <div class="spinner-circle"></div>
                                <p class="loading-text">טוען נתונים...</p>
                            </div>
                        </div>

                        <!-- Error Message -->
                        <div id="dashboardError" class="dashboard-error" style="display: none;">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h3>שגיאה בטעינת נתונים</h3>
                            <p id="dashboardErrorText"></p>
                            <button class="btn-retry" id="retryButton">
                                <i class="fas fa-redo"></i>
                                נסה שוב
                            </button>
                        </div>

                        <!-- Statistics Cards -->
                        <div id="statsContainer" class="stats-container" style="display: none;"></div>

                        <!-- Action Bar -->
                        <div id="actionBar" class="action-bar" style="display: none;">
                            <h2 class="section-title">ניהול עובדים</h2>
                            <!-- Add User button moved to FilterBar to avoid duplicate IDs -->
                        </div>

                        <!-- Filter Bar -->
                        <div id="filterContainer" class="filter-container" style="display: none;"></div>

                        <!-- Users Table -->
                        <div id="tableContainer" class="table-container" style="display: none;"></div>

                        <!-- Pagination -->
                        <div id="paginationContainer" class="pagination-container" style="display: none;"></div>
                    </div>
                `;

                // Update references
                this.loadingIndicator = document.getElementById('dashboardLoading');
                this.errorMessage = document.getElementById('dashboardError');
            }
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEventListeners() {
            // Retry button
            const retryButton = document.getElementById('retryButton');
            if (retryButton) {
                retryButton.addEventListener('click', () => this.handleRetry());
            }

            // Add User button removed - now handled by FilterBar to avoid duplicate IDs

            // Listen to filter changes
            window.addEventListener('filter:changed', (e) => this.handleFilterChange(e.detail));

            // Listen to pagination changes
            window.addEventListener('pagination:changed', (e) => this.handlePaginationChange(e.detail));

            // Listen to data refresh
            window.addEventListener('data:refresh', () => this.handleRefresh());
        }

        /**
         * Render Dashboard
         * רינדור הדשבורד
         */
        async render() {
            try {
                console.log('🎨 DashboardUI: Rendering...');

                // Show loading
                this.showLoading();

                // Load data
                const result = await this.dataManager.loadUsers();

                if (!result.success) {
                    this.showError(result.error || 'שגיאה בטעינת נתונים');
                    return;
                }

                // Hide loading
                this.hideLoading();

                // Render components
                this.renderStatistics(result.statistics);
                this.renderFilterBar();
                this.renderUsersTable();
                this.renderPagination();

                // Show containers
                this.showContainers();

                this.isRendered = true;

                console.log('✅ DashboardUI: Rendered successfully');

                // Setup real-time listeners after initial render
                this.dataManager.setupRealtimeListeners();

            } catch (error) {
                console.error('❌ DashboardUI: Render error:', error);
                this.showError('שגיאה בהצגת הדשבורד');
            }
        }

        /**
         * Render statistics cards
         * רינדור כרטיסי סטטיסטיקה
         */
        renderStatistics(statistics) {
            const container = document.getElementById('statsContainer');
            if (!container || !this.statsCards) {
return;
}

            this.statsCards.render(container, statistics);
        }

        /**
         * Render filter bar
         * רינדור סרגל פילטרים
         */
        renderFilterBar() {
            const container = document.getElementById('filterContainer');
            if (!container || !this.filterBar) {
return;
}

            this.filterBar.render(container);
        }

        /**
         * Render users table
         * רינדור טבלת משתמשים
         */
        renderUsersTable() {
            const container = document.getElementById('tableContainer');
            if (!container || !this.usersTable) {
return;
}

            const data = this.dataManager.getPaginatedUsers();
            this.usersTable.render(container, data.users);
        }

        /**
         * Render pagination
         * רינדור Pagination
         */
        renderPagination() {
            const container = document.getElementById('paginationContainer');
            if (!container || !this.pagination) {
return;
}

            const paginationData = this.dataManager.getPaginatedUsers().pagination;
            this.pagination.render(container, paginationData);
        }

        /**
         * Handle filter change
         * טיפול בשינוי פילטר
         */
        handleFilterChange(filterData) {
            console.log('🔍 Filter changed:', filterData);

            // Update data manager filters
            if (filterData.type === 'search') {
                this.dataManager.setSearch(filterData.value);
            } else if (filterData.type === 'role') {
                this.dataManager.setRoleFilter(filterData.value);
            } else if (filterData.type === 'status') {
                this.dataManager.setStatusFilter(filterData.value);
            } else if (filterData.type === 'sort') {
                this.dataManager.setSort(filterData.sortBy, filterData.sortOrder);
            }

            // Re-render table and pagination
            this.renderUsersTable();
            this.renderPagination();
        }

        /**
         * Handle pagination change
         * טיפול בשינוי עמוד
         */
        handlePaginationChange(paginationData) {
            console.log('📄 Pagination changed:', paginationData);

            if (paginationData.type === 'page') {
                this.dataManager.setPage(paginationData.page);
            } else if (paginationData.type === 'itemsPerPage') {
                this.dataManager.setItemsPerPage(paginationData.itemsPerPage);
            }

            // Re-render table and pagination
            this.renderUsersTable();
            this.renderPagination();

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        /**
         * Handle refresh
         * טיפול ברענון נתונים
         */
        async handleRefresh() {
            console.log('🔄 Refreshing dashboard...');

            this.showLoading();

            const result = await this.dataManager.refresh();

            this.hideLoading();

            if (result.success) {
                // Re-render all
                this.renderStatistics(result.statistics);
                this.renderUsersTable();
                this.renderPagination();

                this.showNotification('הנתונים עודכנו בהצלחה', 'success');
            } else {
                this.showError(result.error || 'שגיאה בעדכון נתונים');
            }
        }

        /**
         * Handle retry
         * טיפול בניסיון חוזר
         */
        async handleRetry() {
            this.hideError();
            await this.render();
        }

        /**
         * Show loading indicator
         * הצגת מסך טעינה
         */
        showLoading() {
            if (this.loadingIndicator) {
                this.loadingIndicator.style.display = 'flex';
            }

            // Hide containers
            this.hideContainers();
        }

        /**
         * Hide loading indicator
         * הסתרת מסך טעינה
         */
        hideLoading() {
            if (this.loadingIndicator) {
                this.loadingIndicator.style.display = 'none';
            }
        }

        /**
         * Show error message
         * הצגת הודעת שגיאה
         */
        showError(errorText) {
            if (this.errorMessage) {
                document.getElementById('dashboardErrorText').textContent = errorText;
                this.errorMessage.style.display = 'flex';
            }

            // Hide containers
            this.hideContainers();
            this.hideLoading();
        }

        /**
         * Hide error message
         * הסתרת הודעת שגיאה
         */
        hideError() {
            if (this.errorMessage) {
                this.errorMessage.style.display = 'none';
            }
        }

        /**
         * Show containers
         * הצגת קונטיינרים
         */
        showContainers() {
            const containers = [
                'statsContainer',
                'actionBar',
                'filterContainer',
                'tableContainer',
                'paginationContainer'
            ];

            containers.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
el.style.display = id === 'actionBar' ? 'flex' : 'block';
}
            });
        }

        /**
         * Hide containers
         * הסתרת קונטיינרים
         */
        hideContainers() {
            const containers = [
                'statsContainer',
                'actionBar',
                'filterContainer',
                'tableContainer',
                'paginationContainer'
            ];

            containers.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
el.style.display = 'none';
}
            });
        }

        /**
         * Show notification
         * הצגת התראה
         */
        showNotification(message, type = 'info') {
            // Simple alert for now (will be replaced with proper notification system in Phase 3)
            console.log(`📢 Notification [${type}]:`, message);

            // You can implement a toast notification here
            // For now, just log it
        }

        /**
         * Handle add user
         * טיפול בהוספת משתמש חדש
         */
        /**
         * @deprecated This method is no longer used.
         * Add User button moved to FilterBar to avoid duplicate ID conflicts.
         * FilterBar now handles the "Add Employee" button and calls UsersActionsManager.addNewUser()
         */
        handleAddUser() {
            console.warn('⚠️ DashboardUI.handleAddUser() is deprecated. Use FilterBar button instead.');

            // Fallback: redirect to UsersActionsManager
            if (window.UsersActionsManager) {
                window.UsersActionsManager.addNewUser();
            }
        }

        /**
         * Destroy Dashboard UI
         * השמדת הממשק
         */
        destroy() {
            // Remove event listeners
            window.removeEventListener('filter:changed', this.handleFilterChange);
            window.removeEventListener('pagination:changed', this.handlePaginationChange);
            window.removeEventListener('data:refresh', this.handleRefresh);

            // Clear DOM
            if (this.dashboardContent) {
                this.dashboardContent.innerHTML = '';
            }

            this.isInitialized = false;
            this.isRendered = false;

            console.log('🗑️ DashboardUI: Destroyed');
        }
    }

    // Create global instance
    const dashboardUI = new DashboardUI();

    // Make DashboardUI available globally
    window.DashboardUI = dashboardUI;

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = dashboardUI;
    }

})();
