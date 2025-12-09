/**
 * ═══════════════════════════════════════════════════════════════
 * 🧠 WhatsApp Bot - Session Manager
 * ═══════════════════════════════════════════════════════════════
 *
 * מנהל זיכרון שיחות עבור הבוט
 * שומר מצב השיחה של כל משתמש (context, last command, etc.)
 */

const admin = require('firebase-admin');

class SessionManager {
    constructor() {
        this.db = admin.firestore();
        this.sessionsCollection = 'whatsapp_bot_sessions';
    }

    /**
     * קבלת Session של משתמש
     */
    async getSession(phoneNumber) {
        try {
            const sessionDoc = await this.db
                .collection(this.sessionsCollection)
                .doc(phoneNumber)
                .get();

            if (sessionDoc.exists) {
                const data = sessionDoc.data();

                // בדיקה אם ה-session פג תוקף (יותר מ-30 דקות)
                const now = Date.now();
                const lastActivity = data.lastActivity?.toMillis() || 0;
                const diffMinutes = (now - lastActivity) / 1000 / 60;

                if (diffMinutes > 30) {
                    // Session פג תוקף - נקה אותו
                    await this.clearSession(phoneNumber);
                    return this.createNewSession(phoneNumber);
                }

                return data;
            }

            // אין session - צור חדש
            return this.createNewSession(phoneNumber);

        } catch (error) {
            console.error('❌ Error getting session:', error);
            return this.createNewSession(phoneNumber);
        }
    }

    /**
     * יצירת Session חדש
     */
    createNewSession(phoneNumber) {
        return {
            phoneNumber,
            context: 'menu', // menu, pending_tasks, approve, stats, etc.
            lastCommand: null,
            data: {}, // נתונים נוספים (למשל: task ID שנבחר)
            conversationHistory: [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastActivity: admin.firestore.FieldValue.serverTimestamp()
        };
    }

    /**
     * עדכון Session
     */
    async updateSession(phoneNumber, updates) {
        try {
            const session = await this.getSession(phoneNumber);

            const updatedSession = {
                ...session,
                ...updates,
                lastActivity: admin.firestore.FieldValue.serverTimestamp()
            };

            await this.db
                .collection(this.sessionsCollection)
                .doc(phoneNumber)
                .set(updatedSession, { merge: true });

            return updatedSession;

        } catch (error) {
            console.error('❌ Error updating session:', error);
            throw error;
        }
    }

    /**
     * הוספת הודעה להיסטוריה
     */
    async addToHistory(phoneNumber, role, message) {
        try {
            const session = await this.getSession(phoneNumber);

            const historyItem = {
                role, // 'user' או 'bot'
                message,
                timestamp: new Date()
            };

            // שמור רק 20 הודעות אחרונות
            const history = session.conversationHistory || [];
            history.push(historyItem);
            if (history.length > 20) {
                history.shift();
            }

            await this.updateSession(phoneNumber, {
                conversationHistory: history
            });

        } catch (error) {
            console.error('❌ Error adding to history:', error);
        }
    }

    /**
     * ניקוי Session
     */
    async clearSession(phoneNumber) {
        try {
            await this.db
                .collection(this.sessionsCollection)
                .doc(phoneNumber)
                .delete();

            console.log(`✅ Session cleared for ${phoneNumber}`);
        } catch (error) {
            console.error('❌ Error clearing session:', error);
        }
    }

    /**
     * קבלת כל ה-Sessions הפעילים
     */
    async getActiveSessions() {
        try {
            const now = Date.now();
            const thirtyMinutesAgo = now - (30 * 60 * 1000);

            const snapshot = await this.db
                .collection(this.sessionsCollection)
                .where('lastActivity', '>', new Date(thirtyMinutesAgo))
                .get();

            return snapshot.docs.map(doc => doc.data());

        } catch (error) {
            console.error('❌ Error getting active sessions:', error);
            return [];
        }
    }
}

module.exports = SessionManager;
