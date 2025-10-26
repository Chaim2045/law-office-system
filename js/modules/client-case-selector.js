/**
 * Client-Case Selector Module
 *
 * קומפוננטה מרכזית לבחירת לקוח ואז תיק
 * משמשת בכל המערכת למניעת כפילויות
 *
 * תהליך:
 * 1. משתמש מחפש לקוח (autocomplete)
 * 2. בוחר לקוח → מופיעים התיקים שלו
 * 3. בוחר תיק → מתמלאים השדות הנסתרים
 */

(function() {
  'use strict';

  class ClientCaseSelector {
    // 🎯 Global Cache + Real-time Sync
    static clientsCache = null;
    static cacheInitialized = false;
    static cacheListener = null;

    /**
     * אתחול cache עם real-time listener
     * נקרא פעם אחת בלבד עבור כל ה-instances
     */
    static async initializeCache() {
      if (ClientCaseSelector.cacheInitialized) {
        return; // כבר מאותחל
      }

      const db = window.firebaseDB;
      if (!db) {
        console.error('❌ Firebase לא מחובר - לא ניתן לאתחל cache');
        return;
      }

      Logger.log('🔄 Initializing clients cache with real-time sync...');

      // טעינה ראשונית
      ClientCaseSelector.clientsCache = [];

      // 🎯 Snapshot listener - מעדכן את ה-cache בזמן אמת
      ClientCaseSelector.cacheListener = db.collection('clients').onSnapshot(
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const doc = change.doc;
            const data = doc.data();
            const fullName = data.fullName || data.clientName;

            if (change.type === 'added') {
              // לקוח חדש נוסף
              if (fullName) {
                ClientCaseSelector.clientsCache.push({
                  id: doc.id,
                  fullName: fullName,
                  phone: data.phone || data.phoneNumber,
                  caseNumber: doc.id
                });
              }
            }

            if (change.type === 'modified') {
              // לקוח עודכן
              const index = ClientCaseSelector.clientsCache.findIndex(c => c.id === doc.id);
              if (index !== -1 && fullName) {
                ClientCaseSelector.clientsCache[index] = {
                  id: doc.id,
                  fullName: fullName,
                  phone: data.phone || data.phoneNumber,
                  caseNumber: doc.id
                };
              }
            }

            if (change.type === 'removed') {
              // לקוח נמחק
              const index = ClientCaseSelector.clientsCache.findIndex(c => c.id === doc.id);
              if (index !== -1) {
                ClientCaseSelector.clientsCache.splice(index, 1);
              }
            }
          });

          Logger.log(`✅ Clients cache updated: ${ClientCaseSelector.clientsCache.length} clients`);
        },
        (error) => {
          console.error('❌ Error in clients cache listener:', error);
        }
      );

      ClientCaseSelector.cacheInitialized = true;
      Logger.log('✅ Clients cache initialized with real-time sync');
    }

    /**
     * ניקוי cache (לשימוש במקרה של logout או refresh)
     */
    static cleanupCache() {
      if (ClientCaseSelector.cacheListener) {
        ClientCaseSelector.cacheListener(); // unsubscribe
        ClientCaseSelector.cacheListener = null;
      }
      ClientCaseSelector.clientsCache = null;
      ClientCaseSelector.cacheInitialized = false;
      Logger.log('🗑️ Clients cache cleaned up');
    }

    /**
     * יצירת selector חדש
     * @param {string} containerId - ID של הקונטיינר להכנסת ה-selector
     * @param {Object} options - אפשרויות התצורה
     */
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.container = document.getElementById(containerId);

      if (!this.container) {
        console.error(`❌ Container ${containerId} not found`);
        return;
      }

      // Options
      this.options = {
        placeholder: options.placeholder || 'חפש לקוח...',
        casePlaceholder: options.casePlaceholder || 'בחר תיק...',
        showOnlyActive: options.showOnlyActive !== false, // ברירת מחדל: רק תיקים פעילים
        filterByType: options.filterByType || null, // null, 'hours', 'legal_procedure'
        onClientSelected: options.onClientSelected || null, // callback when client is selected
        onCaseSelected: options.onCaseSelected || null, // callback when case is selected
        required: options.required !== false
      };

      // State
      this.selectedClient = null;
      this.selectedCase = null;
      this.selectedService = null;
      this.clientCases = [];

      // ✅ Register this instance globally for onclick handlers
      window.clientCaseSelectorInstances = window.clientCaseSelectorInstances || {};
      window.clientCaseSelectorInstances[containerId] = this;

      // 🎯 Initialize cache (פעם אחת עבור כל ה-instances)
      ClientCaseSelector.initializeCache();

      this.render();
      this.attachEventListeners();
    }

    /**
     * יצירת HTML של הקומפוננטה
     */
    render() {
      this.container.innerHTML = `
        <div class="client-case-selector">
          <!-- שלב 1: חיפוש לקוח -->
          <div class="form-group">
            <label for="${this.containerId}_clientSearch">
              לקוח
              ${this.options.required ? '<span style="color: #ef4444;">*</span>' : ''}
            </label>
            <div class="modern-client-search" style="position: relative;">
              <input
                type="text"
                class="search-input"
                id="${this.containerId}_clientSearch"
                placeholder="${this.options.placeholder}"
                autocomplete="off"
                style="
                  width: 100%;
                  padding: 12px 40px 12px 16px;
                  border: 2px solid #e5e7eb;
                  border-radius: 8px;
                  font-size: 15px;
                  transition: all 0.2s;
                "
              />
              <i class="fas fa-search" style="
                position: absolute;
                left: 14px;
                top: 50%;
                transform: translateY(-50%);
                color: #9ca3af;
                pointer-events: none;
              "></i>
              <div
                class="search-results"
                id="${this.containerId}_clientResults"
                style="
                  position: absolute;
                  top: 100%;
                  left: 0;
                  right: 0;
                  background: white;
                  border: 2px solid #e5e7eb;
                  border-radius: 8px;
                  margin-top: 4px;
                  max-height: 300px;
                  overflow-y: auto;
                  z-index: 1000;
                  display: none;
                  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                "
              ></div>
            </div>
          </div>

          <!-- שלב 2: בחירת תיק (מוצג רק אחרי בחירת לקוח) -->
          <div class="form-group" id="${this.containerId}_caseGroup" style="display: none;">
            <label for="${this.containerId}_caseSelect">
              תיק
              ${this.options.required ? '<span style="color: #ef4444;">*</span>' : ''}
            </label>
            <select
              id="${this.containerId}_caseSelect"
              class="form-control"
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
            >
              <option value="">${this.options.casePlaceholder}</option>
            </select>
            <div id="${this.containerId}_caseInfo" style="
              margin-top: 8px;
              padding: 12px;
              background: #f0f9ff;
              border: 2px solid #3b82f6;
              border-radius: 8px;
              font-size: 13px;
              display: none;
            "></div>
          </div>

          <!-- שלב 3: בחירת שירות (כרטיסיות) -->
          <div class="form-group" id="${this.containerId}_servicesGroup" style="display: none;">
            <label>
              בחר שירות
              ${this.options.required ? '<span style="color: #ef4444;">*</span>' : ''}
            </label>
            <div id="${this.containerId}_servicesCards" style="
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
              gap: 12px;
              margin-top: 8px;
            "></div>
          </div>

          <!-- Hidden fields for form submission -->
          <input type="hidden" id="${this.containerId}_clientId" />
          <input type="hidden" id="${this.containerId}_clientName" />
          <input type="hidden" id="${this.containerId}_caseId" />
          <input type="hidden" id="${this.containerId}_caseNumber" />
          <input type="hidden" id="${this.containerId}_caseTitle" />
          <input type="hidden" id="${this.containerId}_serviceId" />
          <input type="hidden" id="${this.containerId}_serviceName" />
        </div>
      `;
    }

    /**
     * הוספת event listeners
     */
    attachEventListeners() {
      const searchInput = document.getElementById(`${this.containerId}_clientSearch`);
      const caseSelect = document.getElementById(`${this.containerId}_caseSelect`);

      if (searchInput) {
        // חיפוש לקוח עם debounce
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            this.searchClients(e.target.value);
          }, 300);
        });

        // סגירת תוצאות בלחיצה מחוץ לאזור
        document.addEventListener('click', (e) => {
          if (!e.target.closest('.modern-client-search')) {
            this.hideClientResults();
          }
        });
      }

      if (caseSelect) {
        caseSelect.addEventListener('change', (e) => {
          this.selectCase(e.target.value);
        });
      }

      // 🔔 האזנה לאירועי יצירת תיק חדש (אפס עלות - רק ב-browser!)
      window.addEventListener('caseCreated', (e) => {
        const { clientId, clientName, caseNumber, caseTitle } = e.detail;

        // בדיקה: האם הלקוח הזה נבחר כרגע בטופס הזה?
        if (this.selectedClient && this.selectedClient.id === clientId) {
          Logger.log(`🔄 [${this.containerId}] Detected new case for selected client. Auto-refreshing...`);

          // רענון אוטומטי של רשימת התיקים
          this.loadClientCases(clientId, clientName).then(() => {
            Logger.log(`✅ [${this.containerId}] Case list refreshed! New case: ${caseNumber}`);

            // הצגת הודעה קטנה לעובד (אופציונלי)
            if (window.NotificationSystem) {
              window.NotificationSystem.info(`התיק "${caseTitle}" נוסף לרשימה`, 2000);
            }
          });
        } else {
          Logger.log(`ℹ️ [${this.containerId}] New case created for different client - no refresh needed`);
        }
      });

      // 🔔 האזנה לאירועי הוספת שירות חדש (אפס עלות - רק ב-browser!)
      window.addEventListener('serviceAdded', async (e) => {
        const { caseId, serviceId, serviceName } = e.detail;

        // בדיקה: האם התיק הזה נבחר כרגע בטופס הזה?
        if (this.selectedCase && this.selectedCase.id === caseId) {
          Logger.log(`🔄 [${this.containerId}] Detected new service for selected case. Auto-refreshing...`);

          // רענון אוטומטי של התיק מ-Firebase
          try {
            const db = window.firebaseDB;
            const caseDoc = await db.collection('clients').doc(caseId).get();

            if (caseDoc.exists) {
              const updatedCase = { id: caseDoc.id, ...caseDoc.data() };
              this.selectedCase = updatedCase;

              // רענון כרטיסיות השירותים
              this.renderServiceCards(updatedCase);

              Logger.log(`✅ [${this.containerId}] Service cards refreshed! New service: ${serviceName}`);

              // הצגת הודעה קטנה לעובד (אופציונלי)
              if (window.NotificationSystem) {
                window.NotificationSystem.info(`השירות "${serviceName}" נוסף לרשימה`, 2000);
              }
            }
          } catch (error) {
            console.error('❌ Error refreshing service cards:', error);
          }
        } else {
          Logger.log(`ℹ️ [${this.containerId}] New service added for different case - no refresh needed`);
        }
      });
    }

    /**
     * חיפוש לקוחות (עם cache + real-time sync)
     */
    async searchClients(query) {
      const resultsContainer = document.getElementById(`${this.containerId}_clientResults`);

      if (!resultsContainer) {
        console.error('❌ resultsContainer לא נמצא! ID:', `${this.containerId}_clientResults`);
        return;
      }

      if (query.length < 1) {
        resultsContainer.style.display = 'none';
        return;
      }

      try {
        // 🚀 חיפוש מהיר ב-cache (אפס Firebase reads!)
        if (!ClientCaseSelector.clientsCache) {
          // Cache עדיין לא מוכן - נחכה
          resultsContainer.innerHTML = `
            <div style="padding: 16px; text-align: center; color: #6b7280;">
              <i class="fas fa-spinner fa-spin"></i> טוען נתונים...
            </div>
          `;
          resultsContainer.style.display = 'block';

          // נסה שוב אחרי שנייה
          setTimeout(() => this.searchClients(query), 500);
          return;
        }

        if (ClientCaseSelector.clientsCache.length === 0) {
          console.warn('⚠️ לא נמצאו לקוחות במערכת');
          resultsContainer.innerHTML = `
            <div style="padding: 16px; text-align: center; color: #ef4444;">
              אין לקוחות במערכת
            </div>
          `;
          resultsContainer.style.display = 'block';
          resultsContainer.style.visibility = 'visible';
          resultsContainer.style.opacity = '1';
          return;
        }

        // 🎯 חיפוש מהיר בזיכרון - ללא Firebase reads!
        const matches = ClientCaseSelector.clientsCache.filter(client => {
          if (!client.fullName) return false;
          return client.fullName.includes(query);
        });

        if (matches.length === 0) {
          resultsContainer.innerHTML = `
            <div style="padding: 16px; text-align: center; color: #6b7280;">
              לא נמצאו לקוחות מתאימים לחיפוש "${this.escapeHtml(query)}"
            </div>
          `;
          resultsContainer.style.display = 'block';
          resultsContainer.style.visibility = 'visible';
          resultsContainer.style.opacity = '1';
          resultsContainer.classList.add('show');
          return;
        }

        // בניית HTML של התוצאות - משתמשים ב-data attributes
        const resultsHtml = matches.map((client, index) => `
          <div
            class="search-result-item"
            data-client-index="${index}"
            data-client-id="${this.escapeHtml(client.id)}"
            data-client-name="${this.escapeHtml(client.fullName)}"
            style="
              padding: 12px 16px;
              cursor: pointer;
              border-bottom: 1px solid #f3f4f6;
              transition: background 0.2s;
            "
            onmouseover="this.style.background='#f9fafb'"
            onmouseout="this.style.background='white'"
          >
            <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">
              ${client.fullName}
            </div>
            <div style="font-size: 12px; color: #6b7280;">
              ${client.id || ''} ${client.phone ? '• ' + client.phone : ''}
            </div>
          </div>
        `).join('');

        resultsContainer.innerHTML = resultsHtml;
        resultsContainer.style.display = 'block';
        resultsContainer.style.visibility = 'visible';
        resultsContainer.style.opacity = '1';
        // ✅ CRITICAL FIX: Add .show class to enable pointer-events
        resultsContainer.classList.add('show');

        // הוספת event listeners לכל תוצאה
        // ✅ FIX: שימוש ב-querySelectorAll מיד אחרי innerHTML
        const resultItems = resultsContainer.querySelectorAll('.search-result-item');
        Logger.log(`🔧 [${this.containerId}] Adding click listeners to ${resultItems.length} results`);

        resultItems.forEach((item, index) => {
          // Remove inline event handlers and use proper event listeners
          item.removeAttribute('onclick');

          item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            Logger.log(`✅ [${this.containerId}] Click event fired on:`, item.dataset.clientName);
            const clientId = item.dataset.clientId;
            const clientName = item.dataset.clientName;
            this.selectClient(clientId, clientName);
          }, { once: false }); // Don't use once: true, we want it to work multiple times

          Logger.log(`  ✓ Listener ${index + 1} added for:`, item.dataset.clientName);
        });

      } catch (error) {
        console.error('❌ שגיאה בחיפוש לקוחות:', error);
        resultsContainer.innerHTML = `
          <div style="padding: 16px; text-align: center; color: #ef4444;">
            שגיאה בחיפוש לקוחות: ${error.message}
          </div>
        `;
        resultsContainer.style.display = 'block';
        resultsContainer.style.visibility = 'visible';
        resultsContainer.style.opacity = '1';
        resultsContainer.classList.add('show');
      }
    }

    /**
     * בחירת לקוח
     */
    async selectClient(clientId, clientName) {
      Logger.log(`🎯 selectClient called:`, { clientId, clientName });

      this.selectedClient = { id: clientId, name: clientName };

      // עדכון שדה החיפוש
      const searchInput = document.getElementById(`${this.containerId}_clientSearch`);
      if (searchInput) {
        searchInput.value = `✓ ${clientName}`;
        Logger.log(`  ✓ Updated search input to: ✓ ${clientName}`);
      }

      // הסתרת תוצאות החיפוש
      this.hideClientResults();
      Logger.log(`  ✓ Hidden client results`);

      // שמירת clientId
      const clientIdField = document.getElementById(`${this.containerId}_clientId`);
      if (clientIdField) {
        clientIdField.value = clientId;
      }

      const clientNameField = document.getElementById(`${this.containerId}_clientName`);
      if (clientNameField) {
        clientNameField.value = clientName;
      }

      // ✅ קריאה ל-callback
      if (this.options.onClientSelected) {
        this.options.onClientSelected(this.selectedClient);
      }

      // טעינת תיקים של הלקוח (חיפוש לפי שם במבנה החדש)
      Logger.log(`  🔍 Loading cases for client ${clientName}...`);
      await this.loadClientCases(clientId, clientName);
      Logger.log(`  ✅ selectClient completed`);
    }

    /**
     * טעינת תיקים של לקוח (במבנה החדש: חיפוש לפי שם)
     */
    async loadClientCases(clientId, clientName) {
      Logger.log(`📂 loadClientCases started for clientId: ${clientId}, clientName: ${clientName}`);

      try {
        const db = window.firebaseDB;
        if (!db) {
          throw new Error('Firebase לא מחובר');
        }

        // ✅ במבנה החדש: Client = Case (one-to-one)
        // חיפוש לפי clientId (document ID) במקום לפי clientName
        Logger.log(`  🔍 Querying client by ID: ${clientId}...`);
        const clientDoc = await db.collection('clients').doc(clientId).get();

        let clientCases = [];
        if (clientDoc.exists) {
          const data = clientDoc.data();
          clientCases.push({
            id: clientDoc.id, // במבנה החדש: document ID = caseNumber
            ...data
          });
        }

        Logger.log(`  📊 Found ${clientCases.length} client/case in Firebase`);

        // סינון לפי סטטוס (אם נדרש)
        if (this.options.showOnlyActive) {
          const beforeFilter = clientCases.length;
          clientCases = clientCases.filter(c => c.status === 'active');
          Logger.log(`  🔍 Filtered by status: ${beforeFilter} → ${clientCases.length} (active only)`);
        }

        // סינון לפי סוג (אם נדרש)
        if (this.options.filterByType) {
          const beforeFilter = clientCases.length;
          clientCases = clientCases.filter(c => c.procedureType === this.options.filterByType);
          Logger.log(`  🔍 Filtered by type: ${beforeFilter} → ${clientCases.length} (${this.options.filterByType} only)`);
        }

        this.clientCases = clientCases;
        Logger.log(`  ✅ Final cases count: ${clientCases.length}`);

        // בניית dropdown של תיקים
        Logger.log(`  🎨 Rendering case dropdown...`);
        this.renderCaseDropdown();

      } catch (error) {
        console.error('❌ שגיאה בטעינת תיקים של הלקוח:', error);
        alert('שגיאה בטעינת תיקים של הלקוח: ' + error.message);
      }
    }

    /**
     * בניית dropdown של תיקים
     */
    renderCaseDropdown() {
      Logger.log(`🎨 renderCaseDropdown called with ${this.clientCases.length} cases`);

      const caseSelect = document.getElementById(`${this.containerId}_caseSelect`);
      const caseGroup = document.getElementById(`${this.containerId}_caseGroup`);

      Logger.log(`  📍 Elements found:`, { caseSelect: !!caseSelect, caseGroup: !!caseGroup });

      if (!caseSelect || !caseGroup) {
        console.error(`  ❌ Missing elements! caseSelect: ${!!caseSelect}, caseGroup: ${!!caseGroup}`);
        return;
      }

      if (this.clientCases.length === 0) {
        console.warn(`  ⚠️ No cases found - hiding case group`);
        caseGroup.style.display = 'none';
        alert('❌ ללקוח זה אין תיקים פעילים');
        return;
      }

      // בניית אופציות
      const optionsHtml = this.clientCases.map(caseItem => {
        const icon = caseItem.procedureType === 'legal_procedure' ? '⚖️' : '⏱️';
        const hoursInfo = caseItem.procedureType === 'hours'
          ? `${caseItem.hoursRemaining || 0} שעות נותרות`
          : caseItem.procedureType === 'legal_procedure'
          ? `שלב ${caseItem.currentStage || 'א'}`
          : '';

        return `
          <option value="${caseItem.id}">
            ${icon} ${caseItem.caseNumber} - ${caseItem.caseTitle || 'ללא כותרת'} ${hoursInfo ? '(' + hoursInfo + ')' : ''}
          </option>
        `;
      }).join('');

      caseSelect.innerHTML = `
        <option value="">${this.options.casePlaceholder}</option>
        ${optionsHtml}
      `;

      Logger.log(`  ✅ Updated dropdown with ${this.clientCases.length} options`);

      // הצגת הקבוצה
      caseGroup.style.display = 'block';
      Logger.log(`  ✅ Case group displayed (display: ${caseGroup.style.display})`);

      // בחירה אוטומטית אם יש תיק אחד בלבד
      if (this.clientCases.length === 1) {
        Logger.log(`  🎯 Auto-selecting single case: ${this.clientCases[0].caseNumber}`);
        caseSelect.value = this.clientCases[0].id;
        this.selectCase(this.clientCases[0].id);
      }

      Logger.log(`  ✅ renderCaseDropdown completed`);
    }

    /**
     * בחירת תיק
     */
    selectCase(caseId) {
      const caseItem = this.clientCases.find(c => c.id === caseId);

      if (!caseItem) {
        this.selectedCase = null;
        this.hideCaseInfo();
        return;
      }

      this.selectedCase = caseItem;
      this.selectedService = null; // איפוס שירות נבחר

      // עדכון שדות נסתרים
      document.getElementById(`${this.containerId}_caseId`).value = caseItem.id;
      document.getElementById(`${this.containerId}_caseNumber`).value = caseItem.caseNumber || '';
      document.getElementById(`${this.containerId}_caseTitle`).value = caseItem.caseTitle || '';

      // 🎯 בדיקה: האם יש שירותים/שלבים פעילים או תיק ישן?
      const services = caseItem.services || [];
      const stages = caseItem.stages || [];
      const isLegacyCase = services.length === 0 && stages.length === 0 &&
                          (caseItem.hoursTotal > 0 || caseItem.procedureType === 'legal_procedure');
      const hasActiveServices = services.filter(s => s.status === 'active').length > 0 ||
                                stages.filter(s => s.status === 'active').length > 0 ||
                                isLegacyCase;

      if (hasActiveServices) {
        // ✅ יש שירותים - הסתר dropdown של תיקים, הצג רק כרטיסיות

        // הסתרת ה-dropdown של תיקים
        const caseSelect = document.getElementById(`${this.containerId}_caseSelect`);
        if (caseSelect) {
          caseSelect.style.display = 'none';
        }

        this.hideCaseInfo();
        this.renderServiceCards(caseItem);
      } else {
        // ⚠️ אין שירותים - הצג dropdown ומידע על התיק
        Logger.log('ℹ️ No active services - showing case dropdown and caseInfo');

        // הצגת ה-dropdown של תיקים
        const caseSelect = document.getElementById(`${this.containerId}_caseSelect`);
        if (caseSelect) {
          caseSelect.style.display = 'block';
        }

        this.showCaseInfo(caseItem);
        this.renderServiceCards(caseItem); // זה יסתיר אוטומטית את קבוצת השירותים
      }

      // ✅ קריאה ל-callback
      if (this.options.onCaseSelected) {
        this.options.onCaseSelected(caseItem);
      }
    }

    /**
     * הצגת מידע על התיק שנבחר
     */
    showCaseInfo(caseItem) {
      const caseInfo = document.getElementById(`${this.containerId}_caseInfo`);
      if (!caseInfo) return;

      const icon = caseItem.procedureType === 'legal_procedure' ? '⚖️' : '⏱️';

      let infoHtml = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <i class="fas fa-check-circle" style="color: #3b82f6;"></i>
          <span style="font-weight: 600; color: #1e40af;">
            ${icon} ${caseItem.caseNumber} - ${caseItem.caseTitle}
          </span>
        </div>
      `;

      if (caseItem.procedureType === 'hours') {
        infoHtml += `
          <div style="font-size: 13px; color: #0369a1;">
            💼 שעות נותרות: ${caseItem.hoursRemaining || 0}
          </div>
        `;
      } else if (caseItem.procedureType === 'legal_procedure') {
        infoHtml += `
          <div style="font-size: 13px; color: #0369a1;">
            📋 שלב נוכחי: ${caseItem.currentStage || 'שלב א'}
          </div>
        `;
      }

      caseInfo.innerHTML = infoHtml;
      caseInfo.style.display = 'block';
    }

    /**
     * הסתרת מידע על תיק
     */
    hideCaseInfo() {
      const caseInfo = document.getElementById(`${this.containerId}_caseInfo`);
      if (caseInfo) {
        caseInfo.style.display = 'none';
      }
    }

    /**
     * רינדור כרטיסיות שירותים
     */
    renderServiceCards(caseItem) {
      const servicesGroup = document.getElementById(`${this.containerId}_servicesGroup`);
      const servicesCards = document.getElementById(`${this.containerId}_servicesCards`);

      if (!servicesGroup || !servicesCards) {
        console.error('❌ Services containers not found');
        return;
      }

      // בדיקה אם יש שירותים
      const services = caseItem.services || [];
      const stages = caseItem.stages || [];

      // 🔄 Fallback: תיקים ישנים ללא services - נציג את התיק עצמו ככרטיס
      const isLegacyCase = services.length === 0 && stages.length === 0;

      if (services.length === 0 && stages.length === 0 && !isLegacyCase) {
        // אין שירותים וגם לא תיק ישן - הסתרת הקבוצה
        servicesGroup.style.display = 'none';
        return;
      }

      // בניית כרטיסיות
      let cardsHtml = '';

      if (isLegacyCase) {
        // 🏷️ תיק ישן - נציג את התיק עצמו ככרטיס שירות יחיד
        Logger.log('🔄 Legacy case detected - showing case as single service card');
        const legacyService = {
          id: caseItem.id, // נשתמש ב-caseId כ-serviceId
          name: caseItem.caseTitle || 'תיק ראשי',
          hoursRemaining: caseItem.hoursRemaining || 0,
          status: 'active'
        };
        cardsHtml = this.createServiceCard(legacyService, 'hours', caseItem.pricingType, caseItem);
      } else {
        // תוכנית שעות רגילה
        if (caseItem.procedureType === 'hours' && services.length > 0) {
          cardsHtml = services
            .filter(s => s.status === 'active')
            .map(service => this.createServiceCard(service, 'hours', 'hourly', caseItem))
            .join('');
        }

        // הליך משפטי
        if (caseItem.procedureType === 'legal_procedure' && stages.length > 0) {
          cardsHtml = stages
            .filter(s => s.status === 'active')
            .map(stage => this.createServiceCard(stage, 'legal_procedure', caseItem.pricingType, caseItem))
            .join('');
        }
      }

      servicesCards.innerHTML = cardsHtml;
      servicesGroup.style.display = 'block';

      // בחירה אוטומטית אם יש שירות אחד בלבד
      const activeServices = services.filter(s => s.status === 'active');
      const activeStages = stages.filter(s => s.status === 'active');

      if (isLegacyCase) {
        // תיק ישן - בחירה אוטומטית
        this.selectService(caseItem.id, 'hours');
      } else if (activeServices.length === 1 && services.length > 0) {
        this.selectService(activeServices[0].id, 'hours');
      } else if (activeStages.length === 1 && stages.length > 0) {
        this.selectService(activeStages[0].id, 'legal_procedure');
      }
    }

    /**
     * יצירת כרטיס שירות בודד
     */
    createServiceCard(service, type, pricingType = 'hourly', caseItem = null) {
      const serviceId = service.id;
      let iconClass, title, subtitle, statsHtml;

      if (type === 'hours') {
        // תוכנית שעות - חישוב מחבילות (Single Source of Truth)
        iconClass = 'fa-briefcase';
        title = 'תוכנית שעות';
        subtitle = service.name;

        const hoursRemaining = window.calculateRemainingHours(service);
        const totalHours = service.totalHours || 90; // fallback
        const hoursUsed = totalHours - hoursRemaining;
        const progressPercent = Math.round((hoursUsed / totalHours) * 100);

        statsHtml = `
          <div style="margin-top: 12px;">
            <!-- Progress Bar -->
            <div style="
              background: #f1f5f9;
              height: 5px;
              border-radius: 2.5px;
              overflow: hidden;
              margin-bottom: 10px;
            ">
              <div style="
                width: ${progressPercent}%;
                height: 100%;
                background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
                transition: width 0.3s ease;
              "></div>
            </div>

            <!-- Stats Row -->
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 12px;
            ">
              <div style="display: flex; align-items: center; gap: 5px; color: #3b82f6; font-weight: 600;">
                <i class="fas fa-clock" style="font-size: 11px;"></i>
                <span>${hoursRemaining.toFixed(1)} שעות</span>
              </div>
              <div style="color: #64748b; font-size: 11px;">
                ${progressPercent}% בשימוש
              </div>
            </div>
          </div>
        `;
      } else if (type === 'legal_procedure') {
        // הליך משפטי
        iconClass = 'fa-balance-scale';
        const stageName = service.id === 'stage_a' ? "שלב א'" :
                         service.id === 'stage_b' ? "שלב ב'" :
                         service.id === 'stage_c' ? "שלב ג'" : service.name;
        title = `הליך משפטי - ${stageName}`;
        subtitle = service.description || service.name;

        if (pricingType === 'hourly') {
          const hoursRemaining = window.calculateRemainingHours(service);
          const totalHours = service.totalHours || 0;
          const hoursUsed = totalHours - hoursRemaining;
          const progressPercent = totalHours > 0 ? Math.round((hoursUsed / totalHours) * 100) : 0;

          statsHtml = `
            <div style="margin-top: 12px;">
              <div style="
                background: #f1f5f9;
                height: 5px;
                border-radius: 2.5px;
                overflow: hidden;
                margin-bottom: 10px;
              ">
                <div style="
                  width: ${progressPercent}%;
                  height: 100%;
                  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
                "></div>
              </div>
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
              ">
                <div style="display: flex; align-items: center; gap: 5px; color: #3b82f6; font-weight: 600;">
                  <i class="fas fa-clock" style="font-size: 11px;"></i>
                  <span>${hoursRemaining.toFixed(1)} שעות</span>
                </div>
                <div style="color: #64748b; font-size: 11px;">
                  ${progressPercent}% בשימוש
                </div>
              </div>
            </div>
          `;
        } else {
          statsHtml = `
            <div style="margin-top: 12px;">
              <div style="
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 10px;
                background: #f0fdf4;
                border-radius: 6px;
                border: 1px solid #86efac;
              ">
                <i class="fas fa-check-circle" style="color: #22c55e; font-size: 12px;"></i>
                <span style="color: #166534; font-weight: 500; font-size: 12px;">מחיר פיקס</span>
              </div>
            </div>
          `;
        }
      }

      // מספר תיק - עיצוב מודרני
      const caseNumberBadge = caseItem && caseItem.caseNumber ? `
        <div style="
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 5px 10px;
          background: #f8fafc;
          border: 1px solid #93c5fd;
          border-radius: 5px;
          font-size: 10px;
          font-weight: 600;
          color: #3b82f6;
          letter-spacing: 0.3px;
        ">
          #${this.escapeHtml(caseItem.caseNumber)}
        </div>
      ` : '';

      return `
        <div
          class="service-card"
          data-service-id="${this.escapeHtml(serviceId)}"
          data-service-type="${type}"
          onclick="window.clientCaseSelectorInstances['${this.containerId}'].selectService('${this.escapeHtml(serviceId)}', '${type}')"
          style="
            padding: 15px;
            padding-top: 40px;
            background: white;
            border: 1.5px solid #e2e8f0;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          "
          onmouseover="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 8px 24px rgba(59, 130, 246, 0.12)'; this.style.transform='translateY(-4px)';"
          onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.05)'; this.style.transform='translateY(0)';"
        >
          ${caseNumberBadge}

          <!-- Icon & Title -->
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <div style="
              width: 36px;
              height: 36px;
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            ">
              <i class="fas ${iconClass}" style="color: white; font-size: 16px;"></i>
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; color: #0f172a; font-size: 14px; line-height: 1.3;">
                ${this.escapeHtml(title)}
              </div>
            </div>
          </div>

          <!-- Subtitle -->
          <div style="
            color: #64748b;
            font-size: 12px;
            line-height: 1.5;
            margin-bottom: 3px;
            min-height: 32px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          ">
            ${this.escapeHtml(subtitle)}
          </div>

          <!-- Stats/Progress -->
          ${statsHtml}
        </div>
      `;
    }

    /**
     * בחירת שירות
     */
    selectService(serviceId, type) {
      // מציאת השירות/שלב
      let serviceData;
      if (type === 'hours') {
        // בדיקה: האם זה תיק ישן (serviceId = caseId)?
        if (serviceId === this.selectedCase.id) {
          // תיק ישן - נשתמש בנתוני התיק עצמו
          serviceData = {
            id: this.selectedCase.id,
            name: this.selectedCase.caseTitle || 'תיק ראשי',
            hoursRemaining: this.selectedCase.hoursRemaining || 0,
            status: 'active'
          };
        } else {
          // תיק חדש עם services
          serviceData = this.selectedCase.services?.find(s => s.id === serviceId);
        }
      } else if (type === 'legal_procedure') {
        serviceData = this.selectedCase.stages?.find(s => s.id === serviceId);
      }

      this.selectedService = serviceData;

      // עדכון שדות נסתרים
      document.getElementById(`${this.containerId}_serviceId`).value = serviceId;
      document.getElementById(`${this.containerId}_serviceName`).value = serviceData?.name || serviceData?.description || '';

      // 🎨 הסתרת caseInfo
      this.hideCaseInfo();

      // 🎨 תצוגה נקייה - רק הכרטיס הנבחר + כפתור שינוי
      this.showSelectedServiceOnly(serviceData, type);
    }

    /**
     * הצגת השירות הנבחר בלבד
     */
    showSelectedServiceOnly(serviceData, type) {
      const servicesCards = document.getElementById(`${this.containerId}_servicesCards`);
      if (!servicesCards) return;

      let iconClass, title, subtitle, statsHtml;

      if (type === 'hours') {
        iconClass = 'fa-briefcase';
        title = 'תוכנית שעות';
        subtitle = serviceData.name;

        const hoursRemaining = window.calculateRemainingHours(serviceData);
        const totalHours = serviceData.totalHours || 90;
        const hoursUsed = totalHours - hoursRemaining;
        const progressPercent = Math.round((hoursUsed / totalHours) * 100);

        statsHtml = `
          <div style="margin-top: 12px;">
            <!-- Progress Bar -->
            <div style="
              background: #f1f5f9;
              height: 5px;
              border-radius: 2.5px;
              overflow: hidden;
              margin-bottom: 10px;
            ">
              <div style="
                width: ${progressPercent}%;
                height: 100%;
                background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
                transition: width 0.3s ease;
              "></div>
            </div>

            <!-- Stats Row -->
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 12px;
            ">
              <div style="display: flex; align-items: center; gap: 5px; color: #3b82f6; font-weight: 600;">
                <i class="fas fa-clock" style="font-size: 11px;"></i>
                <span>${hoursRemaining.toFixed(1)} שעות נותרות</span>
              </div>
              <div style="color: #64748b; font-size: 11px;">
                ${progressPercent}% בשימוש
              </div>
            </div>
          </div>
        `;
      } else if (type === 'legal_procedure') {
        iconClass = 'fa-balance-scale';
        const stageName = serviceData.id === 'stage_a' ? "שלב א'" :
                         serviceData.id === 'stage_b' ? "שלב ב'" :
                         serviceData.id === 'stage_c' ? "שלב ג'" : serviceData.name;
        title = `הליך משפטי - ${stageName}`;
        subtitle = serviceData.description || serviceData.name;

        if (this.selectedCase.pricingType === 'hourly') {
          const hoursRemaining = window.calculateRemainingHours(serviceData);
          const totalHours = serviceData.totalHours || 90;
          const hoursUsed = totalHours - hoursRemaining;
          const progressPercent = Math.round((hoursUsed / totalHours) * 100);

          statsHtml = `
            <div style="margin-top: 12px;">
              <!-- Progress Bar -->
              <div style="
                background: #f1f5f9;
                height: 5px;
                border-radius: 2.5px;
                overflow: hidden;
                margin-bottom: 10px;
              ">
                <div style="
                  width: ${progressPercent}%;
                  height: 100%;
                  background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
                  transition: width 0.3s ease;
                "></div>
              </div>

              <!-- Stats Row -->
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
              ">
                <div style="display: flex; align-items: center; gap: 5px; color: #3b82f6; font-weight: 600;">
                  <i class="fas fa-clock" style="font-size: 11px;"></i>
                  <span>${hoursRemaining.toFixed(1)} שעות</span>
                </div>
                <div style="color: #64748b; font-size: 11px;">
                  ${progressPercent}% בשימוש
                </div>
              </div>
            </div>
          `;
        } else {
          statsHtml = `
            <div style="margin-top: 12px;">
              <div style="
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 10px;
                background: #f8fafc;
                border-radius: 6px;
              ">
                <i class="fas fa-dollar-sign" style="color: #10b981; font-size: 12px;"></i>
                <span style="color: #0f172a; font-weight: 600; font-size: 12px;">מחיר פיקס</span>
              </div>
            </div>
          `;
        }
      }

      // 🏷️ מספר תיק - Tech Minimalist style
      const caseNumberBadge = this.selectedCase && this.selectedCase.caseNumber ? `
        <div style="
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 5px 10px;
          background: #f8fafc;
          border: 1px solid #93c5fd;
          border-radius: 5px;
          font-size: 10px;
          font-weight: 600;
          color: #3b82f6;
          letter-spacing: 0.3px;
        ">
          תיק ${this.escapeHtml(this.selectedCase.caseNumber)}
        </div>
      ` : '';

      // תצוגה נקייה - Tech Minimalist selected state
      servicesCards.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          gap: 12px;
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: 8px;
            color: #10b981;
            font-weight: 600;
            font-size: 14px;
          ">
            <i class="fas fa-check-circle"></i>
            <span>שירות נבחר:</span>
          </div>

          <div style="
            padding: 15px;
            padding-top: 40px;
            background: white;
            border: 2px solid #3b82f6;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
            position: relative;
          ">
            ${caseNumberBadge}

            <!-- Icon & Title -->
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
              <div style="
                width: 36px;
                height: 36px;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              ">
                <i class="fas ${iconClass}" style="color: white; font-size: 16px;"></i>
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; color: #0f172a; font-size: 14px; line-height: 1.3;">
                  ${this.escapeHtml(title)}
                </div>
              </div>
            </div>

            <!-- Subtitle -->
            <div style="
              color: #64748b;
              font-size: 12px;
              line-height: 1.5;
              margin-bottom: 3px;
            ">
              ${this.escapeHtml(subtitle)}
            </div>

            ${statsHtml}
          </div>

          <button
            type="button"
            onclick="window.clientCaseSelectorInstances['${this.containerId}'].changeService()"
            style="
              padding: 10px 16px;
              background: white;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              color: #6b7280;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            "
            onmouseover="this.style.borderColor='#3b82f6'; this.style.color='#3b82f6';"
            onmouseout="this.style.borderColor='#e5e7eb'; this.style.color='#6b7280';"
          >
            <i class="fas fa-exchange-alt"></i>
            <span>שנה שירות</span>
          </button>
        </div>
      `;
    }

    /**
     * שינוי שירות - חזרה לרשימה
     */
    changeService() {
      Logger.log(`🔄 Change service requested`);

      // איפוס בחירת שירות
      this.selectedService = null;
      document.getElementById(`${this.containerId}_serviceId`).value = '';
      document.getElementById(`${this.containerId}_serviceName`).value = '';

      // חזרה לתצוגת כל הכרטיסים (ללא caseInfo - רק כרטיסיות!)
      this.renderServiceCards(this.selectedCase);
    }

    /**
     * הסתרת תוצאות חיפוש לקוחות
     */
    hideClientResults() {
      const resultsContainer = document.getElementById(`${this.containerId}_clientResults`);
      if (resultsContainer) {
        resultsContainer.style.display = 'none';
        resultsContainer.classList.remove('show');
      }
    }

    /**
     * קבלת הערכים הנבחרים
     */
    getSelectedValues() {
      return {
        clientId: document.getElementById(`${this.containerId}_clientId`)?.value || null,
        clientName: document.getElementById(`${this.containerId}_clientName`)?.value || null,
        caseId: document.getElementById(`${this.containerId}_caseId`)?.value || null,
        caseNumber: document.getElementById(`${this.containerId}_caseNumber`)?.value || null,
        caseTitle: document.getElementById(`${this.containerId}_caseTitle`)?.value || null,
        serviceId: document.getElementById(`${this.containerId}_serviceId`)?.value || null,
        serviceName: document.getElementById(`${this.containerId}_serviceName`)?.value || null,
        caseData: this.selectedCase,
        serviceData: this.selectedService
      };
    }

    /**
     * ולידציה
     */
    validate() {
      const values = this.getSelectedValues();

      if (this.options.required) {
        if (!values.clientId) {
          return { isValid: false, error: 'חובה לבחור לקוח' };
        }
        if (!values.caseId) {
          return { isValid: false, error: 'חובה לבחור תיק' };
        }
      }

      return { isValid: true };
    }

    /**
     * רענון נתוני התיק הנבחר מ-Firebase
     * נקרא אחרי loadData() כדי לעדכן שעות נותרות
     */
    async refreshSelectedCase() {
      // אם אין תיק נבחר - אין מה לרענן
      if (!this.selectedCase || !this.selectedCase.id) {
        return;
      }

      try {
        const db = window.firebaseDB;
        if (!db) {
          console.warn('⚠️ Firebase לא זמין לרענון');
          return;
        }

        Logger.log(`🔄 [${this.containerId}] Refreshing selected case: ${this.selectedCase.id}`);

        // שליפת נתונים עדכניים מ-Firebase
        const caseDoc = await db.collection('clients').doc(this.selectedCase.id).get();

        if (caseDoc.exists) {
          const freshData = { id: caseDoc.id, ...caseDoc.data() };

          // עדכון התיק בזיכרון
          this.selectedCase = freshData;

          // עדכון גם ב-clientCases (אם קיים שם)
          const caseIndex = this.clientCases.findIndex(c => c.id === this.selectedCase.id);
          if (caseIndex !== -1) {
            this.clientCases[caseIndex] = freshData;
          }

          // רענון התצוגה
          this.renderServiceCards(freshData);

          Logger.log(`✅ [${this.containerId}] Case refreshed with updated data`);
        }
      } catch (error) {
        console.error('❌ Error refreshing selected case:', error);
      }
    }

    /**
     * איפוס הקומפוננטה
     */
    reset() {
      this.selectedClient = null;
      this.selectedCase = null;
      this.selectedService = null;
      this.clientCases = [];

      const searchInput = document.getElementById(`${this.containerId}_clientSearch`);
      if (searchInput) searchInput.value = '';

      const caseGroup = document.getElementById(`${this.containerId}_caseGroup`);
      if (caseGroup) caseGroup.style.display = 'none';

      const servicesGroup = document.getElementById(`${this.containerId}_servicesGroup`);
      if (servicesGroup) servicesGroup.style.display = 'none';

      this.hideClientResults();
      this.hideCaseInfo();

      // איפוס שדות נסתרים
      ['clientId', 'clientName', 'caseId', 'caseNumber', 'caseTitle', 'serviceId', 'serviceName'].forEach(field => {
        const input = document.getElementById(`${this.containerId}_${field}`);
        if (input) input.value = '';
      });
    }

    /**
     * Alias for reset (for compatibility)
     */
    clear() {
      this.reset();
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    }
  }

  // Global registry for instances
  window.clientCaseSelectorInstances = window.clientCaseSelectorInstances || {};

  // ✅ Export the class itself as a constructor
  window.ClientCaseSelector = ClientCaseSelector;

  // ✅ Export cleanup function for logout/refresh scenarios
  window.cleanupClientCaseCache = ClientCaseSelector.cleanupCache;

  Logger.log('✅ Client-Case Selector Module loaded (with real-time cache)');

})();
