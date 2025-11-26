/**
 * Employee Monitor Module
 * מודול ניטור עובדים בזמן אמת
 *
 * @module EmployeeMonitor
 * @version 1.0.0
 * @created 2025-11-25
 */

export class EmployeeMonitor {
    constructor(realtimeManager) {
        this.realtimeManager = realtimeManager;
        this.db = null;

        // Employee data cache
        this.employees = new Map();
        this.activities = new Map();

        // Monitoring configuration
        this.config = {
            idleThreshold: 15 * 60 * 1000, // 15 minutes
            offlineThreshold: 60 * 60 * 1000, // 1 hour
            activityTrackingInterval: 5 * 60 * 1000, // 5 minutes
            maxActivitiesPerEmployee: 100
        };

        // Tracking intervals
        this.trackingIntervals = new Map();
    }

    /**
     * Initialize Monitor
     */
    async init() {
        try {
            this.db = window.firebaseDB;

            // Start monitoring all employees
            await this.startMonitoring();

            console.log('✅ EmployeeMonitor initialized');
            return true;

        } catch (error) {
            console.error('❌ EmployeeMonitor init failed:', error);
            return false;
        }
    }

    /**
     * Start Monitoring All Employees
     */
    async startMonitoring() {
        // Set up real-time listener for employee updates
        this.realtimeManager.onEmployeeUpdate((employees) => {
            this.processEmployeeUpdates(employees);
        });

        // Start activity tracking
        this.startActivityTracking();
    }

    /**
     * Process Employee Updates
     */
    processEmployeeUpdates(employees) {
        employees.forEach((employee, id) => {
            const existingEmployee = this.employees.get(id);

            // Check for status changes
            if (existingEmployee) {
                this.detectStatusChanges(existingEmployee, employee);
            }

            // Update cache
            this.employees.set(id, {
                ...employee,
                lastChecked: Date.now(),
                statusHistory: this.updateStatusHistory(existingEmployee, employee)
            });
        });
    }

