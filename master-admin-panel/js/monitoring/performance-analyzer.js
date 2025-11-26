/**
 * Performance Analyzer Module
 * מודול ניתוח ביצועים
 *
 * @module PerformanceAnalyzer
 * @version 1.0.0
 * @created 2025-11-26
 */

export class PerformanceAnalyzer {
    constructor() {
        this.db = null;
        this.metrics = new Map();
        this.trends = new Map();

        // Configuration
        this.config = {
            analysisInterval: 60000, // 1 minute
            trendWindowDays: 30,
            benchmarks: {
                taskCompletionRate: 80, // 80% of tasks should be completed on time
                avgResponseTime: 4, // 4 hours average response time
                dailyProductivity: 6, // 6 hours of productive work per day
                weeklyGoal: 30 // 30 hours per week
            }
        };

        // Analysis interval
        this.analysisInterval = null;
    }

    /**
     * Initialize Analyzer
     */
    async init() {
        try {
            this.db = window.firebaseDB;

            // Start periodic analysis
            this.startPeriodicAnalysis();

            console.log('✅ PerformanceAnalyzer initialized');
            return true;

        } catch (error) {
            console.error('❌ PerformanceAnalyzer init failed:', error);
            return false;
        }
    }

    /**
     * Start Periodic Analysis
     */
    startPeriodicAnalysis() {
        // Run initial analysis
        this.runAnalysis();

        // Set up periodic runs
        this.analysisInterval = setInterval(() => {
            this.runAnalysis();
        }, this.config.analysisInterval);
    }

    /**
     * Run Performance Analysis
     */
    async runAnalysis() {
        try {
            const now = Date.now();
            const dayStart = new Date().setHours(0, 0, 0, 0);
            const weekStart = now - (7 * 24 * 60 * 60 * 1000);

            // Analyze employee performance
            const employeeMetrics = await this.analyzeEmployeePerformance(dayStart, weekStart);

            // Analyze task metrics
            const taskMetrics = await this.analyzeTaskMetrics(dayStart, weekStart);

            // Analyze client metrics
            const clientMetrics = await this.analyzeClientMetrics();

            // Calculate trends
            this.calculateTrends(employeeMetrics, taskMetrics);

            // Store metrics
            this.metrics.set('employees', employeeMetrics);
            this.metrics.set('tasks', taskMetrics);
            this.metrics.set('clients', clientMetrics);
            this.metrics.set('lastAnalysis', now);

            // Check for performance issues
            this.checkPerformanceIssues();

        } catch (error) {
            console.error('Error running performance analysis:', error);
        }
    }

    /**
     * Analyze Employee Performance
     */
    async analyzeEmployeePerformance(dayStart, weekStart) {
        const metrics = {
            byEmployee: new Map(),
            averages: {
                dailyHours: 0,
                weeklyHours: 0,
                taskCompletion: 0,
                responseTime: 0
            },
            top: [],
            needsImprovement: []
        };

        try {
            // Get all employees
            const usersSnapshot = await this.db
                .collection('users')
                .where('role', 'in', ['employee', 'admin'])
                .get();

            for (const userDoc of usersSnapshot.docs) {
                const userId = userDoc.id;
                const userData = userDoc.data();

                // Calculate individual metrics
                const employeeMetrics = await this.calculateEmployeeMetrics(
                    userId,
                    dayStart,
                    weekStart
                );

                // Calculate score
                employeeMetrics.score = this.calculatePerformanceScore(employeeMetrics);

                // Store metrics
                metrics.byEmployee.set(userId, {
                    ...userData,
                    ...employeeMetrics
                });
            }

            // Calculate averages
            if (metrics.byEmployee.size > 0) {
                let totalDaily = 0, totalWeekly = 0, totalCompletion = 0;

                metrics.byEmployee.forEach(emp => {
                    totalDaily += emp.todayHours || 0;
                    totalWeekly += emp.weeklyHours || 0;
                    totalCompletion += emp.completionRate || 0;
                });

                const count = metrics.byEmployee.size;
                metrics.averages.dailyHours = totalDaily / count;
                metrics.averages.weeklyHours = totalWeekly / count;
                metrics.averages.taskCompletion = totalCompletion / count;
            }

            // Identify top performers
            const sorted = Array.from(metrics.byEmployee.values())
                .sort((a, b) => b.score - a.score);

            metrics.top = sorted.slice(0, 3);
            metrics.needsImprovement = sorted.filter(emp => emp.score < 50);

        } catch (error) {
            console.error('Error analyzing employee performance:', error);
        }

        return metrics;
    }

