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
      Logger.log('📂 CasesManager initialized for user:', user.username);
    }

    // ==================== Firebase Functions API ====================

    /**
     * יצירת תיק חדש
     * @param {Object} caseData - נתוני התיק
     * @returns {Promise<Object>} התיק שנוצר
     */
    async createCase(caseData) {
      try {
        Logger.log('📝 Creating new case:', caseData);

        // ✅ במבנה החדש: createClient (Client=Case)
        const result = await firebase.functions().httpsCallable('createClient')(caseData);

        if (!result.data.success) {
          throw new Error(result.data.message || 'שגיאה ביצירת תיק');
        }

        Logger.log('✅ Case created successfully:', result.data.id);
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
        Logger.log('📋 Fetching cases with filters:', filters);

        // ✅ במבנה החדש: getClients (Client=Case)
        const result = await firebase.functions().httpsCallable('getClients')(filters);

        if (!result.data.success) {
          throw new Error(result.data.message || 'שגיאה בשליפת תיקים');
        }

        this.cases = result.data.clients || [];
        Logger.log(`✅ Fetched ${this.cases.length} cases`);
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
        Logger.log('📋 Fetching cases for client:', clientId);

        // ✅ במבנה החדש Client=Case: לקוח אחד = תיק אחד
        // פשוט נחזיר את הlokent הזה
        const db = firebase.firestore();
        const clientDoc = await db.collection('clients').doc(clientId).get();

        if (!clientDoc.exists) {
          throw new Error('לקוח לא נמצא');
        }

        const clientData = { id: clientDoc.id, ...clientDoc.data() };

        Logger.log(`✅ Fetched client/case:`, clientId);
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
        Logger.log('📋 Fetching all cases');
        // ✅ במבנה החדש: getClients (Client=Case)
        const result = await firebase.functions().httpsCallable('getClients')({});

        if (!result.data.success) {
          throw new Error(result.data.message || 'שגיאה בשליפת תיקים');
        }

        this.cases = result.data.clients || [];
        Logger.log(`✅ Fetched ${this.cases.length} cases`);
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
        Logger.log('📝 Updating case:', caseId, updates);

        // במבנה החדש: Client = Case
        const result = await firebase.functions().httpsCallable('updateClient')({
          clientId: caseId, // במבנה החדש clientId = caseId
          ...updates
        });

        if (!result.data.success) {
          throw new Error(result.data.message || 'שגיאה בעדכון תיק');
        }

        Logger.log('✅ Case updated successfully');
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

  Logger.log('📂 Cases Module loaded successfully');

})();
