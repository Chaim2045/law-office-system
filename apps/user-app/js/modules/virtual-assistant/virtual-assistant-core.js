/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIRTUAL ASSISTANT - AI-Powered User Onboarding & Help System
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description מערכת עזרה אינטראקטיבית מתקדמת למשתמשים חדשים ומתקשים
 * @version 2.0.0
 * @architecture Clean Architecture + SOLID Principles
 * @author Law Office Management System
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 6: INFRASTRUCTURE - Error Handling & Logging
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class ErrorHandler
 * @description מערכת ניהול שגיאות מרכזית עם logging וtelemetry
 */
class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
        this.listeners = [];
    }

    /**
     * רישום שגיאה
     * @param {Error} error - השגיאה
     * @param {string} context - הקשר השגיאה
     * @param {Object} metadata - מידע נוסף
     */
    handleError(error, context = 'Unknown', metadata = {}) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack,
            context,
            metadata,
            userAgent: navigator.userAgent
        };

        this.errors.push(errorEntry);

        // שמירה על מגבלת זיכרון
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // התראה למפתחים בקונסול
        console.error(`[VirtualAssistant Error] ${context}:`, error, metadata);

        // הפעלת listeners
        this.notifyListeners(errorEntry);
    }

    /**
     * הוספת listener לשגיאות
     */
    onError(callback) {
        this.listeners.push(callback);
    }

    /**
     * התראה ל-listeners
     */
    notifyListeners(errorEntry) {
        this.listeners.forEach(listener => {
            try {
                listener(errorEntry);
            } catch (e) {
                console.error('[ErrorHandler] Listener failed:', e);
            }
        });
    }

    /**
     * קבלת כל השגיאות
     */
    getErrors() {
        return [...this.errors];
    }

    /**
     * ניקוי שגיאות
     */
    clearErrors() {
        this.errors = [];
    }
}

/**
 * @class Logger
 * @description מערכת logging מתקדמת עם רמות חומרה
 */
class Logger {
    static LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    };

    constructor(minLevel = Logger.LEVELS.WARN) {
        this.minLevel = minLevel;
        this.logs = [];
        this.maxLogs = 500;
    }

    /**
     * רישום log
     */
    log(level, message, data = {}) {
        if (level < this.minLevel) {
return;
}

        const logEntry = {
            timestamp: new Date().toISOString(),
            level: Object.keys(Logger.LEVELS)[level],
            message,
            data
        };

        this.logs.push(logEntry);

        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // 🔇 Production mode - no console output
        if (window.PRODUCTION_MODE !== false) {
return;
}

        // הדפסה לקונסול (dev mode only)
        const consoleMethod = level === Logger.LEVELS.ERROR ? 'error' :
                             level === Logger.LEVELS.WARN ? 'warn' : 'log';
        console[consoleMethod](`[VA] ${logEntry.level}: ${message}`, data);
    }

    debug(message, data) {
 this.log(Logger.LEVELS.DEBUG, message, data);
}
    info(message, data) {
 this.log(Logger.LEVELS.INFO, message, data);
}
    warn(message, data) {
 this.log(Logger.LEVELS.WARN, message, data);
}
    error(message, data) {
 this.log(Logger.LEVELS.ERROR, message, data);
}

    getLogs() {
 return [...this.logs];
}
    clearLogs() {
 this.logs = [];
}
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2: STATE MANAGEMENT - Observer Pattern
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class StateManager
 * @description ניהול מצב מרכזי עם Observer Pattern
 * @implements Immutable state updates
 */
class StateManager {
    constructor(initialState = {}) {
        this.state = { ...initialState };
        this.observers = new Map();
        this.history = [];
        this.maxHistory = 50;
    }

    /**
     * קבלת state נוכחי (immutable)
     */
    getState() {
        return Object.freeze({ ...this.state });
    }

    /**
     * עדכון state
     * @param {Object} updates - עדכונים למצב
     * @param {string} source - מקור העדכון (לdebug)
     */
    setState(updates, source = 'Unknown') {
        const oldState = { ...this.state };
        const newState = { ...this.state, ...updates };

        // שמירה בהיסטוריה
        this.history.push({
            timestamp: Date.now(),
            source,
            oldState,
            newState,
            changes: Object.keys(updates)
        });

        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        this.state = newState;

        // התראה לobservers
        this.notifyObservers(updates, oldState, newState);

        return Object.freeze({ ...this.state });
    }