    /**
     * Calculate Employee Metrics
     */
    async calculateEmployeeMetrics(employeeId, dayStart, weekStart) {
        const metrics = {
            todayHours: 0,
            weeklyHours: 0,
            todayTasks: 0,
            weeklyTasks: 0,
            completionRate: 0,
            avgResponseTime: 0,
            productivity: 0
        };

        try {
            // Today's hours
            const todayHoursSnapshot = await this.db
                .collection('timesheet_entries')
                .where('employee', '==', employeeId)
                .where('date', '>=', new Date(dayStart))
                .get();

            todayHoursSnapshot.forEach(doc => {
                metrics.todayHours += doc.data().hours || 0;
            });

            // Weekly hours
            const weeklyHoursSnapshot = await this.db
                .collection('timesheet_entries')
                .where('employee', '==', employeeId)
                .where('date', '>=', new Date(weekStart))
                .get();

            weeklyHoursSnapshot.forEach(doc => {
                metrics.weeklyHours += doc.data().hours || 0;
            });

            // Task completion
            const tasksSnapshot = await this.db
                .collection('budget_tasks')
                .where('employee', '==', employeeId)
                .where('updatedAt', '>=', new Date(weekStart))
                .get();

            let totalTasks = 0, completedTasks = 0;

            tasksSnapshot.forEach(doc => {
                const task = doc.data();
                totalTasks++;

                if (task.status === 'הושלם') {
                    completedTasks++;

                    // Check if today
                    const completedAt = task.completedAt?.toMillis ?
                        task.completedAt.toMillis() :
                        new Date(task.completedAt).getTime();

                    if (completedAt >= dayStart) {
                        metrics.todayTasks++;
                    }

                    metrics.weeklyTasks++;
                }
            });

            if (totalTasks > 0) {
                metrics.completionRate = Math.round((completedTasks / totalTasks) * 100);
            }

            // Calculate productivity score
            metrics.productivity = this.calculateProductivity(metrics);

        } catch (error) {
            console.error(`Error calculating metrics for ${employeeId}:`, error);
        }

        return metrics;
    }

    /**
     * Analyze Task Metrics
     */
    async analyzeTaskMetrics(dayStart, weekStart) {
        const metrics = {
            total: 0,
            completed: 0,
            pending: 0,
            overdue: 0,
            completionRate: 0,
            avgCompletionTime: 0,
            byPriority: {},
            byType: {},
            trends: {
                daily: [],
                weekly: []
            }
        };

        try {
            // Get all tasks
            const tasksSnapshot = await this.db
                .collection('budget_tasks')
                .get();

            const now = Date.now();

            tasksSnapshot.forEach(doc => {
                const task = doc.data();
                metrics.total++;

                // Status counts
                if (task.status === 'הושלם') {
                    metrics.completed++;
                } else if (task.status === 'ממתין') {
                    metrics.pending++;
                }

                // Check overdue
                if (task.deadline && task.status !== 'הושלם') {
                    const deadline = task.deadline?.toMillis ?
                        task.deadline.toMillis() :
                        new Date(task.deadline).getTime();

                    if (deadline < now) {
                        metrics.overdue++;
                    }
                }

                // Priority distribution
                const priority = task.priority || 'medium';
                metrics.byPriority[priority] = (metrics.byPriority[priority] || 0) + 1;

                // Type distribution
                const type = task.type || 'general';
                metrics.byType[type] = (metrics.byType[type] || 0) + 1;
            });

            // Calculate completion rate
            if (metrics.total > 0) {
                metrics.completionRate = Math.round((metrics.completed / metrics.total) * 100);
            }

        } catch (error) {
            console.error('Error analyzing task metrics:', error);
        }

        return metrics;
    }

