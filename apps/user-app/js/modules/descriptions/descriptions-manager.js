/**
 * ═══════════════════════════════════════════════════════════════════════
 * DESCRIPTIONS MANAGER
 * ניהול תיאורי עבודה - Context-Aware + Last-Used Intelligence
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Business Logic Layer:
 * - Context-aware filtering: סינון לפי קטגוריית המשימה
 * - Last-used intelligence: זיכרון הבחירה האחרונה per-task
 * - Recent items management: ניהול פריטים אחרונים גלובלי
 * - LocalStorage persistence: שמירה מקומית
 *
 * @version 2.0.0
 * @created 2025-01-04
 */

(function() {
  'use strict';

  class DescriptionsManager {
    constructor() {
      // Categories from category-mapping.js
      this.categories = window.WorkCategories?.CATEGORIES || {};

      // Cache for task context (in-memory)
      this.taskContextCache = new Map();

      // Recent items (global, per user)
      this.recentItems = [];
      this.maxRecentItems = 5;

      // Settings
      this.storageKeys = {
        recentItems: 'workDescriptions_recent',
        taskLastUsed: 'workDescriptions_task_', // + taskId
        userPreferences: 'workDescriptions_preferences'
      };

      this.init();
    }

    /**
     * אתחול - טעינת נתונים מ-LocalStorage
     */
    init() {
      this.loadRecentItems();
      Logger.log('✅ DescriptionsManager initialized');
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * FEATURE 1: CONTEXT-AWARE FILTERING
     * ════════════════════════════════════════════════════════════════════
     */

    /**
     * קבל פריטים מסוננים לפי קונטקסט המשימה
     * @param {string} taskId - Task ID
     * @param {Object} task - Task object (optional, if available)
     * @returns {Object} Filtered items result
     */
    async getItemsForTask(taskId, task = null) {
      // ✅ Validation: taskId is required for context-aware filtering
      if (!taskId) {
        return this.getAllItemsUnfiltered();
      }

      // בדוק אם יש cache
      if (this.taskContextCache.has(taskId)) {
        const cached = this.taskContextCache.get(taskId);
        Logger.log(`📦 Using cached context for task ${taskId}`);
        return cached;
      }

      // אם Task object לא סופק, נסה למצוא אותו
      if (!task) {
        task = await this.findTask(taskId);
      }

      // ✅ ERROR STATE: משימה ללא קטגוריה - לא ניתן להמשיך
      if (!task || !task.categoryId) {
        Logger.log(`❌ Task ${taskId} has no category - cannot proceed`);
        return {
          isError: true,
          errorMessage: 'משימה זו לא משויכת לקטגוריה. נא לעדכן את המשימה תחילה.',
          taskId: taskId
        };
      }

      // בנה תוצאה מסוננת
      const category = this.categories[task.categoryId];

      // ✅ ERROR STATE: קטגוריה לא קיימת - בעיה במערכת
      if (!category) {
        Logger.log(`❌ Category ${task.categoryId} not found - data integrity issue`);
        return {
          isError: true,
          errorMessage: `קטגוריה "${task.categoryId}" לא קיימת במערכת. נא לפנות לתמיכה טכנית.`,
          taskId: taskId,
          categoryId: task.categoryId
        };
      }

      const result = {
        isFiltered: true,
        categoryId: category.id,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryColor: category.color,
        items: category.items.sort((a, b) => a.order - b.order),
        reason: `מסונן לפי קטגוריית המשימה: ${category.name}`,
        taskId: taskId
      };

      // שמור ב-cache
      this.taskContextCache.set(taskId, result);

      Logger.log(`✅ Context loaded for task ${taskId}: ${category.name} (${category.items.length} items)`);

      return result;
    }

    /**
     * החזר את כל הפריטים ללא סינון
     */
    getAllItemsUnfiltered() {
      return {
        isFiltered: false,
        categories: Object.values(this.categories).sort((a, b) => a.order - b.order),
        reason: 'כל הקטגוריות והפריטים זמינים'
      };
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * FEATURE 2: LAST-USED INTELLIGENCE
     * ════════════════════════════════════════════════════════════════════
     */

    /**
     * קבל הצעה חכמה לפי הבחירה האחרונה
     * ✅ WITH CATEGORY VALIDATION: Only suggest items from task's category
     * @param {string} taskId - Task ID
     * @returns {Object} Suggestion object
     */
    getLastUsedForTask(taskId) {
      if (!taskId) {
        return { suggested: false, confidence: 'none' };
      }

      // ✅ Get task's category from cache
      const taskContext = this.taskContextCache.get(taskId);
      const taskCategoryId = taskContext?.categoryId;

      // בדוק LocalStorage
      const key = this.storageKeys.taskLastUsed + taskId;
      const lastUsed = this.getFromStorage(key);

      if (lastUsed) {
        // ✅ VALIDATE: last-used must belong to task's category
        if (taskCategoryId && lastUsed.categoryId !== taskCategoryId) {
          Logger.log(`⚠️ Last-used "${lastUsed.fullText}" is from wrong category (${lastUsed.categoryId} != ${taskCategoryId}) - ignoring`);
          // Don't suggest - wrong category!
        } else {
          Logger.log(`💡 Last-used found for task ${taskId}: ${lastUsed.fullText}`);

          return {
            suggested: true,
            categoryId: lastUsed.categoryId,
            itemId: lastUsed.itemId,
            itemText: lastUsed.itemText,
            fullText: lastUsed.fullText,
            timestamp: lastUsed.timestamp,
            confidence: 'high' // high confidence because it's specific to this task
          };
        }
      }

      // ✅ Fallback to recent items - but only from task's category
      if (taskCategoryId && this.recentItems.length > 0) {
        const recentFromCategory = this.recentItems.find(item => item.categoryId === taskCategoryId);

        if (recentFromCategory) {
          Logger.log(`💡 Suggesting from recent items (category match): ${recentFromCategory.fullText}`);

          return {
            suggested: true,
            categoryId: recentFromCategory.categoryId,
            itemId: recentFromCategory.itemId,
            itemText: recentFromCategory.itemText,
            fullText: recentFromCategory.fullText,
            timestamp: recentFromCategory.timestamp,
            confidence: 'medium' // medium confidence - global, not task-specific
          };
        }
      }

      // אין הצעה
      return { suggested: false, confidence: 'none' };
    }

    /**
     * שמור בחירה (מעדכן last-used + recent items)
     * ✅ WITH VALIDATION: itemId must belong to task's category
     * @param {string} taskId - Task ID
     * @param {string} categoryId - Category ID
     * @param {string} itemId - Item ID
     * @returns {Object} Description object
     */
    saveSelection(taskId, categoryId, itemId) {
      const category = this.categories[categoryId];
      const item = category?.items.find(i => i.id === itemId);

      // ✅ Basic validation: category and item exist
      if (!category || !item) {
        throw new Error(`Invalid selection: ${categoryId}/${itemId}`);
      }

      // ✅ CROSS-VALIDATION: If taskId provided, verify item belongs to task's category
      if (taskId) {
        const taskContext = this.taskContextCache.get(taskId);
        if (taskContext && taskContext.isFiltered && taskContext.categoryId !== categoryId) {
          throw new Error(
            `Category mismatch: trying to save "${categoryId}/${itemId}" for task in category "${taskContext.categoryId}". ` +
            'Item must belong to task\'s category.'
          );
        }
      }

      const description = {
        categoryId,
        categoryName: category.name,
        itemId,
        itemText: item.text,
        fullText: `${category.name} • ${item.text}`,
        timestamp: Date.now()
      };

      // 1. שמור last-used למשימה ספציפית
      if (taskId) {
        this.saveLastUsedForTask(taskId, description);
      }

      // 2. הוסף ל-recent items גלובלי
      this.addToRecentItems(description);

      // 3. Emit event
      this.emitEvent('description:selected', {
        taskId,
        description
      });

      Logger.log(`✅ Selection saved: ${description.fullText}`);

      return description;
    }

    /**
     * שמור last-used למשימה ספציפית
     */
    saveLastUsedForTask(taskId, description) {
      const key = this.storageKeys.taskLastUsed + taskId;
      this.saveToStorage(key, description);
      Logger.log(`💾 Last-used saved for task ${taskId}`);
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * RECENT ITEMS MANAGEMENT
     * ════════════════════════════════════════════════════════════════════
     */

    /**
     * הוסף פריט ל-recent items
     */
    addToRecentItems(description) {
      // הסר duplicates (אותה קטגוריה + פריט)
      this.recentItems = this.recentItems.filter(
        item => !(item.categoryId === description.categoryId && item.itemId === description.itemId)
      );

      // הוסף בראש הרשימה
      this.recentItems.unshift({
        categoryId: description.categoryId,
        categoryName: description.categoryName,
        itemId: description.itemId,
        itemText: description.itemText,
        fullText: description.fullText,
        timestamp: Date.now()
      });

      // שמור רק את ה-X האחרונים
      this.recentItems = this.recentItems.slice(0, this.maxRecentItems);

      // שמור ב-LocalStorage
      this.saveRecentItems();

      Logger.log(`📌 Added to recent items (total: ${this.recentItems.length})`);
    }

    /**
     * קבל recent items
     */
    getRecentItems() {
      return this.recentItems;
    }

    /**
     * טען recent items מ-LocalStorage
     */
    loadRecentItems() {
      const saved = this.getFromStorage(this.storageKeys.recentItems);
      this.recentItems = saved || [];
      Logger.log(`📥 Loaded ${this.recentItems.length} recent items`);
    }

    /**
     * שמור recent items ב-LocalStorage
     */
    saveRecentItems() {
      this.saveToStorage(this.storageKeys.recentItems, this.recentItems);
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * HELPERS
     * ════════════════════════════════════════════════════════════════════
     */

    /**
     * מצא משימה (מה-cache של המערכת)
     */
    async findTask(taskId) {
      // נסה למצוא מה-cache של LawOfficeManager
      if (window.LawOfficeManager?.budgetTasks) {
        const task = window.LawOfficeManager.budgetTasks.find(t => t.id === taskId);
        if (task) {
return task;
}
      }

      // אם לא נמצא, אין לנו גישה ישירה ל-Firebase מכאן
      // זה אומר שה-task צריך להיות מועבר כ-parameter
      Logger.log(`⚠️ Task ${taskId} not found in cache`);
      return null;
    }

    /**
     * נקה cache של task ספציפי
     */
    clearTaskCache(taskId) {
      this.taskContextCache.delete(taskId);
      Logger.log(`🗑️ Cache cleared for task ${taskId}`);
    }

    /**
     * נקה את כל ה-cache
     */
    clearAllCache() {
      this.taskContextCache.clear();
      Logger.log('🗑️ All cache cleared');
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * LOCALSTORAGE OPERATIONS
     * ════════════════════════════════════════════════════════════════════
     */

    getFromStorage(key) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (error) {
        Logger.log(`❌ Error reading from storage (${key}):`, error);
        return null;
      }
    }

    saveToStorage(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (error) {
        Logger.log(`❌ Error saving to storage (${key}):`, error);
      }
    }

    /**
     * ════════════════════════════════════════════════════════════════════
     * EVENT MANAGEMENT
     * ════════════════════════════════════════════════════════════════════
     */

    emitEvent(eventName, data) {
      if (window.EventBus) {
        window.EventBus.emit(eventName, data);
      }
    }
  }

  // Create singleton instance
  window.DescriptionsManager = new DescriptionsManager();

  Logger.log('✅ DescriptionsManager ready');

})();