    /**
     * הרשמה לשינויים במצב
     * @param {string} key - מפתח ייחודי
     * @param {Function} callback - פונקציית callback
     * @param {Array<string>} watchKeys - מפתחות לעקוב אחריהם
     */
    subscribe(key, callback, watchKeys = null) {
        this.observers.set(key, { callback, watchKeys });
    }

    /**
     * ביטול הרשמה
     */
    unsubscribe(key) {
        this.observers.delete(key);
    }

    /**
     * התראה לכל הobservers
     */
    notifyObservers(updates, oldState, newState) {
        this.observers.forEach(({ callback, watchKeys }, key) => {
            try {
                // אם יש watchKeys, בדוק רק אותם
                if (watchKeys && watchKeys.length > 0) {
                    const hasRelevantChanges = watchKeys.some(k => k in updates);
                    if (!hasRelevantChanges) {
return;
}
                }

                callback(newState, oldState, updates);
            } catch (error) {
                console.error(`[StateManager] Observer '${key}' failed:`, error);
            }
        });
    }

    /**
     * קבלת היסטוריה
     */
    getHistory() {
        return [...this.history];
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 5: INTEGRATION - Event Bus
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class EventBus
 * @description Pub/Sub event system
 */
class EventBus {
    constructor() {
        this.events = new Map();
    }

    /**
     * הרשמה לאירוע
     */
    on(event, handler) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(handler);
    }

    /**
     * ביטול הרשמה
     */
    off(event, handler) {
        if (!this.events.has(event)) {
return;
}

        const handlers = this.events.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
            handlers.splice(index, 1);
        }
    }

    /**
     * שליחת אירוע
     */
    emit(event, data = {}) {
        if (!this.events.has(event)) {
return;
}

        this.events.get(event).forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`[EventBus] Handler for '${event}' failed:`, error);
            }
        });
    }

    /**
     * הרשמה לאירוע חד-פעמי
     */
    once(event, handler) {
        const onceHandler = (data) => {
            handler(data);
            this.off(event, onceHandler);
        };
        this.on(event, onceHandler);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 5: INTEGRATION - DOM Controller & System Bridge
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class DOMController
 * @description בקר DOM בטוח עם error handling
 */
class DOMController {
    /**
     * בחירת אלמנט בטוחה
     */
    static querySelector(selector) {
        try {
            const element = document.querySelector(selector);
            if (!element) {
                logger.warn(`Element not found: ${selector}`);
            }
            return element;
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.querySelector', { selector });
            return null;
        }
    }

    /**
     * בחירת אלמנטים מרובים
     */
    static querySelectorAll(selector) {
        try {
            return Array.from(document.querySelectorAll(selector));
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.querySelectorAll', { selector });
            return [];
        }
    }

    /**
     * יצירת אלמנט
     */
    static createElement(tag, options = {}) {
        try {
            const element = document.createElement(tag);

            if (options.className) {
element.className = options.className;
}
            if (options.id) {
element.id = options.id;
}
            if (options.innerHTML) {
element.innerHTML = options.innerHTML;
}
            if (options.textContent) {
element.textContent = options.textContent;
}
            if (options.attributes) {
                Object.entries(options.attributes).forEach(([key, value]) => {
                    element.setAttribute(key, value);
                });
            }
            if (options.styles) {
                Object.assign(element.style, options.styles);
            }
            if (options.events) {
                Object.entries(options.events).forEach(([event, handler]) => {
                    element.addEventListener(event, handler);
                });
            }

            return element;
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.createElement', { tag, options });
            return null;
        }
    }

    /**
     * הסרת אלמנט בטוחה
     */
    static removeElement(element) {
        try {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
                return true;
            }
            return false;
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.removeElement');
            return false;
        }
    }

    /**
     * הוספת class
     */
    static addClass(element, className) {
        try {
            if (element) {
element.classList.add(className);
}
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.addClass', { className });
        }
    }

    /**
     * הסרת class
     */
    static removeClass(element, className) {
        try {
            if (element) {
element.classList.remove(className);
}
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.removeClass', { className });
        }
    }

    /**
     * בדיקת קיום class
     */
    static hasClass(element, className) {
        try {
            return element ? element.classList.contains(className) : false;
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.hasClass', { className });
            return false;
        }
    }

    /**
     * הדגשת אלמנט במערכת
     */
    static highlightElement(selector, options = {}) {
        const element = this.querySelector(selector);
        if (!element) {
return null;
}

        const {
            duration = 3000,
            pulse = true,
            tooltip = null,
            scrollIntoView = true
        } = options;

        try {
            // גלילה לאלמנט
            if (scrollIntoView) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // הוספת אנימציית הדגשה
            const overlay = this.createElement('div', {
                className: 'va-highlight-overlay',
                styles: {
                    position: 'absolute',
                    pointerEvents: 'none',
                    border: '3px solid #3b82f6',
                    borderRadius: '8px',
                    boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
                    zIndex: '10000',
                    animation: pulse ? 'va-pulse 1.5s infinite' : 'none'
                }
            });

            // מיקום ה-overlay
            const rect = element.getBoundingClientRect();
            Object.assign(overlay.style, {
                top: `${rect.top + window.scrollY - 4}px`,
                left: `${rect.left + window.scrollX - 4}px`,
                width: `${rect.width + 8}px`,
                height: `${rect.height + 8}px`
            });

            document.body.appendChild(overlay);

            // tooltip אם צריך
            if (tooltip) {
                const tooltipEl = this.createElement('div', {
                    className: 'va-highlight-tooltip',
                    textContent: tooltip,
                    styles: {
                        position: 'absolute',
                        top: `${rect.top + window.scrollY - 40}px`,
                        left: `${rect.left + window.scrollX + rect.width / 2}px`,
                        transform: 'translateX(-50%)',
                        background: '#1f2937',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        zIndex: '10001',
                        whiteSpace: 'nowrap',
                        animation: 'va-fadeIn 0.3s ease'
                    }
                });
                document.body.appendChild(tooltipEl);

                // הסרה אחרי duration
                setTimeout(() => {
                    this.removeElement(tooltipEl);
                }, duration);
            }

            // הסרת ההדגשה
            setTimeout(() => {
                this.removeElement(overlay);
            }, duration);

            return { overlay, element };
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.highlightElement', { selector, options });
            return null;
        }
    }
}

