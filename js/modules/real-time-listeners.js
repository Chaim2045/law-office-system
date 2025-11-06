/**
 * Real-time Listeners System
 * מערכת מאזינים בזמן אמת ל-Firestore
 *
 * Created: 6/11/2025
 * Version: 1.0.0
 *
 * תכונות:
 * ✅ Real-time tasks listener
 * ✅ Real-time notifications listener
 * ✅ Auto-cleanup on disconnect
 * ✅ Performance optimization
 */

/**
 * Manager for real-time listeners
 * מנהל מאזינים - מונע memory leaks
 */
class RealTimeListenerManager {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Register a listener
   * @param {string} name - Listener name
   * @param {Function} unsubscribe - Firestore unsubscribe function
   */
  register(name, unsubscribe) {
    // Cleanup existing listener if exists
    if (this.listeners.has(name)) {
      this.listeners.get(name)();
    }
    this.listeners.set(name, unsubscribe);
    console.log(`✅ Listener registered: ${name}`);
  }

  /**
   * Unregister a listener
   * @param {string} name - Listener name
   */
  unregister(name) {
    if (this.listeners.has(name)) {
      this.listeners.get(name)();
      this.listeners.delete(name);
      console.log(`🔌 Listener unregistered: ${name}`);
    }
  }

  /**
   * Cleanup all listeners
   */
  cleanup() {
    this.listeners.forEach((unsubscribe, name) => {
      console.log(`🧹 Cleaning up listener: ${name}`);
      unsubscribe();
    });
    this.listeners.clear();
  }
}

// Global listener manager
const listenerManager = new RealTimeListenerManager();

/**
 * Start listening to budget tasks in real-time
 * התחלת האזנה למשימות בזמן אמת
 *
 * @param {string} employee - Email of employee
 * @param {Function} onUpdate - Callback when tasks update
 * @param {Function} onError - Callback on error
 * @returns {Function} Unsubscribe function
 */
export function startTasksListener(employee, onUpdate, onError) {
  try {
    const db = window.firebaseDB;
    if (!db) {
      throw new Error('Firebase לא מחובר');
    }

    console.log(`🎧 Starting real-time tasks listener for: ${employee}`);

    const unsubscribe = db
      .collection('budget_tasks')
      .where('employee', '==', employee)
      .limit(50)
      .onSnapshot(
        (snapshot) => {
          console.log(`📡 Tasks update received: ${snapshot.docs.length} tasks`);

          const tasks = [];

          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              console.log(`  ${change.type === 'added' ? '➕' : '✏️'} Task ${change.doc.id}`);
            }
            if (change.type === 'removed') {
              console.log(`  ➖ Task ${change.doc.id} removed`);
            }
          });

          snapshot.forEach((doc) => {
            const data = doc.data();

            // Convert Firebase Timestamps to JavaScript Date objects
            const taskWithFirebaseId = {
              ...data,
              firebaseDocId: doc.id,
              id: data.id || doc.id,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : data.createdAt),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : data.updatedAt),
              completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : (data.completedAt ? new Date(data.completedAt) : data.completedAt),
              deadline: data.deadline?.toDate ? data.deadline.toDate() : (data.deadline ? new Date(data.deadline) : data.deadline),
              lastModifiedAt: data.lastModifiedAt?.toDate ? data.lastModifiedAt.toDate() : (data.lastModifiedAt ? new Date(data.lastModifiedAt) : data.lastModifiedAt)
            };

            tasks.push(taskWithFirebaseId);
          });

          // Call update callback
          if (onUpdate) {
            onUpdate(tasks);
          }
        },
        (error) => {
          console.error('❌ Tasks listener error:', error);
          if (onError) {
            onError(error);
          }
        }
      );

    // Register listener for cleanup
    listenerManager.register('tasks', unsubscribe);

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error starting tasks listener:', error);
    if (onError) {
      onError(error);
    }
    return () => {}; // Return noop function
  }
}

/**
 * Start listening to notifications in real-time
 * התחלת האזנה להתראות בזמן אמת
 *
 * @param {string} userEmail - Email of user
 * @param {Function} onUpdate - Callback when notifications update
 * @param {Function} onError - Callback on error
 * @returns {Function} Unsubscribe function
 */
export function startNotificationsListener(userEmail, onUpdate, onError) {
  try {
    const db = window.firebaseDB;
    if (!db) {
      throw new Error('Firebase לא מחובר');
    }

    console.log(`🔔 Starting real-time notifications listener for: ${userEmail}`);

    const unsubscribe = db
      .collection('notifications')
      .where('userId', '==', userEmail)
      .where('read', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(
        (snapshot) => {
          console.log(`📬 Notifications update received: ${snapshot.docs.length} unread`);

          const notifications = [];

          // Check for new notifications
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              console.log(`  🆕 New notification: ${data.title}`);

              // Show toast notification for new items
              if (window.notify && data.urgent) {
                const type = data.type === 'critical' ? 'warning' : 'info';
                window.notify[type](data.title, data.message);
              }
            }
          });

          snapshot.forEach((doc) => {
            const data = doc.data();

            const notification = {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
              readAt: data.readAt?.toDate ? data.readAt.toDate() : null
            };

            notifications.push(notification);
          });

          // Call update callback
          if (onUpdate) {
            onUpdate(notifications);
          }
        },
        (error) => {
          console.error('❌ Notifications listener error:', error);
          if (onError) {
            onError(error);
          }
        }
      );

    // Register listener for cleanup
    listenerManager.register('notifications', unsubscribe);

    return unsubscribe;
  } catch (error) {
    console.error('❌ Error starting notifications listener:', error);
    if (onError) {
      onError(error);
    }
    return () => {}; // Return noop function
  }
}

/**
 * Stop all real-time listeners
 * עצירת כל המאזינים
 */
export function stopAllListeners() {
  console.log('🛑 Stopping all real-time listeners');
  listenerManager.cleanup();
}

/**
 * Stop specific listener
 * @param {string} name - Listener name ('tasks' or 'notifications')
 */
export function stopListener(name) {
  listenerManager.unregister(name);
}

// Export listener manager for advanced usage
export { listenerManager };

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopAllListeners();
});
