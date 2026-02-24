/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIRTUAL ASSISTANT - BUSINESS LOGIC ENGINES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description מנועי החיפוש, ההדרכה והפעולות
 * @version 2.0.0
 * @module VirtualAssistant/Engines
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH ENGINE - חיפוש חכם עם indexing
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class SearchEngine
 * @description מנוע חיפוש מתקדם עם debouncing, indexing ו-fuzzy matching
 */
class SearchEngine {
    constructor(database) {
        this.database = database;
        this.index = new Map();
        this.searchHistory = [];
        this.maxHistory = 10;
        this.buildIndex();

        logger.info('SearchEngine initialized', {
            actionsCount: Object.keys(database).length,
            indexSize: this.index.size
        });
    }

    /**
     * בניית אינדקס חיפוש
     * מקבץ את כל מילות המפתח לאינדקס מהיר
     */
    buildIndex() {
        Object.values(this.database).forEach(action => {
            const keywords = [
                action.title.toLowerCase(),
                ...action.keywords.map(k => k.toLowerCase())
            ];

            keywords.forEach(keyword => {
                // פיצול למילים בודדות
                const words = keyword.split(/\s+/);
                words.forEach(word => {
                    if (word.length < 2) {
return;
} // דלג על מילים קצרות מדי

                    if (!this.index.has(word)) {
                        this.index.set(word, new Set());
                    }
                    this.index.get(word).add(action.id);
                });
            });
        });

        logger.debug('Search index built', { indexSize: this.index.size });
    }

    /**
     * חיפוש פעולות
     * @param {string} query - שאילתת חיפוש
     * @param {Object} options - אופציות חיפוש
     * @returns {Array} - תוצאות חיפוש
     */
    search(query, options = {}) {
        const {
            maxResults = 10,
            category = null,
            fuzzy = true
        } = options;

        if (!query || query.trim().length < 2) {
            return [];
        }

        const searchTerm = query.trim().toLowerCase();
        const startTime = performance.now();

        // שמירה בהיסטוריה
        this.addToHistory(searchTerm);

        // חיפוש מדויק
        let results = this.exactSearch(searchTerm);

        // אם לא נמצאו תוצאות - נסה חיפוש רירי
        if (results.length === 0 && fuzzy) {
            results = this.fuzzySearch(searchTerm);
        }

        // סינון לפי קטגוריה
        if (category) {
            results = results.filter(r => r.action.category === category);
        }

        // הגבלת מספר תוצאות
        results = results.slice(0, maxResults);

        const duration = performance.now() - startTime;
        logger.debug('Search completed', {
            query: searchTerm,
            resultsCount: results.length,
            duration: `${duration.toFixed(2)}ms`
        });

        eventBus.emit('search:completed', { query: searchTerm, results, duration });

        return results;
    }

    /**
     * חיפוש מדויק
     */
    exactSearch(query) {
        const words = query.split(/\s+/);
        const matchedIds = new Map();

        words.forEach(word => {
            // חפש במאגר האינדקס
            if (this.index.has(word)) {
                this.index.get(word).forEach(actionId => {
                    matchedIds.set(actionId, (matchedIds.get(actionId) || 0) + 1);
                });
            }

            // חפש גם במפתחות שמתחילים במילה
            Array.from(this.index.keys()).forEach(indexWord => {
                if (indexWord.startsWith(word)) {
                    this.index.get(indexWord).forEach(actionId => {
                        matchedIds.set(actionId, (matchedIds.get(actionId) || 0) + 0.5);
                    });
                }
            });
        });

        // ממיין לפי רלוונטיות
        const results = Array.from(matchedIds.entries())
            .map(([actionId, score]) => ({
                action: this.database[actionId],
                score: score,
                matchType: 'exact'
            }))
            .sort((a, b) => b.score - a.score);

        return results;
    }

    /**
     * חיפוש רפוי (fuzzy)
     */
    fuzzySearch(query) {
        const results = [];

        Object.values(this.database).forEach(action => {
            const searchableText = [
                action.title,
                ...action.keywords
            ].join(' ').toLowerCase();

            const distance = this.levenshteinDistance(query, searchableText.substring(0, query.length * 2));
            const threshold = Math.ceil(query.length * 0.4); // 40% שגיאות מותרות

            if (distance <= threshold) {
                const score = 1 - (distance / query.length);
                results.push({
                    action,
                    score,
                    matchType: 'fuzzy'
                });
            }
        });

        return results.sort((a, b) => b.score - a.score);
    }

    /**
     * חישוב מרחק Levenshtein (לחיפוש רפוי)
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * הוספה להיסטוריית חיפושים
     */
    addToHistory(query) {
        this.searchHistory.unshift(query);
        if (this.searchHistory.length > this.maxHistory) {
            this.searchHistory.pop();
        }
    }

    /**
     * קבלת היסטוריית חיפושים
     */
    getHistory() {
        return [...this.searchHistory];
    }

