/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GUIDED TEXT INPUT - Smart Description Input with Character Limit
 * קלט חכם לתיאור עבודה עם מגבלת תווים והצעות חכמות
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @version 1.0.0
 * @created 2025-12-15
 *
 * @features
 * - מגבלת תווים (80 ברירת מחדל)
 * - הצעות מהירות (Quick suggestions)
 * - למידה מהעבר (Recent items)
 * - השלמה אוטומטית (Autocomplete)
 * - עיצוב תואם למערכת הקיימת
 *
 * @architecture
 * - Standalone component - לא תלוי בקומפוננטות אחרות
 * - LocalStorage for persistence
 * - Event-based communication
 */

(function() {
  'use strict';

  /**
   * GuidedTextInput Class
   * קומפוננטה לקלט טקסט מונחה עם הגבלות והצעות
   */
  class GuidedTextInput {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.container = document.getElementById(containerId);

      if (!this.container) {
        throw new Error(`❌ GuidedTextInput: Container "${containerId}" not found`);
      }

      // Options with defaults
      this.options = {
        maxChars: 80,                    // מגבלת תווים
        placeholder: 'תאר את העבודה שביצעת...',
        required: true,
        showQuickSuggestions: true,      // הצגת הצעות מהירות
        showRecentItems: true,           // הצגת פריטים אחרונים
        enableAutocomplete: true,        // השלמה אוטומטית
        taskContext: null,               // הקשר המשימה (לניתוח חכם)
        ...options
      };

      // State
      this.state = {
        value: '',
        charCount: 0,
        selectedSuggestion: null,
        recentItems: [],
        quickSuggestions: []
      };

      // Storage key for recent items (per user)
      this.storageKey = 'guidedTextInput_recentItems';

      this.init();
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * INITIALIZATION
     * ════════════════════════════════════════════════════════════════════
     */

    async init() {
      console.log('🎯 Initializing GuidedTextInput:', this.containerId);

      // Load recent items from storage
      this.loadRecentItems();

      // Generate quick suggestions
      this.generateQuickSuggestions();

      // Render UI
      this.render();

      // Attach event listeners
      this.attachEventListeners();

      console.log('✅ GuidedTextInput initialized');
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * DATA MANAGEMENT
     * ════════════════════════════════════════════════════════════════════
     */

    /**
     * Load recent items from LocalStorage
     */
    loadRecentItems() {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          this.state.recentItems = JSON.parse(stored);
          console.log('📌 Loaded recent items:', this.state.recentItems.length);
        }
      } catch (error) {
        console.warn('⚠️ Error loading recent items:', error);
        this.state.recentItems = [];
      }
    }

    /**
     * Save recent items to LocalStorage
     */
    saveRecentItems() {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.state.recentItems));
      } catch (error) {
        console.warn('⚠️ Error saving recent items:', error);
      }
    }

    /**
     * Add item to recent items (max 5)
     */
    addToRecent(text) {
      // Don't add empty or very short texts
      if (!text || text.trim().length < 3) {
        return;
      }

      const trimmedText = text.trim();

      // Remove if already exists
      this.state.recentItems = this.state.recentItems.filter(item => item !== trimmedText);

      // Add to beginning
      this.state.recentItems.unshift(trimmedText);

      // Keep only 5 items
      this.state.recentItems = this.state.recentItems.slice(0, 5);

      // Save to storage
      this.saveRecentItems();
    }

    /**
     * Generate quick suggestions
     * הצעות מהירות - פשוטות וברורות
     */
    generateQuickSuggestions() {
      // ✅ הצעות בסיסיות - אוניברסליות לכל משימה
      this.state.quickSuggestions = [
        'שיחה עם לקוח',
        'מחקר פסיקה',
        'כתיבה',
        'עדכון מסמכים',
        'פגישה',
        'תיאום',
        'עיון בתיק'
      ];

      // TODO: בעתיד - ניתוח חכם של taskContext לסינון ההצעות
      // if (this.options.taskContext) {
      //   this.state.quickSuggestions = this.analyzeTaskContext(this.options.taskContext);
      // }
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * UI RENDERING
     * ════════════════════════════════════════════════════════════════════
     */

    /**
     * Render the complete UI
     */
    render() {
      this.container.innerHTML = this.buildHTML();
    }

    /**
     * Build HTML structure
     */
    buildHTML() {
      return `
        <div class="guided-text-input">
          <!-- Main Input Area -->
          <div class="guided-input-wrapper">
            <textarea
              id="${this.containerId}_input"
              class="guided-textarea"
              placeholder="${this.options.placeholder}"
              maxlength="${this.options.maxChars}"
              ${this.options.required ? 'required' : ''}
            ></textarea>
            <div class="guided-char-counter">
              <span class="char-count">0</span>/<span class="char-max">${this.options.maxChars}</span>
            </div>
          </div>

          <!-- Quick Suggestions -->
          ${this.options.showQuickSuggestions ? this.buildQuickSuggestionsHTML() : ''}

          <!-- Recent Items -->
          ${this.options.showRecentItems && this.state.recentItems.length > 0 ? this.buildRecentItemsHTML() : ''}

          <!-- Hidden input for form validation -->
          <input type="hidden" id="${this.containerId}_value" ${this.options.required ? 'required' : ''}>
        </div>
      `;
    }

    /**
     * Build Quick Suggestions HTML
     */
    buildQuickSuggestionsHTML() {
      if (this.state.quickSuggestions.length === 0) {
        return '';
      }

      return `
        <div class="guided-suggestions-section">
          <div class="guided-section-label">
            <i class="fas fa-lightbulb"></i>
            <span>הצעות מהירות</span>
          </div>
          <div class="guided-suggestions-grid">
            ${this.state.quickSuggestions.map((suggestion, index) => `
              <button
                type="button"
                class="guided-suggestion-btn"
                data-suggestion="${this.escapeHtml(suggestion)}"
                data-index="${index}"
              >
                ${this.escapeHtml(suggestion)}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    /**
     * Build Recent Items HTML
     */
    buildRecentItemsHTML() {
      return `
        <div class="guided-recent-section">
          <div class="guided-section-label">
            <i class="fas fa-history"></i>
            <span>השתמשת לאחרונה</span>
          </div>
          <div class="guided-recent-grid">
            ${this.state.recentItems.map((item, index) => `
              <button
                type="button"
                class="guided-recent-btn"
                data-recent="${this.escapeHtml(item)}"
                data-index="${index}"
              >
                <i class="fas fa-clock"></i>
                <span>${this.escapeHtml(item)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * EVENT HANDLERS
     * ════════════════════════════════════════════════════════════════════
     */

    /**
     * Attach event listeners
     */
    attachEventListeners() {
      const textarea = document.getElementById(`${this.containerId}_input`);
      if (!textarea) {
        console.error('❌ Textarea not found');
        return;
      }

      // Cache DOM references to avoid querySelector on every keystroke
      this._counterEl = this.container.querySelector('.char-count');
      this._textarea = textarea;

      // Input event - update character count
      textarea.addEventListener('input', (e) => this.handleInput(e));

      // Suggestion buttons
      const suggestionBtns = this.container.querySelectorAll('.guided-suggestion-btn');
      suggestionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => this.handleSuggestionClick(e));
      });

      // Recent buttons
      const recentBtns = this.container.querySelectorAll('.guided-recent-btn');
      recentBtns.forEach(btn => {
        btn.addEventListener('click', (e) => this.handleRecentClick(e));
      });
    }

    /**
     * Handle input event
     */
    handleInput(event) {
      const textarea = event.target;
      const value = textarea.value;
      const charCount = value.length;

      // Update state
      this.state.value = value;
      this.state.charCount = charCount;

      // Update UI counter
      this.updateCharCounter(charCount);

      // Update hidden input for validation
      const hiddenInput = document.getElementById(`${this.containerId}_value`);
      if (hiddenInput) {
        hiddenInput.value = value;
      }

      // Visual feedback when approaching limit
      if (charCount >= this.options.maxChars * 0.9) {
        textarea.classList.add('near-limit');
      } else {
        textarea.classList.remove('near-limit');
      }

      // Autocomplete suggestions (future feature)
      // if (this.options.enableAutocomplete && value.length >= 2) {
      //   this.showAutocompleteSuggestions(value);
      // }
    }

    /**
     * Handle suggestion button click
     */
    handleSuggestionClick(event) {
      const btn = event.currentTarget;
      const suggestion = btn.dataset.suggestion;

      if (!suggestion) {
return;
}

      // Set value
      this.setValue(suggestion);

      // Visual feedback
      btn.classList.add('selected');
      setTimeout(() => btn.classList.remove('selected'), 300);
    }

    /**
     * Handle recent button click
     */
    handleRecentClick(event) {
      const btn = event.currentTarget;
      const recent = btn.dataset.recent;

      if (!recent) {
return;
}

      // Set value
      this.setValue(recent);

      // Visual feedback
      btn.classList.add('selected');
      setTimeout(() => btn.classList.remove('selected'), 300);
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * PUBLIC API
     * ════════════════════════════════════════════════════════════════════
     */

    /**
     * Set value programmatically
     */
    setValue(value) {
      const textarea = document.getElementById(`${this.containerId}_input`);
      if (!textarea) {
return;
}

      // Truncate if exceeds limit
      const truncated = value.slice(0, this.options.maxChars);

      // Set value
      textarea.value = truncated;
      this.state.value = truncated;
      this.state.charCount = truncated.length;

      // Update counter
      this.updateCharCounter(truncated.length);

      // Update hidden input
      const hiddenInput = document.getElementById(`${this.containerId}_value`);
      if (hiddenInput) {
        hiddenInput.value = truncated;
      }

      // Focus
      textarea.focus();
    }

    /**
     * Get current value
     */
    getValue() {
      return this.state.value.trim();
    }

    /**
     * Validate input
     */
    validate() {
      const value = this.getValue();

      if (this.options.required && !value) {
        return {
          valid: false,
          error: 'נא להזין תיאור עבודה'
        };
      }

      if (value.length > this.options.maxChars) {
        return {
          valid: false,
          error: `תיאור ארוך מדי (מקסימום ${this.options.maxChars} תווים)`
        };
      }

      return { valid: true };
    }

    /**
     * Save value to recent items
     */
    saveToRecent() {
      const value = this.getValue();
      if (value) {
        this.addToRecent(value);
      }
    }

    /**
     * Clear input
     */
    clear() {
      this.setValue('');
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * HELPER METHODS
     * ════════════════════════════════════════════════════════════════════
     */

    /**
     * Update character counter UI
     */
    updateCharCounter(count) {
      const counterEl = this._counterEl;
      if (!counterEl) {
return;
}

      counterEl.textContent = count;

      // Color coding via CSS classes (avoids inline style reflow)
      const percentage = count / this.options.maxChars;
      counterEl.classList.toggle('char-danger', percentage >= 0.9);
      counterEl.classList.toggle('char-warning', percentage >= 0.7 && percentage < 0.9);
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
      if (text === null || text === undefined) {
return '';
}
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    /**
     * Cleanup
     */
    destroy() {
      // Save current value to recent before destroying
      this.saveToRecent();

      // Clear container
      if (this.container) {
        this.container.innerHTML = '';
      }

      console.log('✅ GuidedTextInput destroyed');
    }
  }

  // Export to global scope
  window.GuidedTextInput = GuidedTextInput;

  console.log('✅ GuidedTextInput module loaded');

})();
