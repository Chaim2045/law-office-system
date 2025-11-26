/**
 * ========================================
 * Admin API Client
 * ========================================
 * JavaScript client לקריאה ל-Admin Cloud Functions מהדשבורד
 *
 * שימוש בדשבורד:
 * <script src="admin-api-client.js"></script>
 * <script>
 *   const api = new AdminAPI();
 *   await api.createUser({ email, password, name, role });
 * </script>
 *
 * @version 1.0.0
 * @date 2025-10-23
 */

class AdminAPI {
  constructor() {
    // בדיקה ש-Firebase מאותחל
    if (typeof firebase === 'undefined') {
      throw new Error('Firebase is not loaded. Please include Firebase SDK first.');
    }

    this.functions = firebase.functions();
    console.log('✅ Admin API Client initialized');
  }

  // ==================== Users Management ====================

  /**
   * יצירת משתמש חדש
   *
   * @param {Object} params
   * @param {string} params.email - כתובת מייל
   * @param {string} params.password - סיסמה
   * @param {string} params.name - שם מלא
   * @param {string} params.role - תפקיד (admin/lawyer/employee/intern)
   * @param {string} [params.phone] - טלפון (אופציונלי)
   * @param {string} [params.username] - שם משתמש (אופציונלי)
   * @returns {Promise<Object>}
   */
  async createUser(params) {
    try {
      console.log('📞 Calling adminCreateUser...', params.email);
      const result = await this.functions.httpsCallable('adminCreateUser')(params);
      console.log('✅ User created successfully:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error creating user:', error);
      throw this._handleError(error);
    }
  }

  /**
   * חסימת משתמש
   */
  async blockUser(userId, reason = null) {
    try {
      console.log('📞 Calling adminBlockUser...', userId);
      const result = await this.functions.httpsCallable('adminBlockUser')({ userId, reason });
      console.log('✅ User blocked:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error blocking user:', error);
      throw this._handleError(error);
    }
  }

  /**
   * ביטול חסימת משתמש
   */
  async unblockUser(userId) {
    try {
      console.log('📞 Calling adminUnblockUser...', userId);
      const result = await this.functions.httpsCallable('adminUnblockUser')({ userId });
      console.log('✅ User unblocked:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error unblocking user:', error);
      throw this._handleError(error);
    }
  }

