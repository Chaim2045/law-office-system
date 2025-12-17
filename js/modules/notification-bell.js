/**
 * Notification Bell System Module
 * Handles notification management, display, and user interactions
 *
 * Created: 2025
 * Part of Law Office Management System
 */

// Helper function: safeText (inline to avoid import issues)
function safeText(text) {
  if (!text) {
return '';
}
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * NotificationBellSystem class
 * Manages the notification bell UI, dropdown, and notification list
 */
class NotificationBellSystem {
  constructor() {
    this.notifications = [];
    this.isDropdownOpen = false;
    this.clickHandler = null;
    this.messagesListener = null;
    this.currentUser = null;
    this.init();
  }

  init() {
    this.clickHandler = (e) => {
      const bell = document.getElementById('notificationBell');
      const dropdown = document.getElementById('notificationsDropdown');
      if (
        bell &&
        dropdown &&
        !bell.contains(e.target) &&
        !dropdown.contains(e.target)
      ) {
        this.hideDropdown();
      }
    };
    document.addEventListener('click', this.clickHandler);
  }

  cleanup() {
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }
    if (this.messagesListener) {
      this.messagesListener();
      this.messagesListener = null;
    }
    if (this.taskApprovalListener) {
      this.taskApprovalListener();
      this.taskApprovalListener = null;
    }
  }

  /**
   * Start listening to admin messages from Firestore
   * @param {Object} user - Firebase user object with email
   * @param {Object} db - Firestore database instance
   */
  startListeningToAdminMessages(user, db) {
    // ════════════════════════════════════════════════════════════════════════
    // 🔧 GUARD ADDED (2025-12-17) - Prevent duplicate listeners
    // ════════════════════════════════════════════════════════════════════════
    // If listeners already active, skip setup to prevent:
    // - Multiple listeners on user_messages collection
    // - Duplicate notification callbacks
    // - Excessive Firestore reads (cost optimization)
    // - Memory leaks from unmanaged listeners
    if (this.messagesListener || this.taskApprovalListener) {
      console.warn('⚠️ NotificationBell: Listeners already active, skipping setup');
      return;
    }

    if (!user || !db) {
      console.warn('NotificationBell: Cannot listen to messages - user or db missing');
      return;
    }

    this.currentUser = user;

    // ═══════════════════════════════════════════════════════════════════════════
    // Listen to user_messages collection - NEW THREAD MODEL
    // ═══════════════════════════════════════════════════════════════════════════
    // Shows messages with:
    // ✅ type: 'admin_to_user' (new model only)
    // ✅ status: 'sent' or 'responded' (active messages)
    // ❌ Excludes: status: 'dismissed' (user dismissed)
    // ❌ Excludes: old model messages (no type field or type !== 'admin_to_user')
    this.messagesListener = db.collection('user_messages')
      .where('to', '==', user.email)
      .where('type', '==', 'admin_to_user')  // ✅ Only new model messages
      .orderBy('createdAt', 'desc')
      .limit(50)  // Reasonable limit for performance
      .onSnapshot(
        snapshot => {
          console.log(`📨 NotificationBell: Received ${snapshot.size} admin messages (new model)`);

          // Remove old admin messages from notifications
          this.notifications = this.notifications.filter(n => !n.isAdminMessage);

          // Filter and convert to notification format
          const messages = snapshot.docs
            .filter(doc => {
              const data = doc.data();
              // Only show active messages (not dismissed)
              return data.status === 'unread' || data.status === 'sent' || data.status === 'responded';
            })
            .map(doc => {
              const data = doc.data();

              // ✅ Check if has unread replies:
              // - Has replies (repliesCount > 0)
              // - Last reply was by admin (lastReplyBy !== user.email)
              // - User hasn't read the last reply yet (userReadLastReply !== true)
              const hasUnreadReplies = (
                data.repliesCount > 0 &&
                data.lastReplyBy &&
                data.lastReplyBy !== user.email &&
                data.userReadLastReply !== true
              );

              return {
                id: 'msg_' + doc.id,
                type: data.type || 'info',
                title: `📩 הודעה מ-${data.fromName || 'מנהל'}`,
                description: data.message,
                message: data.message, // ✅ Add message field for compatibility
                category: data.category || 'info', // ✅ Category
                subject: data.subject || null,     // ✅ Subject
                time: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString('he-IL') : '',
                urgent: hasUnreadReplies,  // Mark as urgent if has unread replies
                hasUnreadReplies: hasUnreadReplies, // ✅ Explicit flag for UI
                isAdminMessage: true,
                messageId: doc.id,
                status: data.status,
                repliesCount: data.repliesCount || 0,
                lastReplyAt: data.lastReplyAt?.toMillis() || 0,
                lastReplyBy: data.lastReplyBy,
                createdAt: data.createdAt?.toMillis() || 0,
                timestamp: data.createdAt ? data.createdAt.toMillis() : 0
              };
            })
            .sort((a, b) => b.timestamp - a.timestamp); // Sort newest first

          console.log(`✅ Filtered to ${messages.length} active messages`);

          // Add sorted messages to notifications
          messages.forEach(notification => {
            this.notifications.unshift(notification);
          });

          // Update UI once after all messages are added
          this.updateBell();
          this.renderNotifications();

          // Update messages icon badge
          this.updateMessagesIconBadge();
        },
        error => {
          console.error('NotificationBell: Error listening to admin messages:', error);
        }
      );

    console.log('✅ NotificationBell: Listening to NEW MODEL admin messages for', user.email);

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔥 Listen to task approval notifications
    // ═══════════════════════════════════════════════════════════════════════════
    // Shows messages with:
    // ✅ type: 'task_approval' (budget approved/rejected messages)
    // ✅ status: 'unread' (new approval notifications)
    this.taskApprovalListener = db.collection('user_messages')
      .where('to', '==', user.email)
      .where('type', '==', 'task_approval')
      .where('status', '==', 'unread')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .onSnapshot(
        snapshot => {
          console.log(`✅ NotificationBell: Received ${snapshot.size} task approval notifications`);

          // Remove old task approval notifications
          this.notifications = this.notifications.filter(n => !n.isTaskApproval);

          // Convert to notification format
          const approvalNotifications = snapshot.docs.map(doc => {
            const data = doc.data();

            return {
              id: 'approval_' + doc.id,
              type: 'success',
              title: '✅ אישור תקציב',
              description: data.message,
              time: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString('he-IL') : '',
              urgent: true,  // Always show as urgent
              isTaskApproval: true,
              messageId: doc.id,
              taskId: data.taskId,
              approvalId: data.approvalId,
              timestamp: data.createdAt ? data.createdAt.toMillis() : 0
            };
          }).sort((a, b) => b.timestamp - a.timestamp);

          console.log(`✅ Filtered to ${approvalNotifications.length} task approval notifications`);

          // Add sorted notifications
          approvalNotifications.forEach(notification => {
            this.notifications.unshift(notification);
          });

          // Update UI
          this.updateBell();
          this.renderNotifications();
        },
        error => {
          console.error('NotificationBell: Error listening to task approvals:', error);
        }
      );

    console.log('✅ NotificationBell: Listening to task approval notifications for', user.email);
  }

  /**
   * Add admin message to notifications
   */
  addAdminMessage(messageId, data) {
    const notification = {
      id: 'msg_' + messageId,
      type: data.type || 'info',
      title: `📩 הודעה מ-${data.fromName || 'מנהל'}`,
      description: data.message,
      time: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString('he-IL') : '',
      urgent: data.priority >= 5,
      isAdminMessage: true,
      messageId: messageId,
      status: data.status
    };

    this.notifications.unshift(notification);
    this.updateBell();
    this.renderNotifications();
  }

  addNotification(type, title, description, urgent = false) {
    const notification = {
      id: Date.now() + Math.random(),
      type,
      title,
      description,
      time: new Date().toLocaleString('he-IL'),
      urgent
    };
    this.notifications.unshift(notification);
    this.updateBell();
    this.renderNotifications();
  }

  async removeNotification(id) {
    // Find the notification
    const notification = this.notifications.find(n => n.id === id);

    // If it's an admin message OR task approval notification, update status in Firestore to 'dismissed'
    if (notification && (notification.isAdminMessage || notification.isTaskApproval) && notification.messageId) {
      try {
        if (window.firebaseDB) {
          await window.firebaseDB.collection('user_messages')
            .doc(notification.messageId)
            .update({
              status: 'dismissed',
              dismissedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          console.log(`✅ ${notification.isTaskApproval ? 'Task approval notification' : 'Message'} ${notification.messageId} dismissed`);
        }
      } catch (error) {
        console.error('Error dismissing notification:', error);
      }
    }

    // Remove from local array (will be removed from Firestore listener automatically)
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.updateBell();
    this.renderNotifications();
    this.updateMessagesIconBadge();
  }

  async clearAllNotifications() {
    // Dismiss all admin messages AND task approval notifications in Firestore
    const dismissableNotifications = this.notifications.filter(n =>
      (n.isAdminMessage || n.isTaskApproval) && n.messageId
    );

    if (dismissableNotifications.length > 0 && window.firebaseDB) {
      try {
        const batch = window.firebaseDB.batch();
        dismissableNotifications.forEach(notif => {
          const ref = window.firebaseDB.collection('user_messages').doc(notif.messageId);
          batch.update(ref, {
            status: 'dismissed',
            dismissedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        await batch.commit();
        console.log(`✅ Dismissed ${dismissableNotifications.length} notifications (admin messages + task approvals)`);
      } catch (error) {
        console.error('Error dismissing notifications:', error);
      }
    }

    // Clear local array
    this.notifications = [];
    this.updateBell();
    this.renderNotifications();
    this.updateMessagesIconBadge();
  }

  /**
   * Update messages icon badge (blue envelope in top bar and AI chat)
   */
  updateMessagesIconBadge() {
    // Count unread admin messages
    const unreadAdminCount = this.notifications.filter(n =>
      n.isAdminMessage === true && n.status === 'unread'
    ).length;

    // Update top bar badge (if exists)
    const topBarBadge = document.getElementById('messagesCountBadge');
    if (topBarBadge) {
      if (unreadAdminCount > 0) {
        topBarBadge.textContent = unreadAdminCount;
        topBarBadge.classList.remove('hidden');
      } else {
        topBarBadge.classList.add('hidden');
      }
    }

    // Update AI chat messages badge (envelope)
    const aiMessagesBadge = document.getElementById('aiMessagesBadge');
    if (aiMessagesBadge) {
      if (unreadAdminCount > 0) {
        aiMessagesBadge.textContent = unreadAdminCount;
        aiMessagesBadge.style.display = 'flex';
      } else {
        aiMessagesBadge.style.display = 'none';
      }
    }

    // Update AI chat notifications badge (bell) - only system notifications
    const systemNotificationsCount = this.notifications.filter(n =>
      n.isAdminMessage !== true
    ).length;

    const aiNotificationBadge = document.getElementById('aiNotificationBadge');
    if (aiNotificationBadge) {
      if (systemNotificationsCount > 0) {
        aiNotificationBadge.textContent = systemNotificationsCount;
        aiNotificationBadge.style.display = 'flex';
      } else {
        aiNotificationBadge.style.display = 'none';
      }
    }

    // Update AI floating button badge (shows total unread: admin + system)
    const totalUnreadCount = unreadAdminCount + systemNotificationsCount;
    const aiFloatBadge = document.getElementById('aiFloatNotificationBadge');
    if (aiFloatBadge) {
      if (totalUnreadCount > 0) {
        aiFloatBadge.textContent = totalUnreadCount;
        aiFloatBadge.style.display = 'flex';
      } else {
        aiFloatBadge.style.display = 'none';
      }
    }
  }

  updateBell() {
    const bell = document.getElementById('notificationBell');
    const count = document.getElementById('notificationCount');
    if (bell && count) {
      // Count ONLY system notifications (not admin messages)
      const systemNotificationsCount = this.notifications.filter(n =>
        n.isAdminMessage !== true
      ).length;

      if (systemNotificationsCount > 0) {
        bell.classList.add('has-notifications');
        count.classList.remove('hidden');
        count.textContent = systemNotificationsCount;
      } else {
        bell.classList.remove('has-notifications');
        count.classList.add('hidden');
      }
    }
  }

  showDropdown() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) {
      dropdown.classList.add('show');
      this.isDropdownOpen = true;
    }
  }

  hideDropdown() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) {
      dropdown.classList.remove('show');
      this.isDropdownOpen = false;
    }
  }

  toggleDropdown() {
    this.isDropdownOpen ? this.hideDropdown() : this.showDropdown();
  }

  renderNotifications() {
    const container = document.getElementById('notificationsContent');
    if (!container) {
return;
}

    if (this.notifications.length === 0) {
      container.innerHTML = `
        <div class="no-notifications">
          <div class="no-notifications-icon"><i class="fas fa-bell-slash"></i></div>
          <h4>אין התראות</h4>
          <p>כל ההתראות יופיעו כאן</p>
        </div>
      `;
      return;
    }

    const iconMap = {
      blocked: 'fas fa-ban',
      critical: 'fas fa-exclamation-triangle',
      urgent: 'fas fa-clock'
    };

    const notificationsHtml = this.notifications
      .map((notification) => {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = `notification-item ${notification.type} ${
          notification.urgent ? 'urgent' : ''
        }`;
        notificationDiv.id = `notification-${notification.id}`;

        // Check if this is an admin message
        const replyButton = notification.isAdminMessage ? `
          <button class="notification-reply-btn" onclick="notificationBell.openReplyModal('${notification.messageId}', '${safeText(notification.description).replace(/'/g, "\\'")}', '${safeText(notification.title).replace(/'/g, "\\'")}')">
            <i class="fas fa-reply"></i> השב
          </button>
        ` : '';

        notificationDiv.innerHTML = `
          <button class="notification-close" onclick="notificationBell.removeNotification('${notification.id}')">
            <i class="fas fa-times"></i>
          </button>
          <div class="notification-content">
            <div class="notification-icon ${notification.type}">
              <i class="${
                iconMap[notification.type] || 'fas fa-info-circle'
              }"></i>
            </div>
            <div class="notification-text">
              <div class="notification-title">${safeText(
                notification.title
              )}</div>
              <div class="notification-description">${safeText(
                notification.description
              )}</div>
              <div class="notification-time">${safeText(
                notification.time
              )}</div>
            </div>
          </div>
          ${replyButton}
        `;
        return notificationDiv.outerHTML;
      })
      .join('');

    container.innerHTML = notificationsHtml;
  }

  updateFromSystem(blockedClientsData, criticalClientsData, urgentTasks) {
    // מחיקת התראות ישנות שנוצרו על ידי המערכת
    this.notifications = this.notifications.filter((n) => !n.isSystemGenerated);

    // התראות נפרדות לכל לקוח חסום (עם פירוט שעות)
    if (blockedClientsData && blockedClientsData.length > 0) {
      blockedClientsData.forEach(client => {
        const hoursText = client.hoursRemaining !== undefined
          ? ` (${client.hoursRemaining.toFixed(1)} שעות נותרו)`
          : '';

        this.addSystemNotification(
          'blocked',
          `🚫 לקוח חסום: ${client.name}`,
          `נגמרה יתרת השעות${hoursText} - לא ניתן לרשום שעות נוספות`,
          true
        );
      });
    }

    // התראות נפרדות לכל לקוח קריטי (עם מספר שעות מדויק)
    if (criticalClientsData && criticalClientsData.length > 0) {
      criticalClientsData.forEach(client => {
        const hoursRemaining = client.hoursRemaining.toFixed(1);

        this.addSystemNotification(
          'critical',
          `⚠️ שעות אוזלות: ${client.name}`,
          `נותרו ${hoursRemaining} שעות בלבד - יש ליידע את הלקוח ולהוסיף שעות`,
          false
        );
      });
    }

    // התראות נפרדות לכל משימה דחופה (עם פירוט ימי איחור/יעד)
    if (urgentTasks && urgentTasks.length > 0) {
      const now = new Date();
      now.setHours(0, 0, 0, 0); // איפוס לתחילת היום לחישוב ימים מדויק

      urgentTasks.forEach(task => {
        const deadline = new Date(task.deadline);
        deadline.setHours(0, 0, 0, 0);

        const diffTime = now - deadline;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let title, description, isUrgent;

        if (diffDays > 0) {
          // עבר תאריך היעד
          title = `🔴 משימה באיחור: ${task.description || 'ללא תיאור'}`;
          description = `עבר ${diffDays} ${diffDays === 1 ? 'יום' : 'ימים'} מתאריך היעד${task.clientName ? ` | לקוח: ${task.clientName}` : ''}`;
          isUrgent = true;
        } else if (diffDays === 0) {
          // היום הוא תאריך היעד
          title = `⏰ משימה דחופה: ${task.description || 'ללא תיאור'}`;
          description = `תאריך היעד היום!${task.clientName ? ` | לקוח: ${task.clientName}` : ''}`;
          isUrgent = true;
        } else {
          // תאריך יעד מחר (תוך 24 שעות)
          title = `📅 משימה מתקרבת: ${task.description || 'ללא תיאור'}`;
          description = `תאריך יעד מחר${task.clientName ? ` | לקוח: ${task.clientName}` : ''}`;
          isUrgent = false;
        }

        this.addSystemNotification(
          'urgent',
          title,
          description,
          isUrgent
        );
      });
    }
  }

  addSystemNotification(type, title, description, urgent) {
    const notification = {
      id: Date.now() + Math.random(),
      type,
      title,
      description,
      time: new Date().toLocaleString('he-IL'),
      urgent,
      isSystemGenerated: true
    };
    this.notifications.unshift(notification);
    this.updateBell();
    this.renderNotifications();
  }

  /**
   * Open reply modal for admin message
   */
  openReplyModal(messageId, message, title) {
    // Use the UserReplyModal if available
    if (window.userReplyModal && window.userReplyModal.open) {
      window.userReplyModal.open(messageId, message, () => {
        // Callback after successful send - remove notification
        this.removeNotification('msg_' + messageId);
      });
    } else {
      // Fallback: Simple prompt
      console.warn('⚠️ UserReplyModal not available, using fallback prompt');
      const response = prompt(`תגובה ל: ${title}\n\nהודעה: ${message}\n\nהתגובה שלך:`);
      if (response && response.trim()) {
        this.sendResponse(messageId, response.trim());
      }
    }
  }

  /**
   * Send response to admin message
   */
  async sendResponse(messageId, response) {
    if (!window.firebaseDB) {
      alert('שגיאה: Firebase לא זמין');
      return;
    }

    try {
      await window.firebaseDB.collection('user_messages')
        .doc(messageId)
        .update({
          response: response,
          status: 'responded',
          respondedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      if (window.notify) {
        window.notify.success('התגובה נשלחה בהצלחה');
      } else {
        alert('התגובה נשלחה בהצלחה!');
      }

      // Remove from notifications
      this.removeNotification('msg_' + messageId);
    } catch (error) {
      console.error('Error sending response:', error);
      if (window.notify) {
        window.notify.error('שגיאה בשליחת התגובה');
      } else {
        alert('שגיאה בשליחת התגובה');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Thread-Based Messaging API (NEW - 2025-12-07)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send a reply to an admin message (using subcollection)
   * @param {string} messageId - Parent message ID
   * @param {string} replyText - Reply content
   * @param {Object} user - Current user object { email, displayName }
   * @returns {Promise<string>} - Reply document ID
   */
  async sendReplyToAdmin(messageId, replyText, user) {
    if (!messageId || !replyText || !user) {
      throw new Error('Missing required parameters: messageId, replyText, or user');
    }

    if (!window.firebaseDB) {
      throw new Error('Firebase DB not available');
    }

    try {
      // Add reply to subcollection
      const replyRef = await window.firebaseDB
        .collection('user_messages')
        .doc(messageId)
        .collection('replies')
        .add({
          from: user.email,
          fromName: user.displayName || user.email,
          message: replyText.trim(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          readBy: [] // Track who read this reply
        });

      // Update parent document with metadata
      await window.firebaseDB
        .collection('user_messages')
        .doc(messageId)
        .update({
          repliesCount: firebase.firestore.FieldValue.increment(1),
          lastReplyAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastReplyBy: user.email,
          status: 'responded',
          userReadLastReply: true // ✅ User sent the message, so they already read it
        });

      console.log(`✅ Reply sent successfully: ${replyRef.id}`);
      return replyRef.id;

    } catch (error) {
      console.error('❌ Error sending reply:', error);
      throw error;
    }
  }

  /**
   * Load all replies for a message thread
   * @param {string} messageId - Parent message ID
   * @returns {Promise<Array>} - Array of reply objects
   */
  async loadThreadReplies(messageId) {
    if (!messageId) {
      throw new Error('Missing messageId parameter');
    }

    if (!window.firebaseDB) {
      throw new Error('Firebase DB not available');
    }

    try {
      const snapshot = await window.firebaseDB
        .collection('user_messages')
        .doc(messageId)
        .collection('replies')
        .orderBy('createdAt', 'asc')
        .get();

      const replies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore Timestamp to JS Date for easier handling
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : null
      }));

      console.log(`📨 Loaded ${replies.length} replies for message ${messageId}`);
      return replies;

    } catch (error) {
      console.error('❌ Error loading replies:', error);
      throw error;
    }
  }

  /**
   * Listen to real-time updates for a message thread
   * @param {string} messageId - Parent message ID
   * @param {Function} callback - Called with array of replies when updated
   * @returns {Function} - Unsubscribe function
   */
  listenToThreadReplies(messageId, callback) {
    if (!messageId || !callback) {
      throw new Error('Missing required parameters: messageId or callback');
    }

    if (!window.firebaseDB) {
      throw new Error('Firebase DB not available');
    }

    try {
      const unsubscribe = window.firebaseDB
        .collection('user_messages')
        .doc(messageId)
        .collection('replies')
        .orderBy('createdAt', 'asc')
        .onSnapshot(
          snapshot => {
            const replies = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : null
            }));

            console.log(`🔄 Thread updated: ${replies.length} replies`);
            callback(replies);
          },
          error => {
            console.error('❌ Error in thread listener:', error);
            // Call callback with empty array on error
            callback([]);
          }
        );

      console.log(`👂 Listening to thread: ${messageId}`);
      return unsubscribe;

    } catch (error) {
      console.error('❌ Error setting up thread listener:', error);
      throw error;
    }
  }
}

// Export to window for global access
window.NotificationBellSystem = NotificationBellSystem;

// Auto-initialize for regular script loading
window.notificationBell = new NotificationBellSystem();
console.log('✅ NotificationBell initialized successfully');
