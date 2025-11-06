/**
 * Notification Real-time Bridge
 * גשר בין Firestore notifications לבין notification bell
 *
 * Created: 6/11/2025
 * Version: 1.0.0
 *
 * תכונות:
 * ✅ מקשר בין notifications collection להתראות בפעמון
 * ✅ עדכון אוטומטי של הפעמון
 * ✅ טיפול בהתראות חדשות
 */

import { startNotificationsListener, stopListener } from './real-time-listeners.js';

/**
 * Initialize real-time notifications for bell
 * אתחול התראות בזמן אמת לפעמון
 *
 * @param {string} userEmail - Email של המשתמש
 * @param {Object} notificationBell - מופע של NotificationBellSystem
 */
export function initializeRealTimeNotifications(userEmail, notificationBell) {
  console.log(`🔔 Initializing real-time notifications for: ${userEmail}`);

  if (!userEmail || !notificationBell) {
    console.error('❌ Missing userEmail or notificationBell');
    return null;
  }

  // Start listening to notifications
  const unsubscribe = startNotificationsListener(
    userEmail,
    (notifications) => {
      // Update notification bell with new notifications
      console.log(`📬 Received ${notifications.length} notifications`);

      // Clear existing notifications in bell
      notificationBell.clearAllNotifications();

      // Add all notifications to bell
      notifications.forEach((notification) => {
        addNotificationToBell(notificationBell, notification);
      });
    },
    (error) => {
      console.error('❌ Notifications listener error:', error);
      window.notify?.error('שגיאה בטעינת התראות', 'נסה לרענן את הדף');
    }
  );

  return unsubscribe;
}

/**
 * Add notification to bell
 * הוספת התראה לפעמון
 *
 * @param {Object} notificationBell - NotificationBellSystem instance
 * @param {Object} notification - Notification from Firestore
 */
function addNotificationToBell(notificationBell, notification) {
  // Map notification type to bell type
  const bellType = notification.type || 'urgent';

  // Format message for display
  let description = notification.message;

  // Add changes details if exists
  if (notification.details?.changes && Array.isArray(notification.details.changes)) {
    const changesText = notification.details.changes
      .map(c => `• ${c.field}: ${c.oldValue} → ${c.newValue}`)
      .join('\n');

    description = `${notification.message}\n\n${changesText}`;
  }

  // Add to notification bell
  notificationBell.addNotification(
    bellType,
    notification.title,
    description,
    notification.urgent || false
  );

  // Store notification ID for marking as read later
  // Note: We'll need to enhance the bell to store notification IDs
  // For now, notifications will be marked as read manually
}

/**
 * Mark notification as read
 * סימון התראה כנקראה
 *
 * @param {string} notificationId - ID של ההתראה
 */
export async function markNotificationAsRead(notificationId) {
  try {
    if (!window.callFunction) {
      console.error('❌ callFunction not available');
      return;
    }

    const result = await window.callFunction('markNotificationAsRead', {
      notificationId: notificationId
    });

    if (result.success) {
      console.log(`✅ Notification ${notificationId} marked as read`);
    }
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
  }
}

/**
 * Stop notifications listener
 * עצירת מאזין ההתראות
 */
export function stopNotificationsListener() {
  stopListener('notifications');
}
