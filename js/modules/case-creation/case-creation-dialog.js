/**
 * Case Creation Dialog - Modern
 * דיאלוג מודרני ליצירת תיק חדש
 *
 * @module case-creation-dialog
 * @version 3.0.0
 */

(function() {
  'use strict';

  class CaseCreationDialog {
    constructor() {
      this.currentMode = 'new'; // 'new' או 'existing'
      this.clientSelector = null;
      this.procedureType = 'hours';
      this.pricingType = 'hourly';
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
        <div id="modernCaseDialog" style="
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
            max-width: 700px;
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
              <button id="modernCaseDialog_close" style="
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
              ">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- Content -->
            <div style="padding: 32px; overflow-y: auto; max-height: calc(90vh - 80px);">
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

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                      <div>
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">
                          <i class="fas fa-phone" style="color: #10b981; margin-left: 6px;"></i>
                          טלפון
                        </label>
                        <input
                          type="text"
                          id="newClientPhone"
                          placeholder="050-1234567"
                          style="
                            width: 100%;
                            padding: 12px 16px;
                            border: 2px solid #e5e7eb;
                            border-radius: 8px;
                            font-size: 15px;
                            transition: all 0.2s;
                          "
                          onfocus="this.style.borderColor='#10b981'; this.style.boxShadow='0 0 0 3px rgba(16,185,129,0.1)'"
                          onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'"
                        >
                      </div>

                      <div>
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151; font-size: 14px;">
                          <i class="fas fa-envelope" style="color: #8b5cf6; margin-left: 6px;"></i>
                          אימייל
                        </label>
                        <input
                          type="email"
                          id="newClientEmail"
                          placeholder="email@example.com"
                          style="
                            width: 100%;
                            padding: 12px 16px;
                            border: 2px solid #e5e7eb;
                            border-radius: 8px;
                            font-size: 15px;
                            transition: all 0.2s;
                          "
                          onfocus="this.style.borderColor='#8b5cf6'; this.style.boxShadow='0 0 0 3px rgba(139,92,246,0.1)'"
                          onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none'"
                        >
                      </div>
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
                <div style="
                  display: flex;
                  gap: 12px;
                  justify-content: flex-end;
                  margin-top: 32px;
                  padding-top: 24px;
                  border-top: 1px solid #e5e7eb;
                ">
                  <button type="button" id="modernCaseDialog_cancel" style="
                    padding: 12px 24px;
                    border: 2px solid #e5e7eb;
                    background: white;
                    color: #6b7280;
                    border-radius: 8px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                  ">
                    ביטול
                  </button>
                  <button type="submit" style="
                    padding: 12px 24px;
                    border: none;
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border-radius: 8px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                  ">
                    <i class="fas fa-save" style="margin-left: 8px;"></i>
                    שמור תיק
                  </button>
                </div>

              </form>
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
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', dialogHTML);

      // טעינת מספר תיק אוטומטי
      this.loadCaseNumber();

      // רינדור סקשן שירות (ברירת מחדל: שעות)
      this.renderServiceSection();
    }

    /**
     * טעינת מספר תיק אוטומטי
     */
    loadCaseNumber() {
      const input = document.getElementById('caseNumber');
      if (!input) return;

      const nextNumber = window.CaseNumberGenerator.getNextCaseNumber();
      input.value = nextNumber;
      input.style.color = '#3b82f6';
      input.style.fontWeight = '600';
    }

    /**
     * רינדור סקשן שירות לפי סוג הליך
     */
    renderServiceSection() {
      const container = document.getElementById('serviceSection');
      if (!container) return;

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

        // צור selector אם לא קיים
        if (!this.clientSelector) {
          this.initClientSelector();
        }
      }
    }

    /**
     * אתחול ClientCaseSelector
     */
    initClientSelector() {
      this.clientSelector = new ClientCaseSelector('caseDialogClientSelector', {
        required: false, // לא חובה כי זה רק בחירת לקוח קיים
        hideServiceCards: true, // לא צריך שירותים כאן
        hideCaseDropdown: true // לא צריך תיקים כאן
      });
    }

    /**
     * טיפול בשליחת טופס
     */
    async handleSubmit() {
      // הסתרת שגיאות קודמות
      document.getElementById('formErrors').style.display = 'none';
      document.getElementById('formWarnings').style.display = 'none';

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
          name: document.getElementById('newClientName')?.value?.trim(),
          phone: document.getElementById('newClientPhone')?.value?.trim(),
          email: document.getElementById('newClientEmail')?.value?.trim()
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
        procedureType: formData.case.procedureType
      };

      if (formData.case.procedureType === 'hours') {
        data.totalHours = formData.service.totalHours;
      } else if (formData.case.procedureType === 'legal_procedure') {
        data.pricingType = formData.service.pricingType;
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
