/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║                   Fluent Clients Manager                               ║
 * ╠═══════════════════════════════════════════════════════════════════════╣
 * ║  Main controller for the Fluent Design client management system       ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

window.FluentClientsManager = {
    /**
     * Initialize the Fluent Clients Manager
     */
    async init() {
        console.log('🚀 Initializing Fluent Clients Manager...');

        try {
            // Initialize the data grid
            if (window.FluentDataGrid) {
                await window.FluentDataGrid.init();
            }

            // Set up additional features
            this.setupAdvancedFeatures();

            // Initialize keyboard shortcuts
            this.initKeyboardShortcuts();

            // Set up auto-refresh
            this.setupAutoRefresh();

            console.log('✅ Fluent Clients Manager initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Fluent Clients Manager:', error);
        }
    },

    /**
     * Set up advanced features
     */
    setupAdvancedFeatures() {
        // Quick actions panel
        this.setupQuickActions();

        // Advanced filter panel
        this.setupAdvancedFilters();

        // Notification system
        this.setupNotifications();

        // Theme switcher
        this.setupThemeSwitcher();
    },

    /**
     * Set up quick actions panel
     */
    setupQuickActions() {
        // Close button
        document.getElementById('closeQuickActionsBtn')?.addEventListener('click', () => {
            const panel = document.getElementById('quickActionsPanel');
            if (panel) {
                panel.style.display = 'none';
            }
        });

        // Action buttons
        document.querySelectorAll('.fluent-action-button').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.querySelector('span').textContent;
                console.log('Quick action:', action);
                // TODO: Implement specific actions
            });
        });
    },

    /**
     * Set up advanced filters
     */
    setupAdvancedFilters() {
        const filterPanel = document.getElementById('filterPanel');
        if (!filterPanel) return;

        // Close button
        document.getElementById('closeFilterBtn')?.addEventListener('click', () => {
            filterPanel.style.display = 'none';
        });

        // Apply filters button
        filterPanel.querySelector('.fluent-button-primary')?.addEventListener('click', () => {
            this.applyFilters();
        });

        // Clear filters button
        filterPanel.querySelector('.fluent-button-secondary')?.addEventListener('click', () => {
            this.clearFilters();
        });

        // Filter chips
        filterPanel.querySelectorAll('.fluent-chip input').forEach(input => {
            input.addEventListener('change', () => {
                // Visual feedback
                const chip = input.closest('.fluent-chip');
                if (input.checked) {
                    chip.classList.add('selected');
                } else {
                    chip.classList.remove('selected');
                }
            });
        });
    },

    /**
     * Apply filters
     */
    applyFilters() {
        const filters = {
            status: [],
            service: [],
            dateRange: {}
        };

        // Collect status filters
        document.querySelectorAll('input[name="status"]:checked').forEach(input => {
            filters.status.push(input.value);
        });

        // Collect service filters
        document.querySelectorAll('input[name="service"]:checked').forEach(input => {
            filters.service.push(input.value);
        });

        // Collect date range
        const dateInputs = document.querySelectorAll('.date-range input[type="date"]');
        if (dateInputs[0]?.value) filters.dateRange.from = dateInputs[0].value;
        if (dateInputs[1]?.value) filters.dateRange.to = dateInputs[1].value;

        console.log('Applying filters:', filters);

        // Apply filters to data grid
        if (window.FluentDataGrid) {
            window.FluentDataGrid.filters = filters;
            // TODO: Implement filtering logic in data grid
            window.FluentDataGrid.refresh();
        }

        // Hide filter panel
        document.getElementById('filterPanel').style.display = 'none';
    },

    /**
     * Clear filters
     */
    clearFilters() {
        // Uncheck all filter checkboxes
        document.querySelectorAll('.fluent-chip input').forEach(input => {
            input.checked = false;
            input.closest('.fluent-chip').classList.remove('selected');
        });

        // Clear date inputs
        document.querySelectorAll('.date-range input[type="date"]').forEach(input => {
            input.value = '';
        });

        // Apply empty filters
        this.applyFilters();
    },

    /**
     * Set up notifications
     */
    setupNotifications() {
        // Listen for real-time updates
        if (window.firebaseDB) {
            window.firebaseDB.collection('clients')
                .onSnapshot((snapshot) => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added' && !this.isInitialLoad) {
                            this.showNotification('לקוח חדש נוסף', 'info');
                        } else if (change.type === 'modified') {
                            this.showNotification('פרטי לקוח עודכנו', 'info');
                        } else if (change.type === 'removed') {
                            this.showNotification('לקוח נמחק', 'warning');
                        }
                    });
                });

            // Mark initial load as complete after 2 seconds
            setTimeout(() => {
                this.isInitialLoad = false;
            }, 2000);
        }
    },

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (window.Notifications) {
            window.Notifications.show(message, type);
        } else {
            // Fallback to console
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    },

    /**
     * Set up theme switcher
     */
    setupThemeSwitcher() {
        // Add theme toggle button if not exists
        const commandBar = document.querySelector('.command-bar-secondary');
        if (commandBar && !document.getElementById('themeToggle')) {
            const themeToggle = document.createElement('button');
            themeToggle.id = 'themeToggle';
            themeToggle.className = 'fluent-command-button';
            themeToggle.innerHTML = `
                <i class="fas fa-moon"></i>
                <span>מצב כהה</span>
            `;
            themeToggle.addEventListener('click', () => this.toggleTheme());
            commandBar.appendChild(themeToggle);
        }
    },

    /**
     * Toggle theme
     */
    toggleTheme() {
        const body = document.body;
        const isDark = body.classList.contains('dark-theme');

        if (isDark) {
            body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
            this.updateThemeButton('dark');
        } else {
            body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
            this.updateThemeButton('light');
        }
    },

    /**
     * Update theme button
     */
    updateThemeButton(mode) {
        const btn = document.getElementById('themeToggle');
        if (btn) {
            if (mode === 'dark') {
                btn.innerHTML = `
                    <i class="fas fa-moon"></i>
                    <span>מצב כהה</span>
                `;
            } else {
                btn.innerHTML = `
                    <i class="fas fa-sun"></i>
                    <span>מצב בהיר</span>
                `;
            }
        }
    },

    /**
     * Initialize keyboard shortcuts
     */
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K: Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('fluentSearchInput')?.focus();
            }

            // Ctrl/Cmd + A: Select all (when in table)
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                const activeElement = document.activeElement;
                if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    document.getElementById('selectAllCheckbox')?.click();
                }
            }

            // Ctrl/Cmd + R: Refresh
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                document.getElementById('refreshCommand')?.click();
            }

            // Escape: Clear selection
            if (e.key === 'Escape') {
                if (window.FluentDataGrid) {
                    window.FluentDataGrid.selectedRows.clear();
                    window.FluentDataGrid.renderTable();
                }
            }
        });
    },

    /**
     * Set up auto-refresh
     */
    setupAutoRefresh() {
        // Refresh data every 5 minutes
        this.autoRefreshInterval = setInterval(() => {
            if (window.FluentDataGrid) {
                console.log('🔄 Auto-refreshing data...');
                window.FluentDataGrid.refresh();
            }
        }, 5 * 60 * 1000); // 5 minutes
    },

    /**
     * Cleanup on page unload
     */
    cleanup() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
    },

    // Initial load flag
    isInitialLoad: true
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    window.FluentClientsManager.cleanup();
});

// Apply saved theme on load
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        window.FluentClientsManager.updateThemeButton('light');
    }
});