/**
 * Tasks Monitor Module
 * מודול ניטור משימות בזמן אמת
 *
 * @module TasksMonitor
 * @version 1.0.0
 * @created 2025-11-26
 */

export class TasksMonitor {
    constructor(realtimeManager) {
        this.realtimeManager = realtimeManager;
        this.db = null;

        // Tasks cache
        this.tasks = new Map();
        this.tasksByEmployee = new Map();
        this.tasksByClient = new Map();

        // Configuration
        this.config = {
            urgentThresholdHours: 24,
            overdueGracePeriodHours: 2,
            maxTasksPerEmployee: 10,
            productivityTargets: {
                daily: 5,
                weekly: 25
            }
        };

        // Statistics
        this.stats = {
            total: 0,
            pending: 0,
            inProgress: 0,
            completed: 0,
            overdue: 0,
            urgent: 0
        };
    }

    /**
     * Initialize Monitor
     */
    async init() {
        try {
            this.db = window.firebaseDB;

            // Start monitoring
            await this.startMonitoring();

            console.log('✅ TasksMonitor initialized');
            return true;

        } catch (error) {
            console.error('❌ TasksMonitor init failed:', error);
            return false;
        }
    }

    /**
     * Start Monitoring Tasks
     */
    async startMonitoring() {
        // Set up real-time listener
        this.realtimeManager.onTaskUpdate((tasks) => {
            this.processTaskUpdates(tasks);
        });
    }

    /**
     * Process Task Updates
     */
    processTaskUpdates(tasks) {
        // Clear existing maps
        this.tasksByEmployee.clear();
        this.tasksByClient.clear();

        // Reset stats
        this.resetStats();

        // Process each task
        tasks.forEach((task, id) => {
            // Update cache
            this.tasks.set(id, task);

            // Organize by employee
            if (task.employee) {
                if (!this.tasksByEmployee.has(task.employee)) {
                    this.tasksByEmployee.set(task.employee, []);
                }
                this.tasksByEmployee.get(task.employee).push(task);
            }

            // Organize by client
            if (task.clientId) {
                if (!this.tasksByClient.has(task.clientId)) {
                    this.tasksByClient.set(task.clientId, []);
                }
                this.tasksByClient.get(task.clientId).push(task);
            }

            // Update statistics
            this.updateStats(task);

            // Check for issues
            this.checkTaskIssues(task);
        });

        // Analyze workload distribution
        this.analyzeWorkload();
    }