/**
 * @class SystemBridge
 * @description גשר לפונקציות קיימות במערכת
 */
class SystemBridge {
    /**
     * פתיחת טופס חכם
     */
    static openSmartForm(formType = null) {
        try {
            if (typeof window.openSmartForm === 'function') {
                logger.info('Opening smart form', { formType });
                window.openSmartForm(formType);
                eventBus.emit('system:form-opened', { formType });
                return true;
            } else {
                logger.warn('openSmartForm function not found');
                return false;
            }
        } catch (error) {
            errorHandler.handleError(error, 'SystemBridge.openSmartForm', { formType });
            return false;
        }
    }

    /**
     * הפעלת סיור מערכת
     */
    static startSystemTour() {
        try {
            if (typeof window.systemTour === 'object' && window.systemTour.start) {
                logger.info('Starting system tour');
                window.systemTour.start();
                eventBus.emit('system:tour-started');
                return true;
            } else {
                logger.warn('systemTour not found');
                return false;
            }
        } catch (error) {
            errorHandler.handleError(error, 'SystemBridge.startSystemTour');
            return false;
        }
    }

    /**
     * קבלת שם משתמש
     */
    static getUserName() {
        try {
            // נסה מ-localStorage
            const user = localStorage.getItem('currentUser');
            if (user) {
                const userData = JSON.parse(user);
                return userData.name || userData.email || 'משתמש';
            }

            // נסה מ-sessionStorage
            const sessionUser = sessionStorage.getItem('userName');
            if (sessionUser) {
return sessionUser;
}

            return 'משתמש';
        } catch (error) {
            errorHandler.handleError(error, 'SystemBridge.getUserName');
            return 'משתמש';
        }
    }