    /**
     * Detect Status Changes
     */
    detectStatusChanges(oldData, newData) {
        const oldStatus = this.calculateStatus(oldData);
        const newStatus = this.calculateStatus(newData);

        if (oldStatus !== newStatus) {
            this.logStatusChange(newData.id, oldStatus, newStatus);

            // Create activity log
            this.createActivityLog({
                employeeId: newData.id,
                employeeName: newData.name || newData.email,
                type: 'status_change',
                from: oldStatus,
                to: newStatus,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Calculate Employee Status
     */
    calculateStatus(employee) {
        if (!employee.lastActivity) return 'offline';

        const now = Date.now();
        const lastActivity = employee.lastActivity?.toMillis ?
            employee.lastActivity.toMillis() :
            new Date(employee.lastActivity).getTime();

        const timeDiff = now - lastActivity;

        if (timeDiff < 5 * 60 * 1000) return 'active';
        if (timeDiff < this.config.idleThreshold) return 'idle';
        if (timeDiff < this.config.offlineThreshold) return 'away';
        return 'offline';
    }

    /**
     * Update Status History
     */
    updateStatusHistory(existingEmployee, newEmployee) {
        const history = existingEmployee?.statusHistory || [];
        const currentStatus = this.calculateStatus(newEmployee);

        // Add new entry if status changed
        const lastEntry = history[history.length - 1];
        if (!lastEntry || lastEntry.status !== currentStatus) {
            history.push({
                status: currentStatus,
                timestamp: Date.now()
            });
        }

        // Keep only last 100 entries
        return history.slice(-100);
    }

    /**
     * Start Activity Tracking
     */
    startActivityTracking() {
        // Track each employee's activity
        this.trackingInterval = setInterval(() => {
            this.employees.forEach((employee, id) => {
                this.trackEmployeeActivity(id, employee);
            });
        }, this.config.activityTrackingInterval);
    }

    /**
     * Track Individual Employee Activity
     */
    async trackEmployeeActivity(employeeId, employee) {
        try {
            // Get recent activities
            const activities = await this.getRecentActivities(employeeId);

            // Analyze productivity
            const productivity = this.analyzeProductivity(activities);

            // Update employee data
            this.employees.set(employeeId, {
                ...employee,
                recentActivities: activities,
                productivity: productivity,
                lastAnalyzed: Date.now()
            });

            // Check for anomalies
            this.checkForAnomalies(employeeId, employee, activities, productivity);

        } catch (error) {
            console.error(`Error tracking activity for ${employeeId}:`, error);
        }
    }

    /**
     * Get Recent Activities
     */
    async getRecentActivities(employeeId) {
        try {
            const activities = [];
            const now = Date.now();
            const dayStart = new Date().setHours(0, 0, 0, 0);

            // Get timesheet entries
            const timesheetSnapshot = await this.db
                .collection('timesheet_entries')
                .where('employee', '==', employeeId)
                .where('createdAt', '>=', new Date(dayStart))
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();

            timesheetSnapshot.forEach(doc => {
                activities.push({
                    type: 'timesheet',
                    ...doc.data(),
                    id: doc.id
                });
            });

            // Get task updates
            const tasksSnapshot = await this.db
                .collection('budget_tasks')
                .where('employee', '==', employeeId)
                .where('updatedAt', '>=', new Date(dayStart))
                .orderBy('updatedAt', 'desc')
                .limit(20)
                .get();

            tasksSnapshot.forEach(doc => {
                activities.push({
                    type: 'task',
                    ...doc.data(),
                    id: doc.id
                });
            });

            // Sort by timestamp
            activities.sort((a, b) => {
                const aTime = a.createdAt || a.updatedAt;
                const bTime = b.createdAt || b.updatedAt;
                return bTime - aTime;
            });

            return activities;

        } catch (error) {
            console.error('Error getting recent activities:', error);
            return [];
        }
    }

    /**
     * Analyze Productivity
     */
    analyzeProductivity(activities) {
        const now = Date.now();
        const metrics = {
            score: 0,
            tasksCompleted: 0,
            hoursLogged: 0,
            avgResponseTime: 0,
            activityRate: 0
        };

        if (!activities || activities.length === 0) {
            return metrics;
        }

        // Count completed tasks
        metrics.tasksCompleted = activities.filter(a =>
            a.type === 'task' && a.status === 'הושלם'
        ).length;

        // Sum logged hours
        metrics.hoursLogged = activities
            .filter(a => a.type === 'timesheet')
            .reduce((sum, a) => sum + (a.hours || 0), 0);

        // Calculate activity rate (activities per hour)
        const firstActivity = activities[activities.length - 1];
        const timeSpan = now - (firstActivity.createdAt || firstActivity.updatedAt);
        metrics.activityRate = activities.length / (timeSpan / 3600000);

        // Calculate productivity score (0-100)
        metrics.score = this.calculateProductivityScore(metrics);

        return metrics;
    }

    /**
     * Calculate Productivity Score
     */
    calculateProductivityScore(metrics) {
        let score = 0;

        // Tasks completed (max 40 points)
        score += Math.min(metrics.tasksCompleted * 10, 40);

        // Hours logged (max 30 points)
        score += Math.min(metrics.hoursLogged * 5, 30);

        // Activity rate (max 30 points)
        score += Math.min(metrics.activityRate * 10, 30);

        return Math.round(score);
    }

    /**
     * Check for Anomalies
     */
    checkForAnomalies(employeeId, employee, activities, productivity) {
        const anomalies = [];

        // Check for extended idle time
        const status = this.calculateStatus(employee);
        if (status === 'idle' || status === 'away') {
            const idleTime = this.getIdleTime(employee);
            if (idleTime > this.config.idleThreshold) {
                anomalies.push({
                    type: 'extended_idle',
                    severity: 'warning',
                    message: `עובד לא פעיל מעל ${Math.round(idleTime / 60000)} דקות`,
                    employeeId,
                    employeeName: employee.name
                });
            }
        }

        // Check for low productivity
        if (productivity.score < 30) {
            anomalies.push({
                type: 'low_productivity',
                severity: 'info',
                message: `פרודוקטיביות נמוכה: ${productivity.score}%`,
                employeeId,
                employeeName: employee.name
            });
        }

        // Check for no activities
        if (activities.length === 0 && status === 'active') {
            anomalies.push({
                type: 'no_activities',
                severity: 'warning',
                message: 'מוגדר כפעיל אך אין פעילות רשומה',
                employeeId,
                employeeName: employee.name
            });
        }

        // Report anomalies
        if (anomalies.length > 0) {
            this.reportAnomalies(anomalies);
        }
    }

    /**
     * Get Idle Time
     */
    getIdleTime(employee) {
        if (!employee.lastActivity) return Infinity;

        const now = Date.now();
        const lastActivity = employee.lastActivity?.toMillis ?
            employee.lastActivity.toMillis() :
            new Date(employee.lastActivity).getTime();

        return now - lastActivity;
    }

    /**
     * Report Anomalies
     */
    async reportAnomalies(anomalies) {
        for (const anomaly of anomalies) {
            await this.realtimeManager.createAlert({
                ...anomaly,
                timestamp: Date.now(),
                source: 'employee_monitor'
            });
        }
    }

    /**
     * Create Activity Log
     */
    async createActivityLog(activity) {
        try {
            await this.db.collection('activities').add({
                ...activity,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error creating activity log:', error);
        }
    }

    /**
     * Log Status Change
     */
    logStatusChange(employeeId, fromStatus, toStatus) {
        console.log(`Employee ${employeeId}: ${fromStatus} → ${toStatus}`);
    }

    /**
     * Load All Employees
     */
    async loadAllEmployees() {
        try {
            const snapshot = await this.db
                .collection('users')
                .where('role', 'in', ['employee', 'admin', 'secretary'])
                .get();

            const employees = new Map();

            for (const doc of snapshot.docs) {
                const data = doc.data();
                const employeeId = doc.id;

                // Get additional data
                const activities = await this.getRecentActivities(employeeId);
                const productivity = this.analyzeProductivity(activities);
                const status = this.calculateStatus(data);

                // Get today's stats
                const todayStats = await this.getTodayStats(employeeId);

                employees.set(employeeId, {
                    id: employeeId,
                    ...data,
                    status,
                    productivity,
                    ...todayStats,
                    lastChecked: Date.now()
                });
            }

            this.employees = employees;
            return employees;

        } catch (error) {
            console.error('Error loading employees:', error);
            return new Map();
        }
    }

    /**
     * Get Today's Stats for Employee
     */
    async getTodayStats(employeeId) {
        const dayStart = new Date().setHours(0, 0, 0, 0);
        const stats = {
            tasksToday: 0,
            hoursToday: 0,
            currentTask: null
        };

        try {
            // Count today's completed tasks
            const tasksSnapshot = await this.db
                .collection('budget_tasks')
                .where('employee', '==', employeeId)
                .where('completedAt', '>=', new Date(dayStart))
                .get();

            stats.tasksToday = tasksSnapshot.size;

            // Get current task
            const currentTaskSnapshot = await this.db
                .collection('budget_tasks')
                .where('employee', '==', employeeId)
                .where('status', '==', 'בביצוע')
                .limit(1)
                .get();

            if (!currentTaskSnapshot.empty) {
                const task = currentTaskSnapshot.docs[0].data();
                stats.currentTask = task.title || 'משימה ללא שם';
            }

            // Sum today's hours
            const hoursSnapshot = await this.db
                .collection('timesheet_entries')
                .where('employee', '==', employeeId)
                .where('date', '>=', new Date(dayStart))
                .get();

            hoursSnapshot.forEach(doc => {
                stats.hoursToday += doc.data().hours || 0;
            });

        } catch (error) {
            console.error(`Error getting today's stats for ${employeeId}:`, error);
        }

        return stats;
    }

    /**
     * Get Employee Details
     */
    async getEmployeeDetails(employeeId) {
        const employee = this.employees.get(employeeId);
        if (!employee) return null;

        // Get extended details
        const activities = await this.getRecentActivities(employeeId);
        const weekStats = await this.getWeekStats(employeeId);
        const taskDistribution = await this.getTaskDistribution(employeeId);

        return {
            ...employee,
            activities,
            weekStats,
            taskDistribution
        };
    }

    /**
     * Get Week Stats
     */
    async getWeekStats(employeeId) {
        const weekStart = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const stats = {
            totalTasks: 0,
            totalHours: 0,
            avgProductivity: 0,
            dailyBreakdown: []
        };

        try {
            // Get week's tasks
            const tasksSnapshot = await this.db
                .collection('budget_tasks')
                .where('employee', '==', employeeId)
                .where('completedAt', '>=', new Date(weekStart))
                .get();

            stats.totalTasks = tasksSnapshot.size;

            // Get week's hours
            const hoursSnapshot = await this.db
                .collection('timesheet_entries')
                .where('employee', '==', employeeId)
                .where('date', '>=', new Date(weekStart))
                .orderBy('date', 'asc')
                .get();

            const dailyData = {};

            hoursSnapshot.forEach(doc => {
                const data = doc.data();
                const date = new Date(data.date).toDateString();

                if (!dailyData[date]) {
                    dailyData[date] = { hours: 0, tasks: 0 };
                }

                dailyData[date].hours += data.hours || 0;
                stats.totalHours += data.hours || 0;
            });

            // Convert to array
            stats.dailyBreakdown = Object.entries(dailyData).map(([date, data]) => ({
                date,
                ...data
            }));

        } catch (error) {
            console.error(`Error getting week stats for ${employeeId}:`, error);
        }

        return stats;
    }

    /**
     * Get Task Distribution
     */
    async getTaskDistribution(employeeId) {
        try {
            const snapshot = await this.db
                .collection('budget_tasks')
                .where('employee', '==', employeeId)
                .get();

            const distribution = {
                byStatus: {},
                byPriority: {},
                byClient: {}
            };

            snapshot.forEach(doc => {
                const task = doc.data();

                // By status
                distribution.byStatus[task.status] =
                    (distribution.byStatus[task.status] || 0) + 1;

                // By priority
                distribution.byPriority[task.priority || 'רגיל'] =
                    (distribution.byPriority[task.priority || 'רגיל'] || 0) + 1;

                // By client
                if (task.clientName) {
                    distribution.byClient[task.clientName] =
                        (distribution.byClient[task.clientName] || 0) + 1;
                }
            });

            return distribution;

        } catch (error) {
            console.error(`Error getting task distribution for ${employeeId}:`, error);
            return {};
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
        }

        this.trackingIntervals.forEach(interval => clearInterval(interval));
        this.employees.clear();
        this.activities.clear();
    }
}