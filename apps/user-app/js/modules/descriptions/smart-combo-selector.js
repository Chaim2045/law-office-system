/**
 * ═══════════════════════════════════════════════════════════════════════
 * SMART COMBO SELECTOR - MODE-BASED ARCHITECTURE
 * קומפוננט UI לבחירת תיאור עבודה - ארכיטקטורה מופרדת לפי מצבים
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Architecture:
 * - Mode determined ONCE at initialization (immutable)
 * - Separate render/event methods per mode (no if/else in logic)
 * - No conditional buttons - each mode has its own complete UI
 *
 * Modes:
 * 1. DIRECT - Task has fixed category, show only items from that category
 * 2. FREE   - No restrictions, show all categories and items
 *
 * @version 4.0.0 - Clean Mode-Based Architecture
 * @created 2025-12-12
 */

(function() {
  'use strict';

  class SmartComboSelector {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.container = document.getElementById(containerId);

      if (!this.container) {
        throw new Error(`❌ SmartComboSelector: Container "${containerId}" not found`);
      }

      this.options = {
        placeholder: 'בחר תיאור עבודה...',
        required: true,
        taskId: null,
        task: null,
        contextAware: true,
        suggestLastUsed: true,
        autoSelectSuggestion: false,
        ...options
      };

      this.manager = window.DescriptionsManager;

      if (!this.manager) {
        throw new Error('❌ DescriptionsManager not found');
      }

      // State
      this.state = {
        selectedCategory: null,
        selectedItem: null,
        suggestedItem: null,
        filteredData: null,
        showSuggestionBanner: false
      };

      // Mode will be determined after loading context
      this.mode = null;

      this.init();
    }

    async init() {
      Logger.log(`🎯 Initializing SmartComboSelector: ${this.containerId}`);

      // Load context first (if applicable)
      if (this.options.taskId && this.options.contextAware) {
        await this.loadContext();
      }

      // Determine mode ONCE (immutable)
      this.mode = this._determineMode();
      Logger.log(`🎯 Mode: ${this.mode}`);

      // Load suggestions
      if (this.options.taskId && this.options.suggestLastUsed) {
        await this.loadSuggestion();
      }

      this.render();
      this.attachEventListeners();

      Logger.log(`✅ SmartComboSelector initialized (mode: ${this.mode})`);
    }

    /**
     * Determine mode ONCE based on context
     * This mode is IMMUTABLE - never changes during component lifetime
     */
    _determineMode() {
      if (this.state.filteredData?.isError) {
        return 'ERROR';
      }

      if (this.options.contextAware && this.state.filteredData?.isFiltered) {
        return 'DIRECT';
      }

      return 'FREE';
    }

    async loadContext() {
      this.state.filteredData = await this.manager.getItemsForTask(
        this.options.taskId,
        this.options.task
      );

      if (this.state.filteredData.isError) {
        Logger.log(`❌ Context error: ${this.state.filteredData.errorMessage}`);
        return;
      }

      if (this.state.filteredData.isFiltered) {
        this.state.selectedCategory = this.state.filteredData.categoryId;
        Logger.log(`✅ Context loaded: ${this.state.filteredData.categoryName}`);
      }
    }

    async loadSuggestion() {
      const suggestion = this.manager.getLastUsedForTask(this.options.taskId);

      if (suggestion.suggested) {
        this.state.suggestedItem = suggestion;
        this.state.showSuggestionBanner = true;
        Logger.log(`💡 Suggestion: ${suggestion.itemText || suggestion.fullText} (${suggestion.confidence})`);

        if (this.options.autoSelectSuggestion && suggestion.confidence === 'high') {
          this.acceptSuggestion();
        }
      }
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * RENDERING - MODE DISPATCHER
     * ════════════════════════════════════════════════════════════════════
     */

    render() {
      if (this.mode === 'ERROR') {
        this._renderErrorMode();
      } else if (this.mode === 'DIRECT') {
        this._renderDirectMode();
      } else {
        this._renderFreeMode();
      }
    }

    /**
     * ERROR MODE - Show error message
     */
    _renderErrorMode() {
      const { errorMessage } = this.state.filteredData;

      this.container.innerHTML = `
        <div class="smart-combo-selector-inline">
          <div class="inline-error-banner">
            <div class="inline-error-content">
              <i class="fas fa-exclamation-triangle"></i>
              <span>${errorMessage}</span>
            </div>
          </div>
        </div>
      `;
    }

    /**
     * DIRECT MODE - Fixed category, show only items
     * No category selection, no "show all", no "clear"
     */
    _renderDirectMode() {
      this.container.innerHTML = `
        <div class="smart-combo-selector-inline">
          ${this._renderSuggestionBanner()}
          ${this._renderSelectedItemDisplay()}
          ${this._renderCategoryHeader()}
          ${this._renderDirectItems()}
        </div>
      `;
    }

    /**
     * FREE MODE - Full category and item selection
     * All features enabled
     */
    _renderFreeMode() {
      this.container.innerHTML = `
        <div class="smart-combo-selector-inline">
          ${this._renderSuggestionBanner()}
          ${this._renderSelectedItemDisplayWithClear()}
          ${this._renderCategories()}
          ${this._renderFreeItems()}
        </div>
      `;
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * RENDERING - COMMON COMPONENTS
     * ════════════════════════════════════════════════════════════════════
     */

    _renderSuggestionBanner() {
      if (!this.state.showSuggestionBanner || !this.state.suggestedItem) {
        return '';
      }

      const { suggestedItem } = this.state;
      const displayText = suggestedItem.itemText || suggestedItem.fullText;

      return `
        <div class="inline-suggestion-banner">
          <div class="inline-suggestion-content">
            <i class="fas fa-lightbulb"></i>
            <span>בפעם הקודמת: <strong>${displayText}</strong></span>
          </div>
          <div class="inline-suggestion-actions">
            <button class="btn-accept-suggestion" data-action="accept-suggestion" type="button">
              <i class="fas fa-check"></i> אישור
            </button>
            <button class="btn-reject-suggestion" data-action="reject-suggestion" type="button">
              <i class="fas fa-times"></i> בחר אחר
            </button>
          </div>
        </div>
      `;
    }

    /**
     * DIRECT MODE - Selected display WITH "change item" button
     * Allows user to select a different item from the same category
     */
    _renderSelectedItemDisplay() {
      if (!this.state.selectedCategory || !this.state.selectedItem) {
        return '';
      }

      const category = window.WorkCategories.getCategoryById(this.state.selectedCategory);
      const item = window.WorkCategories.getItemById(this.state.selectedCategory, this.state.selectedItem);

      if (!category || !item) {
return '';
}

      return `
        <div class="inline-selected-display">
          <div class="inline-selected-content">
            <i class="fas ${category.icon}"></i>
            <span class="inline-selected-category">${category.name}</span>
            <span class="inline-selected-separator">•</span>
            <span class="inline-selected-item">${item.text}</span>
          </div>
          <button class="inline-selected-clear" data-action="change-item" type="button">
            <i class="fas fa-sync-alt"></i>
            בחר אחר
          </button>
        </div>
      `;
    }

    /**
     * FREE MODE - Selected display WITH clear button
     */
    _renderSelectedItemDisplayWithClear() {
      if (!this.state.selectedCategory || !this.state.selectedItem) {
        return '';
      }

      const category = window.WorkCategories.getCategoryById(this.state.selectedCategory);
      const item = window.WorkCategories.getItemById(this.state.selectedCategory, this.state.selectedItem);

      if (!category || !item) {
return '';
}

      return `
        <div class="inline-selected-display">
          <div class="inline-selected-content">
            <i class="fas ${category.icon}"></i>
            <span class="inline-selected-category">${category.name}</span>
            <span class="inline-selected-separator">•</span>
            <span class="inline-selected-item">${item.text}</span>
          </div>
          <button class="inline-selected-clear" data-action="clear" type="button">
            <i class="fas fa-times"></i>
            נקה
          </button>
        </div>
      `;
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * RENDERING - DIRECT MODE COMPONENTS
     * ════════════════════════════════════════════════════════════════════
     */

    _renderCategoryHeader() {
      if (!this.state.selectedCategory) {
        return '';
      }

      const category = window.WorkCategories.getCategoryById(this.state.selectedCategory);
      if (!category) {
return '';
}

      return `
        <div class="inline-category-header">
          <div class="inline-category-header-label">
            <i class="fas ${category.icon}"></i>
            <span>${category.name}</span>
          </div>
        </div>
      `;
    }

    _renderDirectItems() {
      // Don't show items if:
      // 1. No category selected
      // 2. Item already selected
      // 3. Suggestion banner is showing (user should choose "accept" or "reject" first)
      if (!this.state.selectedCategory || this.state.selectedItem || this.state.showSuggestionBanner) {
        return '';
      }

      const category = {
        id: this.state.filteredData.categoryId,
        name: this.state.filteredData.categoryName,
        icon: this.state.filteredData.categoryIcon
      };
      const items = this.state.filteredData.items;

      return `
        <div class="inline-items-section">
          <div class="inline-tags-container">
            ${items.sort((a, b) => a.order - b.order).map(item => `
              <div class="inline-item-tag" data-item="${item.id}">
                <span class="inline-tag-text">${item.text}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * RENDERING - FREE MODE COMPONENTS
     * ════════════════════════════════════════════════════════════════════
     */

    _renderCategories() {
      if (this.state.selectedItem) {
        return '';
      }

      const categories = window.WorkCategories.getAllCategories();
      const recentItems = this.manager.getRecentItems();

      return `
        <div class="inline-categories-section">
          ${recentItems.length > 0 ? this._renderRecentItems(recentItems) : ''}

          <div class="inline-section-label">
            <i class="fas fa-folder"></i>
            <span>בחר קטגוריה:</span>
          </div>

          <div class="inline-tags-container">
            ${categories.map(cat => `
              <div class="inline-category-tag ${this.state.selectedCategory === cat.id ? 'active' : ''}"
                   data-category="${cat.id}">
                <i class="fas ${cat.icon}"></i>
                <span class="inline-tag-text">${cat.name}</span>
                <span class="inline-tag-count">(${cat.items.length})</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    _renderRecentItems(items) {
      return `
        <div class="inline-recent-section">
          <div class="inline-section-label">
            <i class="fas fa-history"></i>
            <span>אחרונים:</span>
          </div>
          <div class="inline-tags-container">
            ${items.map(item => `
              <div class="inline-recent-tag"
                   data-category="${item.categoryId}"
                   data-item="${item.itemId}">
                <i class="fas fa-clock"></i>
                <span class="inline-tag-text">${item.categoryName} • ${item.itemText}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    _renderFreeItems() {
      if (!this.state.selectedCategory || this.state.selectedItem) {
        return '';
      }

      const category = window.WorkCategories.getCategoryById(this.state.selectedCategory);
      if (!category) {
return '';
}

      const items = category.items;

      return `
        <div class="inline-items-section">
          <div class="inline-section-label">
            <i class="fas ${category.icon}"></i>
            <span>בחר ${category.name}:</span>
            <button class="inline-clear-category-btn" data-action="clear-category" type="button">
              <i class="fas fa-arrow-right"></i>
              חזור
            </button>
          </div>

          <div class="inline-tags-container">
            ${items.sort((a, b) => a.order - b.order).map(item => `
              <div class="inline-item-tag" data-item="${item.id}">
                <span class="inline-tag-text">${item.text}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * EVENT HANDLING
     * ════════════════════════════════════════════════════════════════════
     */

    attachEventListeners() {
      this.container.addEventListener('click', (e) => {
        this.handleClick(e);
      });
    }

    handleClick(e) {
      const target = e.target.closest('[data-action], [data-category], [data-item]');
      if (!target) {
return;
}

      const action = target.dataset.action;

      if (action === 'accept-suggestion') {
        this.acceptSuggestion();
      } else if (action === 'reject-suggestion') {
        this.rejectSuggestion();
      } else if (action === 'clear') {
        this.clear();
      } else if (action === 'clear-category') {
        this.clearCategory();
      } else if (action === 'change-item') {
        this.changeItem();
      } else if (target.dataset.category && target.dataset.item) {
        this.selectItem(target.dataset.category, target.dataset.item);
      } else if (target.dataset.category) {
        this.selectCategory(target.dataset.category);
      } else if (target.dataset.item) {
        this.selectItem(this.state.selectedCategory, target.dataset.item);
      }
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * ACTIONS
     * ════════════════════════════════════════════════════════════════════
     */

    acceptSuggestion() {
      const { suggestedItem } = this.state;
      if (!suggestedItem) {
return;
}

      this.state.selectedCategory = suggestedItem.categoryId;
      this.state.selectedItem = suggestedItem.itemId;
      this.state.showSuggestionBanner = false;

      this.manager.saveSelection(
        this.options.taskId,
        suggestedItem.categoryId,
        suggestedItem.itemId
      );

      this.updateHiddenInputs();
      this.emitChangeEvent();
      this.render();
      this.attachEventListeners();

      Logger.log(`✅ Suggestion accepted: ${suggestedItem.itemText || suggestedItem.fullText}`);
    }

    rejectSuggestion() {
      this.state.showSuggestionBanner = false;

      // In DIRECT mode, restore category after rejection
      if (this.mode === 'DIRECT') {
        this.state.selectedCategory = this.state.filteredData.categoryId;
        Logger.log(`✅ Restored category: ${this.state.filteredData.categoryId}`);
      }

      this.render();
      this.attachEventListeners();
      Logger.log('❌ Suggestion rejected');
    }

    selectCategory(categoryId) {
      this.state.selectedCategory = categoryId;
      this.render();
      this.attachEventListeners();
      Logger.log(`📂 Category selected: ${categoryId}`);
    }

    selectItem(categoryId, itemId) {
      this.state.selectedCategory = categoryId;
      this.state.selectedItem = itemId;

      this.manager.saveSelection(this.options.taskId, categoryId, itemId);

      this.updateHiddenInputs();
      this.emitChangeEvent();
      this.render();
      this.attachEventListeners();

      const fullDesc = window.WorkCategories.getFullDescription(categoryId, itemId);
      Logger.log(`✅ Item selected: ${fullDesc}`);
    }

    clearCategory() {
      this.state.selectedCategory = null;
      this.render();
      this.attachEventListeners();
      Logger.log('🔙 Returned to categories');
    }

    changeItem() {
      // Clear only the selected item, keep the category
      // Used in DIRECT mode to allow selecting a different item from the same category
      this.state.selectedItem = null;
      this.updateHiddenInputs();
      this.emitChangeEvent();
      this.render();
      this.attachEventListeners();
      Logger.log('🔄 Changed item selection (category preserved)');
    }

    clear() {
      this.state.selectedCategory = null;
      this.state.selectedItem = null;
      this.updateHiddenInputs();
      this.emitChangeEvent();
      this.render();
      this.attachEventListeners();
      Logger.log('🗑️ Selection cleared');
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * DATA MANAGEMENT
     * ════════════════════════════════════════════════════════════════════
     */

    updateHiddenInputs() {
      const descriptionInput = document.getElementById(
        this.containerId.replace('Selector', '')
      );
      const categoryInput = document.getElementById(
        this.containerId.replace('Selector', 'Category')
      );

      if (descriptionInput) {
        descriptionInput.value = this.getFullDescription();
      }

      if (categoryInput) {
        categoryInput.value = this.state.selectedCategory || '';
      }
    }

    getFullDescription() {
      if (!this.state.selectedCategory || !this.state.selectedItem) {
        return '';
      }

      return window.WorkCategories.getFullDescription(
        this.state.selectedCategory,
        this.state.selectedItem
      );
    }

    emitChangeEvent() {
      if (window.EventBus) {
        window.EventBus.emit('description:changed', {
          containerId: this.containerId,
          taskId: this.options.taskId,
          categoryId: this.state.selectedCategory,
          itemId: this.state.selectedItem,
          fullDescription: this.getFullDescription()
        });
      }
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * PUBLIC API
     * ════════════════════════════════════════════════════════════════════
     */

    validate() {
      if (this.options.required && (!this.state.selectedCategory || !this.state.selectedItem)) {
        return {
          isValid: false,
          error: 'יש לבחור תיאור עבודה'
        };
      }

      return { isValid: true };
    }

    getValues() {
      return {
        categoryId: this.state.selectedCategory,
        itemId: this.state.selectedItem,
        fullDescription: this.getFullDescription()
      };
    }

    reset() {
      this.clear();
    }
  }

  // Export to global scope
  window.SmartComboSelector = SmartComboSelector;

  Logger.log('✅ SmartComboSelector v4.0.0 loaded (Mode-Based Architecture)');

})();
