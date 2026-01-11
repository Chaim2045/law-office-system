/**
 * Workload Service - שירות שליפת נתונים לניתוח עומס
 *
 * תפקיד: שליפת נתונים מ-Firestore והעברתם ל-WorkloadCalculator
 * תלות: Firestore, WorkloadCalculator, WorkloadConstants, WorkHoursCalculator
 *
 * נוצר: 2025-12-30
 * גרסה: 5.1.0 - Single Source of Truth for Workdays
 *
 * שינויים בגרסה 5.1.0 (2026-01-04):
 * ✅ Dependency injection: Creates and injects WorkHoursCalculator into WorkloadCalculator
 * ✅ Single instance of WorkHoursCalculator ensures consistent holiday handling
 *
 * שינויים בגרסה 4.1.0:
 * ✅ תיקון: מיזוג נכון של employee data מ-UI ו-Firestore
 * ✅ תיקון: תמיכה ב-Cloud Function v1.1.0 (dual field support)
 *
 * שינויים בגרסה 4.0.0:
 * ✅ Cache TTL נטען מ-WorkloadConstants
 * ✅ שימוש ב-Cloud Function לביצועים
 */

(function() {
    'use strict';

    /**
     * WorkloadService Class
     * שירות ניתוח עומס עבודה
     */
    class WorkloadService {
        constructor() {
            this.db = null;
            this.calculator = null;
            this.cache = new Map();

            // ✅ v4.0.0: שימוש ב-constant
            if (window.WorkloadConstants) {
                this.CACHE_TTL = window.WorkloadConstants.CACHE.TTL_MILLISECONDS;
            } else {
                this.CACHE_TTL = 5 * 60 * 1000; // fallback
            }
        }

        /**
         * אתחול השירות
         */
        init() {
            if (!window.firebaseDB) {
                console.error('❌ WorkloadService: Firebase DB not available');
                return false;
            }

            if (!window.WorkloadCalculator) {
                console.error('❌ WorkloadService: WorkloadCalculator not loaded');
                return false;
            }

            this.db = window.firebaseDB;

            // ✅ v5.1.0: Create single WorkHoursCalculator instance for holiday/workday logic
            // This is the SINGLE SOURCE OF TRUTH for workday counting
            if (window.WorkHoursCalculator) {
                this.workHoursCalculator = new window.WorkHoursCalculator();
                console.log('✅ WorkHoursCalculator initialized (single source of truth for workdays)');
            } else {
                console.warn('⚠️ WorkHoursCalculator not loaded - workload calculations may not include holidays');
                this.workHoursCalculator = null;
            }

            // Pass WorkHoursCalculator to WorkloadCalculator (dependency injection)
            this.calculator = new window.WorkloadCalculator(this.workHoursCalculator);

            console.log('✅ WorkloadService initialized');
            return true;
        }

        /**
         * חישוב עומס לעובד בודד
         * @param {string} employeeEmail - אימייל העובד
         * @param {Object} employeeData - נתוני העובד (אופציונלי - אם כבר יש)
         * @returns {Promise<Object>} - מדדי עומס
         */
        async calculateEmployeeWorkload(employeeEmail, employeeData = null) {
            try {
                console.log(`📊 Calculating workload for: ${employeeEmail}`);

                // בדוק cache
                const cached = this.getFromCache(employeeEmail);
                if (cached) {
                    console.log(`📦 Using cached workload for: ${employeeEmail}`);
                    return cached;
                }

                // שלב 1: שלוף נתוני עובד (אם לא הועבר)
                if (!employeeData) {
                    const employeeDoc = await this.db.collection('employees')
                        .doc(employeeEmail)
                        .get();

                    if (!employeeDoc.exists) {
                        throw new Error(`Employee not found: ${employeeEmail}`);
                    }

                    employeeData = {
                        email: employeeEmail,
                        ...employeeDoc.data()
                    };
                }

                // שלב 2: שלוף משימות פעילות
                const tasks = await this.fetchEmployeeTasks(employeeEmail);

                // שלב 3: שלוף רישומי זמן (חודש אחרון)
                const timesheetEntries = await this.fetchEmployeeTimesheet(employeeEmail);

                // שלב 4: חשב עומס
                const workloadMetrics = this.calculator.calculateWorkload(
                    employeeData,
                    tasks,
                    timesheetEntries
                );

                // 🔍 DEBUG: הצג את כל המדדים
                console.log(`📊 Detailed metrics for ${employeeEmail}:`, {
                    activeTasksCount: workloadMetrics.activeTasksCount,
                    totalBacklogHours: workloadMetrics.totalBacklogHours,
                    tasksWithin24h: workloadMetrics.tasksWithin24h,
                    availableHoursThisWeek: workloadMetrics.availableHoursThisWeek,
                    workloadScore: workloadMetrics.workloadScore,
                    workloadLevel: workloadMetrics.workloadLevel
                });

                // שמור ב-cache
                this.saveToCache(employeeEmail, workloadMetrics);

                console.log(`✅ Workload calculated for ${employeeEmail}: ${workloadMetrics.workloadScore}% (${workloadMetrics.workloadLevel})`);

                return workloadMetrics;

            } catch (error) {
                console.error(`❌ Error calculating workload for ${employeeEmail}:`, error);
                return this.getEmptyWorkloadMetrics(employeeEmail);
            }
        }

        /**
         * ✅ v5.2.0: SAFE wrapper with fail-fast error handling
         * @param {Array} employees - רשימת עובדים
         * @returns {Promise<Object>} - { ok: boolean, data?: Map, error?: {code, message} }
         */
        async calculateAllEmployeesWorkloadSafe(employees) {
            // ✅ v5.2.0: FAIL-FAST - Verify WorkHoursCalculator availability
            if (!this.workHoursCalculator) {
                console.error('❌ FAIL-FAST: WorkHoursCalculator not available - aborting workload calculation');
                return {
                    ok: false,
                    error: {
                        code: 'WORKHOURS_MISSING',
                        message: 'חישובי אנליטיקס הושבתו כדי למנוע נתונים שגויים'
                    }
                };
            }

            // Proceed with normal calculation
            const workloadMap = await this.calculateAllEmployeesWorkload(employees);
            return {
                ok: true,
                data: workloadMap
            };
        }

        /**
         * חישוב עומס לכל העובדים
         * @param {Array} employees - רשימת עובדים
         * @returns {Promise<Map>} - Map של email -> workloadMetrics
         *
         * ✅ v4.0.0: Performance Optimization - משתמש ב-Cloud Function
         */
        async calculateAllEmployeesWorkload(employees) {
            console.log(`📊 Calculating workload for ${employees.length} employees...`);

            // ✅ v4.0.0: שימוש ב-Cloud Function (batch queries)
            if (window.firebaseFunctions && employees.length > 0) {
                try {
                    const startTime = performance.now();

                    // קריאה ל-Cloud Function
                    const getTeamWorkloadData = window.firebaseFunctions.httpsCallable('getTeamWorkloadData');
                    const result = await getTeamWorkloadData({
                        employeeEmails: employees.map(emp => emp.email)
                    });

                    const endTime = performance.now();
                    const duration = Math.round(endTime - startTime);

                    console.log(`✅ Cloud Function completed in ${duration}ms`);
                    console.log('📊 Metadata:', result.data.metadata);

                    // עיבוד התוצאות
                    const workloadMap = new Map();

                    for (const employee of employees) {
                        const email = employee.email;
                        const employeeData = result.data.data[email];

                        if (!employeeData) {
                            console.warn(`⚠️ No data for employee: ${email}`);
                            workloadMap.set(email, this.getEmptyWorkloadMetrics(email));
                            continue;
                        }

                        // 🔧 FIX: מיזוג נכון של נתוני עובד מ-UI ומ-Firestore
                        // נתוני ה-UI עשויים להיות חלקיים, נתוני Firestore הם מלאים
                        const employeeFullData = {
                            ...employee,  // נתונים מה-UI (email, role, displayName, etc.)
                            ...(employeeData.employee || {})  // נתונים מ-Firestore (override אם יש)
                        };

                        // חישוב מדדי עומס עם הנתונים המלאים
                        const metrics = this.calculator.calculateWorkload(
                            employeeFullData,
                            employeeData.tasks,
                            employeeData.timesheetEntries
                        );

                        workloadMap.set(email, metrics);

                        // שמירה ב-cache
                        this.saveToCache(email, metrics);
                    }

                    console.log(`✅ Workload calculated for ${workloadMap.size} employees (${duration}ms total)`);

                    return workloadMap;

                } catch (error) {
                    console.error('❌ Cloud Function failed, falling back to client-side queries:', error);
                    // Fallback למצב ישן אם Cloud Function נכשלה
                }
            }

            // ⚠️ Fallback: חישוב בצד לקוח (N+1 queries - איטי!)
            console.warn('⚠️ Using fallback mode (N+1 queries) - consider deploying Cloud Function');

            const workloadMap = new Map();
            const promises = [];

            employees.forEach(employee => {
                promises.push(
                    this.calculateEmployeeWorkload(employee.email, employee)
                        .then(metrics => {
                            workloadMap.set(employee.email, metrics);
                        })
                        .catch(error => {
                            console.error(`Failed for ${employee.email}:`, error);
                            workloadMap.set(
                                employee.email,
                                this.getEmptyWorkloadMetrics(employee.email)
                            );
                        })
                );
            });

            await Promise.all(promises);

            console.log(`✅ Workload calculated for ${workloadMap.size} employees`);
            return workloadMap;
        }

        /**
         * שליפת משימות פעילות של עובד
         */
        async fetchEmployeeTasks(employeeEmail) {
            console.log(`🔍 Fetching tasks for ${employeeEmail}...`);

            // ✅ UPDATED: המערכת משתמשת ב-status === 'פעיל' למשימות פעילות
            // נמשוך הכל ונסנן client-side כי אין index מורכב employee+status
            const snapshot = await this.db.collection('budget_tasks')
                .where('employee', '==', employeeEmail)
                .get();

            const tasks = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // סינון: רק משימות פעילות
                if (data.status === 'פעיל') {
                    tasks.push({
                        taskId: doc.id,
                        ...data
                    });
                }
            });

            console.log(`✅ Found ${tasks.length} active tasks for ${employeeEmail} (out of ${snapshot.size} total)`);
            return tasks;
        }

        /**
         * שליפת רישומי זמן (חודש אחרון)
         */
        async fetchEmployeeTimesheet(employeeEmail) {
            console.log(`🔍 Fetching timesheet for ${employeeEmail}...`);
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startDateStr = this.dateToString(startOfMonth);

            const snapshot = await this.db.collection('timesheet_entries')
                .where('employee', '==', employeeEmail)
                .where('date', '>=', startDateStr)
                .get();

            const entries = [];
            snapshot.forEach(doc => {
                entries.push(doc.data());
            });

            console.log(`✅ Found ${entries.length} timesheet entries for ${employeeEmail}`);
            return entries;
        }

        /**
         * סטטיסטיקות צוות
         */
        calculateTeamStats(workloadMap) {
            const employees = Array.from(workloadMap.values());

            if (employees.length === 0) {
                return {
                    averageScore: 0,
                    lowCount: 0,
                    mediumCount: 0,
                    highCount: 0,
                    criticalCount: 0,
                    availableCount: 0,
                    overloadedCount: 0,
                    totalAlerts: 0
                };
            }

            const scores = employees.map(e => e.workloadScore);
            const averageScore = Math.round(
                scores.reduce((sum, s) => sum + s, 0) / scores.length
            );

            const levelCounts = {
                low: 0,
                medium: 0,
                high: 0,
                critical: 0
            };

            let totalAlerts = 0;

            employees.forEach(emp => {
                levelCounts[emp.workloadLevel]++;
                totalAlerts += emp.alerts.length;
            });

            return {
                averageScore,
                lowCount: levelCounts.low,
                mediumCount: levelCounts.medium,
                highCount: levelCounts.high,
                criticalCount: levelCounts.critical,
                availableCount: levelCounts.low + levelCounts.medium, // פחות מ-60%
                overloadedCount: levelCounts.high + levelCounts.critical, // יותר מ-60%
                totalAlerts
            };
        }

        /**
         * מצא עובדים זמינים למשימה חדשה
         */
        findAvailableEmployees(workloadMap, maxWorkloadScore = 70) {
            const available = [];

            workloadMap.forEach((metrics, email) => {
                if (metrics.workloadScore < maxWorkloadScore && metrics.canTakeNewTask) {
                    available.push({
                        email,
                        workloadScore: metrics.workloadScore,
                        workloadLevel: metrics.workloadLevel,
                        availableHoursToday: metrics.availableHoursToday,
                        activeTasksCount: metrics.activeTasksCount,
                        estimatedDaysToComplete: metrics.estimatedDaysToComplete
                    });
                }
            });

            // מיון לפי עומס (הכי פחות עמוס ראשון)
            available.sort((a, b) => a.workloadScore - b.workloadScore);

            return available;
        }

        /**
         * זיהוי עובדים בעומס קריטי
         */
        findOverloadedEmployees(workloadMap) {
            const overloaded = [];

            workloadMap.forEach((metrics, email) => {
                if (metrics.workloadLevel === 'critical' || metrics.workloadLevel === 'high') {
                    overloaded.push({
                        email,
                        workloadScore: metrics.workloadScore,
                        workloadLevel: metrics.workloadLevel,
                        alerts: metrics.alerts,
                        riskyTasks: metrics.riskyTasks,
                        totalBacklogHours: metrics.totalBacklogHours
                    });
                }
            });

            // מיון לפי חומרה (הכי עמוס ראשון)
            overloaded.sort((a, b) => b.workloadScore - a.workloadScore);

            return overloaded;
        }

        // ═══════════════════════════════════════════════════════════════
        // Cache Management
        // ═══════════════════════════════════════════════════════════════

        getFromCache(employeeEmail) {
            const cached = this.cache.get(employeeEmail);
            if (!cached) {
return null;
}

            const now = Date.now();
            if (now - cached.timestamp > this.CACHE_TTL) {
                this.cache.delete(employeeEmail);
                return null;
            }

            return cached.data;
        }

        saveToCache(employeeEmail, data) {
            this.cache.set(employeeEmail, {
                timestamp: Date.now(),
                data
            });
        }

        clearCache() {
            this.cache.clear();
            console.log('🗑️ Workload cache cleared');
        }

        // ═══════════════════════════════════════════════════════════════
        // Helper Functions
        // ═══════════════════════════════════════════════════════════════

        dateToString(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        getEmptyWorkloadMetrics(employeeEmail) {
            return {
                calculatedAt: new Date().toISOString(),
                employeeEmail,
                version: '1.0.0',
                activeTasksCount: 0,
                totalEstimatedHours: 0,
                totalActualHours: 0,
                totalBacklogHours: 0,
                workloadScore: 0,
                workloadLevel: 'unknown',
                alerts: [],
                riskyTasks: [],
                canTakeNewTask: true,
                error: true
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // Global Export
    // ═══════════════════════════════════════════════════════════════

    // Export both Class and Instance
    window.WorkloadServiceClass = WorkloadService;

    // יצירת instance גלובלי
    const workloadService = new WorkloadService();
    window.WorkloadService = workloadService;

    console.log('✅ WorkloadService v4.1.0 loaded - Data Accuracy Fixed');

})();
