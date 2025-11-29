/**
 * Filter Bar Component
 * קומפוננטת סרגל פילטרים
 *
 * נוצר: 31/10/2025
 * גרסה: 1.0.0
 * Phase: 2 - Dashboard UI
 *
 * תפקיד: חיפוש, סינון, ומיון משתמשים
 */

(function() {
    'use strict';

    /**
     * FilterBar Class
     * מנהל את סרגל הפילטרים
     */
    class FilterBar {
        constructor() {
            this.searchTimeout = null;
            this.searchDelay = 300; // 300ms debounce
        }

        /**
         * Render filter bar
         * רינדור סרגל פילטרים
         */
        render(container) {
            if (!container) {
                console.error('❌ FilterBar: Container not found');
                return;
            }

            const html = `
                <div class="filter-bar">
                    <!-- Search -->
                    <div class="filter-section search-section">
                        <div class="search-box">
                            <i class="fas fa-search search-icon"></i>
                            <input
                                type="text"
                                id="searchInput"
                                class="search-input"
                                placeholder="חיפוש לפי שם או אימייל..."
                                autocomplete="off"
                            >
                            <button class="search-clear" id="searchClear" style="display: none;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Filters -->
                    <div class="filter-section filters-section">
                        <!-- Role Filter -->
                        <div class="filter-group">
                            <label class="filter-label">תפקיד:</label>
                            <select id="roleFilter" class="filter-select">
                                <option value="all">הכל</option>
                                <option value="admin">מנהל</option>
                                <option value="user">משתמש</option>
                            </select>
                        </div>

                        <!-- Status Filter -->
                        <div class="filter-group">
                            <label class="filter-label">סטטוס:</label>
                            <select id="statusFilter" class="filter-select">
                                <option value="all">הכל</option>
                                <option value="active">פעיל</option>
                                <option value="blocked">חסום</option>
                            </select>
                        </div>

                        <!-- Refresh Button -->
                        <button class="btn-filter btn-refresh" id="refreshButton" title="רענן נתונים">
                            <i class="fas fa-sync-alt"></i>
                        </button>

                        <!-- Export to Excel Button -->
                        <button class="btn-filter btn-secondary" id="exportButton" title="ייצוא לExcel">
                            <i class="fas fa-file-excel"></i>
                            <span>ייצוא לExcel</span>
                        </button>

                        <!-- Add User Button -->
                        <button class="btn-filter btn-primary" id="addUserButton" title="הוספת משתמש חדש">
                            <i class="fas fa-user-plus"></i>
                            <span>הוסף משתמש</span>
                        </button>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Setup event listeners
            this.setupEvents();

            console.log('✅ FilterBar: Rendered');
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEvents() {
            // Search input
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.handleSearch(e.target.value);
                    this.toggleClearButton(e.target.value);
                });

                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.handleSearchImmediate(e.target.value);
                    }
                });
            }

            // Search clear button
            const searchClear = document.getElementById('searchClear');
            if (searchClear) {
                searchClear.addEventListener('click', () => {
                    this.clearSearch();
                });
            }

            // Role filter
            const roleFilter = document.getElementById('roleFilter');
            if (roleFilter) {
                roleFilter.addEventListener('change', (e) => {
                    this.handleRoleFilter(e.target.value);
                });
            }

            // Status filter
            const statusFilter = document.getElementById('statusFilter');
            if (statusFilter) {
                statusFilter.addEventListener('change', (e) => {
                    this.handleStatusFilter(e.target.value);
                });
            }

            // Refresh button
            const refreshButton = document.getElementById('refreshButton');
            if (refreshButton) {
                refreshButton.addEventListener('click', () => {
                    this.handleRefresh();
                });
            }

            // Export to Excel button
            const exportButton = document.getElementById('exportButton');
            if (exportButton) {
                exportButton.addEventListener('click', () => {
                    if (window.DataManager) {
                        window.DataManager.exportToCSV();
                    } else {
                        console.error('❌ DataManager not available');
                    }
                });
            }

            // Add user button - prevent duplicate listeners
            const addUserButton = document.getElementById('addUserButton');
            if (addUserButton && !addUserButton.dataset.listenerAdded) {
                addUserButton.dataset.listenerAdded = 'true';
                addUserButton.addEventListener('click', () => {
                    console.log('🔵 [FilterBar] Add User button clicked');
                    if (window.UsersActionsManager) {
                        window.UsersActionsManager.addNewUser();
                    } else {
                        console.error('❌ UsersActionsManager not available');
                    }
                });
            }
        }

        /**
         * Handle search with debounce
         * טיפול בחיפוש עם השהיה
         */
        handleSearch(searchTerm) {
            // Clear previous timeout
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }

            // Set new timeout
            this.searchTimeout = setTimeout(() => {
                this.emitSearchEvent(searchTerm);
            }, this.searchDelay);
        }

        /**
         * Handle immediate search (Enter key)
         * טיפול בחיפוש מיידי
         */
        handleSearchImmediate(searchTerm) {
            // Clear timeout
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }

            this.emitSearchEvent(searchTerm);
        }

        /**
         * Emit search event
         * שליחת אירוע חיפוש
         */
        emitSearchEvent(searchTerm) {
            console.log('🔍 Search:', searchTerm);

            window.dispatchEvent(new CustomEvent('filter:changed', {
                detail: {
                    type: 'search',
                    value: searchTerm
                }
            }));
        }

        /**
         * Handle role filter
         * טיפול בסינון תפקיד
         */
        handleRoleFilter(role) {
            console.log('👥 Role filter:', role);

            window.dispatchEvent(new CustomEvent('filter:changed', {
                detail: {
                    type: 'role',
                    value: role
                }
            }));
        }

        /**
         * Handle status filter
         * טיפול בסינון סטטוס
         */
        handleStatusFilter(status) {
            console.log('📊 Status filter:', status);

            window.dispatchEvent(new CustomEvent('filter:changed', {
                detail: {
                    type: 'status',
                    value: status
                }
            }));
        }

        /**
         * Handle refresh
         * טיפול ברענון
         */
        handleRefresh() {
            console.log('🔄 Refresh clicked');

            // Add spinning animation
            const refreshButton = document.getElementById('refreshButton');
            const icon = refreshButton.querySelector('i');

            if (icon) {
                icon.classList.add('fa-spin');

                setTimeout(() => {
                    icon.classList.remove('fa-spin');
                }, 1000);
            }

            // Emit refresh event
            window.dispatchEvent(new CustomEvent('data:refresh'));
        }

        /**
         * Toggle clear button visibility
         * החלפת נראות כפתור ניקוי
         */
        toggleClearButton(value) {
            const clearButton = document.getElementById('searchClear');
            if (clearButton) {
                clearButton.style.display = value ? 'flex' : 'none';
            }
        }

        /**
         * Clear search
         * ניקוי חיפוש
         */
        clearSearch() {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
                this.toggleClearButton('');
                this.handleSearchImmediate('');
            }
        }

        /**
         * Reset all filters
         * איפוס כל הפילטרים
         */
        resetFilters() {
            // Clear search
            this.clearSearch();

            // Reset role filter
            const roleFilter = document.getElementById('roleFilter');
            if (roleFilter) {
                roleFilter.value = 'all';
            }

            // Reset status filter
            const statusFilter = document.getElementById('statusFilter');
            if (statusFilter) {
                statusFilter.value = 'all';
            }

            console.log('🔄 Filters reset');
        }

        /**
         * Get current filters
         * קבלת פילטרים נוכחיים
         */
        getCurrentFilters() {
            const searchInput = document.getElementById('searchInput');
            const roleFilter = document.getElementById('roleFilter');
            const statusFilter = document.getElementById('statusFilter');

            return {
                search: searchInput ? searchInput.value : '',
                role: roleFilter ? roleFilter.value : 'all',
                status: statusFilter ? statusFilter.value : 'all'
            };
        }
    }

    // Create global instance
    const filterBar = new FilterBar();

    // Make FilterBar available globally
    window.FilterBar = filterBar;

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = filterBar;
    }

})();
