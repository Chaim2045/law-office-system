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

  async getApprovalsByStatus(status = 'pending', limit = 50) {
    try {
      let query = this.db.collection('pending_task_approvals');

      if (status !== 'all') {
        query = query.where('status', '==', status);
      }

      // ✅ Order by createdAt (newer field) or requestedAt (fallback)
      // Note: Firestore will use the most recent timestamp field available
      query = query.orderBy('createdAt', 'desc').limit(limit);
      const snapshot = await query.get();

      const approvals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        requestedAt: doc.data().requestedAt?.toDate() || doc.data().createdAt?.toDate() || null,
        reviewedAt: doc.data().reviewedAt?.toDate() || null,
        createdAt: doc.data().createdAt?.toDate() || null
      }));

      return approvals;
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
          fallbackQuery = fallbackQuery.orderBy('requestedAt', 'desc').limit(limit);
          const fallbackSnapshot = await fallbackQuery.get();

          const approvals = fallbackSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            requestedAt: doc.data().requestedAt?.toDate() || doc.data().createdAt?.toDate() || null,
            reviewedAt: doc.data().reviewedAt?.toDate() || null,
            createdAt: doc.data().createdAt?.toDate() || null
          }));

          return approvals;
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
      }));
      callback(approvals);
    }, error => {
      console.error('❌ Real-time listener error:', error);
    });
  }
}

export const taskApprovalService = new TaskApprovalService();
