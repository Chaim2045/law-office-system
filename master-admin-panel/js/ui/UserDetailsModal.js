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

            // Messages tab state
            this.messageFilter = 'all'; // all / unread / read / archived
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
                    messages: [], // ✅ תיקון: הוספת messages
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

                // Show info notification
                window.notify.info(
                    'מוצגים נתונים בסיסיים. Cloud Functions יהיו זמינים ב-Phase 4',
                    'מצב פיתוח'
                );
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
                messages: responseData.messages || [], // ✅ תיקון: הוספת messages
                stats: responseData.stats || {},
                clientsCount: responseData.stats?.totalClients || 0,
                tasksCount: responseData.stats?.activeTasks || 0,
                hoursThisWeek: responseData.stats?.hoursThisWeek || 0,
                hoursThisMonth: responseData.stats?.hoursThisMonth || 0,
                hoursPreFiltered: true  // ✅ סימון שהנתונים כבר מסוננים מהשרת
            };
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
            const [clientsSnapshot, tasksSnapshot, timesheetSnapshot, activitySnapshot, messagesSnapshot] = await Promise.all([
                // Get user's clients (limit to recent 50)
                db.collection('cases')
                    .where('assignedTo', 'array-contains', userEmail)
                    .orderBy('createdAt', 'desc')
                    .limit(50)
                    .get()
                    .catch(() => ({ docs: [] })),

                // Get user's tasks (active only)
                db.collection('tasks')
                    .where('assignedTo', '==', userEmail)
                    .where('status', '!=', 'completed')
                    .limit(50)
                    .get()
                    .catch(() => ({ docs: [] })),

                // Get timesheet entries for selected month/year
                (() => {
                    // ✅ סינון לפי חודש ושנה נבחרים
                    const startOfMonth = new Date(this.selectedYear, this.selectedMonth - 1, 1);
                    const endOfMonth = new Date(this.selectedYear, this.selectedMonth, 0, 23, 59, 59);

                    // ✅ FIX: שימוש בקולקציה timesheet_entries במקום timesheet
                    // ✅ FIX: שימוש בשדה employee במקום employeeEmail
                    return db.collection('timesheet_entries')
                        .where('employee', '==', userEmail)
                        .where('date', '>=', startOfMonth.toISOString().split('T')[0])
                        .where('date', '<=', endOfMonth.toISOString().split('T')[0])
                        .orderBy('date', 'desc')
                        .get()
                        .catch(() => ({ docs: [] }));
                })(),

                // Get user's activity logs (last 100 entries)
                db.collection('activityLogs')
                    .where('userId', '==', userId)
                    .orderBy('timestamp', 'desc')
                    .limit(100)
                    .get()
                    .catch(() => ({ docs: [] })),

                // Get admin messages sent to this user (last 100)
                // ✅ סינון: רק הודעות שהמנהל שלח ידנית (לא הודעות מערכת)
                db.collection('user_messages')
                    .where('to', '==', userEmail)
                    .where('from', '!=', 'system')
                    .orderBy('createdAt', 'desc')
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

            // Process messages
            const messages = messagesSnapshot.docs.map(doc => ({
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
                messages,
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

            console.log(`✅ Loaded user data: ${clients.length} clients, ${tasks.length} tasks, ${timesheet.length} timesheet entries, ${activity.length} activity logs, ${messages.length} messages`);
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
                        ${this.renderTabButton('messages', 'fas fa-envelope', 'הודעות')}
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
                case 'messages':
                    return this.renderMessagesTab();
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
                                ${this.renderInfoRow('כניסה אחרונה', this.formatDate(user.lastLogin))}
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
                return this.renderEmptyState('fas fa-tasks', 'אין משימות', 'משתמש זה לא מקושר למשימות פעילות');
            }

            return `
                <div class="tab-panel tab-tasks">
                    <div class="tasks-list">
                        ${tasks.map(task => this.renderTaskCard(task)).join('')}
                    </div>
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
            const clientHours = filteredHours.filter(e => e.clientId)
                .reduce((sum, entry) => sum + (entry.hours || 0), 0);
            const internalHours = filteredHours.filter(e => !e.clientId)
                .reduce((sum, entry) => sum + (entry.hours || 0), 0);

            // חשב אחוזים
            const clientPercentage = totalHours > 0 ? ((clientHours / totalHours) * 100).toFixed(1) : 0;
            const internalPercentage = totalHours > 0 ? ((internalHours / totalHours) * 100).toFixed(1) : 0;

            // ספירת רשומות
            const clientEntriesCount = filteredHours.filter(e => e.clientId).length;
            const internalEntriesCount = filteredHours.filter(e => !e.clientId).length;

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
                                        <option value="all">הכל</option>
                                        <option value="client">לקוחות</option>
                                        <option value="internal">פנימי</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px;">חיוב</label>
                                    <select id="billableFilter" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
                                        <option value="all">הכל</option>
                                        <option value="yes">חויב</option>
                                        <option value="no">לא חויב</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px;">חיפוש</label>
                                    <input type="text" id="searchFilter" placeholder="חפש..." style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
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
         * Render Activity Tab
         * רינדור טאב פעילות
         */
        renderActivityTab() {
            const activity = this.userData?.activity || [];

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
                </div>
            `;
        }

        /**
         * Render Messages Tab - Timeline of admin ← user messages
         * טאב הודעות - Timeline של הודעות מנהל ← משתמש
         */
        renderMessagesTab() {
            if (!this.userData || !this.currentUser) {
                return '<div class="tab-loading">טוען נתונים...</div>';
            }

            const messages = this.userData.messages || [];

            // Calculate counts for filter tabs (excluding archived from active counts)
            const activeMessages = messages.filter(m => !m.archived);
            const allCount = activeMessages.length; // Only active (non-archived) messages
            const unreadCount = messages.filter(m => m.status === 'unread' && !m.archived).length;
            const readCount = messages.filter(m => (m.status === 'read' || m.status === 'responded') && !m.archived).length;
            const archivedCount = messages.filter(m => m.archived === true).length;

            // Filter messages based on selected filter
            const filteredMessages = this.filterMessages(messages, this.messageFilter);

            // Sort by createdAt descending (newest first)
            const sortedMessages = [...filteredMessages].sort((a, b) => {
                const timeA = a.createdAt?.toMillis?.() || 0;
                const timeB = b.createdAt?.toMillis?.() || 0;
                return timeB - timeA;
            });

            const respondedCount = messages.filter(m => m.status === 'responded').length;

            return `
                <div class="tab-panel tab-messages">
                    <!-- Messages Header -->
                    <div class="messages-header">
                        <div class="messages-stats">
                            <span class="stat-badge">
                                <i class="fas fa-envelope"></i>
                                <strong>${messages.length}</strong> הודעות
                            </span>
                            <span class="stat-badge ${unreadCount > 0 ? 'stat-badge-unread' : ''}">
                                <i class="fas fa-circle"></i>
                                <strong>${unreadCount}</strong> לא נקראו
                            </span>
                            <span class="stat-badge ${respondedCount > 0 ? 'stat-badge-responded' : ''}">
                                <i class="fas fa-check-double"></i>
                                <strong>${respondedCount}</strong> נענו
                            </span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-secondary messages-fullscreen-btn" data-action="open-fullscreen">
                                <i class="fas fa-expand"></i>
                                הצג בחלון מלא
                            </button>
                            <button class="btn btn-primary messages-new-msg-btn" data-action="send-new-message">
                                <i class="fas fa-plus"></i>
                                שלח הודעה חדשה
                            </button>
                        </div>
                    </div>

                    <!-- Filter Tabs -->
                    <div class="messages-filter-tabs">
                        <button class="filter-tab ${this.messageFilter === 'all' ? 'active' : ''}" data-filter="all">
                            <i class="fas fa-inbox"></i>
                            <span>פעילות</span>
                            <span class="filter-count">${allCount}</span>
                        </button>
                        <button class="filter-tab ${this.messageFilter === 'unread' ? 'active' : ''}" data-filter="unread">
                            <i class="fas fa-envelope"></i>
                            <span>לא נקראו</span>
                            <span class="filter-count">${unreadCount}</span>
                        </button>
                        <button class="filter-tab ${this.messageFilter === 'read' ? 'active' : ''}" data-filter="read">
                            <i class="fas fa-envelope-open"></i>
                            <span>נקראו</span>
                            <span class="filter-count">${readCount}</span>
                        </button>
                        <button class="filter-tab ${this.messageFilter === 'archived' ? 'active' : ''}" data-filter="archived">
                            <i class="fas fa-archive"></i>
                            <span>ארכיון</span>
                            <span class="filter-count">${archivedCount}</span>
                        </button>
                    </div>

                    <!-- Messages Timeline -->
                    <div class="messages-timeline">
                        ${sortedMessages.length === 0 ? this.renderEmptyMessages() : ''}
                        ${sortedMessages.map(msg => this.renderMessageTimelineItem(msg)).join('')}
                    </div>
                </div>
            `;
        }

        /**
         * Filter messages based on selected filter
         * סינון הודעות לפי מסנן נבחר
         */
        filterMessages(messages, filter) {
            switch (filter) {
                case 'unread':
                    return messages.filter(m => m.status === 'unread' && !m.archived);
                case 'read':
                    return messages.filter(m => (m.status === 'read' || m.status === 'responded') && !m.archived);
                case 'archived':
                    return messages.filter(m => m.archived === true);
                case 'all':
                default:
                    return messages.filter(m => !m.archived); // Show all non-archived by default
            }
        }

        /**
         * Render empty messages state
         * רינדור מצב ריק של הודעות
         */
        renderEmptyMessages() {
            return `
                <div class="messages-empty">
                    <div class="messages-empty-icon">
                        <i class="fas fa-inbox"></i>
                    </div>
                    <h3 class="messages-empty-title">אין הודעות</h3>
                    <p class="messages-empty-text">עדיין לא נשלחו הודעות למשתמש זה</p>
                </div>
            `;
        }

        /**
         * Render single message in timeline
         * רינדור הודעה בודדת ב-Timeline
         */
        renderMessageTimelineItem(message) {
            const typeIcons = {
                'info': 'fa-info-circle',
                'warning': 'fa-exclamation-triangle',
                'urgent': 'fa-exclamation-circle'
            };

            const typeColors = {
                'info': 'msg-blue',
                'warning': 'msg-orange',
                'urgent': 'msg-red'
            };

            const typeLabels = {
                'info': 'מידע',
                'warning': 'אזהרה',
                'urgent': 'דחוף'
            };

            const sentDate = message.createdAt ? this.formatTimestamp(message.createdAt) : 'לא ידוע';
            const relativeTime = message.createdAt ? this.getRelativeTime(message.createdAt) : '';

            return `
                <div class="timeline-item message-${message.status}">
                    <!-- Timeline Dot -->
                    <div class="timeline-dot ${typeColors[message.type] || 'msg-blue'}"></div>

                    <!-- Timeline Content -->
                    <div class="timeline-content">
                        <!-- Message Sent -->
                        <div class="message-sent">
                            <div class="message-header">
                                <span class="message-icon"><i class="fas fa-paper-plane"></i></span>
                                <strong>נשלחה הודעה</strong>
                                <span class="message-date">${sentDate}</span>
                                ${relativeTime ? `<span class="message-relative">(${relativeTime})</span>` : ''}

                                <!-- Action Buttons -->
                                <div class="message-actions">
                                    ${!message.archived ? `
                                        <button class="btn-icon btn-archive-message"
                                                data-message-id="${message.id}"
                                                title="העבר לארכיון">
                                            <i class="fas fa-archive"></i>
                                        </button>
                                    ` : `
                                        <button class="btn-icon btn-restore-message"
                                                data-message-id="${message.id}"
                                                title="שחזר מארכיון">
                                            <i class="fas fa-undo"></i>
                                        </button>
                                    `}
                                </div>
                            </div>
                            <div class="message-body">
                                <p>${this.escapeHtml(message.message)}</p>
                            </div>
                            <div class="message-meta">
                                <span class="message-type ${typeColors[message.type] || 'msg-blue'}">
                                    <i class="fas ${typeIcons[message.type] || typeIcons.info}"></i>
                                    ${typeLabels[message.type] || typeLabels.info}
                                </span>
                                <span class="message-priority">עדיפות: ${message.priority || 1}</span>
                                ${message.fromName ? `<span class="message-from">מאת: ${this.escapeHtml(message.fromName)}</span>` : ''}
                            </div>
                        </div>

                        <!-- Response (if exists) -->
                        ${this.renderMessageResponse(message)}
                    </div>
                </div>
            `;
        }

        /**
         * Render message response (if exists)
         * רינדור תשובת משתמש (אם קיימת)
         */
        renderMessageResponse(message) {
            if (message.status === 'responded' && message.response) {
                const respondedDate = message.respondedAt ? this.formatTimestamp(message.respondedAt) : '';
                return `
                    <div class="message-response responded">
                        <div class="response-header">
                            <span class="response-icon"><i class="fas fa-check-circle"></i></span>
                            <strong>נענתה</strong>
                            ${respondedDate ? `<span class="response-date">${respondedDate}</span>` : ''}
                        </div>
                        <div class="response-body">
                            <p>${this.escapeHtml(message.response)}</p>
                        </div>
                    </div>
                `;
            } else if (message.status === 'read') {
                const readDate = message.readAt ? this.formatTimestamp(message.readAt) : '';
                return `
                    <div class="message-response read">
                        <div class="response-header">
                            <span class="response-icon"><i class="fas fa-eye"></i></span>
                            <strong>נקראה</strong>
                            ${readDate ? `<span class="response-date">${readDate}</span>` : ''}
                            <span class="response-status">(לא נענתה עדיין)</span>
                        </div>
                    </div>
                `;
            } else if (message.status === 'dismissed') {
                const dismissedDate = message.dismissedAt ? this.formatTimestamp(message.dismissedAt) : '';
                return `
                    <div class="message-response dismissed">
                        <div class="response-header">
                            <span class="response-icon"><i class="fas fa-times-circle"></i></span>
                            <strong>נדחתה</strong>
                            ${dismissedDate ? `<span class="response-date">${dismissedDate}</span>` : ''}
                            <span class="response-status">(המשתמש לא השיב)</span>
                        </div>
                    </div>
                `;
            } else {
                // unread
                return `
                    <div class="message-response unread">
                        <div class="response-header">
                            <span class="response-icon"><i class="fas fa-envelope-open"></i></span>
                            <strong>לא נקראה</strong>
                        </div>
                    </div>
                `;
            }
        }

        /**
         * Send new message to user
         * שליחת הודעה חדשה למשתמש
         */
        sendNewMessage() {
            if (!this.currentUser) {
                console.error('No user selected');
                return;
            }

            console.log('📧 Opening message composer for:', this.currentUser.email);

            // Use QuickMessageDialog if available
            if (window.quickMessageDialog && typeof window.quickMessageDialog.show === 'function') {
                window.quickMessageDialog.show({
                    userId: this.currentUser.uid,
                    userEmail: this.currentUser.email,
                    userName: this.currentUser.name || this.currentUser.email
                });
            } else {
                alert('מערכת שליחת הודעות לא זמינה');
            }
        }

        /**
         * Open fullscreen messages modal
         * פתיחת חלון הודעות במסך מלא
         */
        openFullscreenMessages() {
            if (!this.currentUser) {
                console.error('❌ No user selected');
                return;
            }

            console.log('📖 Opening fullscreen messages for:', this.currentUser.email);
            console.log('📦 window.messagesFullscreenModal exists?', !!window.messagesFullscreenModal);
            console.log('📦 typeof open:', typeof window.messagesFullscreenModal?.open);

            // Use MessagesFullscreenModal if available
            if (window.messagesFullscreenModal && typeof window.messagesFullscreenModal.open === 'function') {
                const messages = this.userData?.messages || [];
                console.log(`✅ Opening fullscreen with ${messages.length} messages`);
                window.messagesFullscreenModal.open(this.currentUser, messages);
            } else {
                console.error('❌ MessagesFullscreenModal not available');
                console.error('   window.messagesFullscreenModal =', window.messagesFullscreenModal);
                if (window.notify) {
                    window.notify.error('חלון הודעות מלא לא זמין');
                } else {
                    alert('חלון הודעות מלא לא זמין');
                }
            }
        }

        /**
         * Archive message
         * העברת הודעה לארכיון
         */
        async archiveMessage(messageId) {
            try {
                console.log('🗂️ Archiving message:', messageId);

                if (!messageId) {
                    throw new Error('Message ID is missing');
                }

                if (!window.alertCommManager) {
                    throw new Error('AlertCommunicationManager not available');
                }

                console.log('✅ Calling alertCommManager.archiveMessage...');
                await window.alertCommManager.archiveMessage(messageId);

                console.log('✅ Message archived, updating local data...');
                // Update local message data instead of full reload
                const messageIndex = this.userData.messages.findIndex(m => m.id === messageId);
                if (messageIndex !== -1) {
                    this.userData.messages[messageIndex].archived = true;
                    this.userData.messages[messageIndex].archivedBy = window.firebaseAuth.currentUser.email;
                    this.userData.messages[messageIndex].archivedAt = new Date();
                }

                // Re-render only the messages tab content
                this.refreshMessagesTab();

                console.log('✅ Archive complete!');
            } catch (error) {
                console.error('❌ Error archiving message:', error);
                console.error('   Message ID was:', messageId);
                console.error('   Error details:', error.message);
                if (window.notify) {
                    window.notify.error(`שגיאה בהעברה לארכיון: ${error.message}`);
                }
            }
        }

        /**
         * Restore message from archive
         * שחזור הודעה מארכיון
         */
        async restoreMessage(messageId) {
            try {
                console.log('♻️ Restoring message:', messageId);

                if (!messageId) {
                    throw new Error('Message ID is missing');
                }

                if (!window.alertCommManager) {
                    throw new Error('AlertCommunicationManager not available');
                }

                console.log('✅ Calling alertCommManager.restoreMessage...');
                await window.alertCommManager.restoreMessage(messageId);

                console.log('✅ Message restored, updating local data...');
                // Update local message data instead of full reload
                const messageIndex = this.userData.messages.findIndex(m => m.id === messageId);
                if (messageIndex !== -1) {
                    this.userData.messages[messageIndex].archived = false;
                    this.userData.messages[messageIndex].archivedBy = null;
                    this.userData.messages[messageIndex].archivedAt = null;
                }

                // Re-render only the messages tab content
                this.refreshMessagesTab();

                console.log('✅ Restore complete!');
            } catch (error) {
                console.error('❌ Error restoring message:', error);
                console.error('   Message ID was:', messageId);
                console.error('   Error details:', error.message);
                if (window.notify) {
                    window.notify.error(`שגיאה בשחזור הודעה: ${error.message}`);
                }
            }
        }

        /**
         * Refresh messages tab without full reload
         * רענון טאב הודעות בלי לטעון הכל מחדש
         */
        refreshMessagesTab() {
            console.log('🔄 Refreshing messages tab...');

            // Find the messages tab panel in the DOM
            const messagesTabPanel = document.querySelector('.tab-panel.tab-messages');
            if (!messagesTabPanel) {
                console.warn('⚠️ Messages tab panel not found in DOM');
                return;
            }

            // Re-render the messages tab HTML
            const updatedHTML = this.renderMessagesTab();

            // Create a temporary container to parse the new HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = updatedHTML;

            // Get the new content
            const newContent = tempDiv.firstElementChild;

            // Replace the old tab panel with the new one
            messagesTabPanel.replaceWith(newContent);

            console.log('✅ Messages tab refreshed successfully');
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
            let deadlineText = '';
            if (task.deadline) {
                try {
                    let deadlineDate;

                    // בדיקה אם זה Firestore Timestamp עם מתודת toDate()
                    if (task.deadline.toDate && typeof task.deadline.toDate === 'function') {
                        deadlineDate = task.deadline.toDate();
                    } else if (task.deadline.seconds) {
                        // בדיקה אם זה אובייקט Timestamp עם seconds (לאחר JSON serialization)
                        deadlineDate = new Date(task.deadline.seconds * 1000);
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
                        deadlineText = 'תאריך לא תקין';
                        console.warn('⚠️ UserDetailsModal: Invalid task deadline date');
                    }
                } catch (e) {
                    console.warn('Invalid deadline:', task.deadline, e);
                    deadlineText = 'תאריך לא תקין';
                }
            } else {
                deadlineText = 'לא הוגדר';
            }

            // סטטוס progress - בחירת צבע (רק לבר התקדמות!)
            const progressColor = progress > 100 ? '#ef4444' : progress >= 80 ? '#f59e0b' : '#10b981';

            return `
                <div class="task-card ${statusClass}-task" data-task-id="${task.id}">
                    <!-- Header: כותרת ותג סטטוס -->
                    <div class="task-header">
                        <h4 class="task-title">${this.escapeHtml(task.title)}</h4>
                        <span class="task-status-badge ${statusClass}-badge" style="background-color: ${status.badgeColor};">${status.label}</span>
                    </div>

                    <!-- Body: פרטי משימה -->
                    <div class="task-body">
                        <!-- מידע על לקוח - אייקון אפור -->
                        <div class="task-info-row">
                            <i class="fas fa-briefcase"></i>
                            <span>${this.escapeHtml(task.clientName)}</span>
                        </div>

                        <!-- תאריך יעד - אייקון אפור -->
                        <div class="task-info-row">
                            <i class="fas fa-calendar-alt"></i>
                            <span>יעד: ${deadlineText}</span>
                        </div>

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
            // זיהוי סוג הפעילות
            const isClientWork = !!entry.clientId;
            const iconClass = isClientWork ? 'fas fa-briefcase' : 'fas fa-building';
            const borderColor = isClientWork ? '#3b82f6' : '#94a3b8';
            const iconColor = isClientWork ? '#3b82f6' : '#64748b';

            // תאריך
            const date = new Date(entry.date);
            const formattedDate = date.toLocaleDateString('he-IL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            // לקוח או פעילות פנימית
            const clientName = entry.clientName || 'פעילות פנימית';

            // משימה (מקוצר)
            let taskDesc = entry.taskDescription || '';
            if (taskDesc.length > 50) {
                taskDesc = taskDesc.substring(0, 50) + '...';
            }

            return `
                <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; border-right: 3px solid ${borderColor}; margin-bottom: 12px; transition: all 0.2s;" onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'" onmouseout="this.style.boxShadow='none'" data-entry-id="${entry.id}">

                    <!-- שורה 1: תאריך, שעות, חיוב, פעולות -->
                    <div style="display: grid; grid-template-columns: auto auto 1fr auto auto; gap: 16px; align-items: center; margin-bottom: 12px;">
                        <!-- תאריך -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-calendar" style="color: #6b7280; font-size: 13px;"></i>
                            <span style="font-weight: 600; color: #1f2937; font-size: 14px; white-space: nowrap;">${formattedDate}</span>
                        </div>

                        <!-- שעות -->
                        <div style="display: flex; align-items: center; gap: 6px; background: ${borderColor}15; padding: 6px 12px; border-radius: 6px;">
                            <i class="fas fa-clock" style="color: ${iconColor}; font-size: 13px;"></i>
                            <span style="font-weight: 700; color: ${iconColor}; font-size: 15px;">${(entry.hours || 0).toFixed(2)}</span>
                            <span style="color: #6b7280; font-size: 13px;">ש'</span>
                        </div>

                        <!-- ספייסר -->
                        <div></div>

                        <!-- חיוב -->
                        ${entry.billable !== undefined ? `
                        <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; background: ${entry.billable ? '#eff6ff' : '#f9fafb'}; color: ${entry.billable ? '#3b82f6' : '#6b7280'}; font-size: 12px; font-weight: 600; white-space: nowrap;">
                            <i class="fas fa-${entry.billable ? 'check' : 'times'}-circle"></i>
                            ${entry.billable ? 'חויב' : 'לא חויב'}
                        </span>
                        ` : '<div></div>'}

                        <!-- פעולות -->
                        <div style="display: flex; gap: 6px;">
                            <button class="btn-table-action btn-edit-hour" data-entry-id="${entry.id}" title="ערוך" style="padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 6px; background: white; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
                                <i class="fas fa-edit" style="color: #6b7280;"></i>
                            </button>
                            <button class="btn-table-action btn-delete-hour" data-entry-id="${entry.id}" title="מחק" style="padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 6px; background: white; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#fef2f2'; this.style.borderColor='#fecaca'" onmouseout="this.style.background='white'; this.style.borderColor='#e5e7eb'">
                                <i class="fas fa-trash" style="color: #6b7280;"></i>
                            </button>
                        </div>
                    </div>

                    <!-- שורה 2: לקוח -->
                    <div style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: ${borderColor}08; border-radius: 6px; margin-bottom: ${taskDesc || entry.notes ? '12px' : '0'};">
                        <span style="color: #6b7280; font-size: 13px; font-weight: 600; white-space: nowrap;">לקוח:</span>
                        <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                            <i class="${iconClass}" style="color: ${iconColor}; font-size: 14px;"></i>
                            <span style="font-weight: 600; color: #1f2937; font-size: 14px;" title="${this.escapeHtml(clientName)}">${this.escapeHtml(clientName)}</span>
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
                                <span style="color: #4b5563; font-size: 13px; line-height: 1.5;" title="${this.escapeHtml(entry.taskDescription || '')}">${this.escapeHtml(taskDesc)}</span>
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
            // פורמט תאריך
            const date = new Date(entry.date);
            const formattedDate = date.toLocaleDateString('he-IL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            // יום בשבוע
            const dayOfWeek = entry.dayOfWeek || date.toLocaleDateString('he-IL', { weekday: 'short' });

            // שעה שנרשם
            const createdTime = entry.createdAt
                ? new Date(entry.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                : '-';

            // סוג - לקוח או פנימי
            const isClientWork = entry.clientId;
            const rowClass = isClientWork ? 'row-client' : 'row-internal';

            // חיוב
            const billableText = entry.billable ? 'כן' : 'לא';
            const billableClass = entry.billable ? 'billable-yes' : 'billable-no';

            // לקוח
            const clientName = entry.clientName || 'פעילות פנימית';

            // משימה
            const taskDesc = entry.taskDescription || '-';

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

            return `
                <div class="hours-list">
                    ${hours.map(entry => this.renderHoursCard(entry)).join('')}
                </div>
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
                <button class="btn btn-primary" id="userDetailsSendMessageBtn">
                    <i class="fas fa-envelope"></i>
                    <span>שלח הודעה</span>
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

            // Send Message button (footer)
            const sendMessageBtn = modal.querySelector('#userDetailsSendMessageBtn');
            if (sendMessageBtn) {
                sendMessageBtn.addEventListener('click', () => {
                    this.sendNewMessage();
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

            // ========== MESSAGES TAB - EVENT DELEGATION ==========
            // Event delegation for messages tab buttons (send new message, fullscreen, archive, restore, filter tabs)
            // Uses data-action attribute instead of inline onclick
            const messagesTabContent = modal.querySelector('.tab-panel.tab-messages');
            if (messagesTabContent) {
                messagesTabContent.addEventListener('click', async (e) => {
                    console.log('🖱️ Messages tab click detected:', e.target);

                    // Check for filter tabs
                    const filterTab = e.target.closest('.filter-tab');
                    if (filterTab) {
                        console.log('📑 Filter tab clicked:', filterTab.getAttribute('data-filter'));
                        const filter = filterTab.getAttribute('data-filter');
                        this.messageFilter = filter;
                        this.switchTab('messages'); // Refresh to show filtered messages
                        return;
                    }

                    // Check for action buttons
                    const actionBtn = e.target.closest('[data-action]');
                    if (actionBtn) {
                        const action = actionBtn.getAttribute('data-action');
                        console.log('🎬 Action button clicked:', action);
                        if (action === 'send-new-message') {
                            this.sendNewMessage();
                        } else if (action === 'open-fullscreen') {
                            this.openFullscreenMessages();
                        }
                        return;
                    }

                    // Check for archive button
                    const archiveBtn = e.target.closest('.btn-archive-message');
                    if (archiveBtn) {
                        const messageId = archiveBtn.getAttribute('data-message-id');
                        console.log('🗂️ Archive button clicked, messageId:', messageId);
                        await this.archiveMessage(messageId);
                        return;
                    }

                    // Check for restore button
                    const restoreBtn = e.target.closest('.btn-restore-message');
                    if (restoreBtn) {
                        const messageId = restoreBtn.getAttribute('data-message-id');
                        console.log('♻️ Restore button clicked, messageId:', messageId);
                        await this.restoreMessage(messageId);
                        return;
                    }
                });
            } else {
                console.warn('⚠️ Messages tab content not found - event delegation not attached');
            }

        }

        /**
         * Switch tab
         * מעבר בין טאבים
         */
        async switchTab(tabId) {
            this.activeTab = tabId;

            // If switching to messages tab, mark user's responses as read by admin
            if (tabId === 'messages' && this.currentUser && window.alertCommManager) {
                try {
                    const count = await window.alertCommManager.markUserResponsesAsReadByAdmin(this.currentUser.email);
                    if (count > 0) {
                        console.log(`✅ Marked ${count} responses as read by admin`);

                        // Refresh the badge counts in the users table
                        if (window.UsersTable && typeof window.UsersTable.loadResponseCounts === 'function') {
                            await window.UsersTable.loadResponseCounts();
                        }
                    }
                } catch (error) {
                    console.error('❌ Failed to mark responses as read:', error);
                }
            }

            // Update modal content
            window.ModalManager.updateContent(this.modalId, this.renderContent());

            // Re-setup events
            this.setupEvents();

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
                    const timesheetSnapshot = await db.collection('timesheet')
                        .where('employeeEmail', '==', userEmail)
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
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
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
                filtered = filtered.filter(entry => entry.clientId);
            } else if (this.hoursFilters.type === 'internal') {
                filtered = filtered.filter(entry => !entry.clientId);
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
            const clientHours = hours.filter(e => e.clientId);
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

            if (task.serviceType === 'legal_procedure') {
                serviceIcon = 'fa-balance-scale';
                if (task.serviceId === 'stage_a') {
                    serviceTypeText = 'הליך משפטי - שלב א\'';
                } else if (task.serviceId === 'stage_b') {
                    serviceTypeText = 'הליך משפטי - שלב ב\'';
                } else if (task.serviceId === 'stage_c') {
                    serviceTypeText = 'הליך משפטי - שלב ג\'';
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

            // תיקון פורמט תאריך - המרה מ-ISO ל-YYYY-MM-DD
            let deadlineValue = '';
            if (task.deadline) {
                try {
                    const date = new Date(task.deadline);
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
                                    <option value="active" ${task.status === 'active' ? 'selected' : ''}>✅ פעילה</option>
                                    <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>✔️ הושלמה</option>
                                    <option value="on_hold" ${task.status === 'on_hold' ? 'selected' : ''}>⏸️ בהמתנה</option>
                                    <option value="cancelled" ${task.status === 'cancelled' ? 'selected' : ''}>❌ בוטלה</option>
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
                                    תיאור משימה
                                </label>
                                <input
                                    type="text"
                                    id="edit-hour-description"
                                    value="${this.escapeHtml(entry.taskDescription || '')}"
                                    placeholder="תיאור המשימה..."
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
                        `האם למחוק רשומה זו?\n\nמשימה: ${entry.taskDescription || 'ללא תיאור'}\nשעות: ${(entry.hours || 0).toFixed(2)}\nתאריך: ${new Date(entry.date).toLocaleDateString('he-IL')}`,
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
         * Open message composer for this user
         * פתיחת מלחין הודעות עבור משתמש זה
         */
        openMessageComposer() {
            if (!this.currentUser) {
                console.error('❌ No user selected for messaging');
                return;
            }

            // Check if AlertCommunicationManager is available
            if (!window.alertCommManager) {
                console.error('❌ AlertCommunicationManager not initialized');
                alert('מערכת ההודעות לא זמינה כרגע');
                return;
            }

            console.log(`📧 Opening message composer for: ${this.currentUser.email}`);

            // Use QuickMessageDialog if available
            if (window.quickMessageDialog) {
                window.quickMessageDialog.show({
                    userId: this.currentUser.uid,
                    userName: this.currentUser.displayName || this.currentUser.email,
                    userEmail: this.currentUser.email,
                    onSent: (message) => {
                        console.log('✅ Message sent successfully:', message.id);
                    }
                });
            } else {
                // Fallback: Show simple prompt dialog
                const message = prompt(`שלח הודעה ל-${this.currentUser.displayName || this.currentUser.email}:`);

                if (!message || message.trim() === '') {
                    return;
                }

                // Send message using AlertCommunicationManager
                window.alertCommManager.sendMessage(this.currentUser.email, message.trim())
                    .then(() => {
                        console.log('✅ Message sent successfully');
                        if (window.notify) {
                            window.notify.success('ההודעה נשלחה בהצלחה');
                        }
                    })
                    .catch((error) => {
                        console.error('❌ Failed to send message:', error);
                        alert('שגיאה בשליחת ההודעה. נסה שוב.');
                    });
            }
        }
    }

    // Create global instance
    const userDetailsModal = new UserDetailsModal();

    // Make UserDetailsModal available globally
    window.UserDetailsModal = userDetailsModal;

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = userDetailsModal;
    }

})();
