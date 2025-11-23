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
                email: this.currentUser.email
            });

            // Parse the response structure from Cloud Function
            const responseData = result.data;

            // Merge user data with stats and other data
            this.userData = {
                ...responseData.user,
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
                hoursThisMonth: responseData.stats?.hoursThisMonth || 0
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
            if (window.DataManager && window.DataManager.users) {
                userData = window.DataManager.users.find(u => u.email === userEmail);
                console.log('📊 Found user in DataManager:', userData ? 'Yes' : 'No');
            }

            // If not found in DataManager, try employees collection
            if (!userData) {
                const userDoc = await db.collection('employees').doc(userEmail).get();
                userData = userDoc.exists ? userDoc.data() : this.currentUser;
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

                // Get user's tasks (active only)
                db.collection('tasks')
                    .where('assignedTo', '==', userEmail)
                    .where('status', '!=', 'completed')
                    .limit(50)
                    .get()
                    .catch(() => ({ docs: [] })),

                // Get recent timesheet entries (last 3 months)
                db.collection('timesheet')
                    .where('employeeEmail', '==', userEmail)
                    .where('date', '>=', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
                    .orderBy('date', 'desc')
                    .limit(100)
                    .get()
                    .catch(() => ({ docs: [] })),

                // Get user's activity logs (last 100 entries)
                db.collection('activityLogs')
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
            const timesheet = timesheetSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Process activity logs
            const activity = activitySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Calculate stats
            const now = new Date();
            const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
                hoursThisMonth: hoursThisMonthCalc
            };

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
                <div class="tab-panel tab-hours" style="padding: 24px;">

                    <!-- כרטיסי סיכום משודרגים -->
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
                        <!-- כרטיס סה"כ -->
                        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 24px; border-radius: 12px; color: white; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); position: relative; overflow: hidden;">
                            <div style="position: absolute; top: 10px; left: 10px; font-size: 48px; opacity: 0.1;">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div style="position: relative; z-index: 1;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                                    <i class="fas fa-chart-pie"></i>
                                    <span>סה"כ שעות</span>
                                </div>
                                <div style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">${totalHours.toFixed(2)}</div>
                                <div style="font-size: 13px; opacity: 0.9;">
                                    <i class="fas fa-file-alt" style="margin-left: 4px;"></i>
                                    ${filteredHours.length} רשומות
                                </div>
                            </div>
                        </div>

                        <!-- כרטיס שעות לקוחות -->
                        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; border-radius: 12px; color: white; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); position: relative; overflow: hidden;">
                            <div style="position: absolute; top: 10px; left: 10px; font-size: 48px; opacity: 0.1;">
                                <i class="fas fa-briefcase"></i>
                            </div>
                            <div style="position: relative; z-index: 1;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                                    <i class="fas fa-user-tie"></i>
                                    <span>עבודה ללקוחות</span>
                                </div>
                                <div style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">${clientHours.toFixed(2)}</div>
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; opacity: 0.9;">
                                    <span>
                                        <i class="fas fa-percentage" style="margin-left: 4px;"></i>
                                        ${clientPercentage}% מסה"כ
                                    </span>
                                    <span>
                                        <i class="fas fa-list" style="margin-left: 4px;"></i>
                                        ${clientEntriesCount} רשומות
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- כרטיס פעילות פנימית -->
                        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px; border-radius: 12px; color: white; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); position: relative; overflow: hidden;">
                            <div style="position: absolute; top: 10px; left: 10px; font-size: 48px; opacity: 0.1;">
                                <i class="fas fa-building"></i>
                            </div>
                            <div style="position: relative; z-index: 1;">
                                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                                    <i class="fas fa-home"></i>
                                    <span>פעילות פנימית</span>
                                </div>
                                <div style="font-size: 36px; font-weight: 700; margin-bottom: 8px;">${internalHours.toFixed(2)}</div>
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; opacity: 0.9;">
                                    <span>
                                        <i class="fas fa-percentage" style="margin-left: 4px;"></i>
                                        ${internalPercentage}% מסה"כ
                                    </span>
                                    <span>
                                        <i class="fas fa-list" style="margin-left: 4px;"></i>
                                        ${internalEntriesCount} רשומות
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- גרף התפלגות שעות -->
                    ${totalHours > 0 ? `
                    <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
                        <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 700; color: #1f2937; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-chart-bar" style="color: #3b82f6;"></i>
                            התפלגות שעות - לקוח vs פנימי
                        </h3>
                        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                            <div style="flex: 1; background: #f3f4f6; border-radius: 12px; height: 40px; overflow: hidden; display: flex;">
                                ${clientHours > 0 ? `
                                <div style="width: ${clientPercentage}%; background: linear-gradient(135deg, #10b981 0%, #059669 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px; transition: all 0.3s ease;" title="שעות לקוחות: ${clientHours.toFixed(2)}">
                                    ${parseFloat(clientPercentage) > 15 ? `<i class="fas fa-briefcase" style="margin-left: 6px;"></i> ${clientPercentage}%` : ''}
                                </div>
                                ` : ''}
                                ${internalHours > 0 ? `
                                <div style="width: ${internalPercentage}%; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 14px; transition: all 0.3s ease;" title="פעילות פנימית: ${internalHours.toFixed(2)}">
                                    ${parseFloat(internalPercentage) > 15 ? `<i class="fas fa-building" style="margin-left: 6px;"></i> ${internalPercentage}%` : ''}
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #ecfdf5; border-radius: 8px; border-right: 4px solid #10b981;">
                                <div style="width: 12px; height: 12px; border-radius: 50%; background: #10b981;"></div>
                                <div style="flex: 1;">
                                    <div style="font-size: 13px; color: #064e3b; font-weight: 600;">עבודה ללקוחות</div>
                                    <div style="font-size: 12px; color: #059669; margin-top: 2px;">${clientHours.toFixed(2)} שעות (${clientPercentage}%)</div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #fffbeb; border-radius: 8px; border-right: 4px solid #f59e0b;">
                                <div style="width: 12px; height: 12px; border-radius: 50%; background: #f59e0b;"></div>
                                <div style="flex: 1;">
                                    <div style="font-size: 13px; color: #78350f; font-weight: 600;">פעילות פנימית</div>
                                    <div style="font-size: 12px; color: #d97706; margin-top: 2px;">${internalHours.toFixed(2)} שעות (${internalPercentage}%)</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- Breakdown לפי לקוחות -->
                    ${clientBreakdown.length > 0 ? `
                    <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
                        <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 700; color: #1f2937; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-users" style="color: #10b981;"></i>
                            פירוט שעות לפי לקוחות
                        </h3>
                        <div style="display: grid; gap: 12px;">
                            ${clientBreakdown.slice(0, 5).map((client, index) => `
                                <div style="display: flex; align-items: center; gap: 12px; padding: 14px; background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%); border-radius: 8px; border-right: 4px solid ${this.getClientColor(index)}; transition: all 0.2s ease; cursor: pointer;" onmouseover="this.style.background='linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" onmouseout="this.style.background='linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)'; this.style.boxShadow='none'">
                                    <div style="flex: 0 0 40px; height: 40px; border-radius: 8px; background: ${this.getClientColor(index)}; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 16px;">
                                        ${index + 1}
                                    </div>
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                            <i class="fas fa-user-tie" style="color: ${this.getClientColor(index)}; font-size: 12px;"></i>
                                            ${this.escapeHtml(client.name)}
                                        </div>
                                        <div style="font-size: 12px; color: #6b7280;">
                                            <i class="fas fa-list" style="margin-left: 4px;"></i>
                                            ${client.count} רשומות
                                        </div>
                                    </div>
                                    <div style="flex: 0 0 auto; text-align: left;">
                                        <div style="font-size: 20px; font-weight: 700; color: #1f2937;">${client.hours.toFixed(2)}</div>
                                        <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">שעות</div>
                                    </div>
                                    <div style="flex: 0 0 60px; text-align: center;">
                                        <div style="font-size: 16px; font-weight: 700; color: ${this.getClientColor(index)};">${client.percentage}%</div>
                                        <div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">מהלקוחות</div>
                                    </div>
                                </div>
                            `).join('')}
                            ${clientBreakdown.length > 5 ? `
                                <div style="padding: 12px; text-align: center; color: #6b7280; font-size: 13px; font-weight: 600;">
                                    <i class="fas fa-ellipsis-h" style="margin-left: 6px;"></i>
                                    ועוד ${clientBreakdown.length - 5} לקוחות נוספים
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}

                    <!-- סטטיסטיקות חיוב -->
                    ${totalHours > 0 ? `
                    <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 2px solid #bae6fd;">
                        <h3 style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #0c4a6e; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-dollar-sign"></i>
                            סטטיסטיקות חיוב
                        </h3>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                            <div style="background: white; padding: 16px; border-radius: 8px; border-right: 4px solid #10b981;">
                                <div style="font-size: 13px; color: #065f46; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                                    <i class="fas fa-check-circle"></i>
                                    חויב ללקוח
                                </div>
                                <div style="font-size: 24px; font-weight: 700; color: #10b981;">${billableHours.toFixed(2)}</div>
                                <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
                                    ${totalHours > 0 ? ((billableHours / totalHours) * 100).toFixed(1) : 0}% מסה"כ שעות
                                </div>
                            </div>
                            <div style="background: white; padding: 16px; border-radius: 8px; border-right: 4px solid #6b7280;">
                                <div style="font-size: 13px; color: #374151; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                                    <i class="fas fa-times-circle"></i>
                                    לא חויב
                                </div>
                                <div style="font-size: 24px; font-weight: 700; color: #6b7280;">${nonBillableHours.toFixed(2)}</div>
                                <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
                                    ${totalHours > 0 ? ((nonBillableHours / totalHours) * 100).toFixed(1) : 0}% מסה"כ שעות
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- בורר חודש ושנה -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <div style="flex: 0 0 auto;">
                                <i class="fas fa-calendar-alt" style="font-size: 24px; color: white;"></i>
                            </div>
                            <div style="flex: 1; display: flex; gap: 12px; align-items: center;">
                                <label style="color: white; font-weight: 600; font-size: 14px;">תקופה:</label>
                                <select id="monthSelector" style="padding: 10px 14px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600; color: #1f2937; cursor: pointer;">
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
                                <select id="yearSelector" style="padding: 10px 14px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600; color: #1f2937; cursor: pointer;">
                                    ${this.renderYearOptions()}
                                </select>
                            </div>
                            <div style="flex: 0 0 auto; display: flex; gap: 8px;">
                                <button id="prevMonthBtn" style="padding: 10px 16px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.2); color: white; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                                    <i class="fas fa-chevron-right"></i>
                                    <span>חודש קודם</span>
                                </button>
                                <button id="nextMonthBtn" style="padding: 10px 16px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.2); color: white; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                                    <span>חודש הבא</span>
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- כפתורי תצוגה -->
                    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
                        <button class="view-toggle-btn ${this.hoursViewMode === 'table' ? 'active' : ''}" data-view="table" style="padding: 12px 24px; border-radius: 8px; border: 2px solid ${this.hoursViewMode === 'table' ? '#3b82f6' : '#e5e7eb'}; background: ${this.hoursViewMode === 'table' ? '#3b82f6' : 'white'}; color: ${this.hoursViewMode === 'table' ? 'white' : '#6b7280'}; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-table"></i>
                            <span>טבלה</span>
                        </button>
                        <button class="view-toggle-btn ${this.hoursViewMode === 'cards' ? 'active' : ''}" data-view="cards" style="padding: 12px 24px; border-radius: 8px; border: 2px solid ${this.hoursViewMode === 'cards' ? '#3b82f6' : '#e5e7eb'}; background: ${this.hoursViewMode === 'cards' ? '#3b82f6' : 'white'}; color: ${this.hoursViewMode === 'cards' ? 'white' : '#6b7280'}; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-th-large"></i>
                            <span>כרטיסים</span>
                        </button>
                    </div>

                    <!-- פילטרים בסיסיים -->
                    <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                            <div>
                                <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px;">
                                    <i class="fas fa-filter" style="margin-left: 6px; color: #3b82f6;"></i>
                                    סוג:
                                </label>
                                <select id="typeFilter" class="filter-select" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: white;">
                                    <option value="all">הכל</option>
                                    <option value="client">שעות לקוח</option>
                                    <option value="internal">פעילות פנימית</option>
                                </select>
                            </div>
                            <div>
                                <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px;">
                                    <i class="fas fa-dollar-sign" style="margin-left: 6px; color: #10b981;"></i>
                                    חיוב:
                                </label>
                                <select id="billableFilter" class="filter-select" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: white;">
                                    <option value="all">הכל</option>
                                    <option value="yes">חויב</option>
                                    <option value="no">לא חויב</option>
                                </select>
                            </div>
                            <div>
                                <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px;">
                                    <i class="fas fa-search" style="margin-left: 6px; color: #f59e0b;"></i>
                                    חיפוש:
                                </label>
                                <input type="text" id="searchFilter" placeholder="חיפוש..." style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px;">
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
                            <span>תקציב: ${task.estimatedHours.toFixed(1)} ש' | בוצע: ${task.actualHours.toFixed(1)} ש'</span>
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
            // זיהוי סוג הפעילות - רק לפי clientId!
            const isClientWork = !!entry.clientId; // אם יש clientId - זה לקוח
            const cardType = isClientWork ? 'client-work' : 'internal-work';
            const iconClass = isClientWork ? 'fas fa-briefcase' : 'fas fa-building';
            const typeLabel = isClientWork ? 'עבודה ללקוח' : 'פעילות פנימית';

            // עיצוב תאריך
            const date = new Date(entry.date);
            const formattedDate = date.toLocaleDateString('he-IL', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            // יום בשבוע
            const dayOfWeek = entry.dayOfWeek || date.toLocaleDateString('he-IL', { weekday: 'short' });

            // מי רשם - הצגת שם מלא (מגיע מה-backend)
            const createdBy = entry.createdByName || entry.createdBy || entry.employee || 'לא ידוע';

            // שעת יצירה (בלבד)
            const createdTime = entry.createdAt
                ? new Date(entry.createdAt).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                })
                : '-';


            // תאריך + שעה מלאים
            const createdAtFull = entry.createdAt
                ? new Date(entry.createdAt).toLocaleString('he-IL', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })
                : '-';

            return `
                <div class="hours-card ${cardType}" data-entry-id="${entry.id}" style="border-right: 4px solid ${isClientWork ? '#10b981' : '#f59e0b'};">
                    <div class="hours-header">
                        <div class="hours-type">
                            <i class="${iconClass}" style="color: ${isClientWork ? '#10b981' : '#f59e0b'};"></i>
                            <span class="hours-type-label" style="font-weight: 700; color: ${isClientWork ? '#10b981' : '#f59e0b'};">${typeLabel}</span>
                        </div>
                        <div class="hours-value">
                            <i class="fas fa-clock"></i>
                            <span>${entry.hours.toFixed(2)} ש'</span>
                        </div>
                    </div>

                    <div class="hours-body">
                        <!-- תאריך + שעה -->
                        <div class="hours-date">
                            <i class="fas fa-calendar"></i>
                            <span>${formattedDate} (${dayOfWeek}) בשעה ${createdTime}</span>
                        </div>

                        <!-- לקוח -->
                        ${isClientWork ? `
                            <div class="hours-client">
                                <i class="fas fa-user"></i>
                                <span>לקוח: ${this.escapeHtml(entry.clientName)}</span>
                            </div>
                        ` : ''}

                        <!-- משימה -->
                        ${entry.taskDescription ? `
                            <div class="hours-task">
                                <i class="fas fa-tasks"></i>
                                <span><strong>משימה:</strong> ${this.escapeHtml(entry.taskDescription)}</span>
                            </div>
                        ` : ''}

                        <!-- סטטוס חיוב -->
                        ${entry.billable !== undefined ? `
                            <div class="hours-meta">
                                <span class="hours-billable ${entry.billable ? 'yes' : 'no'}" style="padding: 6px 12px; font-weight: 600;">
                                    <i class="fas ${entry.billable ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                                    ${entry.billable ? '💵 חויב ללקוח' : '🏢 פעילות פנימית'}
                                </span>
                                ${entry.invoiced ? '<span class="hours-invoiced"><i class="fas fa-file-invoice"></i>חויב</span>' : ''}
                            </div>
                        ` : ''}

                        <!-- הערות -->
                        ${entry.notes ? `
                            <div class="hours-notes">
                                <i class="fas fa-sticky-note"></i>
                                <span>${this.escapeHtml(entry.notes)}</span>
                            </div>
                        ` : ''}

                        <div class="hours-footer">
                            <div class="hours-meta-info">
                                <span class="meta-item">
                                    <i class="fas fa-user-circle"></i>
                                    נרשם ע"י: ${this.escapeHtml(createdBy)}
                                </span>
                                <span class="meta-item">
                                    <i class="fas fa-calendar-alt"></i>
                                    ${createdAtFull}
                                </span>
                            </div>
                            <div class="hours-actions">
                                <button class="btn-table-action btn-edit-hour" data-entry-id="${entry.id}" title="ערוך">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn-table-action btn-delete-hour" data-entry-id="${entry.id}" title="מחק">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
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
                    <td class="td-hours"><strong>${entry.hours.toFixed(2)}</strong> ש'</td>
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
        }

        /**
         * Switch tab
         * מעבר בין טאבים
         */
        switchTab(tabId) {
            this.activeTab = tabId;

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

                // Call Cloud Function with month/year parameters
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

                // Refresh the tab
                this.switchTab('hours');

                console.log(`✅ Hours loaded for ${this.selectedMonth}/${this.selectedYear}`);

            } catch (error) {
                console.error('❌ Error loading hours:', error);
                window.notify.error('שגיאה בטעינת שעות');

                // Remove loading indicator
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

            // סינון לפי חודש (מבורר החדש)
            // Note: selectedMonth is now a number (1-12), selectedYear is a number
            if (this.selectedMonth && this.selectedYear) {
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
                '#10b981', // Green
                '#3b82f6', // Blue
                '#f59e0b', // Orange
                '#8b5cf6', // Purple
                '#ef4444', // Red
                '#06b6d4', // Cyan
                '#ec4899', // Pink
                '#84cc16', // Lime
                '#f97316', // Dark Orange
                '#6366f1'  // Indigo
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
                            <span class="progress-stats">${task.actualHours.toFixed(2)} / ${task.estimatedHours.toFixed(2)} שעות</span>
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
                                    value="${entry.hours.toFixed(2)}"
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
                        `האם למחוק רשומה זו?\n\nמשימה: ${entry.taskDescription || 'ללא תיאור'}\nשעות: ${entry.hours.toFixed(2)}\nתאריך: ${new Date(entry.date).toLocaleDateString('he-IL')}`,
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
