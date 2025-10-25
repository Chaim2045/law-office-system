/**
 * Legal Procedures Module - מודול ניהול הליכים משפטיים
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 16/10/2025
 * גרסה: 1.0.0
 *
 * תכונות:
 * - יצירת הליכים משפטיים עם 3 שלבים
 * - ניהול חבילות שעות לכל שלב (ראשונית + תוספות)
 * - מעבר בין שלבים
 * - מעקב אחר שימוש בשעות לפי שלב
 * - תצוגה ברורה ללקוחות
 */

(function() {
  'use strict';

  /**
   * מחלקת LegalProceduresManager - מנהלת הליכים משפטיים
   */
  class LegalProceduresManager {
    constructor() {
      this.procedures = [];
      this.currentUser = null;
    }

    /**
     * אתחול המנהל
     */
    init(user) {
      this.currentUser = user;
      Logger.log('⚖️ LegalProceduresManager initialized for user:', user?.username);
    }

    // ==================== Validation Functions ====================

    /**
     * בדיקת תקינות שלבים
     * @param {Array} stages - מערך השלבים
     * @param {string} pricingType - סוג תמחור (hourly או fixed)
     * @returns {Object} { isValid, errors }
     */
    validateStages(stages, pricingType = 'hourly') {
      const errors = [];

      if (!Array.isArray(stages) || stages.length !== 3) {
        errors.push('חובה למלא בדיוק 3 שלבים');
        return { isValid: false, errors };
      }

      stages.forEach((stage, index) => {
        const stageNum = index + 1;

        // בדיקת תיאור השלב
        if (!stage.description || !stage.description.trim()) {
          errors.push(`שלב ${stageNum}: חובה למלא תיאור השלב`);
        }

        // בדיקה לפי סוג תמחור
        if (pricingType === 'hourly') {
          // בדיקת תקרת שעות
          if (!stage.hours || stage.hours <= 0) {
            errors.push(`שלב ${stageNum}: חובה למלא תקרת שעות תקינה`);
          }

          if (stage.hours && stage.hours > 1000) {
            errors.push(`שלב ${stageNum}: תקרת שעות גבוהה מדי (מקסימום 1000)`);
          }
        } else {
          // בדיקת מחיר פיקס
          if (!stage.fixedPrice || stage.fixedPrice <= 0) {
            errors.push(`שלב ${stageNum}: חובה למלא מחיר פיקס תקין`);
          }

          if (stage.fixedPrice && stage.fixedPrice > 1000000) {
            errors.push(`שלב ${stageNum}: מחיר גבוה מדי (מקסימום 1,000,000 ₪)`);
          }
        }
      });

      return {
        isValid: errors.length === 0,
        errors
      };
    }

    /**
     * בדיקת תקינות חבילת שעות חדשה
     * @param {number} hours - כמות שעות
     * @param {string} reason - סיבה
     * @returns {Object} { isValid, errors }
     */
    validateHoursPackage(hours, reason) {
      const errors = [];

      if (!hours || hours <= 0) {
        errors.push('חובה להזין כמות שעות תקינה');
      }

      if (hours > 500) {
        errors.push('כמות שעות גבוהה מדי (מקסימום 500 שעות בחבילה)');
      }

      if (!reason || reason.trim().length < 3) {
        errors.push('חובה להזין סיבה/הערה (לפחות 3 תווים)');
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    }

    // ==================== Firebase Functions Calls ====================

    /**
     * יצירת הליך משפטי חדש
     * @param {Object} procedureData - נתוני ההליך
     * @returns {Promise<Object>}
     */
    async createLegalProcedure(procedureData) {
      try {
        Logger.log('📝 Creating legal procedure:', procedureData);

        // Validation
        const validation = this.validateStages(procedureData.stages, procedureData.pricingType);
        if (!validation.isValid) {
          throw new Error(validation.errors.join('\n'));
        }

        // קריאה ל-Firebase Function (במבנה החדש: Client = Case)
        const result = await firebase.functions().httpsCallable('createClient')(procedureData);

        if (!result.data.success) {
          throw new Error(result.data.message || 'שגיאה ביצירת הליך משפטי');
        }

        Logger.log('✅ Legal procedure created successfully:', result.data.caseId);
        return result.data;

      } catch (error) {
        console.error('❌ Error creating legal procedure:', error);
        throw new Error(this.getErrorMessage(error));
      }
    }

    /**
     * הוספת חבילת שעות לשלב קיים
     * @param {string} caseId - מזהה התיק
     * @param {string} stageId - מזהה השלב
     * @param {Object} packageData - נתוני החבילה
     * @returns {Promise<Object>}
     */
    async addHoursPackageToStage(caseId, stageId, packageData) {
      try {
        Logger.log('📦 Adding hours package:', { caseId, stageId, packageData });

        // Validation
        const validation = this.validateHoursPackage(packageData.hours, packageData.reason);
        if (!validation.isValid) {
          throw new Error(validation.errors.join('\n'));
        }

        // במבנה החדש: Client = Case, עדכון ישיר ב-Firestore
        const db = firebase.firestore();
        const clientRef = db.collection('clients').doc(caseId);
        const clientDoc = await clientRef.get();

        if (!clientDoc.exists) {
          throw new Error('תיק לא נמצא');
        }

        const clientData = clientDoc.data();
        if (!clientData.stages || !Array.isArray(clientData.stages)) {
          throw new Error('אין שלבים בתיק זה');
        }

        // מצא את השלב ועדכן את חבילת השעות
        const stages = [...clientData.stages];
        const stageIndex = stages.findIndex(s => s.id === stageId);

        if (stageIndex === -1) {
          throw new Error('שלב לא נמצא');
        }

        if (!stages[stageIndex].hoursPackages) {
          stages[stageIndex].hoursPackages = [];
        }

        stages[stageIndex].hoursPackages.push({
          id: Date.now().toString(),
          hours: packageData.hours,
          reason: packageData.reason || '',
          addedAt: firebase.firestore.FieldValue.serverTimestamp(),
          addedBy: firebase.auth().currentUser?.email || 'system'
        });

        // עדכן את המסמך
        await clientRef.update({
          stages: stages,
          lastModifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastModifiedBy: firebase.auth().currentUser?.email || 'system'
        });

        Logger.log('✅ Hours package added successfully');
        return { success: true, message: 'חבילת השעות נוספה בהצלחה' };

      } catch (error) {
        console.error('❌ Error adding hours package:', error);
        throw new Error(this.getErrorMessage(error));
      }
    }

    /**
     * מעבר לשלב הבא
     * @param {string} caseId - מזהה התיק
     * @param {string} currentStageId - השלב הנוכחי
     * @returns {Promise<Object>}
     */
    async moveToNextStage(caseId, currentStageId) {
      try {
        Logger.log('➡️ Moving to next stage:', { caseId, currentStageId });

        // במבנה החדש: Client = Case, עדכון ישיר ב-Firestore
        const db = firebase.firestore();
        const clientRef = db.collection('clients').doc(caseId);
        const clientDoc = await clientRef.get();

        if (!clientDoc.exists) {
          throw new Error('תיק לא נמצא');
        }

        const clientData = clientDoc.data();
        if (!clientData.stages || !Array.isArray(clientData.stages)) {
          throw new Error('אין שלבים בתיק זה');
        }

        // מצא את השלב הנוכחי והשלב הבא
        const stages = [...clientData.stages];
        const currentStageIndex = stages.findIndex(s => s.id === currentStageId);

        if (currentStageIndex === -1) {
          throw new Error('שלב נוכחי לא נמצא');
        }

        if (currentStageIndex === stages.length - 1) {
          throw new Error('זהו השלב האחרון');
        }

        // עדכן סטטוסים
        stages[currentStageIndex].status = 'completed';
        stages[currentStageIndex].completedAt = firebase.firestore.FieldValue.serverTimestamp();

        stages[currentStageIndex + 1].status = 'active';
        stages[currentStageIndex + 1].startedAt = firebase.firestore.FieldValue.serverTimestamp();

        // עדכן את המסמך
        await clientRef.update({
          stages: stages,
          lastModifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastModifiedBy: firebase.auth().currentUser?.email || 'system'
        });

        Logger.log('✅ Moved to next stage successfully');
        return {
          success: true,
          message: 'עבר לשלב הבא בהצלחה',
          nextStage: stages[currentStageIndex + 1]
        };

      } catch (error) {
        console.error('❌ Error moving to next stage:', error);
        throw new Error(this.getErrorMessage(error));
      }
    }

    /**
     * שליפת הליך משפטי לפי ID
     * @param {string} caseId - מזהה התיק
     * @returns {Promise<Object>}
     */
    async getLegalProcedure(caseId) {
      try {
        // במבנה החדש: Client = Case, שלוף ישירות מ-Firestore
        const db = firebase.firestore();
        const clientDoc = await db.collection('clients').doc(caseId).get();

        if (!clientDoc.exists) {
          throw new Error('הליך משפטי לא נמצא');
        }

        return {
          id: clientDoc.id,
          caseNumber: clientDoc.data().caseNumber || clientDoc.id,
          ...clientDoc.data()
        };

      } catch (error) {
        console.error('❌ Error fetching legal procedure:', error);
        throw new Error(this.getErrorMessage(error));
      }
    }

    // ==================== UI Rendering Functions ====================

    /**
     * רינדור כרטיס הליך משפטי
     * @param {Object} procedure - נתוני ההליך
     * @param {HTMLElement} container - קונטיינר להצגה
     */
    renderProcedureCard(procedure, container) {
      if (!container) {
        console.error('❌ Container not found');
        return;
      }

      const currentStage = procedure.stages.find(s => s.status === 'active') || procedure.stages[0];
      const isFixed = procedure.pricingType === 'fixed';

      // חישובים עבור תמחור שעתי
      const totalHours = procedure.stages.reduce((sum, s) => sum + (s.totalHours || 0), 0);
      const totalUsed = procedure.stages.reduce((sum, s) => sum + (s.hoursUsed || 0), 0);
      const totalRemaining = procedure.stages.reduce((sum, s) => sum + (s.hoursRemaining || 0), 0);

      // חישובים עבור תמחור פיקס
      const totalPrice = procedure.stages.reduce((sum, s) => sum + (s.fixedPrice || 0), 0);
      const totalPaid = procedure.stages.filter(s => s.status === 'completed').reduce((sum, s) => sum + (s.fixedPrice || 0), 0);
      const remainingPrice = totalPrice - totalPaid;

      const cardHTML = `
        <div class="legal-procedure-card" style="
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          border-right: 4px solid #3b82f6;
        ">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
            <div>
              <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #1a1a1a;">
                <i class="fas fa-gavel" style="color: #3b82f6; margin-left: 8px;"></i>
                ${this.escapeHtml(procedure.caseTitle)}
              </h3>
              <div style="font-size: 13px; color: #666;">
                תיק מס׳ ${this.escapeHtml(procedure.caseNumber)}
              </div>
            </div>
            <span style="
              padding: 6px 12px;
              background: #dbeafe;
              color: #1e40af;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 500;
            ">
              הליך משפטי
            </span>
          </div>

          <!-- Current Stage -->
          <div style="
            background: #f0f9ff;
            border: 2px solid ${isFixed ? '#10b981' : '#3b82f6'};
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
          ">
            <div style="font-size: 12px; color: ${isFixed ? '#059669' : '#1e40af'}; font-weight: 600; margin-bottom: 4px;">
              שלב נוכחי ${isFixed ? '(פיקס)' : '(שעתי)'}
            </div>
            <div style="font-size: 16px; font-weight: 600; color: ${isFixed ? '#059669' : '#1e40af'};">
              ${this.escapeHtml(currentStage.name)} - ${this.escapeHtml(currentStage.description)}
            </div>
            <div style="font-size: 13px; color: ${isFixed ? '#10b981' : '#3b82f6'}; margin-top: 4px;">
              ${isFixed
                ? `מחיר: ₪${(currentStage.fixedPrice || 0).toLocaleString()}`
                : `${this.formatHours(currentStage.hoursRemaining || 0)} נותרות מתוך ${this.formatHours(currentStage.totalHours || 0)}`
              }
            </div>
          </div>

          <!-- Stages Progress -->
          <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; color: #666; font-weight: 600; margin-bottom: 8px;">
              התקדמות שלבים:
            </div>
            <div style="display: flex; gap: 8px;">
              ${procedure.stages.map(stage => `
                <div style="
                  flex: 1;
                  text-align: center;
                  padding: 8px;
                  background: ${stage.status === 'completed' ? '#dcfce7' : stage.status === 'active' ? '#dbeafe' : '#f3f4f6'};
                  border: 2px solid ${stage.status === 'completed' ? '#16a34a' : stage.status === 'active' ? '#3b82f6' : '#e5e7eb'};
                  border-radius: 6px;
                ">
                  <div style="font-size: 11px; color: #666; margin-bottom: 2px;">
                    ${this.escapeHtml(stage.name)}
                  </div>
                  <div style="
                    font-size: 16px;
                    color: ${stage.status === 'completed' ? '#16a34a' : stage.status === 'active' ? '#3b82f6' : '#9ca3af'};
                  ">
                    ${stage.status === 'completed' ? '✓' : stage.status === 'active' ? '●' : '○'}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Total Summary -->
          <div style="
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            padding: 12px;
            background: #f9fafb;
            border-radius: 8px;
            margin-bottom: 16px;
          ">
            ${isFixed ? `
              <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">סה"כ מחיר</div>
                <div style="font-size: 18px; font-weight: 600; color: #1a1a1a;">
                  ₪${totalPrice.toLocaleString()}
                </div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">שולם</div>
                <div style="font-size: 18px; font-weight: 600; color: #10b981;">
                  ₪${totalPaid.toLocaleString()}
                </div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">יתרה</div>
                <div style="font-size: 18px; font-weight: 600; color: ${remainingPrice > 0 ? '#ef4444' : '#10b981'};">
                  ₪${remainingPrice.toLocaleString()}
                </div>
              </div>
            ` : `
              <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">סה"כ שעות</div>
                <div style="font-size: 18px; font-weight: 600; color: #1a1a1a;">
                  ${this.formatHours(totalHours)}
                </div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">נוצלו</div>
                <div style="font-size: 18px; font-weight: 600; color: #ef4444;">
                  ${this.formatHours(totalUsed)}
                </div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">נותרו</div>
                <div style="font-size: 18px; font-weight: 600; color: #10b981;">
                  ${this.formatHours(totalRemaining)}
                </div>
              </div>
            `}
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 8px;">
            <button onclick="legalProceduresManager.showProcedureDetails('${procedure.id}')" style="
              flex: 1;
              padding: 10px 16px;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: background 0.2s;
            " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
              <i class="fas fa-eye"></i> צפה בפרטים
            </button>
            ${!isFixed && currentStage.status === 'active' && currentStage.hoursRemaining < 5 ? `
              <button onclick="legalProceduresManager.showAddPackageDialog('${procedure.id}', '${currentStage.id}')" style="
                padding: 10px 16px;
                background: #f59e0b;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
              ">
                <i class="fas fa-plus"></i> הוסף שעות
              </button>
            ` : ''}
          </div>
        </div>
      `;

      container.innerHTML = cardHTML;
    }

    /**
     * הצגת דיאלוג פרטי הליך משפטי
     * @param {string} caseId - מזהה התיק
     */
    async showProcedureDetails(caseId) {
      try {
        const procedure = await this.getLegalProcedure(caseId);

        const dialogHTML = `
          <div id="procedureDetailsDialog" style="
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
          ">
            <div style="
              background: white;
              border-radius: 16px;
              padding: 0;
              max-width: 800px;
              width: 90%;
              max-height: 90vh;
              overflow: hidden;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
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
                <div>
                  <h2 style="margin: 0; font-size: 22px; font-weight: 600;">
                    ${this.escapeHtml(procedure.caseTitle)}
                  </h2>
                  <div style="margin-top: 4px; opacity: 0.9;">
                    תיק מס׳ ${this.escapeHtml(procedure.caseNumber)}
                  </div>
                </div>
                <button onclick="legalProceduresManager.closeProcedureDetails()" style="
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
                ">
                  <i class="fas fa-times"></i>
                </button>
              </div>

              <!-- Content -->
              <div style="padding: 32px; overflow-y: auto; max-height: calc(90vh - 100px);">
                ${procedure.stages.map((stage, index) => this.renderStageDetails(stage, index, procedure.id, procedure.pricingType)).join('')}
              </div>
            </div>
          </div>
        `;

        document.body.insertAdjacentHTML('beforeend', dialogHTML);

      } catch (error) {
        console.error('❌ Error showing procedure details:', error);
        alert('שגיאה בטעינת פרטי ההליך: ' + error.message);
      }
    }

    /**
     * רינדור פרטי שלב
     * @param {Object} stage - נתוני השלב
     * @param {number} index - מספר השלב
     * @param {string} caseId - מזהה התיק
     * @param {string} pricingType - סוג תמחור (hourly או fixed)
     * @returns {string} HTML
     */
    renderStageDetails(stage, index, caseId, pricingType = 'hourly') {
      const stageNum = index + 1;
      const isFixed = pricingType === 'fixed';
      const statusColor = stage.status === 'completed' ? '#16a34a' : stage.status === 'active' ? '#3b82f6' : '#9ca3af';
      const statusText = stage.status === 'completed' ? 'הושלם' : stage.status === 'active' ? 'פעיל' : 'ממתין';

      return `
        <div style="
          border: 2px solid ${statusColor};
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
          background: ${stage.status === 'active' ? '#f0f9ff' : 'white'};
        ">
          <!-- Stage Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <h3 style="margin: 0 0 4px 0; font-size: 18px; color: ${statusColor};">
                שלב ${stageNum}: ${this.escapeHtml(stage.name)}
              </h3>
              <div style="font-size: 14px; color: #666;">
                ${this.escapeHtml(stage.description)}
              </div>
            </div>
            <span style="
              padding: 6px 12px;
              background: ${statusColor}20;
              color: ${statusColor};
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
            ">
              ${statusText}
            </span>
          </div>

          <!-- Packages / Fixed Price -->
          ${isFixed ? `
            <div style="margin-bottom: 16px;">
              <div style="font-size: 13px; color: #666; font-weight: 600; margin-bottom: 12px;">
                פרטי מחיר:
              </div>
              <div style="
                background: #f0fdf4;
                border: 1px solid #86efac;
                border-radius: 8px;
                padding: 12px 16px;
                margin-bottom: 8px;
              ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-size: 14px; font-weight: 600; color: #166534;">
                      מחיר קבוע - ${this.escapeHtml(stage.name)}
                    </div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">
                      ${this.escapeHtml(stage.description)}
                    </div>
                  </div>
                  <div style="text-align: left;">
                    <div style="font-size: 20px; font-weight: 600; color: #16a34a;">
                      ₪${(stage.fixedPrice || 0).toLocaleString()}
                    </div>
                    <div style="font-size: 12px; color: #666;">
                      ${stage.status === 'completed' ? 'שולם' : stage.status === 'active' ? 'לתשלום' : 'ממתין'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ` : `
            <div style="margin-bottom: 16px;">
              <div style="font-size: 13px; color: #666; font-weight: 600; margin-bottom: 12px;">
                חבילות שעות:
              </div>
              ${(stage.packages || []).map((pkg, pkgIndex) => `
                <div style="
                  background: white;
                  border: 1px solid #e5e7eb;
                  border-radius: 8px;
                  padding: 12px 16px;
                  margin-bottom: 8px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                ">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                      <span style="
                        padding: 2px 8px;
                        background: ${pkg.type === 'initial' ? '#dbeafe' : '#fef3c7'};
                        color: ${pkg.type === 'initial' ? '#1e40af' : '#92400e'};
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 600;
                      ">
                        ${pkg.type === 'initial' ? 'ראשונית' : 'תוספת ' + (pkgIndex)}
                      </span>
                      <span style="font-size: 13px; color: #666;">
                        ${this.formatDate(pkg.purchaseDate)}
                      </span>
                    </div>
                    ${pkg.reason ? `
                      <div style="font-size: 12px; color: #666; margin-top: 4px;">
                        ${this.escapeHtml(pkg.reason)}
                      </div>
                    ` : ''}
                  </div>
                  <div style="text-align: left;">
                    <div style="font-size: 16px; font-weight: 600; color: #1a1a1a;">
                      ${this.formatHours(pkg.hours)}
                    </div>
                    <div style="font-size: 12px; color: #666;">
                      נותרו: ${this.formatHours(pkg.hoursRemaining)}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}

          <!-- Summary -->
          ${!isFixed ? `
            <div style="
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              padding: 12px;
              background: #f9fafb;
              border-radius: 8px;
            ">
              <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">סה"כ זמין</div>
                <div style="font-size: 16px; font-weight: 600; color: #1a1a1a;">
                  ${this.formatHours(stage.totalHours || 0)}
                </div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">נוצל</div>
                <div style="font-size: 16px; font-weight: 600; color: #ef4444;">
                  ${this.formatHours(stage.hoursUsed || 0)}
                </div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 11px; color: #666;">נותר</div>
                <div style="font-size: 16px; font-weight: 600; color: #10b981;">
                  ${this.formatHours(stage.hoursRemaining || 0)}
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Actions -->
          ${stage.status === 'active' ? `
            <div style="display: flex; gap: 8px; margin-top: 16px;">
              ${!isFixed ? `
                <button onclick="legalProceduresManager.showAddPackageDialog('${caseId}', '${stage.id}')" style="
                  flex: 1;
                  padding: 10px 16px;
                  background: #f59e0b;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                  font-size: 14px;
                  font-weight: 500;
                ">
                  <i class="fas fa-plus"></i> הוסף חבילת שעות
                </button>
              ` : ''}
              ${stageNum < 3 ? `
                <button onclick="legalProceduresManager.confirmMoveToNextStage('${caseId}', '${stage.id}')" style="
                  flex: 1;
                  padding: 10px 16px;
                  background: #10b981;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                  font-size: 14px;
                  font-weight: 500;
                ">
                  <i class="fas fa-arrow-left"></i> סיים ועבור לשלב ${stageNum + 1}
                </button>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }

    /**
     * הצגת דיאלוג הוספת חבילת שעות
     * @param {string} caseId - מזהה התיק
     * @param {string} stageId - מזהה השלב
     */
    showAddPackageDialog(caseId, stageId) {
      const dialogHTML = `
        <div id="addPackageDialog" style="
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
          z-index: 10001;
        ">
          <div style="
            background: white;
            border-radius: 16px;
            padding: 0;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          ">
            <!-- Header -->
            <div style="
              background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
              padding: 24px 32px;
              color: white;
              display: flex;
              align-items: center;
              justify-content: space-between;
            ">
              <div style="display: flex; align-items: center; gap: 12px;">
                <i class="fas fa-plus-circle" style="font-size: 24px;"></i>
                <h2 style="margin: 0; font-size: 20px; font-weight: 600;">הוסף חבילת שעות</h2>
              </div>
              <button onclick="legalProceduresManager.closeAddPackageDialog()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
              ">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- Form -->
            <div style="padding: 32px;">
              <form id="addPackageForm">
                <input type="hidden" id="packageCaseId" value="${caseId}">
                <input type="hidden" id="packageStageId" value="${stageId}">

                <div style="margin-bottom: 20px;">
                  <label style="
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #374151;
                    font-size: 14px;
                  ">
                    <i class="fas fa-clock" style="color: #f59e0b; margin-left: 6px;"></i>
                    כמות שעות נוספות <span style="color: #ef4444;">*</span>
                  </label>
                  <input type="number" id="packageHours" min="1" max="500" required placeholder="30" style="
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 15px;
                    transition: all 0.2s;
                  " onfocus="this.style.borderColor='#f59e0b'; this.style.boxShadow='0 0 0 3px rgba(245,158,11,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                </div>

                <div style="margin-bottom: 20px;">
                  <label style="
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #374151;
                    font-size: 14px;
                  ">
                    <i class="fas fa-comment" style="color: #6366f1; margin-left: 6px;"></i>
                    סיבה/הערה <span style="color: #ef4444;">*</span>
                  </label>
                  <textarea id="packageReason" required placeholder="לדוגמה: חריגה בשעות עקב דיונים נוספים" rows="3" style="
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 15px;
                    resize: vertical;
                    transition: all 0.2s;
                  " onfocus="this.style.borderColor='#6366f1'; this.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'"></textarea>
                </div>

                <div style="margin-bottom: 24px;">
                  <label style="
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #374151;
                    font-size: 14px;
                  ">
                    <i class="fas fa-calendar" style="color: #10b981; margin-left: 6px;"></i>
                    תאריך רכישה
                  </label>
                  <input type="date" id="packageDate" value="${new Date().toISOString().split('T')[0]}" style="
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 15px;
                    transition: all 0.2s;
                  " onfocus="this.style.borderColor='#10b981'; this.style.boxShadow='0 0 0 3px rgba(16,185,129,0.1)'" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'">
                </div>

                <div style="display: flex; gap: 12px;">
                  <button type="submit" style="
                    flex: 1;
                    padding: 14px 24px;
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 600;
                    box-shadow: 0 4px 12px rgba(245,158,11,0.3);
                  ">
                    <i class="fas fa-check-circle" style="margin-left: 8px;"></i>
                    הוסף חבילה
                  </button>
                  <button type="button" onclick="legalProceduresManager.closeAddPackageDialog()" style="
                    padding: 14px 32px;
                    background: #f3f4f6;
                    color: #6b7280;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 600;
                  ">
                    ביטול
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', dialogHTML);

      // Event listener
      document.getElementById('addPackageForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleAddPackageSubmit();
      });
    }

    /**
     * טיפול בשליחת טופס הוספת חבילה
     */
    async handleAddPackageSubmit() {
      try {
        const caseId = document.getElementById('packageCaseId').value;
        const stageId = document.getElementById('packageStageId').value;
        const hours = parseInt(document.getElementById('packageHours').value);
        const reason = document.getElementById('packageReason').value.trim();
        const purchaseDate = document.getElementById('packageDate').value;

        const packageData = {
          hours,
          reason,
          purchaseDate
        };

        await this.addHoursPackageToStage(caseId, stageId, packageData);

        this.closeAddPackageDialog();
        this.closeProcedureDetails();

        if (window.manager && window.manager.showNotification) {
          window.manager.showNotification(`נוספו ${hours} שעות בהצלחה!`, 'success');
        } else {
          alert(`נוספו ${hours} שעות בהצלחה!`);
        }

        // Reload data
        if (window.manager && window.manager.loadDataFromFirebase) {
          await window.manager.loadDataFromFirebase();
        }

      } catch (error) {
        console.error('❌ Error adding package:', error);
        if (window.manager && window.manager.showNotification) {
          window.manager.showNotification('שגיאה: ' + error.message, 'error');
        } else {
          alert('שגיאה: ' + error.message);
        }
      }
    }

    /**
     * אישור מעבר לשלב הבא
     */
    async confirmMoveToNextStage(caseId, currentStageId) {
      const confirmed = confirm('האם אתה בטוח שברצונך לסיים שלב זה ולעבור לשלב הבא?');
      if (!confirmed) return;

      try {
        await this.moveToNextStage(caseId, currentStageId);

        this.closeProcedureDetails();

        if (window.manager && window.manager.showNotification) {
          window.manager.showNotification('עברת לשלב הבא בהצלחה!', 'success');
        } else {
          alert('עברת לשלב הבא בהצלחה!');
        }

        // Reload data
        if (window.manager && window.manager.loadDataFromFirebase) {
          await window.manager.loadDataFromFirebase();
        }

      } catch (error) {
        console.error('❌ Error moving to next stage:', error);
        if (window.manager && window.manager.showNotification) {
          window.manager.showNotification('שגיאה: ' + error.message, 'error');
        } else {
          alert('שגיאה: ' + error.message);
        }
      }
    }

    /**
     * סגירת דיאלוג פרטים
     */
    closeProcedureDetails() {
      const dialog = document.getElementById('procedureDetailsDialog');
      if (dialog) dialog.remove();
    }

    /**
     * סגירת דיאלוג הוספת חבילה
     */
    closeAddPackageDialog() {
      const dialog = document.getElementById('addPackageDialog');
      if (dialog) dialog.remove();
    }

    // ==================== Helper Functions ====================

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
     * פורמט תאריך
     */
    formatDate(date) {
      if (!date) return '-';
      const d = new Date(date);
      return d.toLocaleDateString('he-IL');
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
     * קבלת הודעת שגיאה
     */
    getErrorMessage(error) {
      if (error.message) return error.message;
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

  window.LegalProceduresModule = {
    LegalProceduresManager,
    create() {
      return new LegalProceduresManager();
    }
  };

  // יצירת instance גלובלי
  window.legalProceduresManager = new LegalProceduresManager();

  Logger.log('⚖️ Legal Procedures Module loaded successfully');

})();
