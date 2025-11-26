/**
 * Realtime Data Manager
 * מנהל נתונים בזמן אמת לדשבורד ניטור
 *
 * @module RealtimeDataManager
 * @version 1.0.0
 * @created 2025-11-25
 */

export class RealtimeDataManager {
    constructor() {
        this.db = null;
        this.listeners = new Map();
        this.cache = new Map();
        this.subscriptions = new Map();

        // Configuration
        this.config = {
            cacheTimeout: 60000, // 1 minute
            batchSize: 50,
            reconnectDelay: 5000
        };

        // State
        this.isConnected = false;
        this.connectionRetries = 0;
    }

    /**
     * Initialize Manager
     */
    async init() {
        try {
            // Get Firebase instance
            this.db = window.firebaseDB;
            if (!this.db) {
                throw new Error('Firebase not initialized');
            }

            // Test connection
            await this.testConnection();

            this.isConnected = true;
            console.log('✅ RealtimeDataManager initialized');
            return true;

        } catch (error) {
            console.error('❌ RealtimeDataManager init failed:', error);
            this.scheduleReconnect();
            return false;
        }
    }

    /**
     * Test Firebase Connection
     */
    async testConnection() {
        try {
            // Try a simple query
            await this.db.collection('users').limit(1).get();
            return true;
        } catch (error) {
            throw new Error('Firebase connection test failed');
        }
    }

