/**
 * ═══════════════════════════════════════════════════════════════
 * 🤖 WhatsApp Bot - Main Bot Logic
 * ═══════════════════════════════════════════════════════════════
 *
 * בוט חכם לניהול משימות דרך WhatsApp
 */

const admin = require('firebase-admin');
const SessionManager = require('./SessionManager');

class WhatsAppBot {
    constructor() {
        this.db = admin.firestore();
        this.sessionManager = new SessionManager();
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * טיפול בהודעה נכנסת
     * ═══════════════════════════════════════════════════════════
     */
    async handleMessage(phoneNumber, message, userInfo = null) {
        try {
            // שמור את ההודעה בהיסטוריה
            await this.sessionManager.addToHistory(phoneNumber, 'user', message);

            // קבל את ה-session הנוכחי
            const session = await this.sessionManager.getSession(phoneNumber);

            // זיהוי משתמש (אם לא סופק)
            if (!userInfo) {
                userInfo = await this.identifyUser(phoneNumber);
            }

            // בדוק את ההקשר הנוכחי והפקודה
            const response = await this.processMessage(message, session, userInfo);

            // שמור את התשובה בהיסטוריה
            await this.sessionManager.addToHistory(phoneNumber, 'bot', response);

            return response;

        } catch (error) {
            console.error('❌ Error handling message:', error);
            return '❌ מצטער, הייתה שגיאה. נסה שוב או כתוב "עזרה"';
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * עיבוד ההודעה לפי ההקשר
     * ═══════════════════════════════════════════════════════════
     */
    async processMessage(message, session, userInfo) {
        const msgLower = message.toLowerCase().trim();
        const msgNormalized = this.normalizeHebrew(msgLower);

        // ═══ פקודות גלובליות (עובדות תמיד) ═══

        // תפריט ראשי
        if (this.isMenuCommand(msgNormalized)) {
            return await this.showMainMenu(userInfo, session);
        }

        // עזרה
        if (this.isHelpCommand(msgNormalized)) {
            return this.showHelp(userInfo);
        }

        // יציאה / ביטול
        if (this.isCancelCommand(msgNormalized)) {
            await this.sessionManager.clearSession(session.phoneNumber);
            return '👋 השיחה נסגרה. כתוב "היי" או "תפריט" כדי להתחיל מחדש.';
        }

        // ═══ פקודות לפי הקשר ═══

        // אם המשתמש במצב של אישור משימות
        if (session.context === 'pending_tasks') {
            return await this.handlePendingTasksContext(message, session, userInfo);
        }

        // אם המשתמש במצב של סטטיסטיקות
        if (session.context === 'stats') {
            return await this.handleStatsContext(message, session, userInfo);
        }

        // ═══ זיהוי פקודות מהתפריט ═══

        // 1️⃣ משימות לאישור
        if (msgNormalized.match(/^1$|משימות|אישור|ממתינ/)) {
            return await this.showPendingTasks(userInfo, session);
        }

        // 2️⃣ סטטיסטיקות
        if (msgNormalized.match(/^2$|סטטיסטיק|נתונים|דוח/)) {
            return await this.showStats(userInfo, session);
        }

        // 3️⃣ שליחת הודעה לעובד
        if (msgNormalized.match(/^3$|הודעה|שלח|עובד/)) {
            return await this.handleSendMessage(message, session, userInfo);
        }

        // 4️⃣ עזרה
        if (msgNormalized.match(/^4$/)) {
            return this.showHelp(userInfo);
        }

        // ═══ אישור/דחייה מהירים ═══
        if (this.isApprovalCommand(msgNormalized)) {
            return await this.handleQuickApproval(message, session, userInfo);
        }

        // ═══ ברירת מחדל - תפריט ראשי ═══
        return await this.showMainMenu(userInfo, session);
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * תפריט ראשי
     * ═══════════════════════════════════════════════════════════
     */
    async showMainMenu(userInfo, session) {
        const userName = userInfo?.name || 'משתמש';

        // ספירת משימות ממתינות
        const pendingCount = await this.getPendingTasksCount();

        await this.sessionManager.updateSession(session.phoneNumber, {
            context: 'menu',
            lastCommand: 'menu'
        });

        const menu = `👋 שלום ${userName}!

━━━━━━━━━━━━━━━━━━━━
📋 תפריט ראשי

1️⃣ משימות לאישור${pendingCount > 0 ? ` (${pendingCount})` : ''}
2️⃣ סטטיסטיקות יומי
3️⃣ שלח הודעה לעובד
4️⃣ עזרה
━━━━━━━━━━━━━━━━━━━━

💡 כתוב מספר או שם הפעולה
🔍 כתוב "עזרה" למידע נוסף`;

        return menu;
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * הצגת משימות ממתינות לאישור
     * ═══════════════════════════════════════════════════════════
     */
    async showPendingTasks(userInfo, session) {
        try {
            // קבל רק משימות ממתינות
            const tasksSnapshot = await this.db
                .collection('pending_task_approvals')
                .where('status', '==', 'pending')
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();

            if (tasksSnapshot.empty) {
                await this.sessionManager.updateSession(session.phoneNumber, {
                    context: 'menu'
                });

                return `✅ אין משימות ממתינות לאישור!

כל המשימות אושרו 🎉

כתוב "תפריט" לחזרה לתפריט הראשי`;
            }

            const tasks = [];
            tasksSnapshot.forEach(doc => {
                tasks.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // עדכן session
            await this.sessionManager.updateSession(session.phoneNumber, {
                context: 'pending_tasks',
                lastCommand: 'pending_tasks',
                data: { tasks: tasks.map(t => t.id) } // שמור רק IDs
            });

            // בנה הודעה
            let response = `📋 משימות ממתינות לאישור (${tasks.length}):\n\n`;
            response += `━━━━━━━━━━━━━━━━━━━━\n\n`;

            tasks.forEach((task, index) => {
                const taskData = task.taskData || {};
                // נסה למצוא את התקציב בכל המקומות האפשריים
                const minutes = task.requestedMinutes || taskData.budgetMinutes || taskData.estimatedMinutes || 0;
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                const timeStr = hours > 0
                    ? `${hours} שעות${mins > 0 ? ` ו-${mins} דקות` : ''}`
                    : `${mins} דקות`;

                response += `${index + 1}️⃣ משימה מ-${task.requestedByName || task.requestedBy}\n`;
                response += `   👤 לקוח: ${taskData.clientName || 'לא צוין'}\n`;
                response += `   📝 ${taskData.description || 'אין תיאור'}\n`;
                response += `   ⏱️ ${timeStr}\n`;
                response += `\n`;
            });

            response += `━━━━━━━━━━━━━━━━━━━━\n\n`;
            response += `💡 איך לטפל במשימות?\n\n`;
            response += `✅ אישור המשימה כמו שהעובד ביקש:\n`;
            response += `   כתוב: "אישור" + מספר המשימה\n`;
            response += `   דוגמה: "אישור 1" או "אישור 3"\n\n`;
            response += `✅ אישור עם שינוי תקציב:\n`;
            response += `   כתוב: "אישור" + מספר + דקות חדשות\n`;
            response += `   דוגמה: "אישור 1 90" (90 דקות)\n\n`;
            response += `❌ דחיית משימה:\n`;
            response += `   כתוב: "דחייה" + מספר + סיבה\n`;
            response += `   דוגמה: "דחייה 2 תקציב גבוה"\n\n`;
            response += `כתוב "תפריט" לחזרה לתפריט הראשי`;

            return response;

        } catch (error) {
            console.error('❌ Error showing pending tasks:', error);
            return '❌ שגיאה בטעינת המשימות. נסה שוב.';
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * טיפול בהקשר של משימות ממתינות
     * ═══════════════════════════════════════════════════════════
     */
    async handlePendingTasksContext(message, session, userInfo) {
        const msgNormalized = this.normalizeHebrew(message.toLowerCase());

        // בדיקה אם זה פקודת אישור/דחייה
        if (this.isApprovalCommand(msgNormalized)) {
            return await this.handleQuickApproval(message, session, userInfo);
        }

        // אם זה רק מספר - הצג את המשימה הספציפית
        const taskNumber = parseInt(message.trim());
        if (!isNaN(taskNumber) && taskNumber > 0) {
            return await this.showTaskDetails(taskNumber, session);
        }

        // ברירת מחדל - הצג שוב את רשימת המשימות
        return await this.showPendingTasks(userInfo, session);
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * הצגת פרטי משימה ספציפית
     * ═══════════════════════════════════════════════════════════
     */
    async showTaskDetails(taskNumber, session) {
        const taskIds = session.data?.tasks || [];
        const taskId = taskIds[taskNumber - 1];

        if (!taskId) {
            return `❌ משימה ${taskNumber} לא נמצאה.\nכתוב "משימות" לרשימה מלאה.`;
        }

        try {
            const taskDoc = await this.db
                .collection('pending_task_approvals')
                .doc(taskId)
                .get();

            if (!taskDoc.exists) {
                return `❌ המשימה כבר לא קיימת (אולי אושרה?)`;
            }

            const task = taskDoc.data();
            const taskData = task.taskData || {};
            const minutes = taskData.budgetMinutes || 0;
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            const timeStr = hours > 0
                ? `${hours} שעות${mins > 0 ? ` ו-${mins} דקות` : ''}`
                : `${mins} דקות`;

            let response = `📋 פרטי משימה #${taskNumber}\n\n`;
            response += `━━━━━━━━━━━━━━━━━━━━\n`;
            response += `👤 עובד: ${task.requestedByName || task.requestedBy}\n`;
            response += `📧 מייל: ${task.requestedBy}\n`;
            response += `👥 לקוח: ${taskData.clientName || 'לא צוין'}\n`;
            response += `📝 תיאור: ${taskData.description || 'אין תיאור'}\n`;
            response += `⏱️ תקציב: ${timeStr} (${minutes} דקות)\n`;
            response += `📅 נוצר: ${task.createdAt?.toDate().toLocaleString('he-IL') || 'לא ידוע'}\n`;
            response += `━━━━━━━━━━━━━━━━━━━━\n\n`;
            response += `💡 לאישור: "אישור ${taskNumber}"\n`;
            response += `💡 לשינוי זמן: "אישור ${taskNumber} [דקות]"\n`;
            response += `💡 לדחייה: "דחייה ${taskNumber} [סיבה]"`;

            return response;

        } catch (error) {
            console.error('❌ Error showing task details:', error);
            return '❌ שגיאה בטעינת פרטי המשימה.';
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * טיפול באישור/דחייה מהיר
     * ═══════════════════════════════════════════════════════════
     */
    async handleQuickApproval(message, session, userInfo) {
        const msgNormalized = this.normalizeHebrew(message.toLowerCase());

        // זיהוי סוג הפעולה
        let action = null;
        let taskNumber = null;
        let approvedMinutes = null;
        let reason = '';

        // אישור
        if (/אישור|מאשר|אישר|ok|approve|yes|✅/.test(msgNormalized)) {
            action = 'approve';

            // חילוץ מספר משימה
            const numberMatch = message.match(/\d+/);
            if (numberMatch) {
                taskNumber = parseInt(numberMatch[0]);
            }

            // חילוץ דקות (אם יש)
            const allNumbers = message.match(/\d+/g);
            if (allNumbers && allNumbers.length > 1) {
                approvedMinutes = parseInt(allNumbers[1]);
            }
        }
        // דחייה
        else if (/דחייה|דוחה|דחה|reject|no|❌/.test(msgNormalized)) {
            action = 'reject';

            // חילוץ מספר משימה
            const numberMatch = message.match(/\d+/);
            if (numberMatch) {
                taskNumber = parseInt(numberMatch[0]);
            }

            // חילוץ סיבה
            const reasonMatch = message.match(/\d+\s+(.+)/);
            if (reasonMatch) {
                reason = reasonMatch[1].trim();
            }
        }

        if (!action || !taskNumber) {
            return `❌ לא הבנתי. נסה:\n"אישור 1" או "דחייה 1 סיבה"`;
        }

        // קבל את המשימה
        const taskIds = session.data?.tasks || [];
        const taskId = taskIds[taskNumber - 1];

        if (!taskId) {
            return `❌ משימה ${taskNumber} לא נמצאה.\nכתוב "משימות" לרשימה עדכנית.`;
        }

        try {
            if (action === 'approve') {
                return await this.approveTask(taskId, approvedMinutes, userInfo);
            } else {
                return await this.rejectTask(taskId, reason, userInfo);
            }
        } catch (error) {
            console.error('❌ Error in quick approval:', error);
            return `❌ שגיאה בביצוע הפעולה: ${error.message}`;
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * אישור משימה
     * ═══════════════════════════════════════════════════════════
     */
    async approveTask(approvalId, approvedMinutes = null, userInfo) {
        try {
            // קבל את פרטי ה-approval
            const approvalDoc = await this.db
                .collection('pending_task_approvals')
                .doc(approvalId)
                .get();

            if (!approvalDoc.exists) {
                return '❌ המשימה לא נמצאה (אולי כבר אושרה?)';
            }

            const approval = approvalDoc.data();
            const taskId = approval.taskId;

            // 🛡️ בדיקת בטיחות: האם המשימה כבר אושרה/נדחתה?
            if (approval.status !== 'pending') {
                const approvedBy = approval.reviewedByName || approval.approvedByName || approval.approvedBy || 'מנהל אחר';
                return `⚠️ המשימה כבר טופלה!

📋 לקוח: ${approval.taskData?.clientName || 'לא צוין'}
✅ סטטוס: ${approval.status === 'approved' || approval.status === 'modified' ? 'אושרה' : 'נדחתה'}
👤 על ידי: ${approvedBy}
📅 בתאריך: ${approval.reviewedAt?.toDate().toLocaleString('he-IL') || approval.approvedAt?.toDate().toLocaleString('he-IL') || 'לא ידוע'}

כתוב "משימות" לרשימה עדכנית`;
            }

            // אם המנהל לא ציין דקות, קח מהמקורות האפשריים
            const requestedMinutes = approval.requestedMinutes || approval.taskData?.estimatedMinutes || 0;
            const finalMinutes = approvedMinutes || requestedMinutes;

            // קבע סטטוס - approved אם אותו תקציב, modified אם שונה
            const isModified = finalMinutes !== requestedMinutes;
            const newStatus = isModified ? 'modified' : 'approved';

            // 🔄 שימוש ב-Batch Write כמו ב-Cloud Function - אטומי!
            const batch = this.db.batch();

            // 1. עדכון pending_task_approvals (בדיוק כמו Cloud Function)
            const approvalRef = this.db.collection('pending_task_approvals').doc(approvalId);
            batch.update(approvalRef, {
                status: newStatus,
                reviewedBy: userInfo?.email || 'unknown',
                reviewedByName: userInfo?.name || 'Unknown',
                reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
                approvedMinutes: finalMinutes,
                adminNotes: 'אושר דרך WhatsApp',
                whatsappApproval: true
            });

            // 2. עדכון budget_tasks (בדיוק כמו Cloud Function)
            if (taskId) {
                const taskRef = this.db.collection('budget_tasks').doc(taskId);
                batch.update(taskRef, {
                    status: 'פעיל',  // ✅ סטטוס נכון! (לא 'approved')
                    estimatedMinutes: finalMinutes,
                    estimatedHours: finalMinutes / 60,
                    approvedMinutes: finalMinutes,
                    approvedBy: userInfo?.email || 'unknown',
                    approvedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            // 3. יצירת הודעה לעובד (בדיוק כמו Cloud Function)
            const messageText = isModified
                ? `✅ תקציב המשימה אושר עם שינוי\n\n📋 משימה: ${approval.taskData?.description || ''}\n⏱️ תקציב מבוקש: ${requestedMinutes} דקות\n✅ תקציב מאושר: ${finalMinutes} דקות\n📝 אושר דרך WhatsApp`
                : `✅ תקציב המשימה אושר במלואו\n\n📋 משימה: ${approval.taskData?.description || ''}\n⏱️ תקציב: ${finalMinutes} דקות\n📝 אושר דרך WhatsApp`;

            const messageRef = this.db.collection('user_messages').doc();
            batch.set(messageRef, {
                to: approval.requestedBy,
                from: 'system',
                fromName: 'מערכת',
                message: messageText,
                type: 'task_approval',
                taskId: taskId,
                approvalId: approvalId,
                status: 'unread',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 4. ביצוע כל העדכונים באופן אטומי
            await batch.commit();

            console.log(`✅ WhatsApp Bot: Task ${taskId} approved: ${finalMinutes} minutes by ${userInfo?.name}`);

            const hours = Math.floor(finalMinutes / 60);
            const mins = finalMinutes % 60;
            const timeStr = hours > 0
                ? `${hours} שעות${mins > 0 ? ` ו-${mins} דקות` : ''}`
                : `${mins} דקות`;

            return `✅ המשימה אושרה בהצלחה!

📋 לקוח: ${approval.taskData?.clientName || 'לא צוין'}
⏱️ תקציב מאושר: ${timeStr}
👤 אושר על ידי: ${userInfo?.name || 'אתה'}
📨 העובד יקבל התראה

כתוב "משימות" לעוד משימות או "תפריט" לתפריט ראשי`;

        } catch (error) {
            console.error('❌ Error approving task:', error);
            throw error;
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * דחיית משימה
     * ═══════════════════════════════════════════════════════════
     */
    async rejectTask(approvalId, reason, userInfo) {
        try {
            const approvalDoc = await this.db
                .collection('pending_task_approvals')
                .doc(approvalId)
                .get();

            if (!approvalDoc.exists) {
                return '❌ המשימה לא נמצאה (אולי כבר טופלה?)';
            }

            const approval = approvalDoc.data();
            const taskId = approval.taskId;
            const requestedMinutes = approval.requestedMinutes || approval.taskData?.estimatedMinutes || 0;

            // 🛡️ בדיקת בטיחות: האם המשימה כבר אושרה/נדחתה?
            if (approval.status !== 'pending') {
                const handledBy = approval.reviewedByName || approval.approvedByName || approval.rejectedByName || approval.approvedBy || approval.rejectedBy || 'מנהל אחר';
                return `⚠️ המשימה כבר טופלה!

📋 לקוח: ${approval.taskData?.clientName || 'לא צוין'}
✅ סטטוס: ${approval.status === 'approved' || approval.status === 'modified' ? 'אושרה' : 'נדחתה'}
👤 על ידי: ${handledBy}
📅 בתאריך: ${approval.reviewedAt?.toDate().toLocaleString('he-IL') || approval.approvedAt?.toDate().toLocaleString('he-IL') || approval.rejectedAt?.toDate().toLocaleString('he-IL') || 'לא ידוע'}

כתוב "משימות" לרשימה עדכנית`;
            }

            const finalReason = reason || 'לא צוינה סיבה (נדחה דרך WhatsApp)';

            // 🔄 שימוש ב-Batch Write כמו ב-Cloud Function - אטומי!
            const batch = this.db.batch();

            // 1. עדכון pending_task_approvals (בדיוק כמו Cloud Function)
            const approvalRef = this.db.collection('pending_task_approvals').doc(approvalId);
            batch.update(approvalRef, {
                status: 'rejected',
                reviewedBy: userInfo?.email || 'unknown',
                reviewedByName: userInfo?.name || 'Unknown',
                reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
                rejectionReason: finalReason,
                whatsappApproval: true
            });

            // 2. מחיקת budget_tasks (בדיוק כמו Cloud Function)
            if (taskId) {
                const taskRef = this.db.collection('budget_tasks').doc(taskId);
                batch.delete(taskRef);  // ✅ מחיקה! (לא עדכון סטטוס)
            }

            // 3. יצירת הודעה לעובד (בדיוק כמו Cloud Function)
            const messageText = `❌ בקשת תקציב נדחתה\n\n📋 משימה: ${approval.taskData?.description || ''}\n⏱️ תקציב מבוקש: ${requestedMinutes} דקות\n💬 סיבה: ${finalReason}\n📝 נדחה דרך WhatsApp`;

            const messageRef = this.db.collection('user_messages').doc();
            batch.set(messageRef, {
                to: approval.requestedBy,
                from: 'system',
                fromName: 'מערכת',
                message: messageText,
                type: 'task_rejection',
                taskId: taskId,
                approvalId: approvalId,
                status: 'unread',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 4. ביצוע כל העדכונים באופן אטומי
            await batch.commit();

            console.log(`❌ WhatsApp Bot: Task ${taskId} rejected by ${userInfo?.name}. Reason: ${finalReason}`);

            return `❌ המשימה נדחתה

📋 לקוח: ${approval.taskData?.clientName || 'לא צוין'}
💬 סיבה: ${finalReason}
👤 נדחה על ידי: ${userInfo?.name || 'אתה'}
📨 העובד יקבל התראה

כתוב "משימות" לעוד משימות או "תפריט" לתפריט ראשי`;

        } catch (error) {
            console.error('❌ Error rejecting task:', error);
            throw error;
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * הצגת סטטיסטיקות
     * ═══════════════════════════════════════════════════════════
     */
    async showStats(userInfo, session) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [approvedToday, rejectedToday, pendingTotal] = await Promise.all([
                // אושרו היום
                this.db.collection('pending_task_approvals')
                    .where('status', '==', 'approved')
                    .where('approvedAt', '>=', today)
                    .get(),

                // נדחו היום
                this.db.collection('pending_task_approvals')
                    .where('status', '==', 'rejected')
                    .where('rejectedAt', '>=', today)
                    .get(),

                // ממתינות כרגע
                this.db.collection('pending_task_approvals')
                    .where('status', '==', 'pending')
                    .get()
            ]);

            await this.sessionManager.updateSession(session.phoneNumber, {
                context: 'menu'
            });

            return `📊 סטטיסטיקות יום ${today.toLocaleDateString('he-IL')}

━━━━━━━━━━━━━━━━━━━━
✅ אושרו היום: ${approvedToday.size}
❌ נדחו היום: ${rejectedToday.size}
⏳ ממתינות כרגע: ${pendingTotal.size}
━━━━━━━━━━━━━━━━━━━━

כתוב "תפריט" לחזרה לתפריט ראשי`;

        } catch (error) {
            console.error('❌ Error showing stats:', error);
            return '❌ שגיאה בטעינת סטטיסטיקות.';
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * הצגת עזרה
     * ═══════════════════════════════════════════════════════════
     */
    showHelp(userInfo) {
        return `📖 מדריך שימוש בבוט

━━━━━━━━━━━━━━━━━━━━
🎯 פקודות ראשיות:

📋 "תפריט" / "1" - תפריט ראשי
📋 "משימות" - משימות לאישור
📊 "סטטיסטיקה" / "2" - נתונים יומיים
💬 "הודעה" / "3" - שלח לעובד
❓ "עזרה" / "4" - מדריך זה

━━━━━━━━━━━━━━━━━━━━
✅ אישור/דחייה:

✅ "אישור 1" - אישור משימה 1
✅ "אישור 1 120" - אישור עם 120 דקות
❌ "דחייה 1 סיבה" - דחיית משימה

━━━━━━━━━━━━━━━━━━━━
💡 טיפים:

• המערכת זוכרת את ההקשר שלך
• אפשר לכתוב גם בעברית וגם באנגלית
• "ביטול" או "יציאה" לסיום

כתוב "תפריט" להתחלה`;
    }

    /**
     * ═══════════════════════════════════════════════════════════
     * פונקציות עזר
     * ═══════════════════════════════════════════════════════════
     */

    async identifyUser(phoneNumber) {
        try {
            // נרמל את המספר (הסר רווחים, מקפים וכו')
            const cleanPhone = phoneNumber.replace(/\D/g, '');
            console.log(`🔍 Identifying user with phone: ${phoneNumber} (clean: ${cleanPhone})`);

            // קבל את כל ה-admins (בדרך כלל יש מעט)
            const snapshot = await this.db.collection('employees')
                .where('role', '==', 'admin')
                .get();

            console.log(`📊 Found ${snapshot.size} admins in database`);

            if (snapshot.empty) {
                console.log('⚠️ No admins found in database');
                return { name: 'משתמש', email: 'unknown', role: 'unknown' };
            }

            let foundUser = null;
            snapshot.forEach(doc => {
                const userData = doc.data();
                const userPhone = (userData.phone || '').replace(/\D/g, '');

                console.log(`  Checking: ${userData.name} - Phone DB: ${userData.phone} (clean: ${userPhone})`);

                // בדוק התאמה של 9 ספרות אחרונות
                const last9Clean = cleanPhone.substring(cleanPhone.length - 9);
                const last9User = userPhone.substring(userPhone.length - 9);

                console.log(`    Comparing last 9 digits: incoming=${last9Clean}, db=${last9User}`);

                if (last9Clean === last9User && last9Clean.length === 9) {
                    console.log(`    ✅ MATCH FOUND!`);
                    foundUser = userData;
                }
            });

            if (foundUser) {
                console.log(`✅ User identified: ${foundUser.name} (${foundUser.email})`);
                return foundUser;
            } else {
                console.log(`❌ No matching user found for phone ${phoneNumber}`);
                return { name: 'משתמש', email: 'unknown', role: 'unknown' };
            }

        } catch (error) {
            console.error('❌ Error identifying user:', error);
            return { name: 'משתמש', email: 'unknown', role: 'unknown' };
        }
    }

    async getPendingTasksCount() {
        try {
            const snapshot = await this.db
                .collection('pending_task_approvals')
                .where('status', '==', 'pending')
                .get();
            return snapshot.size;
        } catch (error) {
            return 0;
        }
    }

    async handleSendMessage(message, session, userInfo) {
        return `📬 שליחת הודעה לעובד

פיצ'ר זה בפיתוח! 🚧

בינתיים תוכל לשלוח הודעות דרך האדמין פאנל.

כתוב "תפריט" לחזרה`;
    }

    async handleStatsContext(message, session, userInfo) {
        return await this.showStats(userInfo, session);
    }

    normalizeHebrew(text) {
        // הסרת ניקוד
        return text.replace(/[\u0591-\u05C7]/g, '');
    }

    isMenuCommand(text) {
        return /תפריט|menu|היי|שלום|hello|hi|start/.test(text);
    }

    isHelpCommand(text) {
        return /עזרה|help|\?|מידע/.test(text);
    }

    isCancelCommand(text) {
        return /ביטול|יציאה|סיום|cancel|exit|quit|stop/.test(text);
    }

    isApprovalCommand(text) {
        return /אישור|דחייה|מאשר|דוחה|approve|reject/.test(text);
    }
}

module.exports = WhatsAppBot;
