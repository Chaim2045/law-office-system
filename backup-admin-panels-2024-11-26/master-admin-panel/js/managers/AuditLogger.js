/**
 * Audit Logger
 * מערכת תיעוד ולוגים לכל פעולות המנהל
 *
 * נוצר: 12/11/2025
 * גרסה: 1.0.0
 * Phase: 3 - User Management
 *
 * תפקיד: תיעוד כל פעולה שמנהל מבצע במערכת
 * - יצירת משתמש
 * - עדכון משתמש
 * - מחיקת משתמש
 * - חסימה/ביטול חסימה
 * - שינוי הרשאות
 * - כל פעולה רגישה אחרת
 */

(function() {
    'use strict';

    /**
     * AuditLogger Class
     * מערכת לוגים מרכזית
     */
    class AuditLogger {
        constructor() {
            this.db = null;
            this.auth = null;
            this.currentAdmin = null;
            this.initialized = false;
        }

        /**
         * Initialize Audit Logger
         * אתחול מערכת הלוגים
         */
        init() {
            try {
                // Wait for Firebase
                if (!window.FirebaseManager || !window.FirebaseManager.initialized) {
                    console.warn('⏳ AuditLogger: Waiting for Firebase...');
                    window.addEventListener('firebase:ready', () => this.init());
                    return false;
                }

                // Get Firebase instances
                this.db = window.firebaseDB;
                this.auth = window.firebaseAuth;

                // Get current admin
                this.auth.onAuthStateChanged((user) => {
                    if (user) {
                        this.currentAdmin = user;
                    }
                });

                this.initialized = true;
                console.log('✅ AuditLogger initialized successfully');

                return true;

            } catch (error) {
                console.error('❌ AuditLogger initialization error:', error);
                return false;
            }
        }

        /**
         * Log action to Firestore
         * רישום פעולה ל-Firestore
         *
         * @param {string} action - סוג הפעולה
         * @param {string} targetUser - משתמש היעד (אימייל)
         * @param {object} details - פרטים נוספים
         * @param {string} severity - רמת חומרה (info/warning/critical)
         */
        async logAction(action, targetUser, details = {}, severity = 'info') {
            try {
                if (!this.initialized) {
                    console.warn('⚠️ AuditLogger not initialized');
                    return false;
                }

                if (!this.currentAdmin) {
                    console.warn('⚠️ No admin user logged in');
                    return false;
                }

                // Create log entry
                const logEntry = {
                    // Who performed the action
                    performedBy: this.currentAdmin.email,
                    performedByName: this.currentAdmin.displayName || this.currentAdmin.email.split('@')[0],

                    // What action
                    action: action,

                    // On whom
                    targetUser: targetUser || null,

                    // Additional details
                    details: details,

                    // Severity level
                    severity: severity,

                    // Timestamp
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    timestampLocal: new Date().toISOString(),

                    // Session info
                    userAgent: navigator.userAgent,

                    // Source
                    source: 'master-admin-panel'
                };

                // Save to Firestore
                await this.db.collection('audit_log').add(logEntry);

                console.log('📝 Audit log created:', {
                    action,
                    targetUser,
                    performedBy: this.currentAdmin.email
                });

                return true;

            } catch (error) {
                console.error('❌ Error creating audit log:', error);
                return false;
            }
        }

        /**
         * Log user creation
         * תיעוד יצירת משתמש
         */
        async logUserCreation(userEmail, userData) {
            return await this.logAction(
                'USER_CREATED',
                userEmail,
                {
                    username: userData.username,
                    role: userData.role,
                    status: userData.status || 'active',
                    message: `נוצר משתמש חדש: ${userData.username || userEmail}`
                },
                'info'
            );
        }

        /**
         * Log user update
         * תיעוד עדכון משתמש
         */
        async logUserUpdate(userEmail, changes, oldData) {
            return await this.logAction(
                'USER_UPDATED',
                userEmail,
                {
                    changes: changes,
                    oldData: oldData,
                    message: `עודכן משתמש: ${userEmail}`
                },
                'info'
            );
        }

        /**
         * Log user deletion
         * תיעוד מחיקת משתמש
         */
        async logUserDeletion(userEmail, userData) {
            return await this.logAction(
                'USER_DELETED',
                userEmail,
                {
                    username: userData.username,
                    role: userData.role,
                    message: `נמחק משתמש: ${userData.username || userEmail}`
                },
                'critical'
            );
        }

        /**
         * Log user block/unblock
         * תיעוד חסימה/ביטול חסימה
         */
        async logUserBlockUnblock(userEmail, isBlocked, userData) {
            const action = isBlocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED';
            const message = isBlocked
                ? `נחסם משתמש: ${userData.username || userEmail}`
                : `בוטלה חסימת משתמש: ${userData.username || userEmail}`;

            return await this.logAction(
                action,
                userEmail,
                {
                    username: userData.username,
                    role: userData.role,
                    status: isBlocked ? 'blocked' : 'active',
                    message: message
                },
                isBlocked ? 'warning' : 'info'
            );
        }

        /**
         * Log role change
         * תיעוד שינוי תפקיד
         */
        async logRoleChange(userEmail, oldRole, newRole, userData) {
            return await this.logAction(
                'USER_ROLE_CHANGED',
                userEmail,
                {
                    username: userData.username,
                    oldRole: oldRole,
                    newRole: newRole,
                    message: `שונה תפקיד משתמש ${userData.username || userEmail} מ-${oldRole} ל-${newRole}`
                },
                newRole === window.ADMIN_PANEL_CONSTANTS.USER_ROLES.ADMIN ? 'warning' : 'info'
            );
        }

        /**
         * Log password reset
         * תיעוד איפוס סיסמה
         */
        async logPasswordReset(userEmail, userData) {
            return await this.logAction(
                'PASSWORD_RESET_SENT',
                userEmail,
                {
                    username: userData.username,
                    message: `נשלח מייל איפוס סיסמה ל-${userData.username || userEmail}`
                },
                'info'
            );
        }

        /**
         * Log client creation
         * תיעוד יצירת לקוח
         */
        async logClientCreation(clientId, clientData) {
            return await this.logAction(
                'CLIENT_CREATED',
                null,
                {
                    clientId: clientId,
                    clientName: clientData.clientName,
                    assignedTo: clientData.assignedTo || null,
                    message: `נוצר לקוח חדש: ${clientData.clientName}`
                },
                'info'
            );
        }

        /**
         * Log client update
         * תיעוד עדכון לקוח
         */
        async logClientUpdate(clientId, changes, oldData) {
            return await this.logAction(
                'CLIENT_UPDATED',
                null,
                {
                    clientId: clientId,
                    clientName: oldData.clientName,
                    changes: changes,
                    message: `עודכן לקוח: ${oldData.clientName}`
                },
                'info'
            );
        }

        /**
         * Log client deletion
         * תיעוד מחיקת לקוח
         */
        async logClientDeletion(clientId, clientData) {
            return await this.logAction(
                'CLIENT_DELETED',
                null,
                {
                    clientId: clientId,
                    clientName: clientData.clientName,
                    message: `נמחק לקוח: ${clientData.clientName}`
                },
                'critical'
            );
        }

        /**
         * Log admin login
         * תיעוד כניסת מנהל
         */
        async logAdminLogin() {
            return await this.logAction(
                'ADMIN_LOGIN',
                null,
                {
                    message: 'מנהל נכנס למערכת'
                },
                'info'
            );
        }

        /**
         * Log admin logout
         * תיעוד יציאת מנהל
         */
        async logAdminLogout() {
            return await this.logAction(
                'ADMIN_LOGOUT',
                null,
                {
                    message: 'מנהל יצא מהמערכת'
                },
                'info'
            );
        }

        /**
         * Get recent logs
         * קבלת לוגים אחרונים
         *
         * @param {number} limit - מספר לוגים להחזיר
         */
        async getRecentLogs(limit = 50) {
            try {
                const snapshot = await this.db.collection('audit_log')
                    .orderBy('timestamp', 'desc')
                    .limit(limit)
                    .get();

                const logs = [];
                snapshot.forEach(doc => {
                    logs.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                return logs;

            } catch (error) {
                console.error('❌ Error fetching audit logs:', error);
                return [];
            }
        }

        /**
         * Get logs for specific user
         * קבלת לוגים למשתמש ספציפי
         *
         * @param {string} userEmail - אימייל המשתמש
         */
        async getLogsForUser(userEmail) {
            try {
                const snapshot = await this.db.collection('audit_log')
                    .where('targetUser', '==', userEmail)
                    .orderBy('timestamp', 'desc')
                    .limit(100)
                    .get();

                const logs = [];
                snapshot.forEach(doc => {
                    logs.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                return logs;

            } catch (error) {
                console.error('❌ Error fetching user logs:', error);
                return [];
            }
        }

        /**
         * Get logs by action type
         * קבלת לוגים לפי סוג פעולה
         *
         * @param {string} action - סוג הפעולה
         */
        async getLogsByAction(action) {
            try {
                const snapshot = await this.db.collection('audit_log')
                    .where('action', '==', action)
                    .orderBy('timestamp', 'desc')
                    .limit(100)
                    .get();

                const logs = [];
                snapshot.forEach(doc => {
                    logs.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                return logs;

            } catch (error) {
                console.error('❌ Error fetching action logs:', error);
                return [];
            }
        }
    }

    // Create global instance
    const auditLogger = new AuditLogger();

    // Make AuditLogger available globally
    window.AuditLogger = auditLogger;

    // Auto-initialize when Firebase is ready
    if (window.FirebaseManager && window.FirebaseManager.initialized) {
        auditLogger.init();
    } else {
        window.addEventListener('firebase:ready', () => {
            auditLogger.init();
        });
    }

    // Export for ES6 modules (if needed in the future)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = auditLogger;
    }

})();
