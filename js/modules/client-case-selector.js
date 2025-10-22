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
      this.clientCases = [];

      // ✅ Register this instance globally for onclick handlers
      window.clientCaseSelectorInstances = window.clientCaseSelectorInstances || {};
      window.clientCaseSelectorInstances[containerId] = this;

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
              תיק/שירות
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

          <!-- Hidden fields for form submission -->
          <input type="hidden" id="${this.containerId}_clientId" />
          <input type="hidden" id="${this.containerId}_clientName" />
          <input type="hidden" id="${this.containerId}_caseId" />
          <input type="hidden" id="${this.containerId}_caseNumber" />
          <input type="hidden" id="${this.containerId}_caseTitle" />
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
    }

    /**
     * חיפוש לקוחות
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
        // ✅ טעינה ישירה מ-Firebase - הכי אמין

        const db = window.firebaseDB;
        if (!db) {
          throw new Error('Firebase לא מחובר');
        }

        // טעינה מקבילית של clients + cases
        const [clientsSnapshot, casesSnapshot] = await Promise.all([
          db.collection('clients').get(),
          db.collection('cases').get()
        ]);

        const clientsMap = new Map();

        // שלב 1: הוסף לקוחות מ-collection clients
        clientsSnapshot.forEach(doc => {
          const data = doc.data();
          const fullName = data.fullName || data.clientName;
          if (fullName) {
            clientsMap.set(doc.id, {
              id: doc.id,
              fullName: fullName,
              phone: data.phone || data.phoneNumber,
              source: 'clients'
            });
          }
        });

        // שלב 2: הוסף לקוחות ייחודיים מ-cases (שאין להם רשומה ב-clients)
        casesSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.clientId && data.clientName) {
            if (!clientsMap.has(data.clientId)) {
              clientsMap.set(data.clientId, {
                id: data.clientId,
                fullName: data.clientName,
                phone: data.clientPhone || '',
                source: 'cases'
              });
            }
          }
        });

        const clients = Array.from(clientsMap.values());

        if (clients.length === 0) {
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

        // סינון לקוחות לפי שם
        const matches = clients.filter(client => {
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
        console.log(`🔧 [${this.containerId}] Adding click listeners to ${resultItems.length} results`);

        resultItems.forEach((item, index) => {
          // Remove inline event handlers and use proper event listeners
          item.removeAttribute('onclick');

          item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`✅ [${this.containerId}] Click event fired on:`, item.dataset.clientName);
            const clientId = item.dataset.clientId;
            const clientName = item.dataset.clientName;
            this.selectClient(clientId, clientName);
          }, { once: false }); // Don't use once: true, we want it to work multiple times

          console.log(`  ✓ Listener ${index + 1} added for:`, item.dataset.clientName);
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
      console.log(`🎯 selectClient called:`, { clientId, clientName });

      this.selectedClient = { id: clientId, name: clientName };

      // עדכון שדה החיפוש
      const searchInput = document.getElementById(`${this.containerId}_clientSearch`);
      if (searchInput) {
        searchInput.value = `✓ ${clientName}`;
        console.log(`  ✓ Updated search input to: ✓ ${clientName}`);
      }

      // הסתרת תוצאות החיפוש
      this.hideClientResults();
      console.log(`  ✓ Hidden client results`);

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

      // טעינת תיקים של הלקוח
      console.log(`  🔍 Loading cases for client ${clientId}...`);
      await this.loadClientCases(clientId);
      console.log(`  ✅ selectClient completed`);
    }

    /**
     * טעינת תיקים של לקוח
     */
    async loadClientCases(clientId) {
      console.log(`📂 loadClientCases started for clientId: ${clientId}`);

      try {
        const db = window.firebaseDB;
        if (!db) {
          throw new Error('Firebase לא מחובר');
        }

        // שליפת כל התיקים של הלקוח מ-Firebase
        console.log(`  🔍 Querying Firebase for cases...`);
        const casesSnapshot = await db.collection('cases')
          .where('clientId', '==', clientId)
          .get();

        console.log(`  📊 Found ${casesSnapshot.size} cases in Firebase`);

        let clientCases = [];
        casesSnapshot.forEach(doc => {
          const data = doc.data();
          clientCases.push({
            id: doc.id,
            ...data
          });
        });

        // סינון לפי סטטוס (אם נדרש)
        if (this.options.showOnlyActive) {
          const beforeFilter = clientCases.length;
          clientCases = clientCases.filter(c => c.status === 'active');
          console.log(`  🔍 Filtered by status: ${beforeFilter} → ${clientCases.length} (active only)`);
        }

        // סינון לפי סוג (אם נדרש)
        if (this.options.filterByType) {
          const beforeFilter = clientCases.length;
          clientCases = clientCases.filter(c => c.procedureType === this.options.filterByType);
          console.log(`  🔍 Filtered by type: ${beforeFilter} → ${clientCases.length} (${this.options.filterByType} only)`);
        }

        this.clientCases = clientCases;
        console.log(`  ✅ Final cases count: ${clientCases.length}`);

        // בניית dropdown של תיקים
        console.log(`  🎨 Rendering case dropdown...`);
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
      console.log(`🎨 renderCaseDropdown called with ${this.clientCases.length} cases`);

      const caseSelect = document.getElementById(`${this.containerId}_caseSelect`);
      const caseGroup = document.getElementById(`${this.containerId}_caseGroup`);

      console.log(`  📍 Elements found:`, { caseSelect: !!caseSelect, caseGroup: !!caseGroup });

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

      console.log(`  ✅ Updated dropdown with ${this.clientCases.length} options`);

      // הצגת הקבוצה
      caseGroup.style.display = 'block';
      console.log(`  ✅ Case group displayed (display: ${caseGroup.style.display})`);

      // בחירה אוטומטית אם יש תיק אחד בלבד
      if (this.clientCases.length === 1) {
        console.log(`  🎯 Auto-selecting single case: ${this.clientCases[0].caseNumber}`);
        caseSelect.value = this.clientCases[0].id;
        this.selectCase(this.clientCases[0].id);
      }

      console.log(`  ✅ renderCaseDropdown completed`);
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

      // עדכון שדות נסתרים
      document.getElementById(`${this.containerId}_caseId`).value = caseItem.id;
      document.getElementById(`${this.containerId}_caseNumber`).value = caseItem.caseNumber || '';
      document.getElementById(`${this.containerId}_caseTitle`).value = caseItem.caseTitle || '';

      // הצגת מידע על התיק
      this.showCaseInfo(caseItem);

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
        caseData: this.selectedCase
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
     * איפוס הקומפוננטה
     */
    reset() {
      this.selectedClient = null;
      this.selectedCase = null;
      this.clientCases = [];

      const searchInput = document.getElementById(`${this.containerId}_clientSearch`);
      if (searchInput) searchInput.value = '';

      const caseGroup = document.getElementById(`${this.containerId}_caseGroup`);
      if (caseGroup) caseGroup.style.display = 'none';

      this.hideClientResults();
      this.hideCaseInfo();

      // איפוס שדות נסתרים
      ['clientId', 'clientName', 'caseId', 'caseNumber', 'caseTitle'].forEach(field => {
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

  console.log('✅ Client-Case Selector Module loaded');

})();
