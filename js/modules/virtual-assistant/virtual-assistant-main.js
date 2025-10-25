/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIRTUAL ASSISTANT - MAIN CLASS (Orchestrator)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description הקלאס המרכזי שמשלב את כל המערכת
 * @version 2.0.0
 * @module VirtualAssistant/Main
 * @singleton
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

/**
 * @class VirtualAssistant
 * @description העוזר הווירטואלי המרכזי - Singleton Pattern
 */
class VirtualAssistant {
    constructor() {
        if (VirtualAssistant.instance) {
            return VirtualAssistant.instance;
        }

        this.isInitialized = false;
        this.isOpen = false;
        this.container = null;
        this.searchInput = null;
        this.contentContainer = null;
        this.searchDebounceTimer = null;

        // State
        this.stateManager = new StateManager({
            view: 'home',
            isOpen: false,
            searchQuery: '',
            currentAction: null,
            guideActive: false
        });

        // Engines
        this.searchEngine = null;
        this.guideEngine = null;
        this.actionEngine = null;
        this.viewManager = null;

        VirtualAssistant.instance = this;

        logger.info('VirtualAssistant instance created');
    }

    /**
     * אתחול המערכת
     */
    async init() {
        if (this.isInitialized) {
            logger.warn('VirtualAssistant already initialized');
            return;
        }

        try {
            logger.info('Initializing VirtualAssistant...');

            // אתחול מנועים
            this.searchEngine = new SearchEngine(ACTION_DATABASE);
            this.guideEngine = new GuideEngine();
            this.actionEngine = new ActionEngine();
            this.viewManager = new ViewManager(
                ACTION_DATABASE,
                this.searchEngine,
                this.guideEngine,
                this.actionEngine
            );

            // בניית HTML
            this.buildHTML();

            // רישום event listeners
            this.attachEventListeners();

            // Subscribe לשינויים במצב
            this.subscribeToStateChanges();

            this.isInitialized = true;

            logger.info('VirtualAssistant initialized successfully');
            eventBus.emit('va:initialized');

            return true;
        } catch (error) {
            errorHandler.handleError(error, 'VirtualAssistant.init');
            return false;
        }
    }

    /**
     * בניית HTML של הבוט
     */
    buildHTML() {
        // בדוק אם כבר קיים
        let container = DOMController.querySelector('#va-container');

        if (container) {
            logger.warn('VirtualAssistant container already exists');
            this.container = container;
            return;
        }

        // יצירת container
        container = DOMController.createElement('div', {
            id: 'va-container',
            className: 'va-container va-hidden'
        });

        container.innerHTML = `
            <!-- Header -->
            <div class="va-header">
                <div class="va-header-title">
                    <span class="va-header-icon">💬</span>
                    <span class="va-header-text">העוזר החכם שלך</span>
                </div>
                <div class="va-header-actions">
                    <button class="va-header-btn va-minimize-btn" title="מזער">−</button>
                    <button class="va-header-btn va-close-btn" title="סגור">×</button>
                </div>
            </div>

            <!-- Search Bar -->
            <div class="va-search-bar">
                <div class="va-search-wrapper">
                    <svg class="va-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"/>
                        <path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                        type="text"
                        id="va-search-input"
                        class="va-search-input"
                        placeholder="חפש עזרה... (למשל: 'איך לדווח שעות')"
                        autocomplete="off"
                    />
                    <button class="va-search-clear va-hidden" id="va-search-clear">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="va-content" id="va-content">
                <!-- תוכן דינמי יוצג כאן -->
            </div>

            <!-- Footer -->
            <div class="va-footer">
                <button class="va-footer-btn" id="va-home-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span>הבית</span>
                </button>
                <button class="va-footer-btn" id="va-history-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>היסטוריה</span>
                </button>
            </div>
        `;

        document.body.appendChild(container);

        // שמירת references
        this.container = container;
        this.searchInput = DOMController.querySelector('#va-search-input');
        this.contentContainer = DOMController.querySelector('#va-content');

        logger.debug('VirtualAssistant HTML built');
    }