    /**
     * Schedule Reconnection Attempt
     */
    scheduleReconnect() {
        this.connectionRetries++;
        const delay = Math.min(
            this.config.reconnectDelay * this.connectionRetries,
            30000 // Max 30 seconds
        );

        setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            this.init();
        }, delay);
    }

    /**
     * ========================================
     * EMPLOYEE MONITORING
     * ========================================
     */

    /**
     * Monitor Employee Status in Real-time
     */
    onEmployeeUpdate(callback) {
        const unsubscribe = this.db.collection('users')
            .where('role', 'in', ['employee', 'admin', 'secretary'])
            .onSnapshot(
                (snapshot) => {
                    const employees = new Map();

                    snapshot.forEach(doc => {
                        const data = doc.data();
                        employees.set(doc.id, {
                            id: doc.id,
                            ...data,
                            // Add computed fields
                            isOnline: this.checkIfOnline(data.lastActivity),
                            currentStatus: this.getEmployeeStatus(data)
                        });
                    });

                    // Cache the data
                    this.cache.set('employees', {
                        data: employees,
                        timestamp: Date.now()
                    });

                    // Trigger callback
                    callback(employees);
                },
                (error) => {
                    console.error('Employee monitoring error:', error);
                }
            );

        // Store unsubscribe function
        this.listeners.set('employees', unsubscribe);
        return unsubscribe;
    }

    /**
     * Monitor Individual Employee Activity
     */
    onEmployeeActivityUpdate(employeeId, callback) {
        const unsubscribe = this.db.collection('activities')
            .where('employeeId', '==', employeeId)
            .orderBy('timestamp', 'desc')
            .limit(20)
            .onSnapshot(
                (snapshot) => {
                    const activities = [];

                    snapshot.forEach(doc => {
                        activities.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    });

                    callback(activities);
                },
                (error) => {
                    console.error('Activity monitoring error:', error);
                }
            );

        this.listeners.set(`employee-activity-${employeeId}`, unsubscribe);
        return unsubscribe;
    }

    /**
     * ========================================
     * TASK MONITORING
     * ========================================
     */

    /**
     * Monitor Tasks in Real-time
     */
    onTaskUpdate(callback) {
        const unsubscribe = this.db.collection('budget_tasks')
            .where('status', '!=', 'archived')
            .onSnapshot(
                (snapshot) => {
                    const tasks = new Map();

                    snapshot.forEach(doc => {
                        const data = doc.data();
                        tasks.set(doc.id, {
                            id: doc.id,
                            ...data,
                            // Add computed fields
                            isOverdue: this.checkIfOverdue(data),
                            urgency: this.calculateUrgency(data)
                        });
                    });

                    // Cache the data
                    this.cache.set('tasks', {
                        data: tasks,
                        timestamp: Date.now()
                    });

                    // Trigger callback
                    callback(tasks);
                },
                (error) => {
                    console.error('Task monitoring error:', error);
                }
            );

        this.listeners.set('tasks', unsubscribe);
        return unsubscribe;
    }

    /**
     * Monitor Task Changes for Specific Employee
     */
    onEmployeeTasksUpdate(employeeId, callback) {
        const unsubscribe = this.db.collection('budget_tasks')
            .where('employee', '==', employeeId)
            .where('status', '!=', 'הושלם')
            .onSnapshot(
                (snapshot) => {
                    const tasks = [];

                    snapshot.docChanges().forEach(change => {
                        const data = {
                            id: change.doc.id,
                            ...change.doc.data(),
                            changeType: change.type // 'added', 'modified', 'removed'
                        };

                        if (change.type === 'modified') {
                            // Detect what changed
                            data.changes = this.detectTaskChanges(
                                change.doc.data(),
                                this.getTaskFromCache(change.doc.id)
                            );
                        }

                        tasks.push(data);
                    });

                    callback(tasks);
                },
                (error) => {
                    console.error('Employee task monitoring error:', error);
                }
            );

        this.listeners.set(`employee-tasks-${employeeId}`, unsubscribe);
        return unsubscribe;
    }

    /**
     * ========================================
     * ACTIVITY STREAM
     * ========================================
     */

    /**
     * Monitor Real-time Activity Stream
     */
    onActivityUpdate(callback) {
        // Listen to multiple collections for activity
        const collections = [
            { name: 'timesheet_entries', type: 'timesheet' },
            { name: 'budget_tasks', type: 'task' },
            { name: 'clients', type: 'client' },
            { name: 'cases', type: 'case' }
        ];

        collections.forEach(({ name, type }) => {
            const unsubscribe = this.db.collection(name)
                .orderBy('updatedAt', 'desc')
                .limit(10)
                .onSnapshot(
                    (snapshot) => {
                        snapshot.docChanges().forEach(change => {
                            if (change.type === 'added' || change.type === 'modified') {
                                const data = change.doc.data();
                                const activity = this.createActivityFromChange(
                                    change,
                                    type,
                                    data
                                );

                                if (activity) {
                                    callback(activity);
                                }
                            }
                        });
                    },
                    (error) => {
                        console.error(`Activity monitoring error for ${name}:`, error);
                    }
                );

            this.listeners.set(`activity-${name}`, unsubscribe);
        });
    }

    /**
     * ========================================
     * CLIENT MONITORING
     * ========================================
     */

    /**
     * Monitor Client Status Updates
     */
    onClientUpdate(callback) {
        const unsubscribe = this.db.collection('clients')
            .where('status', '==', 'active')
            .onSnapshot(
                (snapshot) => {
                    const clients = new Map();

                    snapshot.forEach(doc => {
                        const data = doc.data();
                        clients.set(doc.id, {
                            id: doc.id,
                            ...data,
                            // Add computed fields
                            hasPendingActions: this.checkPendingActions(data),
                            priority: this.calculateClientPriority(data)
                        });
                    });

                    // Cache the data
                    this.cache.set('clients', {
                        data: clients,
                        timestamp: Date.now()
                    });

                    // Trigger callback
                    callback(clients);
                },
                (error) => {
                    console.error('Client monitoring error:', error);
                }
            );

        this.listeners.set('clients', unsubscribe);
        return unsubscribe;
    }

    /**
     * ========================================
     * ALERTS & ANOMALIES
     * ========================================
     */

    /**
     * Monitor System Alerts
     */
    onAlertUpdate(callback) {
        const unsubscribe = this.db.collection('system_alerts')
            .where('resolved', '==', false)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .onSnapshot(
                (snapshot) => {
                    const alerts = [];

                    snapshot.forEach(doc => {
                        alerts.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    });

                    callback(alerts);
                },
                (error) => {
                    console.error('Alert monitoring error:', error);
                }
            );

        this.listeners.set('alerts', unsubscribe);
        return unsubscribe;
    }

    /**
     * Create System Alert
     */
    async createAlert(alert) {
        try {
            const alertData = {
                ...alert,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                resolved: false,
                acknowledged: false
            };

            const docRef = await this.db.collection('system_alerts').add(alertData);
            console.log('Alert created:', docRef.id);
            return docRef.id;

        } catch (error) {
            console.error('Failed to create alert:', error);
            return null;
        }
    }

    /**
     * ========================================
     * PERFORMANCE METRICS
     * ========================================
     */

    /**
     * Get Performance Metrics
     */
    async getPerformanceMetrics(period = 'today') {
        try {
            const metrics = {};
            const now = Date.now();
            let startTime;

            // Calculate start time based on period
            switch (period) {
                case 'today':
                    startTime = new Date().setHours(0, 0, 0, 0);
                    break;
                case 'week':
                    startTime = now - (7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startTime = now - (30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startTime = new Date().setHours(0, 0, 0, 0);
            }

            // Get task completion metrics
            const tasksSnapshot = await this.db.collection('budget_tasks')
                .where('completedAt', '>=', new Date(startTime))
                .get();

            metrics.tasksCompleted = tasksSnapshot.size;

            // Get timesheet metrics
            const timesheetSnapshot = await this.db.collection('timesheet_entries')
                .where('date', '>=', new Date(startTime))
                .get();

            let totalHours = 0;
            timesheetSnapshot.forEach(doc => {
                const data = doc.data();
                totalHours += data.hours || 0;
            });

            metrics.totalHours = totalHours;

            // Get active users count
            const usersSnapshot = await this.db.collection('users')
                .where('lastActivity', '>=', new Date(now - 3600000)) // Active in last hour
                .get();

            metrics.activeUsers = usersSnapshot.size;

            return metrics;

        } catch (error) {
            console.error('Failed to get performance metrics:', error);
            return {};
        }
    }

    /**
     * ========================================
     * HELPER FUNCTIONS
     * ========================================
     */

    /**
     * Check if Employee is Online
     */
    checkIfOnline(lastActivity) {
        if (!lastActivity) return false;

        const now = Date.now();
        const activity = lastActivity?.toMillis ?
            lastActivity.toMillis() :
            new Date(lastActivity).getTime();

        return (now - activity) < 300000; // 5 minutes
    }

    /**
     * Get Employee Status
     */
    getEmployeeStatus(employee) {
        const now = Date.now();
        const lastActivity = employee.lastActivity?.toMillis ?
            employee.lastActivity.toMillis() :
            new Date(employee.lastActivity || 0).getTime();

        const idleMinutes = (now - lastActivity) / 60000;

        if (idleMinutes < 5) return 'active';
        if (idleMinutes < 15) return 'idle';
        if (idleMinutes < 60) return 'away';
        return 'offline';
    }

    /**
     * Check if Task is Overdue
     */
    checkIfOverdue(task) {
        if (!task.deadline || task.status === 'הושלם') return false;

        const now = Date.now();
        const deadline = task.deadline?.toMillis ?
            task.deadline.toMillis() :
            new Date(task.deadline).getTime();

        return deadline < now;
    }

    /**
     * Calculate Task Urgency
     */
    calculateUrgency(task) {
        if (task.status === 'הושלם') return 'none';
        if (!task.deadline) return 'low';

        const now = Date.now();
        const deadline = task.deadline?.toMillis ?
            task.deadline.toMillis() :
            new Date(task.deadline).getTime();

        const hoursUntil = (deadline - now) / 3600000;

        if (hoursUntil < 0) return 'overdue';
        if (hoursUntil < 24) return 'critical';
        if (hoursUntil < 72) return 'high';
        if (hoursUntil < 168) return 'medium';
        return 'low';
    }

    /**
     * Detect Task Changes
     */
    detectTaskChanges(newData, oldData) {
        if (!oldData) return ['created'];

        const changes = [];
        const fieldsToCheck = ['status', 'priority', 'deadline', 'assignedTo'];

        fieldsToCheck.forEach(field => {
            if (newData[field] !== oldData[field]) {
                changes.push(field);
            }
        });

        return changes;
    }

    /**
     * Get Task from Cache
     */
    getTaskFromCache(taskId) {
        const cached = this.cache.get('tasks');
        if (!cached) return null;

        return cached.data.get(taskId);
    }

    /**
     * Create Activity from Change
     */
    createActivityFromChange(change, type, data) {
        const activityMap = {
            timesheet: {
                added: 'רישום שעות חדש',
                modified: 'עדכון רישום שעות',
                icon: 'clock'
            },
            task: {
                added: 'משימה חדשה נוצרה',
                modified: 'משימה עודכנה',
                icon: 'tasks'
            },
            client: {
                added: 'לקוח חדש נוסף',
                modified: 'פרטי לקוח עודכנו',
                icon: 'user'
            },
            case: {
                added: 'תיק חדש נפתח',
                modified: 'תיק עודכן',
                icon: 'folder'
            }
        };

        const config = activityMap[type];
        if (!config) return null;

        return {
            type,
            title: config[change.type] || 'פעילות חדשה',
            description: this.getActivityDescription(type, data),
            timestamp: Date.now(),
            icon: config.icon,
            data: {
                id: change.doc.id,
                ...data
            }
        };
    }

    /**
     * Get Activity Description
     */
    getActivityDescription(type, data) {
        switch (type) {
            case 'timesheet':
                return `${data.employee} - ${data.hours} שעות`;
            case 'task':
                return data.title || 'משימה ללא שם';
            case 'client':
                return data.name || 'לקוח חדש';
            case 'case':
                return data.caseNumber || 'תיק חדש';
            default:
                return 'פעילות במערכת';
        }
    }

    /**
     * Check Pending Actions for Client
     */
    checkPendingActions(client) {
        // Check various conditions for pending actions
        return client.pendingDocuments ||
               client.awaitingResponse ||
               client.hasOpenTasks ||
               false;
    }

    /**
     * Calculate Client Priority
     */
    calculateClientPriority(client) {
        // Priority calculation based on various factors
        if (client.isUrgent || client.courtDateSoon) return 'critical';
        if (client.hasDeadlines) return 'high';
        if (client.isActive) return 'medium';
        return 'low';
    }

    /**
     * ========================================
     * CLEANUP
     * ========================================
     */

    /**
     * Unsubscribe from Listener
     */
    unsubscribe(key) {
        const listener = this.listeners.get(key);
        if (listener && typeof listener === 'function') {
            listener();
            this.listeners.delete(key);
        }
    }

    /**
     * Unsubscribe from All Listeners
     */
    unsubscribeAll() {
        this.listeners.forEach((unsubscribe, key) => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.listeners.clear();
    }

    /**
     * Clear Cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Destroy Manager
     */
    destroy() {
        this.unsubscribeAll();
        this.clearCache();
        this.isConnected = false;
        console.log('RealtimeDataManager destroyed');
    }
}