  /**
   * מחיקת משתמש (זהיר!)
   */
  async deleteUser(userId) {
    try {
      console.log('📞 Calling adminDeleteUser...', userId);
      const result = await this.functions.httpsCallable('adminDeleteUser')({
        userId,
        confirm: true
      });
      console.log('✅ User deleted:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      throw this._handleError(error);
    }
  }

  /**
   * שינוי תפקיד משתמש
   */
  async updateUserRole(userId, newRole) {
    try {
      console.log('📞 Calling adminUpdateUserRole...', userId, newRole);
      const result = await this.functions.httpsCallable('adminUpdateUserRole')({
        userId,
        newRole
      });
      console.log('✅ User role updated:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error updating user role:', error);
      throw this._handleError(error);
    }
  }

  /**
   * שליחת מייל לאיפוס סיסמה
   */
  async resetPassword(email) {
    try {
      console.log('📞 Calling adminResetPassword...', email);
      const result = await this.functions.httpsCallable('adminResetPassword')({ email });
      console.log('✅ Password reset sent:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error resetting password:', error);
      throw this._handleError(error);
    }
  }

  // ==================== Tasks Management ====================

  /**
   * העברת משימה בודדת
   */
  async transferTask(taskId, fromEmployeeEmail, toEmployeeEmail, reason = null) {
    try {
      console.log('📞 Calling adminTransferTask...', taskId);
      const result = await this.functions.httpsCallable('adminTransferTask')({
        taskId,
        fromEmployeeEmail,
        toEmployeeEmail,
        reason
      });
      console.log('✅ Task transferred:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error transferring task:', error);
      throw this._handleError(error);
    }
  }

  /**
   * העברת כל המשימות של עובד
   */
  async bulkTransferTasks(fromEmployeeEmail, toEmployeeEmail, includeCompleted = false, reason = null) {
    try {
      console.log('📞 Calling adminBulkTransferTasks...');
      const result = await this.functions.httpsCallable('adminBulkTransferTasks')({
        fromEmployeeEmail,
        toEmployeeEmail,
        includeCompleted,
        reason
      });
      console.log('✅ Tasks transferred:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error bulk transferring tasks:', error);
      throw this._handleError(error);
    }
  }

  /**
   * מחיקת משימה
   */
  async deleteTask(taskId, reason = null) {
    try {
      console.log('📞 Calling adminDeleteTask...', taskId);
      const result = await this.functions.httpsCallable('adminDeleteTask')({
        taskId,
        confirm: true,
        reason
      });
      console.log('✅ Task deleted:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error deleting task:', error);
      throw this._handleError(error);
    }
  }

  /**
   * סימון משימה כהושלמה
   */
  async completeTask(taskId, completionNotes = null) {
    try {
      console.log('📞 Calling adminCompleteTask...', taskId);
      const result = await this.functions.httpsCallable('adminCompleteTask')({
        taskId,
        completionNotes
      });
      console.log('✅ Task completed:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error completing task:', error);
      throw this._handleError(error);
    }
  }

  /**
   * עדכון דדליין של משימה
   */
  async updateTaskDeadline(taskId, newDeadline, reason = null) {
    try {
      console.log('📞 Calling adminUpdateTaskDeadline...', taskId, newDeadline);
      const result = await this.functions.httpsCallable('adminUpdateTaskDeadline')({
        taskId,
        newDeadline,
        reason
      });
      console.log('✅ Task deadline updated:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error updating task deadline:', error);
      throw this._handleError(error);
    }
  }

  // ==================== Notifications ====================

  /**
   * שליחת התראה למשתמש ספציפי
   */
  async sendNotification(params) {
    try {
      console.log('📞 Calling adminSendNotification...', params.userEmail);
      const result = await this.functions.httpsCallable('adminSendNotification')(params);
      console.log('✅ Notification sent:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      throw this._handleError(error);
    }
  }

  /**
   * שליחת הודעת שידור לכולם
   */
  async broadcastNotification(params) {
    try {
      console.log('📞 Calling adminBroadcastNotification...');
      const result = await this.functions.httpsCallable('adminBroadcastNotification')(params);
      console.log('✅ Broadcast sent:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error broadcasting notification:', error);
      throw this._handleError(error);
    }
  }

  /**
   * שליחת תזכורת על משימה
   */
  async sendTaskReminder(taskId, customMessage = null) {
    try {
      console.log('📞 Calling adminSendTaskReminder...', taskId);
      const result = await this.functions.httpsCallable('adminSendTaskReminder')({
        taskId,
        customMessage
      });
      console.log('✅ Task reminder sent:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error sending task reminder:', error);
      throw this._handleError(error);
    }
  }

  // ==================== Error Handling ====================

  /**
   * טיפול בשגיאות מ-Cloud Functions
   * ממיר את השגיאות למסר ידידותי בעברית
   */
  _handleError(error) {
    // אם יש הודעה מהשרת (שכבר בעברית מ-utils.js)
    if (error.message) {
      return new Error(error.message);
    }

    // שגיאות נפוצות
    const errorMessages = {
      'unauthenticated': 'יש להתחבר למערכת',
      'permission-denied': 'אין לך הרשאות לפעולה זו',
      'not-found': 'הפריט לא נמצא',
      'invalid-argument': 'הנתונים שהוזנו לא תקינים',
      'already-exists': 'הפריט כבר קיים במערכת',
      'internal': 'אירעה שגיאה במערכת'
    };

    const code = error.code || 'internal';
    const message = errorMessages[code] || 'אירעה שגיאה לא צפויה';

    return new Error(message);
  }

  // ==================== Helper Methods ====================

  /**
   * בדיקה אם המשתמש הנוכחי הוא admin
   */
  async isAdmin() {
    try {
      const user = firebase.auth().currentUser;
      if (!user) return false;

      const token = await user.getIdTokenResult();
      return token.claims.role === 'admin' || user.email === 'haim@ghlawoffice.co.il';
    } catch (error) {
      return false;
    }
  }

  /**
   * קבלת מידע על המשתמש הנוכחי
   */
  getCurrentUser() {
    return firebase.auth().currentUser;
  }
}

// יצירת instance גלובלי
if (typeof window !== 'undefined') {
  window.AdminAPI = AdminAPI;
  console.log('✅ AdminAPI class available globally');
}