    /**
     * ניווט לטאב במערכת
     */
    static navigateToTab(tabName) {
        try {
            const tabMap = {
                'tasks': '#tasksTab',
                'timesheet': '#timesheetTab',
                'clients': '#clientsTab',
                'reports': '#reportsTab'
            };

            const selector = tabMap[tabName];
            if (!selector) {
                logger.warn(`Unknown tab: ${tabName}`);
                return false;
            }

            const tabElement = DOMController.querySelector(selector);
            if (tabElement) {
                tabElement.click();
                logger.info(`Navigated to tab: ${tabName}`);
                eventBus.emit('system:tab-changed', { tabName });
                return true;
            }

            return false;
        } catch (error) {
            errorHandler.handleError(error, 'SystemBridge.navigateToTab', { tabName });
            return false;
        }
    }

    /**
     * בדיקה אם משתמש הוא מנהל
     */
    static isAdmin() {
        try {
            const user = localStorage.getItem('currentUser');
            if (user) {
                const userData = JSON.parse(user);
                return userData.isAdmin === true || userData.role === 'admin';
            }
            return false;
        } catch (error) {
            errorHandler.handleError(error, 'SystemBridge.isAdmin');
            return false;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 4: DATA - Action Database
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @constant ACTION_DATABASE
 * @description מסד נתונים של כל הפעולות האפשריות במערכת
 * @structure {
 *   id: string,
 *   title: string,
 *   icon: string,
 *   category: string,
 *   keywords: string[],
 *   quickSteps: string[],
 *   fullGuide: {
 *     steps: Array<{
 *       title, description, action, highlight, waitFor, validation
 *     }>
 *   }
 * }
 */
const ACTION_DATABASE = {
    // ═══════════════════════════════════════════════════════
    // דיווח שעות
    // ═══════════════════════════════════════════════════════
    'report_hours': {
        id: 'report_hours',
        title: 'דיווח שעות עבודה',
        icon: '📝',
        category: 'timesheet',
        keywords: ['דווח שעות', 'רישום שעות', 'הוסף שעות', 'timesheet', 'שעתון'],
        quickSteps: [
            'לחץ על כפתור + בראש המסך',
            'בחר "דווח שעות"',
            'מלא תאריך, דקות ותיאור',
            'לחץ "הוסף לשעתון"'
        ],
        fullGuide: {
            totalSteps: 5,
            steps: [
                {
                    number: 1,
                    title: 'פתיחת תפריט הוספה מהירה',
                    description: 'ראשית, בואו נפתח את טופס דיווח השעות. לחץ על הכפתור הכחול + שנמצא במרכז החלק העליון של המסך.',
                    highlight: '#smartPlusBtn',
                    action: () => {
                        // ממתינים לפתיחה ידנית או מציעים פתיחה אוטומטית
                        return {
                            type: 'button',
                            text: 'פתח את התפריט עבורי',
                            handler: () => SystemBridge.openSmartForm()
                        };
                    },
                    validation: () => {
                        // בדוק אם התפריט נפתח
                        const modal = DOMController.querySelector('#smartFormModal');
                        return modal && !DOMController.hasClass(modal, 'hidden');
                    }
                },
                {
                    number: 2,
                    title: 'בחירת "דווח שעות"',
                    description: 'עכשיו, בחר באפשרות "דווח שעות" מהתפריט שנפתח.',
                    highlight: '.smart-form-option[data-type="timesheet"]',
                    action: () => ({
                        type: 'button',
                        text: 'בחר עבורי',
                        handler: () => {
                            const option = DOMController.querySelector('.smart-form-option[data-type="timesheet"]');
                            if (option) {
option.click();
}
                        }
                    }),
                    validation: () => {
                        const timesheetForm = DOMController.querySelector('#timesheetFormContainer');
                        return timesheetForm && !DOMController.hasClass(timesheetForm, 'hidden');
                    }
                },
                {
                    number: 3,
                    title: 'מילוי פרטי הדיווח',
                    description: `הגיע הזמן למלא את הפרטים:

• **תאריך**: בחר את התאריך שבו עבדת (ברירת מחדל: היום)
• **דקות**: הזן כמה דקות עבדת (1-999)
• **לקוח ותיק**: חפש ובחר את הלקוח (או סמן "פעילות פנימית")
• **תיאור**: תאר מה עשית (לפחות 3 תווים)`,
                    highlight: '#timesheetFormContainer',
                    tips: [
                        '💡 אם זו פעילות משרדית, סמן את "פעילות משרדית פנימית"',
                        '⏱️ ניתן להזין גם שעות (המערכת תמיר לדקות)',
                        '🔍 החיפוש מתעדכן אוטומטית תוך כדי הקלדה'
                    ]
                },
                {
                    number: 4,
                    title: 'שמירת הדיווח',
                    description: 'וודא שמילאת את כל השדות הנדרשים, ולחץ על "הוסף לשעתון".',
                    highlight: '#submitTimesheetBtn',
                    action: () => ({
                        type: 'info',
                        text: 'לא אוכל לשמור עבורך - וודא שהפרטים נכונים!'
                    })
                },
                {
                    number: 5,
                    title: 'אישור והצלחה',
                    description: 'מעולה! הדיווח נשמר בהצלחה. תוכל לראות אותו ברשימת הדיווחים בטאב "שעתון".',
                    tips: [
                        '✅ הדיווח התווסף לסיכום השעות השבועי',
                        '📊 ניתן לערוך את הדיווח בכל עת',
                        '🔄 ניתן לדווח גם ישירות מהשלמת משימה'
                    ]
                }
            ]
        }
    },

    // ═══════════════════════════════════════════════════════
    // יצירת משימה
    // ═══════════════════════════════════════════════════════
    'create_task': {
        id: 'create_task',
        title: 'יצירת משימת תקצוב',
        icon: '✅',
        category: 'tasks',
        keywords: ['משימה חדשה', 'תקצוב', 'הוסף משימה', 'task', 'todo'],
        quickSteps: [
            'לחץ על + ובחר "משימה חדשה"',
            'בחר לקוח ותיק',
            'הזן תיאור ודקות משוערות',
            'בחר תאריך יעד ושמור'
        ],
        fullGuide: {
            totalSteps: 4,
            steps: [
                {
                    number: 1,
                    title: 'פתיחת טופס משימה',
                    description: 'לחץ על + בראש המסך ובחר "משימה חדשה"',
                    highlight: '#smartPlusBtn',
                    action: () => ({
                        type: 'button',
                        text: 'פתח טופס משימה',
                        handler: () => SystemBridge.openSmartForm('task')
                    })
                },
                {
                    number: 2,
                    title: 'בחירת לקוח ותיק',
                    description: 'חפש ובחר את הלקוח והתיק הרלוונטיים. החיפוש עובד על שם, ת.ז., טלפון ואימייל.',
                    highlight: '#taskClientSearch',
                    tips: ['🔍 ניתן לחפש גם לפי מספר תיק']
                },
                {
                    number: 3,
                    title: 'פרטי המשימה',
                    description: `מלא את פרטי המשימה:

• **תיאור**: מה צריך לעשות? (מינימום 3 תווים)
• **דקות משוערות**: כמה זמן תיקח המשימה?
• **תאריך יעד**: מתי צריך לסיים?`,
                    highlight: '#taskFormFields'
                },
                {
                    number: 4,
                    title: 'שמירה',
                    description: 'לחץ "הוסף לתקצוב". המשימה תופיע ב"פעילות בלבד".',
                    highlight: '#submitTaskBtn'
                }
            ]
        }
    },

    // ═══════════════════════════════════════════════════════
    // יצירת תיק
    // ═══════════════════════════════════════════════════════
    'create_case': {
        id: 'create_case',
        title: 'פתיחת תיק חדש',
        icon: '📁',
        category: 'clients',
        keywords: ['תיק חדש', 'לקוח חדש', 'case', 'client', 'פתח תיק'],
        quickSteps: [
            'לחץ על "תיק חדש" בצד',
            'בחר או צור לקוח',
            'בחר סוג תיק (שעות/הליך/מחיר קבוע)',
            'הזן פרטים ושמור'
        ],
        fullGuide: {
            totalSteps: 3,
            steps: [
                {
                    number: 1,
                    title: 'פתיחת טופס',
                    description: 'לחץ על "תיק חדש" בסרגל הצדדי או Ctrl+N',
                    highlight: '#newCaseBtn',
                    action: () => ({
                        type: 'button',
                        text: 'פתח טופס תיק',
                        handler: () => SystemBridge.openSmartForm('case')
                    })
                },
                {
                    number: 2,
                    title: 'פרטי התיק',
                    description: `מלא את פרטי התיק:

• **לקוח**: בחר קיים או צור חדש
• **סוג תיק**: שעות / הליך משפטי / מחיר קבוע
• **כותרת**: שם התיק
• **עו"ד מטפל**: מי אחראי על התיק`,
                    highlight: '#caseFormFields'
                },
                {
                    number: 3,
                    title: 'שמירה',
                    description: 'בחר תאריך התחלה ולחץ "צור תיק"',
                    highlight: '#submitCaseBtn'
                }
            ]
        }
    },

    // ═══════════════════════════════════════════════════════
    // חיפוש לקוח
    // ═══════════════════════════════════════════════════════
    'search_client': {
        id: 'search_client',
        title: 'חיפוש לקוח',
        icon: '🔍',
        category: 'clients',
        keywords: ['חפש לקוח', 'מצא לקוח', 'search', 'find client'],
        quickSteps: [
            'השתמש בשדה החיפוש בכל טופס',
            'הקלד שם / ת.ז. / טלפון / אימייל',
            'התוצאות מתעדכנות אוטומטית',
            'לחץ על התוצאה הרצויה'
        ],
        fullGuide: {
            totalSteps: 2,
            steps: [
                {
                    number: 1,
                    title: 'שדה חיפוש',
                    description: 'בכל טופס יש שדה חיפוש מהיר. החיפוש עובד על כל השדות של הלקוח.',
                    tips: [
                        '📝 חפש לפי שם מלא או חלקי',
                        '🆔 חפש לפי ת.ז.',
                        '📞 חפש לפי מספר טלפון',
                        '📧 חפש לפי אימייל'
                    ]
                },
                {
                    number: 2,
                    title: 'בחירת תוצאה',
                    description: 'התוצאות מתעדכנות תוך כדי הקלדה (300ms). לחץ על התוצאה הרצויה.',
                    tips: ['⚡ החיפוש מיידי וחכם']
                }
            ]
        }
    },

    // ═══════════════════════════════════════════════════════
    // קיצורי מקלדת
    // ═══════════════════════════════════════════════════════
    'keyboard_shortcuts': {
        id: 'keyboard_shortcuts',
        title: 'קיצורי מקלדת',
        icon: '⌨️',
        category: 'general',
        keywords: ['קיצורים', 'מקלדת', 'shortcuts', 'keys'],
        quickSteps: null, // אין צעדים - זה מידע בלבד
        info: {
            title: 'קיצורי מקלדת שימושיים',
            shortcuts: [
                { keys: 'Ctrl + N', description: 'פתיחת טופס חדש (משימה/תיק)' },
                { keys: 'Ctrl + F', description: 'מעבר לשדה חיפוש' },
                { keys: 'Ctrl + S', description: 'שמירת טופס' },
                { keys: 'Esc', description: 'סגירת דיאלוג/מודאל' },
                { keys: 'F1', description: 'פתיחת העוזר החכם (אני!)' }
            ]
        }
    },

    // ═══════════════════════════════════════════════════════
    // סיור במערכת
    // ═══════════════════════════════════════════════════════
    'system_tour': {
        id: 'system_tour',
        title: 'סיור במערכת',
        icon: '🎯',
        category: 'general',
        keywords: ['סיור', 'הדרכה', 'tour', 'guide', 'למידה'],
        quickSteps: null,
        action: () => SystemBridge.startSystemTour(),
        info: {
            title: 'סיור אינטראקטיבי',
            description: 'סיור מודרך של 9 שלבים שילמד אותך את כל התכונות במערכת',
            duration: 'כ-5 דקות',
            features: [
                '9 שלבים מודרכים',
                'כ-5 דקות',
                'למידה אינטראקטיבית',
                'ניתן להפסיק בכל עת'
            ]
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS - Global instances
// ═══════════════════════════════════════════════════════════════════════════

const errorHandler = new ErrorHandler();
const logger = new Logger(Logger.LEVELS.INFO);
const eventBus = new EventBus();

// המשך יבוא בשלב הבא...