    /**
     * Analyze Client Metrics
     */
    async analyzeClientMetrics() {
        const metrics = {
            total: 0,
            active: 0,
            inactive: 0,
            withOpenTasks: 0,
            satisfaction: {
                high: 0,
                medium: 0,
                low: 0
            }
        };

        try {
            const clientsSnapshot = await this.db
                .collection('clients')
                .get();

            clientsSnapshot.forEach(doc => {
                const client = doc.data();
                metrics.total++;

                if (client.status === 'active') {
                    metrics.active++;
                } else {
                    metrics.inactive++;
                }

                if (client.hasOpenTasks) {
                    metrics.withOpenTasks++;
                }
            });

        } catch (error) {
            console.error('Error analyzing client metrics:', error);
        }

        return metrics;
    }

    /**
     * Calculate Performance Score
     */
    calculatePerformanceScore(metrics) {
        let score = 0;

        // Hours worked (max 30 points)
        const hoursScore = Math.min((metrics.weeklyHours / this.config.benchmarks.weeklyGoal) * 30, 30);
        score += hoursScore;

        // Task completion (max 40 points)
        const completionScore = (metrics.completionRate / 100) * 40;
        score += completionScore;

        // Productivity (max 30 points)
        const productivityScore = (metrics.productivity / 100) * 30;
        score += productivityScore;

        return Math.round(score);
    }

    /**
     * Calculate Productivity
     */
    calculateProductivity(metrics) {
        // Simple productivity calculation
        const expectedDailyHours = this.config.benchmarks.dailyProductivity;
        const actualHours = metrics.todayHours;

        const hoursProductivity = Math.min((actualHours / expectedDailyHours) * 100, 100);
        const taskProductivity = metrics.completionRate || 0;

        return Math.round((hoursProductivity + taskProductivity) / 2);
    }

    /**
     * Calculate Trends
     */
    calculateTrends(employeeMetrics, taskMetrics) {
        // Store current metrics for trend calculation
        const currentMetrics = {
            timestamp: Date.now(),
            avgHours: employeeMetrics.averages.weeklyHours,
            completionRate: taskMetrics.completionRate,
            overdueCount: taskMetrics.overdue
        };

        // Get existing trends
        const existingTrends = this.trends.get('weekly') || [];
        existingTrends.push(currentMetrics);

        // Keep only last 30 days
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const filteredTrends = existingTrends.filter(t => t.timestamp > thirtyDaysAgo);

        this.trends.set('weekly', filteredTrends);
    }

    /**
     * Check Performance Issues
     */
    checkPerformanceIssues() {
        const issues = [];
        const employeeMetrics = this.metrics.get('employees');
        const taskMetrics = this.metrics.get('tasks');

        if (employeeMetrics) {
            // Check for low productivity
            employeeMetrics.byEmployee.forEach((emp, id) => {
                if (emp.productivity < 50) {
                    issues.push({
                        type: 'low_productivity',
                        severity: 'warning',
                        employeeId: id,
                        employeeName: emp.name,
                        productivity: emp.productivity
                    });
                }
            });
        }

        if (taskMetrics) {
            // Check completion rate
            if (taskMetrics.completionRate < this.config.benchmarks.taskCompletionRate) {
                issues.push({
                    type: 'low_completion_rate',
                    severity: 'warning',
                    rate: taskMetrics.completionRate,
                    benchmark: this.config.benchmarks.taskCompletionRate
                });
            }

            // Check overdue tasks
            if (taskMetrics.overdue > 10) {
                issues.push({
                    type: 'high_overdue_count',
                    severity: 'critical',
                    count: taskMetrics.overdue
                });
            }
        }

        // Report issues
        if (issues.length > 0) {
            this.reportPerformanceIssues(issues);
        }
    }

    /**
     * Report Performance Issues
     */
    reportPerformanceIssues(issues) {
        console.log('Performance issues detected:', issues);
        // Could trigger alerts through AlertsManager here
    }

    /**
     * Get Performance Report
     */
    getPerformanceReport(period = 'week') {
        return {
            employees: this.metrics.get('employees'),
            tasks: this.metrics.get('tasks'),
            clients: this.metrics.get('clients'),
            trends: this.trends.get('weekly'),
            lastAnalysis: this.metrics.get('lastAnalysis'),
            period: period
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
        }
        this.metrics.clear();
        this.trends.clear();
    }
}