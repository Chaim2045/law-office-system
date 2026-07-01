/**
 * User Details Modal Component
 * קומפוננטת מודאל פרטי משתמש
 *
 * נוצר: 31/10/2025
 * גרסה: 1.0.0
 * Phase: 3 - User Management Logic
 *
 * תפקיד: הצגת פרטי משתמש מלאים בטאבים
 */

(function() {
    'use strict';

    /**
     * UserDetailsModal Class
     * מנהל את מודאל פרטי המשתמש
     */
    class UserDetailsModal {
        constructor() {
            this.currentUser = null;
            this.modalId = null;
            this.activeTab = 'general';
            this.userData = null; // Full user data from backend

            // ✅ Activity tab state (Lazy Loading)
            this.activityLoaded = false;  // האם פעילות נטענה?
            this.activityData = [];       // נתוני פעילות
            this.activityLoading = false; // האם בטעינה?
            this.activityHasMore = false; // יש עוד לטעון?
            this.activityLastTimestamp = null; // Timestamp אחרון (pagination)

            // Hours tab state
            this.hoursViewMode = 'cards'; // 'cards' or 'table'
            this.selectedMonth = new Date().getMonth() + 1; // Current month (1-12)
            this.selectedYear = new Date().getFullYear(); // Current year
            this.hoursFilters = {
                dateFrom: null,
                dateTo: null,
                client: 'all',
                task: 'all',
                type: 'all', // all / client / internal
                billable: 'all', // all / yes / no
                searchText: ''
            };
            this.hoursSortBy = 'date'; // date / client / hours
            this.hoursSortDirection = 'desc'; // asc / desc

            // Tasks tab state
            this.tasksSubTab = 'active'; // 'active' or 'completed'
            this.tasksPanelSubTab = 'active'; // 'active' or 'completed' (for slide-in panel)

            // Performance tab state — separate from userData.hours to avoid side effects
            this.performanceHours = null;        // Timesheet entries for performance tab (separate month)
            this.performanceLoadedMonth = null;   // Which month is loaded in performanceHours (1-12)
            this.performanceLoadedYear = null;    // Which year is loaded in performanceHours
            this.performanceRequestId = 0;        // Race condition guard for async loads
            this.initialLoadMonth = null;         // Month loaded in loadFullUserData (set once)
            this.initialLoadYear = null;          // Year loaded in loadFullUserData (set once)
        }

        /**
         * Open user details modal
         * פתיחת מודאל פרטי משתמש
         *
         * @param {Object} user - User data
         */
        async open(user) {
            if (!user || !user.email) {
                console.error('❌ UserDetailsModal: Invalid user data');
                return;
            }

            this.currentUser = user;
            this.activeTab = 'general';

            // Create modal
            this.modalId = window.ModalManager.create({
                title: `פרטי משתמש: ${user.displayName || user.email}`,
                content: this.renderLoadingState(),
                footer: this.renderFooter(),
                size: 'xlarge',
                onOpen: async () => {
                    console.log('🚀 onOpen: Starting to load user data...');
                    await this.loadFullUserData();
                    console.log('✅ onOpen: Finished loading user data');
                }
            });

            console.log(`✅ UserDetailsModal opened for: ${user.email}`);
        }

        /**
         * Render loading state
         * רינדור מצב טעינה
         */
        renderLoadingState() {
            return `
                <div class="user-details-loading">
                    <div class="loading-spinner-modal">
                        <div class="spinner-circle-modal"></div>
                    </div>
                    <p>טוען נתוני משתמש...</p>
                </div>
            `;
        }

        /**
         * Load full user data from backend
         * טעינת נתוני משתמש מלאים מהשרת
         */
        async loadFullUserData() {
            try {
                console.log('📥 Loading full user data...');

                // Try to load from Cloud Function with shorter timeout for better UX
                const cloudFunctionPromise = this.loadFromCloudFunction();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), 500) // 500ms timeout - fast fallback
                );

                try {
                    // Race between Cloud Function and timeout
                    await Promise.race([cloudFunctionPromise, timeoutPromise]);
                    console.log('✅ User data loaded from Cloud Function');
                } catch (cloudError) {
                    // If Cloud Function fails or times out, use Firestore directly
                    console.log('⚡ Cloud Function failed/timeout, loading from Firestore...');
                    await this.loadFromFirestore();
                    console.log('✅ User data loaded from Firestore (fast fallback)');
                }

                // Update modal content with full data
                console.log('🔄 Updating modal content with loaded data:', {
                    clients: this.userData?.clients?.length || 0,
                    tasks: this.userData?.tasks?.length || 0,
                    activity: this.userData?.activity?.length || 0,
                    clientsCount: this.userData?.clientsCount,
                    tasksCount: this.userData?.tasksCount
                });

                window.ModalManager.updateContent(this.modalId, this.renderContent());
                console.log('✅ Modal content updated');

                // Setup events after content is rendered
                this.setupEvents();

            } catch (error) {
                console.error('❌ Error loading user data:', error);

                // Ultimate fallback: Use basic user data from DataManager
                console.log('⚠️ Using basic fallback data');

                this.userData = {
                    ...this.currentUser,
                    clients: [],
                    tasks: [],
                    timesheet: [],
                    hours: [], // Alias for compatibility
                    activity: [],
                    stats: {},
                    clientsCount: 0,
                    tasksCount: 0,
                    hoursThisWeek: 0,
                    hoursThisMonth: 0
                };

                // Update modal content with fallback data
                window.ModalManager.updateContent(this.modalId, this.renderContent());

                // Setup events
                this.setupEvents();
            }
        }

        /**
         * Load data from Cloud Function
         * טעינת דאטה מ-Cloud Function
         */
        async loadFromCloudFunction() {
            // Call Cloud Function to get full user details
            const getUserDetailsFunction = window.firebaseFunctions.httpsCallable('getUserFullDetails');

            const result = await getUserDetailsFunction({
                email: this.currentUser.email,
                month: this.selectedMonth,  // ✅ שליחת חודש נבחר
                year: this.selectedYear     // ✅ שליחת שנה נבחרת
            });

            // Parse the response structure from Cloud Function
            const responseData = result.data;

            // Merge user data with stats and other data
            this.userData = {
                ...responseData.user,
                uid: responseData.user.authUID || this.currentUser.uid, // ✅ תיקון: הוספת UID לצ'אט
                status: responseData.user.isActive ? 'active' : 'blocked',
                clients: responseData.clients || [],
                tasks: responseData.tasks || [],
                timesheet: responseData.timesheet || [],
                hours: responseData.timesheet || [],
                activity: responseData.activity || [],
                stats: responseData.stats || {},
                clientsCount: responseData.stats?.totalClients || 0,
                tasksCount: responseData.stats?.activeTasks || 0,
                hoursThisWeek: responseData.stats?.hoursThisWeek || 0,
                hoursThisMonth: responseData.stats?.hoursThisMonth || 0,
                hoursPreFiltered: true  // ✅ סימון שהנתונים כבר מסוננים מהשרת
            };

            // Track which month was loaded for performance tab cross-reference
            this.initialLoadMonth = this.selectedMonth;
            this.initialLoadYear = this.selectedYear;
        }

        /**
         * Load data directly from Firestore (fast fallback)
         * טעינת דאטה ישירה מ-Firestore - מהיר!
         */
        async loadFromFirestore() {
            const db = window.firebaseDB;
            const userEmail = this.currentUser.email;

            // First, try to get user from DataManager (already loaded with stats)
            let userData = null;
            let allUsers = null;

            // DataManager stores users in 'allUsers' property, accessible via getAllUsers()
            if (window.DataManager && typeof window.DataManager.getAllUsers === 'function') {
                allUsers = window.DataManager.getAllUsers();
            }

            console.log('🔍 Checking DataManager:', {
                exists: !!window.DataManager,
                hasGetAllUsers: !!(window.DataManager && typeof window.DataManager.getAllUsers === 'function'),
                usersCount: allUsers?.length || 0
            });

            if (allUsers && allUsers.length > 0) {
                userData = allUsers.find(u => u.email === userEmail);
                console.log('📊 Found user in DataManager:', userData ? 'Yes' : 'No');
                if (userData) {
                    console.log('📊 User stats from DataManager:', {
                        clientsCount: userData.clientsCount,
                        tasksCount: userData.tasksCount,
                        hoursThisMonth: userData.hoursThisMonth,
                        hoursThisWeek: userData.hoursThisWeek
                    });
                }
            } else {
                console.log('⚠️ DataManager not available or no users loaded');
            }

            // If not found in DataManager, try employees collection
            if (!userData) {
                console.log('🔍 Loading user from employees collection...');
                const userDoc = await db.collection('employees').doc(userEmail).get();
                userData = userDoc.exists ? userDoc.data() : this.currentUser;
                console.log('📊 User from employees:', userDoc.exists ? 'Found' : 'Not found, using currentUser');
            }

            // Get userId for activity logs query
            const userId = userData.uid || this.currentUser.uid || this.currentUser.id;

            // Load related data in parallel for speed
            const [clientsSnapshot, tasksSnapshot, timesheetSnapshot, activitySnapshot] = await Promise.all([
                // Get user's clients (limit to recent 50)
                db.collection('cases')
                    .where('assignedTo', 'array-contains', userEmail)
                    .orderBy('createdAt', 'desc')
                    .limit(50)
                    .get()
                    .catch(() => ({ docs: [] })),

                // Get user's tasks
                db.collection('budget_tasks')
                    .where('employee', '==', userEmail)
                    .orderBy('createdAt', 'desc')
                    .get()
                    .catch(() => ({ docs: [] })),

                // Get timesheet entries for selected month/year
                (() => {
                    // ✅ סינון לפי חודש ושנה נבחרים
                    const startOfMonth = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-01`;
                    const lastDay = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
                    const endOfMonth = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`;

                    // ✅ FIX: שימוש בקולקציה timesheet_entries במקום timesheet
                    // ✅ FIX: שימוש בשדה employee במקום employeeEmail
                    return db.collection('timesheet_entries')
                        .where('employee', '==', userEmail)
                        .where('date', '>=', startOfMonth)
                        .where('date', '<=', endOfMonth)
                        .orderBy('date', 'desc')
                        .get()
                        .catch(() => ({ docs: [] }));
                })(),

                // Get user's activity logs (last 100 entries)
                db.collection('activity_log')
                    .where('userId', '==', userId)
                    .orderBy('timestamp', 'desc')
                    .limit(100)
                    .get()
                    .catch(() => ({ docs: [] }))
            ]);

            // Process clients
            const clients = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Process tasks
            const tasks = tasksSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Process timesheet
            // ✅ FIX: המרת minutes ל-hours כי timesheet_entries משתמש ב-minutes
            const timesheet = timesheetSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // ✅ אם יש minutes אבל אין hours, המר minutes ל-hours
                    hours: data.hours ?? (data.minutes ? data.minutes / 60 : 0)
                };
            });

            // Process activity logs
            const activity = activitySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Calculate stats
            const now = new Date();
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            // ✅ FIX: שימוש ב-hours המעובד (שכולל המרה מ-minutes)
            const hoursThisWeek = timesheet
                .filter(entry => new Date(entry.date.toDate?.() || entry.date) >= startOfWeek)
                .reduce((sum, entry) => sum + (entry.hours || 0), 0);

            const hoursThisMonth = timesheet
                .filter(entry => new Date(entry.date.toDate?.() || entry.date) >= startOfMonth)
                .reduce((sum, entry) => sum + (entry.hours || 0), 0);

            // Set user data - use counts from DataManager if available, otherwise calculate
            const clientsCount = userData.clientsCount ?? clients.length;
            const tasksCount = userData.tasksCount ?? tasks.length;
            const hoursThisMonthCalc = userData.hoursThisMonth ?? hoursThisMonth;
            const hoursThisWeekCalc = userData.hoursThisWeek ?? hoursThisWeek;

            this.userData = {
                ...userData,
                email: userEmail,
                uid: userData.authUID || this.currentUser.uid, // ✅ תיקון: הוספת UID לצ'אט
                status: userData.isActive !== false ? 'active' : 'blocked',
                clients,
                tasks,
                timesheet,
                hours: timesheet,
                activity,
                stats: {
                    totalClients: clientsCount,
                    activeTasks: tasksCount,
                    hoursThisWeek: hoursThisWeekCalc,
                    hoursThisMonth: hoursThisMonthCalc
                },
                clientsCount,
                tasksCount,
                hoursThisWeek: hoursThisWeekCalc,
                hoursThisMonth: hoursThisMonthCalc,
                hoursPreFiltered: true  // ✅ סימון שהנתונים כבר מסוננים מ-Firestore
            };

            // Track which month was loaded for performance tab cross-reference
            this.initialLoadMonth = this.selectedMonth;
            this.initialLoadYear = this.selectedYear;

            console.log(`✅ Loaded user data: ${clients.length} clients, ${tasks.length} tasks, ${timesheet.length} timesheet entries, ${activity.length} activity logs`);
            console.log(`✅ Stats from DataManager: clientsCount=${clientsCount}, tasksCount=${tasksCount}, hoursThisMonth=${hoursThisMonthCalc}`);
        }

        /**
         * Render error state
         * רינדור מצב שגיאה
         */
        renderErrorState(error) {
            return `
                <div class="user-details-error">
                    <i class="fas fa-exclamation-circle error-icon"></i>
                    <h3>שגיאה בטעינת נתונים</h3>
                    <p>${error.message || 'אירעה שגיאה בלתי צפויה'}</p>
                    <button class="btn btn-primary" onclick="window.ModalManager.close('${this.modalId}')">
                        <i class="fas fa-times"></i>
                        <span>סגור</span>
                    </button>
                </div>
            `;
        }

        /**
         * Render content with tabs
         * רינדור תוכן עם טאבים
         */
        renderContent() {
            return `
                <div class="user-details-container">
                    <!-- Tabs Navigation -->
                    <div class="user-details-tabs">
                        ${this.renderTabButton('general', 'fas fa-user', 'פרטים כלליים')}
                        ${this.renderTabButton('clients', 'fas fa-briefcase', 'לקוחות')}
                        ${this.renderTabButton('tasks', 'fas fa-tasks', 'משימות')}
                        ${this.renderTabButton('hours', 'fas fa-clock', 'שעות')}
                        ${this.renderTabButton('performance', 'fas fa-chart-line', 'ביצועים יומיים')}
                        ${this.renderTabButton('activity', 'fas fa-history', 'פעילות')}
                    </div>

                    <!-- Tab Content -->
                    <div class="user-details-content">
                        ${this.renderTabContent()}
                    </div>
                </div>
            `;
        }

        /**
         * Render tab button
         * רינדור כפתור טאב
         */
        renderTabButton(tabId, icon, label) {
            const active = this.activeTab === tabId ? 'active' : '';
            return `
                <button class="user-tab-btn ${active}" data-tab="${tabId}">
                    <i class="${icon}"></i>
                    <span>${label}</span>
                </button>
            `;
        }

        /**
         * Render active tab content
         * רינדור תוכן הטאב הפעיל
         */
        renderTabContent() {
            switch (this.activeTab) {
                case 'general':
                    return this.renderGeneralTab();
                case 'clients':
                    return this.renderClientsTab();
                case 'tasks':
                    return this.renderTasksTab();
                case 'hours':
                    return this.renderHoursTab();
                case 'performance':
                    return this.renderPerformanceTab();
                case 'activity':
                    return this.renderActivityTab();
                default:
                    return '<p>טאב לא נמצא</p>';
            }
        }

        /**
         * Render General Tab
         * רינדור טאב פרטים כלליים
         */
        renderGeneralTab() {
            const user = this.userData || this.currentUser;

            console.log('📊 renderGeneralTab - Stats:', {
                clientsCount: user.clientsCount,
                tasksCount: user.tasksCount,
                hoursThisMonth: user.hoursThisMonth,
                hasUserData: !!this.userData
            });

            return `
                <div class="tab-panel tab-general">
                    <div class="user-info-grid">
                        <!-- Avatar Section -->
                        <div class="user-avatar-section">
                            ${this.renderUserAvatar(user)}
                            <h3 class="user-name">${this.escapeHtml(user.displayName || user.username)}</h3>
                            <p class="user-email">${this.escapeHtml(user.email)}</p>
                            ${this.renderStatusBadge(user.status)}
                        </div>

                        <!-- Basic Info -->
                        <div class="user-info-section">
                            <h4 class="section-title">
                                <i class="fas fa-info-circle"></i>
                                <span>מידע בסיסי</span>
                            </h4>
                            <div class="info-list">
                                ${this.renderInfoRow('שם משתמש', user.username || 'לא הוגדר')}
                                ${this.renderInfoRow('תפקיד', this.getRoleText(user.role))}
                                ${this.renderInfoRow('סטטוס', this.getStatusText(user.status))}
                                ${this.renderInfoRow('תאריך יצירה', this.formatDate(user.createdAt))}
                                ${this.renderInfoRow('סטטוס פעילות', this.formatLastSeenStatus(user))}
                            </div>
                        </div>

                        <!-- Statistics -->
                        <div class="user-info-section">
                            <h4 class="section-title">
                                <i class="fas fa-chart-bar"></i>
                                <span>סטטיסטיקות</span>
                            </h4>
                            <div class="user-stats-grid">
                                ${this.renderStatCard('fas fa-briefcase', user.clientsCount || 0, 'לקוחות')}
                                ${this.renderStatCard('fas fa-tasks', user.tasksCount || 0, 'משימות')}
                                ${this.renderStatCard('fas fa-clock', user.hoursThisMonth || 0, 'שעות חודש זה')}
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="user-info-section">
                            <h4 class="section-title">
                                <i class="fas fa-cog"></i>
                                <span>פעולות</span>
                            </h4>
                            <div class="user-actions-grid">
                                <button class="btn-action" data-action="edit">
                                    <i class="fas fa-edit"></i>
                                    <span>ערוך פרטים</span>
                                </button>
                                <button class="btn-action ${user.status === window.ADMIN_PANEL_CONSTANTS.USER_STATUS.BLOCKED ? 'btn-success' : 'btn-warning'}" data-action="block">
                                    <i class="fas fa-ban"></i>
                                    <span>${user.status === window.ADMIN_PANEL_CONSTANTS.USER_STATUS.BLOCKED ? 'הסר חסימה' : 'חסום משתמש'}</span>
                                </button>
                                <button class="btn-action btn-info" data-action="delete-data">
                                    <i class="fas fa-broom"></i>
                                    <span>מחק משימות/שעתונים</span>
                                </button>
                                <button class="btn-action btn-danger" data-action="delete">
                                    <i class="fas fa-trash"></i>
                                    <span>מחק משתמש</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Render Clients Tab
         * רינדור טאב לקוחות
         */
        renderClientsTab() {
            const clients = this.userData?.clients || [];

            if (clients.length === 0) {
                return this.renderEmptyState('fas fa-briefcase', 'אין לקוחות', 'משתמש זה לא מקושר ללקוחות כלשהם');
            }

            return `
                <div class="tab-panel tab-clients">
                    <div class="clients-list">
                        ${clients.map(client => this.renderClientCard(client)).join('')}
                    </div>
                </div>
            `;
        }

        /**
         * Render Tasks Tab
         * רינדור טאב משימות
         */
        renderTasksTab() {
            const tasks = this.userData?.tasks || [];

            if (tasks.length === 0) {
                return this.renderEmptyState('fas fa-tasks', 'אין משימות', 'משתמש זה לא מקושר למשימות');
            }

            // Filter by sub-tab
            const activeTasks = tasks.filter(t => t.status === 'פעיל' || t.status === 'active' || t.status === 'פעילה');
            const completedTasks = tasks.filter(t => t.status === 'הושלם' || t.status === 'completed' || t.status === 'הושלמה');
            const currentTasks = this.tasksSubTab === 'completed' ? completedTasks : activeTasks;

            const activeCount = activeTasks.length;
            const completedCount = completedTasks.length;

            // Show first 3 tasks
            const displayedTasks = currentTasks.slice(0, 3);
            const hasMoreTasks = currentTasks.length > 3;

            return `
                <div class="tab-panel tab-tasks">
                    <!-- Sub-tabs -->
                    <div style="display: flex; gap: 0; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px;">
                        <button class="tasks-sub-tab ${this.tasksSubTab === 'active' ? 'active' : ''}" data-sub-tab="active"
                            style="padding: 10px 20px; font-size: 14px; font-weight: 600; border: none; background: none; cursor: pointer; color: ${this.tasksSubTab === 'active' ? '#1e293b' : '#94a3b8'}; border-bottom: 2px solid ${this.tasksSubTab === 'active' ? '#3b82f6' : 'transparent'}; margin-bottom: -2px; transition: all 0.2s;">
                            פעיל <span style="font-weight: 400; color: ${this.tasksSubTab === 'active' ? '#64748b' : '#cbd5e1'};">(${activeCount})</span>
                        </button>
                        <button class="tasks-sub-tab ${this.tasksSubTab === 'completed' ? 'active' : ''}" data-sub-tab="completed"
                            style="padding: 10px 20px; font-size: 14px; font-weight: 600; border: none; background: none; cursor: pointer; color: ${this.tasksSubTab === 'completed' ? '#1e293b' : '#94a3b8'}; border-bottom: 2px solid ${this.tasksSubTab === 'completed' ? '#3b82f6' : 'transparent'}; margin-bottom: -2px; transition: all 0.2s;">
                            הושלם <span style="font-weight: 400; color: ${this.tasksSubTab === 'completed' ? '#64748b' : '#cbd5e1'};">(${completedCount})</span>
                        </button>
                    </div>

                    ${currentTasks.length === 0 ? `
                        <div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
                            <i class="fas fa-${this.tasksSubTab === 'completed' ? 'check-circle' : 'tasks'}" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
                            <p style="font-size: 14px;">${this.tasksSubTab === 'completed' ? 'אין משימות שהושלמו' : 'אין משימות פעילות'}</p>
                        </div>
                    ` : `
                        <div class="tasks-list">
                            ${displayedTasks.map(task => this.renderTaskCard(task)).join('')}
                        </div>
                        ${hasMoreTasks ? `
                            <button class="show-all-tasks-btn" data-action="show-all-tasks">
                                <i class="fas fa-list"></i>
                                <span>הצג את כל המשימות (${currentTasks.length})</span>
                            </button>
                        ` : ''}
                    `}
                </div>
            `;
        }

        /**
         * Render Hours Tab
         * טאב שעות משופר עם שליטה מלאה
         */
        renderHoursTab() {
            const hours = this.userData?.hours || [];

            // סנן את השעות
            const filteredHours = this.filterAndSortHours(hours);

            // חשב סטטיסטיקות מפורטות
            const totalHours = filteredHours.reduce((sum, entry) => sum + (entry.hours || 0), 0);
            // ✅ תיקון: בדיקה לפי isInternal במקום clientId
            const clientHours = filteredHours.filter(e => !e.isInternal)
                .reduce((sum, entry) => sum + (entry.hours || 0), 0);
            const internalHours = filteredHours.filter(e => e.isInternal)
                .reduce((sum, entry) => sum + (entry.hours || 0), 0);

            // חשב אחוזים
            const clientPercentage = totalHours > 0 ? ((clientHours / totalHours) * 100).toFixed(1) : 0;
            const internalPercentage = totalHours > 0 ? ((internalHours / totalHours) * 100).toFixed(1) : 0;

            // ספירת רשומות
            const clientEntriesCount = filteredHours.filter(e => !e.isInternal).length;
            const internalEntriesCount = filteredHours.filter(e => e.isInternal).length;

            // שעות חייבות vs לא חייבות
            const billableHours = filteredHours.filter(e => e.billable)
                .reduce((sum, entry) => sum + (entry.hours || 0), 0);
            const nonBillableHours = filteredHours.filter(e => !e.billable)
                .reduce((sum, entry) => sum + (entry.hours || 0), 0);

            // Breakdown לפי לקוחות
            const clientBreakdown = this.calculateClientBreakdown(filteredHours);

            return `
                <div class="tab-panel tab-hours" style="padding: 20px;">

                    <!-- סיכום מהיר -->
                    <div style="background: white; padding: 16px 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 24px; flex-wrap: wrap;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-clock" style="color: #3b82f6;"></i>
                                <span style="font-weight: 700; font-size: 18px; color: #1f2937;">${totalHours.toFixed(1)}</span>
                                <span style="color: #6b7280; font-size: 14px;">שעות</span>
                            </div>
                            <div style="width: 1px; height: 24px; background: #e5e7eb;"></div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-briefcase" style="color: #3b82f6; font-size: 14px;"></i>
                                <span style="font-weight: 600; color: #1f2937;">${clientHours.toFixed(1)}</span>
                                <span style="color: #6b7280; font-size: 13px;">(${clientPercentage}%)</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-building" style="color: #94a3b8; font-size: 14px;"></i>
                                <span style="font-weight: 600; color: #1f2937;">${internalHours.toFixed(1)}</span>
                                <span style="color: #6b7280; font-size: 13px;">(${internalPercentage}%)</span>
                            </div>
                            ${billableHours > 0 ? `
                            <div style="width: 1px; height: 24px; background: #e5e7eb;"></div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-check-circle" style="color: #3b82f6; font-size: 14px;"></i>
                                <span style="font-weight: 600; color: #1f2937;">${billableHours.toFixed(1)}</span>
                                <span style="color: #6b7280; font-size: 13px;">חויב</span>
                            </div>
                            ` : ''}
                            <div style="margin-right: auto; display: flex; align-items: center; gap: 8px; color: #6b7280; font-size: 13px;">
                                <i class="fas fa-list"></i>
                                <span>${filteredHours.length} רשומות</span>
                            </div>
                        </div>
                    </div>

                    <!-- בורר תקופה + פילטרים -->
                    <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px;">
                        <div style="display: grid; grid-template-columns: auto 1fr auto; gap: 16px; align-items: end;">
                            <!-- תקופה -->
                            <div style="display: flex; gap: 8px; align-items: end;">
                                <div>
                                    <label style="display: block; font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px;">חודש</label>
                                    <select id="monthSelector" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white; min-width: 120px;">
                                        <option value="1" ${this.selectedMonth === 1 ? 'selected' : ''}>ינואר</option>
                                        <option value="2" ${this.selectedMonth === 2 ? 'selected' : ''}>פברואר</option>
                                        <option value="3" ${this.selectedMonth === 3 ? 'selected' : ''}>מרץ</option>
                                        <option value="4" ${this.selectedMonth === 4 ? 'selected' : ''}>אפריל</option>
                                        <option value="5" ${this.selectedMonth === 5 ? 'selected' : ''}>מאי</option>
                                        <option value="6" ${this.selectedMonth === 6 ? 'selected' : ''}>יוני</option>
                                        <option value="7" ${this.selectedMonth === 7 ? 'selected' : ''}>יולי</option>
                                        <option value="8" ${this.selectedMonth === 8 ? 'selected' : ''}>אוגוסט</option>
                                        <option value="9" ${this.selectedMonth === 9 ? 'selected' : ''}>ספטמבר</option>
                                        <option value="10" ${this.selectedMonth === 10 ? 'selected' : ''}>אוקטובר</option>
                                        <option value="11" ${this.selectedMonth === 11 ? 'selected' : ''}>נובמבר</option>
                                        <option value="12" ${this.selectedMonth === 12 ? 'selected' : ''}>דצמבר</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px;">שנה</label>
                                    <select id="yearSelector" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white; min-width: 100px;">
                                        ${this.renderYearOptions()}
                                    </select>
                                </div>
                                <button id="prevMonthBtn" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: white; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'" title="חודש קודם">
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                                <button id="nextMonthBtn" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: white; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'" title="חודש הבא">
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                            </div>

                            <!-- פילטרים -->
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                                <div>
                                    <label style="display: block; font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px;">סוג</label>
                                    <select id="typeFilter" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
                                        <option value="all" ${this.hoursFilters.type === 'all' ? 'selected' : ''}>הכל</option>
                                        <option value="client" ${this.hoursFilters.type === 'client' ? 'selected' : ''}>לקוחות</option>
                                        <option value="internal" ${this.hoursFilters.type === 'internal' ? 'selected' : ''}>פנימי</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px;">חיוב</label>
                                    <select id="billableFilter" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
                                        <option value="all" ${this.hoursFilters.billable === 'all' ? 'selected' : ''}>הכל</option>
                                        <option value="yes" ${this.hoursFilters.billable === 'yes' ? 'selected' : ''}>חויב</option>
                                        <option value="no" ${this.hoursFilters.billable === 'no' ? 'selected' : ''}>לא חויב</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px;">חיפוש</label>
                                    <input type="text" id="searchFilter" placeholder="חפש..." value="${this.escapeHtml(this.hoursFilters.searchText || '')}" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                                </div>
                            </div>

                            <!-- תצוגה -->
                            <div style="display: flex; gap: 8px;">
                                <button class="view-toggle-btn ${this.hoursViewMode === 'table' ? 'active' : ''}" data-view="table" style="padding: 8px 16px; border-radius: 6px; border: 1px solid ${this.hoursViewMode === 'table' ? '#3b82f6' : '#d1d5db'}; background: ${this.hoursViewMode === 'table' ? '#3b82f6' : 'white'}; color: ${this.hoursViewMode === 'table' ? 'white' : '#6b7280'}; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 14px;">
                                    <i class="fas fa-table"></i>
                                    <span>טבלה</span>
                                </button>
                                <button class="view-toggle-btn ${this.hoursViewMode === 'cards' ? 'active' : ''}" data-view="cards" style="padding: 8px 16px; border-radius: 6px; border: 1px solid ${this.hoursViewMode === 'cards' ? '#3b82f6' : '#d1d5db'}; background: ${this.hoursViewMode === 'cards' ? '#3b82f6' : 'white'}; color: ${this.hoursViewMode === 'cards' ? 'white' : '#6b7280'}; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 14px;">
                                    <i class="fas fa-th-large"></i>
                                    <span>כרטיסים</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- תצוגת נתונים -->
                    ${this.hoursViewMode === 'table' ? this.renderHoursTable(filteredHours) : this.renderHoursCards(filteredHours)}
                </div>
            `;
        }

        /**
         * ✅ Load Activity Tab (Lazy Loading)
         * טעינת טאב פעילות - רק כשהמשתמש לוחץ על הטאב
         */
        async loadActivityTab() {
            this.activityLoading = true;
            this.updateModalContent(); // Show loading state

            try {
                console.log('📡 Loading activity for:', this.currentUser.email);

                const getUserActivityFunction = firebase.app()
                    .functions()
                    .httpsCallable('getUserActivity');

                const result = await getUserActivityFunction({
                    email: this.currentUser.email,
                    limit: 20
                });

                console.log('✅ Activity loaded:', result.data);

                this.activityData = result.data.activity || [];
                this.activityHasMore = result.data.hasMore || false;
                this.activityLastTimestamp = result.data.lastTimestamp;
                this.activityLoaded = true;

            } catch (error) {
                console.error('❌ Error loading activity:', error);
                this.activityData = [];
                this.activityLoaded = true; // Don't retry automatically

                if (window.notify) {
                    window.notify.error('שגיאה בטעינת פעילות');
                }
            } finally {
                this.activityLoading = false;
                this.updateModalContent();
            }
        }

        /**
         * ✅ Load More Activity (Pagination)
         * טעינת עוד פעילות - כשלוחצים "טען עוד"
         */
        async loadMoreActivity() {
            if (this.activityLoading || !this.activityHasMore) {
return;
}

            this.activityLoading = true;

            // Update button to "Loading..."
            const btn = document.querySelector('.btn-load-more-activity');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> טוען...';
                btn.disabled = true;
            }

            try {
                const getUserActivityFunction = firebase.app()
                    .functions()
                    .httpsCallable('getUserActivity');

                const result = await getUserActivityFunction({
                    email: this.currentUser.email,
                    limit: 20,
                    startAfter: this.activityLastTimestamp
                });

                // Append to existing data
                this.activityData = [...this.activityData, ...result.data.activity];
                this.activityHasMore = result.data.hasMore;
                this.activityLastTimestamp = result.data.lastTimestamp;

                this.updateModalContent();

            } catch (error) {
                console.error('❌ Error loading more activity:', error);
                if (window.notify) {
                    window.notify.error('שגיאה בטעינת פעילות נוספת');
                }
            } finally {
                this.activityLoading = false;
            }
        }

        /**
         * Render Activity Tab
         * רינדור טאב פעילות
         */
        renderActivityTab() {
            // ✅ Loading state
            if (this.activityLoading && this.activityData.length === 0) {
                return `
                    <div class="tab-panel tab-activity">
                        <div class="activity-loading" style="
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            padding: 60px 20px;
                            gap: 16px;
                        ">
                            <i class="fas fa-spinner fa-spin" style="font-size: 48px; color: #3b82f6;"></i>
                            <p style="color: #6b7280; font-size: 16px;">טוען פעילות...</p>
                        </div>
                    </div>
                `;
            }

            // ✅ Use lazy-loaded data
            const activity = this.activityData || [];

            if (activity.length === 0) {
                return this.renderEmptyState('fas fa-history', 'אין פעילות', 'אין רישומי פעילות למשתמש זה');
            }

            // סנן פעולות לא רלוונטיות (צפיות)
            const filteredActivity = activity.filter(log =>
                log.action !== 'VIEW_USER_DETAILS'
            );

            // קטגוריזציה
            const categories = this.categorizeActivity(filteredActivity);

            if (filteredActivity.length === 0) {
                return this.renderEmptyState('fas fa-history', 'אין פעילות משמעותית', 'המשתמש לא ביצע פעולות משמעותיות עדיין');
            }

            return `
                <div class="tab-panel tab-activity">
                    <!-- Activity Stats -->
                    <div class="activity-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px;">
                        ${this.renderActivityStats(categories)}
                    </div>

                    <!-- Activity Timeline -->
                    <div class="activity-timeline">
                        ${filteredActivity.map(log => this.renderActivityLog(log)).join('')}
                    </div>

                    ${filteredActivity.length < activity.length ? `
                        <div style="text-align: center; margin-top: 16px; padding: 12px; background: #f3f4f6; border-radius: 8px; color: #6b7280; font-size: 13px;">
                            <i class="fas fa-info-circle" style="margin-left: 6px;"></i>
                            הוסתרו ${activity.length - filteredActivity.length} צפיות בפרטי משתמש
                        </div>
                    ` : ''}

                    <!-- ✅ Load More Button (Pagination) -->
                    ${this.activityHasMore ? `
                        <button
                            class="btn-load-more-activity"
                            onclick="window.userDetailsModal.loadMoreActivity()"
                            style="
                                margin-top: 20px;
                                padding: 12px 24px;
                                background: white;
                                border: 2px solid #e5e7eb;
                                border-radius: 8px;
                                color: #3b82f6;
                                font-weight: 600;
                                cursor: pointer;
                                width: 100%;
                                transition: all 0.2s;
                                font-size: 14px;
                            "
                            onmouseover="this.style.borderColor='#3b82f6'; this.style.background='#eff6ff';"
                            onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='white';"
                        >
                            <i class="fas fa-chevron-down" style="margin-left: 8px;"></i>
                            טען עוד פעילות
                        </button>
                    ` : ''}
                </div>
            `;
        }

        /* ============================================
           PERFORMANCE TAB SECTION
           טאב ביצועים יומיים
           ============================================ */

        /**
         * Load timesheet entries for a specific month (performance tab only)
         * טעינת רשומות שעתון לחודש ספציפי — רק לטאב ביצועים, לא דורס userData.hours
         *
         * @param {number} year - Year (e.g. 2026)
         * @param {number} month - Month 1-12
         * @returns {Promise<boolean>} true if loaded successfully
         */
        async loadTimesheetForPerformance(year, month) {
            const requestId = ++this.performanceRequestId;
            const db = window.firebaseDB;
            const userEmail = this.userData?.email || this.currentUser?.email;

            if (!userEmail) {
                console.warn('⚠️ Performance: No user email for timesheet load');
                this.performanceHours = [];
                return false;
            }

            const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`;

            console.log(`📊 Performance: Loading timesheet for ${year}-${String(month).padStart(2, '0')} (request #${requestId})`);

            try {
                const snapshot = await db.collection('timesheet_entries')
                    .where('employee', '==', userEmail)
                    .where('date', '>=', startOfMonth)
                    .where('date', '<=', endOfMonth)
                    .orderBy('date', 'desc')
                    .get();

                // Race condition guard: discard if a newer request was made
                if (requestId !== this.performanceRequestId) {
                    console.log(`📊 Performance: Discarding stale response (request #${requestId}, current #${this.performanceRequestId})`);
                    return false;
                }

                this.performanceHours = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        hours: data.hours ?? (data.minutes ? data.minutes / 60 : 0)
                    };
                });

                this.performanceLoadedMonth = month;
                this.performanceLoadedYear = year;

                console.log(`✅ Performance: Loaded ${this.performanceHours.length} entries for ${year}-${String(month).padStart(2, '0')}`);
                return true;

            } catch (error) {
                // Race condition guard
                if (requestId !== this.performanceRequestId) {
                    return false;
                }

                console.error('❌ Performance: Failed to load timesheet:', error);
                this.performanceHours = [];
                this.performanceLoadedMonth = month;
                this.performanceLoadedYear = year;
                return false;
            }
        }

        /**
         * Render Performance Tab
         * Main entry point for daily performance view
         *
         * @returns {string} HTML string for performance tab
         */
        renderPerformanceTab() {
            const user = this.userData || this.currentUser;

            if (!user) {
                return '<div class="no-data-message">אין נתונים זמינים</div>';
            }

            // Store user reference for other methods
            this.user = user;

            // Return empty placeholder - panel opens via switchTab
            return '<div class="performance-tab-placeholder"></div>';
        }

        /**
         * Calculate daily performance metrics
         * חישוב מדדי ביצועים יומיים
         *
         * @param {string} selectedDate - Date in YYYY-MM-DD format
         * @returns {Object} Performance data for the selected date
         */
        calculateDailyPerformance(selectedDate) {
            const date = new Date(selectedDate);
            const dateString = date.toISOString().split('T')[0];

            // Get data from userData
            const user = this.userData || this.currentUser;

            // Determine which hours array to use:
            // If the selected date's month matches initialLoadMonth → use userData.hours (already loaded)
            // Otherwise → use performanceHours (loaded on-demand for that month)
            const selectedMonth = date.getUTCMonth() + 1; // 1-12
            const selectedYear = date.getUTCFullYear();
            const isInitialMonth = selectedMonth === this.initialLoadMonth && selectedYear === this.initialLoadYear;
            const allHours = isInitialMonth ? (user?.hours || []) : (this.performanceHours || []);
            const allTasks = user?.tasks || [];

            console.log('📊 Performance Debug:', {
                selectedDate,
                dateString,
                hoursEntriesCount: allHours.length,
                tasksDataCount: allTasks.length,
                hasUser: !!user
            });

            // Filter hours for selected date
            const dailyHours = allHours.filter(entry => {
                let entryDate = entry.date;

                // Handle Firebase Timestamp
                if (entryDate?.toDate && typeof entryDate.toDate === 'function') {
                    entryDate = entryDate.toDate();
                } else if (entryDate?._seconds !== undefined) {
                    // Handle serialized Firebase Timestamp (with _seconds)
                    entryDate = new Date(entryDate._seconds * 1000);
                }

                // Validate date before calling toISOString
                const dateObj = new Date(entryDate);
                if (isNaN(dateObj.getTime())) {
                    return false; // Skip invalid dates
                }

                const entryDateString = dateObj.toISOString().split('T')[0];
                return entryDateString === dateString;
            });

            // Calculate totals
            const totalHours = dailyHours.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
            const clientHours = dailyHours
                .filter(e => !e.isInternal)
                .reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
            const internalHours = dailyHours
                .filter(e => e.isInternal)
                .reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
            const billableHours = dailyHours
                .filter(e => e.billable)
                .reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);

            // PR-G.2: daily target via centralized helper — see js/shared/work-hours-constants.js
            const _WHC = window.WORK_HOURS_CONSTANTS;
            const dailyTarget = _WHC ? _WHC.getEmployeeDailyTarget(user) : (user.dailyHoursTarget || 8.45);
            const _DEFAULT = _WHC ? _WHC.DEFAULT_DAILY_TARGET : 8.45;
            const quotaProgress = dailyTarget > 0 ? Math.round((totalHours / dailyTarget) * 100) : 0;

            // Debug log to verify target is loaded correctly
            console.log(`📊 Daily Target for ${user.displayName || user.email}: ${dailyTarget} hours`, {
                hasPersonalTarget: !!user.dailyHoursTarget,
                source: user.dailyHoursTarget ? 'employee profile' : `default (${_DEFAULT})`
            });

            // Filter completed tasks for selected date
            const completedToday = allTasks.filter(task => {
                if (task.status !== 'הושלם') {
return false;
}

                const completedDate = task.completedAt || task.updatedAt;
                if (!completedDate) {
return false;
}

                let taskDate = completedDate;

                // Handle Firebase Timestamp
                if (taskDate?.toDate && typeof taskDate.toDate === 'function') {
                    taskDate = taskDate.toDate();
                } else if (taskDate?._seconds !== undefined) {
                    // Handle serialized Firebase Timestamp (with _seconds)
                    taskDate = new Date(taskDate._seconds * 1000);
                }

                // Validate date before calling toISOString
                const dateObj = new Date(taskDate);
                if (isNaN(dateObj.getTime())) {
                    return false; // Skip invalid dates
                }

                const taskDateString = dateObj.toISOString().split('T')[0];
                return taskDateString === dateString;
            });

            // Client breakdown
            const clientBreakdown = {};
            dailyHours
                .filter(e => !e.isInternal)
                .forEach(entry => {
                    const client = entry.clientName || 'לא ידוע';
                    clientBreakdown[client] = (clientBreakdown[client] || 0) + (parseFloat(entry.hours) || 0);
                });

            return {
                date: dateString,
                totalHours: Math.round(totalHours * 10) / 10,
                clientHours: Math.round(clientHours * 10) / 10,
                internalHours: Math.round(internalHours * 10) / 10,
                billableHours: Math.round(billableHours * 10) / 10,
                dailyTarget,
                quotaProgress,
                entriesCount: dailyHours.length,
                completedTasksCount: completedToday.length,
                completedTasks: completedToday,
                entries: dailyHours,
                clientBreakdown
            };
        }

        /**
         * Render date selector with quick buttons
         * רינדור בורר תאריכים עם כפתורים מהירים
         */
        renderDateSelector() {
            const today = new Date().toISOString().split('T')[0];
            const selectedDate = this.selectedPerformanceDate || today;

            return `
                <div class="date-selector-wrapper">
                    <div class="quick-dates">
                        <button class="quick-date-btn" data-offset="0" type="button">היום</button>
                        <button class="quick-date-btn" data-offset="-1" type="button">אתמול</button>
                        <button class="quick-date-btn" data-offset="-7" type="button">לפני שבוע</button>
                    </div>

                    <div class="date-picker-container">
                        <label for="performanceDate">
                            <i class="fas fa-calendar-alt"></i>
                            בחר תאריך:
                        </label>
                        <input
                            type="date"
                            id="performanceDate"
                            value="${selectedDate}"
                            max="${today}"
                        >
                    </div>

                    <button class="btn-print-report" id="printPerformanceReport" type="button">
                        <i class="fas fa-print"></i>
                        הדפס דוח
                    </button>
                </div>
            `;
        }

        /**
         * Render daily summary cards
         * רינדור כרטיסי סיכום יומי
         */
        renderDailySummary() {
            const selectedDate = this.selectedPerformanceDate || new Date().toISOString().split('T')[0];
            const data = this.calculateDailyPerformance(selectedDate);

            const formattedDate = new Date(selectedDate).toLocaleDateString('he-IL', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            return `
                <div class="daily-summary-cards">
                    <h3>סיכום ל-${formattedDate}</h3>

                    <div class="summary-grid">
                        <!-- Main Card - Total Hours -->
                        <div class="summary-card main-card">
                            <div class="card-content">
                                <div class="card-label">שעות עבודה</div>
                                <div class="card-value">${data.totalHours} / ${data.dailyTarget}</div>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${Math.min(data.quotaProgress, 100)}%;"></div>
                                </div>
                                <div class="card-subtitle">${data.quotaProgress}% מהתקן היומי</div>
                            </div>
                        </div>

                        <!-- Tasks Card -->
                        <div class="summary-card">
                            <div class="card-content">
                                <div class="card-label">משימות הושלמו</div>
                                <div class="card-value">${data.completedTasksCount}</div>
                            </div>
                        </div>

                        <!-- Client Hours Card -->
                        <div class="summary-card">
                            <div class="card-content">
                                <div class="card-label">שעות לקוח</div>
                                <div class="card-value">${data.clientHours}</div>
                            </div>
                        </div>

                        <!-- Internal Hours Card -->
                        <div class="summary-card">
                            <div class="card-content">
                                <div class="card-label">שעות פנימי</div>
                                <div class="card-value">${data.internalHours}</div>
                            </div>
                        </div>

                        <!-- Billable Hours Card -->
                        <div class="summary-card">
                            <div class="card-content">
                                <div class="card-label">שעות חייבות</div>
                                <div class="card-value">${data.billableHours}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Render performance charts - Now using horizontal bar breakdown instead of pie chart
         * רינדור גרפים - כעת משתמש בפילוח אופקי במקום עוגה
         */
        renderPerformanceCharts() {
            const selectedDate = this.selectedPerformanceDate || new Date().toISOString().split('T')[0];
            const data = this.calculateDailyPerformance(selectedDate);

            if (data.totalHours === 0) {
                return '<div class="no-data-message">אין נתוני שעות ליום זה</div>';
            }

            // Don't show chart if no client hours
            const clientBreakdown = data.clientBreakdown;
            const clientCount = Object.keys(clientBreakdown).length;
            if (clientCount === 0) {
                return '';
            }

            // Sort clients by hours (descending)
            const sortedClients = Object.entries(clientBreakdown)
                .sort((a, b) => b[1] - a[1]);

            // Calculate total for percentages
            const totalClientHours = sortedClients.reduce((sum, [_, hours]) => sum + hours, 0);

            // Generate color palette
            const colors = [
                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#a855f7'
            ];

            return `
                <div class="charts-section">
                    <h4>פילוח שעות לפי לקוחות (${clientCount} ${clientCount === 1 ? 'לקוח' : 'לקוחות'})</h4>
                    <div class="client-breakdown-bars">
                        ${sortedClients.map(([clientName, hours], index) => {
                            const percentage = Math.round((hours / totalClientHours) * 100);
                            const color = colors[index % colors.length];
                            return `
                                <div class="breakdown-bar-item">
                                    <div class="breakdown-bar-header">
                                        <span class="breakdown-client-name">${this.escapeHtml(clientName)}</span>
                                        <span class="breakdown-hours">${hours} שעות (${percentage}%)</span>
                                    </div>
                                    <div class="breakdown-bar-track">
                                        <div class="breakdown-bar-fill" style="width: ${percentage}%; background-color: ${color};"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        /**
         * Render daily hours breakdown
         * רינדור פירוט שעות יומי
         */
        renderDailyHoursBreakdown() {
            const selectedDate = this.selectedPerformanceDate || new Date().toISOString().split('T')[0];
            const data = this.calculateDailyPerformance(selectedDate);

            if (data.entries.length === 0) {
                return '';
            }

            // Sort by created time
            const sortedEntries = [...data.entries].sort((a, b) => {
                const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                return timeA - timeB;
            });

            return `
                <div class="hours-breakdown-section">
                    <h4>פירוט רשומות שעתון (${data.entries.length})</h4>
                    <div class="breakdown-list">
                        ${sortedEntries.map(entry => this.renderHoursEntryRow(entry)).join('')}
                    </div>
                </div>
            `;
        }

        /**
         * Render single hours entry row
         * רינדור שורת רשומה בודדת
         */
        renderHoursEntryRow(entry) {
            let createdTime = '-';
            if (entry.createdAt) {
                let createdDate = entry.createdAt;
                if (createdDate?.toDate && typeof createdDate.toDate === 'function') {
                    createdDate = createdDate.toDate();
                }
                const date = new Date(createdDate);
                if (!isNaN(date.getTime())) {
                    createdTime = date.toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            }

            const isClient = !entry.isInternal;
            const typeLabel = isClient ? 'לקוח' : 'פנימי';
            const description = entry.taskDescription || entry.action || '-';

            return `
                <div class="hours-entry-row">
                    <div class="entry-time">${createdTime}</div>
                    <div class="entry-icon">${typeLabel}</div>
                    <div class="entry-details">
                        <div class="entry-client">${this.escapeHtml(entry.clientName || 'פעילות פנימית')}</div>
                        <div class="entry-description">${this.escapeHtml(description)}</div>
                    </div>
                    <div class="entry-hours">${entry.hours}</div>
                </div>
            `;
        }

        /**
         * Render completed tasks section
         * רינדור משימות שהושלמו
         */
        renderCompletedTasks() {
            const selectedDate = this.selectedPerformanceDate || new Date().toISOString().split('T')[0];
            const data = this.calculateDailyPerformance(selectedDate);

            if (data.completedTasks.length === 0) {
                return '';
            }

            return `
                <div class="completed-tasks-section">
                    <h4>משימות שהושלמו (${data.completedTasks.length})</h4>
                    <div class="completed-tasks-list">
                        ${data.completedTasks.map(task => `
                            <div class="completed-task-item">
                                <i class="fas fa-check-circle"></i>
                                <div class="task-info">
                                    <div class="task-title">${this.escapeHtml(task.title || task.description || 'ללא תיאור')}</div>
                                    <div class="task-meta">
                                        ${task.clientName ? `<span>לקוח: ${this.escapeHtml(task.clientName)}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        /**
         * Attach event listeners for performance tab
         * הוספת event listeners לטאב ביצועים
         */
        attachPerformanceEventListeners() {
            // Check if we're in a panel or modal
            const panel = document.getElementById('performancePanelContent');
            const modal = window.ModalManager.getElement(this.modalId);
            const container = panel || modal;

            if (!container) {
                console.warn('⚠️ Performance: Container not found');
                return;
            }

            console.log('🔧 Attaching performance event listeners...', panel ? '(in panel)' : '(in modal)');

            // Date picker change
            const performanceDatePicker = container.querySelector('#performanceDate');
            if (performanceDatePicker) {
                console.log('✅ Date picker found, attaching listener');
                performanceDatePicker.addEventListener('change', (e) => {
                    console.log('📅 Date picker changed:', e.target.value);
                    this.selectedPerformanceDate = e.target.value;
                    this.refreshPerformanceTab();
                });
            } else {
                console.warn('⚠️ Date picker not found');
            }

            // Quick date buttons
            const quickDateButtons = container.querySelectorAll('.quick-date-btn');
            console.log(`🔘 Found ${quickDateButtons.length} quick date buttons`);
            quickDateButtons.forEach((btn, index) => {
                console.log(`   Attaching to button ${index}: offset=${btn.getAttribute('data-offset')}`);
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('🖱️ Quick date button clicked!', {
                        offset: btn.getAttribute('data-offset'),
                        buttonText: btn.textContent
                    });
                    const offset = parseInt(btn.getAttribute('data-offset'));
                    const date = new Date();
                    date.setDate(date.getDate() + offset);
                    this.selectedPerformanceDate = date.toISOString().split('T')[0];
                    console.log('📅 New selected date:', this.selectedPerformanceDate);
                    this.refreshPerformanceTab();
                });
            });

            // Print report button
            const printBtn = container.querySelector('#printPerformanceReport');
            if (printBtn) {
                printBtn.addEventListener('click', () => {
                    window.print();
                });
            }

            console.log('✅ Performance event listeners attached');
        }

        /**
         * Refresh performance tab content
         * רענון תוכן טאב ביצועים
         */
        async refreshPerformanceTab() {
            // Check if we're in a panel or modal
            const panelContent = document.getElementById('performancePanelContent');
            const panel = document.getElementById('performanceSlideInPanel');

            // Determine if we need to load data for a different month
            const selectedDate = new Date(this.selectedPerformanceDate);
            const targetMonth = selectedDate.getUTCMonth() + 1; // 1-12
            const targetYear = selectedDate.getUTCFullYear();
            const isInitialMonth = targetMonth === this.initialLoadMonth && targetYear === this.initialLoadYear;
            const isAlreadyLoaded = targetMonth === this.performanceLoadedMonth && targetYear === this.performanceLoadedYear;

            // Need to load if: not the initial month AND not already loaded for this month
            if (!isInitialMonth && !isAlreadyLoaded) {
                // Show loading indicator in panel
                const performanceContainer = panelContent?.querySelector('.performance-container');
                if (performanceContainer) {
                    performanceContainer.innerHTML = `
                        ${this.renderDateSelector()}
                        <div class="performance-loading" style="text-align:center; padding:40px; color:#64748b;">
                            <i class="fas fa-spinner fa-spin" style="font-size:24px; margin-bottom:12px;"></i>
                            <p>טוען נתוני שעתון...</p>
                        </div>
                    `;
                    this.attachPerformanceEventListeners();
                }

                const loadSuccess = await this.loadTimesheetForPerformance(targetYear, targetMonth);

                // After load — check if panel is still open (user may have closed it)
                const stillOpen = document.getElementById('performancePanelContent');
                if (!stillOpen) {
                    return;
                }

                // If load failed and returned false due to race condition, don't render (newer request will)
                if (!loadSuccess && this.performanceRequestId > 0 &&
                    (targetMonth !== this.performanceLoadedMonth || targetYear !== this.performanceLoadedYear)) {
                    return;
                }

                // If load failed (error, not race condition) — show error message
                if (!loadSuccess) {
                    const container = stillOpen.querySelector('.performance-container');
                    if (container) {
                        container.innerHTML = `
                            ${this.renderDateSelector()}
                            <div class="performance-error" style="text-align:center; padding:40px; color:#ef4444;">
                                <i class="fas fa-exclamation-triangle" style="font-size:24px; margin-bottom:12px;"></i>
                                <p>לא ניתן לטעון נתוני שעתון לחודש זה</p>
                            </div>
                        `;
                        this.attachPerformanceEventListeners();
                    }
                    return;
                }
            }

            if (panelContent && panel) {
                // Update panel content
                const performanceContainer = panelContent.querySelector('.performance-container');
                if (performanceContainer) {
                    performanceContainer.innerHTML = `
                        ${this.renderDateSelector()}
                        ${this.renderDailySummary()}
                        ${this.renderPerformanceCharts()}
                        ${this.renderDailyHoursBreakdown()}
                        ${this.renderCompletedTasks()}
                    `;
                }

                // Update panel header with new date
                const panelHeader = panel.querySelector('.tasks-panel-header h3');
                if (panelHeader) {
                    panelHeader.textContent = `ביצועים יומיים - ${this.formatHebrewDate(this.selectedPerformanceDate)}`;
                }

                // Re-attach event listeners
                this.attachPerformanceEventListeners();
            } else {
                // Update modal content
                const modal = window.ModalManager.getElement(this.modalId);
                if (!modal) {
                    return;
                }

                const contentContainer = modal.querySelector('.user-details-content');
                if (!contentContainer) {
                    return;
                }

                // Re-render content
                contentContainer.innerHTML = this.renderPerformanceTab();

                // Re-attach event listeners
                this.attachPerformanceEventListeners();
            }
        }

        /**
         * Initialize performance visualization (no longer uses Chart.js)
         * אתחול תצוגת ביצועים (לא משתמש יותר ב-Chart.js)
         *
         * Note: This function is kept for backward compatibility but does nothing
         * since we now use CSS-based horizontal bars instead of Chart.js pie charts.
         */
        initializePerformanceChart() {
            // No-op: We now render breakdown bars directly in HTML/CSS
            // instead of using Chart.js canvas
            console.log('✅ Performance tab uses CSS-based bars (no Chart.js needed)');
        }


        /**
         * Categorize activity logs
         * קטגוריזציה של פעילויות
         */
        categorizeActivity(activity) {
            return {
                tasks: activity.filter(log =>
                    ['CREATE_TASK', 'UPDATE_TASK', 'COMPLETE_TASK', 'DELETE_TASK',
                     'EXTEND_TASK_DEADLINE', 'TASK_UPDATED_BY_ADMIN'].includes(log.action)
                ).length,
                clients: activity.filter(log =>
                    ['CREATE_CLIENT', 'UPDATE_CLIENT', 'DELETE_CLIENT',
                     'ADD_SERVICE_TO_CLIENT', 'REMOVE_SERVICE_FROM_CLIENT'].includes(log.action)
                ).length,
                hours: activity.filter(log =>
                    ['CREATE_TIMESHEET_ENTRY', 'UPDATE_TIMESHEET_ENTRY',
                     'DELETE_TIMESHEET_ENTRY'].includes(log.action)
                ).length,
                system: activity.filter(log =>
                    ['LOGIN', 'LOGOUT', 'UPDATE_USER', 'CREATE_USER',
                     'DELETE_USER', 'BLOCK_USER', 'UNBLOCK_USER'].includes(log.action)
                ).length
            };
        }

        /**
         * Render activity stats
         * רינדור סטטיסטיקות פעילות
         */
        renderActivityStats(categories) {
            const stats = [
                { label: 'משימות', count: categories.tasks, icon: 'fa-tasks' },
                { label: 'לקוחות', count: categories.clients, icon: 'fa-users' },
                { label: 'שעות', count: categories.hours, icon: 'fa-clock' },
                { label: 'מערכת', count: categories.system, icon: 'fa-cog' }
            ];

            const primaryColor = '#1877f2'; // Facebook blue

            return stats.filter(s => s.count > 0).map(stat => `
                <div style="background: white; padding: 12px; border-radius: 8px; border-right: 3px solid ${primaryColor}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <i class="fas ${stat.icon}" style="color: ${primaryColor}; font-size: 14px;"></i>
                        <span style="font-size: 12px; color: #6b7280; font-weight: 600;">${stat.label}</span>
                    </div>
                    <div style="font-size: 24px; font-weight: 700; color: #1f2937;">${stat.count}</div>
                </div>
            `).join('');
        }

        /**
         * Helper render methods
         * פונקציות עזר לרינדור
         */

        renderUserAvatar(user) {
            if (user.photoURL) {
                return `<img src="${user.photoURL}" alt="${user.displayName}" class="user-avatar-large">`;
            }

            const initials = this.getInitials(user.displayName || user.username);
            const colorClass = this.getAvatarColor(user.email);

            return `
                <div class="user-avatar-large avatar-initials ${colorClass}">
                    ${initials}
                </div>
            `;
        }

        renderStatusBadge(status) {
            const statusMap = {
                'active': { text: 'פעיל', class: 'badge-success' },
                'blocked': { text: 'חסום', class: 'badge-danger' }
            };

            const statusData = statusMap[status] || { text: status, class: 'badge-default' };

            return `<span class="badge ${statusData.class}">${statusData.text}</span>`;
        }

        renderInfoRow(label, value) {
            return `
                <div class="info-row">
                    <span class="info-label">${label}:</span>
                    <span class="info-value">${value || '-'}</span>
                </div>
            `;
        }

        renderStatCard(icon, value, label) {
            return `
                <div class="stat-card-small">
                    <i class="${icon}"></i>
                    <div class="stat-info">
                        <span class="stat-value">${value}</span>
                        <span class="stat-label">${label}</span>
                    </div>
                </div>
            `;
        }

        renderYearOptions() {
            const currentYear = new Date().getFullYear();
            const startYear = 2020; // Start from 2020
            const years = [];

            for (let year = currentYear; year >= startYear; year--) {
                const selected = year === this.selectedYear ? 'selected' : '';
                years.push(`<option value="${year}" ${selected}>${year}</option>`);
            }

            return years.join('');
        }

        renderEmptyState(icon, title, message) {
            return `
                <div class="empty-state-tab">
                    <i class="${icon} empty-icon"></i>
                    <h3>${title}</h3>
                    <p>${message}</p>
                </div>
            `;
        }

        renderClientCard(client) {
            return `
                <div class="client-card">
                    <h4>${this.escapeHtml(client.name)}</h4>
                    <p class="client-id">תיק: ${client.fileNumber || 'N/A'}</p>
                </div>
            `;
        }

        /**
         * ════════════════════════════════════════════════════════════════════
         * RENDER TASK CARD - Minimalist Style (Color Only in Progress Bar)
         * ════════════════════════════════════════════════════════════════════
         *
         * 🔧 CHANGES MADE (2025-01-17 - FINAL VERSION):
         * - Removed ALL colors from icons and text (gray/black only)
         * - Removed border-right accent (was unnecessary)
         * - Added rounded status badge for quick visual identification
         * - Restored edit and delete buttons for admin actions
         * - Color appears ONLY in the progress bar
         *
         * 🎯 WHY THESE CHANGES:
         * - User feedback: "Too many colors" - distracted from content
         * - Professional minimalist design - easier to scan
         * - Status badge provides instant context without visual noise
         * - Admin needs edit/delete functionality restored
         *
         * 📊 IMPACT:
         * - Cleaner, more professional appearance
         * - Better focus on task information
         * - Improved usability with action buttons
         * - Reduced cognitive load from color overuse
         * ════════════════════════════════════════════════════════════════════
         */
        renderTaskCard(task) {
            // חישוב progress
            const progress = task.estimatedHours > 0
                ? Math.round((task.actualHours / task.estimatedHours) * 100)
                : 0;

            // מיפוי סטטוס לאנגלית (לתמיכה בעברית ואנגלית)
            const statusMapping = {
                'active': 'active',
                'פעיל': 'active',
                'פעילה': 'active',
                'completed': 'completed',
                'הושלם': 'completed',
                'הושלמה': 'completed',
                'pending': 'pending',
                'ממתין': 'pending',
                'ממתינה': 'pending',
                'cancelled': 'cancelled',
                'בוטל': 'cancelled',
                'בוטלה': 'cancelled'
            };
            const statusClass = statusMapping[task.status] || 'active';

            // קביעת סטטוס ותג - ללא צבעי אייקון!
            const statusInfo = {
                'active': { label: 'פעילה', badgeColor: '#3b82f6' },
                'completed': { label: 'הושלמה', badgeColor: '#10b981' },
                'pending': { label: 'ממתינה', badgeColor: '#f59e0b' },
                'cancelled': { label: 'בוטלה', badgeColor: '#ef4444' }
            };
            const status = statusInfo[statusClass] || statusInfo['active'];

            // פורמט תאריך יעד (compact)
            // תמיכה ב-Firestore Timestamp, JavaScript Date, String, ו-Number
            let deadlineText = null; // null = לא להציג כלל
            let deadlineDate = null;
            let diffDays = null;
            if (task.deadline) {
                try {
                    // בדיקה אם זה Firestore Timestamp עם מתודת toDate()
                    if (task.deadline.toDate && typeof task.deadline.toDate === 'function') {
                        deadlineDate = task.deadline.toDate();
                    } else if (task.deadline._seconds) {
                        // בדיקה אם זה אובייקט Timestamp עם _seconds (לאחר JSON serialization)
                        deadlineDate = new Date(task.deadline._seconds * 1000);
                    } else {
                        // אחרת, נסה המרה רגילה (String, Number, או Date)
                        deadlineDate = new Date(task.deadline);
                    }

                    if (!isNaN(deadlineDate.getTime())) {
                        deadlineText = deadlineDate.toLocaleDateString('he-IL', {
                            day: 'numeric',
                            month: 'short'
                        });
                    } else {
                        // תאריך לא תקין - לא נציג כלל
                        deadlineText = null;
                        console.warn('⚠️ UserDetailsModal: Invalid task deadline - hiding date row');
                    }
                } catch (e) {
                    console.warn('Invalid deadline:', task.deadline, e);
                    deadlineText = null; // לא נציג
                }
            }

            // חישוב זמן נותר — רק למשימות פעילות עם deadline תקין
            let timeRemainingText = null;
            if (deadlineText && task.status !== 'הושלם' && task.status !== 'completed' && task.status !== 'בוטל' && task.status !== 'cancelled') {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const deadlineMidnight = new Date(deadlineDate);
                deadlineMidnight.setHours(0, 0, 0, 0);
                diffDays = Math.ceil((deadlineMidnight - now) / (1000 * 60 * 60 * 24));

                if (diffDays > 0) {
                    timeRemainingText = `נותרו ${diffDays} ימים`;
                } else if (diffDays === 0) {
                    timeRemainingText = 'היום אחרון!';
                } else {
                    timeRemainingText = `באיחור ${Math.abs(diffDays)} ימים`;
                }
            }

            // סטטוס progress - בחירת צבע (רק לבר התקדמות!)
            const progressColor = progress > 100 ? '#ef4444' : progress >= 80 ? '#f59e0b' : '#10b981';

            return `
                <div class="task-card ${statusClass}-task" data-task-id="${task.id}">
                    <!-- Header: כותרת ותג סטטוס -->
                    <div class="task-header">
                        <h4 class="task-title">${this.escapeHtml(task.description || task.serviceName || 'ללא כותרת')}</h4>
                        <span class="task-status-badge ${statusClass}-badge" style="background-color: ${status.badgeColor};">${status.label}</span>
                    </div>

                    <!-- Body: פרטי משימה -->
                    <div class="task-body">
                        <!-- מידע על לקוח - אייקון אפור -->
                        <div class="task-info-row">
                            <i class="fas fa-briefcase"></i>
                            <span>${this.escapeHtml(task.clientName)}</span>
                        </div>

                        <!-- תאריך יעד - אייקון אפור (רק אם תקין) -->
                        ${deadlineText ? `
                        <div class="task-info-row">
                            <i class="fas fa-calendar-alt"></i>
                            <span>יעד: ${deadlineText}</span>
                            ${timeRemainingText ? `<span class="task-time-remaining ${diffDays < 0 ? 'overdue' : diffDays <= 3 ? 'urgent' : ''}">${timeRemainingText}</span>` : ''}
                        </div>
                        ` : ''}

                        <!-- תאריך השלמה (רק למשימות שהושלמו) -->
                        ${task.completedAt ? (() => {
                            let completedDate;
                            if (task.completedAt.toDate && typeof task.completedAt.toDate === 'function') {
                                completedDate = task.completedAt.toDate();
                            } else if (task.completedAt._seconds) {
                                completedDate = new Date(task.completedAt._seconds * 1000);
                            } else {
                                completedDate = new Date(task.completedAt);
                            }
                            const completedText = !isNaN(completedDate.getTime())
                                ? completedDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
                                : null;
                            return completedText ? `
                        <div class="task-info-row">
                            <i class="fas fa-check-circle"></i>
                            <span>הושלם: ${completedText}</span>
                        </div>` : '';
                        })() : ''}

                        <!-- תקציב - אייקון אפור -->
                        ${task.estimatedHours > 0 ? `
                        <div class="task-info-row">
                            <i class="fas fa-chart-line"></i>
                            <span>תקציב: ${(task.estimatedHours || 0).toFixed(1)} ש' | בוצע: ${(task.actualHours || 0).toFixed(1)} ש'</span>
                        </div>
                        ` : ''}

                        <!-- Progress bar - הצבע היחיד בכרטיס! -->
                        <div class="task-progress-row">
                            <div class="task-progress-bar">
                                <div class="task-progress-fill" style="width: ${Math.min(progress, 100)}%; background-color: ${progressColor};"></div>
                            </div>
                            <span class="task-progress-text">${progress}%</span>
                        </div>
                    </div>

                    <!-- Footer: כפתורי פעולה -->
                    <div class="task-actions">
                        <button class="btn-icon btn-edit-task" title="ערוך משימה" data-task-id="${task.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete-task" title="מחק משימה" data-task-id="${task.id}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        renderHoursCard(entry) {
            // זיהוי סוג הפעילות - בדיקה אם זה פעילות פנימית
            const isClientWork = !entry.isInternal;
            const iconClass = isClientWork ? 'fas fa-briefcase' : 'fas fa-building';
            const borderColor = isClientWork ? '#3b82f6' : '#94a3b8';
            const iconColor = isClientWork ? '#3b82f6' : '#64748b';

            // תאריך - טיפול ב-Firebase Timestamp
            let dateValue = entry.date;
            if (dateValue && dateValue.toDate && typeof dateValue.toDate === 'function') {
                dateValue = dateValue.toDate();
            }
            const date = new Date(dateValue);
            const formattedDate = !isNaN(date.getTime())
                ? date.toLocaleDateString('he-IL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                })
                : '-';

            // לקוח או פעילות פנימית
            const clientName = entry.clientName || 'פעילות פנימית';

            // משימה או תיאור פעולה (Fallback: אם אין משימה, הצג action)
            let taskDesc = entry.taskDescription || entry.action || '';
            if (taskDesc.length > 50) {
                taskDesc = taskDesc.substring(0, 50) + '...';
            }

            return `
                <div class="hours-card ${isClientWork ? 'client-work' : 'internal-work'}" data-entry-id="${entry.id}">

                    <!-- שורה 1: תאריך, שעות, חיוב, פעולות -->
                    <div class="hours-card-row-1">
                        <!-- תאריך -->
                        <div class="hours-date">
                            <i class="fas fa-calendar"></i>
                            <span>${formattedDate}</span>
                        </div>

                        <!-- שעות -->
                        <div class="hours-amount ${isClientWork ? 'client-work' : ''}">
                            <i class="fas fa-clock"></i>
                            <span class="hours-amount-value">${(entry.hours || 0).toFixed(2)}</span>
                            <span class="hours-amount-unit">ש'</span>
                        </div>

                        <!-- ספייסר -->
                        <div></div>

                        <!-- חיוב -->
                        ${entry.billable !== undefined ? `
                        <span class="hours-billable-badge ${entry.billable ? 'billable' : 'not-billable'}">
                            <i class="fas fa-${entry.billable ? 'check' : 'times'}-circle"></i>
                            ${entry.billable ? 'חויב' : 'לא חויב'}
                        </span>
                        ` : '<div></div>'}

                        <!-- פעולות -->
                        <div class="hours-actions">
                            <button class="btn-icon btn-edit-hour" data-entry-id="${entry.id}" title="ערוך">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon btn-delete-hour" data-entry-id="${entry.id}" title="מחק">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>

                    <!-- שורה 2: לקוח -->
                    <div class="hours-client-row ${isClientWork ? 'client-work' : ''}" style="margin-bottom: ${taskDesc || entry.notes ? '12px' : '0'};">
                        <span class="hours-client-label">לקוח:</span>
                        <div class="hours-client-name ${isClientWork ? 'client-work' : ''}">
                            <i class="${iconClass}"></i>
                            <span title="${this.escapeHtml(clientName)}">${this.escapeHtml(clientName)}</span>
                        </div>
                    </div>

                    <!-- שורה 3: משימה + הערות -->
                    ${taskDesc || entry.notes ? `
                    <div style="display: grid; grid-template-columns: ${taskDesc && entry.notes ? '1fr 1fr' : '1fr'}; gap: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                        ${taskDesc ? `
                        <div style="display: flex; align-items: start; gap: 8px;">
                            <i class="fas fa-tasks" style="color: #9ca3af; font-size: 12px; margin-top: 3px;"></i>
                            <div>
                                <div style="font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; margin-bottom: 3px;">משימה</div>
                                <span style="color: #4b5563; font-size: 13px; line-height: 1.5;" title="${this.escapeHtml(entry.taskDescription || entry.action || '')}">${this.escapeHtml(taskDesc)}</span>
                            </div>
                        </div>
                        ` : ''}
                        ${entry.notes ? `
                        <div style="display: flex; align-items: start; gap: 8px;">
                            <i class="fas fa-sticky-note" style="color: #9ca3af; font-size: 12px; margin-top: 3px;"></i>
                            <div>
                                <div style="font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; margin-bottom: 3px;">הערה</div>
                                <span style="color: #4b5563; font-size: 13px; line-height: 1.5; font-style: italic;" title="${this.escapeHtml(entry.notes)}">${this.escapeHtml(entry.notes.length > 60 ? entry.notes.substring(0, 60) + '...' : entry.notes)}</span>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>
            `;
        }

        /**
         * Render Hours Table View
         * תצוגת טבלה מפורטת של שעות
         */
        renderHoursTable(hours) {
            if (hours.length === 0) {
                return '<p class="no-results">אין רשומות שעות המתאימות לפילטרים</p>';
            }

            return `
                <div class="hours-table-container">
                    <table class="hours-table">
                        <thead>
                            <tr>
                                <th>תאריך</th>
                                <th>יום</th>
                                <th>שעה</th>
                                <th>לקוח</th>
                                <th>משימה</th>
                                <th>שעות</th>
                                <th>חיוב</th>
                                <th>הערות</th>
                                <th>נרשם ע"י</th>
                                <th>מתי</th>
                                <th>פעולות</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${hours.map(entry => this.renderHoursTableRow(entry)).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        /**
         * Render single hours table row
         * רינדור שורת טבלה בודדת
         */
        renderHoursTableRow(entry) {
            // פורמט תאריך - טיפול ב-Firebase Timestamp
            let dateValue = entry.date;
            if (dateValue && dateValue.toDate && typeof dateValue.toDate === 'function') {
                dateValue = dateValue.toDate(); // Firebase Timestamp
            }
            const date = new Date(dateValue);
            const formattedDate = !isNaN(date.getTime())
                ? date.toLocaleDateString('he-IL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                })
                : '-';

            // יום בשבוע
            const dayOfWeek = entry.dayOfWeek || (!isNaN(date.getTime())
                ? date.toLocaleDateString('he-IL', { weekday: 'short' })
                : '-');

            // שעה שנרשם - טיפול ב-Firebase Timestamp
            let createdAtValue = entry.createdAt;
            if (createdAtValue && createdAtValue.toDate && typeof createdAtValue.toDate === 'function') {
                createdAtValue = createdAtValue.toDate();
            }
            const createdTime = createdAtValue
                ? (() => {
                    const createdDate = new Date(createdAtValue);
                    return !isNaN(createdDate.getTime())
                        ? createdDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                        : '-';
                })()
                : '-';

            // סוג - לקוח או פנימי - בדיקה אם זה פעילות פנימית
            const isClientWork = !entry.isInternal;
            const rowClass = isClientWork ? 'row-client' : 'row-internal';

            // חיוב
            const billableText = entry.billable ? 'כן' : 'לא';
            const billableClass = entry.billable ? 'billable-yes' : 'billable-no';

            // לקוח
            const clientName = entry.clientName || 'פעילות פנימית';

            // משימה או תיאור פעולה (Fallback: אם אין משימה, הצג action)
            const taskDesc = entry.taskDescription || entry.action || '-';

            // הערות (קטן עד 50 תווים)
            const notes = entry.notes
                ? (entry.notes.length > 50 ? entry.notes.substring(0, 50) + '...' : entry.notes)
                : '-';

            // מי רשם - הצגת שם מלא (מגיע מה-backend)
            const createdBy = entry.createdByName || entry.createdBy || entry.employee || 'לא ידוע';

            // מתי נרשם (תאריך + שעה)
            const createdAtFull = entry.createdAt
                ? new Date(entry.createdAt).toLocaleString('he-IL', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })
                : '-';

            return `
                <tr class="hours-table-row ${rowClass}" data-entry-id="${entry.id}">
                    <td class="td-date">${formattedDate}</td>
                    <td class="td-day">${dayOfWeek}</td>
                    <td class="td-time">${createdTime}</td>
                    <td class="td-client">
                        ${isClientWork
                            ? `<span class="client-badge"><i class="fas fa-briefcase"></i> ${this.escapeHtml(clientName)}</span>`
                            : `<span class="internal-badge"><i class="fas fa-building"></i> ${clientName}</span>`
                        }
                    </td>
                    <td class="td-task" title="${this.escapeHtml(taskDesc)}">${this.escapeHtml(taskDesc)}</td>
                    <td class="td-hours"><strong>${(entry.hours || 0).toFixed(2)}</strong> ש'</td>
                    <td class="td-billable">
                        <span class="billable-badge ${billableClass}">
                            <i class="fas fa-${entry.billable ? 'check' : 'times'}-circle"></i>
                            ${billableText}
                        </span>
                    </td>
                    <td class="td-notes" title="${this.escapeHtml(entry.notes || '')}">${this.escapeHtml(notes)}</td>
                    <td class="td-created-by">${this.escapeHtml(createdBy)}</td>
                    <td class="td-created-at">${createdAtFull}</td>
                    <td class="td-actions">
                        <button class="btn-table-action btn-edit-hour" data-entry-id="${entry.id}" title="ערוך">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-table-action btn-delete-hour" data-entry-id="${entry.id}" title="מחק">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }

        /**
         * Render Hours Cards View
         * תצוגת כרטיסים (עדכון של הקיים)
         */
        renderHoursCards(hours) {
            if (hours.length === 0) {
                return '<p class="no-results">אין רשומות שעות המתאימות לפילטרים</p>';
            }

            // Show first 3 hours entries
            const displayedHours = hours.slice(0, 3);
            const hasMoreHours = hours.length > 3;

            return `
                <div class="hours-list">
                    ${displayedHours.map(entry => this.renderHoursCard(entry)).join('')}
                </div>
                ${hasMoreHours ? `
                    <button class="show-all-hours-btn" data-action="show-all-hours">
                        <i class="fas fa-clock"></i>
                        <span>הצג את כל רשומות השעות (${hours.length})</span>
                    </button>
                ` : ''}
            `;
        }

        renderActivityLog(log) {
            // Format action to Hebrew
            const actionText = this.formatActivityAction(log.action);

            // Format details if exist
            let detailsText = '';
            if (log.details) {
                try {
                    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                    const formattedDetails = this.formatActivityDetails(details);

                    if (formattedDetails.length > 0) {
                        detailsText = `<div class="activity-details">${formattedDetails.join(' • ')}</div>`;
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }
            }

            return `
                <div class="activity-log">
                    <div class="activity-icon">
                        <i class="${this.getActivityIcon(log.action)}"></i>
                    </div>
                    <div class="activity-content">
                        <p class="activity-text">${actionText}</p>
                        ${detailsText}
                        <span class="activity-time">${this.formatDate(log.timestamp)}</span>
                    </div>
                </div>
            `;
        }

        /**
         * Format activity details to Hebrew
         * המרת פרטי פעילות לעברית קריאה
         */
        formatActivityDetails(details) {
            const detailsArray = [];
            const seenLabels = new Set(); // למניעת כפילויות

            // תרגום שמות שדות לעברית
            const fieldLabels = {
                'clientId': 'תיק',
                'caseNumber': 'תיק',
                'clientName': 'לקוח',
                'taskId': 'משימה',
                'targetEmail': 'משתמש',
                'actualMinutes': 'זמן בפועל',
                'estimatedHours': 'זמן משוער',
                'gapPercent': 'פער',
                'oldDeadline': 'מועד קודם',
                'newDeadline': 'מועד חדש',
                'procedureType': 'סוג הליך',
                'serviceId': 'שירות',
                'oldData': 'נתונים קודמים',
                'newData': 'נתונים חדשים',
                'hours': 'שעות',
                'billable': 'חייב',
                'description': 'תיאור',
                'taskDescription': 'תיאור המשימה',
                'deadline': 'מועד יעד'
            };

            // שדות שרוצים לדלג עליהם
            const skipFields = ['oldData', 'newData', 'taskId'];

            // תרגום ערכים מיוחדים
            const valueTransformers = {
                'legal_procedure': 'הליך משפטי',
                'true': 'כן',
                'false': 'לא'
            };

            // סדר עדיפות להצגת שדות
            const priorityOrder = [
                'clientName', 'caseNumber', 'clientId',
                'taskDescription', 'estimatedHours',
                'actualMinutes', 'gapPercent',
                'newDeadline', 'procedureType'
            ];

            // מיין לפי סדר עדיפות
            const sortedEntries = Object.entries(details).sort((a, b) => {
                const indexA = priorityOrder.indexOf(a[0]);
                const indexB = priorityOrder.indexOf(b[0]);
                if (indexA === -1 && indexB === -1) {
return 0;
}
                if (indexA === -1) {
return 1;
}
                if (indexB === -1) {
return -1;
}
                return indexA - indexB;
            });

            sortedEntries.forEach(([key, value]) => {
                // דלג על שדות מסוימים
                if (skipFields.includes(key)) {
                    return;
                }

                // דלג על null/undefined
                if (value === null || value === undefined) {
                    return;
                }

                // טפל ב-[object Object]
                if (typeof value === 'object') {
                    // אם זה Firestore Timestamp
                    if (value.toDate && typeof value.toDate === 'function') {
                        value = this.formatDate(value);
                    } else if (value.seconds) {
                        // Timestamp serialized
                        value = this.formatDate(new Date(value.seconds * 1000));
                    } else {
                        // אובייקט אחר - דלג עליו
                        return;
                    }
                }

                // המר שם שדה לעברית
                const label = fieldLabels[key] || key;

                // מניעת כפילויות - אם כבר הצגנו "תיק", אל תציג שוב
                if (seenLabels.has(label)) {
                    return;
                }
                seenLabels.add(label);

                // המר ערך אם צריך
                let displayValue = value;

                // פורמטים מיוחדים
                if (key === 'actualMinutes') {
                    const hours = Math.floor(value / 60);
                    const minutes = value % 60;
                    displayValue = hours > 0
                        ? `${hours}:${minutes.toString().padStart(2, '0')} שעות`
                        : `${minutes} דקות`;
                } else if (key === 'estimatedHours') {
                    displayValue = `${value} שעות`;
                } else if (key === 'gapPercent') {
                    displayValue = `${value}%`;
                } else if (valueTransformers[value]) {
                    displayValue = valueTransformers[value];
                }

                detailsArray.push(`${label}: ${displayValue}`);
            });

            // הגבל ל-3 פרטים החשובים ביותר
            return detailsArray.slice(0, 3);
        }

        formatActivityAction(action) {
            const actionMap = {
                // Timesheet
                'CREATE_TIMESHEET_ENTRY': 'רישום שעות',
                'UPDATE_TIMESHEET_ENTRY': 'עדכון רישום שעות',
                'DELETE_TIMESHEET_ENTRY': 'מחיקת רישום שעות',

                // Tasks
                'CREATE_TASK': 'יצירת משימה',
                'UPDATE_TASK': 'עדכון משימה',
                'COMPLETE_TASK': 'השלמת משימה',
                'DELETE_TASK': 'מחיקת משימה',
                'EXTEND_TASK_DEADLINE': 'הארכת מועד משימה',
                'TASK_UPDATED_BY_ADMIN': 'עדכון משימה על ידי מנהל',

                // Clients
                'CREATE_CLIENT': 'יצירת לקוח',
                'UPDATE_CLIENT': 'עדכון לקוח',
                'DELETE_CLIENT': 'מחיקת לקוח',
                'ADD_SERVICE_TO_CLIENT': 'הוספת שירות ללקוח',
                'REMOVE_SERVICE_FROM_CLIENT': 'הסרת שירות מלקוח',

                // User Management
                'LOGIN': 'התחברות',
                'LOGOUT': 'התנתקות',
                'VIEW_USER_DETAILS': 'צפייה בפרטי משתמש',
                'UPDATE_USER': 'עדכון משתמש',
                'CREATE_USER': 'יצירת משתמש',
                'DELETE_USER': 'מחיקת משתמש',
                'BLOCK_USER': 'חסימת משתמש',
                'UNBLOCK_USER': 'הסרת חסימה',

                // Cases
                'CREATE_CASE': 'יצירת תיק',
                'UPDATE_CASE': 'עדכון תיק',
                'DELETE_CASE': 'מחיקת תיק',
                'CLOSE_CASE': 'סגירת תיק',

                // Documents
                'UPLOAD_DOCUMENT': 'העלאת מסמך',
                'DELETE_DOCUMENT': 'מחיקת מסמך',
                'DOWNLOAD_DOCUMENT': 'הורדת מסמך',

                // System
                'SYSTEM_ERROR': 'שגיאת מערכת',
                'PERMISSION_DENIED': 'הרשאה נדחתה'
            };

            return actionMap[action] || action || 'פעולה';
        }

        /**
         * Render footer
         * רינדור פוטר
         */
        renderFooter() {
            return `
                <button class="btn btn-outline" id="userDetailsGenerateReportBtn">
                    <i class="fas fa-file-alt"></i>
                    <span>הפק דוח</span>
                </button>
                <button class="btn btn-secondary" id="userDetailsCloseBtn">
                    <i class="fas fa-times"></i>
                    <span>סגור</span>
                </button>
            `;
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEvents() {
            const modal = window.ModalManager.getElement(this.modalId);
            if (!modal) {
return;
}

            // Close button
            const closeBtn = modal.querySelector('#userDetailsCloseBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.close();
                });
            }

            // Generate Report button (footer)
            const generateReportBtn = modal.querySelector('#userDetailsGenerateReportBtn');
            if (generateReportBtn) {
                generateReportBtn.addEventListener('click', () => {
                    this.openReportPanel();
                });
            }

            // Tab buttons
            const tabButtons = modal.querySelectorAll('.user-tab-btn');
            tabButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const tabId = btn.getAttribute('data-tab');
                    this.switchTab(tabId);
                });
            });

            // Action buttons
            const actionButtons = modal.querySelectorAll('.btn-action');
            actionButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.getAttribute('data-action');
                    this.handleAction(action);
                });
            });

            // Tasks sub-tab buttons
            const tasksSubTabs = modal.querySelectorAll('.tasks-sub-tab');
            tasksSubTabs.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.tasksSubTab = btn.getAttribute('data-sub-tab');
                    this.switchTab('tasks');
                });
            });

            // Edit Task buttons
            const editTaskButtons = modal.querySelectorAll('.btn-edit-task');
            editTaskButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const taskId = btn.getAttribute('data-task-id');
                    this.editTask(taskId);
                });
            });

            // Month/Year selectors (Hours tab)
            const monthSelector = modal.querySelector('#monthSelector');
            if (monthSelector) {
                monthSelector.addEventListener('change', (e) => {
                    this.selectedMonth = parseInt(e.target.value);
                    this.loadHoursForSelectedMonth();
                });
            }

            const yearSelector = modal.querySelector('#yearSelector');
            if (yearSelector) {
                yearSelector.addEventListener('change', (e) => {
                    this.selectedYear = parseInt(e.target.value);
                    this.loadHoursForSelectedMonth();
                });
            }

            // Prev/Next month buttons
            const prevMonthBtn = modal.querySelector('#prevMonthBtn');
            if (prevMonthBtn) {
                prevMonthBtn.addEventListener('click', () => {
                    this.navigateMonth(-1);
                });
            }

            const nextMonthBtn = modal.querySelector('#nextMonthBtn');
            if (nextMonthBtn) {
                nextMonthBtn.addEventListener('click', () => {
                    this.navigateMonth(1);
                });
            }

            // ========== HOURS TAB - ADVANCED FILTERS & CONTROLS ==========

            // View toggle buttons (table/cards)
            const viewToggleBtns = modal.querySelectorAll('.view-toggle-btn');
            viewToggleBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.hoursViewMode = btn.getAttribute('data-view');
                    this.switchTab('hours'); // Refresh to show new view
                });
            });

            // Date range filters
            const dateFromFilter = modal.querySelector('#dateFromFilter');
            if (dateFromFilter) {
                dateFromFilter.addEventListener('change', (e) => {
                    this.hoursFilters.dateFrom = e.target.value || null;
                    this.switchTab('hours');
                });
            }

            const dateToFilter = modal.querySelector('#dateToFilter');
            if (dateToFilter) {
                dateToFilter.addEventListener('change', (e) => {
                    this.hoursFilters.dateTo = e.target.value || null;
                    this.switchTab('hours');
                });
            }

            // Client filter
            const clientFilter = modal.querySelector('#clientFilter');
            if (clientFilter) {
                clientFilter.addEventListener('change', (e) => {
                    this.hoursFilters.client = e.target.value;
                    this.switchTab('hours');
                });
            }

            // Task filter
            const taskFilter = modal.querySelector('#taskFilter');
            if (taskFilter) {
                taskFilter.addEventListener('change', (e) => {
                    this.hoursFilters.task = e.target.value;
                    this.switchTab('hours');
                });
            }

            // Type filter (client/internal)
            const typeFilter = modal.querySelector('#typeFilter');
            if (typeFilter) {
                typeFilter.addEventListener('change', (e) => {
                    this.hoursFilters.type = e.target.value;
                    this.switchTab('hours');
                });
            }

            // Billable filter
            const billableFilter = modal.querySelector('#billableFilter');
            if (billableFilter) {
                billableFilter.addEventListener('change', (e) => {
                    this.hoursFilters.billable = e.target.value;
                    this.switchTab('hours');
                });
            }

            // Search filter (with debounce)
            const searchFilter = modal.querySelector('#searchFilter');
            if (searchFilter) {
                let searchTimeout;
                searchFilter.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        this.hoursFilters.searchText = e.target.value;
                        this.switchTab('hours');
                    }, 300); // 300ms debounce
                });
            }

            // Sort by dropdown
            const sortByFilter = modal.querySelector('#sortByFilter');
            if (sortByFilter) {
                sortByFilter.addEventListener('change', (e) => {
                    this.hoursSortBy = e.target.value;
                    this.switchTab('hours');
                });
            }

            // Sort direction button
            const sortDirectionBtn = modal.querySelector('#sortDirectionBtn');
            if (sortDirectionBtn) {
                sortDirectionBtn.addEventListener('click', () => {
                    this.hoursSortDirection = this.hoursSortDirection === 'asc' ? 'desc' : 'asc';
                    this.switchTab('hours');
                });
            }

            // Reset filters button
            const resetFiltersBtn = modal.querySelector('#resetFiltersBtn');
            if (resetFiltersBtn) {
                resetFiltersBtn.addEventListener('click', () => {
                    // Reset all filters to default
                    this.selectedMonth = 'all';
                    this.hoursFilters = {
                        dateFrom: null,
                        dateTo: null,
                        client: 'all',
                        task: 'all',
                        type: 'all',
                        billable: 'all',
                        searchText: ''
                    };
                    this.hoursSortBy = 'date';
                    this.hoursSortDirection = 'desc';
                    this.switchTab('hours');
                });
            }

            // Edit hour buttons
            const editHourButtons = modal.querySelectorAll('.btn-edit-hour');
            editHourButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const entryId = btn.getAttribute('data-entry-id');
                    this.editHourEntry(entryId);
                });
            });

            // Delete hour buttons
            const deleteHourButtons = modal.querySelectorAll('.btn-delete-hour');
            deleteHourButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const entryId = btn.getAttribute('data-entry-id');
                    this.deleteHourEntry(entryId);
                });
            });

            // ========== SHOW ALL TASKS BUTTON ==========
            const showAllTasksBtn = modal.querySelector('.show-all-tasks-btn');
            if (showAllTasksBtn) {
                showAllTasksBtn.addEventListener('click', () => {
                    this.openTasksPanel();
                });
            }

            // ========== SHOW ALL HOURS BUTTON ==========
            const showAllHoursBtn = modal.querySelector('.show-all-hours-btn');
            if (showAllHoursBtn) {
                showAllHoursBtn.addEventListener('click', () => {
                    this.openHoursPanel();
                });
            }

        }

        /**
         * Switch tab
         * מעבר בין טאבים
         */
        async switchTab(tabId) {
            console.log(`🔄 switchTab called: ${this.activeTab} → ${tabId}`);
            this.activeTab = tabId;

            // ✅ Lazy loading: Load activity tab on-demand
            if (tabId === 'activity' && !this.activityLoaded && !this.activityLoading) {
                console.log('📡 Activity tab opened for first time - loading data...');
                await this.loadActivityTab();
                return; // loadActivityTab() will call updateModalContent()
            }

            // Update modal content
            window.ModalManager.updateContent(this.modalId, this.renderContent());

            // Re-setup events
            this.setupEvents();

            // Open performance panel if switching to performance tab
            if (tabId === 'performance') {
                // Open panel directly
                setTimeout(() => {
                    this.openPerformancePanel();
                }, 100);
            }

            console.log(`✅ Switched to tab: ${tabId}`);
        }


        /**
         * Navigate between months (prev/next)
         * ניווט בין חודשים
         */
        navigateMonth(direction) {
            let newMonth = this.selectedMonth + direction;
            let newYear = this.selectedYear;

            if (newMonth > 12) {
                newMonth = 1;
                newYear++;
            } else if (newMonth < 1) {
                newMonth = 12;
                newYear--;
            }

            this.selectedMonth = newMonth;
            this.selectedYear = newYear;

            this.loadHoursForSelectedMonth();
        }

        /**
         * Load hours data for selected month
         * טעינת נתוני שעות לחודש נבחר
         */
        async loadHoursForSelectedMonth() {
            try {
                console.log(`📥 Loading hours for ${this.selectedMonth}/${this.selectedYear}...`);

                // Show loading indicator
                const hoursTab = document.querySelector('.tab-panel.tab-hours');
                if (hoursTab) {
                    hoursTab.style.opacity = '0.5';
                    hoursTab.style.pointerEvents = 'none';
                }

                try {
                    // ✅ Try Cloud Function first
                    const getUserDetailsFunction = window.firebaseFunctions.httpsCallable('getUserFullDetails');

                    const result = await getUserDetailsFunction({
                        email: this.currentUser.email,
                        month: this.selectedMonth,
                        year: this.selectedYear
                    });

                    // Parse the response
                    const responseData = result.data;

                    // Update only timesheet/hours data (keep other data unchanged)
                    this.userData.timesheet = responseData.timesheet || [];
                    this.userData.hours = responseData.timesheet || [];
                    this.userData.stats.hoursThisWeek = responseData.stats?.hoursThisWeek || 0;
                    this.userData.stats.hoursThisMonth = responseData.stats?.hoursThisMonth || 0;
                    this.userData.hoursPreFiltered = true;  // ✅ מסמן שמסונן מהשרת

                    console.log(`✅ Hours loaded from Cloud Function for ${this.selectedMonth}/${this.selectedYear}`);

                } catch (cloudError) {
                    // ✅ Fallback to Firestore if Cloud Function fails
                    console.log('⚡ Cloud Function failed, loading hours from Firestore...');

                    const db = window.firebaseDB;
                    const userEmail = this.currentUser.email;

                    // Calculate date range for selected month
                    const startOfMonth = new Date(this.selectedYear, this.selectedMonth - 1, 1);
                    const endOfMonth = new Date(this.selectedYear, this.selectedMonth, 0, 23, 59, 59);

                    // Load timesheet from Firestore
                    const timesheetSnapshot = await db.collection('timesheet_entries')
                        .where('employee', '==', userEmail)
                        .where('date', '>=', startOfMonth)
                        .where('date', '<=', endOfMonth)
                        .orderBy('date', 'desc')
                        .get();

                    const timesheet = timesheetSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    // Update only timesheet/hours data
                    this.userData.timesheet = timesheet;
                    this.userData.hours = timesheet;
                    this.userData.hoursPreFiltered = true;  // ✅ מסמן שמסונן מ-Firestore

                    console.log(`✅ Hours loaded from Firestore for ${this.selectedMonth}/${this.selectedYear} (${timesheet.length} entries)`);
                }

                // Refresh the tab
                this.switchTab('hours');

            } catch (error) {
                console.error('❌ Error loading hours:', error);
                window.notify.error('שגיאה בטעינת שעות');

            } finally {
                // ✅ Always remove loading indicator
                const hoursTab = document.querySelector('.tab-panel.tab-hours');
                if (hoursTab) {
                    hoursTab.style.opacity = '1';
                    hoursTab.style.pointerEvents = 'auto';
                }
            }
        }

        /**
         * Handle action button click
         * טיפול בלחיצה על כפתור פעולה
         */
        handleAction(action) {
            console.log(`🔧 Action: ${action}`);

            // Emit event for UsersActions to handle
            window.dispatchEvent(new CustomEvent('user:action', {
                detail: {
                    action,
                    userEmail: this.currentUser.email
                }
            }));
        }

        /**
         * Helper methods
         * פונקציות עזר
         */

        getInitials(name) {
            if (!name) {
return '?';
}
            const parts = name.split(' ');
            if (parts.length >= 2) {
                return (parts[0][0] + parts[1][0]).toUpperCase();
            }
            return name.substring(0, 2).toUpperCase();
        }

        getAvatarColor(email) {
            const colors = ['avatar-blue', 'avatar-green', 'avatar-purple', 'avatar-orange', 'avatar-red'];
            if (!email || typeof email !== 'string' || email.length === 0) {
                return colors[0]; // Default color
            }
            const index = email.charCodeAt(0) % colors.length;
            return colors[index];
        }

        getRoleText(role) {
            const roleMap = {
                'admin': 'מנהל',
                'lawyer': 'עורך דין',
                'employee': 'עובד',
                'user': 'משתמש'
            };
            return roleMap[role] || role;
        }

        getStatusText(status) {
            const statusMap = { 'active': 'פעיל', 'blocked': 'חסום' };
            return statusMap[status] || status;
        }

        formatDate(date) {
            if (!date) {
return '-';
}

            try {
                let dateObj;

                // Handle Firestore Timestamp object
                if (date.toDate && typeof date.toDate === 'function') {
                    dateObj = date.toDate();
                } else if (date._seconds !== undefined) {
                    // Handle Firestore Timestamp serialized (from Cloud Function)
                    dateObj = new Date(date._seconds * 1000);
                } else if (typeof date === 'number') {
                    // Handle regular timestamp
                    dateObj = new Date(date);
                } else if (typeof date === 'string') {
                    // Handle string date
                    dateObj = new Date(date);
                } else if (date instanceof Date) {
                    // Handle Date object
                    dateObj = date;
                } else {
                    console.warn('Unknown date format:', date);
                    return '-';
                }

                // Check if valid date
                if (isNaN(dateObj.getTime())) {
                    console.warn('Invalid date:', date);
                    return '-';
                }

                return dateObj.toLocaleDateString('he-IL', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (error) {
                console.error('Error formatting date:', error, date);
                return '-';
            }
        }

        /**
         * ════════════════════════════════════════════════════════════════════
         * 🆕 NEW: Real-Time Activity Status Display
         * ════════════════════════════════════════════════════════════════════
         * Shows accurate user status based on lastSeen (updated by Heartbeat)
         * - 🟢 "פעיל עכשיו" if lastSeen < 10 minutes
         * - 🟡 "פעיל לפני X דקות" if 10-60 minutes
         * - 🔴 "לא פעיל" if > 60 minutes
         * ════════════════════════════════════════════════════════════════════
         */

        /**
         * Format last seen status with real-time indicator
         * הצגת סטטוס פעילות אמיתי עם אינדיקטור
         *
         * @param {Object} user - User data with lastSeen field
         * @returns {string} HTML string with status indicator
         */
        formatLastSeenStatus(user) {
            // Try lastSeen first (updated by Heartbeat every 5 min)
            const lastActivity = user.lastSeen || user.lastLogin;

            if (!lastActivity) {
                return '<span style="color: #6b7280;">לא ידוע</span>';
            }

            try {
                let dateObj;

                // Handle Firestore Timestamp
                if (lastActivity.toDate && typeof lastActivity.toDate === 'function') {
                    dateObj = lastActivity.toDate();
                } else if (lastActivity._seconds !== undefined) {
                    dateObj = new Date(lastActivity._seconds * 1000);
                } else if (typeof lastActivity === 'number') {
                    dateObj = new Date(lastActivity);
                } else if (lastActivity instanceof Date) {
                    dateObj = lastActivity;
                } else {
                    return '<span style="color: #6b7280;">לא ידוע</span>';
                }

                // Check if valid date
                if (isNaN(dateObj.getTime())) {
                    return '<span style="color: #6b7280;">לא ידוע</span>';
                }

                const now = Date.now();
                const diff = now - dateObj.getTime();
                const minutes = Math.floor(diff / (1000 * 60));
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));

                // 🟢 Active NOW (< 10 minutes)
                if (minutes < 10) {
                    return '<span style="color: #10b981; font-weight: 600;">🟢 פעיל עכשיו</span>';
                }

                // 🟡 Active recently (10-60 minutes)
                if (minutes < 60) {
                    return `<span style="color: #f59e0b; font-weight: 600;">🟡 פעיל לפני ${minutes} דקות</span>`;
                }

                // 🔴 Not active (> 1 hour)
                if (hours < 24) {
                    return `<span style="color: #ef4444;">🔴 לא פעיל (לפני ${hours} שעות)</span>`;
                }

                // 🔴 Not active (> 1 day)
                if (days < 7) {
                    return `<span style="color: #ef4444;">🔴 לא פעיל (לפני ${days} ימים)</span>`;
                }

                // 🔴 Not active (> 1 week)
                const formattedDate = dateObj.toLocaleDateString('he-IL', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                return `<span style="color: #9ca3af;">⚫ לא פעיל מזה ${formattedDate}</span>`;

            } catch (error) {
                console.error('Error formatting last seen status:', error);
                return '<span style="color: #6b7280;">לא ידוע</span>';
            }
        }

        /**
         * Format relative time (e.g., "לפני 3 דקות")
         * פורמט זמן יחסי
         */
        formatRelativeTime(date) {
            if (!date) {
return '-';
}

            try {
                let dateObj;

                // Handle Firestore Timestamp
                if (date.toDate && typeof date.toDate === 'function') {
                    dateObj = date.toDate();
                } else if (date instanceof Date) {
                    dateObj = date;
                } else {
                    dateObj = new Date(date);
                }

                const now = new Date();
                const diffMs = now - dateObj;
                const diffMins = Math.floor(diffMs / 60000);

                if (diffMins < 1) {
return 'עכשיו';
}
                if (diffMins < 60) {
return `לפני ${diffMins} דקות`;
}

                const diffHours = Math.floor(diffMins / 60);
                if (diffHours < 24) {
return `לפני ${diffHours} שעות`;
}

                const diffDays = Math.floor(diffHours / 24);
                if (diffDays < 7) {
return `לפני ${diffDays} ימים`;
}

                // Format as date
                return dateObj.toLocaleDateString('he-IL');

            } catch (error) {
                console.error('Error formatting relative time:', error);
                return '-';
            }
        }

        /**
         * Format timestamp with time (for messages timeline)
         * פורמט תאריך + שעה להודעות
         */
        formatTimestamp(timestamp) {
            if (!timestamp) {
return '-';
}

            try {
                let dateObj;

                // Handle Firestore Timestamp
                if (timestamp.toDate && typeof timestamp.toDate === 'function') {
                    dateObj = timestamp.toDate();
                } else if (timestamp._seconds !== undefined) {
                    dateObj = new Date(timestamp._seconds * 1000);
                } else if (typeof timestamp === 'number') {
                    dateObj = new Date(timestamp);
                } else if (timestamp instanceof Date) {
                    dateObj = timestamp;
                } else {
                    return '-';
                }

                if (isNaN(dateObj.getTime())) {
                    return '-';
                }

                return dateObj.toLocaleDateString('he-IL', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (error) {
                console.error('Error formatting timestamp:', error);
                return '-';
            }
        }

        /**
         * Get relative time (e.g. "לפני 2 שעות")
         * קבלת זמן יחסי
         */
        getRelativeTime(timestamp) {
            if (!timestamp) {
return '';
}

            try {
                let dateObj;

                // Handle Firestore Timestamp
                if (timestamp.toDate && typeof timestamp.toDate === 'function') {
                    dateObj = timestamp.toDate();
                } else if (timestamp._seconds !== undefined) {
                    dateObj = new Date(timestamp._seconds * 1000);
                } else if (typeof timestamp === 'number') {
                    dateObj = new Date(timestamp);
                } else if (timestamp instanceof Date) {
                    dateObj = timestamp;
                } else {
                    return '';
                }

                if (isNaN(dateObj.getTime())) {
                    return '';
                }

                const now = new Date();
                const diffMs = now - dateObj;
                const diffSeconds = Math.floor(diffMs / 1000);
                const diffMinutes = Math.floor(diffSeconds / 60);
                const diffHours = Math.floor(diffMinutes / 60);
                const diffDays = Math.floor(diffHours / 24);
                const diffWeeks = Math.floor(diffDays / 7);
                const diffMonths = Math.floor(diffDays / 30);
                const diffYears = Math.floor(diffDays / 365);

                if (diffSeconds < 60) {
                    return 'עכשיו';
                } else if (diffMinutes < 60) {
                    return `לפני ${diffMinutes} ${diffMinutes === 1 ? 'דקה' : 'דקות'}`;
                } else if (diffHours < 24) {
                    return `לפני ${diffHours} ${diffHours === 1 ? 'שעה' : 'שעות'}`;
                } else if (diffDays === 1) {
                    return 'אתמול';
                } else if (diffDays < 7) {
                    return `לפני ${diffDays} ימים`;
                } else if (diffWeeks < 4) {
                    return `לפני ${diffWeeks} ${diffWeeks === 1 ? 'שבוע' : 'שבועות'}`;
                } else if (diffMonths < 12) {
                    return `לפני ${diffMonths} ${diffMonths === 1 ? 'חודש' : 'חודשים'}`;
                } else {
                    return `לפני ${diffYears} ${diffYears === 1 ? 'שנה' : 'שנים'}`;
                }
            } catch (error) {
                console.error('Error calculating relative time:', error);
                return '';
            }
        }

        getActivityIcon(action) {
            const iconMap = {
                // Timesheet
                'CREATE_TIMESHEET_ENTRY': 'fas fa-clock',
                'UPDATE_TIMESHEET_ENTRY': 'fas fa-clock',
                'DELETE_TIMESHEET_ENTRY': 'fas fa-clock',

                // Tasks
                'CREATE_TASK': 'fas fa-plus-circle',
                'UPDATE_TASK': 'fas fa-edit',
                'COMPLETE_TASK': 'fas fa-check-circle',
                'DELETE_TASK': 'fas fa-trash',
                'EXTEND_TASK_DEADLINE': 'fas fa-calendar-plus',
                'TASK_UPDATED_BY_ADMIN': 'fas fa-user-shield',

                // Clients
                'CREATE_CLIENT': 'fas fa-user-plus',
                'UPDATE_CLIENT': 'fas fa-user-edit',
                'DELETE_CLIENT': 'fas fa-user-times',
                'ADD_SERVICE_TO_CLIENT': 'fas fa-plus-square',
                'REMOVE_SERVICE_FROM_CLIENT': 'fas fa-minus-square',

                // User Management
                'LOGIN': 'fas fa-sign-in-alt',
                'LOGOUT': 'fas fa-sign-out-alt',
                'VIEW_USER_DETAILS': 'fas fa-eye',
                'UPDATE_USER': 'fas fa-user-cog',
                'CREATE_USER': 'fas fa-user-plus',
                'DELETE_USER': 'fas fa-user-slash',
                'BLOCK_USER': 'fas fa-ban',
                'UNBLOCK_USER': 'fas fa-unlock',

                // Cases
                'CREATE_CASE': 'fas fa-briefcase',
                'UPDATE_CASE': 'fas fa-briefcase',
                'DELETE_CASE': 'fas fa-briefcase',
                'CLOSE_CASE': 'fas fa-check-square',

                // Documents
                'UPLOAD_DOCUMENT': 'fas fa-file-upload',
                'DELETE_DOCUMENT': 'fas fa-file-excel',
                'DOWNLOAD_DOCUMENT': 'fas fa-file-download',

                // System
                'SYSTEM_ERROR': 'fas fa-exclamation-triangle',
                'PERMISSION_DENIED': 'fas fa-lock',

                // Legacy support
                'login': 'fas fa-sign-in-alt',
                'logout': 'fas fa-sign-out-alt',
                'create': 'fas fa-plus',
                'update': 'fas fa-edit',
                'delete': 'fas fa-trash'
            };
            return iconMap[action] || 'fas fa-circle';
        }

        escapeHtml(text) {
            // Routed to the shared SSOT escaper (js/core/escape-html.js).
            // Behavior change: now also escapes " and ' (the temp-div escaped only & < >) —
            // safe in HTML text/attribute contexts (value= / title= / textarea sinks included).
            return window.escapeHtml(text);
        }

        /**
         * Get available months from hours data
         * קבלת חודשים זמינים מרשומות השעות
         */
        getAvailableMonths(hours) {
            const monthsMap = new Map();

            hours.forEach(entry => {
                const date = new Date(entry.date);
                const year = date.getFullYear();
                const month = date.getMonth();
                const key = `${year}-${month}`;

                if (!monthsMap.has(key)) {
                    monthsMap.set(key, {
                        value: key,
                        label: date.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' }),
                        count: 0
                    });
                }

                monthsMap.get(key).count++;
            });

            return Array.from(monthsMap.values()).sort((a, b) => {
                const [yearA, monthA] = a.value.split('-').map(Number);
                const [yearB, monthB] = b.value.split('-').map(Number);
                return yearB - yearA || monthB - monthA;
            });
        }

        /**
         * Filter and sort hours data
         * סינון ומיון נתוני שעות
         */
        filterAndSortHours(hours) {
            let filtered = [...hours];

            // ✅ סינון לפי חודש רק אם הנתונים לא מסוננים מראש מהשרת
            // Note: selectedMonth is now a number (1-12), selectedYear is a number
            if (!this.userData?.hoursPreFiltered && this.selectedMonth && this.selectedYear) {
                filtered = filtered.filter(entry => {
                    const entryDate = new Date(entry.date);
                    return entryDate.getFullYear() === this.selectedYear &&
                           (entryDate.getMonth() + 1) === this.selectedMonth;
                });
            }

            // סינון לפי טווח תאריכים
            if (this.hoursFilters.dateFrom) {
                filtered = filtered.filter(entry => new Date(entry.date) >= new Date(this.hoursFilters.dateFrom));
            }
            if (this.hoursFilters.dateTo) {
                filtered = filtered.filter(entry => new Date(entry.date) <= new Date(this.hoursFilters.dateTo));
            }

            // סינון לפי לקוח
            if (this.hoursFilters.client !== 'all') {
                filtered = filtered.filter(entry => entry.clientId === this.hoursFilters.client);
            }

            // סינון לפי משימה
            if (this.hoursFilters.task !== 'all') {
                filtered = filtered.filter(entry => entry.taskId === this.hoursFilters.task);
            }

            // סינון לפי סוג (לקוח/פנימי)
            if (this.hoursFilters.type === 'client') {
                filtered = filtered.filter(entry => !entry.isInternal);
            } else if (this.hoursFilters.type === 'internal') {
                filtered = filtered.filter(entry => entry.isInternal);
            }

            // סינון לפי סטטוס חיוב
            if (this.hoursFilters.billable === 'yes') {
                filtered = filtered.filter(entry => entry.billable === true);
            } else if (this.hoursFilters.billable === 'no') {
                filtered = filtered.filter(entry => entry.billable === false);
            }

            // חיפוש חופשי
            if (this.hoursFilters.searchText) {
                const searchLower = this.hoursFilters.searchText.toLowerCase();
                filtered = filtered.filter(entry =>
                    entry.clientName?.toLowerCase().includes(searchLower) ||
                    entry.taskDescription?.toLowerCase().includes(searchLower) ||
                    entry.action?.toLowerCase().includes(searchLower) ||
                    entry.notes?.toLowerCase().includes(searchLower)
                );
            }

            // מיון
            filtered.sort((a, b) => {
                let comparison = 0;

                if (this.hoursSortBy === 'date') {
                    comparison = new Date(a.date) - new Date(b.date);
                } else if (this.hoursSortBy === 'client') {
                    comparison = (a.clientName || '').localeCompare(b.clientName || '', 'he');
                } else if (this.hoursSortBy === 'hours') {
                    comparison = (a.hours || 0) - (b.hours || 0);
                }

                return this.hoursSortDirection === 'asc' ? comparison : -comparison;
            });

            return filtered;
        }

        /**
         * Get unique clients from hours data
         * קבלת רשימת לקוחות ייחודית
         */
        getUniqueClients(hours) {
            const clientsMap = new Map();
            hours.forEach(entry => {
                if (entry.clientId && entry.clientName) {
                    clientsMap.set(entry.clientId, entry.clientName);
                }
            });
            return Array.from(clientsMap, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'he'));
        }

        /**
         * Get unique tasks from hours data
         * קבלת רשימת משימות ייחודית
         */
        getUniqueTasks(hours) {
            const tasksMap = new Map();
            hours.forEach(entry => {
                if (entry.taskId && entry.taskDescription) {
                    tasksMap.set(entry.taskId, entry.taskDescription);
                }
            });
            return Array.from(tasksMap, ([id, description]) => ({ id, description })).sort((a, b) => a.description.localeCompare(b.description, 'he'));
        }

        /**
         * Calculate client breakdown for hours visualization
         * חישוב פירוט לפי לקוחות
         */
        calculateClientBreakdown(hours) {
            const clientHours = hours.filter(e => !e.isInternal);
            const totalClientHours = clientHours.reduce((sum, entry) => sum + (entry.hours || 0), 0);

            if (totalClientHours === 0) {
                return [];
            }

            // קבץ לפי לקוח
            const clientsMap = new Map();
            clientHours.forEach(entry => {
                const clientId = entry.clientId;
                const clientName = entry.clientName || 'לקוח לא ידוע';

                if (!clientsMap.has(clientId)) {
                    clientsMap.set(clientId, {
                        id: clientId,
                        name: clientName,
                        hours: 0,
                        count: 0
                    });
                }

                const client = clientsMap.get(clientId);
                client.hours += entry.hours || 0;
                client.count += 1;
            });

            // המר ל-array ומיין לפי שעות (יורד)
            const breakdown = Array.from(clientsMap.values())
                .map(client => ({
                    ...client,
                    percentage: ((client.hours / totalClientHours) * 100).toFixed(1)
                }))
                .sort((a, b) => b.hours - a.hours);

            return breakdown;
        }

        /**
         * Get color for client index in breakdown
         * קבלת צבע ללקוח בפירוט
         */
        getClientColor(index) {
            const colors = [
                '#3b82f6', // Blue
                '#60a5fa', // Light Blue
                '#2563eb', // Dark Blue
                '#1d4ed8', // Deep Blue
                '#0ea5e9', // Sky Blue
                '#0284c7', // Blue Shade 1
                '#3b82f6', // Blue (repeat)
                '#60a5fa', // Light Blue (repeat)
                '#2563eb', // Dark Blue (repeat)
                '#1d4ed8'  // Deep Blue (repeat)
            ];
            return colors[index % colors.length];
        }

        /**
         * Edit Task
         * עריכת משימה - שליטה מלאה למנהל
         *
         * @param {string} taskId - מזהה המשימה
         */
        async editTask(taskId) {
            try {
                console.log(`✏️ Opening edit modal for task: ${taskId}`);

                // מצא את המשימה בנתונים קיימים (אפס קריאות מיותרות!)
                const task = this.userData.tasks.find(t => t.id === taskId);
                if (!task) {
                    console.error('❌ Task not found:', taskId);
                    if (window.NotificationsUI) {
                        window.NotificationsUI.showError('משימה לא נמצאה');
                    }
                    return;
                }

                // יצירת modal עריכה
                const modalContent = this.renderEditTaskModal(task);

                const editModalId = window.ModalManager.create({
                    title: 'עריכת משימה',
                    content: modalContent,
                    size: 'medium',
                    closeOnBackdrop: false
                });

                // Event listeners למודאל
                this.setupEditTaskEvents(editModalId, task);

            } catch (error) {
                console.error('❌ Error opening edit task modal:', error);
                if (window.NotificationsUI) {
                    window.NotificationsUI.showError('שגיאה בפתיחת עריכת משימה');
                }
            }
        }

        /**
         * Render Edit Task Modal
         * רינדור modal עריכת משימה עם כל השדות
         *
         * @param {Object} task - נתוני המשימה
         * @returns {string} HTML של המודאל
         */
        renderEditTaskModal(task) {
            // הכנת מידע על סוג השירות
            let serviceTypeText = '';
            let serviceIcon = 'fa-briefcase';

            if (task.serviceType === window.SYSTEM_CONSTANTS?.SERVICE_TYPES?.LEGAL_PROCEDURE) {
                serviceIcon = 'fa-balance-scale';
                const stName = window.SystemConstantsHelpers?.getStageName?.(task.serviceId);
                if (stName && stName !== task.serviceId) {
                    serviceTypeText = 'הליך משפטי - ' + stName;
                } else {
                    serviceTypeText = 'הליך משפטי';
                }
            } else if (task.serviceName) {
                serviceTypeText = 'תוכנית שעות';
            }

            // Progress calculation
            const progress = task.estimatedHours > 0
                ? Math.round((task.actualHours / task.estimatedHours) * 100)
                : 0;
            const progressColor = progress >= 100 ? '#ef4444' : progress >= 80 ? '#f97316' : '#22c55e';

            // תיקון פורמט תאריך - המרה מ-Timestamp/ISO ל-YYYY-MM-DD
            let deadlineValue = '';
            if (task.deadline) {
                try {
                    let date;
                    if (task.deadline.toDate && typeof task.deadline.toDate === 'function') {
                        date = task.deadline.toDate();
                    } else if (task.deadline._seconds) {
                        date = new Date(task.deadline._seconds * 1000);
                    } else {
                        date = new Date(task.deadline);
                    }
                    if (!isNaN(date.getTime())) {
                        deadlineValue = date.toISOString().split('T')[0];
                    }
                } catch (e) {
                    console.warn('Invalid deadline format:', task.deadline);
                }
            }

            return `
                <div class="master-edit-task-modal">
                    <!-- Context Info Cards - מידע הקשר -->
                    <div class="context-cards">
                        <div class="context-card">
                            <i class="fas fa-user"></i>
                            <div class="context-info">
                                <span class="context-label">לקוח</span>
                                <span class="context-value">${this.escapeHtml(task.clientName || 'לא מוגדר')}</span>
                            </div>
                        </div>
                        ${task.serviceName ? `
                        <div class="context-card">
                            <i class="fas ${serviceIcon}"></i>
                            <div class="context-info">
                                <span class="context-label">${serviceTypeText}</span>
                                <span class="context-value">${this.escapeHtml(task.serviceName)}</span>
                            </div>
                        </div>
                        ` : ''}
                        ${task.caseNumber ? `
                        <div class="context-card">
                            <i class="fas fa-folder-open"></i>
                            <div class="context-info">
                                <span class="context-label">תיק</span>
                                <span class="context-value">${this.escapeHtml(task.caseNumber)}${task.caseTitle ? ' - ' + this.escapeHtml(task.caseTitle) : ''}</span>
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <!-- Progress Summary - סיכום התקדמות -->
                    <div class="progress-summary">
                        <div class="progress-text">
                            <span class="progress-label">ביצוע</span>
                            <span class="progress-stats">${(task.actualHours || 0).toFixed(2)} / ${(task.estimatedHours || 0).toFixed(2)} שעות</span>
                            <span class="progress-percent" style="color: ${progressColor}">${progress}%</span>
                        </div>
                        <div class="progress-track">
                            <div class="progress-bar" style="width: ${Math.min(progress, 100)}%; background-color: ${progressColor};"></div>
                        </div>
                    </div>

                    <!-- Edit Form - טופס עריכה -->
                    <div class="compact-form">
                        <!-- תיאור המשימה -->
                        <div class="form-field">
                            <label for="taskDescription">
                                <i class="fas fa-align-right" style="color: #a855f7;"></i>
                                תיאור משימה
                            </label>
                            <textarea
                                id="taskDescription"
                                rows="3"
                                required
                                placeholder="תאר את המשימה..."
                            >${this.escapeHtml(task.description || task.title || '')}</textarea>
                        </div>

                        <!-- שורה ראשונה: תקציב + סטטוס -->
                        <div class="form-row">
                            <div class="form-field">
                                <label for="taskEstimatedHours">
                                    <i class="fas fa-clock" style="color: #f97316;"></i>
                                    תקציב שעות
                                </label>
                                <input
                                    type="number"
                                    id="taskEstimatedHours"
                                    value="${task.estimatedHours || 0}"
                                    min="0"
                                    step="0.25"
                                    required
                                >
                            </div>
                            <div class="form-field">
                                <label for="taskStatus">
                                    <i class="fas fa-flag" style="color: #3b82f6;"></i>
                                    סטטוס
                                </label>
                                <select id="taskStatus" required>
                                    <option value="פעיל" ${task.status === 'פעיל' ? 'selected' : ''}>✅ פעילה</option>
                                    <option value="הושלם" ${task.status === 'הושלם' ? 'selected' : ''}>✔️ הושלמה</option>
                                    <option value="בהמתנה" ${task.status === 'בהמתנה' ? 'selected' : ''}>⏸️ בהמתנה</option>
                                    <option value="בוטל" ${task.status === 'בוטל' ? 'selected' : ''}>❌ בוטלה</option>
                                </select>
                            </div>
                        </div>

                        <!-- שורה שנייה: תאריך יעד + עורך דין -->
                        <div class="form-row">
                            <div class="form-field">
                                <label for="taskDeadline">
                                    <i class="fas fa-calendar-alt" style="color: #22c55e;"></i>
                                    תאריך יעד
                                </label>
                                <input
                                    type="date"
                                    id="taskDeadline"
                                    value="${deadlineValue}"
                                >
                            </div>
                            <div class="form-field">
                                <label for="taskLawyer">
                                    <i class="fas fa-gavel" style="color: #3b82f6;"></i>
                                    עורך דין אחראי
                                </label>
                                <input
                                    type="text"
                                    id="taskLawyer"
                                    value="${this.escapeHtml(task.lawyer || '')}"
                                    placeholder="שם עורך הדין"
                                >
                            </div>
                        </div>

                        <!-- שורה שלישית: סניף -->
                        <div class="form-field">
                            <label for="taskBranch">
                                <i class="fas fa-building" style="color: #64748b;"></i>
                                סניף
                            </label>
                            <input
                                type="text"
                                id="taskBranch"
                                value="${this.escapeHtml(task.branch || '')}"
                                placeholder="שם הסניף"
                            >
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" id="cancelEditTask">
                            <i class="fas fa-times"></i>
                            ביטול
                        </button>
                        <button type="button" class="btn-primary" id="saveEditTask">
                            <i class="fas fa-save"></i>
                            שמור שינויים
                        </button>
                    </div>
                </div>

                <style>
                    .master-edit-task-modal {
                        direction: rtl;
                    }

                    /* Context Cards - Ultra Minimal */
                    .context-cards {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 12px;
                        margin-bottom: 20px;
                    }

                    .context-card {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        background: #fafafa;
                        border: 1px solid #e5e7eb;
                        border-radius: 8px;
                        padding: 12px 16px;
                        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    }

                    .context-card:hover {
                        background: #f9fafb;
                        border-color: #d1d5db;
                    }

                    .context-card i {
                        font-size: 18px;
                        color: #64748b;
                        width: 24px;
                        text-align: center;
                    }

                    .context-info {
                        display: flex;
                        flex-direction: column;
                        gap: 2px;
                        flex: 1;
                        min-width: 0;
                    }

                    .context-label {
                        font-size: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: #94a3b8;
                        font-weight: 500;
                    }

                    .context-value {
                        font-size: 13px;
                        color: #0f172a;
                        font-weight: 500;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }

                    /* Progress Summary - Ultra Minimal */
                    .progress-summary {
                        background: #fafafa;
                        border: 1px solid #e5e7eb;
                        border-radius: 8px;
                        padding: 16px;
                        margin-bottom: 24px;
                    }

                    .progress-text {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        margin-bottom: 10px;
                        font-size: 13px;
                    }

                    .progress-label {
                        font-size: 11px;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: #64748b;
                        font-weight: 600;
                    }

                    .progress-stats {
                        color: #475569;
                        font-weight: 500;
                    }

                    .progress-percent {
                        margin-right: auto;
                        font-weight: 600;
                        font-size: 14px;
                    }

                    .progress-track {
                        height: 6px;
                        background: #e5e7eb;
                        border-radius: 3px;
                        overflow: hidden;
                    }

                    .progress-bar {
                        height: 100%;
                        border-radius: 3px;
                        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    }

                    /* Compact Form - System Style */
                    .compact-form {
                        display: flex;
                        flex-direction: column;
                        gap: 16px;
                    }

                    .form-row {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 16px;
                    }

                    .form-field {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                    }

                    .form-field label {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 11px;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: #737373;
                        font-weight: 600;
                    }

                    .form-field label i {
                        font-size: 12px;
                        width: 14px;
                    }

                    .form-field input,
                    .form-field select,
                    .form-field textarea {
                        width: 100%;
                        padding: 8px 12px;
                        border: 2px solid #e5e7eb;
                        border-radius: 6px;
                        font-size: 14px;
                        color: #0f172a;
                        background: #fff;
                        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        font-family: inherit;
                    }

                    .form-field input:focus,
                    .form-field select:focus,
                    .form-field textarea:focus {
                        outline: none;
                        border-color: #3b82f6;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                    }

                    .form-field textarea {
                        resize: vertical;
                        min-height: 80px;
                    }

                    /* Modal Actions */
                    .modal-actions {
                        display: flex;
                        gap: 8px;
                        justify-content: flex-end;
                        margin-top: 24px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                    }

                    .modal-actions button {
                        padding: 8px 16px;
                        border: none;
                        border-radius: 6px;
                        font-weight: 500;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }

                    .btn-secondary {
                        background: #f1f5f9;
                        color: #475569;
                        border: 1px solid #e2e8f0;
                    }

                    .btn-secondary:hover {
                        background: #e2e8f0;
                        border-color: #cbd5e1;
                    }

                    .btn-primary {
                        background: #3b82f6;
                        color: white;
                    }

                    .btn-primary:hover {
                        background: #2563eb;
                        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                    }

                    .btn-primary:disabled,
                    .btn-secondary:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }

                    /* RTL Support */
                    @media (max-width: 768px) {
                        .context-cards {
                            grid-template-columns: 1fr;
                        }

                        .form-row {
                            grid-template-columns: 1fr;
                        }
                    }
                </style>
            `;
        }

        /**
         * Setup Edit Task Events
         * הגדרת event listeners למודאל עריכה
         *
         * @param {string} modalId - מזהה המודאל
         * @param {Object} task - נתוני המשימה המקורית
         */
        setupEditTaskEvents(modalId, task) {
            const modal = window.ModalManager.getElement(modalId);
            if (!modal) {
return;
}

            // כפתור ביטול
            const cancelBtn = modal.querySelector('#cancelEditTask');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    window.ModalManager.close(modalId);
                });
            }

            // כפתור שמירה
            const saveBtn = modal.querySelector('#saveEditTask');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    this.saveTaskChanges(modalId, task);
                });
            }
        }

        /**
         * Save Task Changes
         * שמירת שינויים במשימה - עדכון ישיר ל-Firestore + Audit Log
         *
         * @param {string} modalId - מזהה המודאל
         * @param {Object} originalTask - נתוני המשימה המקורית
         */
        async saveTaskChanges(modalId, originalTask) {
            try {
                const modal = window.ModalManager.getElement(modalId);
                if (!modal) {
return;
}

                // קריאת ערכים מהטופס
                const description = modal.querySelector('#taskDescription')?.value.trim();
                const estimatedHours = parseFloat(modal.querySelector('#taskEstimatedHours')?.value || 0);
                const status = modal.querySelector('#taskStatus')?.value;
                const deadline = modal.querySelector('#taskDeadline')?.value || null;
                const lawyer = modal.querySelector('#taskLawyer')?.value.trim() || null;
                const branch = modal.querySelector('#taskBranch')?.value.trim() || null;

                // Validation
                if (!description) {
                    if (window.NotificationsUI) {
                        window.NotificationsUI.showError('תיאור משימה הוא שדה חובה');
                    }
                    return;
                }

                if (estimatedHours < 0) {
                    if (window.NotificationsUI) {
                        window.NotificationsUI.showError('תקציב שעות חייב להיות חיובי');
                    }
                    return;
                }

                // הצגת loading
                const saveBtn = modal.querySelector('#saveEditTask');
                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר...';
                }

                // הכנת אובייקט עדכון
                const updates = {
                    description,
                    estimatedHours,
                    status,
                    deadline,
                    lawyer,
                    branch
                };

                // קריאה ל-Cloud Function (גישה מקצועית עם הרשאות)
                const adminUpdateTask = window.firebaseFunctions.httpsCallable('adminUpdateTask');
                const result = await adminUpdateTask({
                    taskId: originalTask.id,
                    updates: updates
                });

                console.log('✅ Task updated successfully:', result.data);

                // סגירת modal
                window.ModalManager.close(modalId);

                // הצגת הודעת הצלחה
                if (window.NotificationsUI) {
                    window.NotificationsUI.showSuccess('המשימה עודכנה בהצלחה');
                }

                // רענון הנתונים (reload user details)
                await this.loadFullUserData();

            } catch (error) {
                console.error('❌ Error saving task changes:', error);

                // החזרת כפתור למצב רגיל
                const modal = window.ModalManager.getElement(modalId);
                const saveBtn = modal?.querySelector('#saveEditTask');
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i class="fas fa-save"></i> שמור שינויים';
                }

                if (window.NotificationsUI) {
                    window.NotificationsUI.showError('שגיאה בשמירת השינויים. נסה שוב');
                }
            }
        }

        /**
         * Edit Hour Entry
         * עריכת רשומת שעות
         */
        async editHourEntry(entryId) {
            try {
                console.log(`✏️ Opening edit modal for hour entry: ${entryId}`);

                // מצא את הרשומה בנתונים קיימים
                const entry = this.userData.hours.find(h => h.id === entryId);
                if (!entry) {
                    console.error('❌ Hour entry not found:', entryId);
                    if (window.NotificationManager) {
                        window.NotificationManager.error('רשומת שעות לא נמצאה');
                    }
                    return;
                }

                console.log('📝 Hour entry to edit:', entry);

                // יצירת modal עריכה
                const editModalId = 'edit-hour-entry-modal';

                // פורמט תאריך ל-input date
                const dateObj = new Date(entry.date);
                const formattedDateForInput = dateObj.toISOString().split('T')[0];

                const modalHTML = `
                    <div class="modal-header" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 24px; border-radius: 16px 16px 0 0;">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-edit" style="font-size: 20px;"></i>
                            </div>
                            <div>
                                <h2 style="margin: 0; font-size: 24px; font-weight: 700;">עריכת רישום שעות</h2>
                                <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px;">עדכון פרטי רישום שעות</p>
                            </div>
                        </div>
                    </div>

                    <div class="modal-body" style="padding: 32px; background: white; direction: rtl;">
                        <form id="edit-hour-form" style="display: flex; flex-direction: column; gap: 24px;">

                            <!-- תאריך -->
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <label style="font-weight: 600; font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-calendar" style="color: #3b82f6;"></i>
                                    תאריך
                                </label>
                                <input
                                    type="date"
                                    id="edit-hour-date"
                                    value="${formattedDateForInput}"
                                    style="padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; transition: all 0.2s;"
                                    required
                                />
                            </div>

                            <!-- שעות -->
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <label style="font-weight: 600; font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-clock" style="color: #10b981;"></i>
                                    שעות
                                </label>
                                <input
                                    type="number"
                                    id="edit-hour-hours"
                                    value="${(entry.hours || 0).toFixed(2)}"
                                    step="0.25"
                                    min="0.25"
                                    max="24"
                                    style="padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;"
                                    required
                                />
                            </div>

                            <!-- תיאור משימה -->
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <label style="font-weight: 600; font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-tasks" style="color: #f59e0b;"></i>
                                    תיאור משימה/פעולה
                                </label>
                                <input
                                    type="text"
                                    id="edit-hour-description"
                                    value="${this.escapeHtml(entry.taskDescription || entry.action || '')}"
                                    placeholder="תיאור המשימה או הפעולה..."
                                    style="padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;"
                                    required
                                />
                            </div>

                            <!-- שם לקוח (אם קיים) -->
                            ${entry.clientId ? `
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    <label style="font-weight: 600; font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px;">
                                        <i class="fas fa-user" style="color: #8b5cf6;"></i>
                                        לקוח
                                    </label>
                                    <input
                                        type="text"
                                        value="${this.escapeHtml(entry.clientName || '')}"
                                        disabled
                                        style="padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; background: #f9fafb; color: #6b7280;"
                                    />
                                    <small style="color: #6b7280; font-size: 12px;">לא ניתן לשנות את הלקוח</small>
                                </div>
                            ` : ''}

                            <!-- חיוב -->
                            <div style="display: flex; align-items: center; gap: 12px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 2px solid #e5e7eb;">
                                <input
                                    type="checkbox"
                                    id="edit-hour-billable"
                                    ${entry.billable ? 'checked' : ''}
                                    style="width: 20px; height: 20px; cursor: pointer;"
                                />
                                <label for="edit-hour-billable" style="font-weight: 600; font-size: 14px; color: #374151; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-dollar-sign" style="color: #10b981;"></i>
                                    חייב ללקוח
                                </label>
                            </div>

                            <!-- הערות -->
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <label style="font-weight: 600; font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px;">
                                    <i class="fas fa-sticky-note" style="color: #6366f1;"></i>
                                    הערות
                                </label>
                                <textarea
                                    id="edit-hour-notes"
                                    rows="3"
                                    placeholder="הערות נוספות (אופציונלי)..."
                                    style="padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; resize: vertical; font-family: inherit;"
                                >${this.escapeHtml(entry.notes || '')}</textarea>
                            </div>

                        </form>
                    </div>

                    <div class="modal-footer" style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end; border-radius: 0 0 16px 16px;">
                        <button
                            type="button"
                            id="cancel-edit-hour-btn"
                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; color: #6b7280; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s;"
                        >
                            <i class="fas fa-times"></i>
                            <span>ביטול</span>
                        </button>
                        <button
                            type="submit"
                            form="edit-hour-form"
                            id="save-edit-hour-btn"
                            style="padding: 12px 24px; border: none; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: all 0.2s;"
                        >
                            <i class="fas fa-save"></i>
                            <span>שמור שינויים</span>
                        </button>
                    </div>
                `;

                // יצירת והצגת המודאל (create פותח אוטומטית)
                window.ModalManager.create({
                    title: 'עריכת רישום שעות',
                    content: modalHTML,
                    size: 'medium',
                    closeOnBackdrop: false
                });

                // המתנה קצרה לוודא שהמודאל נוסף ל-DOM
                setTimeout(() => {
                    // הגדרת event listeners
                    const cancelBtn = document.getElementById('cancel-edit-hour-btn');
                    const form = document.getElementById('edit-hour-form');

                    if (!cancelBtn || !form) {
                        console.error('❌ Modal elements not found in DOM');
                        return;
                    }

                    cancelBtn.addEventListener('click', () => {
                        window.ModalManager.closeAll();
                    });

                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();

                        // איסוף נתונים מהטופס
                        const updatedData = {
                            date: document.getElementById('edit-hour-date').value,
                            hours: parseFloat(document.getElementById('edit-hour-hours').value),
                            taskDescription: document.getElementById('edit-hour-description').value,
                            billable: document.getElementById('edit-hour-billable').checked,
                            notes: document.getElementById('edit-hour-notes').value
                        };

                        console.log('💾 Saving updated hour entry:', updatedData);

                        // הצגת loading
                        const saveBtn = document.getElementById('save-edit-hour-btn');
                        if (saveBtn) {
                            saveBtn.disabled = true;
                            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>שומר...</span>';
                        }

                        try {
                            // קריאה ל-Cloud Function
                            const adminUpdateTimesheetEntry = window.firebaseFunctions.httpsCallable('adminUpdateTimesheetEntry');

                            const result = await adminUpdateTimesheetEntry({
                                entryId: entry.id,
                                updates: updatedData
                            });

                            console.log('✅ Entry updated successfully:', result.data);

                            // סגירת המודאל
                            window.ModalManager.closeAll();

                            // הצגת הודעת הצלחה
                            if (window.notify) {
                                window.notify.success('רשומת השעות עודכנה בהצלחה');
                            }

                            // רענון נתוני המשתמש
                            await this.loadFullUserData();

                        } catch (error) {
                            console.error('❌ Error updating timesheet entry:', error);

                            // החזרת כפתור למצב רגיל
                            if (saveBtn) {
                                saveBtn.disabled = false;
                                saveBtn.innerHTML = '<i class="fas fa-save"></i> <span>שמור שינויים</span>';
                            }

                            if (window.notify) {
                                window.notify.error('שגיאה בעדכון רשומת השעות. נסה שוב');
                            }
                        }
                    });
                }, 100);

            } catch (error) {
                console.error('❌ Error opening edit hour modal:', error);
                if (window.NotificationManager) {
                    window.NotificationManager.error('שגיאה בפתיחת עריכת רשומה');
                }
            }
        }

        /**
         * Delete Hour Entry
         * מחיקת רשומת שעות
         */
        async deleteHourEntry(entryId) {
            try {
                console.log(`🗑️ Deleting hour entry: ${entryId}`);

                // מצא את הרשומה בנתונים קיימים
                const entry = this.userData.hours.find(h => h.id === entryId);
                if (!entry) {
                    console.error('❌ Hour entry not found:', entryId);
                    if (window.NotificationManager) {
                        window.NotificationManager.error('רשומת שעות לא נמצאה');
                    }
                    return;
                }

                // הצג דיאלוג אישור
                if (window.NotificationManager) {
                    window.NotificationManager.confirm(
                        `האם למחוק רשומה זו?\n\nתיאור: ${entry.taskDescription || entry.action || 'ללא תיאור'}\nשעות: ${(entry.hours || 0).toFixed(2)}\nתאריך: ${new Date(entry.date).toLocaleDateString('he-IL')}`,
                        async () => {
                            // אושר - ביצוע מחיקה
                            console.log('✅ Delete confirmed for entry:', entryId);

                            // TODO: להשלים בהמשך - קריאה ל-Cloud Function למחיקה
                            // בינתיים - הודעה
                            if (window.NotificationManager) {
                                window.NotificationManager.warning('פונקציונליות מחיקה תיושם בקרוב');
                            }
                        },
                        () => {
                            // בוטל
                            console.log('❌ Delete cancelled');
                        },
                        {
                            title: 'אישור מחיקה',
                            confirmText: 'מחק',
                            cancelText: 'ביטול',
                            type: 'warning'
                        }
                    );
                }

            } catch (error) {
                console.error('❌ Error deleting hour entry:', error);
                if (window.NotificationManager) {
                    window.NotificationManager.error('שגיאה במחיקת רשומה');
                }
            }
        }

        /**
         * Close modal
         * סגירת המודאל
         */
        close() {
            if (this.modalId) {
                window.ModalManager.close(this.modalId);
                this.modalId = null;
            }

            this.currentUser = null;
            this.userData = null;
            this.activeTab = 'general';

            console.log('✅ UserDetailsModal closed');
        }

        /**
         * Open Tasks Slide-in Panel
         * פתיחת פאנל הזזה עם כל המשימות
         */
        openTasksPanel() {
            const allTasks = this.userData?.tasks || [];

            // Filter by sub-tab
            const filteredByStatus = this.filterTasksBySubTab(allTasks, this.tasksPanelSubTab);
            const activeCount = this.filterTasksBySubTab(allTasks, 'active').length;
            const completedCount = this.filterTasksBySubTab(allTasks, 'completed').length;

            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'tasks-panel-overlay';
            overlay.id = 'tasksPanelOverlay';

            // Create panel
            const panel = document.createElement('div');
            panel.className = 'tasks-slide-in-panel';
            panel.id = 'tasksSlideInPanel';

            // Panel HTML
            panel.innerHTML = `
                <div class="tasks-panel-header">
                    <div class="tasks-panel-title-row">
                        <h3>כל המשימות של ${this.escapeHtml(this.userData.displayName || this.userData.email)}</h3>
                        <span class="tasks-count-badge" id="tasksPanelCount">${filteredByStatus.length} משימות</span>
                    </div>
                    <button class="tasks-panel-close" id="tasksPanelClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="tasks-panel-search">
                    <i class="fas fa-search"></i>
                    <input
                        type="text"
                        id="tasksPanelSearch"
                        placeholder="חפש משימה..."
                        autocomplete="off"
                    >
                </div>

                <div style="display: flex; gap: 0; border-bottom: 2px solid #e2e8f0; margin: 0 20px 16px 20px;">
                    <button class="tasks-panel-sub-tab ${this.tasksPanelSubTab === 'active' ? 'active' : ''}" data-panel-sub-tab="active"
                        style="padding: 10px 20px; font-size: 14px; font-weight: 600; border: none; background: none; cursor: pointer; color: ${this.tasksPanelSubTab === 'active' ? '#1e293b' : '#94a3b8'}; border-bottom: 2px solid ${this.tasksPanelSubTab === 'active' ? '#3b82f6' : 'transparent'}; margin-bottom: -2px; transition: all 0.2s;">
                        פעיל <span style="font-weight: 400; color: ${this.tasksPanelSubTab === 'active' ? '#64748b' : '#cbd5e1'};">(${activeCount})</span>
                    </button>
                    <button class="tasks-panel-sub-tab ${this.tasksPanelSubTab === 'completed' ? 'active' : ''}" data-panel-sub-tab="completed"
                        style="padding: 10px 20px; font-size: 14px; font-weight: 600; border: none; background: none; cursor: pointer; color: ${this.tasksPanelSubTab === 'completed' ? '#1e293b' : '#94a3b8'}; border-bottom: 2px solid ${this.tasksPanelSubTab === 'completed' ? '#3b82f6' : 'transparent'}; margin-bottom: -2px; transition: all 0.2s;">
                        הושלם <span style="font-weight: 400; color: ${this.tasksPanelSubTab === 'completed' ? '#64748b' : '#cbd5e1'};">(${completedCount})</span>
                    </button>
                </div>

                <div class="tasks-panel-body">
                    <div class="tasks-panel-grid" id="tasksPanelGrid">
                        ${filteredByStatus.map(task => this.renderTaskCard(task)).join('')}
                    </div>
                </div>
            `;

            // Append to body
            document.body.appendChild(overlay);
            document.body.appendChild(panel);

            // Trigger animation
            requestAnimationFrame(() => {
                overlay.classList.add('active');
                panel.classList.add('active');
            });

            // Setup close handlers
            const closeBtn = document.getElementById('tasksPanelClose');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.closeTasksPanel();
                });
            }

            // Close on overlay click
            overlay.addEventListener('click', () => {
                this.closeTasksPanel();
            });

            // Close on ESC key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.closeTasksPanel();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);

            // Setup search
            const searchInput = document.getElementById('tasksPanelSearch');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.filterTasksInPanel(e.target.value);
                });

                // Focus on search input
                setTimeout(() => searchInput.focus(), 100);
            }

            // Sub-tab buttons in panel
            const panelSubTabs = panel.querySelectorAll('.tasks-panel-sub-tab');
            panelSubTabs.forEach(btn => {
                btn.addEventListener('click', () => {
                    const subTab = btn.getAttribute('data-panel-sub-tab');
                    this.tasksPanelSubTab = subTab;
                    // Update active class on sub-tab buttons
                    panel.querySelectorAll('.tasks-panel-sub-tab').forEach(b => {
                        b.classList.toggle('active', b.dataset.panelSubTab === subTab);
                        b.style.color = b.dataset.panelSubTab === subTab ? '#1e293b' : '#94a3b8';
                        b.style.borderBottom = b.dataset.panelSubTab === subTab ? '2px solid #3b82f6' : '2px solid transparent';
                    });
                    // Re-filter and render grid
                    this.filterTasksInPanel(
                        document.getElementById('tasksPanelSearch')?.value || ''
                    );
                    // Update badge count
                    const filteredTasks = this.getFilteredPanelTasks();
                    const badge = panel.querySelector('.tasks-count-badge');
                    if (badge) {
badge.textContent = `${filteredTasks.length} משימות`;
}
                });
            });

            // ========== EVENT DELEGATION FOR TASK BUTTONS IN PANEL ==========
            // Same functionality as in regular tasks tab
            const panelGrid = document.getElementById('tasksPanelGrid');
            if (panelGrid) {
                panelGrid.addEventListener('click', (e) => {
                    const editBtn = e.target.closest('.btn-edit-task');
                    const deleteBtn = e.target.closest('.btn-delete-task');

                    if (editBtn) {
                        const taskId = editBtn.getAttribute('data-task-id');
                        this.closeTasksPanel();
                        setTimeout(() => this.editTask(taskId), 450);
                    }

                    if (deleteBtn) {
                        const taskId = deleteBtn.getAttribute('data-task-id');
                        // Note: deleteTask functionality would go here if it exists
                        alert('פונקציית מחיקה טרם מוכנה');
                    }
                });
            }
        }

        /**
         * Filter tasks by sub-tab status
         * סינון משימות לפי סטטוס sub-tab
         */
        filterTasksBySubTab(tasks, subTab) {
            if (subTab === 'completed') {
                return tasks.filter(t => t.status === 'הושלם' || t.status === 'completed' || t.status === 'הושלמה');
            }
            return tasks.filter(t => t.status === 'פעיל' || t.status === 'active' || t.status === 'פעילה' || t.status === 'בהמתנה' || t.status === 'pending');
        }

        /**
         * Get filtered panel tasks by current sub-tab
         * קבלת משימות מסוננות לפי sub-tab נוכחי
         */
        getFilteredPanelTasks() {
            const tasks = this.userData?.tasks || [];
            return this.filterTasksBySubTab(tasks, this.tasksPanelSubTab);
        }

        /**
         * Close Tasks Panel
         * סגירת פאנל משימות
         */
        closeTasksPanel() {
            const overlay = document.getElementById('tasksPanelOverlay');
            const panel = document.getElementById('tasksSlideInPanel');

            if (overlay) {
                overlay.classList.remove('active');
            }

            if (panel) {
                panel.classList.remove('active');
            }

            // Remove elements after animation
            setTimeout(() => {
                if (overlay) {
overlay.remove();
}
                if (panel) {
panel.remove();
}
            }, 400);
        }

        /**
         * Open Hours Panel
         * פתיחת פאנל שעות - slide-in מהצד
         */
        openHoursPanel() {
            const hours = this.userData?.hours || [];
            const filteredHours = this.filterAndSortHours(hours);

            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'tasks-panel-overlay';
            overlay.id = 'hoursPanelOverlay';

            // Create panel
            const panel = document.createElement('div');
            panel.className = 'tasks-slide-in-panel';
            panel.id = 'hoursSlideInPanel';

            // Panel HTML
            panel.innerHTML = `
                <div class="tasks-panel-header">
                    <div class="tasks-panel-title-row">
                        <h3>כל רשומות השעות של ${this.escapeHtml(this.userData.displayName || this.userData.email)}</h3>
                        <span class="tasks-count-badge">${filteredHours.length} רשומות</span>
                    </div>
                    <button class="tasks-panel-close" id="hoursPanelClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="tasks-panel-search">
                    <i class="fas fa-search"></i>
                    <input
                        type="text"
                        id="hoursPanelSearch"
                        placeholder="חפש רשומת שעות..."
                        autocomplete="off"
                    >
                </div>

                <div class="tasks-panel-body">
                    <div class="tasks-panel-grid" id="hoursPanelGrid">
                        ${filteredHours.map(entry => this.renderHoursCard(entry)).join('')}
                    </div>
                </div>
            `;

            // Append to body
            document.body.appendChild(overlay);
            document.body.appendChild(panel);

            // Trigger animation
            requestAnimationFrame(() => {
                overlay.classList.add('active');
                panel.classList.add('active');
            });

            // Setup close handlers
            const closeBtn = document.getElementById('hoursPanelClose');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.closeHoursPanel();
                });
            }

            // Close on overlay click
            overlay.addEventListener('click', () => {
                this.closeHoursPanel();
            });

            // Close on ESC key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.closeHoursPanel();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);

            // Setup search
            const searchInput = document.getElementById('hoursPanelSearch');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.filterHoursInPanel(e.target.value);
                });

                // Focus on search input
                setTimeout(() => searchInput.focus(), 100);
            }

            // ========== EVENT DELEGATION FOR HOUR BUTTONS IN PANEL ==========
            const hoursPanelGrid = document.getElementById('hoursPanelGrid');
            if (hoursPanelGrid) {
                hoursPanelGrid.addEventListener('click', (e) => {
                    const editBtn = e.target.closest('.btn-edit-hour');
                    const deleteBtn = e.target.closest('.btn-delete-hour');

                    if (editBtn) {
                        const entryId = editBtn.getAttribute('data-entry-id');
                        this.editHourEntry(entryId);
                    }

                    if (deleteBtn) {
                        const entryId = deleteBtn.getAttribute('data-entry-id');
                        this.deleteHourEntry(entryId);
                    }
                });
            }
        }

        /**
         * Close Hours Panel
         * סגירת פאנל שעות
         */
        closeHoursPanel() {
            const overlay = document.getElementById('hoursPanelOverlay');
            const panel = document.getElementById('hoursSlideInPanel');

            if (overlay) {
                overlay.classList.remove('active');
            }

            if (panel) {
                panel.classList.remove('active');
            }

            // Remove from DOM after animation
            setTimeout(() => {
                if (overlay && overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
                if (panel && panel.parentNode) {
                    panel.parentNode.removeChild(panel);
                }
            }, 400);
        }

        /**
         * Filter Hours in Panel (Search)
         * סינון שעות בפאנל
         */
        filterHoursInPanel(searchText) {
            const hours = this.userData?.hours || [];
            const filteredHours = this.filterAndSortHours(hours);

            const lowerSearch = searchText.toLowerCase();
            const filtered = filteredHours.filter(entry => {
                return (
                    (entry.clientName && entry.clientName.toLowerCase().includes(lowerSearch)) ||
                    (entry.description && entry.description.toLowerCase().includes(lowerSearch)) ||
                    (entry.taskTitle && entry.taskTitle.toLowerCase().includes(lowerSearch))
                );
            });

            const grid = document.getElementById('hoursPanelGrid');
            if (grid) {
                if (filtered.length === 0) {
                    grid.innerHTML = '<p class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #9ca3af;">לא נמצאו תוצאות</p>';
                } else {
                    grid.innerHTML = filtered.map(entry => this.renderHoursCard(entry)).join('');
                }
            }
        }

        /**
         * Filter Tasks in Panel
         * סינון משימות בפאנל
         */
        filterTasksInPanel(searchText) {
            const statusFiltered = this.getFilteredPanelTasks();
            const grid = document.getElementById('tasksPanelGrid');
            const countBadge = document.getElementById('tasksPanelCount');

            if (!grid) {
return;
}

            // Then filter by search text
            const filteredTasks = statusFiltered.filter(task => {
                if (!searchText) {
return true;
}
                const searchLower = searchText.toLowerCase();

                if (task.description?.toLowerCase().includes(searchLower)) {
return true;
}
                if (task.serviceName?.toLowerCase().includes(searchLower)) {
return true;
}
                if (task.clientName?.toLowerCase().includes(searchLower)) {
return true;
}
                if (task.status?.toLowerCase().includes(searchLower)) {
return true;
}

                return false;
            });

            // Update badge count
            if (countBadge) {
                countBadge.textContent = `${filteredTasks.length} משימות`;
            }

            // Update grid
            if (filteredTasks.length > 0) {
                grid.innerHTML = filteredTasks.map(task => this.renderTaskCard(task)).join('');
            } else {
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--gray-500);">
                        <i class="fas fa-search" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
                        <p style="font-size: var(--text-lg); font-weight: var(--font-medium);">לא נמצאו משימות</p>
                        <p style="font-size: var(--text-sm); margin-top: 8px;">נסה לחפש משהו אחר</p>
                    </div>
                `;
            }
        }

        /**
         * Open Performance Panel
         * פתיחת פאנל ביצועים - slide-in מהצד
         */
        openPerformancePanel() {
            // Initialize selected date if not set
            if (!this.selectedPerformanceDate) {
                this.selectedPerformanceDate = new Date().toISOString().split('T')[0];
            }

            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'tasks-panel-overlay';
            overlay.id = 'performancePanelOverlay';

            // Create slide-in panel
            const panel = document.createElement('div');
            panel.className = 'tasks-slide-in-panel';
            panel.id = 'performanceSlideInPanel';
            panel.innerHTML = `
                <div class="tasks-panel-header">
                    <div class="tasks-panel-title-row">
                        <h3>ביצועים יומיים - ${this.formatHebrewDate(this.selectedPerformanceDate)}</h3>
                    </div>
                    <button class="tasks-panel-close" id="performancePanelClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="tasks-panel-body" id="performancePanelContent">
                    <div class="performance-container">
                        ${this.renderDateSelector()}
                        ${this.renderDailySummary()}
                        ${this.renderPerformanceCharts()}
                        ${this.renderDailyHoursBreakdown()}
                        ${this.renderCompletedTasks()}
                    </div>
                </div>
            `;

            // Append to body
            document.body.appendChild(overlay);
            document.body.appendChild(panel);

            // Animate panel in
            requestAnimationFrame(() => {
                overlay.classList.add('active');
                panel.classList.add('active');
            });

            // Setup close handlers
            const closeBtn = document.getElementById('performancePanelClose');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.closePerformancePanel();
                });
            }

            // Close on overlay click
            overlay.addEventListener('click', () => {
                this.closePerformancePanel();
            });

            // Close on ESC key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.closePerformancePanel();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);

            // Re-attach performance event listeners
            setTimeout(() => {
                this.attachPerformanceEventListeners();
            }, 100);
        }

        /**
         * Close Performance Panel
         * סגירת פאנל ביצועים
         */
        closePerformancePanel() {
            const overlay = document.getElementById('performancePanelOverlay');
            const panel = document.getElementById('performanceSlideInPanel');

            if (panel && overlay) {
                panel.style.transform = 'translateX(100%)';
                overlay.style.opacity = '0';

                setTimeout(() => {
                    panel.remove();
                    overlay.remove();
                }, 300);
            }
        }

        /* ============================================
           EMPLOYEE REPORT SECTION
           הפקת דוח עובד חודשי
           ============================================ */

        /**
         * Open report parameters panel
         * פתיחת פאנל בחירת פרמטרים לדוח
         */
        openReportPanel() {
            if (document.getElementById('reportSlideInPanel')) {
                return; // Already open
            }

            const user = this.userData || this.currentUser;
            if (!user) {
                return;
            }

            const now = new Date();
            // Default to previous month (more common use case for reports)
            let defaultMonth = now.getMonth(); // 0-based, so this is previous month
            let defaultYear = now.getFullYear();
            if (defaultMonth === 0) {
                defaultMonth = 12;
                defaultYear--;
            }

            // Build month options
            const months = [
                'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
                'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
            ];
            const monthOptions = months.map((name, i) => {
                const m = i + 1;
                const selected = m === defaultMonth ? 'selected' : '';
                return `<option value="${m}" ${selected}>${name}</option>`;
            }).join('');

            // Build year options (last 2 years)
            const yearOptions = [defaultYear, defaultYear - 1].map(y => {
                const selected = y === defaultYear ? 'selected' : '';
                return `<option value="${y}" ${selected}>${y}</option>`;
            }).join('');

            // Create compact modal overlay
            const overlay = document.createElement('div');
            overlay.id = 'reportPanelOverlay';
            Object.assign(overlay.style, {
                position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
                background: 'rgba(0,0,0,0.4)', zIndex: '10500',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: '0', transition: 'opacity 0.2s ease'
            });

            // Compact dialog
            const dialog = document.createElement('div');
            dialog.id = 'reportSlideInPanel';
            Object.assign(dialog.style, {
                background: 'white', borderRadius: '14px', padding: '24px',
                width: '360px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                transform: 'scale(0.95)', transition: 'transform 0.2s ease',
                direction: 'rtl'
            });

            dialog.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px;">
                    <h3 style="font-size: 16px; font-weight: 700; color: #1f2937; margin: 0;">
                        <i class="fas fa-file-alt" style="color: #3b82f6; margin-left: 6px;"></i>
                        הפקת דוח — ${this.escapeHtml(user.displayName || user.email)}
                    </h3>
                    <button id="reportPanelClose" style="background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 18px; padding: 4px;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div style="display: flex; gap: 8px; margin-bottom: 14px;">
                    <select id="reportMonth" style="flex: 1; padding: 9px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: white;">
                        ${monthOptions}
                    </select>
                    <select id="reportYear" style="width: 90px; padding: 9px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: white;">
                        ${yearOptions}
                    </select>
                </div>

                <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                    <label id="reportFormatHtml" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border: 2px solid #3b82f6; border-radius: 8px; cursor: pointer; background: #eff6ff; font-size: 13px; font-weight: 500;">
                        <input type="radio" name="reportFormat" value="html" checked style="display: none;">
                        <i class="fas fa-print" style="color: #3b82f6;"></i> הדפסה
                    </label>
                    <label id="reportFormatCsv" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border: 2px solid #d1d5db; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: #6b7280;">
                        <input type="radio" name="reportFormat" value="csv" style="display: none;">
                        <i class="fas fa-file-csv" style="color: #10b981;"></i> CSV
                    </label>
                </div>

                <button id="reportGenerateBtn" type="button" style="
                    width: 100%; padding: 11px; background: #3b82f6; color: white;
                    border: none; border-radius: 9px; font-size: 15px; font-weight: 600;
                    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
                ">
                    <i class="fas fa-file-alt"></i> הפק דוח
                </button>

                <div id="reportStatusMessage" style="margin-top: 12px; text-align: center; font-size: 13px; display: none;"></div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                dialog.style.transform = 'scale(1)';
            });

            // Radio toggle styling
            const htmlLabel = dialog.querySelector('#reportFormatHtml');
            const csvLabel = dialog.querySelector('#reportFormatCsv');
            dialog.querySelectorAll('input[name="reportFormat"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    if (radio.value === 'html') {
                        htmlLabel.style.borderColor = '#3b82f6';
                        htmlLabel.style.background = '#eff6ff';
                        htmlLabel.style.color = '';
                        csvLabel.style.borderColor = '#d1d5db';
                        csvLabel.style.background = '';
                        csvLabel.style.color = '#6b7280';
                    } else {
                        csvLabel.style.borderColor = '#10b981';
                        csvLabel.style.background = '#ecfdf5';
                        csvLabel.style.color = '';
                        htmlLabel.style.borderColor = '#d1d5db';
                        htmlLabel.style.background = '';
                        htmlLabel.style.color = '#6b7280';
                    }
                });
            });

            // Generate button
            dialog.querySelector('#reportGenerateBtn').addEventListener('click', () => {
                this.executeReportGeneration();
            });

            // Close handlers
            dialog.querySelector('#reportPanelClose').addEventListener('click', () => this.closeReportPanel());
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeReportPanel();
                }
            });

            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.closeReportPanel();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }

        /**
         * Close report panel
         * סגירת פאנל דוח
         */
        closeReportPanel() {
            const overlay = document.getElementById('reportPanelOverlay');
            if (overlay) {
                overlay.style.opacity = '0';
                const dialog = overlay.querySelector('#reportSlideInPanel');
                if (dialog) {
                    dialog.style.transform = 'scale(0.95)';
                }
                setTimeout(() => overlay.remove(), 200);
            }
        }

        /**
         * Execute report generation
         * ביצוע הפקת הדוח — query, חישוב, הפקה
         */
        async executeReportGeneration() {
            const user = this.userData || this.currentUser;
            if (!user) {
                return;
            }

            const monthSelect = document.getElementById('reportMonth');
            const yearSelect = document.getElementById('reportYear');
            const formatRadio = document.querySelector('input[name="reportFormat"]:checked');
            const generateBtn = document.getElementById('reportGenerateBtn');
            const statusMsg = document.getElementById('reportStatusMessage');

            if (!monthSelect || !yearSelect || !formatRadio) {
                return;
            }

            const month = parseInt(monthSelect.value);
            const year = parseInt(yearSelect.value);
            const format = formatRadio.value;

            // Loading state
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> מפיק דוח...';
            statusMsg.style.display = 'none';

            try {
                // Fresh query — independent from modal data
                const db = window.firebaseDB;
                const userEmail = user.email;

                const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
                const lastDay = new Date(year, month, 0).getDate();
                const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`;

                console.log(`📄 Report: Querying timesheet for ${userEmail}, ${year}-${String(month).padStart(2, '0')}`);

                const snapshot = await db.collection('timesheet_entries')
                    .where('employee', '==', userEmail)
                    .where('date', '>=', startOfMonth)
                    .where('date', '<=', endOfMonth)
                    .orderBy('date', 'desc')
                    .get();

                const entries = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        hours: data.hours ?? (data.minutes ? data.minutes / 60 : 0)
                    };
                });

                console.log(`📄 Report: Found ${entries.length} entries`);

                if (entries.length === 0) {
                    statusMsg.style.display = 'block';
                    statusMsg.innerHTML = '<span style="color: #f59e0b;"><i class="fas fa-exclamation-triangle"></i> אין רשומות שעתון בחודש זה</span>';
                    generateBtn.disabled = false;
                    generateBtn.innerHTML = '<i class="fas fa-file-alt"></i> הפק דוח';
                    return;
                }

                // Calculate stats
                const reportData = this.calculateReportData(user, entries, month, year);

                // Generate report
                if (format === 'html') {
                    window.ReportGenerator.generateEmployeeHTML(reportData);
                } else {
                    window.ReportGenerator.generateEmployeeCSV(reportData);
                }

                statusMsg.style.display = 'block';
                statusMsg.innerHTML = '<span style="color: #10b981;"><i class="fas fa-check-circle"></i> הדוח הופק בהצלחה</span>';

            } catch (error) {
                console.error('❌ Report generation failed:', error);
                statusMsg.style.display = 'block';
                statusMsg.innerHTML = '<span style="color: #ef4444;"><i class="fas fa-exclamation-circle"></i> לא ניתן להפיק את הדוח</span>';
            } finally {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fas fa-file-alt"></i> הפק דוח';
            }
        }

        /**
         * Calculate report data from entries
         * חישוב נתוני הדוח מהרשומות
         */
        calculateReportData(user, entries, month, year) {
            const months = [
                'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
                'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
            ];

            // Split entries
            const clientEntries = entries.filter(e => !e.isInternal);
            const internalEntries = entries.filter(e => e.isInternal);

            // Totals (calculate from minutes for precision)
            const totalMinutes = entries.reduce((sum, e) => sum + (e.minutes || 0), 0);
            const clientMinutes = clientEntries.reduce((sum, e) => sum + (e.minutes || 0), 0);
            const internalMinutes = internalEntries.reduce((sum, e) => sum + (e.minutes || 0), 0);

            // Working days (unique dates with entries)
            const workingDays = new Set(entries.map(e => (e.date || '').substring(0, 10))).size;

            // PR-G.2: daily target via centralized helper
            const dailyTarget = window.WORK_HOURS_CONSTANTS
                ? window.WORK_HOURS_CONSTANTS.getEmployeeDailyTarget(user)
                : (user.dailyHoursTarget || 8.45);
            const totalHours = totalMinutes / 60;
            const monthlyTarget = workingDays * dailyTarget;
            const quotaPercent = monthlyTarget > 0 ? Math.round((totalHours / monthlyTarget) * 100) : 0;
            const dailyAverage = workingDays > 0 ? totalHours / workingDays : 0;

            // Client breakdown
            const clientBreakdown = {};
            clientEntries.forEach(e => {
                const name = e.clientName || 'לא ידוע';
                if (!clientBreakdown[name]) {
                    clientBreakdown[name] = { minutes: 0, count: 0 };
                }
                clientBreakdown[name].minutes += (e.minutes || 0);
                clientBreakdown[name].count++;
            });

            // Sort by hours descending
            const clientBreakdownSorted = Object.entries(clientBreakdown)
                .map(([name, data]) => ({
                    name,
                    minutes: data.minutes,
                    hours: data.minutes / 60,
                    count: data.count,
                    percent: clientMinutes > 0 ? Math.round((data.minutes / clientMinutes) * 100) : 0
                }))
                .sort((a, b) => b.minutes - a.minutes);

            return {
                employee: {
                    name: user.displayName || user.email,
                    email: user.email,
                    role: user.role || '',
                    dailyTarget
                },
                period: {
                    month,
                    year,
                    monthName: months[month - 1],
                    label: `${months[month - 1]} ${year}`
                },
                summary: {
                    totalMinutes,
                    totalHours: Math.round(totalHours * 100) / 100,
                    clientMinutes,
                    clientHours: Math.round((clientMinutes / 60) * 100) / 100,
                    internalMinutes,
                    internalHours: Math.round((internalMinutes / 60) * 100) / 100,
                    workingDays,
                    dailyAverage: Math.round(dailyAverage * 100) / 100,
                    quotaPercent,
                    totalEntries: entries.length,
                    clientEntries: clientEntries.length,
                    internalEntries: internalEntries.length
                },
                clientBreakdown: clientBreakdownSorted,
                entries: {
                    client: clientEntries,
                    internal: internalEntries
                },
                generatedAt: new Date()
            };
        }

        /**
         * Format date to Hebrew
         * פורמט תאריך לעברית
         */
        formatHebrewDate(dateString) {
            const date = new Date(dateString);
            const options = {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            };
            return date.toLocaleDateString('he-IL', options);
        }
    }

    // Create global instance
    const userDetailsModal = new UserDetailsModal();

    // Make UserDetailsModal available globally (both lowercase and uppercase for compatibility)
    window.userDetailsModal = userDetailsModal;  // ✅ Lowercase (used in debug script)
    window.UserDetailsModal = userDetailsModal;  // ✅ Uppercase (for backwards compatibility)

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = userDetailsModal;
    }

    console.log('✅ UserDetailsModal initialized and available globally');

})();
