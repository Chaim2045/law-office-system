/**
 * Monitoring Dashboard Controller
 * בקר דשבורד ניטור עובדים
 *
 * @module MonitoringDashboard
 * @version 1.0.0
 * @created 2025-11-25
 */

import {
    EmployeeMonitor
} from './employee-monitor.js';

import {
    TasksMonitor
} from './tasks-monitor.js';

import {
    AlertsManager
} from './alerts-manager.js';

import {
    PerformanceAnalyzer
} from './performance-analyzer.js';

import {
    RealtimeDataManager
} from './realtime-data-manager.js';

class MonitoringDashboard {
    constructor() {
        // Core Managers
        this.realtimeManager = null;
        this.employeeMonitor = null;
        this.tasksMonitor = null;
        this.alertsManager = null;
        this.performanceAnalyzer = null;

        // State
        this.state = {
            employees: new Map(),
            tasks: new Map(),
            alerts: [],
            clients: new Map(),
            activities: [],
            lastUpdate: null
        };

        // Configuration
        this.config = {
            refreshInterval: 30000, // 30 seconds
            maxActivities: 100,
            alertThresholds: {
                idleMinutes: 15,
                overdueHours: 24,
                lowProductivityPercent: 60
            }
        };

        // DOM Elements
        this.elements = {};

        // Listeners
        this.listeners = new Map();
    }

    /**
     * Initialize Dashboard
     */
    async init() {
        try {
            console.log('🚀 Initializing Monitoring Dashboard...');

            // Check Firebase connection
            if (!window.firebaseDB) {
                throw new Error('Firebase not connected');
            }

            // Initialize DOM elements
            this.initializeDOMElements();

            // Initialize managers
            await this.initializeManagers();

            // Setup event listeners
            this.setupEventListeners();

            // Start real-time monitoring
            await this.startMonitoring();

            // Initial data load
            await this.loadInitialData();

            console.log('✅ Monitoring Dashboard initialized successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize dashboard:', error);
            this.showError('Failed to initialize dashboard');
            return false;
        }
    }

