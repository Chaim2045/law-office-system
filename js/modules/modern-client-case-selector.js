/**
 * Modern Client-Case Selector Component
 * גרסה מקצועית ומשודרגת של ClientCaseSelector
 *
 * @version 2.0.0
 * @created 2025-10-19
 *
 * תכונות:
 * - עצמאית לגמרי (אין תלויות חיצוניות)
 * - Fallback מובנה לכל פונקציה
 * - Error handling מלא
 * - תמיכה במערך הישן והחדש
 * - Progressive enhancement
 */

(function() {
  'use strict';

  // ===============================
  // Utility Functions (Built-in)
  // ===============================

  /**
   * Safe text escaping (prevents XSS)
   */
  function safeText(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Format date to Hebrew format
   */
  function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Generate unique ID
   */
  function generateId() {
    return `selector-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===============================
  // Main Component Class
  // ===============================

  class ModernClientCaseSelector {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.container = null;
      this.uniqueId = generateId();

      // Options
      this.options = {
        placeholder: options.placeholder || 'חפש לקוח...',
        casePlaceholder: options.casePlaceholder || 'בחר תיק...',
        showOnlyActive: options.showOnlyActive !== false, // default true
        filterByType: options.filterByType || null,
        onClientSelected: options.onClientSelected || null,
        onCaseSelected: options.onCaseSelected || null,
        required: options.required !== false, // default true
        allowEmpty: options.allowEmpty || false
      };

      // State
      this.selectedClient = null;
      this.selectedCase = null;
      this.allClients = [];
      this.clientCases = [];
      this.isLoading = false;

      console.log(`✅ ModernClientCaseSelector initialized: ${this.containerId}`);
    }

    /**
     * Render the component
     */
    render() {
      try {
        this.container = document.getElementById(this.containerId);

        if (!this.container) {
          console.error(`❌ Container not found: ${this.containerId}`);
          return false;
        }

        const html = `
          <div class="modern-selector-wrapper" data-selector-id="${this.uniqueId}">
            <!-- Step 1: Client Search -->
            <div class="modern-selector-step" data-step="client">
              <label class="modern-selector-label">
                <i class="fas fa-user"></i>
                בחר לקוח
                ${this.options.required ? '<span class="required">*</span>' : ''}
              </label>
              <div class="modern-search-box">
                <input
                  type="text"
                  class="modern-search-input"
                  id="${this.uniqueId}-client-search"
                  placeholder="${this.options.placeholder}"
                  autocomplete="off"
                  ${this.options.required ? 'required' : ''}
                />
                <i class="fas fa-search search-icon"></i>
              </div>
              <div class="modern-search-results" id="${this.uniqueId}-client-results"></div>
              <input type="hidden" id="${this.uniqueId}-client-id" />
              <input type="hidden" id="${this.uniqueId}-client-name" />
            </div>

            <!-- Step 2: Case Selection -->
            <div class="modern-selector-step hidden" data-step="case">
              <label class="modern-selector-label">
                <i class="fas fa-folder-open"></i>
                בחר תיק
                ${this.options.required ? '<span class="required">*</span>' : ''}
              </label>
              <select
                class="modern-case-select"
                id="${this.uniqueId}-case-select"
                ${this.options.required ? 'required' : ''}
              >
                <option value="">${this.options.casePlaceholder}</option>
              </select>
              <input type="hidden" id="${this.uniqueId}-case-id" />
              <input type="hidden" id="${this.uniqueId}-case-number" />
              <input type="hidden" id="${this.uniqueId}-case-title" />
            </div>

            <!-- Selected Info Display -->
            <div class="modern-selector-info hidden" id="${this.uniqueId}-info"></div>
          </div>
        `;

        this.container.innerHTML = html;
        this.attachEventListeners();

        console.log(`✅ ModernClientCaseSelector rendered: ${this.containerId}`);
        return true;
      } catch (error) {
        console.error('❌ Error rendering ModernClientCaseSelector:', error);
        return false;
      }
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
      try {
        // Client search input
        const searchInput = document.getElementById(`${this.uniqueId}-client-search`);
        if (searchInput) {
          searchInput.addEventListener('input', (e) => this.handleClientSearch(e.target.value));
          searchInput.addEventListener('focus', () => {
            if (searchInput.value.length >= 1) {
              this.handleClientSearch(searchInput.value);
            }
          });
        }

        // Case select
        const caseSelect = document.getElementById(`${this.uniqueId}-case-select`);
        if (caseSelect) {
          caseSelect.addEventListener('change', (e) => this.handleCaseSelection(e.target.value));
        }

        // Click outside to close results
        document.addEventListener('click', (e) => {
          const resultsContainer = document.getElementById(`${this.uniqueId}-client-results`);
          if (resultsContainer && !e.target.closest('.modern-search-box') && !e.target.closest('.modern-search-results')) {
            resultsContainer.style.display = 'none';
          }
        });

        console.log(`✅ Event listeners attached: ${this.uniqueId}`);
      } catch (error) {
        console.error('❌ Error attaching event listeners:', error);
      }
    }

    /**
     * Handle client search
     */
    async handleClientSearch(query) {
      try {
        const resultsContainer = document.getElementById(`${this.uniqueId}-client-results`);

        if (!query || query.length < 1) {
          resultsContainer.style.display = 'none';
          return;
        }

        resultsContainer.innerHTML = '<div class="search-loading">טוען...</div>';
        resultsContainer.style.display = 'block';

        // Load clients if not already loaded
        if (this.allClients.length === 0) {
          await this.loadClients();
        }

        // Filter clients
        const searchLower = query.toLowerCase();
        const matches = this.allClients.filter(client => {
          const searchText = `${client.fullName || ''} ${client.phone || ''} ${client.id || ''}`.toLowerCase();
          return searchText.includes(searchLower);
        });

        // Render results
        if (matches.length === 0) {
          resultsContainer.innerHTML = `
            <div class="search-no-results">
              <i class="fas fa-search"></i>
              <span>לא נמצאו לקוחות</span>
            </div>
          `;
          return;
        }

        const resultsHtml = matches.slice(0, 8).map(client => `
          <div class="search-result-item" onclick="window.modernSelectorInstance_${this.uniqueId}.selectClient('${client.id}', '${safeText(client.fullName)}')">
            <div class="result-main">
              <i class="fas fa-user"></i>
              <strong>${safeText(client.fullName)}</strong>
            </div>
            <div class="result-meta">
              ${client.phone ? `<span><i class="fas fa-phone"></i> ${safeText(client.phone)}</span>` : ''}
              ${client.casesCount ? `<span><i class="fas fa-folder"></i> ${client.casesCount} תיקים</span>` : ''}
            </div>
          </div>
        `).join('');

        resultsContainer.innerHTML = resultsHtml;
      } catch (error) {
        console.error('❌ Error in client search:', error);
        const resultsContainer = document.getElementById(`${this.uniqueId}-client-results`);
        if (resultsContainer) {
          resultsContainer.innerHTML = '<div class="search-error">שגיאה בטעינה</div>';
        }
      }
    }

    /**
     * Load clients from Firebase
     */
    async loadClients() {
      try {
        const db = window.firebaseDB;
        if (!db) {
          throw new Error('Firebase not connected');
        }

        console.log('📊 Loading clients...');

        // Load clients and cases in parallel
        const [clientsSnapshot, casesSnapshot] = await Promise.all([
          db.collection('clients').get(),
          db.collection('cases').get()
        ]);

        // Build clients map
        const clientsMap = new Map();

        // Add clients from clients collection
        clientsSnapshot.forEach(doc => {
          const data = doc.data();
          clientsMap.set(doc.id, {
            id: doc.id,
            fullName: data.fullName || data.clientName || 'לקוח ללא שם',
            phone: data.phone || '',
            source: 'clients',
            casesCount: 0
          });
        });

        // Count cases per client
        casesSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.clientId && clientsMap.has(data.clientId)) {
            clientsMap.get(data.clientId).casesCount++;
          }
        });

        this.allClients = Array.from(clientsMap.values());
        console.log(`✅ Loaded ${this.allClients.length} clients`);

        return this.allClients;
      } catch (error) {
        console.error('❌ Error loading clients:', error);
        return [];
      }
    }

    /**
     * Select a client
     */
    async selectClient(clientId, clientName) {
      try {
        console.log(`🎯 Client selected: ${clientName} (${clientId})`);

        this.selectedClient = { id: clientId, name: clientName };

        // Update UI
        const searchInput = document.getElementById(`${this.uniqueId}-client-search`);
        const resultsContainer = document.getElementById(`${this.uniqueId}-client-results`);
        const clientIdInput = document.getElementById(`${this.uniqueId}-client-id`);
        const clientNameInput = document.getElementById(`${this.uniqueId}-client-name`);

        if (searchInput) searchInput.value = clientName;
        if (resultsContainer) resultsContainer.style.display = 'none';
        if (clientIdInput) clientIdInput.value = clientId;
        if (clientNameInput) clientNameInput.value = clientName;

        // Callback
        if (this.options.onClientSelected) {
          this.options.onClientSelected(this.selectedClient);
        }

        // Load cases for this client
        await this.loadClientCases(clientId);

      } catch (error) {
        console.error('❌ Error selecting client:', error);
      }
    }

    /**
     * Load cases for a specific client
     */
    async loadClientCases(clientId) {
      try {
        console.log(`📂 Loading cases for client: ${clientId}`);

        const db = window.firebaseDB;
        if (!db) {
          throw new Error('Firebase not connected');
        }

        const casesSnapshot = await db.collection('cases')
          .where('clientId', '==', clientId)
          .get();

        let cases = [];
        casesSnapshot.forEach(doc => {
          cases.push({
            id: doc.id,
            ...doc.data()
          });
        });

        // Filter by status
        if (this.options.showOnlyActive) {
          cases = cases.filter(c => c.status === 'active');
        }

        // Filter by type
        if (this.options.filterByType) {
          cases = cases.filter(c => c.procedureType === this.options.filterByType);
        }

        this.clientCases = cases;
        console.log(`✅ Loaded ${cases.length} cases`);

        // Show case selection step
        this.renderCaseSelection();

      } catch (error) {
        console.error('❌ Error loading cases:', error);
        this.clientCases = [];
      }
    }

    /**
     * Render case selection dropdown
     */
    renderCaseSelection() {
      try {
        const caseStep = document.querySelector(`[data-selector-id="${this.uniqueId}"] [data-step="case"]`);
        const caseSelect = document.getElementById(`${this.uniqueId}-case-select`);

        if (!caseStep || !caseSelect) {
          console.error('❌ Case selection elements not found');
          return;
        }

        // Show the step
        caseStep.classList.remove('hidden');

        // Populate options
        if (this.clientCases.length === 0) {
          caseSelect.innerHTML = '<option value="">אין תיקים פעילים</option>';
          return;
        }

        const optionsHtml = this.clientCases.map(caseItem => {
          const icon = caseItem.procedureType === 'hours' ? '⏱️' : '⚖️';
          const title = caseItem.caseTitle || caseItem.caseNumber || 'תיק ללא שם';
          return `<option value="${caseItem.id}">${icon} ${caseItem.caseNumber || ''} - ${safeText(title)}</option>`;
        }).join('');

        caseSelect.innerHTML = `
          <option value="">${this.options.casePlaceholder}</option>
          ${optionsHtml}
        `;

        console.log(`✅ Case selection rendered: ${this.clientCases.length} cases`);
      } catch (error) {
        console.error('❌ Error rendering case selection:', error);
      }
    }

    /**
     * Handle case selection
     */
    handleCaseSelection(caseId) {
      try {
        if (!caseId) {
          this.selectedCase = null;
          return;
        }

        const caseData = this.clientCases.find(c => c.id === caseId);
        if (!caseData) {
          console.error('❌ Case not found:', caseId);
          return;
        }

        this.selectedCase = caseData;

        // Update hidden inputs
        const caseIdInput = document.getElementById(`${this.uniqueId}-case-id`);
        const caseNumberInput = document.getElementById(`${this.uniqueId}-case-number`);
        const caseTitleInput = document.getElementById(`${this.uniqueId}-case-title`);

        if (caseIdInput) caseIdInput.value = caseData.id;
        if (caseNumberInput) caseNumberInput.value = caseData.caseNumber || '';
        if (caseTitleInput) caseTitleInput.value = caseData.caseTitle || '';

        // Show info
        this.showSelectionInfo();

        // Callback
        if (this.options.onCaseSelected) {
          this.options.onCaseSelected(caseData);
        }

        console.log(`✅ Case selected:`, caseData);
      } catch (error) {
        console.error('❌ Error selecting case:', error);
      }
    }

    /**
     * Show selection info
     */
    showSelectionInfo() {
      const infoContainer = document.getElementById(`${this.uniqueId}-info`);
      if (!infoContainer || !this.selectedClient || !this.selectedCase) return;

      infoContainer.innerHTML = `
        <div class="selection-summary">
          <i class="fas fa-check-circle"></i>
          <span>${safeText(this.selectedClient.name)} → ${safeText(this.selectedCase.caseNumber || this.selectedCase.caseTitle)}</span>
        </div>
      `;
      infoContainer.classList.remove('hidden');
    }

    /**
     * Get selected values
     */
    getSelectedValues() {
      if (!this.selectedClient || !this.selectedCase) {
        return null;
      }

      return {
        clientId: this.selectedClient.id,
        clientName: this.selectedClient.name,
        caseId: this.selectedCase.id,
        caseNumber: this.selectedCase.caseNumber || '',
        caseTitle: this.selectedCase.caseTitle || '',
        caseData: this.selectedCase
      };
    }

    /**
     * Validate selection
     */
    validate() {
      const values = this.getSelectedValues();

      if (this.options.required && !values) {
        return {
          isValid: false,
          message: 'חובה לבחור לקוח ותיק'
        };
      }

      return {
        isValid: true,
        values: values
      };
    }

    /**
     * Clear/Reset the selector
     */
    clear() {
      try {
        this.selectedClient = null;
        this.selectedCase = null;
        this.clientCases = [];

        // Clear inputs
        const searchInput = document.getElementById(`${this.uniqueId}-client-search`);
        const resultsContainer = document.getElementById(`${this.uniqueId}-client-results`);
        const caseStep = document.querySelector(`[data-selector-id="${this.uniqueId}"] [data-step="case"]`);
        const infoContainer = document.getElementById(`${this.uniqueId}-info`);

        if (searchInput) searchInput.value = '';
        if (resultsContainer) resultsContainer.style.display = 'none';
        if (caseStep) caseStep.classList.add('hidden');
        if (infoContainer) infoContainer.classList.add('hidden');

        // Clear all hidden inputs
        ['client-id', 'client-name', 'case-id', 'case-number', 'case-title'].forEach(field => {
          const input = document.getElementById(`${this.uniqueId}-${field}`);
          if (input) input.value = '';
        });

        console.log(`✅ Selector cleared: ${this.uniqueId}`);
      } catch (error) {
        console.error('❌ Error clearing selector:', error);
      }
    }

    /**
     * Destroy the selector
     */
    destroy() {
      if (this.container) {
        this.container.innerHTML = '';
      }
      delete window[`modernSelectorInstance_${this.uniqueId}`];
      console.log(`✅ Selector destroyed: ${this.uniqueId}`);
    }
  }

  // ===============================
  // Global Export
  // ===============================

  window.ModernClientCaseSelector = ModernClientCaseSelector;

  console.log('✅ ModernClientCaseSelector loaded successfully');

})();
