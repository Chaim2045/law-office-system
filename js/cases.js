/**
 * Cases Module - מודול ניהול תיקים
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 16/10/2025
 * גרסה: 1.0.0
 *
 * תכונות:
 * - יצירת תיקים חדשים (עם לקוח חדש או קיים)
 * - שליפת תיקים עם סינונים (לפי לקוח, סטטוס, עו"ד)
 * - עדכון פרטי תיקים
 * - תצוגה חזותית של תיקים (כרטיסיות וטבלאות)
 * - חישוב סטטיסטיקות (שעות נותרות, תיקים פעילים)
 * - אינטגרציה מלאה עם Firebase Functions
 */

(function() {
  'use strict';

  /**
   * מחלקת CasesManager - מנהלת תיקים
   */
  class CasesManager {
    constructor() {
      this.cases = [];
      this.clients = [];
      this.currentUser = null;
    }

    /**
     * אתחול המנהל
     * @param {Object} user - המשתמש המחובר
     */
    init(user) {
      this.currentUser = user;
      console.log('📂 CasesManager initialized for user:', user.username);
    }

    // ==================== Firebase Functions API ====================

    /**
     * יצירת תיק חדש
     * @param {Object} caseData - נתוני התיק
     * @returns {Promise<Object>} התיק שנוצר
     */
    async createCase(caseData) {
      try {
        console.log('📝 Creating new case:', caseData);

        // ✅ במבנה החדש: createClient (Client=Case)
        const result = await firebase.functions().httpsCallable('createClient')(caseData);

        if (!result.data.success) {
          throw new Error(result.data.message || 'שגיאה ביצירת תיק');
        }

        console.log('✅ Case created successfully:', result.data.id);
        return result.data;

      } catch (error) {
        console.error('❌ Error creating case:', error);
        throw new Error(this.getErrorMessage(error));
      }
    }

    /**
     * שליפת תיקים עם סינונים
     * @param {Object} filters - סינונים (clientId, status, assignedTo)
     * @returns {Promise<Array>} רשימת תיקים
     */
    async getCases(filters = {}) {
      try {
        console.log('📋 Fetching cases with filters:', filters);

        // ✅ במבנה החדש: getClients (Client=Case)
        const result = await firebase.functions().httpsCallable('getClients')(filters);

        if (!result.data.success) {
          throw new Error(result.data.message || 'שגיאה בשליפת תיקים');
        }

        this.cases = result.data.clients || [];
        console.log(`✅ Fetched ${this.cases.length} cases`);
        return this.cases;

      } catch (error) {
        console.error('❌ Error fetching cases:', error);
        throw new Error(this.getErrorMessage(error));
      }
    }

    /**
     * שליפת כל התיקים של לקוח מסוים
     * @param {string} clientId - מזהה הלקוח
     * @returns {Promise<Object>} נתוני הלקוח והתיקים שלו
     */
    async getCasesByClient(clientId) {
      try {
        console.log('📋 Fetching cases for client:', clientId);

        // ✅ במבנה החדש Client=Case: לקוח אחד = תיק אחד
        // פשוט נחזיר את הlokent הזה
        const db = firebase.firestore();
        const clientDoc = await db.collection('clients').doc(clientId).get();

        if (!clientDoc.exists) {
          throw new Error('לקוח לא נמצא');
        }

        const clientData = { id: clientDoc.id, ...clientDoc.data() };

        console.log(`✅ Fetched client/case:`, clientId);
        return {
          success: true,
          client: clientData,
          cases: [clientData], // במבנה החדש: לקוח = תיק
          totalCases: 1
        };

      } catch (error) {
        console.error('❌ Error fetching client cases:', error);
        throw new Error(this.getErrorMessage(error));
      }
    }

    /**
     * שליפת כל התיקים (לשימוש פנימי)
     * @returns {Promise<Array>} כל התיקים
     */
    async getAllCases() {
      try {
        // אם יש תיקים מוכנים במטמון - החזר אותם
        if (this.cases && this.cases.length > 0) {
          return this.cases;
        }

        // שליפת כל התיקים מ-Firebase
        console.log('📋 Fetching all cases');
        // ✅ במבנה החדש: getClients (Client=Case)
        const result = await firebase.functions().httpsCallable('getClients')({});

        if (!result.data.success) {
          throw new Error(result.data.message || 'שגיאה בשליפת תיקים');
        }

        this.cases = result.data.clients || [];
        console.log(`✅ Fetched ${this.cases.length} cases`);
        return this.cases;

      } catch (error) {
        console.error('❌ Error fetching all cases:', error);
        throw new Error(this.getErrorMessage(error));
      }
    }

    /**
     * עדכון תיק
     * @param {string} caseId - מזהה התיק
     * @param {Object} updates - עדכונים
     * @returns {Promise<Object>}
     */
    async updateCase(caseId, updates) {
      try {
        console.log('📝 Updating case:', caseId, updates);

        // במבנה החדש: Client = Case
        const result = await firebase.functions().httpsCallable('updateClient')({
          clientId: caseId, // במבנה החדש clientId = caseId
          ...updates
        });

        if (!result.data.success) {
          throw new Error(result.data.message || 'שגיאה בעדכון תיק');
        }

        console.log('✅ Case updated successfully');
        return result.data;

      } catch (error) {
        console.error('❌ Error updating case:', error);
        throw new Error(this.getErrorMessage(error));
      }
    }

    // ==================== UI Rendering Functions ====================

    /**
     * רינדור כרטיסי תיקים
     * @param {Array} cases - רשימת תיקים
     * @param {HTMLElement} container - קונטיינר להצגה
     */
    renderCasesCards(cases, container) {
      if (!container) {
        console.error('❌ Container not found');
        return;
      }

      container.innerHTML = '';

      if (!cases || cases.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #666;">
            <i class="fas fa-folder-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
            <p>לא נמצאו תיקים</p>
          </div>
        `;
        return;
      }

      cases.forEach(caseItem => {
        const card = this.createCaseCard(caseItem);
        container.appendChild(card);
      });
    }

    /**
     * יצירת כרטיס תיק בודד
     * @param {Object} caseItem - התיק
     * @returns {HTMLElement}
     */
    createCaseCard(caseItem) {
      const card = document.createElement('div');
      card.className = 'case-card';
      card.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
        border-right: 4px solid ${this.getStatusColor(caseItem.status)};
      `;

      // כותרת עם מספר תיק
      const header = document.createElement('div');
      header.style.cssText = 'display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;';
      header.innerHTML = `
        <div>
          <h3 style="margin: 0 0 4px 0; font-size: 18px; color: #1a1a1a;">
            ${this.escapeHtml(caseItem.caseTitle)}
          </h3>
          <div style="font-size: 13px; color: #666;">
            תיק מס׳ ${this.escapeHtml(caseItem.caseNumber)}
          </div>
        </div>
        <span class="status-badge ${caseItem.status}" style="
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          background: ${this.getStatusColor(caseItem.status)}20;
          color: ${this.getStatusColor(caseItem.status)};
        ">
          ${this.getStatusText(caseItem.status)}
        </span>
      `;

      // פרטי לקוח
      const clientInfo = document.createElement('div');
      clientInfo.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: #555;';
      clientInfo.innerHTML = `
        <i class="fas fa-user" style="color: #666;"></i>
        <span style="font-weight: 500;">${this.escapeHtml(caseItem.clientName)}</span>
      `;

      // פרטי תיק (סוג הליך, שעות/מחיר קבוע)
      const details = document.createElement('div');
      details.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;';

      if (caseItem.procedureType === 'hours') {
        details.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-clock" style="color: #3b82f6;"></i>
            <div>
              <div style="font-size: 12px; color: #666;">שעות נותרות</div>
              <div style="font-weight: 600; color: #1a1a1a;">
                ${this.formatHours(caseItem.hoursRemaining || 0)}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-hourglass-start" style="color: #8b5cf6;"></i>
            <div>
              <div style="font-size: 12px; color: #666;">סה"כ שעות</div>
              <div style="font-weight: 600; color: #1a1a1a;">
                ${this.formatHours(caseItem.totalHours || 0)}
              </div>
            </div>
          </div>
        `;
      } else if (caseItem.procedureType === 'legal_procedure') {
        const currentStage = caseItem.stages?.find(s => s.status === 'active');
        const completedStages = caseItem.stages?.filter(s => s.status === 'completed').length || 0;
        const isFixed = caseItem.pricingType === 'fixed';

        details.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-balance-scale" style="color: #8b5cf6;"></i>
            <div>
              <div style="font-size: 12px; color: #666;">שלב נוכחי</div>
              <div style="font-weight: 600; color: #1a1a1a;">
                ${currentStage ? currentStage.name : 'לא פעיל'}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-layer-group" style="color: #f59e0b;"></i>
            <div>
              <div style="font-size: 12px; color: #666;">התקדמות</div>
              <div style="font-weight: 600; color: #1a1a1a;">
                ${completedStages} / 3 שלבים
              </div>
            </div>
          </div>
          ${isFixed ? `
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-shekel-sign" style="color: #10b981;"></i>
              <div>
                <div style="font-size: 12px; color: #666;">מחיר פיקס</div>
                <div style="font-weight: 600; color: #1a1a1a;">
                  ${currentStage && currentStage.fixedPrice ? '₪' + currentStage.fixedPrice.toLocaleString() : 'לא הוגדר'}
                </div>
              </div>
            </div>
          ` : `
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-clock" style="color: #3b82f6;"></i>
              <div>
                <div style="font-size: 12px; color: #666;">שעות נותרות</div>
                <div style="font-weight: 600; color: #1a1a1a;">
                  ${this.formatHours(caseItem.hoursRemaining || 0)}
                </div>
              </div>
            </div>
          `}
        `;
      } else if (caseItem.procedureType === 'fixed') {
        details.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-money-bill-wave" style="color: #10b981;"></i>
            <div>
              <div style="font-size: 12px; color: #666;">מחיר קבוע</div>
              <div style="font-weight: 600; color: #1a1a1a;">
                ${caseItem.fixedPrice ? '₪' + caseItem.fixedPrice.toLocaleString() : 'לא הוגדר'}
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-tasks" style="color: #f59e0b;"></i>
            <div>
              <div style="font-size: 12px; color: #666;">שלבים</div>
              <div style="font-weight: 600; color: #1a1a1a;">
                ${this.getCompletedStages(caseItem.stages)} / ${caseItem.stages?.length || 0}
              </div>
            </div>
          </div>
        `;
      }

      // עורכי דין מוקצים
      const attorneys = document.createElement('div');
      attorneys.style.cssText = 'margin-bottom: 12px;';
      attorneys.innerHTML = `
        <div style="font-size: 12px; color: #666; margin-bottom: 6px;">עורכי דין מוקצים:</div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          ${(caseItem.assignedTo || []).map(attorney => `
            <span style="
              padding: 4px 10px;
              background: #f3f4f6;
              border-radius: 6px;
              font-size: 12px;
              color: #374151;
              ${attorney === caseItem.mainAttorney ? 'border: 2px solid #3b82f6; font-weight: 600;' : ''}
            ">
              ${attorney === caseItem.mainAttorney ? '⭐ ' : ''}${this.escapeHtml(attorney)}
            </span>
          `).join('')}
        </div>
      `;

      // כפתורי פעולה
      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 8px; padding-top: 12px; border-top: 1px solid #e5e7eb;';
      actions.innerHTML = `
        <button onclick="casesManager.viewCaseDetails('${caseItem.id}')" style="
          flex: 1;
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        ">
          <i class="fas fa-eye"></i> צפה בפרטים
        </button>
        ${caseItem.status === 'active' ? `
          <button onclick="casesManager.showUpdateCaseDialog('${caseItem.id}')" style="
            padding: 8px 16px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">
            <i class="fas fa-edit"></i> עדכן
          </button>
        ` : ''}
      `;

      card.appendChild(header);
      card.appendChild(clientInfo);
      card.appendChild(details);
      card.appendChild(attorneys);
      card.appendChild(actions);

      return card;
    }

    /**
     * רינדור טבלת תיקים
     * @param {Array} cases - רשימת תיקים
     * @param {HTMLElement} container - קונטיינר להצגה
     */
    renderCasesTable(cases, container) {
      if (!container) {
        console.error('❌ Container not found');
        return;
      }

      if (!cases || cases.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #666;">
            <i class="fas fa-folder-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
            <p>לא נמצאו תיקים</p>
          </div>
        `;
        return;
      }

      const table = document.createElement('table');
      table.style.cssText = 'width: 100%; border-collapse: collapse;';

      // כותרת טבלה
      table.innerHTML = `
        <thead>
          <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
            <th style="padding: 12px; text-align: right; font-weight: 600;">מס׳ תיק</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">כותרת</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">לקוח</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">סוג</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">שעות נותרות</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">סטטוס</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">עו"ד ראשי</th>
            <th style="padding: 12px; text-align: center; font-weight: 600;">פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${cases.map(caseItem => `
            <tr style="border-bottom: 1px solid #e5e7eb; transition: background 0.2s;" onmouseenter="this.style.background='#f9fafb'" onmouseleave="this.style.background='white'">
              <td style="padding: 12px; font-weight: 500;">${this.escapeHtml(caseItem.caseNumber)}</td>
              <td style="padding: 12px;">${this.escapeHtml(caseItem.caseTitle)}</td>
              <td style="padding: 12px;">
                <i class="fas fa-user" style="color: #666; margin-left: 6px;"></i>
                ${this.escapeHtml(caseItem.clientName)}
              </td>
              <td style="padding: 12px;">
                <span style="padding: 4px 8px; background: ${this.getProcedureTypeColor(caseItem.procedureType)}; color: ${this.getProcedureTypeTextColor(caseItem.procedureType)}; border-radius: 4px; font-size: 12px;">
                  ${this.getProcedureTypeText(caseItem.procedureType)}
                </span>
              </td>
              <td style="padding: 12px; font-weight: 600;">
                ${(caseItem.procedureType === 'hours' || caseItem.procedureType === 'legal_procedure') ? this.formatHours(caseItem.hoursRemaining || 0) : '-'}
              </td>
              <td style="padding: 12px;">
                <span style="
                  padding: 6px 12px;
                  border-radius: 6px;
                  font-size: 12px;
                  font-weight: 500;
                  background: ${this.getStatusColor(caseItem.status)}20;
                  color: ${this.getStatusColor(caseItem.status)};
                ">
                  ${this.getStatusText(caseItem.status)}
                </span>
              </td>
              <td style="padding: 12px;">
                <span style="padding: 4px 10px; background: #f3f4f6; border-radius: 6px; font-size: 12px;">
                  ⭐ ${this.escapeHtml(caseItem.mainAttorney)}
                </span>
              </td>
              <td style="padding: 12px; text-align: center;">
                <button onclick="casesManager.viewCaseDetails('${caseItem.id}')" style="
                  padding: 6px 12px;
                  background: #3b82f6;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  margin-left: 4px;
                ">
                  <i class="fas fa-eye"></i>
                </button>
                ${caseItem.status === 'active' ? `
                  <button onclick="casesManager.showUpdateCaseDialog('${caseItem.id}')" style="
                    padding: 6px 12px;
                    background: #10b981;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                  ">
                    <i class="fas fa-edit"></i>
                  </button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      `;

      container.innerHTML = '';
      container.appendChild(table);
    }

    // ==================== Dialog Functions ====================

    /**
     * הצגת דיאלוג יצירת תיק חדש
     */
    async showCreateCaseDialog() {
      // ✅ הצגת loading מיידית
      if (window.NotificationSystem) {
        window.NotificationSystem.showLoading('טוען לקוחות...');
      }

      // טעינת לקוחות - קודם מ-manager אם קיים, אחרת מ-Firebase
      if (window.manager && window.manager.clients && window.manager.clients.length > 0) {
        this.clients = window.manager.clients;
        console.log(`📂 Loaded ${this.clients.length} clients from manager`);

        // ✅ הסתרת loading
        if (window.NotificationSystem) {
          window.NotificationSystem.hideLoading();
        }
      } else if (this.clients.length === 0) {
        try {
          const snapshot = await firebase.firestore().collection('clients').get();
          this.clients = [];
          snapshot.forEach(doc => {
            this.clients.push({ id: doc.id, ...doc.data() });
          });
          console.log(`📂 Loaded ${this.clients.length} clients from Firebase`);

          // ✅ הסתרת loading
          if (window.NotificationSystem) {
            window.NotificationSystem.hideLoading();
          }
        } catch (error) {
          console.error('❌ Error loading clients:', error);

          // ✅ הסתרת loading גם בשגיאה
          if (window.NotificationSystem) {
            window.NotificationSystem.hideLoading();
            window.NotificationSystem.error('שגיאה בטעינת לקוחות');
          }
        }
      }

      const dialogHTML = `
        <div id="createCaseDialog" style="
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.2s ease-out;
        ">
          <div style="
            background: white;
            border-radius: 16px;
            padding: 0;
            max-width: 650px;
            width: 90%;
            max-height: 90vh;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            animation: slideUp 0.3s ease-out;
          ">
            <!-- Header -->
            <div style="
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              padding: 24px 32px;
              color: white;
              display: flex;
              align-items: center;
              justify-content: space-between;
            ">
              <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fas fa-folder-plus" style="font-size: 24px;"></i>
                <h2 style="margin: 0; font-size: 22px; font-weight: 600;">תיק חדש</h2>
              </div>
              <button onclick="casesManager.closeCreateCaseDialog()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
              " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- Content -->
            <div style="padding: 32px; overflow-y: auto; max-height: calc(90vh - 80px);">
              <form id="createCaseForm">
                <!-- Tabs for Client Mode -->
                <div style="margin-bottom: 24px;">
                  <div style="
                    display: flex;
                    gap: 8px;
                    background: #f3f4f6;
                    padding: 4px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                  ">
                    <button type="button" id="existingClientTab" style="
                      flex: 1;
                      padding: 10px 16px;
                      background: white;
                      border: none;
                      border-radius: 6px;
                      cursor: pointer;
                      font-weight: 600;
                      color: #3b82f6;
                      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                      transition: all 0.2s;
                    ">
                      <i class="fas fa-users"></i> לקוח קיים
                    </button>
                    <button type="button" id="newClientTab" style="
                      flex: 1;
                      padding: 10px 16px;
                      background: transparent;
                      border: none;
                      border-radius: 6px;
                      cursor: pointer;
                      font-weight: 500;
                      color: #6b7280;
                      transition: all 0.2s;
                    ">
                      <i class="fas fa-user-plus"></i> לקוח חדש
                    </button>
                  </div>

                  <!-- Existing Client Section -->
                  <div id="existingClientSection" style="
                    animation: fadeIn 0.3s ease-out;
                  ">
                    <label style="
                      display: block;
                      margin-bottom: 8px;
                      font-weight: 600;
                      color: #374151;
                      font-size: 14px;
                    ">
                      <i class="fas fa-user" style="color: #3b82f6; margin-left: 6px;"></i>
                      בחר לקוח <span style="color: #ef4444;">*</span>
                    </label>
                    <select id="existingClientSelect" style="
                      width: 100%;
                      padding: 12px 16px;
                      border: 2px solid #e5e7eb;
                      border-radius: 8px;
                      font-size: 15px;
                      transition: all 0.2s;
                      background: white;
                      cursor: pointer;
                    " onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                      <option value="">בחר לקוח מהרשימה...</option>
                      ${this.clients.map(client => `
                        <option value="${client.id}">${this.escapeHtml(client.clientName || client.fullName)}</option>
                      `).join('')}
                    </select>
                  </div>

                  <!-- New Client Section -->
                  <div id="newClientSection" style="display: none;">
                    <div style="margin-bottom: 16px;">
                      <label style="
                        display: block;
                        margin-bottom: 8px;
                        font-weight: 600;
                        color: #374151;
                        font-size: 14px;
                      ">
                        <i class="fas fa-id-card" style="color: #3b82f6; margin-left: 6px;"></i>
                        שם הלקוח <span style="color: #ef4444;">*</span>
                      </label>
                      <input type="text" id="newClientName" placeholder="שם מלא" style="
                        width: 100%;
                        padding: 12px 16px;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        font-size: 15px;
                        transition: all 0.2s;
                      " onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                      <div>
                        <label style="
                          display: block;
                          margin-bottom: 8px;
                          font-weight: 600;
                          color: #374151;
                          font-size: 14px;
                        ">
                          <i class="fas fa-phone" style="color: #10b981; margin-left: 6px;"></i>
                          טלפון
                        </label>
                        <input type="text" id="newClientPhone" placeholder="050-1234567" style="
                          width: 100%;
                          padding: 12px 16px;
                          border: 2px solid #e5e7eb;
                          border-radius: 8px;
                          font-size: 15px;
                          transition: all 0.2s;
                        " onfocus="this.style.borderColor='#10b981'; this.style.boxShadow='0 0 0 3px rgba(16,185,129,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                      </div>
                      <div>
                        <label style="
                          display: block;
                          margin-bottom: 8px;
                          font-weight: 600;
                          color: #374151;
                          font-size: 14px;
                        ">
                          <i class="fas fa-envelope" style="color: #8b5cf6; margin-left: 6px;"></i>
                          אימייל
                        </label>
                        <input type="email" id="newClientEmail" placeholder="email@example.com" style="
                          width: 100%;
                          padding: 12px 16px;
                          border: 2px solid #e5e7eb;
                          border-radius: 8px;
                          font-size: 15px;
                          transition: all 0.2s;
                        " onfocus="this.style.borderColor='#8b5cf6'; this.style.boxShadow='0 0 0 3px rgba(139,92,246,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Divider -->
                <div style="
                  height: 1px;
                  background: linear-gradient(to left, transparent, #e5e7eb, transparent);
                  margin: 24px 0;
                "></div>

                <!-- Case Details Grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                  <!-- מספר תיק -->
                  <div>
                    <label style="
                      display: block;
                      margin-bottom: 8px;
                      font-weight: 600;
                      color: #374151;
                      font-size: 14px;
                    ">
                      <i class="fas fa-hashtag" style="color: #f59e0b; margin-left: 6px;"></i>
                      מספר תיק <span style="color: #ef4444;">*</span>
                    </label>
                    <input type="text" id="caseNumber" required placeholder="2025/001" style="
                      width: 100%;
                      padding: 12px 16px;
                      border: 2px solid #e5e7eb;
                      border-radius: 8px;
                      font-size: 15px;
                      transition: all 0.2s;
                    " onfocus="this.style.borderColor='#f59e0b'; this.style.boxShadow='0 0 0 3px rgba(245,158,11,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                  </div>

                  <!-- סוג הליך -->
                  <div>
                    <label style="
                      display: block;
                      margin-bottom: 8px;
                      font-weight: 600;
                      color: #374151;
                      font-size: 14px;
                    ">
                      <i class="fas fa-gavel" style="color: #ef4444; margin-left: 6px;"></i>
                      סוג הליך <span style="color: #ef4444;">*</span>
                    </label>
                    <select id="procedureType" required style="
                      width: 100%;
                      padding: 12px 16px;
                      border: 2px solid #e5e7eb;
                      border-radius: 8px;
                      font-size: 15px;
                      transition: all 0.2s;
                      background: white;
                      cursor: pointer;
                    " onfocus="this.style.borderColor='#ef4444'; this.style.boxShadow='0 0 0 3px rgba(239,68,68,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                      <option value="hours">⏱️ שעות (ללא שלבים)</option>
                      <option value="legal_procedure">⚖️ הליך משפטי מבוסס שלבים</option>
                    </select>
                  </div>
                </div>

                <!-- כותרת תיק -->
                <div style="margin-bottom: 16px;">
                  <label style="
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #374151;
                    font-size: 14px;
                  ">
                    <i class="fas fa-file-alt" style="color: #6366f1; margin-left: 6px;"></i>
                    כותרת התיק <span style="color: #ef4444;">*</span>
                  </label>
                  <input type="text" id="caseTitle" required placeholder="לדוגמה: תביעה עירונית - עיריית ת״א" style="
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 15px;
                    transition: all 0.2s;
                  " onfocus="this.style.borderColor='#6366f1'; this.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                </div>

                <!-- שעות (אם בחר שעות) -->
                <div id="hoursSection" style="margin-bottom: 16px;">
                  <label style="
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #374151;
                    font-size: 14px;
                  ">
                    <i class="fas fa-clock" style="color: #3b82f6; margin-left: 6px;"></i>
                    כמות שעות <span style="color: #ef4444;">*</span>
                  </label>
                  <input type="number" id="totalHours" min="1" placeholder="50" style="
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 15px;
                    transition: all 0.2s;
                  " onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                  <p style="margin: 6px 0 0 0; font-size: 12px; color: #6b7280;">
                    <i class="fas fa-info-circle" style="margin-left: 4px;"></i>
                    מספר השעות שהלקוח רכש
                  </p>
                </div>

                <!-- הליך משפטי - 3 שלבים (אם בחר legal_procedure) -->
                <div id="legalProcedureSection" style="margin-bottom: 16px; display: none;">
                  <div style="
                    background: linear-gradient(135deg, #ede9fe 0%, #e9d5ff 100%);
                    padding: 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    border-right: 4px solid #8b5cf6;
                  ">
                    <h4 style="margin: 0 0 8px 0; color: #6b21a8; font-size: 15px;">
                      <i class="fas fa-info-circle" style="margin-left: 6px;"></i>
                      הליך משפטי מבוסס שלבים
                    </h4>
                    <p style="margin: 0; font-size: 13px; color: #7c3aed; line-height: 1.6;">
                      יש למלא <strong>3 שלבים מלאים</strong>. בחר סוג תמחור ומלא את הפרטים עבור כל שלב.
                    </p>
                  </div>

                  <!-- בחירת סוג תמחור -->
                  <div style="margin-bottom: 20px;">
                    <label style="
                      display: block;
                      margin-bottom: 12px;
                      font-weight: 600;
                      color: #374151;
                      font-size: 14px;
                    ">
                      <i class="fas fa-calculator" style="color: #8b5cf6; margin-left: 6px;"></i>
                      סוג תמחור <span style="color: #ef4444;">*</span>
                    </label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                      <label style="
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        padding: 12px 16px;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                        background: white;
                      " onmouseover="this.style.borderColor='#3b82f6'; this.style.background='#f0f9ff'" onmouseout="if(!this.querySelector('input').checked) { this.style.borderColor='#e5e7eb'; this.style.background='white' }">
                        <input type="radio" name="pricingType" id="pricingTypeHourly" value="hourly" checked style="
                          width: 18px;
                          height: 18px;
                          cursor: pointer;
                        ">
                        <div style="flex: 1;">
                          <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 2px;">
                            <i class="fas fa-clock" style="color: #3b82f6; margin-left: 6px;"></i>
                            תמחור שעתי
                          </div>
                          <div style="font-size: 12px; color: #6b7280;">
                            תקרת שעות לכל שלב
                          </div>
                        </div>
                      </label>
                      <label style="
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        padding: 12px 16px;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.2s;
                        background: white;
                      " onmouseover="this.style.borderColor='#10b981'; this.style.background='#f0fdf4'" onmouseout="if(!this.querySelector('input').checked) { this.style.borderColor='#e5e7eb'; this.style.background='white' }">
                        <input type="radio" name="pricingType" id="pricingTypeFixed" value="fixed" style="
                          width: 18px;
                          height: 18px;
                          cursor: pointer;
                        ">
                        <div style="flex: 1;">
                          <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 2px;">
                            <i class="fas fa-shekel-sign" style="color: #10b981; margin-left: 6px;"></i>
                            מחיר פיקס
                          </div>
                          <div style="font-size: 12px; color: #6b7280;">
                            מחיר קבוע לכל שלב
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <!-- שלב א -->
                  <div style="
                    background: white;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 16px;
                  ">
                    <h4 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">
                      <span style="
                        display: inline-block;
                        width: 28px;
                        height: 28px;
                        background: linear-gradient(135deg, #3b82f6, #2563eb);
                        color: white;
                        border-radius: 50%;
                        text-align: center;
                        line-height: 28px;
                        margin-left: 8px;
                        font-size: 13px;
                      ">א</span>
                      שלב א <span style="color: #ef4444;">*</span>
                    </h4>
                    <div style="margin-bottom: 12px;">
                      <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #6b7280;">
                        תיאור פנימי (עד מתי השלב):
                      </label>
                      <input type="text" id="stageA_description" placeholder='לדוגמה: "עד דיון שני בתיק"' style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                      ">
                    </div>
                    <!-- שדות שעות (תמחור שעתי) -->
                    <div class="hourly-fields">
                      <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #6b7280;">
                        <i class="fas fa-clock" style="color: #3b82f6; margin-left: 4px;"></i>
                        תקרת שעות התחלתית:
                      </label>
                      <input type="number" id="stageA_hours" min="1" placeholder="20" style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                      ">
                    </div>

                    <!-- שדות מחיר פיקס (תמחור קבוע) -->
                    <div class="fixed-fields" style="display: none;">
                      <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #6b7280;">
                        <i class="fas fa-shekel-sign" style="color: #10b981; margin-left: 4px;"></i>
                        מחיר פיקס (בשקלים):
                      </label>
                      <input type="number" id="stageA_fixedPrice" min="1" placeholder="5000" style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                      ">
                    </div>
                  </div>

                  <!-- שלב ב -->
                  <div style="
                    background: white;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 16px;
                  ">
                    <h4 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">
                      <span style="
                        display: inline-block;
                        width: 28px;
                        height: 28px;
                        background: linear-gradient(135deg, #10b981, #059669);
                        color: white;
                        border-radius: 50%;
                        text-align: center;
                        line-height: 28px;
                        margin-left: 8px;
                        font-size: 13px;
                      ">ב</span>
                      שלב ב <span style="color: #ef4444;">*</span>
                    </h4>
                    <div style="margin-bottom: 12px;">
                      <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #6b7280;">
                        תיאור פנימי (עד מתי השלב):
                      </label>
                      <input type="text" id="stageB_description" placeholder='לדוגמה: "עד הגשת סיכומים"' style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                      ">
                    </div>
                    <!-- שדות שעות (תמחור שעתי) -->
                    <div class="hourly-fields">
                      <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #6b7280;">
                        <i class="fas fa-clock" style="color: #3b82f6; margin-left: 4px;"></i>
                        תקרת שעות התחלתית:
                      </label>
                      <input type="number" id="stageB_hours" min="1" placeholder="30" style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                      ">
                    </div>

                    <!-- שדות מחיר פיקס (תמחור קבוע) -->
                    <div class="fixed-fields" style="display: none;">
                      <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #6b7280;">
                        <i class="fas fa-shekel-sign" style="color: #10b981; margin-left: 4px;"></i>
                        מחיר פיקס (בשקלים):
                      </label>
                      <input type="number" id="stageB_fixedPrice" min="1" placeholder="7000" style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                      ">
                    </div>
                  </div>

                  <!-- שלב ג -->
                  <div style="
                    background: white;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 16px;
                  ">
                    <h4 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">
                      <span style="
                        display: inline-block;
                        width: 28px;
                        height: 28px;
                        background: linear-gradient(135deg, #f59e0b, #d97706);
                        color: white;
                        border-radius: 50%;
                        text-align: center;
                        line-height: 28px;
                        margin-left: 8px;
                        font-size: 13px;
                      ">ג</span>
                      שלב ג <span style="color: #ef4444;">*</span>
                    </h4>
                    <div style="margin-bottom: 12px;">
                      <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #6b7280;">
                        תיאור פנימי (עד מתי השלב):
                      </label>
                      <input type="text" id="stageC_description" placeholder='לדוגמה: "עד פסק דין"' style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                      ">
                    </div>
                    <!-- שדות שעות (תמחור שעתי) -->
                    <div class="hourly-fields">
                      <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #6b7280;">
                        <i class="fas fa-clock" style="color: #3b82f6; margin-left: 4px;"></i>
                        תקרת שעות התחלתית:
                      </label>
                      <input type="number" id="stageC_hours" min="1" placeholder="25" style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                      ">
                    </div>

                    <!-- שדות מחיר פיקס (תמחור קבוע) -->
                    <div class="fixed-fields" style="display: none;">
                      <label style="display: block; margin-bottom: 6px; font-size: 13px; color: #6b7280;">
                        <i class="fas fa-shekel-sign" style="color: #10b981; margin-left: 4px;"></i>
                        מחיר פיקס (בשקלים):
                      </label>
                      <input type="number" id="stageC_fixedPrice" min="1" placeholder="6000" style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                      ">
                    </div>
                  </div>
                </div>

                <!-- תיאור -->
                <div style="margin-bottom: 24px;">
                  <label style="
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #374151;
                    font-size: 14px;
                  ">
                    <i class="fas fa-align-right" style="color: #64748b; margin-left: 6px;"></i>
                    תיאור נוסף (אופציונלי)
                  </label>
                  <textarea id="caseDescription" rows="3" placeholder="פרטים נוספים על התיק..." style="
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 15px;
                    resize: vertical;
                    transition: all 0.2s;
                    min-height: 80px;
                  " onfocus="this.style.borderColor='#64748b'; this.style.boxShadow='0 0 0 3px rgba(100,116,139,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'"></textarea>
                </div>

                <!-- כפתורים -->
                <div style="
                  display: flex;
                  gap: 12px;
                  padding-top: 24px;
                  border-top: 1px solid #e5e7eb;
                ">
                  <button type="submit" style="
                    flex: 1;
                    padding: 14px 24px;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 600;
                    box-shadow: 0 4px 12px rgba(59,130,246,0.3);
                    transition: all 0.2s;
                  " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(59,130,246,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(59,130,246,0.3)'">
                    <i class="fas fa-check-circle" style="margin-left: 8px;"></i>
                    צור תיק חדש
                  </button>
                  <button type="button" onclick="casesManager.closeCreateCaseDialog()" style="
                    padding: 14px 32px;
                    background: #f3f4f6;
                    color: #6b7280;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 600;
                    transition: all 0.2s;
                  " onmouseover="this.style.background='#e5e7eb'; this.style.color='#374151'" onmouseout="this.style.background='#f3f4f6'; this.style.color='#6b7280'">
                    ביטול
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <style>
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        </style>
      `;

      document.body.insertAdjacentHTML('beforeend', dialogHTML);

      // Event listeners for Tabs
      const existingTab = document.getElementById('existingClientTab');
      const newTab = document.getElementById('newClientTab');
      const existingSection = document.getElementById('existingClientSection');
      const newSection = document.getElementById('newClientSection');

      // Tab switching function
      const switchToTab = (mode) => {
        if (mode === 'existing') {
          // Style active tab
          existingTab.style.background = 'white';
          existingTab.style.color = '#3b82f6';
          existingTab.style.fontWeight = '600';
          existingTab.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';

          newTab.style.background = 'transparent';
          newTab.style.color = '#6b7280';
          newTab.style.fontWeight = '500';
          newTab.style.boxShadow = 'none';

          // Show/hide sections
          existingSection.style.display = 'block';
          newSection.style.display = 'none';
        } else {
          // Style active tab
          newTab.style.background = 'white';
          newTab.style.color = '#3b82f6';
          newTab.style.fontWeight = '600';
          newTab.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';

          existingTab.style.background = 'transparent';
          existingTab.style.color = '#6b7280';
          existingTab.style.fontWeight = '500';
          existingTab.style.boxShadow = 'none';

          // Show/hide sections
          existingSection.style.display = 'none';
          newSection.style.display = 'block';
        }
      };

      existingTab.addEventListener('click', () => switchToTab('existing'));
      newTab.addEventListener('click', () => switchToTab('new'));

      // Procedure type change
      document.getElementById('procedureType').addEventListener('change', (e) => {
        const value = e.target.value;
        const isHours = value === 'hours';
        const isLegalProcedure = value === 'legal_procedure';

        document.getElementById('hoursSection').style.display = isHours ? 'block' : 'none';
        document.getElementById('legalProcedureSection').style.display = isLegalProcedure ? 'block' : 'none';
      });

      // Pricing type change (hourly vs fixed) - טוגל בין שעות למחירים
      const pricingTypeRadios = document.getElementsByName('pricingType');
      const togglePricingFields = () => {
        const selectedType = document.querySelector('input[name="pricingType"]:checked')?.value || 'hourly';
        const isHourly = selectedType === 'hourly';

        // הצגת/הסתרת שדות עבור כל 3 השלבים
        const hourlyFields = document.querySelectorAll('.hourly-fields');
        const fixedFields = document.querySelectorAll('.fixed-fields');

        hourlyFields.forEach(field => {
          field.style.display = isHourly ? 'block' : 'none';
        });

        fixedFields.forEach(field => {
          field.style.display = isHourly ? 'none' : 'block';
        });
      };

      // הוספת event listeners לכל הradio buttons
      pricingTypeRadios.forEach(radio => {
        radio.addEventListener('change', togglePricingFields);
      });

      // ✅ Event listener for existing client selection
      const existingClientSelect = document.getElementById('existingClientSelect');
      if (existingClientSelect) {
        existingClientSelect.addEventListener('change', async (e) => {
          const clientId = e.target.value;

          // מחיקת אזור המידע הישן (אם קיים)
          const oldInfo = document.getElementById('existingCaseInfo');
          if (oldInfo) oldInfo.remove();

          if (!clientId) {
            // אין לקוח - אפשר עריכת מספר תיק
            const caseNumberField = document.getElementById('caseNumber');
            if (caseNumberField) {
              caseNumberField.disabled = false;
              caseNumberField.value = '';
              caseNumberField.style.background = 'white';
              caseNumberField.style.cursor = 'text';
            }
            return;
          }

          try {
            // כל לקוח במערכת יש לו תיק (נוצר ב-createClient)
            const existingCase = await this.checkExistingCaseForClient(clientId);

            if (existingCase) {
              // שמירת התיק הקיים
              this.currentCase = existingCase;

              // מילוי מספר תיק (read-only)
              const caseNumberField = document.getElementById('caseNumber');
              if (caseNumberField) {
                caseNumberField.value = existingCase.caseNumber;
                caseNumberField.disabled = true;
                caseNumberField.style.background = '#f3f4f6';
                caseNumberField.style.cursor = 'not-allowed';
              }

              // הצגת מידע על התיק והשירותים הקיימים
              this.showExistingCaseInfo(existingCase, clientId);
            }
          } catch (error) {
            console.error('❌ Error loading client case:', error);
          }
        });
      }

      // Form submit
      document.getElementById('createCaseForm').addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreateCaseSubmit();
      });
    }

    /**
     * בדיקה אם ללקוח יש תיק קיים
     * (במבנה החדש Client=Case, clientId = caseNumber)
     * @param {string} clientId - מזהה הלקוח (document ID = caseNumber)
     * @returns {Promise<Object|null>} תיק קיים או null
     */
    async checkExistingCaseForClient(clientId) {
      try {
        // ✅ במבנה החדש: כל client הוא case
        // פשוט לבדוק אם ה-client/case הזה קיים
        const clientDoc = await firebase.firestore()
          .collection('clients')
          .doc(clientId)
          .get();

        if (!clientDoc.exists) {
          return null; // אין תיק קיים
        }

        const data = clientDoc.data();

        // בדיקת סטטוס פעיל
        if (data.status !== 'active') {
          return null; // רק תיקים פעילים
        }

        return {
          id: clientDoc.id,
          ...data
        };
      } catch (error) {
        console.error('❌ Error checking existing case:', error);
        return null;
      }
    }

    /**
     * הצגת מידע על תיק קיים ושירותים
     * @param {Object} existingCase - התיק הקיים
     * @param {string} clientId - מזהה הלקוח
     */
    showExistingCaseInfo(existingCase, clientId) {
      const client = this.clients.find(c => c.id === clientId);
      const clientName = client ? (client.clientName || client.fullName) : '';

      // ספירת שירותים
      const services = existingCase.services || [];
      const totalServices = services.length;
      const activeServices = services.filter(s => s.status === 'active').length;

      // בניית רשימת שירותים
      let servicesHTML = '';
      if (services.length > 0) {
        servicesHTML = services.map((service, index) => {
          let serviceInfo = '';
          let serviceType = '';

          if (service.type === 'hours') {
            const hours = service.hoursRemaining || 0;
            const totalHours = service.totalHours || 0;
            serviceType = 'תוכנית שעות';
            serviceInfo = `${hours}/${totalHours} שעות`;
          } else if (service.type === 'legal_procedure') {
            serviceType = 'הליך משפטי';
            serviceInfo = 'הליך משפטי';
          } else if (service.type === 'fixed') {
            serviceType = 'מחיר קבוע';
            serviceInfo = 'מחיר קבוע';
          }

          return `
            <div style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 8px 12px;
              background: ${service.status === 'active' ? '#f0fdf4' : '#f3f4f6'};
              border-radius: 6px;
              margin-bottom: 6px;
              border-right: 3px solid ${service.status === 'active' ? '#10b981' : '#9ca3af'};
            ">
              <div>
                <div style="font-weight: 500; color: #1a1a1a; font-size: 13px;">
                  ${serviceType || this.escapeHtml(service.name) || `שירות ${index + 1}`}
                </div>
                <div style="font-size: 11px; color: #666; margin-top: 2px;">
                  ${serviceInfo}
                </div>
              </div>
              <span style="
                padding: 3px 8px;
                background: ${service.status === 'active' ? '#10b981' : '#9ca3af'};
                color: white;
                border-radius: 4px;
                font-size: 10px;
                font-weight: 500;
              ">
                ${service.status === 'active' ? 'פעיל' : 'לא פעיל'}
              </span>
            </div>
          `;
        }).join('');
      } else {
        servicesHTML = `
          <div style="text-align: center; padding: 12px; color: #666; font-size: 12px;">
            אין שירותים פעילים
          </div>
        `;
      }

      const infoHTML = `
        <div id="existingCaseInfo" style="
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 2px solid #3b82f6;
          border-radius: 12px;
          padding: 16px;
          margin-top: 16px;
          animation: slideDown 0.3s ease-out;
        ">
          <!-- כותרת -->
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #bfdbfe;
          ">
            <i class="fas fa-info-circle" style="color: #3b82f6; font-size: 18px;"></i>
            <div>
              <div style="font-weight: 600; color: #1e40af; font-size: 14px;">
                תיק #${this.escapeHtml(existingCase.caseNumber)}
              </div>
              <div style="font-size: 11px; color: #60a5fa; margin-top: 2px;">
                ${totalServices} ${totalServices === 1 ? 'שירות' : 'שירותים'} • ${activeServices} פעיל${activeServices === 1 ? '' : 'ים'}
              </div>
            </div>
          </div>

          <!-- רשימת שירותים -->
          <div style="margin-bottom: 12px;">
            <div style="font-size: 12px; font-weight: 600; color: #1e40af; margin-bottom: 8px;">
              שירותים קיימים:
            </div>
            ${servicesHTML}
          </div>

          <!-- הודעה -->
          <div style="
            background: white;
            padding: 10px 12px;
            border-radius: 6px;
            border-right: 3px solid #3b82f6;
          ">
            <p style="margin: 0; font-size: 12px; color: #1e40af; line-height: 1.5;">
              <i class="fas fa-lightbulb" style="margin-left: 6px; color: #fbbf24;"></i>
              השירות החדש יתווסף לתיק קיים זה
            </p>
          </div>
        </div>

        <style>
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        </style>
      `;

      // הוספת המידע אחרי שדה מספר התיק
      const caseNumberField = document.getElementById('caseNumber');
      if (caseNumberField && caseNumberField.parentElement) {
        // חיפוש ה-parent grid (שדה מספר תיק + סוג הליך)
        const gridParent = caseNumberField.parentElement.parentElement;
        if (gridParent) {
          gridParent.insertAdjacentHTML('afterend', infoHTML);
        }
      }
    }

    /**
     * סגירת דיאלוג יצירת תיק
     */
    closeCreateCaseDialog() {
      const dialog = document.getElementById('createCaseDialog');
      if (dialog) {
        dialog.remove();
      }
    }

    /**
     * טיפול בשליחת טופס יצירת תיק
     */
    async handleCreateCaseSubmit() {
      try {
        // בדיקה איזה טאב פעיל - לקוח קיים או חדש
        const existingSection = document.getElementById('existingClientSection');
        const isExistingClient = existingSection.style.display !== 'none';

        // בדיקה אם יש תיק קיים (= הוספת שירות)
        if (this.currentCase) {
          // מצב הוספת שירות לתיק קיים
          await this.handleAddServiceToCase();
          return;
        }

        // מצב רגיל - תיק חדש
        const caseData = {
          caseNumber: document.getElementById('caseNumber').value.trim(),
          caseTitle: document.getElementById('caseTitle').value.trim(),
          procedureType: document.getElementById('procedureType').value,
          description: document.getElementById('caseDescription').value.trim()
        };

        if (isExistingClient) {
          // לקוח קיים
          caseData.clientId = document.getElementById('existingClientSelect').value;
          if (!caseData.clientId) {
            alert('אנא בחר לקוח מהרשימה');
            return;
          }
        } else {
          // לקוח חדש
          caseData.clientName = document.getElementById('newClientName').value.trim();
          caseData.phone = document.getElementById('newClientPhone').value.trim();
          caseData.email = document.getElementById('newClientEmail').value.trim();

          if (!caseData.clientName) {
            alert('אנא הזן שם לקוח');
            return;
          }
        }

        // שדות ספציפיים לסוג הליך
        if (caseData.procedureType === 'hours') {
          const totalHours = parseInt(document.getElementById('totalHours').value);
          if (!totalHours || totalHours < 1) {
            alert('אנא הזן כמות שעות תקינה');
            return;
          }
          caseData.totalHours = totalHours;
        } else if (caseData.procedureType === 'legal_procedure') {
          // קריאת סוג תמחור
          const pricingType = document.querySelector('input[name="pricingType"]:checked')?.value || 'hourly';
          caseData.pricingType = pricingType;

          // וולידציה והכנת שלבים
          const stages = [];

          // שלב א
          const stageA_desc = document.getElementById('stageA_description').value.trim();
          if (!stageA_desc || stageA_desc.length < 2) {
            alert('שלב א: אנא הזן תיאור השלב (לפחות 2 תווים)');
            return;
          }

          if (pricingType === 'hourly') {
            const stageA_hours = parseInt(document.getElementById('stageA_hours').value);
            if (!stageA_hours || stageA_hours < 1) {
              alert('שלב א: אנא הזן תקרת שעות תקינה');
              return;
            }
            stages.push({ description: stageA_desc, hours: stageA_hours });
          } else {
            const stageA_fixedPrice = parseInt(document.getElementById('stageA_fixedPrice').value);
            if (!stageA_fixedPrice || stageA_fixedPrice < 1) {
              alert('שלב א: אנא הזן מחיר פיקס תקין');
              return;
            }
            stages.push({ description: stageA_desc, fixedPrice: stageA_fixedPrice });
          }

          // שלב ב
          const stageB_desc = document.getElementById('stageB_description').value.trim();
          if (!stageB_desc || stageB_desc.length < 2) {
            alert('שלב ב: אנא הזן תיאור השלב (לפחות 2 תווים)');
            return;
          }

          if (pricingType === 'hourly') {
            const stageB_hours = parseInt(document.getElementById('stageB_hours').value);
            if (!stageB_hours || stageB_hours < 1) {
              alert('שלב ב: אנא הזן תקרת שעות תקינה');
              return;
            }
            stages.push({ description: stageB_desc, hours: stageB_hours });
          } else {
            const stageB_fixedPrice = parseInt(document.getElementById('stageB_fixedPrice').value);
            if (!stageB_fixedPrice || stageB_fixedPrice < 1) {
              alert('שלב ב: אנא הזן מחיר פיקס תקין');
              return;
            }
            stages.push({ description: stageB_desc, fixedPrice: stageB_fixedPrice });
          }

          // שלב ג
          const stageC_desc = document.getElementById('stageC_description').value.trim();
          if (!stageC_desc || stageC_desc.length < 2) {
            alert('שלב ג: אנא הזן תיאור השלב (לפחות 2 תווים)');
            return;
          }

          if (pricingType === 'hourly') {
            const stageC_hours = parseInt(document.getElementById('stageC_hours').value);
            if (!stageC_hours || stageC_hours < 1) {
              alert('שלב ג: אנא הזן תקרת שעות תקינה');
              return;
            }
            stages.push({ description: stageC_desc, hours: stageC_hours });
          } else {
            const stageC_fixedPrice = parseInt(document.getElementById('stageC_fixedPrice').value);
            if (!stageC_fixedPrice || stageC_fixedPrice < 1) {
              alert('שלב ג: אנא הזן מחיר פיקס תקין');
              return;
            }
            stages.push({ description: stageC_desc, fixedPrice: stageC_fixedPrice });
          }

          caseData.stages = stages;
        }

        // ✅ הצגת loading
        if (window.NotificationSystem) {
          window.NotificationSystem.showLoading('יוצר תיק...');
        }

        // יצירת התיק
        const result = await this.createCase(caseData);

        // ✅ הסתרת loading
        if (window.NotificationSystem) {
          window.NotificationSystem.hideLoading();
        }

        // המתנה קצרה לפני הצגת הודעת הצלחה
        await new Promise(resolve => setTimeout(resolve, 100));

        // הצגת הודעת הצלחה
        if (window.NotificationSystem) {
          window.NotificationSystem.success(`התיק "${caseData.caseTitle}" נוצר בהצלחה!`, 3000);
        } else {
          alert(`התיק "${caseData.caseTitle}" נוצר בהצלחה!`);
        }

        // ✅ סגירת דיאלוג אוטומטית אחרי delay
        setTimeout(() => {
          this.closeCreateCaseDialog();
        }, 500);

        // 🔔 שידור אירוע global - מרענן טפסים פתוחים (אפס עלות!)
        const caseCreatedEvent = new CustomEvent('caseCreated', {
          detail: {
            caseId: result.caseId,
            clientId: result.clientId,
            clientName: result.case.clientName,
            caseNumber: result.case.caseNumber,
            caseTitle: result.case.caseTitle,
            procedureType: result.case.procedureType
          }
        });
        window.dispatchEvent(caseCreatedEvent);
        console.log('🔔 Event dispatched: caseCreated for client', result.clientId);

        // רענון הנתונים
        if (typeof this.onCaseCreated === 'function') {
          this.onCaseCreated(result);
        }

      } catch (error) {
        console.error('❌ Error in handleCreateCaseSubmit:', error);

        // ✅ הסתרת loading במקרה של שגיאה
        if (window.NotificationSystem) {
          window.NotificationSystem.hideLoading();
        }

        // המתנה קצרה לפני הצגת שגיאה
        await new Promise(resolve => setTimeout(resolve, 100));

        if (window.NotificationSystem) {
          window.NotificationSystem.error(error.message, 5000);
        } else {
          alert('שגיאה: ' + error.message);
        }
      }
    }

    /**
     * טיפול בהוספת שירות לתיק קיים
     */
    async handleAddServiceToCase() {
      try {
        const procedureType = document.getElementById('procedureType').value;

        // בניית נתוני השירות
        const serviceData = {
          caseId: this.currentCase.id,
          serviceType: procedureType,
          serviceName: document.getElementById('caseTitle').value.trim(),
          description: document.getElementById('caseDescription').value.trim()
        };

        if (!serviceData.serviceName) {
          alert('אנא הזן שם שירות');
          return;
        }

        // שדות ספציפיים לסוג הליך
        if (procedureType === 'hours') {
          const totalHours = parseInt(document.getElementById('totalHours').value);
          if (!totalHours || totalHours < 1) {
            alert('אנא הזן כמות שעות תקינה');
            return;
          }
          serviceData.hours = totalHours;
        }
        // TODO: תמיכה ב-legal_procedure בעתיד

        console.log('📝 Adding service to case:', serviceData);

        // ✅ הצגת loading
        if (window.NotificationSystem) {
          window.NotificationSystem.showLoading('מוסיף שירות...');
        }

        // קריאה ל-Cloud Function addServiceToClient (במבנה החדש: Client = Case)
        const result = await firebase.functions().httpsCallable('addServiceToClient')(serviceData);

        if (!result.data.success) {
          throw new Error(result.data.message || 'שגיאה בהוספת שירות');
        }

        console.log('✅ Service added successfully:', result.data.serviceId);

        // ✅ הסתרת loading
        if (window.NotificationSystem) {
          window.NotificationSystem.hideLoading();
        }

        // המתנה קצרה לפני הצגת הודעת הצלחה
        await new Promise(resolve => setTimeout(resolve, 100));

        // הצגת הודעת הצלחה
        if (window.NotificationSystem) {
          window.NotificationSystem.success(result.data.message || `השירות "${serviceData.serviceName}" נוסף בהצלחה!`, 3000);
        } else {
          alert(result.data.message || `השירות "${serviceData.serviceName}" נוסף בהצלחה!`);
        }

        // ✅ סגירת דיאלוג אוטומטית אחרי delay
        setTimeout(() => {
          this.closeCreateCaseDialog();
        }, 500);

        // 🔔 שידור אירוע global - מרענן כרטיסיות שירותים (אפס עלות!)
        const serviceAddedEvent = new CustomEvent('serviceAdded', {
          detail: {
            caseId: serviceData.caseId,
            serviceId: result.data.serviceId,
            serviceName: serviceData.serviceName
          }
        });
        window.dispatchEvent(serviceAddedEvent);
        console.log('🔔 Event dispatched: serviceAdded for case', serviceData.caseId);

        // ריסט המצב
        this.currentCase = null;

        // רענון הנתונים
        if (typeof this.onCaseCreated === 'function') {
          this.onCaseCreated(result.data);
        }

      } catch (error) {
        console.error('❌ Error in handleAddServiceToCase:', error);

        // ✅ הסתרת loading במקרה של שגיאה
        if (window.NotificationSystem) {
          window.NotificationSystem.hideLoading();
        }

        // המתנה קצרה לפני הצגת שגיאה
        await new Promise(resolve => setTimeout(resolve, 100));

        if (window.NotificationSystem) {
          window.NotificationSystem.error(error.message, 5000);
        } else {
          alert('שגיאה: ' + error.message);
        }
      }
    }

    /**
     * הצגת פרטי תיק
     * @param {string} caseId - מזהה התיק
     */
    async viewCaseDetails(caseId) {
      try {
        const caseItem = this.cases.find(c => c.id === caseId);
        if (!caseItem) {
          throw new Error('תיק לא נמצא');
        }

        // כאן ניתן להוסיף דיאלוג פרטים מלא
        // לצורך הדוגמה - נציג alert
        alert(`פרטי תיק:\n\nמספר: ${caseItem.caseNumber}\nכותרת: ${caseItem.caseTitle}\nלקוח: ${caseItem.clientName}\nסטטוס: ${this.getStatusText(caseItem.status)}`);

      } catch (error) {
        console.error('❌ Error viewing case:', error);
        alert('שגיאה בטעינת פרטי תיק');
      }
    }

    /**
     * הצגת דיאלוג עדכון תיק
     * @param {string} caseId - מזהה התיק
     */
    async showUpdateCaseDialog(caseId) {
      const caseItem = this.cases.find(c => c.id === caseId);
      if (!caseItem) {
        alert('תיק לא נמצא');
        return;
      }

      const dialogHTML = `
        <div id="updateCaseDialog" style="
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        ">
          <div style="
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
          ">
            <h2 style="margin: 0 0 20px 0;">📝 עדכון תיק</h2>

            <form id="updateCaseForm">
              <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">סטטוס:</label>
                <select id="updateStatus" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                  <option value="active" ${caseItem.status === 'active' ? 'selected' : ''}>פעיל</option>
                  <option value="on_hold" ${caseItem.status === 'on_hold' ? 'selected' : ''}>בהמתנה</option>
                  <option value="completed" ${caseItem.status === 'completed' ? 'selected' : ''}>הושלם</option>
                  <option value="archived" ${caseItem.status === 'archived' ? 'selected' : ''}>בארכיון</option>
                </select>
              </div>

              <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button type="submit" style="
                  flex: 1;
                  padding: 12px;
                  background: #10b981;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                  font-weight: 500;
                ">
                  <i class="fas fa-save"></i> שמור
                </button>
                <button type="button" onclick="casesManager.closeUpdateCaseDialog()" style="
                  padding: 12px 24px;
                  background: #6b7280;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                ">
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', dialogHTML);

      document.getElementById('updateCaseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleUpdateCaseSubmit(caseId);
      });
    }

    /**
     * סגירת דיאלוג עדכון תיק
     */
    closeUpdateCaseDialog() {
      const dialog = document.getElementById('updateCaseDialog');
      if (dialog) {
        dialog.remove();
      }
    }

    /**
     * טיפול בשליחת טופס עדכון תיק
     */
    async handleUpdateCaseSubmit(caseId) {
      try {
        const status = document.getElementById('updateStatus').value;

        await this.updateCase(caseId, { status });

        this.closeUpdateCaseDialog();

        if (window.notificationSystem) {
          window.notificationSystem.success('התיק עודכן בהצלחה!');
        } else {
          alert('התיק עודכן בהצלחה!');
        }

        // רענון הנתונים
        if (typeof this.onCaseUpdated === 'function') {
          this.onCaseUpdated();
        }

      } catch (error) {
        console.error('❌ Error updating case:', error);
        if (window.notificationSystem) {
          window.notificationSystem.error(error.message);
        } else {
          alert('שגיאה: ' + error.message);
        }
      }
    }

    // ==================== Helper Functions ====================

    /**
     * קבלת צבע סטטוס
     */
    getStatusColor(status) {
      const colors = {
        'active': '#10b981',
        'completed': '#6b7280',
        'on_hold': '#f59e0b',
        'archived': '#9ca3af'
      };
      return colors[status] || '#6b7280';
    }

    /**
     * קבלת טקסט סטטוס
     */
    getStatusText(status) {
      const texts = {
        'active': 'פעיל',
        'completed': 'הושלם',
        'on_hold': 'בהמתנה',
        'archived': 'בארכיון'
      };
      return texts[status] || status;
    }

    /**
     * פורמט שעות
     */
    formatHours(hours) {
      if (!hours) return '0 שעות';
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      if (m === 0) return `${h} שעות`;
      return `${h}:${m.toString().padStart(2, '0')} שעות`;
    }

    /**
     * ספירת שלבים שהושלמו
     */
    getCompletedStages(stages) {
      if (!Array.isArray(stages)) return 0;
      return stages.filter(s => s.completed).length;
    }

    /**
     * קבלת צבע רקע לסוג הליך
     */
    getProcedureTypeColor(procedureType) {
      const colors = {
        'hours': '#dbeafe',
        'legal_procedure': '#ede9fe',
        'fixed': '#d1fae5'
      };
      return colors[procedureType] || '#f3f4f6';
    }

    /**
     * קבלת צבע טקסט לסוג הליך
     */
    getProcedureTypeTextColor(procedureType) {
      const colors = {
        'hours': '#1e40af',
        'legal_procedure': '#6b21a8',
        'fixed': '#065f46'
      };
      return colors[procedureType] || '#374151';
    }

    /**
     * קבלת טקסט תצוגה לסוג הליך
     */
    getProcedureTypeText(procedureType) {
      const texts = {
        'hours': 'שעות',
        'legal_procedure': 'הליך משפטי',
        'fixed': 'קבוע'
      };
      return texts[procedureType] || procedureType;
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * קבלת הודעת שגיאה ברורה
     */
    getErrorMessage(error) {
      if (error.message) {
        return error.message;
      }
      if (error.code) {
        const errorMessages = {
          'permission-denied': 'אין הרשאה לבצע פעולה זו',
          'unauthenticated': 'נדרשת התחברות למערכת',
          'not-found': 'הפריט המבוקש לא נמצא',
          'already-exists': 'הפריט כבר קיים במערכת',
          'invalid-argument': 'נתונים לא תקינים'
        };
        return errorMessages[error.code] || `שגיאה: ${error.code}`;
      }
      return 'שגיאה לא ידועה';
    }
  }

  // ==================== חשיפה כ-Module גלובלי ====================

  window.CasesModule = {
    CasesManager,

    /**
     * יצירת instance חדש
     */
    create() {
      return new CasesManager();
    }
  };

  // יצירת instance גלובלי
  window.casesManager = new CasesManager();

  console.log('📂 Cases Module loaded successfully');

})();
