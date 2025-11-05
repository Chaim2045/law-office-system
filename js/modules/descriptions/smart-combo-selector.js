/**
 * ═══════════════════════════════════════════════════════════════════════
 * SMART COMBO SELECTOR - INLINE EXPANSION UI
 * קומפוננט UI לבחירת תיאור עבודה - Inline Linear Tags
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Features:
 * - Inline expansion (no dropdowns!)
 * - Linear horizontal tags for categories and items
 * - Context-aware filtering with DIRECT ITEMS MODE
 * - Last-used intelligence
 * - Recent items (only in time dialog, not in budget form)
 *
 * @version 3.4.0 - Error-Proof Validation + Category Boundaries
 * @created 2025-01-04
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

      this.init();
    }

    async init() {
      Logger.log(`🎯 Initializing SmartComboSelector (v3.2): ${this.containerId}`);

      // Context-aware filtering
      if (this.options.taskId && this.options.contextAware) {
        await this.loadContext();
      }

      // Last-used suggestions
      if (this.options.taskId && this.options.suggestLastUsed) {
        await this.loadSuggestion();
      }

      this.render();
      this.attachEventListeners();

      Logger.log(`✅ SmartComboSelector initialized (Direct Items: ${this.isDirectItemsMode()})`);
    }

    async loadContext() {
      this.state.filteredData = await this.manager.getItemsForTask(
        this.options.taskId,
        this.options.task
      );

      // ✅ Handle error state
      if (this.state.filteredData.isError) {
        Logger.log(`❌ Context error: ${this.state.filteredData.errorMessage}`);
        return; // Don't auto-select, show error instead
      }

      if (this.state.filteredData.isFiltered) {
        // ✅ AUTO-SELECT category for direct items mode
        this.state.selectedCategory = this.state.filteredData.categoryId;
        Logger.log(`✅ Context loaded (Direct Items): ${this.state.filteredData.reason}`);
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
     * DIRECT ITEMS MODE
     * ════════════════════════════════════════════════════════════════════
     */

    /**
     * Check if we're in "direct items mode"
     * - Context-aware enabled
     * - Task ID provided
     * - Category already selected (from context)
     * - Item NOT yet selected
     */
    isDirectItemsMode() {
      return this.options.contextAware &&
             this.state.selectedCategory &&
             this.state.filteredData?.isFiltered &&
             !this.state.selectedItem;
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * RENDERING - INLINE UI
     * ════════════════════════════════════════════════════════════════════
     */

    render() {
      // ✅ ERROR STATE: Show error message
      if (this.state.filteredData?.isError) {
        this.container.innerHTML = `
          <div class="smart-combo-selector-inline">
            ${this.renderErrorState()}
          </div>
        `;
        return;
      }

      if (this.isDirectItemsMode()) {
        // ✅ DIRECT ITEMS MODE: Show items immediately, no category selection
        this.container.innerHTML = `
          <div class="smart-combo-selector-inline">
            ${this.renderSuggestionBanner()}
            ${this.renderSelectedDisplay()}
            ${this.renderCategoryHeader()}
            ${this.renderInlineItems()}
          </div>
        `;
      } else {
        // ✅ NORMAL MODE: Show categories first, then items
        this.container.innerHTML = `
          <div class="smart-combo-selector-inline">
            ${this.renderSuggestionBanner()}
            ${this.renderSelectedDisplay()}
            ${this.renderInlineCategories()}
            ${this.renderInlineItems()}
          </div>
        `;
      }
    }

    /**
     * ✅ NEW: Render error state when task has no valid category
     */
    renderErrorState() {
      const { errorMessage } = this.state.filteredData;

      return `
        <div class="inline-error-banner">
          <div class="inline-error-content">
            <i class="fas fa-exclamation-triangle"></i>
            <span>${errorMessage}</span>
          </div>
        </div>
      `;
    }

    renderSuggestionBanner() {
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

    renderSelectedDisplay() {
      if (!this.state.selectedCategory || !this.state.selectedItem) {
        return '';
      }

      const category = window.WorkCategories.getCategoryById(this.state.selectedCategory);
      const item = window.WorkCategories.getItemById(this.state.selectedCategory, this.state.selectedItem);

      if (!category || !item) return '';

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
     * ✅ NEW: Category Header (for Direct Items Mode)
     * Shows the category name as a non-clickable header
     */
    renderCategoryHeader() {
      if (!this.state.selectedCategory) {
        return '';
      }

      const category = window.WorkCategories.getCategoryById(this.state.selectedCategory);
      if (!category) return '';

      return `
        <div class="inline-category-header">
          <div class="inline-category-header-label">
            <i class="fas ${category.icon}" ></i>
            <span>${category.name}</span>
          </div>
        </div>
      `;
    }

    renderInlineCategories() {
      // Don't show categories if item already selected OR in direct items mode
      if (this.state.selectedItem || this.isDirectItemsMode()) {
        return '';
      }

      // If context filtering is active, show context banner instead
      if (this.state.filteredData && this.state.filteredData.isFiltered) {
        return this.renderContextBanner();
      }

      const categories = window.WorkCategories.getAllCategories();
      const recentItems = this.manager.getRecentItems();

      return `
        <div class="inline-categories-section">
          ${recentItems.length > 0 && this.options.contextAware ? this.renderRecentItems(recentItems) : ''}

          <div class="inline-section-label">
            <i class="fas fa-folder"></i>
            <span>בחר קטגוריה:</span>
          </div>

          <div class="inline-tags-container">
            ${categories.map(cat => `
              <div class="inline-category-tag ${this.state.selectedCategory === cat.id ? 'active' : ''}"
                   data-category="${cat.id}">
                <i class="fas ${cat.icon}" ></i>
                <span class="inline-tag-text">${cat.name}</span>
                <span class="inline-tag-count">(${cat.items.length})</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    renderRecentItems(items) {
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

    renderContextBanner() {
      const { categoryName, categoryIcon, categoryColor } = this.state.filteredData;

      return `
        <div class="inline-context-section">
          <div class="inline-context-banner">
            <div>
              <i class="fas fa-filter"></i>
              <span>מסונן לפי המשימה: <strong>${categoryName}</strong></span>
            </div>
            <button class="inline-show-all-btn" data-action="show-all" type="button">
              <i class="fas fa-expand"></i>
              הצג הכל
            </button>
          </div>
        </div>
      `;
    }

    renderInlineItems() {
      // Only show items if category is selected AND item is NOT selected
      if (!this.state.selectedCategory || this.state.selectedItem) {
        return '';
      }

      let category, items;

      if (this.state.filteredData && this.state.filteredData.isFiltered) {
        // Context-aware: use filtered data
        category = {
          id: this.state.filteredData.categoryId,
          name: this.state.filteredData.categoryName,
          icon: this.state.filteredData.categoryIcon,
          color: this.state.filteredData.categoryColor
        };
        items = this.state.filteredData.items;
      } else {
        // Normal mode: get category from WorkCategories
        category = window.WorkCategories.getCategoryById(this.state.selectedCategory);
        items = category?.items || [];
      }

      if (!category) return '';

      // ✅ In direct items mode, don't show section label (already have header)
      const showSectionLabel = !this.isDirectItemsMode();

      return `
        <div class="inline-items-section">
          ${showSectionLabel ? `
            <div class="inline-section-label">
              <i class="fas ${category.icon}" ></i>
              <span>בחר ${category.name}:</span>
              ${!this.state.filteredData?.isFiltered ? `
                <button class="inline-clear-category-btn" data-action="clear-category" type="button">
                  <i class="fas fa-arrow-right"></i>
                  חזור
                </button>
              ` : ''}
            </div>
          ` : ''}

          <div class="inline-tags-container">
            ${items.sort((a, b) => a.order - b.order).map(item => `
              <div class="inline-item-tag"
                   data-item="${item.id}">
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

      if (!target) return;

      const action = target.dataset.action;

      if (action === 'accept-suggestion') {
        this.acceptSuggestion();
      } else if (action === 'reject-suggestion') {
        this.rejectSuggestion();
      } else if (action === 'clear') {
        this.clear();
      } else if (action === 'clear-category') {
        this.clearCategory();
      } else if (action === 'show-all') {
        this.showAllCategories();
      } else if (target.dataset.category && target.dataset.item) {
        // Recent item clicked
        this.selectItem(target.dataset.category, target.dataset.item);
      } else if (target.dataset.category) {
        // Category clicked
        this.selectCategory(target.dataset.category);
      } else if (target.dataset.item) {
        // Item clicked
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
      if (!suggestedItem) return;

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

    clear() {
      this.state.selectedCategory = null;
      this.state.selectedItem = null;
      this.updateHiddenInputs();
      this.emitChangeEvent();
      this.render();
      this.attachEventListeners();
      Logger.log('🗑️ Selection cleared');
    }

    showAllCategories() {
      this.state.filteredData = null;
      this.state.selectedCategory = null;
      this.render();
      this.attachEventListeners();
      Logger.log('🔓 Showing all categories');
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

  Logger.log('✅ SmartComboSelector class loaded (v3.3.1 - Monochrome + Smart Recent Items)');

})();