    /**
     * Initialize DOM Elements
     */
    initializeDOMElements() {
        this.elements = {
            // Employee Section
            employeeGrid: document.getElementById('employeeGrid'),
            statusFilter: document.getElementById('statusFilter'),

            // Activity Section
            activityTimeline: document.getElementById('activityTimeline'),
            activityCounter: document.getElementById('activityCounter'),

            // Alerts Section
            alertsContainer: document.getElementById('alertsContainer'),
            criticalCount: document.getElementById('criticalCount'),
            warningCount: document.getElementById('warningCount'),
            infoCount: document.getElementById('infoCount'),

            // Tasks Section
            pendingTasks: document.getElementById('pendingTasks'),
            inProgressTasks: document.getElementById('inProgressTasks'),
            overdueTasks: document.getElementById('overdueTasks'),
            completedTasks: document.getElementById('completedTasks'),
            upcomingDeadlines: document.querySelector('.deadlines-list'),

            // Clients Section
            activeClients: document.getElementById('activeClients'),
            criticalCases: document.getElementById('criticalCases'),
            pendingActions: document.getElementById('pendingActions'),
            clientsGrid: document.getElementById('clientsGrid'),

            // Performance Section
            performanceGrid: document.getElementById('performanceGrid'),
            performancePeriod: document.getElementById('performancePeriod'),

            // Modals
            employeeDetailModal: document.getElementById('employeeDetailModal'),
            alertDetailModal: document.getElementById('alertDetailModal'),

            // FAB
            fabMain: document.getElementById('fabMain'),
            fabMenu: document.getElementById('fabMenu'),

            // Actions
            refreshBtn: document.getElementById('refreshBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            logoutBtn: document.getElementById('logoutBtn')
        };
    }

    /**
     * Initialize Managers
     */
    async initializeManagers() {
        // Real-time Data Manager
        this.realtimeManager = new RealtimeDataManager();
        await this.realtimeManager.init();

        // Employee Monitor
        this.employeeMonitor = new EmployeeMonitor(this.realtimeManager);
        await this.employeeMonitor.init();

        // Tasks Monitor
        this.tasksMonitor = new TasksMonitor(this.realtimeManager);
        await this.tasksMonitor.init();

        // Alerts Manager
        this.alertsManager = new AlertsManager();
        await this.alertsManager.init();

        // Performance Analyzer
        this.performanceAnalyzer = new PerformanceAnalyzer();
        await this.performanceAnalyzer.init();
    }

    /**
     * Setup Event Listeners
     */
    setupEventListeners() {
        // Refresh Button
        this.elements.refreshBtn?.addEventListener('click', () => {
            this.refresh();
        });

        // Status Filter
        this.elements.statusFilter?.addEventListener('change', (e) => {
            this.filterEmployees(e.target.value);
        });

        // Performance Period
        this.elements.performancePeriod?.addEventListener('change', (e) => {
            this.updatePerformanceMetrics(e.target.value);
        });

        // FAB Menu
        this.elements.fabMain?.addEventListener('click', () => {
            this.toggleFABMenu();
        });

        // FAB Options
        document.querySelectorAll('.fab-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleFABAction(action);
            });
        });

        // Modal Close Buttons
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModals();
            });
        });

        // Logout
        this.elements.logoutBtn?.addEventListener('click', () => {
            this.logout();
        });
    }

    /**
     * Start Monitoring
     */
    async startMonitoring() {
        // Setup real-time listeners for employees
        this.listeners.set('employees',
            this.realtimeManager.onEmployeeUpdate((data) => {
                this.updateEmployeeStatus(data);
            })
        );

        // Setup real-time listeners for tasks
        this.listeners.set('tasks',
            this.realtimeManager.onTaskUpdate((data) => {
                this.updateTasksStatus(data);
            })
        );

        // Setup real-time listeners for activities
        this.listeners.set('activities',
            this.realtimeManager.onActivityUpdate((activity) => {
                this.addActivity(activity);
            })
        );

        // Setup periodic refresh
        this.refreshInterval = setInterval(() => {
            this.checkForAnomalies();
            this.updateMetrics();
        }, this.config.refreshInterval);
    }

    /**
     * Load Initial Data
     */
    async loadInitialData() {
        try {
            // Show loading state
            this.showLoading();

            // Load employees
            const employees = await this.employeeMonitor.loadAllEmployees();
            this.renderEmployees(employees);

            // Load tasks
            const tasks = await this.tasksMonitor.loadAllTasks();
            this.renderTasksSummary(tasks);

            // Load recent activities
            const activities = await this.loadRecentActivities();
            this.renderActivities(activities);

            // Load clients
            const clients = await this.loadActiveClients();
            this.renderClients(clients);

            // Initial anomaly check
            await this.checkForAnomalies();

            // Hide loading state
            this.hideLoading();

        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    /**
     * Render Employees Grid
     */
    renderEmployees(employees) {
        if (!this.elements.employeeGrid) return;

        const html = Array.from(employees.values()).map(employee => {
            const status = this.getEmployeeStatus(employee);
            const initials = this.getInitials(employee.name || employee.email);

            return `
                <div class="employee-card" data-employee-id="${employee.id}">
                    <div class="employee-status ${status}"></div>
                    <div class="employee-avatar">${initials}</div>
                    <div class="employee-name">${employee.name || 'Unknown'}</div>
                    <div class="employee-role">${employee.role || 'Employee'}</div>
                    <div class="employee-task">${employee.currentTask || 'לא מוגדר'}</div>
                    <div class="employee-metrics">
                        <div class="metric">
                            <div class="metric-value">${employee.tasksToday || 0}</div>
                            <div class="metric-label">משימות</div>
                        </div>
                        <div class="metric">
                            <div class="metric-value">${employee.hoursToday || 0}</div>
                            <div class="metric-label">שעות</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.elements.employeeGrid.innerHTML = html;

        // Add click listeners to employee cards
        document.querySelectorAll('.employee-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const employeeId = e.currentTarget.dataset.employeeId;
                this.showEmployeeDetails(employeeId);
            });
        });
    }

    /**
     * Get Employee Status
     */
    getEmployeeStatus(employee) {
        if (!employee.lastActivity) return 'offline';

        const now = Date.now();
        const lastActivity = employee.lastActivity?.toMillis ?
            employee.lastActivity.toMillis() :
            new Date(employee.lastActivity).getTime();

        const idleMinutes = (now - lastActivity) / 60000;

        if (idleMinutes < 5) return 'online';
        if (idleMinutes < this.config.alertThresholds.idleMinutes) return 'idle';
        return 'offline';
    }

    /**
     * Render Tasks Summary
     */
    renderTasksSummary(tasks) {
        const summary = {
            pending: 0,
            inProgress: 0,
            overdue: 0,
            completedToday: 0,
            upcomingDeadlines: []
        };

        const now = Date.now();
        const todayStart = new Date().setHours(0, 0, 0, 0);

        tasks.forEach(task => {
            // Count by status
            if (task.status === 'ממתין') summary.pending++;
            else if (task.status === 'בביצוע') summary.inProgress++;
            else if (task.status === 'הושלם' && task.completedAt > todayStart) {
                summary.completedToday++;
            }

            // Check for overdue
            if (task.deadline && task.deadline < now && task.status !== 'הושלם') {
                summary.overdue++;
            }

            // Collect upcoming deadlines (next 7 days)
            if (task.deadline && task.status !== 'הושלם') {
                const daysUntil = Math.ceil((task.deadline - now) / 86400000);
                if (daysUntil > 0 && daysUntil <= 7) {
                    summary.upcomingDeadlines.push({
                        ...task,
                        daysUntil
                    });
                }
            }
        });

        // Update counters
        this.elements.pendingTasks.textContent = summary.pending;
        this.elements.inProgressTasks.textContent = summary.inProgress;
        this.elements.overdueTasks.textContent = summary.overdue;
        this.elements.completedTasks.textContent = summary.completedToday;

        // Render upcoming deadlines
        this.renderUpcomingDeadlines(summary.upcomingDeadlines);
    }

    /**
     * Render Upcoming Deadlines
     */
    renderUpcomingDeadlines(deadlines) {
        if (!this.elements.upcomingDeadlines) return;

        // Sort by deadline
        deadlines.sort((a, b) => a.deadline - b.deadline);

        // Take top 5
        const topDeadlines = deadlines.slice(0, 5);

        const html = topDeadlines.map(task => {
            const urgencyClass = task.daysUntil <= 1 ? 'urgent' :
                                task.daysUntil <= 3 ? 'soon' : 'normal';

            return `
                <div class="deadline-item ${urgencyClass}">
                    <div class="deadline-content">
                        <div class="deadline-task">${task.title || 'משימה ללא שם'}</div>
                        <div class="deadline-client">${task.clientName || 'לקוח לא מוגדר'}</div>
                    </div>
                    <div class="deadline-time">
                        <div class="deadline-date">${this.formatDate(task.deadline)}</div>
                        <div class="deadline-days">בעוד ${task.daysUntil} ימים</div>
                    </div>
                </div>
            `;
        }).join('');

        this.elements.upcomingDeadlines.innerHTML = html || '<div class="no-deadlines">אין דדליינים קרובים</div>';
    }

    /**
     * Render Activities
     */
    renderActivities(activities) {
        if (!this.elements.activityTimeline) return;

        const html = activities.slice(0, 20).map(activity => {
            const icon = this.getActivityIcon(activity.type);
            const timeAgo = this.getTimeAgo(activity.timestamp);

            return `
                <div class="activity-item">
                    <div class="activity-icon ${activity.type}">
                        <i class="fas fa-${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-description">${activity.description}</div>
                        <div class="activity-time">${timeAgo}</div>
                    </div>
                </div>
            `;
        }).join('');

        this.elements.activityTimeline.innerHTML = html || '<div class="no-activities">אין פעילויות להצגה</div>';

        // Update counter
        const todayActivities = activities.filter(a => {
            const activityDate = new Date(a.timestamp);
            const today = new Date();
            return activityDate.toDateString() === today.toDateString();
        }).length;

        this.elements.activityCounter.textContent = `${todayActivities} פעילויות היום`;
    }

    /**
     * Check for Anomalies
     */
    async checkForAnomalies() {
        const alerts = [];
        const now = Date.now();

        // Check employee anomalies
        this.state.employees.forEach(employee => {
            // Check idle time
            if (employee.lastActivity) {
                const idleMinutes = (now - employee.lastActivity) / 60000;
                if (idleMinutes > this.config.alertThresholds.idleMinutes) {
                    alerts.push({
                        type: 'warning',
                        title: 'עובד לא פעיל',
                        message: `${employee.name} לא פעיל מעל ${Math.round(idleMinutes)} דקות`,
                        timestamp: now,
                        employeeId: employee.id
                    });
                }
            }

            // Check low productivity
            const productivity = this.calculateProductivity(employee);
            if (productivity < this.config.alertThresholds.lowProductivityPercent) {
                alerts.push({
                    type: 'info',
                    title: 'פרודוקטיביות נמוכה',
                    message: `${employee.name} - פרודוקטיביות של ${productivity}% בלבד`,
                    timestamp: now,
                    employeeId: employee.id
                });
            }
        });

        // Check task anomalies
        this.state.tasks.forEach(task => {
            // Check overdue tasks
            if (task.deadline && task.deadline < now && task.status !== 'הושלם') {
                const hoursOverdue = (now - task.deadline) / 3600000;
                if (hoursOverdue > this.config.alertThresholds.overdueHours) {
                    alerts.push({
                        type: 'critical',
                        title: 'משימה באיחור חמור',
                        message: `"${task.title}" - באיחור של ${Math.round(hoursOverdue)} שעות`,
                        timestamp: now,
                        taskId: task.id
                    });
                }
            }
        });

        // Update alerts
        this.updateAlerts(alerts);
    }

    /**
     * Update Alerts
     */
    updateAlerts(alerts) {
        // Count by type
        const counts = {
            critical: 0,
            warning: 0,
            info: 0
        };

        alerts.forEach(alert => {
            counts[alert.type]++;
        });

        // Update badges
        this.elements.criticalCount.textContent = counts.critical;
        this.elements.warningCount.textContent = counts.warning;
        this.elements.infoCount.textContent = counts.info;

        // Render alerts
        const html = alerts.slice(0, 10).map(alert => `
            <div class="alert-item ${alert.type}" data-alert-id="${alert.id || ''}">
                <div class="alert-header">
                    <div class="alert-title">${alert.title}</div>
                    <div class="alert-timestamp">${this.getTimeAgo(alert.timestamp)}</div>
                </div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-action">לחץ לפרטים נוספים</div>
            </div>
        `).join('');

        this.elements.alertsContainer.innerHTML = html || '<div class="no-alerts">אין התראות</div>';

        // Add click listeners
        document.querySelectorAll('.alert-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const alertId = e.currentTarget.dataset.alertId;
                this.showAlertDetails(alertId);
            });
        });
    }

    /**
     * Load Recent Activities
     */
    async loadRecentActivities() {
        try {
            const db = window.firebaseDB;
            const snapshot = await db.collection('activities')
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();

            const activities = [];
            snapshot.forEach(doc => {
                activities.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return activities;

        } catch (error) {
            console.error('Error loading activities:', error);
            return [];
        }
    }

    /**
     * Load Active Clients
     */
    async loadActiveClients() {
        try {
            const db = window.firebaseDB;
            const snapshot = await db.collection('clients')
                .where('status', '==', 'active')
                .limit(50)
                .get();

            const clients = new Map();
            snapshot.forEach(doc => {
                clients.set(doc.id, {
                    id: doc.id,
                    ...doc.data()
                });
            });

            return clients;

        } catch (error) {
            console.error('Error loading clients:', error);
            return new Map();
        }
    }

    /**
     * Render Clients
     */
    renderClients(clients) {
        // Update stats
        const stats = {
            active: 0,
            critical: 0,
            pending: 0
        };

        clients.forEach(client => {
            if (client.status === 'active') stats.active++;
            if (client.priority === 'critical') stats.critical++;
            if (client.hasPendingActions) stats.pending++;
        });

        this.elements.activeClients.textContent = stats.active;
        this.elements.criticalCases.textContent = stats.critical;
        this.elements.pendingActions.textContent = stats.pending;

        // Render grid
        const html = Array.from(clients.values()).slice(0, 8).map(client => `
            <div class="client-card" data-client-id="${client.id}">
                <div class="client-header">
                    <div class="client-name">${client.name}</div>
                    ${client.priority === 'critical' ? '<span class="priority-badge">קריטי</span>' : ''}
                </div>
                <div class="client-info">
                    <div class="client-case">${client.caseNumber || 'ללא מספר תיק'}</div>
                    <div class="client-status">${client.status || 'לא מוגדר'}</div>
                </div>
                <div class="client-actions">
                    <span class="action-count">${client.pendingActions || 0} פעולות ממתינות</span>
                </div>
            </div>
        `).join('');

        if (this.elements.clientsGrid) {
            this.elements.clientsGrid.innerHTML = html;
        }
    }

    /**
     * Helper Functions
     */
    getInitials(name) {
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return parts[0][0] + parts[1][0];
        }
        return name.substring(0, 2).toUpperCase();
    }

    getActivityIcon(type) {
        const icons = {
            task: 'tasks',
            client: 'user',
            alert: 'bell',
            system: 'cog',
            default: 'circle'
        };
        return icons[type] || icons.default;
    }

    getTimeAgo(timestamp) {
        const now = Date.now();
        const time = timestamp?.toMillis ? timestamp.toMillis() : new Date(timestamp).getTime();
        const diff = now - time;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'כרגע';
        if (minutes < 60) return `לפני ${minutes} דקות`;
        if (hours < 24) return `לפני ${hours} שעות`;
        return `לפני ${days} ימים`;
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('he-IL');
    }

    calculateProductivity(employee) {
        // Simple productivity calculation
        const expectedTasks = 8;
        const completedTasks = employee.tasksToday || 0;
        return Math.min(100, Math.round((completedTasks / expectedTasks) * 100));
    }

    /**
     * UI Actions
     */
    refresh() {
        console.log('Refreshing dashboard...');
        this.loadInitialData();
    }

    filterEmployees(filter) {
        console.log('Filtering employees:', filter);
        // Implement filtering logic
    }

    updatePerformanceMetrics(period) {
        console.log('Updating performance metrics for:', period);
        // Implement performance update logic
    }

    toggleFABMenu() {
        this.elements.fabMain.classList.toggle('active');
        this.elements.fabMenu.classList.toggle('active');
    }

    handleFABAction(action) {
        console.log('FAB action:', action);
        this.toggleFABMenu();
        // Implement action handlers
    }

    showEmployeeDetails(employeeId) {
        console.log('Showing employee details:', employeeId);
        // Implement employee details modal
    }

    showAlertDetails(alertId) {
        console.log('Showing alert details:', alertId);
        // Implement alert details modal
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    showLoading() {
        // Implement loading state
    }

    hideLoading() {
        // Implement hiding loading state
    }

    showError(message) {
        console.error(message);
        // Implement error display
    }

    async logout() {
        try {
            await firebase.auth().signOut();
            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        // Clear intervals
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Remove listeners
        this.listeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });

        // Clear state
        this.state = {
            employees: new Map(),
            tasks: new Map(),
            alerts: [],
            clients: new Map(),
            activities: []
        };
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Firebase to be ready
    if (!window.firebaseDB) {
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (window.firebaseDB) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }

    // Create and initialize dashboard
    window.monitoringDashboard = new MonitoringDashboard();
    await window.monitoringDashboard.init();
});

export default MonitoringDashboard;