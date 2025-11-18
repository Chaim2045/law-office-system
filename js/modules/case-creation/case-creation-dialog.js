/**
 * ════════════════════════════════════════════════════════════════════
 * Case Creation Dialog - Modern
 * דיאלוג ליצירת תיק חדש או הוספת שירות ללקוח קיים
 * ════════════════════════════════════════════════════════════════════
 *
 * @module case-creation-dialog
 * @version 3.4.0
 * @updated 2025-01-18
 *
 * ════════════════════════════════════════════════════════════════════
 * 📝 CHANGELOG - autocomplete + liner style
 * ════════════════════════════════════════════════════════════════════
 *
 * 🗓️ תאריך: 2025-01-18
 * 📦 גרסה: 3.3.0 → 3.4.0
 *
 * ✅ שינויים:
 *
 * 1️⃣ החזרת ClientCaseSelector (autocomplete) במצב "לקוח קיים"
 * ──────────────────────────────────────────────────────────────
 * החלפנו בחזרה מ-dropdown פשוט ל-ClientCaseSelector עם autocomplete:
 *
 * HTML (שורה 252):
 *   <div id="caseDialogClientSelector"></div>
 *
 * JavaScript:
 *   - initClientSelector() (שורות 883-889)
 *     new ClientCaseSelector('caseDialogClientSelector', {
 *       hideServiceCards: true,  // ✅ מונע כרטיסייה כפולה
 *       hideCaseDropdown: true
 *     })
 *
 *   - setupClientSelectorListener() (שורות 894-967)
 *     האזנה ל-EventBus: 'client:selected'
 *
 * למה autocomplete עדיף על dropdown?
 *   ✓ חיפוש מהיר - הקלד 2 אותיות וקבל תוצאות
 *   ✓ ביצועים - לא טוען את כל הלקוחות מראש
 *   ✓ UX טוב יותר - במיוחד עם 50+ לקוחות
 *   ✓ אחיד - אותו component בכל המערכת
 *
 * 2️⃣ תיקון כרטיסייה כפולה עם hideServiceCards
 * ──────────────────────────────────────────────────────────────
 * ClientCaseSelector הציג כרטיסייה של "שירות נבחר" + הכרטיסייה הגדולה
 * שלנו → כפילות מבלבלת.
 *
 * הפתרון (שורה 886):
 *   hideServiceCards: true  // ✅ מסתיר את "שירות נבחר"
 *
 * כעת רק הכרטיסייה הגדולה מוצגת (showExistingCaseInfo).
 *
 * 3️⃣ שינוי לסטייל liner (שורות 1082-1142)
 * ──────────────────────────────────────────────────────────────
 * הכרטיסייה הגדולה שונתה מסטייל "מלא" לסטייל liner מינימליסטי:
 *
 * לפני:
 *   - background: linear-gradient(135deg, #f0f9ff, #e0f2fe)
 *   - border: 2px solid #3b82f6 (מסביב)
 *   - border-radius: 12px
 *   - padding: 16px
 *
 * אחרי:
 *   - background: #f9fafb (רקע אחיד)
 *   - border-right: 4px solid #3b82f6 (liner בצד בלבד)
 *   - border-radius: 6px
 *   - padding: 12px 16px
 *   - opacity: 0.95
 *
 * התוצאה:
 *   ✓ נקי ומינימליסטי
 *   ✓ אחיד עם שאר הכרטיסיות במערכת
 *   ✓ פחות "צועק" מהסטייל הקודם
 *
 * ════════════════════════════════════════════════════════════════════
 * 🎯 TWO OPERATION MODES
 * ════════════════════════════════════════════════════════════════════
 *
 * MODE 1: NEW CLIENT (לקוח חדש)
 * ─────────────────────────────────
 * Purpose: Create a brand new client + their first service
 * Process:
 *   1. User enters client details (name, ID, etc.)
 *   2. User configures first service
 *   3. Creates new document in 'clients' collection
 *
 * MODE 2: EXISTING CLIENT (לקוח קיים)
 * ──────────────────────────────────────
 * Purpose: Add an ADDITIONAL service to existing client
 * Process:
 *   1. User selects existing client from dropdown
 *   2. System displays existing services (FOR INFORMATION ONLY!)
 *   3. User configures new service to add
 *   4. New service added to client's 'services' array
 *
 * ⚠️ IMPORTANT - Existing Client Mode:
 * The services displayed are READ-ONLY information to show the user
 * what the client already has BEFORE adding a new service.
 * This prevents confusion and duplicate services.
 *
 * ════════════════════════════════════════════════════════════════════
 * 📦 SERVICE TYPES SUPPORTED
 * ════════════════════════════════════════════════════════════════════
 *
 * 1️⃣ HOURS PLAN (תוכנית שעות)
 * ─────────────────────────────
 * Type: 'hours'
 * Parameters:
 *   - totalHours: number (חובה)
 * Use Case:
 *   - Hourly retainer packages
 *   - Pay-as-you-go legal services
 * Example:
 *   { type: 'hours', totalHours: 50 }
 *
 * 2️⃣ LEGAL PROCEDURE (הליך משפטי)
 * ──────────────────────────────────
 * Type: 'legal_procedure'
 * Pricing Options:
 *   A) Hourly (תמחור שעתי)
 *      - pricingType: 'hourly'
 *      - Each of 3 stages gets hour packages
 *      - Stages: א' (filing), ב' (arguments), ג' (summary)
 *
 *   B) Fixed Price (מחיר קבוע)
 *      - pricingType: 'fixed'
 *      - One-time payment per stage
 *      - No hour tracking
 *
 * Use Case:
 *   - Court cases
 *   - Structured legal procedures
 * Example:
 *   {
 *     type: 'legal_procedure',
 *     pricingType: 'hourly',
 *     stages: [...]
 *   }
 *
 * 3️⃣ FIXED PRICE SERVICE (שירות במחיר קבוע)
 * ───────────────────────────────────────────
 * Type: 'fixed'
 * Parameters:
 *   - price: number
 * Use Case:
 *   - One-time document reviews
 *   - Fixed-fee consultations
 * Example:
 *   { type: 'fixed', price: 5000 }
 *
 * ════════════════════════════════════════════════════════════════════
 * 🔧 ARCHITECTURE NOTES
 * ════════════════════════════════════════════════════════════════════
 *
 * Data Model:
 *   - Client = Case (unified model)
 *   - Services stored in client.services[] array
 *   - Each service can be different type
 *
 * Key Properties:
 *   - this.currentMode: 'new' | 'existing'
 *   - this.procedureType: 'hours' | 'legal_procedure' | 'fixed'
 *   - this.pricingType: 'hourly' | 'fixed' (for legal_procedure)
 *   - this.currentCase: existing client data (when mode='existing')
 *
 * ════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  class CaseCreationDialog {
    constructor() {
      this.currentMode = 'new'; // 'new' או 'existing'
      this.clientSelector = null;
      this.procedureType = 'hours';
      this.pricingType = 'hourly';
      this.currentCase = null; // ✅ תיק קיים (למצב הוספת שירות)
    }

    /**
     * פתיחת הדיאלוג
     */
    async open() {
      try {
        // בדיקה שהמערכות מאותחלות
        if (!window.CaseNumberGenerator?.isInitialized) {
          await window.CaseNumberGenerator.initialize();
        }

        if (!window.ClientCaseSelector?.cacheInitialized) {
          await window.ClientCaseSelector.initializeCache();
        }

        // הצגת loading
        if (window.NotificationSystem) {
          window.NotificationSystem.showLoading('טוען...');
        }

        // בניית ועקירת הדיאלוג
        this.renderDialog();
        this.attachEventListeners();

        // הסתרת loading
        if (window.NotificationSystem) {
          window.NotificationSystem.hideLoading();
        }

        Logger.log('✅ Case creation dialog opened');
      } catch (error) {
        console.error('❌ Error opening dialog:', error);
        if (window.NotificationSystem) {
          window.NotificationSystem.error('שגיאה בפתיחת דיאלוג');
        }
      }
    }

    /**
     * בניית ה-HTML של הדיאלוג
     */
    renderDialog() {
      const dialogHTML = `
        <div id="modernCaseDialog" class="case-dialog-overlay">
          <div class="case-dialog-container">
            <!-- Header -->
            <div class="case-dialog-header">
              <div class="case-dialog-header-content">
                <i class="fas fa-folder-plus"></i>
                <h2>תיק חדש</h2>
              </div>
              <button id="modernCaseDialog_close" class="case-dialog-close">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- Content -->
            <div class="case-dialog-content">
              <form id="modernCaseForm">

                <!-- שגיאות ואזהרות -->
                <div id="formErrors" style="display: none;"></div>
                <div id="formWarnings" style="display: none;"></div>

                <!-- Step 1: בחירת מצב לקוח -->
                <div class="form-section" style="margin-bottom: 32px;">
                  <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2937;">
                    <i class="fas fa-user" style="color: #3b82f6; margin-left: 8px;"></i>
                    לקוח
                  </h3>

                  <!-- Tabs -->
                  <div style="
                    display: flex;
                    gap: 8px;
                    background: #f3f4f6;
                    padding: 4px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                  ">
                    <button type="button" id="newClientModeBtn" class="mode-tab active" style="
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
                      <i class="fas fa-user-plus"></i> לקוח חדש
                    </button>
                    <button type="button" id="existingClientModeBtn" class="mode-tab" style="
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
                      <i class="fas fa-users"></i> לקוח קיים
                    </button>
                  </div>

                  <!-- New Client Mode -->
                  <div id="newClientMode">
                    <div style="margin-bottom: 16px;">
                      <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">
                        <i class="fas fa-id-card" style="color: #3b82f6; margin-left: 6px;"></i>
                        שם הלקוח <span style="color: #ef4444;">*</span>
                      </label>
                      <input
                        type="text"
                        id="newClientName"
                        placeholder="שם מלא"
                        style="
                          width: 100%;
                          padding: 12px 16px;
                          border: 2px solid #e5e7eb;
                          border-radius: 8px;
                          font-size: 15px;
                          transition: all 0.2s;
                        "
                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'"
                        onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'"
                      >
                    </div>
                  </div>

                  <!-- Existing Client Mode -->
                  <div id="existingClientMode" style="display: none;">
                    <div id="caseDialogClientSelector"></div>
                  </div>
                </div>

                <!-- Divider -->
                <div style="height: 1px; background: linear-gradient(to left, transparent, #e5e7eb, transparent); margin: 32px 0;"></div>

                <!-- Step 2: פרטי תיק -->
                <div class="form-section" style="margin-bottom: 32px;">
                  <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2937;">
                    <i class="fas fa-folder" style="color: #f59e0b; margin-left: 8px;"></i>
                    פרטי התיק
                  </h3>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <!-- מספר תיק -->
                    <div>
                      <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">
                        <i class="fas fa-hashtag" style="color: #f59e0b; margin-left: 6px;"></i>
                        מספר תיק <span style="color: #ef4444;">*</span>
                      </label>
                      <input
                        type="text"
                        id="caseNumber"
                        readonly
                        placeholder="יתווסף אוטומטית..."
                        style="
                          width: 100%;
                          padding: 12px 16px;
                          border: 2px solid #e5e7eb;
                          border-radius: 8px;
                          font-size: 15px;
                          background: #f9fafb;
                          color: #6b7280;
                          cursor: not-allowed;
                        "
                      >
                    </div>

                    <!-- סוג הליך -->
                    <div>
                      <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">
                        <i class="fas fa-gavel" style="color: #ef4444; margin-left: 6px;"></i>
                        סוג הליך <span style="color: #ef4444;">*</span>
                      </label>
                      <select
                        id="procedureType"
                        required
                        style="
                          width: 100%;
                          padding: 12px 16px;
                          border: 2px solid #e5e7eb;
                          border-radius: 8px;
                          font-size: 15px;
                          background: white;
                          cursor: pointer;
                          transition: all 0.2s;
                        "
                        onfocus="this.style.borderColor='#ef4444'; this.style.boxShadow='0 0 0 3px rgba(239,68,68,0.1)'"
                        onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'"
                      >
                        <option value="hours">⏱️ שעות (ללא שלבים)</option>
                        <option value="legal_procedure">⚖️ הליך משפטי מבוסס שלבים</option>
                      </select>
                    </div>
                  </div>

                  <!-- כותרת תיק -->
                  <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">
                      <i class="fas fa-file-alt" style="color: #6366f1; margin-left: 6px;"></i>
                      כותרת התיק <span style="color: #ef4444;">*</span>
                    </label>
                    <input
                      type="text"
                      id="caseTitle"
                      required
                      placeholder="לדוגמה: תביעה עירונית - עיריית ת״א"
                      style="
                        width: 100%;
                        padding: 12px 16px;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        font-size: 15px;
                        transition: all 0.2s;
                      "
                      onfocus="this.style.borderColor='#6366f1'; this.style.boxShadow='0 0 0 3px rgba(99,102,241,0.1)'"
                      onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'"
                    >
                  </div>

                  <!-- תיאור -->
                  <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">
                      <i class="fas fa-align-right" style="color: #6b7280; margin-left: 6px;"></i>
                      תיאור נוסף
                    </label>
                    <textarea
                      id="caseDescription"
                      rows="3"
                      placeholder="תיאור קצר של התיק..."
                      style="
                        width: 100%;
                        padding: 12px 16px;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        font-size: 15px;
                        resize: vertical;
                        transition: all 0.2s;
                      "
                      onfocus="this.style.borderColor='#6b7280'; this.style.boxShadow='0 0 0 3px rgba(107,114,128,0.1)'"
                      onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'"
                    ></textarea>
                  </div>
                </div>

                <!-- Divider -->
                <div style="height: 1px; background: linear-gradient(to left, transparent, #e5e7eb, transparent); margin: 32px 0;"></div>

                <!-- Step 3: שירות -->
                <div id="serviceSection">
                  <!-- יוצג דינמית לפי סוג הליך -->
                </div>

                <!-- Actions -->
                <div class="case-dialog-actions">
                  <button type="button" id="modernCaseDialog_cancel" class="btn btn-secondary">
                    ביטול
                  </button>
                  <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i>
                    שמור תיק
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', dialogHTML);

      // רינדור סקשן שירות (ברירת מחדל: שעות)
      this.renderServiceSection();

      // ❌ הוסר: מספר תיק לא נטען אוטומטית
      // ✅ חדש: מספר תיק ייטען רק אחרי שהמשתמש הזין שם לקוח
    }

    /**
     * טעינת מספר תיק אוטומטי
     */
    async loadCaseNumber() {
      const input = document.getElementById('caseNumber');
      if (!input) {
        console.error('❌ Case number input not found!');
        return;
      }

      // בדיקה אם Generator קיים
      if (!window.CaseNumberGenerator) {
        console.error('❌ CaseNumberGenerator not loaded!');
        input.value = 'שגיאה: Generator לא נטען';
        input.style.color = '#ef4444';
        return;
      }

      // אם לא מאותחל - חכה לאתחול
      if (!window.CaseNumberGenerator.isInitialized) {
        input.value = 'טוען...';
        input.style.color = '#9ca3af';

        // חכה עד 5 שניות לאתחול
        let attempts = 0;
        const maxAttempts = 50; // 50 * 100ms = 5 seconds

        while (!window.CaseNumberGenerator.isInitialized && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!window.CaseNumberGenerator.isInitialized) {
          console.error('❌ CaseNumberGenerator initialization timeout!');
          input.value = 'שגיאה: לא הצליח לטעון';
          input.style.color = '#ef4444';
          return;
        }
      }

      // ✅ טען מספר תיק חכם עם בדיקת זמינות בזמן אמת
      input.value = 'בודק זמינות...';
      input.style.color = '#3b82f6';
      input.style.fontWeight = '600';

      try {
        const nextNumber = await window.CaseNumberGenerator.getNextAvailableCaseNumber();
        input.value = nextNumber;
        input.style.color = '#059669';

        Logger.log(`✅ Available case number loaded: ${nextNumber}`);
      } catch (error) {
        console.error('❌ Error loading available case number:', error);

        // Fallback לפונקציה הרגילה אם הזמינות נכשלה
        const fallbackNumber = window.CaseNumberGenerator.getNextCaseNumber();
        input.value = fallbackNumber;
        input.style.color = '#f59e0b'; // צהוב לסימן אזהרה

        Logger.log(`⚠️ Using fallback case number: ${fallbackNumber}`);
      }
    }

    /**
     * רינדור סקשן שירות לפי סוג הליך
     */
    renderServiceSection() {
      const container = document.getElementById('serviceSection');
      if (!container) {
return;
}

      if (this.procedureType === 'hours') {
        container.innerHTML = this.renderHoursSection();
      } else if (this.procedureType === 'legal_procedure') {
        container.innerHTML = this.renderLegalProcedureSection();
      }

      // Event listeners לסוג תמחור (אם הליך משפטי)
      if (this.procedureType === 'legal_procedure') {
        this.attachPricingTypeListeners();
      }
    }

    /**
     * רינדור סקשן שעות
     */
    renderHoursSection() {
      return `
        <div class="form-section">
          <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2937;">
            <i class="fas fa-clock" style="color: #3b82f6; margin-left: 8px;"></i>
            שעות
          </h3>

          <div>
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">
              <i class="fas fa-hourglass-half" style="color: #3b82f6; margin-left: 6px;"></i>
              כמות שעות <span style="color: #ef4444;">*</span>
            </label>
            <input
              type="number"
              id="totalHours"
              min="1"
              step="0.5"
              placeholder="50"
              required
              style="
                width: 100%;
                padding: 12px 16px;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                font-size: 15px;
                transition: all 0.2s;
              "
              onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'"
              onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'"
            >
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #6b7280;">
              <i class="fas fa-info-circle" style="margin-left: 4px;"></i>
              מספר השעות שהלקוח רכש
            </p>
          </div>
        </div>
      `;
    }

    /**
     * רינדור סקשן הליך משפטי
     */
    renderLegalProcedureSection() {
      // הקוד ימשך בקובץ הבא בגלל אורכו...
      return `
        <div class="form-section">
          <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1f2937;">
            <i class="fas fa-balance-scale" style="color: #8b5cf6; margin-left: 8px;"></i>
            הליך משפטי
          </h3>

          <!-- הודעה מידעית -->
          <div style="
            background: linear-gradient(135deg, #ede9fe 0%, #e9d5ff 100%);
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-right: 4px solid #8b5cf6;
          ">
            <p style="margin: 0; font-size: 13px; color: #7c3aed; line-height: 1.6;">
              <i class="fas fa-info-circle" style="margin-left: 6px;"></i>
              יש למלא <strong>3 שלבים מלאים</strong>. בחר סוג תמחור ומלא את הפרטים עבור כל שלב.
            </p>
          </div>

          <!-- בחירת סוג תמחור -->
          <div style="margin-bottom: 24px;">
            <label style="display: block; margin-bottom: 12px; font-weight: 600; color: #374151; font-size: 14px;">
              <i class="fas fa-calculator" style="color: #8b5cf6; margin-left: 6px;"></i>
              סוג תמחור <span style="color: #ef4444;">*</span>
            </label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <label class="pricing-type-label" style="
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 16px;
                border: 2px solid #3b82f6;
                border-radius: 8px;
                cursor: pointer;
                background: #f0f9ff;
              ">
                <input type="radio" name="pricingType" value="hourly" checked style="width: 18px; height: 18px;">
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: #1a1a1a;">
                    <i class="fas fa-clock" style="color: #3b82f6; margin-left: 6px;"></i>
                    תמחור שעתי
                  </div>
                  <div style="font-size: 12px; color: #6b7280;">תקרת שעות לכל שלב</div>
                </div>
              </label>

              <label class="pricing-type-label" style="
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 16px;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                cursor: pointer;
                background: white;
              ">
                <input type="radio" name="pricingType" value="fixed" style="width: 18px; height: 18px;">
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: #1a1a1a;">
                    <i class="fas fa-shekel-sign" style="color: #10b981; margin-left: 6px;"></i>
                    מחיר פיקס
                  </div>
                  <div style="font-size: 12px; color: #6b7280;">מחיר קבוע לכל שלב</div>
                </div>
              </label>
            </div>
          </div>

          <!-- 3 שלבים -->
          ${this.renderStage('A', 'א\'', '#3b82f6')}
          ${this.renderStage('B', 'ב\'', '#10b981')}
          ${this.renderStage('C', 'ג\'', '#f59e0b')}
        </div>
      `;
    }

    /**
     * רינדור שלב בודד
     */
    renderStage(stageKey, stageName, color) {
      const isHourly = this.pricingType === 'hourly';

      return `
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
              background: ${color};
              color: white;
              border-radius: 50%;
              text-align: center;
              line-height: 28px;
              margin-left: 8px;
              font-size: 13px;
            ">${stageName}</span>
            שלב ${stageName}
          </h4>

          <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #374151;">
              תיאור השלב <span style="color: #ef4444;">*</span>
            </label>
            <input
              type="text"
              id="stage${stageKey}_description"
              placeholder="לדוגמה: הגשת תביעה"
              required
              style="
                width: 100%;
                padding: 10px 14px;
                border: 2px solid #e5e7eb;
                border-radius: 6px;
                font-size: 14px;
              "
            >
          </div>

          <div>
            <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #374151;">
              ${isHourly ? 'שעות' : 'מחיר פיקס'} <span style="color: #ef4444;">*</span>
            </label>
            <input
              type="number"
              id="stage${stageKey}_${isHourly ? 'hours' : 'fixedPrice'}"
              class="${isHourly ? 'hourly-field' : 'fixed-field'}"
              min="1"
              step="${isHourly ? '0.5' : '100'}"
              placeholder="${isHourly ? '20' : '5000'}"
              required
              style="
                width: 100%;
                padding: 10px 14px;
                border: 2px solid #e5e7eb;
                border-radius: 6px;
                font-size: 14px;
              "
            >
          </div>
        </div>
      `;
    }

    /**
     * צירוף event listeners
     */
    attachEventListeners() {
      // כפתורי סגירה
      document.getElementById('modernCaseDialog_close')?.addEventListener('click', () => this.close());
      document.getElementById('modernCaseDialog_cancel')?.addEventListener('click', () => this.close());

      // מעבר בין מצבי לקוח
      document.getElementById('newClientModeBtn')?.addEventListener('click', () => this.switchMode('new'));
      document.getElementById('existingClientModeBtn')?.addEventListener('click', () => this.switchMode('existing'));

      // ✅ NEW: טעינת מספר תיק רק אחרי שהמשתמש הזין שם לקוח
      const newClientNameInput = document.getElementById('newClientName');
      if (newClientNameInput) {
        newClientNameInput.addEventListener('input', (e) => {
          const name = e.target.value.trim();
          // טען מספר תיק רק אם השם ארוך מ-2 תווים
          if (name.length >= 2 && this.currentMode === 'new') {
            this.loadCaseNumber();
          } else {
            // נקה את השדה אם השם קצר מדי
            const caseNumberInput = document.getElementById('caseNumber');
            if (caseNumberInput) {
              caseNumberInput.value = '';
            }
          }
        });
      }

      // שינוי סוג הליך
      document.getElementById('procedureType')?.addEventListener('change', (e) => {
        this.procedureType = e.target.value;
        this.renderServiceSection();
      });

      // שליחת טופס
      document.getElementById('modernCaseForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSubmit();
      });
    }

    /**
     * צירוף listeners לסוג תמחור
     */
    attachPricingTypeListeners() {
      const pricingRadios = document.querySelectorAll('input[name="pricingType"]');
      pricingRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.pricingType = e.target.value;
          this.renderServiceSection();

          // עדכון סטייל של הלייבלים
          document.querySelectorAll('.pricing-type-label').forEach(label => {
            const input = label.querySelector('input');
            if (input.checked) {
              label.style.borderColor = input.value === 'hourly' ? '#3b82f6' : '#10b981';
              label.style.background = input.value === 'hourly' ? '#f0f9ff' : '#f0fdf4';
            } else {
              label.style.borderColor = '#e5e7eb';
              label.style.background = 'white';
            }
          });
        });
      });
    }

    /**
     * מעבר בין מצבים
     */
    switchMode(mode) {
      this.currentMode = mode;

      const newMode = document.getElementById('newClientMode');
      const existingMode = document.getElementById('existingClientMode');
      const newBtn = document.getElementById('newClientModeBtn');
      const existingBtn = document.getElementById('existingClientModeBtn');

      if (mode === 'new') {
        newMode.style.display = 'block';
        existingMode.style.display = 'none';
        newBtn.classList.add('active');
        existingBtn.classList.remove('active');
        newBtn.style.background = 'white';
        newBtn.style.color = '#3b82f6';
        newBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        existingBtn.style.background = 'transparent';
        existingBtn.style.color = '#6b7280';
        existingBtn.style.boxShadow = 'none';

        // ✅ טען מספר תיק רק אם כבר יש שם לקוח
        const clientName = document.getElementById('newClientName')?.value?.trim();
        if (clientName && clientName.length >= 2) {
          setTimeout(() => this.loadCaseNumber(), 50);
        } else {
          // נקה את שדה מספר התיק
          const caseNumberInput = document.getElementById('caseNumber');
          if (caseNumberInput) {
            caseNumberInput.value = '';
          }
        }
      } else {
        newMode.style.display = 'none';
        existingMode.style.display = 'block';
        existingBtn.classList.add('active');
        newBtn.classList.remove('active');
        existingBtn.style.background = 'white';
        existingBtn.style.color = '#3b82f6';
        existingBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        newBtn.style.background = 'transparent';
        newBtn.style.color = '#6b7280';
        newBtn.style.boxShadow = 'none';

        // ✅ נקה מספר תיק ונעל אותו (יטען אוטומטית לאחר בחירת לקוח)
        const caseNumberInput = document.getElementById('caseNumber');
        if (caseNumberInput) {
          caseNumberInput.value = '';
          caseNumberInput.disabled = true;
          caseNumberInput.style.background = '#f9fafb';
          caseNumberInput.style.color = '#9ca3af';
          caseNumberInput.style.cursor = 'not-allowed';
          caseNumberInput.placeholder = 'יטען אוטומטית לאחר בחירת לקוח';
        }

        // צור selector אם לא קיים
        if (!this.clientSelector) {
          this.initClientSelector();
        }

        // ✅ האזנה לאירוע בחירת לקוח
        this.setupClientSelectorListener();

        // ✅ עדכון מצב כפתור שמור
        this.updateSubmitButton();
      }
    }

    /**
     * עדכון מצב כפתור שמור (enable/disable)
     * במצב existing - הכפתור נעול עד שבוחרים לקוח
     */
    updateSubmitButton() {
      const submitBtn = document.querySelector('#modernCaseForm button[type="submit"]');
      if (!submitBtn) {
return;
}

      if (this.currentMode === 'existing' && !this.currentCase) {
        // ❌ במצב existing ללא לקוח - נעל כפתור
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.title = 'יש לבחור לקוח לפני שמירה';
        Logger.log('🔒 Submit button disabled - no client selected');
      } else {
        // ✅ מצב תקין - אפשר שמירה
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.title = '';
        Logger.log('🔓 Submit button enabled');
      }
    }

    /**
     * אתחול ClientCaseSelector
     */
    initClientSelector() {
      this.clientSelector = new ClientCaseSelector('caseDialogClientSelector', {
        required: false, // לא חובה כי זה רק בחירת לקוח קיים
        hideServiceCards: true, // ✅ מסתיר את הכרטיסייה הכפולה של שירות נבחר
        hideCaseDropdown: true // לא צריך תיקים כאן
      });
    }

    /**
     * האזנה לבחירת לקוח מה-ClientCaseSelector
     */
    setupClientSelectorListener() {
      // האזנה לאירוע client:selected דרך EventBus (v2.0 naming convention)
      window.EventBus?.on('client:selected', async (data) => {
        Logger.log('🎯 Client selected:', data);

        if (data.clientId) {
          try {
            // בדיקה אם ללקוח יש תיק קיים
            const existingCase = await this.checkExistingCaseForClient(data.clientId);

            if (existingCase) {
              // ✅ שמירת התיק הקיים
              this.currentCase = existingCase;

              // נעילת שדה מספר תיק (read-only)
              const caseNumberField = document.getElementById('caseNumber');
              if (caseNumberField) {
                caseNumberField.value = existingCase.caseNumber;
                caseNumberField.placeholder = '';  // ✅ הסרת placeholder
                caseNumberField.disabled = true;
                caseNumberField.style.background = '#ecfdf5';  // ✅ ירוק בהיר
                caseNumberField.style.color = '#059669';        // ✅ ירוק כהה
                caseNumberField.style.fontWeight = '600';       // ✅ הדגשה
                caseNumberField.style.cursor = 'not-allowed';
                caseNumberField.title = `תיק קיים #${existingCase.caseNumber} - לא ניתן לשינוי`;
              }

              // הצגת כרטיס מידע על התיק והשירותים הקיימים
              this.showExistingCaseInfo(existingCase);

              Logger.log('✅ Existing case loaded for adding service');

              // ✅ עדכון כפתור שמור (אפשר שמירה)
              this.updateSubmitButton();
            } else {
              // ✅ ריסט אם אין תיק קיים
              this.currentCase = null;

              // ריסט שדה מספר תיק למצב התחלתי
              const caseNumberField = document.getElementById('caseNumber');
              if (caseNumberField) {
                caseNumberField.value = '';
                caseNumberField.placeholder = 'יטען אוטומטית לאחר בחירת לקוח';
                caseNumberField.disabled = true;
                caseNumberField.style.background = '#f9fafb';
                caseNumberField.style.color = '#9ca3af';
                caseNumberField.style.fontWeight = 'normal';
                caseNumberField.style.cursor = 'not-allowed';
                caseNumberField.title = '';
              }

              // הסרת כרטיס מידע אם קיים
              const existingInfo = document.getElementById('existingCaseInfo');
              if (existingInfo) {
                existingInfo.remove();
              }

              Logger.log('⚠️ No existing case found for this client');

              // ✅ עדכון כפתור שמור (נעל כפתור)
              this.updateSubmitButton();
            }
          } catch (error) {
            console.error('❌ Error loading client case:', error);
            this.currentCase = null;

            // ריסט שדה מספר תיק
            const caseNumberField = document.getElementById('caseNumber');
            if (caseNumberField) {
              caseNumberField.value = '';
              caseNumberField.placeholder = 'יטען אוטומטית לאחר בחירת לקוח';
              caseNumberField.disabled = true;
              caseNumberField.style.background = '#f9fafb';
              caseNumberField.style.color = '#9ca3af';
              caseNumberField.style.fontWeight = 'normal';
              caseNumberField.style.cursor = 'not-allowed';
              caseNumberField.title = '';
            }

            this.updateSubmitButton();
          }
        } else {
          // ❌ אם לא נבחר לקוח (ביטול בחירה)
          this.currentCase = null;

          // ריסט שדה מספר תיק
          const caseNumberField = document.getElementById('caseNumber');
          if (caseNumberField) {
            caseNumberField.value = '';
            caseNumberField.placeholder = 'יטען אוטומטית לאחר בחירת לקוח';
            caseNumberField.disabled = true;
            caseNumberField.style.background = '#f9fafb';
            caseNumberField.style.color = '#9ca3af';
            caseNumberField.style.fontWeight = 'normal';
            caseNumberField.style.cursor = 'not-allowed';
            caseNumberField.title = '';
          }

          this.updateSubmitButton();
        }
      });

      Logger.log('✅ Client selector listener setup');
    }

    /**
     * בדיקה אם ללקוח יש תיק קיים
     * @param {string} clientId - מזהה הלקוח (document ID = caseNumber)
     * @returns {Promise<Object|null>} תיק קיים או null
     */
    async checkExistingCaseForClient(clientId) {
      try {
        Logger.log(`🔍 Checking existing case for client: ${clientId}`);

        // ✅ במבנה החדש: כל client הוא case
        const clientDoc = await firebase.firestore()
          .collection('clients')
          .doc(clientId)
          .get();

        if (!clientDoc.exists) {
          Logger.log('  ❌ Client not found');
          return null;
        }

        const data = clientDoc.data();

        // בדיקת סטטוס פעיל
        if (data.status !== 'active') {
          Logger.log('  ⚠️ Client exists but not active');
          return null;
        }

        Logger.log('  ✅ Found existing case');
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
     */
    showExistingCaseInfo(existingCase) {
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
            const hours = window.calculateRemainingHours?.(service) || service.hoursRemaining || 0;
            const totalHours = service.totalHours || 0;
            serviceType = 'תוכנית שעות';
            serviceInfo = `${hours.toFixed(1)}/${totalHours} שעות`;
          } else if (service.type === 'legal_procedure') {
            serviceType = 'הליך משפטי';
            const currentStage = service.stages?.find(s => s.status === 'active');
            serviceInfo = currentStage ? currentStage.name : 'הליך משפטי';
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
              opacity: 0.85;
              cursor: default;
            ">
              <div>
                <div style="font-weight: 500; color: #1a1a1a; font-size: 13px;">
                  <i class="fas fa-lock" style="font-size: 9px; color: #9ca3af; margin-left: 6px;"></i>
                  ${serviceType || service.name || `שירות ${index + 1}`}
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
          background: #f9fafb;
          border-right: 4px solid #3b82f6;
          border-radius: 6px;
          padding: 12px 16px;
          margin-top: 12px;
          margin-bottom: 12px;
          opacity: 0.95;
        ">
          <!-- כותרת -->
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
          ">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-folder-open" style="color: #3b82f6; font-size: 14px;"></i>
              <div>
                <span style="font-weight: 600; color: #1f2937; font-size: 13px;">
                  תיק #${existingCase.caseNumber}
                </span>
                <span style="font-size: 11px; color: #6b7280; margin-right: 8px;">
                  ${totalServices} ${totalServices === 1 ? 'שירות' : 'שירותים'}
                </span>
              </div>
            </div>
            <div style="
              font-size: 10px;
              color: #6b7280;
              background: white;
              padding: 3px 8px;
              border-radius: 4px;
              font-weight: 500;
            ">
              <i class="fas fa-eye" style="margin-left: 4px;"></i>
              למידע בלבד
            </div>
          </div>

          <!-- רשימת שירותים -->
          <div style="margin-bottom: 10px;">
            ${servicesHTML}
          </div>

          <!-- הודעה -->
          <div style="
            background: #fffbeb;
            border-right: 3px solid #f59e0b;
            border-radius: 4px;
            padding: 8px 10px;
            font-size: 11px;
            color: #92400e;
            line-height: 1.5;
          ">
            <i class="fas fa-info-circle" style="margin-left: 4px; color: #f59e0b;"></i>
            השירות החדש שתגדיר למטה יתווסף לתיק זה
          </div>
        </div>
      `;

      // הצגת הכרטיס - נחפש את המיקום המתאים
      const existingClientMode = document.getElementById('existingClientMode');
      if (existingClientMode) {
        // הסרת כרטיס קודם אם קיים
        const oldInfo = document.getElementById('existingCaseInfo');
        if (oldInfo) {
          oldInfo.remove();
        }

        // הוספת הכרטיס אחרי ה-selector
        const selector = document.getElementById('caseDialogClientSelector');
        if (selector) {
          selector.insertAdjacentHTML('afterend', infoHTML);
        }
      }

      Logger.log('✅ Existing case info displayed');
    }

    /**
     * טיפול בשליחת טופס
     */
    async handleSubmit() {
      // הסתרת שגיאות קודמות
      document.getElementById('formErrors').style.display = 'none';
      document.getElementById('formWarnings').style.display = 'none';

      // 🛡️ Defensive Check: אם במצב existing אבל לא נבחר לקוח - שגיאה!
      if (this.currentMode === 'existing' && !this.currentCase) {
        window.CaseFormValidator.displayErrors(['חובה לבחור לקוח מהרשימה לפני הוספת שירות']);
        Logger.log('❌ Validation failed: No client selected in existing mode');
        return;
      }

      // 🎯 נקודת החלטה: הוספת שירות או יצירת תיק חדש?
      if (this.currentCase) {
        // ✅ מצב הוספת שירות לתיק קיים
        Logger.log('🔄 Mode: Adding service to existing case');
        await this.handleAddServiceToCase();
        return;
      }

      // ✅ מצב רגיל - יצירת תיק חדש
      Logger.log('🆕 Mode: Creating new case');

      // איסוף נתונים
      const formData = this.collectFormData();

      // ולידציה
      const validation = window.CaseFormValidator.validateCaseForm(formData);

      if (!validation.isValid) {
        window.CaseFormValidator.displayErrors(validation.errors);
        return;
      }

      if (validation.warnings.length > 0) {
        window.CaseFormValidator.displayWarnings(validation.warnings);
      }

      // המשך לשמירה...
      await this.saveCase(formData);
    }

    /**
     * איסוף נתוני טופס
     */
    collectFormData() {
      const formData = {
        isNewClient: this.currentMode === 'new',
        client: {},
        case: {},
        service: {}
      };

      // לקוח
      if (this.currentMode === 'new') {
        formData.client = {
          name: document.getElementById('newClientName')?.value?.trim()
        };
      } else {
        const selectedClient = this.clientSelector?.getSelectedValues();
        formData.client = {
          id: selectedClient?.clientId,
          name: selectedClient?.clientName
        };
      }

      // תיק
      formData.case = {
        caseNumber: document.getElementById('caseNumber')?.value,
        title: document.getElementById('caseTitle')?.value?.trim(),
        description: document.getElementById('caseDescription')?.value?.trim(),
        procedureType: document.getElementById('procedureType')?.value
      };

      // שירות
      if (this.procedureType === 'hours') {
        formData.service = {
          totalHours: parseFloat(document.getElementById('totalHours')?.value)
        };
      } else if (this.procedureType === 'legal_procedure') {
        formData.service = {
          pricingType: document.querySelector('input[name="pricingType"]:checked')?.value,
          stageA: this.collectStageData('A'),
          stageB: this.collectStageData('B'),
          stageC: this.collectStageData('C')
        };
      }

      return formData;
    }

    /**
     * איסוף נתוני שלב
     */
    collectStageData(stageKey) {
      const description = document.getElementById(`stage${stageKey}_description`)?.value?.trim();
      const isHourly = this.pricingType === 'hourly';

      return {
        description,
        hours: isHourly ? parseFloat(document.getElementById(`stage${stageKey}_hours`)?.value) : null,
        fixedPrice: !isHourly ? parseFloat(document.getElementById(`stage${stageKey}_fixedPrice`)?.value) : null
      };
    }

    /**
     * הוספת שירות לתיק קיים
     */
    async handleAddServiceToCase() {
      try {
        const procedureType = document.getElementById('procedureType').value;

        // בניית נתוני השירות
        const serviceData = {
          clientId: this.currentCase.id, // 🔥 במבנה החדש: Client = Case
          serviceType: procedureType,
          serviceName: document.getElementById('caseTitle').value.trim(),
          description: document.getElementById('caseDescription')?.value?.trim() || ''
        };

        if (!serviceData.serviceName) {
          if (window.NotificationSystem) {
            window.NotificationSystem.error('אנא הזן שם שירות');
          } else {
            alert('אנא הזן שם שירות');
          }
          return;
        }

        // שדות ספציפיים לסוג הליך
        if (procedureType === 'hours') {
          const totalHours = parseFloat(document.getElementById('totalHours').value);
          if (!totalHours || totalHours < 1) {
            if (window.NotificationSystem) {
              window.NotificationSystem.error('אנא הזן כמות שעות תקינה');
            } else {
              alert('אנא הזן כמות שעות תקינה');
            }
            return;
          }
          serviceData.hours = totalHours;

        } else if (procedureType === 'legal_procedure') {
          const pricingType = document.querySelector('input[name="pricingType"]:checked')?.value || 'hourly';
          serviceData.pricingType = pricingType;

          // איסוף נתוני שלבים
          const stages = [
            { ...this.collectStageData('A'), id: 'stage_a' },
            { ...this.collectStageData('B'), id: 'stage_b' },
            { ...this.collectStageData('C'), id: 'stage_c' }
          ];

          // ולידציה בסיסית
          for (let i = 0; i < stages.length; i++) {
            const stage = stages[i];
            if (!stage.description || stage.description.trim().length < 2) {
              if (window.NotificationSystem) {
                window.NotificationSystem.error(`שלב ${['א', 'ב', 'ג'][i]}: חובה להזין תיאור`);
              } else {
                alert(`שלב ${['א', 'ב', 'ג'][i]}: חובה להזין תיאור`);
              }
              return;
            }

            if (pricingType === 'hourly' && (!stage.hours || stage.hours <= 0)) {
              if (window.NotificationSystem) {
                window.NotificationSystem.error(`שלב ${['א', 'ב', 'ג'][i]}: חובה להזין כמות שעות תקינה`);
              } else {
                alert(`שלב ${['א', 'ב', 'ג'][i]}: חובה להזין כמות שעות תקינה`);
              }
              return;
            }

            if (pricingType === 'fixed' && (!stage.fixedPrice || stage.fixedPrice <= 0)) {
              if (window.NotificationSystem) {
                window.NotificationSystem.error(`שלב ${['א', 'ב', 'ג'][i]}: חובה להזין מחיר תקין`);
              } else {
                alert(`שלב ${['א', 'ב', 'ג'][i]}: חובה להזין מחיר תקין`);
              }
              return;
            }
          }

          serviceData.stages = stages;
        }

        Logger.log('📝 Adding service to case:', serviceData);

        // הצגת loading
        if (window.NotificationSystem) {
          window.NotificationSystem.showLoading('מוסיף שירות...');
        }

        // 🚀 קריאה ל-Firebase Cloud Function
        const addService = firebase.functions().httpsCallable('addServiceToClient');
        const result = await addService(serviceData);

        // הסתרת loading
        if (window.NotificationSystem) {
          window.NotificationSystem.hideLoading();
        }

        if (!result.data.success) {
          throw new Error(result.data.message || 'שגיאה בהוספת שירות');
        }

        Logger.log('✅ Service added successfully:', result.data.serviceId);

        // המתנה קצרה
        await new Promise(resolve => setTimeout(resolve, 100));

        // הצגת הודעת הצלחה
        if (window.NotificationSystem) {
          window.NotificationSystem.success(`השירות "${serviceData.serviceName}" נוסף בהצלחה!`, 3000);
        } else {
          alert(`השירות "${serviceData.serviceName}" נוסף בהצלחה!`);
        }

        // 🔔 שידור אירוע global
        window.EventBus?.emit('serviceAdded', {
          caseId: serviceData.clientId,
          clientId: serviceData.clientId,
          serviceId: result.data.serviceId,
          serviceName: serviceData.serviceName
        });
        Logger.log('🔔 Event emitted: serviceAdded');

        // סגירת דיאלוג אוטומטית
        setTimeout(() => {
          this.close();
        }, 500);

        // ריסט המצב
        this.currentCase = null;

        // רענון נתונים (אם יש manager)
        if (window.manager && typeof window.manager.loadClients === 'function') {
          await window.manager.loadClients();
        }

      } catch (error) {
        console.error('❌ Error adding service:', error);

        if (window.NotificationSystem) {
          window.NotificationSystem.hideLoading();
        }

        // המתנה קצרה לפני הצגת שגיאה
        await new Promise(resolve => setTimeout(resolve, 100));

        if (window.NotificationSystem) {
          window.NotificationSystem.error('שגיאה בהוספת שירות: ' + error.message, 5000);
        } else {
          alert('שגיאה בהוספת שירות: ' + error.message);
        }
      }
    }

    /**
     * שמירת תיק
     */
    async saveCase(formData) {
      try {
        // הצגת loading
        if (window.NotificationSystem) {
          window.NotificationSystem.showLoading('שומר תיק...');
        }

        // קריאה ל-Firebase Function
        const createClient = firebase.functions().httpsCallable('createClient');
        const result = await createClient(this.buildFirebaseData(formData));

        // הסתרת loading
        if (window.NotificationSystem) {
          window.NotificationSystem.hideLoading();
        }

        if (result.data && result.data.success) {
          // הצלחה!
          if (window.NotificationSystem) {
            window.NotificationSystem.success('התיק נוצר בהצלחה!');
          }

          // ש broadcast אירוע
          window.EventBus?.emit('case:created', {
            caseId: result.data.clientId,
            caseNumber: result.data.caseNumber,
            clientName: formData.client.name
          });

          // סגירת דיאלוג
          this.close();

          // רענון נתונים (אם יש manager)
          if (window.manager && typeof window.manager.loadClients === 'function') {
            await window.manager.loadClients();
          }

        } else {
          throw new Error(result.data?.message || 'שגיאה לא ידועה');
        }

      } catch (error) {
        console.error('❌ Error saving case:', error);

        if (window.NotificationSystem) {
          window.NotificationSystem.hideLoading();
          window.NotificationSystem.error('שגיאה בשמירת תיק: ' + error.message);
        }
      }
    }

    /**
     * בניית אובייקט לשליחה ל-Firebase
     */
    buildFirebaseData(formData) {
      const data = {
        clientName: formData.client.name,
        phone: formData.client.phone || '',
        email: formData.client.email || '',
        caseNumber: formData.case.caseNumber,
        caseTitle: formData.case.title,
        description: formData.case.description || '',
        procedureType: formData.case.procedureType,
        // ✅ Idempotency key - unique per request
        idempotencyKey: `create_${formData.case.caseNumber}_${Date.now()}`
      };

      if (formData.case.procedureType === 'hours') {
        data.totalHours = formData.service.totalHours;
      } else if (formData.case.procedureType === 'legal_procedure') {
        data.pricingType = formData.service.pricingType;
        // ✅ שדות חדשים עבור המבנה החדש
        data.legalProcedureName = formData.case.title;  // שם ההליך המשפטי
        data.ratePerHour = 800;  // תעריף שעתי ברירת מחדל
        data.stages = [
          { id: 'stage_a', ...formData.service.stageA },
          { id: 'stage_b', ...formData.service.stageB },
          { id: 'stage_c', ...formData.service.stageC }
        ];
      }

      return data;
    }

    /**
     * סגירת הדיאלוג
     */
    close() {
      const dialog = document.getElementById('modernCaseDialog');
      if (dialog) {
        dialog.remove();
      }

      // ניקוי selector
      if (this.clientSelector) {
        this.clientSelector.clear();
        this.clientSelector = null;
      }

      Logger.log('✅ Case creation dialog closed');
    }
  }

  // ✅ Export
  window.CaseCreationDialog = CaseCreationDialog;

  Logger.log('✅ CaseCreationDialog module loaded');

})();
