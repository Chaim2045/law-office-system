/**
 * ════════════════════════════════════════════════════════════════════
 * Case Creation Dialog - Modern
 * דיאלוג ליצירת תיק חדש או הוספת שירות ללקוח קיים
 * ════════════════════════════════════════════════════════════════════
 *
 * @module case-creation-dialog
 * @version 5.3.0
 * @updated 2025-01-19
 *
 * ════════════════════════════════════════════════════════════════════
 * 📝 CHANGELOG
 * ════════════════════════════════════════════════════════════════════
 *
 * v5.3.0 - 19/01/2025 🐛 BUG FIX - Toast errors behind overlay
 * ----------------------------------------
 * 🐛 FIX: Toast notifications מוצגים מאחורי overlay ולא נראים
 *   - הסרת כל ה-toast errors מ-handleAddServiceToCase
 *   - החלפה ב-inline validation errors עם displayErrors()
 *   - הוספת פוקוס אוטומטי על השדה הראשון עם שגיאה
 *   - הדגשה ויזואלית של שדות עם שגיאות (border אדום)
 *
 * ✨ NEW: 3 פונקציות עזר חדשות (lines 1713-1816)
 *   - validateServiceData() - validation מקיף עם field IDs
 *   - focusOnFirstError() - פוקוס + scroll לשדה הבעייתי
 *   - clearErrorHighlights() - ניקוי הדגשות מכל השדות
 *
 * 🎯 השפעה:
 *   - ✅ משתמש רואה את השגיאות בתוך הדיאלוג
 *   - ✅ פוקוס אוטומטי על השדה שחסר מידע
 *   - ✅ הדגשה ויזואלית ברורה של השדות הבעייתיים
 *   - ✅ UX משופר משמעותית
 *
 * 📊 טיפול בתרחיש המדווח:
 *   - משתמש הוסיף שירות תוכנית שעות ללקוח עם הליך משפטי
 *   - לא מילא תיאור → לא ראה את ה-toast
 *   - עכשיו: רואה שגיאה "חסר תיאור" + הדגשה אדומה + פוקוס
 *
 * v5.2.0 - 19/01/2025 🐛 BUG FIX + ✨ FEATURE
 * ----------------------------------------
 * 🐛 FIX: תיקון שגיאת HTML5 validation - "invalid form control is not focusable"
 *   - הסרת `required` attributes מ-4 שדות (lines 408, 435, 487, 513)
 *   - הסיבה: Stepper מסתיר שדות עם display:none, ודפדפן לא יכול לפקוס עליהם
 *   - הפתרון: שימוש ב-custom validation ב-validateCurrentStep() בלבד
 *
 * ✨ FEATURE: Lottie animations למשוב ויזואלי בvalidation
 *   - הוספת container למשוב Lottie (line 332)
 *   - שדרוג nextStep() עם 3 אנימציות:
 *     • "processing" - בזמן בדיקת validation
 *     • "error" - כשיש שגיאות
 *     • "successSimple" - כשהvalidation עבר בהצלחה
 *   - הוספת delay() utility function (line 718)
 *
 * 📊 השפעה:
 *   - ✅ תיקון bug קריטי שמנע שליחת טפסים
 *   - ✅ חווית משתמש משופרת עם משוב ויזואלי
 *   - ✅ עמידות בעומס - Lottie נטען מcache אחרי פעם ראשונה
 *
 * 🗓️ תאריך: 2025-01-19
 * 📦 גרסה: 5.0.0 → 5.1.0
 *
 * ✅ שימוש ב-Shared Service Card Renderer
 * ──────────────────────────────────────────────────────────────
 * - החלפת קוד כפול ב-window.renderServiceCard()
 * - עיצוב אחיד עם ClientCaseSelector
 * - תצוגת שירותים בגריד רספונסיבי
 * - מניעת code duplication
 *
 * 🗓️ תאריך: 2025-01-18
 * 📦 גרסה: 4.0.0 → 5.0.0
 *
 * ✅ שינויים מרכזיים:
 *
 * 1️⃣ מבנה Stepper/Wizard חדש
 * ──────────────────────────────────────────────────────────────
 * - ממשק רב-שלבי (Multi-step wizard)
 * - זרימת "לקוח חדש": 3 שלבים
 *   • שלב 1: פרטי לקוח
 *   • שלב 2: פרטי תיק
 *   • שלב 3: הגדרת שירות
 * - זרימת "לקוח קיים": 2 שלבים
 *   • שלב 1: בחירת לקוח
 *   • שלב 2: הגדרת שירות
 *
 * 2️⃣ מחוון התקדמות
 * ──────────────────────────────────────────────────────────────
 * - נקודות עם מספרים
 * - שלב נוכחי מודגש
 * - שלבים שהושלמו עם V
 *
 * 3️⃣ ניווט חכם
 * ──────────────────────────────────────────────────────────────
 * - כפתורי הבא/חזור
 * - ולידציה לפני מעבר לשלב הבא
 * - כפתור "שמור" רק בשלב אחרון
 *
 * 4️⃣ ביטול גלילה
 * ──────────────────────────────────────────────────────────────
 * - רק שלב אחד מוצג בכל רגע
 * - UI נקי ומאורגן
 *
 * יתרונות:
 *   ✓ פחות גלילה
 *   ✓ זרימה ברורה יותר
 *   ✓ מיקוד טוב יותר על כל שלב
 *   ✓ חוויית משתמש משופרת
 *
 * ════════════════════════════════════════════════════════════════════
 * 📝 PREVIOUS CHANGELOG - Complete UI Redesign (Minimalist & Clean)
 * ════════════════════════════════════════════════════════════════════
 *
 * 🗓️ תאריך: 2025-01-18
 * 📦 גרסה: 3.5.0 → 4.0.0
 *
 * ✅ שינויים מרכזיים:
 *
 * 1️⃣ כותרת דינמית לפי מצב
 * ──────────────────────────────────────────────────────────────
 * - מצב "לקוח חדש": "יצירת תיק חדש"
 * - מצב "לקוח קיים": "הוספת שירות לתיק קיים"
 * - הסתרת סקשן "פרטי התיק" במצב "לקוח קיים"
 *
 * 2️⃣ טאבים מודרניים - Underline Style
 * ──────────────────────────────────────────────────────────────
 * לפני:
 *   - רקע אפור #f3f4f6 עם padding
 *   - טאב פעיל: רקע לבן + shadow
 *   - אייקונים מיותרים
 *
 * אחרי:
 *   - underline פשוט בלבד
 *   - טאב פעיל: border-bottom כחול
 *   - ללא רקעים וצללים
 *
 * 3️⃣ צבע אחיד ומינימליסטי
 * ──────────────────────────────────────────────────────────────
 * - צבע יחיד: כחול #3b82f6
 * - הסרת כל האייקונים הצבעוניים מה-labels
 * - focus effects אחיד לכל השדות
 *
 * 4️⃣ Borders ו-Spacing עדינים
 * ──────────────────────────────────────────────────────────────
 * - border: 1px (במקום 2px)
 * - padding: 10px 12px (במקום 12px 16px)
 * - border-radius: 6px (במקום 8px)
 * - dividers: קו פשוט (ללא גרדיאנט)
 *
 * 5️⃣ Typography נקי
 * ──────────────────────────────────────────────────────────────
 * - כותרות: 16px font-weight 600 (במקום 18px)
 * - labels: font-weight 500 (במקום 600)
 * - font-size: 14px (במקום 15px)
 *
 * יתרונות:
 *   ✓ זרימה ברורה יותר למשתמש
 *   ✓ עיצוב מודרני ונקי
 *   ✓ ללא "רעש ויזואלי"
 *   ✓ קריאות מעולה
 *   ✓ נגישות טובה יותר
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

      // ✅ Stepper properties
      this.currentStep = 1;
      this.totalSteps = 3; // 3 for new client, 2 for existing client
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
     * בניית ה-HTML של הדיאלוג - Stepper Version
     */
    renderDialog() {
      const dialogHTML = `
        <div id="modernCaseDialog" class="case-dialog-overlay">
          <div class="case-dialog-container">
            <!-- Header -->
            <div class="case-dialog-header">
              <div class="case-dialog-header-content">
                <i class="fas fa-folder-plus"></i>
                <h2 id="dialogTitle">יצירת תיק חדש</h2>
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

                <!-- Mode Selection (Tabs) -->
                <div style="margin-bottom: 24px;">
                  <div style="
                    display: flex;
                    gap: 8px;
                    padding: 4px;
                    background: #f3f4f6;
                    border-radius: 8px;
                  ">
                    <button type="button" id="newClientModeBtn" class="mode-tab active" style="
                      flex: 1;
                      padding: 10px 20px;
                      background: white;
                      border: 1px solid #3b82f6;
                      border-radius: 6px;
                      cursor: pointer;
                      font-weight: 600;
                      font-size: 14px;
                      color: #3b82f6;
                      transition: all 0.2s;
                      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                    ">
                      לקוח חדש
                    </button>
                    <button type="button" id="existingClientModeBtn" class="mode-tab" style="
                      flex: 1;
                      padding: 10px 20px;
                      background: transparent;
                      border: 1px solid transparent;
                      border-radius: 6px;
                      cursor: pointer;
                      font-weight: 500;
                      font-size: 14px;
                      color: #6b7280;
                      transition: all 0.2s;
                    ">
                      לקוח קיים
                    </button>
                  </div>
                </div>

                <!-- Lottie Validation Feedback -->
                <div id="validationFeedback" style="
                  width: 80px;
                  height: 80px;
                  margin: 0 auto 16px auto;
                  display: none;
                "></div>

                <!-- Stepper Indicator -->
                <div id="stepperIndicator" style="margin-bottom: 32px;">
                  ${this.renderStepIndicator()}
                </div>

                <!-- Step 1: Client Details (New Client Mode) -->
                <div id="step1_newClient" class="wizard-step" style="display: block;">
                  <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; color: #1f2937;">
                    פרטי לקוח
                  </h3>
                  <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">
                      שם הלקוח <span style="color: #ef4444;">*</span>
                    </label>
                    <input
                      type="text"
                      id="newClientName"
                      placeholder="שם מלא"
                      style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                        transition: all 0.2s;
                      "
                      onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'"
                      onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none'"
                    >
                  </div>
                </div>

                <!-- Step 1: Select Client (Existing Client Mode) -->
                <div id="step1_existingClient" class="wizard-step" style="display: none;">
                  <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; color: #1f2937;">
                    בחירת לקוח
                  </h3>
                  <div id="caseDialogClientSelector"></div>
                </div>

                <!-- Step 2: Case Details (New Client Mode only) -->
                <div id="step2_newClient" class="wizard-step" style="display: none;">
                  <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; color: #1f2937;">
                    פרטי התיק
                  </h3>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <!-- מספר תיק -->
                    <div>
                      <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">
                        מספר תיק <span style="color: #ef4444;">*</span>
                      </label>
                      <input
                        type="text"
                        id="caseNumber"
                        readonly
                        placeholder="יתווסף אוטומטית..."
                        style="
                          width: 100%;
                          padding: 10px 12px;
                          border: 1px solid #d1d5db;
                          border-radius: 6px;
                          font-size: 14px;
                          background: #f9fafb;
                          color: #6b7280;
                          cursor: not-allowed;
                        "
                      >
                    </div>

                    <!-- סוג הליך -->
                    <div>
                      <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">
                        סוג הליך <span style="color: #ef4444;">*</span>
                      </label>
                      <select
                        id="procedureType"
                        style="
                          width: 100%;
                          padding: 10px 12px;
                          border: 1px solid #d1d5db;
                          border-radius: 6px;
                          font-size: 14px;
                          background: white;
                          cursor: pointer;
                          transition: all 0.2s;
                        "
                        onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'"
                        onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none'"
                      >
                        <option value="hours">שעות (ללא שלבים)</option>
                        <option value="legal_procedure">הליך משפטי מבוסס שלבים</option>
                      </select>
                    </div>
                  </div>

                  <!-- כותרת תיק -->
                  <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">
                      כותרת התיק <span style="color: #ef4444;">*</span>
                    </label>
                    <input
                      type="text"
                      id="caseTitle"
                      placeholder="לדוגמה: תביעה עירונית - עיריית ת״א"
                      style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                        transition: all 0.2s;
                      "
                      onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'"
                      onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none'"
                    >
                  </div>

                  <!-- תיאור -->
                  <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">
                      תיאור נוסף
                    </label>
                    <textarea
                      id="caseDescription"
                      rows="3"
                      placeholder="תיאור קצר של התיק..."
                      style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                        resize: vertical;
                        transition: all 0.2s;
                      "
                      onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'"
                      onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none'"
                    ></textarea>
                  </div>
                </div>

                <!-- Step 3: Service Configuration (New Client Mode) -->
                <!-- Step 2: Service Configuration (Existing Client Mode) -->
                <div id="step3_service" class="wizard-step" style="display: none;">
                  <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; color: #1f2937;">
                    הגדרת שירות
                  </h3>

                  <!-- Service Type Selector for Existing Client Mode -->
                  <div id="serviceTypeSelector_existing" style="display: none; margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">
                      סוג שירות <span style="color: #ef4444;">*</span>
                    </label>
                    <select
                      id="procedureType_existing"
                      style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                        background: white;
                        cursor: pointer;
                        transition: all 0.2s;
                      "
                      onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'"
                      onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none'"
                    >
                      <option value="hours">שעות (ללא שלבים)</option>
                      <option value="legal_procedure">הליך משפטי מבוסס שלבים</option>
                    </select>
                  </div>

                  <!-- Service Title for Existing Client Mode -->
                  <div id="serviceTitleField_existing" style="display: none; margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151; font-size: 14px;">
                      שם השירות <span style="color: #ef4444;">*</span>
                    </label>
                    <input
                      type="text"
                      id="serviceTitle_existing"
                      placeholder="לדוגמה: ייעוץ משפטי - נדל״ן"
                      style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid #d1d5db;
                        border-radius: 6px;
                        font-size: 14px;
                        transition: all 0.2s;
                      "
                      onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)'"
                      onblur="this.style.borderColor='#d1d5db'; this.style.boxShadow='none'"
                    >
                  </div>

                  <div id="serviceSection">
                    <!-- יוצג דינמית לפי סוג הליך -->
                  </div>
                </div>

                <!-- Navigation Buttons -->
                <div class="case-dialog-actions" style="display: flex; justify-content: space-between; align-items: center;">
                  <button type="button" id="prevStepBtn" class="btn btn-secondary" style="display: none;">
                    <i class="fas fa-arrow-right" style="margin-left: 6px;"></i>
                    חזור
                  </button>
                  <div style="flex: 1;"></div>
                  <button type="button" id="modernCaseDialog_cancel" class="btn btn-secondary" style="margin-left: 8px;">
                    ביטול
                  </button>
                  <button type="button" id="nextStepBtn" class="btn btn-primary">
                    הבא
                    <i class="fas fa-arrow-left" style="margin-right: 6px;"></i>
                  </button>
                  <button type="submit" id="submitBtn" class="btn btn-primary" style="display: none;">
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
    }

    /**
     * רינדור מחוון התקדמות (Stepper Indicator)
     */
    renderStepIndicator() {
      const steps = [];
      const totalSteps = this.totalSteps;

      for (let i = 1; i <= totalSteps; i++) {
        const isCompleted = i < this.currentStep;
        const isCurrent = i === this.currentStep;
        const isPending = i > this.currentStep;

        let stepLabel = '';
        if (this.currentMode === 'new') {
          stepLabel = i === 1 ? 'לקוח' : i === 2 ? 'תיק' : 'שירות';
        } else {
          stepLabel = i === 1 ? 'בחירה' : 'שירות';
        }

        steps.push(`
          <div style="display: flex; flex-direction: column; align-items: center; flex: 1; position: relative;">
            ${i < totalSteps ? `
              <div style="
                position: absolute;
                top: 16px;
                right: 50%;
                width: 100%;
                height: 2px;
                background: ${isCompleted ? '#3b82f6' : '#e5e7eb'};
                z-index: 0;
              "></div>
            ` : ''}
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background: ${isCurrent ? '#3b82f6' : isCompleted ? '#3b82f6' : '#e5e7eb'};
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 600;
              font-size: 14px;
              margin-bottom: 8px;
              z-index: 1;
              position: relative;
              transition: all 0.3s;
              ${isCurrent ? 'box-shadow: 0 0 0 4px rgba(59,130,246,0.2);' : ''}
            ">
              ${isCompleted ? '<i class="fas fa-check"></i>' : i}
            </div>
            <div style="
              font-size: 12px;
              color: ${isCurrent ? '#3b82f6' : isCompleted ? '#059669' : '#9ca3af'};
              font-weight: ${isCurrent ? '600' : '500'};
              text-align: center;
            ">
              ${stepLabel}
            </div>
          </div>
        `);
      }

      return `
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; max-width: 400px; margin: 0 auto;">
          ${steps.join('')}
        </div>
      `;
    }

    /**
     * עדכון מחוון התקדמות
     */
    updateStepIndicator() {
      const indicator = document.getElementById('stepperIndicator');
      if (indicator) {
        indicator.innerHTML = this.renderStepIndicator();
      }
    }

    /**
     * מעבר לשלב הבא (עם ולידציה + Lottie feedback)
     */
    async nextStep() {
      const feedbackContainer = document.getElementById('validationFeedback');

      // הצג Lottie "בודק..."
      if (feedbackContainer && window.LottieManager) {
        feedbackContainer.style.display = 'block';
        await window.LottieManager.load('processing', feedbackContainer, {
          loop: true,
          autoplay: true
        });
      }

      // ולידציה של השלב הנוכחי
      const validation = await this.validateCurrentStep();

      if (!validation.isValid) {
        // שגיאה - הצג Lottie error
        if (feedbackContainer && window.LottieManager) {
          await window.LottieManager.load('error', feedbackContainer, {
            loop: false,
            autoplay: true
          });

          // המתן לסיום אנימציה
          await this.delay(800);
          feedbackContainer.style.display = 'none';
        }

        window.CaseFormValidator?.displayErrors(validation.errors);
        return;
      }

      // הצלחה - הצג Lottie success
      if (feedbackContainer && window.LottieManager) {
        await window.LottieManager.load('successSimple', feedbackContainer, {
          loop: false,
          autoplay: true
        });

        // המתן לסיום אנימציה
        await this.delay(500);
        feedbackContainer.style.display = 'none';
      }

      // הסתרת שגיאות
      document.getElementById('formErrors').style.display = 'none';

      // מעבר לשלב הבא
      if (this.currentStep < this.totalSteps) {
        this.currentStep++;
        this.updateStepVisibility();
        this.updateStepIndicator();
        this.updateNavigationButtons();

        Logger.log(`✅ Moved to step ${this.currentStep}/${this.totalSteps}`);
      }
    }

    /**
     * Delay utility function
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise}
     */
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * חזרה לשלב הקודם
     */
    prevStep() {
      if (this.currentStep > 1) {
        this.currentStep--;
        this.updateStepVisibility();
        this.updateStepIndicator();
        this.updateNavigationButtons();

        // הסתרת שגיאות
        document.getElementById('formErrors').style.display = 'none';

        Logger.log(`✅ Moved back to step ${this.currentStep}/${this.totalSteps}`);
      }
    }

    /**
     * עדכון תצוגת שלבים (הצגה/הסתרה)
     */
    updateStepVisibility() {
      // הסתרת כל השלבים
      document.querySelectorAll('.wizard-step').forEach(step => {
        step.style.display = 'none';
      });

      // הסתרת שדות ספציפיים לכל מצב
      const serviceTypeSelector = document.getElementById('serviceTypeSelector_existing');
      const serviceTitleField = document.getElementById('serviceTitleField_existing');

      // הצגת השלב הנוכחי לפי מצב
      if (this.currentMode === 'new') {
        // New Client: 3 steps
        if (this.currentStep === 1) {
          document.getElementById('step1_newClient').style.display = 'block';
        } else if (this.currentStep === 2) {
          document.getElementById('step2_newClient').style.display = 'block';
        } else if (this.currentStep === 3) {
          document.getElementById('step3_service').style.display = 'block';
          // הסתרת שדות של existing client
          if (serviceTypeSelector) {
serviceTypeSelector.style.display = 'none';
}
          if (serviceTitleField) {
serviceTitleField.style.display = 'none';
}
        }
      } else {
        // Existing Client: 2 steps
        if (this.currentStep === 1) {
          document.getElementById('step1_existingClient').style.display = 'block';
        } else if (this.currentStep === 2) {
          document.getElementById('step3_service').style.display = 'block';
          // הצגת שדות של existing client
          if (serviceTypeSelector) {
serviceTypeSelector.style.display = 'block';
}
          if (serviceTitleField) {
serviceTitleField.style.display = 'block';
}
        }
      }
    }

    /**
     * עדכון כפתורי ניווט
     */
    updateNavigationButtons() {
      const prevBtn = document.getElementById('prevStepBtn');
      const nextBtn = document.getElementById('nextStepBtn');
      const submitBtn = document.getElementById('submitBtn');

      // כפתור "חזור" - מוצג רק אם לא בשלב ראשון
      if (prevBtn) {
        prevBtn.style.display = this.currentStep > 1 ? 'block' : 'none';
      }

      // כפתור "הבא" vs "שמור"
      const isLastStep = this.currentStep === this.totalSteps;
      if (nextBtn) {
        nextBtn.style.display = isLastStep ? 'none' : 'inline-block';
      }
      if (submitBtn) {
        submitBtn.style.display = isLastStep ? 'inline-block' : 'none';
      }
    }

    /**
     * ולידציה של השלב הנוכחי
     */
    async validateCurrentStep() {
      const errors = [];

      if (this.currentMode === 'new') {
        // New Client Mode
        if (this.currentStep === 1) {
          // Step 1: Client Details
          const clientName = document.getElementById('newClientName')?.value?.trim();
          if (!clientName || clientName.length < 2) {
            errors.push('אנא הזן שם לקוח תקין (לפחות 2 תווים)');
          } else {
            // טען מספר תיק אוטומטית לפני מעבר לשלב הבא
            await this.loadCaseNumber();
          }
        } else if (this.currentStep === 2) {
          // Step 2: Case Details
          const caseNumber = document.getElementById('caseNumber')?.value?.trim();
          const caseTitle = document.getElementById('caseTitle')?.value?.trim();

          if (!caseNumber) {
            errors.push('מספר תיק חסר - אנא נסה שוב');
          }
          if (!caseTitle || caseTitle.length < 2) {
            errors.push('אנא הזן כותרת תיק (לפחות 2 תווים)');
          }

          // עדכן את סוג ההליך
          this.procedureType = document.getElementById('procedureType')?.value || 'hours';
          this.renderServiceSection(); // רינדור שירות לפי הבחירה
        } else if (this.currentStep === 3) {
          // Step 3: Service - validate based on procedure type
          if (this.procedureType === 'hours') {
            const hours = parseFloat(document.getElementById('totalHours')?.value);
            if (!hours || hours < 0.5) {
              errors.push('אנא הזן כמות שעות תקינה (לפחות 0.5)');
            }
          } else if (this.procedureType === 'legal_procedure') {
            // Validate stages - basic check
            const stageA_desc = document.getElementById('stageA_description')?.value?.trim();
            const stageB_desc = document.getElementById('stageB_description')?.value?.trim();
            const stageC_desc = document.getElementById('stageC_description')?.value?.trim();

            if (!stageA_desc || !stageB_desc || !stageC_desc) {
              errors.push('חובה למלא תיאור עבור כל 3 השלבים');
            }

            // Check hours/price based on pricing type
            const pricingType = document.querySelector('input[name="pricingType"]:checked')?.value || 'hourly';
            if (pricingType === 'hourly') {
              const stageA_hours = parseFloat(document.getElementById('stageA_hours')?.value);
              const stageB_hours = parseFloat(document.getElementById('stageB_hours')?.value);
              const stageC_hours = parseFloat(document.getElementById('stageC_hours')?.value);

              if (!stageA_hours || !stageB_hours || !stageC_hours) {
                errors.push('חובה למלא שעות עבור כל 3 השלבים');
              }
            } else {
              const stageA_price = parseFloat(document.getElementById('stageA_fixedPrice')?.value);
              const stageB_price = parseFloat(document.getElementById('stageB_fixedPrice')?.value);
              const stageC_price = parseFloat(document.getElementById('stageC_fixedPrice')?.value);

              if (!stageA_price || !stageB_price || !stageC_price) {
                errors.push('חובה למלא מחיר עבור כל 3 השלבים');
              }
            }
          }
        }
      } else {
        // Existing Client Mode
        if (this.currentStep === 1) {
          // Step 1: Select Client
          if (!this.currentCase) {
            errors.push('אנא בחר לקוח מהרשימה');
          }
        } else if (this.currentStep === 2) {
          // Step 2: Service
          // עדכן procedureType מהשדה של existing
          const procedureTypeSelect = document.getElementById('procedureType_existing');
          if (procedureTypeSelect) {
            this.procedureType = procedureTypeSelect.value;
            this.renderServiceSection(); // רינדור שירות לפי הבחירה
          }

          const serviceTitle = document.getElementById('serviceTitle_existing')?.value?.trim();
          if (!serviceTitle || serviceTitle.length < 2) {
            errors.push('אנא הזן שם שירות (לפחות 2 תווים)');
          }

          // Validate based on procedure type
          if (this.procedureType === 'hours') {
            const hours = parseFloat(document.getElementById('totalHours')?.value);
            if (!hours || hours < 0.5) {
              errors.push('אנא הזן כמות שעות תקינה (לפחות 0.5)');
            }
          } else if (this.procedureType === 'legal_procedure') {
            // Same validation as new client step 3
            const stageA_desc = document.getElementById('stageA_description')?.value?.trim();
            const stageB_desc = document.getElementById('stageB_description')?.value?.trim();
            const stageC_desc = document.getElementById('stageC_description')?.value?.trim();

            if (!stageA_desc || !stageB_desc || !stageC_desc) {
              errors.push('חובה למלא תיאור עבור כל 3 השלבים');
            }

            const pricingType = document.querySelector('input[name="pricingType"]:checked')?.value || 'hourly';
            if (pricingType === 'hourly') {
              const stageA_hours = parseFloat(document.getElementById('stageA_hours')?.value);
              const stageB_hours = parseFloat(document.getElementById('stageB_hours')?.value);
              const stageC_hours = parseFloat(document.getElementById('stageC_hours')?.value);

              if (!stageA_hours || !stageB_hours || !stageC_hours) {
                errors.push('חובה למלא שעות עבור כל 3 השלבים');
              }
            } else {
              const stageA_price = parseFloat(document.getElementById('stageA_fixedPrice')?.value);
              const stageB_price = parseFloat(document.getElementById('stageB_fixedPrice')?.value);
              const stageC_price = parseFloat(document.getElementById('stageC_fixedPrice')?.value);

              if (!stageA_price || !stageB_price || !stageC_price) {
                errors.push('חובה למלא מחיר עבור כל 3 השלבים');
              }
            }
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors: errors
      };
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

      // ✅ Stepper Navigation
      document.getElementById('nextStepBtn')?.addEventListener('click', () => this.nextStep());
      document.getElementById('prevStepBtn')?.addEventListener('click', () => this.prevStep());

      // שינוי סוג הליך - New Client Mode
      document.getElementById('procedureType')?.addEventListener('change', (e) => {
        this.procedureType = e.target.value;
        this.renderServiceSection();
      });

      // שינוי סוג הליך - Existing Client Mode
      document.getElementById('procedureType_existing')?.addEventListener('change', (e) => {
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

      // ✅ Reset stepper
      this.currentStep = 1;
      this.totalSteps = mode === 'new' ? 3 : 2;
      this.currentCase = null; // Reset current case

      const newBtn = document.getElementById('newClientModeBtn');
      const existingBtn = document.getElementById('existingClientModeBtn');
      const dialogTitle = document.getElementById('dialogTitle');

      if (mode === 'new') {
        // עדכון כותרת
        if (dialogTitle) {
dialogTitle.textContent = 'יצירת תיק חדש';
}

        // עדכון טאבים - button style
        newBtn.classList.add('active');
        existingBtn.classList.remove('active');
        newBtn.style.background = 'white';
        newBtn.style.border = '1px solid #3b82f6';
        newBtn.style.color = '#3b82f6';
        newBtn.style.fontWeight = '600';
        newBtn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
        existingBtn.style.background = 'transparent';
        existingBtn.style.border = '1px solid transparent';
        existingBtn.style.color = '#6b7280';
        existingBtn.style.fontWeight = '500';
        existingBtn.style.boxShadow = 'none';
      } else {
        // עדכון כותרת
        if (dialogTitle) {
dialogTitle.textContent = 'הוספת שירות לתיק קיים';
}

        // עדכון טאבים - button style
        existingBtn.classList.add('active');
        newBtn.classList.remove('active');
        existingBtn.style.background = 'white';
        existingBtn.style.border = '1px solid #3b82f6';
        existingBtn.style.color = '#3b82f6';
        existingBtn.style.fontWeight = '600';
        existingBtn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
        newBtn.style.background = 'transparent';
        newBtn.style.border = '1px solid transparent';
        newBtn.style.color = '#6b7280';
        newBtn.style.fontWeight = '500';
        newBtn.style.boxShadow = 'none';

        // צור selector אם לא קיים
        if (!this.clientSelector) {
          this.initClientSelector();
        }

        // ✅ האזנה לאירוע בחירת לקוח
        this.setupClientSelectorListener();
      }

      // ✅ Update stepper UI
      this.updateStepIndicator();
      this.updateStepVisibility();
      this.updateNavigationButtons();

      Logger.log(`✅ Switched to ${mode} mode, reset to step 1/${this.totalSteps}`);
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

              // הצגת כרטיס מידע על התיק והשירותים הקיימים
              this.showExistingCaseInfo(existingCase);

              Logger.log('✅ Existing case loaded for adding service');
            } else {
              // ✅ ריסט אם אין תיק קיים
              this.currentCase = null;

              // הסרת כרטיס מידע אם קיים
              const existingInfo = document.getElementById('existingCaseInfo');
              if (existingInfo) {
                existingInfo.remove();
              }

              Logger.log('⚠️ No existing case found for this client');
            }
          } catch (error) {
            console.error('❌ Error loading client case:', error);
            this.currentCase = null;
          }
        } else {
          // ❌ אם לא נבחר לקוח (ביטול בחירה)
          this.currentCase = null;

          // הסרת כרטיס מידע אם קיים
          const existingInfo = document.getElementById('existingCaseInfo');
          if (existingInfo) {
            existingInfo.remove();
          }
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

      // בניית רשימת שירותים - שימוש ב-Shared Service Card Renderer
      let servicesHTML = '';
      if (services.length > 0) {
        servicesHTML = `
          <div style="
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 12px;
          ">
            ${services.map((service) => {
              // הכנת נתוני השלב הפעיל להליכים משפטיים
              let serviceToRender = service;
              if (service.type === 'legal_procedure') {
                const currentStage = service.stages?.find(s => s.status === 'active');
                if (currentStage) {
                  // יצירת אובייקט שלב עם כל הנתונים הנדרשים
                  serviceToRender = {
                    ...currentStage,
                    id: currentStage.id,
                    name: currentStage.description || currentStage.name,
                    description: currentStage.description || currentStage.name,
                    totalHours: currentStage.hours || 0,
                    hoursRemaining: currentStage.hoursRemaining || 0
                  };
                }
              }

              return window.renderServiceCard(
                serviceToRender,
                service.type,
                service.pricingType || 'hourly',
                existingCase,
                {
                  readOnly: true,
                  showCaseNumber: false // לא נדרש במידע על תיק קיים
                }
              );
            }).join('')}
          </div>
        `;
      } else {
        servicesHTML = `
          <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 13px;">
            אין שירותים קיימים
          </div>
        `;
      }

      const infoHTML = `
        <div id="existingCaseInfo" style="
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin-top: 12px;
          margin-bottom: 16px;
        ">
          <!-- כותרת -->
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 14px;
            padding-bottom: 12px;
            border-bottom: 1px solid #f3f4f6;
          ">
            <i class="fas fa-folder-open" style="color: #3b82f6; font-size: 16px;"></i>
            <div>
              <div style="font-weight: 600; color: #1f2937; font-size: 14px;">
                תיק #${existingCase.caseNumber}
              </div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
                ${totalServices} ${totalServices === 1 ? 'שירות קיים' : 'שירותים קיימים'}
              </div>
            </div>
          </div>

          <!-- רשימת שירותים -->
          <div style="margin-bottom: 12px;">
            ${servicesHTML}
          </div>

          <!-- טקסט עדין -->
          <div style="
            font-size: 12px;
            color: #9ca3af;
            text-align: center;
            padding-top: 8px;
            border-top: 1px solid #f3f4f6;
          ">
            השירות החדש יתווסף לתיק זה
          </div>
        </div>
      `;

      // הצגת הכרטיס - נחפש את המיקום המתאים בתוך step1_existingClient
      const step1ExistingClient = document.getElementById('step1_existingClient');
      if (step1ExistingClient) {
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
     * ✨ NEW: Validate service data for adding service to existing case
     * @param {Object} serviceData - Service data to validate
     * @param {string} procedureType - Procedure type (hours/legal_procedure)
     * @returns {Object} { isValid, errors, fieldIds }
     */
    validateServiceData(serviceData, procedureType) {
      const errors = [];
      const fieldIds = []; // IDs of fields with errors for focusing

      // Validate service name
      if (!serviceData.serviceName || serviceData.serviceName.trim().length === 0) {
        errors.push('אנא הזן שם שירות');
        fieldIds.push('serviceTitle_existing');
      }

      // Validate hours service
      if (procedureType === 'hours') {
        const totalHours = serviceData.hours;
        if (!totalHours || totalHours < 0.5) {
          errors.push('אנא הזן כמות שעות תקינה (לפחות 0.5)');
          fieldIds.push('totalHours');
        }
      }

      // Validate legal procedure
      if (procedureType === 'legal_procedure' && serviceData.stages) {
        const stageNames = ['א', 'ב', 'ג'];
        const stageKeys = ['A', 'B', 'C'];

        serviceData.stages.forEach((stage, i) => {
          // Validate description
          if (!stage.description || stage.description.trim().length < 2) {
            errors.push(`שלב ${stageNames[i]}: חובה להזין תיאור (לפחות 2 תווים)`);
            fieldIds.push(`stage${stageKeys[i]}_description`);
          }

          // Validate hours for hourly pricing
          if (serviceData.pricingType === 'hourly') {
            if (!stage.hours || stage.hours <= 0) {
              errors.push(`שלב ${stageNames[i]}: חובה להזין כמות שעות תקינה`);
              fieldIds.push(`stage${stageKeys[i]}_hours`);
            }
          }

          // Validate price for fixed pricing
          if (serviceData.pricingType === 'fixed') {
            if (!stage.fixedPrice || stage.fixedPrice <= 0) {
              errors.push(`שלב ${stageNames[i]}: חובה להזין מחיר תקין`);
              fieldIds.push(`stage${stageKeys[i]}_fixedPrice`);
            }
          }
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        fieldIds
      };
    }

    /**
     * ✨ NEW: Focus on first error field and highlight it
     * @param {Array<string>} fieldIds - Array of field IDs with errors
     */
    focusOnFirstError(fieldIds) {
      if (!fieldIds || fieldIds.length === 0) {
        return;
      }

      // Clear previous highlights
      this.clearErrorHighlights();

      // Highlight all error fields
      fieldIds.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
          field.style.borderColor = '#ef4444';
          field.style.borderWidth = '2px';
          field.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
        }
      });

      // Focus on first field
      const firstField = document.getElementById(fieldIds[0]);
      if (firstField) {
        firstField.focus();
        firstField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    /**
     * ✨ NEW: Clear error highlights from all fields
     */
    clearErrorHighlights() {
      // Get all input and select fields in the dialog
      const fields = document.querySelectorAll('#modernCaseDialog input, #modernCaseDialog select, #modernCaseDialog textarea');
      fields.forEach(field => {
        field.style.borderColor = '';
        field.style.borderWidth = '';
        field.style.boxShadow = '';
      });
    }

    /**
     * הוספת שירות לתיק קיים
     */
    async handleAddServiceToCase() {
      try {
        // Clear previous errors
        document.getElementById('formErrors').style.display = 'none';
        this.clearErrorHighlights();

        // Get procedure type from the correct field (existing client mode)
        const procedureType = document.getElementById('procedureType_existing')?.value || this.procedureType;

        // Get service name from the correct field (existing client mode)
        const serviceName = document.getElementById('serviceTitle_existing')?.value?.trim();

        // בניית נתוני השירות
        const serviceData = {
          clientId: this.currentCase.id, // 🔥 במבנה החדש: Client = Case
          serviceType: procedureType,
          serviceName: serviceName,
          description: '' // אין שדה תיאור במצב existing
        };

        // שדות ספציפיים לסוג הליך
        if (procedureType === 'hours') {
          const totalHours = parseFloat(document.getElementById('totalHours').value);
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

          serviceData.stages = stages;
        }

        // ✨ NEW: Comprehensive validation with inline errors
        const validation = this.validateServiceData(serviceData, procedureType);

        if (!validation.isValid) {
          // Display errors in the dialog
          window.CaseFormValidator?.displayErrors(validation.errors);

          // Focus on first error field with visual highlight
          this.focusOnFirstError(validation.fieldIds);

          Logger.log('❌ Validation failed:', validation.errors);
          return;
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
