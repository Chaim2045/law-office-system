/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIRTUAL ASSISTANT - UI LAYER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description קומפוננטות UI ומנהל תצוגות
 * @version 2.0.0
 * @module VirtualAssistant/UI
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// UI COMPONENT FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class UIComponentFactory
 * @description פקטורי ליצירת כל קומפוננטות ה-UI
 */
class UIComponentFactory {
    /**
     * כרטיס פעולה (לדף הבית)
     */
    static createActionCard(action) {
        const card = DOMController.createElement('button', {
            className: 'va-action-card',
            attributes: {
                'data-action-id': action.id
            },
            events: {
                click: () => {
                    eventBus.emit('action:card-clicked', { actionId: action.id });
                }
            }
        });

        card.innerHTML = `
            <div class="va-action-card-icon">${action.icon}</div>
            <div class="va-action-card-title">${action.title}</div>
        `;

        return card;
    }

    /**
     * תוצאת חיפוש
     */
    static createSearchResult(result) {
        const { action, score, matchType } = result;

        const resultEl = DOMController.createElement('div', {
            className: 'va-search-result',
            attributes: {
                'data-action-id': action.id,
                'data-match-type': matchType
            },
            events: {
                click: () => {
                    eventBus.emit('search:result-clicked', { actionId: action.id });
                }
            }
        });

        let stepsHtml = '';
        if (action.quickSteps && action.quickSteps.length > 0) {
            stepsHtml = `
                <div class="va-result-steps">
                    <div class="va-result-steps-title">צעדים מהירים:</div>
                    <ol class="va-result-steps-list">
                        ${action.quickSteps.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </div>
            `;
        }

        const actionsHtml = `
            <div class="va-result-actions">
                ${action.fullGuide ? `
                    <button class="va-result-action-btn va-primary" data-action="guide">
                        📖 הדרכה מלאה
                    </button>
                ` : ''}
                ${action.directAction ? `
                    <button class="va-result-action-btn va-secondary" data-action="execute">
                        🚀 בצע עכשיו
                    </button>
                ` : ''}
            </div>
        `;

        resultEl.innerHTML = `
            <div class="va-result-header">
                <div class="va-result-icon">${action.icon}</div>
                <div class="va-result-title">${action.title}</div>
            </div>
            ${stepsHtml}
            ${actionsHtml}
        `;

        // Event listeners לכפתורי הפעולה
        const guideBtns = resultEl.querySelectorAll('[data-action="guide"]');
        guideBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                eventBus.emit('guide:start-requested', { actionId: action.id });
            });
        });

        const executeBtns = resultEl.querySelectorAll('[data-action="execute"]');
        executeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                eventBus.emit('action:execute-requested', { actionId: action.id });
            });
        });

        return resultEl;
    }

    /**
     * שלב הדרכה
     */
    static createGuideStep(stepData) {
        const container = DOMController.createElement('div', {
            className: 'va-guide-step'
        });

        // Progress bar
        const progressHtml = `
            <div class="va-guide-progress">
                <div class="va-guide-progress-bar">
                    <div class="va-guide-progress-fill" style="width: ${stepData.progress}%"></div>
                </div>
                <div class="va-guide-progress-text">שלב ${stepData.stepNumber} מתוך ${stepData.totalSteps}</div>
            </div>
        `;

        // Content
        const descriptionHtml = stepData.description
            .split('\n\n')
            .map(para => `<p>${this.formatMarkdown(para)}</p>`)
            .join('');

        // Tips
        let tipsHtml = '';
        if (stepData.tips && stepData.tips.length > 0) {
            tipsHtml = `
                <div class="va-guide-tips">
                    <div class="va-guide-tips-title">💡 טיפים:</div>
                    <ul class="va-guide-tips-list">
                        ${stepData.tips.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // Action button
        let actionButtonHtml = '';
        if (stepData.actionButton) {
            actionButtonHtml = `
                <button class="va-guide-action-btn">
                    ${stepData.actionButton.text}
                </button>
            `;
        }

        // Navigation
        const navigationHtml = `
            <div class="va-guide-navigation">
                ${!stepData.isFirst ? `
                    <button class="va-guide-nav-btn va-guide-prev">
                        ← הקודם
                    </button>
                ` : '<div></div>'}

                ${!stepData.isLast ? `
                    <button class="va-guide-nav-btn va-guide-next va-primary">
                        הבא →
                    </button>
                ` : `
                    <button class="va-guide-nav-btn va-guide-complete va-success">
                        ✓ סיום
                    </button>
                `}
            </div>
        `;

        container.innerHTML = `
            ${progressHtml}
            <div class="va-guide-content">
                <h2 class="va-guide-step-title">${stepData.title}</h2>
                <div class="va-guide-step-description">${descriptionHtml}</div>
                ${tipsHtml}
                ${actionButtonHtml}
            </div>
            ${navigationHtml}
        `;

        // Event listeners
        if (stepData.actionButton) {
            const actionBtn = container.querySelector('.va-guide-action-btn');
            actionBtn?.addEventListener('click', () => {
                try {
                    eval(stepData.actionButton.handler);
                } catch (error) {
                    errorHandler.handleError(error, 'UIComponentFactory.createGuideStep.actionButton');
                }
            });
        }

        const prevBtn = container.querySelector('.va-guide-prev');
        prevBtn?.addEventListener('click', () => {
            eventBus.emit('guide:previous-step');
        });

        const nextBtn = container.querySelector('.va-guide-next');
        nextBtn?.addEventListener('click', () => {
            eventBus.emit('guide:next-step');
        });

        const completeBtn = container.querySelector('.va-guide-complete');
        completeBtn?.addEventListener('click', () => {
            eventBus.emit('guide:complete');
        });

        return container;
    }

    /**
     * מידע על פעולה (למשל shortcuts)
     */
    static createInfoView(action) {
        const container = DOMController.createElement('div', {
            className: 'va-info-view'
        });

        if (!action.info) {
return container;
}

        const { info } = action;

        // Header
        const headerHtml = `
            <div class="va-info-header">
                <div class="va-info-icon">${action.icon}</div>
                <h2 class="va-info-title">${info.title || action.title}</h2>
            </div>
        `;

        // Description
        let descriptionHtml = '';
        if (info.description) {
            descriptionHtml = `<p class="va-info-description">${info.description}</p>`;
        }

        // Content based on type
        let contentHtml = '';

        if (info.type === 'shortcuts') {
            contentHtml = `
                <div class="va-shortcuts-list">
                    ${info.shortcuts.map(shortcut => `
                        <div class="va-shortcut-item">
                            <div class="va-shortcut-keys">
                                ${shortcut.keys.split(' + ').map(key =>
                                    `<kbd class="va-key">${key}</kbd>`
                                ).join('<span class="va-key-plus">+</span>')}
                            </div>
                            <div class="va-shortcut-description">
                                ${shortcut.icon ? `<span class="va-shortcut-icon">${shortcut.icon}</span>` : ''}
                                ${shortcut.description}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (info.type === 'feature') {
            const featuresHtml = info.features ? `
                <div class="va-feature-list">
                    ${info.features.map(feature => `
                        <div class="va-feature-item">
                            <span class="va-feature-icon">${feature.icon}</span>
                            <span class="va-feature-text">${feature.text}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '';

            const actionBtnHtml = info.actionButton ? `
                <button class="va-info-action-btn va-primary">
                    ${info.actionButton.text}
                </button>
            ` : '';

            contentHtml = `${featuresHtml}${actionBtnHtml}`;
        }

        container.innerHTML = `
            ${headerHtml}
            ${descriptionHtml}
            ${contentHtml}
        `;

        // Action button handler
        if (info.actionButton) {
            const actionBtn = container.querySelector('.va-info-action-btn');
            actionBtn?.addEventListener('click', () => {
                try {
                    eval(info.actionButton.handler);
                } catch (error) {
                    errorHandler.handleError(error, 'UIComponentFactory.createInfoView.actionButton');
                }
            });
        }

        return container;
    }

    /**
     * Empty state (אין תוצאות)
     */
    static createEmptyState(message, icon = '🔍') {
        const container = DOMController.createElement('div', {
            className: 'va-empty-state'
        });

        container.innerHTML = `
            <div class="va-empty-icon">${icon}</div>
            <div class="va-empty-message">${message}</div>
        `;

        return container;
    }

    /**
     * Loading state
     */
    static createLoadingState(message = 'טוען...') {
        const container = DOMController.createElement('div', {
            className: 'va-loading-state'
        });

        container.innerHTML = `
            <div class="va-loading-spinner"></div>
            <div class="va-loading-message">${message}</div>
        `;

        return container;
    }

    /**
     * Format markdown-like text
     */
    static formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // **bold**
            .replace(/\*(.*?)\*/g, '<em>$1</em>')              // *italic*
            .replace(/`(.*?)`/g, '<code>$1</code>');           // `code`
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEW MANAGER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class ViewManager
 * @description מנהל תצוגות - Strategy Pattern
 */
class ViewManager {
    constructor(database, searchEngine, guideEngine, actionEngine) {
        this.database = database;
        this.searchEngine = searchEngine;
        this.guideEngine = guideEngine;
        this.actionEngine = actionEngine;
        this.currentView = null;

        logger.info('ViewManager initialized');
    }

    /**
     * רינדור תצוגה
     * @param {string} viewName - שם התצוגה (home/search/guide/info)
     * @param {Object} data - נתונים לתצוגה
     * @param {HTMLElement} container - הקונטיינר
     */
    render(viewName, data, container) {
        if (!container) {
            logger.error('ViewManager.render: No container provided');
            return;
        }

        // ניקוי הקונטיינר
        container.innerHTML = '';

        this.currentView = viewName;

        logger.debug('Rendering view', { viewName, data });

        try {
            switch (viewName) {
                case 'home':
                    this.renderHomeView(container);
                    break;
                case 'search':
                    this.renderSearchView(container, data);
                    break;
                case 'guide':
                    this.renderGuideView(container, data);
                    break;
                case 'info':
                    this.renderInfoView(container, data);
                    break;
                default:
                    logger.warn('Unknown view', { viewName });
                    this.renderHomeView(container);
            }

            eventBus.emit('view:rendered', { viewName });
        } catch (error) {
            errorHandler.handleError(error, 'ViewManager.render', { viewName });
            this.renderErrorView(container, error);
        }
    }

    /**
     * דף הבית - כרטיסי פעולות
     */
    renderHomeView(container) {
        const header = DOMController.createElement('div', {
            className: 'va-home-header'
        });

        const userName = SystemBridge.getUserName();
        header.innerHTML = `
            <h1 class="va-home-title">👋 שלום ${userName}!</h1>
            <p class="va-home-subtitle">במה אוכל לעזור לך היום?</p>
        `;

        container.appendChild(header);

        // קבוצות לפי קטגוריה
        const categories = {};

        Object.values(this.database).forEach(action => {
            const cat = action.category || 'general';
            if (!categories[cat]) {
                categories[cat] = [];
            }
            categories[cat].push(action);
        });

        // רינדור כל קטגוריה
        Object.entries(categories).forEach(([categoryId, actions]) => {
            const categoryInfo = ACTION_CATEGORIES[categoryId] || {
                name: 'כללי',
                icon: '📋'
            };

            const categorySection = DOMController.createElement('div', {
                className: 'va-category-section'
            });

            categorySection.innerHTML = `
                <div class="va-category-header">
                    <span class="va-category-icon">${categoryInfo.icon}</span>
                    <span class="va-category-name">${categoryInfo.name}</span>
                </div>
                <div class="va-action-cards"></div>
            `;

            const cardsContainer = categorySection.querySelector('.va-action-cards');

            actions.forEach(action => {
                const card = UIComponentFactory.createActionCard(action);
                cardsContainer.appendChild(card);
            });

            container.appendChild(categorySection);
        });
    }

    /**
     * תוצאות חיפוש
     */
    renderSearchView(container, data) {
        const { query, results } = data;

        // Header
        const header = DOMController.createElement('div', {
            className: 'va-search-header'
        });

        header.innerHTML = `
            <h2 class="va-search-title">תוצאות חיפוש</h2>
            <p class="va-search-query">חיפשת: <strong>"${query}"</strong></p>
            <p class="va-search-count">נמצאו ${results.length} תוצאות</p>
        `;

        container.appendChild(header);

        // Results
        if (results.length === 0) {
            const emptyState = UIComponentFactory.createEmptyState(
                'לא נמצאו תוצאות. נסה מילים אחרות.',
                '🔍'
            );
            container.appendChild(emptyState);
        } else {
            const resultsContainer = DOMController.createElement('div', {
                className: 'va-search-results'
            });

            results.forEach(result => {
                const resultEl = UIComponentFactory.createSearchResult(result);
                resultsContainer.appendChild(resultEl);
            });

            container.appendChild(resultsContainer);
        }
    }

    /**
     * הדרכה צעד-אחר-צעד
     */
    renderGuideView(container, data) {
        const stepData = data.step;

        if (!stepData) {
            logger.error('No step data provided for guide view');
            return;
        }

        // Header עם כפתור חזרה
        const header = DOMController.createElement('div', {
            className: 'va-guide-header'
        });

        header.innerHTML = `
            <button class="va-guide-back-btn">← חזרה</button>
            <h2 class="va-guide-title">${data.action.title}</h2>
        `;

        container.appendChild(header);

        // Event listener לחזרה
        const backBtn = header.querySelector('.va-guide-back-btn');
        backBtn?.addEventListener('click', () => {
            eventBus.emit('guide:cancelled');
            eventBus.emit('view:home-requested');
        });

        // Step content
        const stepEl = UIComponentFactory.createGuideStep(stepData);
        container.appendChild(stepEl);
    }

    /**
     * מידע (info view)
     */
    renderInfoView(container, data) {
        const { action } = data;

        // Header עם חזרה
        const header = DOMController.createElement('div', {
            className: 'va-info-view-header'
        });

        header.innerHTML = '<button class="va-info-back-btn">← חזרה</button>';

        container.appendChild(header);

        const backBtn = header.querySelector('.va-info-back-btn');
        backBtn?.addEventListener('click', () => {
            eventBus.emit('view:home-requested');
        });

        // Content
        const infoView = UIComponentFactory.createInfoView(action);
        container.appendChild(infoView);
    }

    /**
     * שגיאה
     */
    renderErrorView(container, error) {
        const errorView = DOMController.createElement('div', {
            className: 'va-error-view'
        });

        errorView.innerHTML = `
            <div class="va-error-icon">⚠️</div>
            <h2 class="va-error-title">אופס! משהו השתבש</h2>
            <p class="va-error-message">${error.message}</p>
            <button class="va-error-retry-btn">נסה שוב</button>
        `;

        const retryBtn = errorView.querySelector('.va-error-retry-btn');
        retryBtn?.addEventListener('click', () => {
            eventBus.emit('view:home-requested');
        });

        container.appendChild(errorView);
    }

    /**
     * קבלת התצוגה הנוכחית
     */
    getCurrentView() {
        return this.currentView;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIComponentFactory, ViewManager };
}
