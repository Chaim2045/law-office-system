/**
 * Notification Bell System Module
 * Handles notification management, display, and user interactions
 *
 * Created: 2025
 * Part of Law Office Management System
 */

import { safeText } from './core-utils.js';

/**
 * NotificationBellSystem class
 * Manages the notification bell UI, dropdown, and notification list
 */
export class NotificationBellSystem {
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
  }

  /**
   * Start listening to admin messages from Firestore
   * @param {Object} user - Firebase user object with email
   * @param {Object} db - Firestore database instance
   */
  startListeningToAdminMessages(user, db) {
    if (!user || !db) {
      console.warn('NotificationBell: Cannot listen to messages - user or db missing');
      return;
    }

    this.currentUser = user;

    // Listen to user_messages collection - ONLY unread messages
    // Once read/dismissed, messages are not shown again (no history)
    this.messagesListener = db.collection('user_messages')
      .where('to', '==', user.email)
      .where('status', '==', 'unread')
      .orderBy('createdAt', 'desc')
      .onSnapshot(
        snapshot => {
          console.log(`📨 NotificationBell: Received ${snapshot.size} admin messages`);

          // Remove old admin messages from notifications
          this.notifications = this.notifications.filter(n => !n.isAdminMessage);

          // Convert to array and sort by createdAt (newest first)
          const messages = snapshot.docs
            .map(doc => {
              const data = doc.data();
              return {
                id: 'msg_' + doc.id,
                type: data.type || 'info',
                title: `📩 הודעה מ-${data.fromName || 'מנהל'}`,
                description: data.message,
                time: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString('he-IL') : '',
                urgent: data.priority >= 5,
                isAdminMessage: true,
                messageId: doc.id,
                status: data.status,
                timestamp: data.createdAt ? data.createdAt.toMillis() : 0
              };
            })
            .sort((a, b) => b.timestamp - a.timestamp); // Sort newest first

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

    console.log('✅ NotificationBell: Listening to admin messages for', user.email);
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

    // If it's an admin message, update status in Firestore to 'dismissed'
    if (notification && notification.isAdminMessage && notification.messageId) {
      try {
        if (window.firebaseDB) {
          await window.firebaseDB.collection('user_messages')
            .doc(notification.messageId)
            .update({
              status: 'dismissed',
              dismissedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          console.log(`✅ Message ${notification.messageId} dismissed`);
        }
      } catch (error) {
        console.error('Error dismissing message:', error);
      }
    }

    // Remove from local array (will be removed from Firestore listener automatically)
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.updateBell();
    this.renderNotifications();
    this.updateMessagesIconBadge();
  }

  async clearAllNotifications() {
    // Dismiss all admin messages in Firestore
    const adminMessages = this.notifications.filter(n => n.isAdminMessage && n.messageId);

    if (adminMessages.length > 0 && window.firebaseDB) {
      try {
        const batch = window.firebaseDB.batch();
        adminMessages.forEach(msg => {
          const ref = window.firebaseDB.collection('user_messages').doc(msg.messageId);
          batch.update(ref, {
            status: 'dismissed',
            dismissedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        await batch.commit();
        console.log(`✅ Dismissed ${adminMessages.length} messages`);
      } catch (error) {
        console.error('Error dismissing messages:', error);
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
}

export default NotificationBellSystem;
