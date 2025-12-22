/**
 * Task Approval Service
 * שירות אישור תקציב משימות
 */

export class TaskApprovalService {
  constructor() {
    this.db = null;
    this.currentUser = null;
  }

  init(db, currentUser) {
    this.db = db;
    this.currentUser = currentUser;
    console.log('✅ TaskApprovalService initialized');
  }

  async createApprovalRequest(taskId, taskData, requestedBy, requestedByName) {
    try {
      const approvalData = {
        taskId,
        requestedBy,
        requestedByName: requestedByName || requestedBy,
        requestedAt: new Date(),
        requestedMinutes: parseInt(taskData.estimatedMinutes) || 0, // ✅ הוסף שדה זה!
        taskData: {
          description: taskData.description || '',
          clientId: taskData.clientId || '',
          clientName: taskData.clientName || '',
          caseId: taskData.caseId || '',
          estimatedMinutes: parseInt(taskData.estimatedMinutes) || 0
        },
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        approvedMinutes: null,
        adminNotes: null,
        rejectionReason: null
      };

      const docRef = await this.db.collection('pending_task_approvals').add(approvalData);
      console.log('✅ Approval request created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating approval request:', error);
      throw error;
    }
  }

  /**
   * ✅ Get approvals by status with cursor-based pagination
   * @param {string} status - Status to filter by ('all', 'pending', 'approved', 'rejected')
   * @param {number} limit - Number of items to fetch
   * @param {DocumentSnapshot} startAfterDoc - Firestore document cursor for pagination
   * @returns {Object} - { approvals: [], lastDocument: DocumentSnapshot, hasMore: boolean }
   */
  async getApprovalsByStatus(status = 'pending', limit = 5, startAfterDoc = null) {
    try {
      let query = this.db.collection('pending_task_approvals');

      if (status !== 'all') {
        query = query.where('status', '==', status);
      }

      // ✅ Order by createdAt (newer field) or requestedAt (fallback)
      query = query.orderBy('createdAt', 'desc');

      // ✅ Apply cursor pagination if provided
      if (startAfterDoc) {
        query = query.startAfter(startAfterDoc);
      }

      // ✅ Fetch limit+1 to check if there are more records
      query = query.limit(limit + 1);
      const snapshot = await query.get();

      // ✅ Check if there are more records
      const hasMore = snapshot.docs.length > limit;
      const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

      const approvals = docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        requestedAt: doc.data().requestedAt?.toDate() || doc.data().createdAt?.toDate() || null,
        reviewedAt: doc.data().reviewedAt?.toDate() || null,
        createdAt: doc.data().createdAt?.toDate() || null
      }))
      // ✅ Filter out old pending approvals (before auto-approval system)
      // Only show: auto-approved, rejected, or approved tasks
      .filter(approval => {
        // If status is 'pending', only show if it has autoApproved flag
        if (approval.status === 'pending') {
          return approval.autoApproved === true;
        }
        // Show all approved/rejected
        return true;
      });

      // ✅ Get last document for next pagination
      const lastDocument = docs.length > 0 ? docs[docs.length - 1] : null;

      console.log(`📊 Loaded ${approvals.length} approvals (hasMore: ${hasMore})`);

      return {
        approvals,
        lastDocument,
        hasMore
      };
    } catch (error) {
      console.error('❌ Error loading approvals:', error);
      // ✅ Fallback: try with requestedAt if createdAt index doesn't exist
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        console.warn('⚠️ Falling back to requestedAt ordering');
        try {
          let fallbackQuery = this.db.collection('pending_task_approvals');
          if (status !== 'all') {
            fallbackQuery = fallbackQuery.where('status', '==', status);
          }
          fallbackQuery = fallbackQuery.orderBy('requestedAt', 'desc');

          if (startAfterDoc) {
            fallbackQuery = fallbackQuery.startAfter(startAfterDoc);
          }

          fallbackQuery = fallbackQuery.limit(limit + 1);
          const fallbackSnapshot = await fallbackQuery.get();

          const hasMore = fallbackSnapshot.docs.length > limit;
          const docs = hasMore ? fallbackSnapshot.docs.slice(0, limit) : fallbackSnapshot.docs;

          const approvals = docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            requestedAt: doc.data().requestedAt?.toDate() || doc.data().createdAt?.toDate() || null,
            reviewedAt: doc.data().reviewedAt?.toDate() || null,
            createdAt: doc.data().createdAt?.toDate() || null
          }))
          // ✅ Filter out old pending approvals (before auto-approval system)
          .filter(approval => {
            if (approval.status === 'pending') {
              return approval.autoApproved === true;
            }
            return true;
          });

          const lastDocument = docs.length > 0 ? docs[docs.length - 1] : null;

          console.log(`📊 Loaded ${approvals.length} approvals with fallback (hasMore: ${hasMore})`);

          return {
            approvals,
            lastDocument,
            hasMore
          };
        } catch (fallbackError) {
          console.error('❌ Fallback query also failed:', fallbackError);
          throw fallbackError;
        }
      }
      throw error;
    }
  }

  async approveRequest(approvalId, approvedMinutes, adminNotes = '') {
    try {
      // Support both main app and master-admin-panel
      const functions = window.firebaseFunctions || window.firebase?.functions();
      if (!functions) {
        throw new Error('Firebase Functions not initialized');
      }

      const approveTaskBudget = functions.httpsCallable('approveTaskBudget');
      const result = await approveTaskBudget({
        approvalId,
        approvedMinutes,
        adminNotes
      });

      console.log('✅ Task approved via Cloud Function:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error approving request:', error);
      throw error;
    }
  }

  async rejectRequest(approvalId, rejectionReason) {
    try {
      // Support both main app and master-admin-panel
      const functions = window.firebaseFunctions || window.firebase?.functions();
      if (!functions) {
        throw new Error('Firebase Functions not initialized');
      }

      const rejectTaskBudget = functions.httpsCallable('rejectTaskBudget');
      const result = await rejectTaskBudget({
        approvalId,
        rejectionReason
      });

      console.log('✅ Task rejected via Cloud Function:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error rejecting request:', error);
      throw error;
    }
  }

  listenToPendingApprovals(callback) {
    return this.db.collection('pending_task_approvals')
      .where('status', '==', 'pending')
      .orderBy('requestedAt', 'desc')
      .onSnapshot(snapshot => {
        const approvals = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          requestedAt: doc.data().requestedAt?.toDate() || null
        }));
        callback(approvals);
      });
  }

  /**
   * 🔥 Real-time listener לכל הסטטוסים
   * מאזין לכל השינויים ב-pending_task_approvals
   */
  listenToAllApprovals(callback, status = 'all', limit = 50) {
    let query = this.db.collection('pending_task_approvals');

    // אם יש סינון לפי סטטוס
    if (status !== 'all') {
      query = query.where('status', '==', status);
    }

    query = query.orderBy('requestedAt', 'desc').limit(limit);

    return query.onSnapshot(snapshot => {
      const approvals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        requestedAt: doc.data().requestedAt?.toDate() || null,
        reviewedAt: doc.data().reviewedAt?.toDate() || null
      }))
      // ✅ Filter out old pending approvals (before auto-approval system)
      .filter(approval => {
        if (approval.status === 'pending') {
          return approval.autoApproved === true;
        }
        return true;
      });
      callback(approvals);
    }, error => {
      console.error('❌ Real-time listener error:', error);
    });
  }
}

export const taskApprovalService = new TaskApprovalService();