    /**
     * Reset Statistics
     */
    resetStats() {
        this.stats = {
            total: 0,
            pending: 0,
            inProgress: 0,
            completed: 0,
            overdue: 0,
            urgent: 0,
            byPriority: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0
            },
            byType: {},
            completionRate: 0,
            avgCompletionTime: 0
        };
    }

    /**
     * Update Statistics
     */
    updateStats(task) {
        this.stats.total++;

        // Status counts
        switch (task.status) {
            case 'ממתין':
                this.stats.pending++;
                break;
            case 'בביצוע':
                this.stats.inProgress++;
                break;
            case 'הושלם':
                this.stats.completed++;
                break;
        }

        // Check if overdue
        if (this.isOverdue(task)) {
            this.stats.overdue++;
        }

        // Check if urgent
        if (this.isUrgent(task)) {
            this.stats.urgent++;
        }

        // Priority counts
        const priority = task.priority || 'medium';
        this.stats.byPriority[priority] = (this.stats.byPriority[priority] || 0) + 1;

        // Type counts
        const type = task.type || 'general';
        this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
    }

    /**
     * Check Task Issues
     */
    checkTaskIssues(task) {
        const issues = [];

        // Check if overdue
        if (this.isOverdue(task)) {
            const hoursOverdue = this.getHoursOverdue(task);
            issues.push({
                type: 'overdue',
                severity: hoursOverdue > 48 ? 'critical' : 'warning',
                message: `משימה באיחור של ${Math.round(hoursOverdue)} שעות`,
                task: task
            });
        }

        // Check if approaching deadline
        if (this.isApproachingDeadline(task)) {
            issues.push({
                type: 'approaching_deadline',
                severity: 'info',
                message: `דדליין מתקרב - נותרו ${this.getHoursUntilDeadline(task)} שעות`,
                task: task
            });
        }

        // Check if stuck (in progress for too long)
        if (this.isStuck(task)) {
            issues.push({
                type: 'stuck',
                severity: 'warning',
                message: `משימה תקועה בביצוע מעל ${this.getDaysInProgress(task)} ימים`,
                task: task
            });
        }

        // Report issues
        if (issues.length > 0) {
            this.reportTaskIssues(issues);
        }
    }

    /**
     * Analyze Workload Distribution
     */
    analyzeWorkload() {
        const workloadAnalysis = {
            overloaded: [],
            underutilized: [],
            balanced: []
        };

        this.tasksByEmployee.forEach((tasks, employeeId) => {
            const activeTasks = tasks.filter(t => t.status !== 'הושלם').length;
            const urgentTasks = tasks.filter(t => this.isUrgent(t)).length;

            if (activeTasks > this.config.maxTasksPerEmployee) {
                workloadAnalysis.overloaded.push({
                    employeeId,
                    activeTasks,
                    urgentTasks
                });
            } else if (activeTasks < 2) {
                workloadAnalysis.underutilized.push({
                    employeeId,
                    activeTasks
                });
            } else {
                workloadAnalysis.balanced.push({
                    employeeId,
                    activeTasks
                });
            }
        });

        // Report imbalances
        if (workloadAnalysis.overloaded.length > 0) {
            this.reportWorkloadImbalance(workloadAnalysis);
        }
    }

    /**
     * Load All Tasks
     */
    async loadAllTasks() {
        try {
            const snapshot = await this.db
                .collection('budget_tasks')
                .where('status', '!=', 'archived')
                .get();

            const tasks = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                tasks.push({
                    id: doc.id,
                    ...data,
                    isOverdue: this.isOverdue(data),
                    isUrgent: this.isUrgent(data),
                    urgencyLevel: this.calculateUrgencyLevel(data)
                });
            });

            // Update cache
            tasks.forEach(task => {
                this.tasks.set(task.id, task);
            });

            return tasks;

        } catch (error) {
            console.error('Error loading tasks:', error);
            return [];
        }
    }

    /**
     * Get Tasks by Employee
     */
    getTasksByEmployee(employeeId) {
        return this.tasksByEmployee.get(employeeId) || [];
    }

    /**
     * Get Tasks by Client
     */
    getTasksByClient(clientId) {
        return this.tasksByClient.get(clientId) || [];
    }

    /**
     * Get Task Statistics
     */
    getStatistics() {
        // Calculate completion rate
        if (this.stats.total > 0) {
            this.stats.completionRate = Math.round(
                (this.stats.completed / this.stats.total) * 100
            );
        }

        return this.stats;
    }

    /**
     * Get Upcoming Deadlines
     */
    getUpcomingDeadlines(days = 7) {
        const now = Date.now();
        const futureLimit = now + (days * 24 * 60 * 60 * 1000);

        const upcomingTasks = [];

        this.tasks.forEach(task => {
            if (task.deadline && task.status !== 'הושלם') {
                const deadline = task.deadline?.toMillis ?
                    task.deadline.toMillis() :
                    new Date(task.deadline).getTime();

                if (deadline > now && deadline <= futureLimit) {
                    upcomingTasks.push({
                        ...task,
                        daysUntil: Math.ceil((deadline - now) / (24 * 60 * 60 * 1000)),
                        hoursUntil: Math.ceil((deadline - now) / (60 * 60 * 1000))
                    });
                }
            }
        });

        // Sort by deadline
        upcomingTasks.sort((a, b) => a.deadline - b.deadline);

        return upcomingTasks;
    }

    /**
     * Get Overdue Tasks
     */
    getOverdueTasks() {
        const overdueTasks = [];

        this.tasks.forEach(task => {
            if (this.isOverdue(task)) {
                overdueTasks.push({
                    ...task,
                    hoursOverdue: this.getHoursOverdue(task)
                });
            }
        });

        // Sort by how overdue they are
        overdueTasks.sort((a, b) => b.hoursOverdue - a.hoursOverdue);

        return overdueTasks;
    }

    /**
     * Get Critical Tasks
     */
    getCriticalTasks() {
        const criticalTasks = [];

        this.tasks.forEach(task => {
            if (task.priority === 'critical' || this.isUrgent(task)) {
                criticalTasks.push(task);
            }
        });

        return criticalTasks;
    }

    /**
     * Helper Functions
     */
    isOverdue(task) {
        if (!task.deadline || task.status === 'הושלם') {
return false;
}

        const now = Date.now();
        const deadline = task.deadline?.toMillis ?
            task.deadline.toMillis() :
            new Date(task.deadline).getTime();

        return deadline < now;
    }

    isUrgent(task) {
        if (!task.deadline || task.status === 'הושלם') {
return false;
}

        const hoursUntil = this.getHoursUntilDeadline(task);
        return hoursUntil > 0 && hoursUntil <= this.config.urgentThresholdHours;
    }

    isApproachingDeadline(task) {
        if (!task.deadline || task.status === 'הושלם') {
return false;
}

        const hoursUntil = this.getHoursUntilDeadline(task);
        return hoursUntil > 0 && hoursUntil <= 48;
    }

    isStuck(task) {
        if (task.status !== 'בביצוע') {
return false;
}

        const daysInProgress = this.getDaysInProgress(task);
        return daysInProgress > 3;
    }

    getHoursOverdue(task) {
        if (!this.isOverdue(task)) {
return 0;
}

        const now = Date.now();
        const deadline = task.deadline?.toMillis ?
            task.deadline.toMillis() :
            new Date(task.deadline).getTime();

        return (now - deadline) / (60 * 60 * 1000);
    }

    getHoursUntilDeadline(task) {
        if (!task.deadline) {
return Infinity;
}

        const now = Date.now();
        const deadline = task.deadline?.toMillis ?
            task.deadline.toMillis() :
            new Date(task.deadline).getTime();

        return (deadline - now) / (60 * 60 * 1000);
    }

    getDaysInProgress(task) {
        if (!task.startedAt) {
return 0;
}

        const now = Date.now();
        const started = task.startedAt?.toMillis ?
            task.startedAt.toMillis() :
            new Date(task.startedAt).getTime();

        return (now - started) / (24 * 60 * 60 * 1000);
    }

    calculateUrgencyLevel(task) {
        if (task.status === 'הושלם') {
return 0;
}

        let urgency = 0;

        // Priority factor
        const priorityScores = {
            critical: 100,
            high: 50,
            medium: 25,
            low: 10
        };
        urgency += priorityScores[task.priority] || 25;

        // Deadline factor
        if (task.deadline) {
            const hoursUntil = this.getHoursUntilDeadline(task);
            if (hoursUntil < 0) {
                urgency += 200; // Overdue
            } else if (hoursUntil < 24) {
                urgency += 100; // Very urgent
            } else if (hoursUntil < 72) {
                urgency += 50; // Urgent
            }
        }

        return urgency;
    }

    /**
     * Report Task Issues
     */
    async reportTaskIssues(issues) {
        for (const issue of issues) {
            await this.realtimeManager.createAlert({
                ...issue,
                timestamp: Date.now(),
                source: 'tasks_monitor'
            });
        }
    }

    /**
     * Report Workload Imbalance
     */
    async reportWorkloadImbalance(analysis) {
        if (analysis.overloaded.length > 0) {
            await this.realtimeManager.createAlert({
                type: 'workload_imbalance',
                severity: 'warning',
                message: `${analysis.overloaded.length} עובדים עמוסים מדי`,
                data: analysis,
                timestamp: Date.now(),
                source: 'tasks_monitor'
            });
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        this.tasks.clear();
        this.tasksByEmployee.clear();
        this.tasksByClient.clear();
    }
}