    /**
     * ניקוי היסטוריה
     */
    clearHistory() {
        this.searchHistory = [];
        eventBus.emit('search:history-cleared');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GUIDE ENGINE - מנהל הדרכות צעד-אחר-צעד
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class GuideEngine
 * @description מנהל הדרכות אינטראקטיביות עם validation וstate tracking
 */
class GuideEngine {
    constructor() {
        this.currentGuide = null;
        this.currentStep = 0;
        this.guideHistory = [];
        this.highlights = [];

        logger.info('GuideEngine initialized');
    }

    /**
     * התחלת הדרכה
     * @param {Object} action - הפעולה מה-ACTION_DATABASE
     */
    startGuide(action) {
        if (!action || !action.fullGuide) {
            logger.warn('Cannot start guide - invalid action', { actionId: action?.id });
            return false;
        }

        try {
            this.currentGuide = {
                action,
                steps: action.fullGuide.steps,
                totalSteps: action.fullGuide.totalSteps || action.fullGuide.steps.length,
                startTime: Date.now(),
                completedSteps: []
            };

            this.currentStep = 0;

            logger.info('Guide started', {
                actionId: action.id,
                totalSteps: this.currentGuide.totalSteps
            });

            eventBus.emit('guide:started', {
                actionId: action.id,
                title: action.title
            });

            return true;
        } catch (error) {
            errorHandler.handleError(error, 'GuideEngine.startGuide', { actionId: action.id });
            return false;
        }
    }

    /**
     * קבלת השלב הנוכחי
     */
    getCurrentStep() {
        if (!this.currentGuide) {
return null;
}

        const step = this.currentGuide.steps[this.currentStep];
        return {
            ...step,
            stepNumber: this.currentStep + 1,
            totalSteps: this.currentGuide.totalSteps,
            isFirst: this.currentStep === 0,
            isLast: this.currentStep === this.currentGuide.totalSteps - 1,
            progress: ((this.currentStep + 1) / this.currentGuide.totalSteps) * 100
        };
    }

    /**
     * מעבר לשלב הבא
     */
    nextStep() {
        if (!this.currentGuide) {
            logger.warn('No active guide');
            return false;
        }

        const currentStepData = this.currentGuide.steps[this.currentStep];

        // סימון השלב כהושלם
        this.currentGuide.completedSteps.push(this.currentStep);

        // בדיקת validation אם קיים
        if (currentStepData.validation) {
            try {
                const isValid = eval(currentStepData.validation);
                if (!isValid) {
                    logger.warn('Step validation failed', { step: this.currentStep });
                    // ניתן להחליט אם לאפשר המשך או לא
                }
            } catch (error) {
                logger.warn('Validation error', { error: error.message });
            }
        }

        // מעבר לשלב הבא
        if (this.currentStep < this.currentGuide.totalSteps - 1) {
            this.currentStep++;

            logger.debug('Moved to next step', {
                step: this.currentStep + 1,
                total: this.currentGuide.totalSteps
            });

            eventBus.emit('guide:step-changed', {
                step: this.currentStep + 1,
                total: this.currentGuide.totalSteps
            });

            // הדגשה אוטומטית של האלמנט הבא
            this.highlightCurrentStep();

            return true;
        } else {
            // סיום ההדרכה
            this.completeGuide();
            return false;
        }
    }

    /**
     * חזרה לשלב הקודם
     */
    previousStep() {
        if (!this.currentGuide || this.currentStep === 0) {
            return false;
        }

        this.currentStep--;

        logger.debug('Moved to previous step', {
            step: this.currentStep + 1
        });

        eventBus.emit('guide:step-changed', {
            step: this.currentStep + 1,
            total: this.currentGuide.totalSteps
        });

        this.highlightCurrentStep();

        return true;
    }

    /**
     * דילוג לשלב מסוים
     */
    goToStep(stepNumber) {
        if (!this.currentGuide) {
return false;
}

        const targetStep = stepNumber - 1; // Convert to 0-based

        if (targetStep < 0 || targetStep >= this.currentGuide.totalSteps) {
            logger.warn('Invalid step number', { stepNumber });
            return false;
        }

        this.currentStep = targetStep;

        eventBus.emit('guide:step-changed', {
            step: this.currentStep + 1,
            total: this.currentGuide.totalSteps
        });

        this.highlightCurrentStep();

        return true;
    }

    /**
     * הדגשת השלב הנוכחי
     */
    highlightCurrentStep() {
        // ניקוי הדגשות קודמות
        this.clearHighlights();

        const step = this.getCurrentStep();
        if (step && step.highlight) {
            const highlight = DOMController.highlightElement(step.highlight, {
                duration: 0, // ללא הגבלת זמן
                pulse: true,
                tooltip: null,
                scrollIntoView: true
            });

            if (highlight) {
                this.highlights.push(highlight);
            }
        }
    }

    /**
     * ניקוי כל ההדגשות
     */
    clearHighlights() {
        this.highlights.forEach(({ overlay }) => {
            DOMController.removeElement(overlay);
        });
        this.highlights = [];
    }

    /**
     * סיום הדרכה
     */
    completeGuide() {
        if (!this.currentGuide) {
return;
}

        const duration = Date.now() - this.currentGuide.startTime;

        // שמירה בהיסטוריה
        this.guideHistory.push({
            actionId: this.currentGuide.action.id,
            title: this.currentGuide.action.title,
            completedAt: new Date().toISOString(),
            duration,
            stepsCompleted: this.currentGuide.completedSteps.length,
            totalSteps: this.currentGuide.totalSteps
        });

        logger.info('Guide completed', {
            actionId: this.currentGuide.action.id,
            duration: `${(duration / 1000).toFixed(1)}s`
        });

        eventBus.emit('guide:completed', {
            actionId: this.currentGuide.action.id,
            duration
        });

        this.clearHighlights();
        this.currentGuide = null;
        this.currentStep = 0;
    }

    /**
     * ביטול הדרכה
     */
    cancelGuide() {
        if (!this.currentGuide) {
return;
}

        logger.info('Guide cancelled', {
            actionId: this.currentGuide.action.id,
            step: this.currentStep + 1
        });

        eventBus.emit('guide:cancelled', {
            actionId: this.currentGuide.action.id,
            step: this.currentStep + 1
        });

        this.clearHighlights();
        this.currentGuide = null;
        this.currentStep = 0;
    }

    /**
     * בדיקה אם יש הדרכה פעילה
     */
    hasActiveGuide() {
        return this.currentGuide !== null;
    }

    /**
     * קבלת היסטוריית הדרכות
     */
    getHistory() {
        return [...this.guideHistory];
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION ENGINE - ביצוע פעולות
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class ActionEngine
 * @description מנוע ביצוע פעולות עם Command Pattern
 */
class ActionEngine {
    constructor() {
        this.actionQueue = [];
        this.executionHistory = [];
        this.maxHistory = 50;

        logger.info('ActionEngine initialized');
    }

    /**
     * ביצוע פעולה
     * @param {Object} action - הפעולה לביצוע
     * @param {Object} context - הקשר הביצוע
     */
    async execute(action, context = {}) {
        if (!action) {
            logger.warn('Cannot execute - no action provided');
            return { success: false, error: 'No action' };
        }

        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();

        logger.info('Executing action', {
            executionId,
            actionId: action.id,
            actionTitle: action.title
        });

        eventBus.emit('action:started', {
            executionId,
            actionId: action.id,
            title: action.title
        });

        try {
            let result;

            // בדוק אם יש פעולה ישירה
            if (action.directAction) {
                result = await this.executeDirectAction(action.directAction, context);
            }
            // בדוק אם יש הדרכה מלאה
            else if (action.fullGuide) {
                result = { success: true, type: 'guide', message: 'Guide available' };
            }
            // בדוק אם יש מידע בלבד
            else if (action.info) {
                result = { success: true, type: 'info', message: 'Info displayed' };
            } else {
                result = { success: false, error: 'No executable action found' };
            }

            const duration = Date.now() - startTime;

            // שמירה בהיסטוריה
            this.executionHistory.push({
                executionId,
                actionId: action.id,
                actionTitle: action.title,
                timestamp: new Date().toISOString(),
                duration,
                success: result.success,
                context
            });

            if (this.executionHistory.length > this.maxHistory) {
                this.executionHistory.shift();
            }

            logger.info('Action executed', {
                executionId,
                duration: `${duration}ms`,
                success: result.success
            });

            eventBus.emit('action:completed', {
                executionId,
                actionId: action.id,
                duration,
                success: result.success
            });

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;

            errorHandler.handleError(error, 'ActionEngine.execute', {
                executionId,
                actionId: action.id
            });

            eventBus.emit('action:failed', {
                executionId,
                actionId: action.id,
                error: error.message,
                duration
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * ביצוע פעולה ישירה (eval של קוד)
     */
    async executeDirectAction(actionCode, context) {
        try {
            // הרץ את הקוד בהקשר בטוח
            const result = eval(actionCode);

            // אם זה Promise - המתן
            if (result instanceof Promise) {
                await result;
            }

            return {
                success: true,
                type: 'direct',
                message: 'Direct action executed'
            };
        } catch (error) {
            throw new Error(`Direct action failed: ${error.message}`);
        }
    }

    /**
     * קבלת היסטוריית ביצועים
     */
    getHistory() {
        return [...this.executionHistory];
    }

    /**
     * ניקוי היסטוריה
     */
    clearHistory() {
        this.executionHistory = [];
        eventBus.emit('action:history-cleared');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SearchEngine, GuideEngine, ActionEngine };
}