    /**
     * רישום Event Listeners
     */
    attachEventListeners() {
        // Header buttons
        const minimizeBtn = DOMController.querySelector('.va-minimize-btn');
        minimizeBtn?.addEventListener('click', () => this.minimize());

        const closeBtn = DOMController.querySelector('.va-close-btn');
        closeBtn?.addEventListener('click', () => this.close());

        // Search
        this.searchInput?.addEventListener('input', (e) => {
            const query = e.target.value;

            // הצג/הסתר כפתור X
            const clearBtn = DOMController.querySelector('#va-search-clear');
            if (query) {
                DOMController.removeClass(clearBtn, 'va-hidden');
            } else {
                DOMController.addClass(clearBtn, 'va-hidden');
            }

            // Debounce
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = setTimeout(() => {
                this.performSearch(query);
            }, 300);
        });

        // Search clear button
        const clearBtn = DOMController.querySelector('#va-search-clear');
        clearBtn?.addEventListener('click', () => {
            this.searchInput.value = '';
            DOMController.addClass(clearBtn, 'va-hidden');
            this.showHome();
            this.searchInput.focus();
        });

        // Enter key
        this.searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(this.searchDebounceTimer);
                this.performSearch(e.target.value);
            }
        });

        // Footer buttons
        const homeBtn = DOMController.querySelector('#va-home-btn');
        homeBtn?.addEventListener('click', () => this.showHome());

        const historyBtn = DOMController.querySelector('#va-history-btn');
        historyBtn?.addEventListener('click', () => this.showHistory());

        // Event bus listeners
        eventBus.on('action:card-clicked', ({ actionId }) => {
            this.handleActionClick(actionId);
        });

        eventBus.on('search:result-clicked', ({ actionId }) => {
            this.handleActionClick(actionId);
        });

        eventBus.on('guide:start-requested', ({ actionId }) => {
            this.startGuide(actionId);
        });

        eventBus.on('action:execute-requested', ({ actionId }) => {
            this.executeAction(actionId);
        });

        eventBus.on('guide:next-step', () => {
            this.guideEngine.nextStep();
            this.updateGuideView();
        });

        eventBus.on('guide:previous-step', () => {
            this.guideEngine.previousStep();
            this.updateGuideView();
        });

        eventBus.on('guide:complete', () => {
            this.guideEngine.completeGuide();
            this.showHome();
        });

        eventBus.on('guide:cancelled', () => {
            this.guideEngine.cancelGuide();
        });

        eventBus.on('view:home-requested', () => {
            this.showHome();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // F1 - Open assistant
            if (e.key === 'F1') {
                e.preventDefault();
                this.toggle();
            }
            // Esc - Close assistant
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        logger.debug('Event listeners attached');
    }

    /**
     * Subscribe לשינויים במצב
     */
    subscribeToStateChanges() {
        this.stateManager.subscribe('va-main', (newState, oldState, updates) => {
            logger.debug('State changed', { updates });

            // React to state changes if needed
        });
    }

    /**
     * פתיחה/סגירה של הבוט
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * פתיחת הבוט
     */
    open() {
        if (!this.isInitialized) {
            logger.warn('Cannot open - not initialized');
            return;
        }

        DOMController.removeClass(this.container, 'va-hidden');
        this.isOpen = true;

        this.stateManager.setState({ isOpen: true }, 'VirtualAssistant.open');

        // הצג דף הבית אם אין תצוגה
        if (!this.stateManager.getState().view || this.stateManager.getState().view === 'home') {
            this.showHome();
        }

        // Focus על search
        setTimeout(() => this.searchInput?.focus(), 100);

        logger.info('VirtualAssistant opened');
        eventBus.emit('va:opened');
    }

    /**
     * סגירת הבוט
     */
    close() {
        DOMController.addClass(this.container, 'va-hidden');
        this.isOpen = false;

        this.stateManager.setState({ isOpen: false }, 'VirtualAssistant.close');

        // ביטול הדרכה אם פעילה
        if (this.guideEngine.hasActiveGuide()) {
            this.guideEngine.cancelGuide();
        }

        logger.info('VirtualAssistant closed');
        eventBus.emit('va:closed');
    }

    /**
     * מזעור
     */
    minimize() {
        this.close();
    }

    /**
     * הצגת דף הבית
     */
    showHome() {
        this.stateManager.setState({ view: 'home' }, 'VirtualAssistant.showHome');

        this.viewManager.render('home', {}, this.contentContainer);

        // נקה search
        this.searchInput.value = '';
        const clearBtn = DOMController.querySelector('#va-search-clear');
        DOMController.addClass(clearBtn, 'va-hidden');
    }

    /**
     * ביצוע חיפוש
     */
    performSearch(query) {
        if (!query || query.trim().length < 2) {
            this.showHome();
            return;
        }

        const results = this.searchEngine.search(query);

        this.stateManager.setState({
            view: 'search',
            searchQuery: query
        }, 'VirtualAssistant.performSearch');

        this.viewManager.render('search', { query, results }, this.contentContainer);

        logger.debug('Search performed', { query, resultsCount: results.length });
    }

    /**
     * טיפול בלחיצה על פעולה
     */
    handleActionClick(actionId) {
        const action = ACTION_DATABASE[actionId];

        if (!action) {
            logger.warn('Action not found', { actionId });
            return;
        }

        logger.info('Action clicked', { actionId, title: action.title });

        // בדוק מה יש לפעולה
        if (action.fullGuide) {
            // יש הדרכה - הצע אותה
            this.startGuide(actionId);
        } else if (action.info) {
            // יש מידע - הצג אותו
            this.showInfo(actionId);
        } else if (action.directAction) {
            // פעולה ישירה - בצע
            this.executeAction(actionId);
        } else {
            logger.warn('No action available for this item', { actionId });
        }
    }

    /**
     * התחלת הדרכה
     */
    startGuide(actionId) {
        const action = ACTION_DATABASE[actionId];

        if (!action || !action.fullGuide) {
            logger.warn('Cannot start guide - no guide available', { actionId });
            return;
        }

        const success = this.guideEngine.startGuide(action);

        if (success) {
            this.stateManager.setState({
                view: 'guide',
                currentAction: actionId,
                guideActive: true
            }, 'VirtualAssistant.startGuide');

            this.updateGuideView();
        }
    }

    /**
     * עדכון תצוגת הדרכה
     */
    updateGuideView() {
        const step = this.guideEngine.getCurrentStep();
        const action = ACTION_DATABASE[this.stateManager.getState().currentAction];

        if (!step || !action) {
            logger.warn('Cannot update guide view - missing data');
            return;
        }

        this.viewManager.render('guide', {
            action,
            step
        }, this.contentContainer);
    }

    /**
     * הצגת מידע
     */
    showInfo(actionId) {
        const action = ACTION_DATABASE[actionId];

        if (!action || !action.info) {
            logger.warn('Cannot show info - no info available', { actionId });
            return;
        }

        this.stateManager.setState({
            view: 'info',
            currentAction: actionId
        }, 'VirtualAssistant.showInfo');

        this.viewManager.render('info', { action }, this.contentContainer);
    }

    /**
     * ביצוע פעולה ישירה
     */
    async executeAction(actionId) {
        const action = ACTION_DATABASE[actionId];

        if (!action) {
            logger.warn('Cannot execute - action not found', { actionId });
            return;
        }

        logger.info('Executing action', { actionId });

        const result = await this.actionEngine.execute(action);

        if (result.success) {
            logger.info('Action executed successfully', { actionId });

            // סגור את הבוט אם הפעולה פתחה משהו
            if (action.directAction) {
                setTimeout(() => this.close(), 500);
            }
        } else {
            logger.error('Action execution failed', { actionId, error: result.error });
        }

        return result;
    }

    /**
     * הצגת היסטוריה
     */
    showHistory() {
        const searchHistory = this.searchEngine.getHistory();
        const guideHistory = this.guideEngine.getHistory();

        logger.info('Showing history', {
            searches: searchHistory.length,
            guides: guideHistory.length
        });

        // TODO: Implement history view
        alert('היסטוריה - בפיתוח');
    }

    /**
     * קבלת instance
     */
    static getInstance() {
        if (!VirtualAssistant.instance) {
            new VirtualAssistant();
        }
        return VirtualAssistant.instance;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL ACCESS
// ═══════════════════════════════════════════════════════════════════════════

// יצירת instance גלובלי
window.virtualAssistant = VirtualAssistant.getInstance();

// פונקציה גלובלית לפתיחה
window.openVirtualAssistant = function() {
    window.virtualAssistant.open();
};

// פונקציה גלובלית לסגירה
window.closeVirtualAssistant = function() {
    window.virtualAssistant.close();
};

logger.info('VirtualAssistant global instance created');

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-INIT ON DOM READY
// ═══════════════════════════════════════════════════════════════════════════

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.virtualAssistant.init();
    });
} else {
    window.virtualAssistant.init();
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualAssistant;
}
