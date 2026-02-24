/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIRTUAL ASSISTANT - COMPLETE BUNDLE (Single File)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @description מערכת עזרה אינטראקטיבית מלאה - קובץ יחיד עצמאי
 * @version 3.9.0
 * @author Law Office Management System
 *
 * @features
 * - 🚀 TWO-TIER HELP SYSTEM: Quick Actions + Detailed Guides (Progressive Disclosure)
 * - 🎯 Quick Action First: Simple "magic button" for 80% users (age 40-60 friendly!)
 * - 📖 Detailed Guide Optional: Step-by-step available on request
 * - 💡 Professional UX: Action-First Design, Reduce Cognitive Load
 * - ✅ Example: create_task uses Quick Action model
 * - Smart Compact Mode: הצ'אט בוט מקטין עצמו בגובה כשאלמנטים גדולים
 * - Smart Tab Detection: זיהוי אוטומטי של הטאב הנוכחי והצעות מותאמות
 * - Context Awareness: הצ'אט בוט יודע באיזה עמוד המשתמש נמצא
 * - Smart Collision Detection: הצ'אט בוט זז הצידה + מקטין גובה בהתנגשות
 * - Pills-Style Cards: כרטיסיות מעוגלות - אייקון למעלה, טקסט למטה
 * - Smart Grid: 2 עמודות במובייל, 3 עמודות בדסקטופ
 * - Professional Design: עיצוב מינימליסטי ומקצועי למשרד עו"ד
 * - Smart Search: חיפוש חכם עם תוצאות מיידיות, הדגשה, והצעות
 * - Quick Actions: כפתורי פעולה מהירים עם מעבר טאבים אוטומטי
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

(function() {

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1: INFRASTRUCTURE - Error Handling & Logging
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class ErrorHandler
 * @description מערכת ניהול שגיאות מרכזית
 */
class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
        this.listeners = [];
    }

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

        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        console.error(`[VirtualAssistant Error] ${context}:`, error, metadata);

        this.notifyListeners(errorEntry);
    }

    onError(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(errorEntry) {
        this.listeners.forEach(listener => {
            try {
                listener(errorEntry);
            } catch (e) {
                console.error('[ErrorHandler] Listener failed:', e);
            }
        });
    }

    getErrors() {
        return [...this.errors];
    }

    clearErrors() {
        this.errors = [];
    }
}

/**
 * @class Logger
 * @description מערכת logging מתקדמת
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
// LAYER 2: STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class StateManager
 * @description ניהול מצב מרכזי עם Observer Pattern
 */
class StateManager {
    constructor(initialState = {}) {
        this.state = { ...initialState };
        this.observers = new Map();
        this.history = [];
        this.maxHistory = 50;
    }

    getState() {
        return Object.freeze({ ...this.state });
    }

    setState(updates, source = 'Unknown') {
        const oldState = { ...this.state };
        const newState = { ...this.state, ...updates };

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

        this.notifyObservers(updates, oldState, newState);

        return Object.freeze({ ...this.state });
    }

    subscribe(key, callback, watchKeys = null) {
        this.observers.set(key, { callback, watchKeys });
    }

    unsubscribe(key) {
        this.observers.delete(key);
    }

    notifyObservers(updates, oldState, newState) {
        this.observers.forEach(({ callback, watchKeys }, key) => {
            try {
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

    getHistory() {
        return [...this.history];
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 3: EVENT BUS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class EventBus
 * @description Pub/Sub event system
 */
class EventBus {
    constructor() {
        this.events = new Map();
    }

    on(event, handler) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(handler);
    }

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

    once(event, handler) {
        const onceHandler = (data) => {
            handler(data);
            this.off(event, onceHandler);
        };
        this.on(event, onceHandler);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 4: DOM CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class DOMController
 * @description בקר DOM בטוח
 */
class DOMController {
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

    static querySelectorAll(selector) {
        try {
            return Array.from(document.querySelectorAll(selector));
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.querySelectorAll', { selector });
            return [];
        }
    }

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

    static addClass(element, className) {
        try {
            if (element) {
element.classList.add(className);
}
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.addClass', { className });
        }
    }

    static removeClass(element, className) {
        try {
            if (element) {
element.classList.remove(className);
}
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.removeClass', { className });
        }
    }

    static hasClass(element, className) {
        try {
            return element ? element.classList.contains(className) : false;
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.hasClass', { className });
            return false;
        }
    }

    /**
     * 🎯 Smart Collision Detection
     * בודק אם הצ'אט בוט מכסה את האלמנט ומזיז אותו הצידה אם צריך
     * אם יש חפיפה גם אחרי הזזה - עובר למצב compact
     */
    static smartMoveIfCovering(element) {
        try {
            const chatbot = this.querySelector('#va-container');
            if (!chatbot || this.hasClass(chatbot, 'va-hidden')) {
                return false; // הצ'אט בוט סגור, אין צורך להזיז
            }

            const elementRect = element.getBoundingClientRect();
            const chatbotRect = chatbot.getBoundingClientRect();

            // בדיקת חפיפה אופקית (שמאל-ימין)
            const horizontalOverlap = !(
                elementRect.right < chatbotRect.left ||
                elementRect.left > chatbotRect.right
            );

            // בדיקת חפיפה אנכית (למעלה-למטה)
            const verticalOverlap = !(
                elementRect.bottom < chatbotRect.top ||
                elementRect.top > chatbotRect.bottom
            );

            const isOverlapping = horizontalOverlap && verticalOverlap;

            if (isOverlapping) {
                // 📍 יש חפיפה! הזז את הצ'אט בוט ימינה
                chatbot.classList.add('va-moved-aside');
                logger.info('Chatbot moved aside to reveal element', { selector: element.id || element.className });

                // 🔍 בדיקה נוספת: האם יש חפיפה גם אחרי הזזה?
                setTimeout(() => {
                    const newChatbotRect = chatbot.getBoundingClientRect();
                    const stillOverlapping = !(
                        elementRect.bottom < newChatbotRect.top ||
                        elementRect.top > newChatbotRect.bottom
                    );

                    if (stillOverlapping) {
                        // 📦 עדיין יש חפיפה בגובה - עבור למצב compact!
                        chatbot.classList.add('va-compact-mode');
                        logger.info('Chatbot switched to compact mode due to vertical overlap');
                    }
                }, 50); // המתן קצר שהאנימציה תסתיים

                return true;
            }

            return false;
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.smartMoveIfCovering');
            return false;
        }
    }

    /**
     * 🔄 החזר את הצ'אט בוט למקום המקורי
     */
    static resetChatbotPosition() {
        try {
            const chatbot = this.querySelector('#va-container');
            if (chatbot) {
                chatbot.classList.remove('va-moved-aside');
                chatbot.classList.remove('va-compact-mode');
                logger.info('Chatbot returned to original position and size');
            }
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.resetChatbotPosition');
        }
    }

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
            if (scrollIntoView) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // 🎯 Smart Collision Detection: Check if chatbot covers the element
            const chatbotMoved = this.smartMoveIfCovering(element);

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

            const rect = element.getBoundingClientRect();
            Object.assign(overlay.style, {
                top: `${rect.top + window.scrollY - 4}px`,
                left: `${rect.left + window.scrollX - 4}px`,
                width: `${rect.width + 8}px`,
                height: `${rect.height + 8}px`
            });

            document.body.appendChild(overlay);

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

                setTimeout(() => {
                    this.removeElement(tooltipEl);
                }, duration);
            }

            if (duration > 0) {
                setTimeout(() => {
                    this.removeElement(overlay);
                    // החזר את הצ'אט בוט למקום המקורי
                    if (chatbotMoved) {
                        this.resetChatbotPosition();
                    }
                }, duration);
            }

            return { overlay, element, chatbotMoved };
        } catch (error) {
            errorHandler.handleError(error, 'DOMController.highlightElement', { selector, options });
            return null;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 5: SYSTEM BRIDGE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class SystemBridge
 * @description גשר לפונקציות קיימות במערכת
 */
class SystemBridge {
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

    static startSystemTour() {
        try {
            logger.info('Starting system tour');

            // Show welcome message with available guides
            const va = window.VirtualAssistant?.getInstance?.();
            if (va) {
                // Show home screen with all available guides
                va.showHome();

                // Show notification
                if (typeof window.NotificationSystem?.show === 'function') {
                    window.NotificationSystem.show(
                        'ברוך הבא! 👋',
                        'בחר נושא מהרשימה למטה כדי להתחיל',
                        'info'
                    );
                }
            }

            eventBus.emit('system:tour-started');
            return true;
        } catch (error) {
            errorHandler.handleError(error, 'SystemBridge.startSystemTour');
            return false;
        }
    }

    static getUserName() {
        try {
            // Try to get from DOM (currentUserDisplay element)
            const userDisplay = document.getElementById('currentUserDisplay');
            if (userDisplay && userDisplay.textContent) {
                // Extract name from "userName - משרד עו"ד..." format
                const text = userDisplay.textContent.trim();
                const name = text.split('-')[0].trim();
                if (name && name !== '') {
                    return name;
                }
            }

            // Try to get from user avatar
            const userAvatar = document.querySelector('.user-avatar');
            if (userAvatar) {
                const avatarText = userAvatar.querySelector('span');
                if (avatarText && avatarText.textContent) {
                    return avatarText.textContent.trim();
                }
            }

            // Try localStorage
            const user = localStorage.getItem('currentUser');
            if (user) {
                const userData = JSON.parse(user);
                return userData.name || userData.email || 'משתמש';
            }

            // Try sessionStorage
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
// ═══════════════════════════════════════════════════════════════════════════
// LAYER 6: ICON SYSTEM - SVG Icons
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class IconSystem
 * @description מערכת אייקונים מקצועית עם SVG
 */
class IconSystem {
    static icons = {
        // Actions
        'timesheet': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="13" y2="18"/></svg>',
        'task': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
        'folder': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
        'search': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
        'keyboard': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>',
        'tour': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',

        // UI Elements
        'info': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        'check': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
        'alert': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        'ban': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
        'clock': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        'chart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
        'refresh': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/></svg>',
        'user': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        'calendar': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        'edit': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        'play': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
        'book': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
        'bulb': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 019 14"/></svg>',
        'save': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
        'plus': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        'target': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
        'spark': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
        'command': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z"/></svg>'
    };

    static get(name, className = '') {
        const svg = this.icons[name] || this.icons.info;
        return `<span class="va-icon ${className}">${svg}</span>`;
    }

    static getInline(name) {
        return this.icons[name] || this.icons.info;
    }
}

// CREATE GLOBAL INSTANCES (must be before data layer uses them)
// ═══════════════════════════════════════════════════════════════════════════

const errorHandler = new ErrorHandler();
const logger = new Logger(Logger.LEVELS.INFO);
const eventBus = new EventBus();

// Expose SystemBridge globally for eval() in action buttons
window.SystemBridge = SystemBridge;

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 6: DATA - Action Database
// ═══════════════════════════════════════════════════════════════════════════

const ACTION_DATABASE = {
    'report_hours': {
        id: 'report_hours',
        title: 'דיווח פעילות פנימית',
        icon: 'timesheet',
        category: 'timesheet',
        keywords: ['דווח שעות', 'פעילות פנימית', 'פעילות משרדית', 'ישיבה', 'הדרכה', 'ניהול', 'timesheet', 'שעתון', 'דיווח פנימי'],
        quickSteps: [
            'לחץ על כפתור + בטאב "שעתון"',
            'מלא תאריך ודקות',
            'תאר את הפעילות הפנימית (ישיבה, הדרכה, וכו\')',
            'לחץ "הוסף פעילות פנימית"'
        ],
        fullGuide: {
            totalSteps: 4,
            steps: [
                {
                    number: 1,
                    title: '⚠️ חשוב לדעת',
                    description: `**שעתון זה רק לפעילות פנימית!** 🏢

זמן עבודה על לקוחות נרשם **אוטומטית** כשאתה מוסיף זמן למשימה.

**כאן רושמים רק:**
- 📋 ישיבות צוות
- 📧 שליחת מיילים כלליים
- 🎓 הדרכות
- 🔧 ניהול משרד`,
                    tips: [
                        '💡 זמן על לקוחות = "הוסף זמן למשימה"',
                        '🏢 זמן משרדי = "דווח בשעתון"'
                    ]
                },
                {
                    number: 2,
                    title: 'פתיחת טופס דיווח',
                    description: 'מעבר לטאב **"שעתון"** ולחץ על הכפתור **+** בראש המסך.',
                    highlight: '#smartPlusBtn',
                    actionButton: {
                        text: '🚀 פתח את הטופס עבורי',
                        handler: '(() => { window.switchTab?.("timesheet"); setTimeout(() => SystemBridge.openSmartForm(), 200); })()'
                    }
                },
                {
                    number: 3,
                    title: 'מילוי פרטי הפעילות',
                    description: `מלא את הפרטים:

**📅 תאריך**: איזה יום (ברירת מחדל: היום)

**⏱️ דקות**: כמה זמן לקח (1-999)

**📝 תיאור**: מה עשית? (למשל: "ישיבת צוות שבועית")

**💬 הערות**: הערות נוספות (אופציונלי)`,
                    highlight: '#timesheetFormContainer',
                    tips: [
                        '⏱️ ניתן להזין גם שעות (המערכת תמיר לדקות)'
                    ]
                },
                {
                    number: 4,
                    title: 'שמירה',
                    description: 'לחץ על **"הוסף פעילות פנימית"** ✅',
                    highlight: '#submitTimesheetBtn',
                    tips: [
                        '✅ הפעילות תופיע בטאב "שעתון"',
                        '📊 ניתן לערוך או למחוק בכל עת'
                    ]
                }
            ]
        }
    },

    'add_time_to_task': {
        id: 'add_time_to_task',
        title: 'הוסף זמן עבודה למשימה',
        icon: 'timesheet',
        category: 'budget',
        keywords: ['הוסף זמן', 'דיווח זמן', 'זמן למשימה', 'עבודה על לקוח', 'רישום שעות לקוח', 'timesheet', 'זמן עבודה'],
        quickSteps: [
            'מצא את המשימה בטאב "תקצוב משימות"',
            'לחץ על כפתור "⏱️ הוסף זמן" בכרטיס המשימה',
            'הזן כמה דקות עבדת',
            'לחץ "שמור" - זה נרשם אוטומטית בשעתון!'
        ],
        fullGuide: {
            totalSteps: 4,
            steps: [
                {
                    number: 1,
                    title: '💡 כך מדווחים זמן על לקוחות',
                    description: `**זה הדרך הנכונה לדווח זמן עבודה על לקוחות!**

כשאתה עובד על משימה של לקוח:
1️⃣ מוסיפים זמן למשימה
2️⃣ המערכת **אוטומטית** רושמת את זה בשעתון

**אין צורך** לדווח בנפרד בטאב שעתון!`,
                    tips: [
                        '⏱️ זמן על לקוחות = "הוסף זמן למשימה"',
                        '🏢 זמן משרדי = "דווח בשעתון"'
                    ]
                },
                {
                    number: 2,
                    title: 'מעבר לטאב תקצוב משימות',
                    description: `ודא שאתה נמצא בטאב **"תקצוב משימות"** (לא שעתון).

כאן תראה את רשימת כל המשימות שלך.`,
                    actionButton: {
                        text: '🚀 עבור לטאב תקצוב',
                        handler: '(() => { window.switchTab?.("budget"); })()'
                    },
                    tips: [
                        '📋 כל המשימות הפעילות מופיעות כאן'
                    ]
                },
                {
                    number: 3,
                    title: 'לחיצה על "הוסף זמן"',
                    description: `מצא את המשימה שעבדת עליה.

בכרטיס המשימה, לחץ על הכפתור **"⏱️ הוסף זמן"**

**היכן הכפתור?**
- 🎴 **בתצוגת כרטיסיות**: כפתור כחול עם שעון
- 📋 **בתצוגת טבלה**: אייקון שעון בעמודת הפעולות`,
                    tips: [
                        '🔍 אם אין כפתור - המשימה כבר הושלמה',
                        '⏰ אפשר להוסיף זמן כמה פעמים שרוצים'
                    ]
                },
                {
                    number: 4,
                    title: 'הזנת זמן ושמירה',
                    description: `ייפתח דיאלוג "הוסף זמן למשימה".

הזן כמה **דקות** עבדת (למשל: 60 = שעה).

לחץ **"שמור"** והמערכת **אוטומטית**:
✅ רושמת את הזמן בשעתון
✅ מעדכנת את התקציב
✅ קושרת ללקוח ולתיק

תוכל לראות את הדיווח בטאב **"שעתון"**.`,
                    tips: [
                        '📈 הכל מסודר ומקושר אוטומטית!',
                        '🎯 אין צורך בדיווח נפרד'
                    ]
                }
            ]
        }
    },

    'create_task': {
        id: 'create_task',
        title: 'יצירת משימת תקצוב',
        icon: 'task',
        category: 'budget',
        keywords: ['משימה חדשה', 'תקצוב', 'הוסף משימה', 'task', 'todo', 'משימה'],

        // 🎯 Quick Action - פעולה מהירה (רמה 1)
        quickAction: {
            buttonText: '🚀 פתח טופס משימה',
            buttonAction: '(() => { window.switchTab?.("budget"); setTimeout(() => window.openSmartForm?.(), 200); })()',
            helpText: '💡 בחר לקוח, מלא פרטי המשימה ולחץ "הוסף לתקצוב"',
            tips: [
                '✅ הטופס יפתח אוטומטית בטאב התקצוב',
                '⏱️ הזן דקות משוערות וקבע תאריך יעד'
            ]
        },

        // 📖 Detailed Guide - מדריך מפורט (רמה 2 - אופציונלי)
        detailedGuide: {
            available: true,
            linkText: 'רוצה הסבר צעד אחר צעד? לחץ כאן →',
            fullGuide: {
                totalSteps: 4,
                steps: [
                    {
                        number: 1,
                        title: 'פתיחת טופס משימה',
                        description: 'לחץ על הכפתור **+** בראש המסך',
                        highlight: '#smartPlusBtn',
                        actionButton: {
                            text: '🚀 פתח טופס משימה',
                            handler: '(() => { window.switchTab?.("budget"); setTimeout(() => window.openSmartForm?.(), 200); })()'
                        }
                    },
                    {
                        number: 2,
                        title: 'בחירת לקוח ותיק',
                        description: 'חפש ובחר את הלקוח והתיק הרלוונטיים.\n\nהחיפוש עובד על שם, ת.ז., טלפון ואימייל.',
                        highlight: '#budgetClientCaseSelector',
                        tips: ['🔍 ניתן לחפש גם לפי מספר תיק']
                    },
                    {
                        number: 3,
                        title: 'פרטי המשימה',
                        description: `מלא את פרטי המשימה:

**📝 תיאור**: מה צריך לעשות? (מינימום 3 תווים)

**⏱️ דקות משוערות**: כמה זמן תיקח המשימה?

**📅 תאריך יעד**: מתי צריך לסיים?`,
                        highlight: '#budgetForm'
                    },
                    {
                        number: 4,
                        title: 'שמירה',
                        description: 'לחץ **"הוסף לתקצוב"**.\n\nהמשימה תופיע ברשימת **"פעילות בלבד"**.',
                        tips: ['✅ המשימה תופיע מיד ברשימה']
                    }
                ]
            }
        }
    },

    'create_case': {
        id: 'create_case',
        title: 'פתיחת תיק חדש',
        icon: 'folder',
        category: 'budget',
        keywords: ['תיק חדש', 'לקוח חדש', 'case', 'client', 'פתח תיק', 'תיק'],
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
                    title: 'פתיחת טופס תיק',
                    description: 'לחץ על **"תיק חדש"** בסרגל הצדדי השמאלי',
                    actionButton: {
                        text: '🚀 פתח טופס תיק',
                        handler: '(new CaseCreationDialog()).open()'
                    }
                },
                {
                    number: 2,
                    title: 'פרטי התיק',
                    description: `מלא את פרטי התיק:

**👤 לקוח**: בחר קיים או צור חדש

**#️⃣ מספר תיק**: מספר ייחודי לתיק

**⚖️ סוג הליך**: שעות / הליך משפטי מבוסס שלבים

**📝 כותרת התיק**: תיאור קצר של התיק`,
                    highlight: '#createCaseForm'
                },
                {
                    number: 3,
                    title: 'שמירה',
                    description: 'בחר **תאריך התחלה** ולחץ **"צור תיק"** בתחתית הטופס.\n\nהתיק ייווצר ויופיע ברשימת התיקים.',
                    tips: ['✅ ניתן לערוך את התיק לאחר היצירה']
                }
            ]
        }
    },

    'search_client': {
        id: 'search_client',
        title: 'חיפוש לקוח',
        icon: 'search',
        category: 'clients',
        keywords: ['חפש לקוח', 'מצא לקוח', 'search', 'find client', 'חיפוש'],
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
                    title: 'שדה חיפוש מהיר',
                    description: 'בכל טופס יש שדה חיפוש מהיר.\n\nהחיפוש עובד על **כל השדות** של הלקוח:',
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
                    description: 'התוצאות מתעדכנות **תוך כדי הקלדה** (300ms).\n\nפשוט לחץ על התוצאה הרצויה.',
                    tips: ['⚡ החיפוש מיידי וחכם']
                }
            ]
        }
    },

    'keyboard_shortcuts': {
        id: 'keyboard_shortcuts',
        title: 'קיצורי מקלדת',
        icon: 'keyboard',
        category: 'general',
        keywords: ['קיצורים', 'מקלדת', 'shortcuts', 'keys', 'keyboard'],
        quickSteps: null,
        info: {
            type: 'shortcuts',
            title: 'קיצורי מקלדת שימושיים',
            description: 'השתמש בקיצורים האלה לעבודה מהירה יותר:',
            shortcuts: [
                { keys: 'Ctrl + N', description: 'פתיחת טופס חדש (משימה/תיק)', icon: '➕' },
                { keys: 'Ctrl + F', description: 'מעבר לשדה חיפוש', icon: '🔍' },
                { keys: 'Ctrl + S', description: 'שמירת טופס', icon: '💾' },
                { keys: 'Esc', description: 'סגירת דיאלוג/מודאל', icon: '❌' },
                { keys: 'F1', description: 'פתיחת העוזר החכם (אני!)', icon: '💬' }
            ]
        }
    },

    'extend_deadline': {
        id: 'extend_deadline',
        title: 'הארכת יעד משימה',
        icon: 'calendar',
        category: 'budget',
        keywords: ['הארכה', 'יעד', 'דדליין', 'תאריך', 'deadline', 'extend', 'הארכת יעד', 'שינוי תאריך'],
        quickSteps: [
            'מצא את המשימה בטאב "תקצוב משימות"',
            'לחץ על כפתור "האריך יעד" 📅',
            'בחר תאריך חדש',
            'לחץ "שמור"'
        ],
        fullGuide: {
            totalSteps: 4,
            steps: [
                {
                    number: 1,
                    title: '🎯 למה להאריך יעד?',
                    description: `לפעמים המשימה לוקחת יותר זמן מהצפוי, וצריך להאריך את תאריך היעד.

**מתי להאריך:**
- 📋 המשימה מורכבת יותר
- 🔄 שינויים בדרישות הלקוח
- ⏳ עומס עבודה
- 🤝 בקשה מהלקוח`,
                    tips: [
                        '💡 ניתן להאריך כמה פעמים שצריך',
                        '📊 ההיסטוריה נשמרת אוטומטית'
                    ]
                },
                {
                    number: 2,
                    title: 'מציאת המשימה',
                    description: `מעבר לטאב **"תקצוב משימות"** ומצא את המשימה.

אפשר לחפש לפי:
- 📝 שם המשימה
- 👤 שם הלקוח
- 📁 מספר תיק`,
                    highlight: '#budgetSearchBox',
                    tips: [
                        '🔍 השתמש בחיפוש למציאה מהירה'
                    ]
                },
                {
                    number: 3,
                    title: 'לחיצה על "האריך יעד"',
                    description: `בכרטיס המשימה, לחץ על כפתור **"📅 האריך יעד"**

ייפתח פופאפ לבחירת תאריך חדש.`,
                    tips: [
                        '📅 הכפתור נמצא בשורת הפעולות של המשימה',
                        '⚠️ הכפתור מוסתר במשימות שהושלמו'
                    ]
                },
                {
                    number: 4,
                    title: 'בחירת תאריך ושמירה',
                    description: `בחר **תאריך חדש** מהלוח שנה.

לחץ **"שמור"** והתאריך יתעדכן מיד.

המערכת תרשום בהיסטוריה:
✅ תאריך ישן → תאריך חדש
✅ מי ביצע את השינוי
✅ מתי בוצע השינוי`,
                    tips: [
                        '📊 ניתן לראות את כל ההארכות בהיסטוריה',
                        '🔔 ניתן להגדיר תזכורת לתאריך החדש'
                    ]
                }
            ]
        }
    },

    'complete_task': {
        id: 'complete_task',
        title: 'סיום משימה',
        icon: 'check-circle',
        category: 'budget',
        keywords: ['סיום', 'השלמה', 'complete', 'finish', 'סיים משימה', 'הושלם', 'גמר'],
        quickSteps: [
            'מצא את המשימה בטאב "תקצוב משימות"',
            'לחץ על כפתור "סיים משימה" ✅',
            'אשר את הסיום',
            'המשימה תעבור לסטטוס "הושלם"'
        ],
        fullGuide: {
            totalSteps: 4,
            steps: [
                {
                    number: 1,
                    title: '✅ מתי לסיים משימה?',
                    description: `סמן משימה כ"הושלמה" כשסיימת לעבוד עליה לחלוטין.

**לפני שמסיימים - ודא:**
- ✔️ כל העבודה הושלמה
- ✔️ הלקוח מרוצה מהתוצאה
- ✔️ דיווחת את כל הזמן שעבדת
- ✔️ אין עוד משהו לעשות`,
                    tips: [
                        '⚠️ משימה מושלמת לא ניתנת לעריכה',
                        '📊 המשימה עוברת לארכיון'
                    ]
                },
                {
                    number: 2,
                    title: 'מציאת המשימה',
                    description: `מעבר לטאב **"תקצוב משימות"** ומצא את המשימה שסיימת.

אפשר לחפש לפי:
- 📝 שם המשימה
- 👤 שם הלקוח
- 📁 מספר תיק`,
                    highlight: '#budgetSearchBox',
                    tips: [
                        '🔍 השתמש בחיפוש למציאה מהירה'
                    ]
                },
                {
                    number: 3,
                    title: 'לחיצה על "סיים משימה"',
                    description: `בכרטיס המשימה, לחץ על כפתור **"✅ סיים משימה"**

ייפתח פופאפ אישור.`,
                    tips: [
                        '✅ הכפתור בצבע ירוק',
                        '⚠️ הכפתור מוסתר במשימות שכבר הושלמו'
                    ]
                },
                {
                    number: 4,
                    title: 'אישור הסיום',
                    description: `אשר את הסיום והמערכת תעדכן:
✅ סטטוס → "הושלם"
✅ תאריך השלמה
✅ מי ביצע את הסיום
✅ היסטוריה מלאה

המשימה תעבור לארכיון **"הושלמו"** ולא תופיע יותר ברשימה הפעילה.`,
                    tips: [
                        '🎉 כל הכבוד על השלמת המשימה!',
                        '📊 ניתן לראות אותה בדוח "משימות שהושלמו"'
                    ]
                }
            ]
        }
    },

    'system_tour': {
        id: 'system_tour',
        title: 'סיור במערכת',
        icon: 'tour',
        category: 'general',
        keywords: ['סיור', 'הדרכה', 'tour', 'guide', 'למידה', 'מדריך'],
        quickSteps: null,
        directAction: 'SystemBridge.startSystemTour()',
        info: {
            type: 'feature',
            title: 'סיור אינטראקטיבי במערכת',
            description: 'סיור מודרך של **9 שלבים** שילמד אותך את כל התכונות במערכת',
            duration: 'כ-5 דקות',
            features: [
                { icon: '📚', text: '9 שלבים מודרכים' },
                { icon: '⏱️', text: 'כ-5 דקות' },
                { icon: '🎮', text: 'למידה אינטראקטיבית' },
                { icon: '⏸️', text: 'ניתן להפסיק בכל עת' }
            ],
            actionButton: {
                text: '🚀 התחל סיור',
                handler: 'SystemBridge.startSystemTour()'
            }
        }
    }
};

const ACTION_CATEGORIES = {
    'timesheet': {
        id: 'timesheet',
        name: 'שעתון ודיווחים',
        icon: 'clock',
        color: '#3b82f6'
    },
    'tasks': {
        id: 'tasks',
        name: 'משימות ותקצוב',
        icon: 'task',
        color: '#10b981'
    },
    'clients': {
        id: 'clients',
        name: 'תיקים ולקוחות',
        icon: 'folder',
        color: '#f59e0b'
    },
    'general': {
        id: 'general',
        name: 'כללי ועזרה',
        icon: 'info',
        color: '#8b5cf6'
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 7: BUSINESS LOGIC - Engines
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class SearchEngine
 * @description מנוע חיפוש מתקדם
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

    buildIndex() {
        Object.values(this.database).forEach(action => {
            const keywords = [
                action.title.toLowerCase(),
                ...action.keywords.map(k => k.toLowerCase())
            ];

            keywords.forEach(keyword => {
                const words = keyword.split(/\s+/);
                words.forEach(word => {
                    if (word.length < 2) {
return;
}

                    if (!this.index.has(word)) {
                        this.index.set(word, new Set());
                    }
                    this.index.get(word).add(action.id);
                });
            });
        });

        logger.debug('Search index built', { indexSize: this.index.size });
    }

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

        this.addToHistory(searchTerm);

        let results = this.exactSearch(searchTerm);

        if (results.length === 0 && fuzzy) {
            results = this.fuzzySearch(searchTerm);
        }

        if (category) {
            results = results.filter(r => r.action.category === category);
        }

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

    exactSearch(query) {
        const words = query.split(/\s+/);
        const matchedIds = new Map();

        words.forEach(word => {
            if (this.index.has(word)) {
                this.index.get(word).forEach(actionId => {
                    matchedIds.set(actionId, (matchedIds.get(actionId) || 0) + 1);
                });
            }

            Array.from(this.index.keys()).forEach(indexWord => {
                if (indexWord.startsWith(word)) {
                    this.index.get(indexWord).forEach(actionId => {
                        matchedIds.set(actionId, (matchedIds.get(actionId) || 0) + 0.5);
                    });
                }
            });
        });

        const results = Array.from(matchedIds.entries())
            .map(([actionId, score]) => ({
                action: this.database[actionId],
                score: score,
                matchType: 'exact'
            }))
            .sort((a, b) => b.score - a.score);

        return results;
    }

    fuzzySearch(query) {
        const results = [];

        Object.values(this.database).forEach(action => {
            const searchableText = [
                action.title,
                ...action.keywords
            ].join(' ').toLowerCase();

            const distance = this.levenshteinDistance(query, searchableText.substring(0, query.length * 2));
            const threshold = Math.ceil(query.length * 0.4);

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

    addToHistory(query) {
        this.searchHistory.unshift(query);
        if (this.searchHistory.length > this.maxHistory) {
            this.searchHistory.pop();
        }
    }

    getHistory() {
        return [...this.searchHistory];
    }

    clearHistory() {
        this.searchHistory = [];
        eventBus.emit('search:history-cleared');
    }
}

/**
 * @class GuideEngine
 * @description מנהל הדרכות צעד-אחר-צעד
 */
class GuideEngine {
    constructor() {
        this.currentGuide = null;
        this.currentStep = 0;
        this.guideHistory = [];
        this.highlights = [];

        logger.info('GuideEngine initialized');
    }

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

    nextStep() {
        if (!this.currentGuide) {
            logger.warn('No active guide');
            return false;
        }

        const currentStepData = this.currentGuide.steps[this.currentStep];

        this.currentGuide.completedSteps.push(this.currentStep);

        if (currentStepData.validation) {
            try {
                const isValid = eval(currentStepData.validation);
                if (!isValid) {
                    logger.warn('Step validation failed', { step: this.currentStep });
                }
            } catch (error) {
                logger.warn('Validation error', { error: error.message });
            }
        }

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

            this.highlightCurrentStep();

            return true;
        } else {
            this.completeGuide();
            return false;
        }
    }

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

    highlightCurrentStep() {
        this.clearHighlights();

        const step = this.getCurrentStep();
        if (step && step.highlight) {
            const highlight = DOMController.highlightElement(step.highlight, {
                duration: 0,
                pulse: true,
                tooltip: null,
                scrollIntoView: true
            });

            if (highlight) {
                this.highlights.push(highlight);
            }
        }
    }

    clearHighlights() {
        this.highlights.forEach(({ overlay }) => {
            DOMController.removeElement(overlay);
        });
        this.highlights = [];
        // 🔄 החזר את הצ'אט בוט למקום המקורי
        DOMController.resetChatbotPosition();
    }

    completeGuide() {
        if (!this.currentGuide) {
return;
}

        const duration = Date.now() - this.currentGuide.startTime;

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

    hasActiveGuide() {
        return this.currentGuide !== null;
    }

    getHistory() {
        return [...this.guideHistory];
    }
}

/**
 * @class ActionEngine
 * @description מנוע ביצוע פעולות
 */
class ActionEngine {
    constructor() {
        this.actionQueue = [];
        this.executionHistory = [];
        this.maxHistory = 50;

        logger.info('ActionEngine initialized');
    }

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

            if (action.directAction) {
                result = await this.executeDirectAction(action.directAction, context);
            } else if (action.fullGuide) {
                result = { success: true, type: 'guide', message: 'Guide available' };
            } else if (action.info) {
                result = { success: true, type: 'info', message: 'Info displayed' };
            } else {
                result = { success: false, error: 'No executable action found' };
            }

            const duration = Date.now() - startTime;

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

    async executeDirectAction(actionCode, context) {
        try {
            const result = eval(actionCode);

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

    getHistory() {
        return [...this.executionHistory];
    }

    clearHistory() {
        this.executionHistory = [];
        eventBus.emit('action:history-cleared');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 8: UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class UIComponentFactory
 * @description פקטורי ליצירת כל קומפוננטות ה-UI
 */
class UIComponentFactory {
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
            <div class="va-action-card-icon">${IconSystem.get(action.icon)}</div>
            <div class="va-action-card-title">${action.title}</div>
        `;

        return card;
    }

    static createSearchResult(result, query = '') {
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

        // Highlight search query in title
        const highlightedTitle = query ?
            UIComponentFactory.highlightText(action.title, query) :
            action.title;

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
                        ${IconSystem.getInline('book')} הדרכה מלאה
                    </button>
                ` : ''}
                ${action.directAction ? `
                    <button class="va-result-action-btn va-secondary" data-action="execute">
                        ${IconSystem.getInline('play')} בצע עכשיו
                    </button>
                ` : ''}
            </div>
        `;

        resultEl.innerHTML = `
            <div class="va-result-header">
                <div class="va-result-icon">${IconSystem.get(action.icon)}</div>
                <div class="va-result-title">${highlightedTitle}</div>
                ${matchType === 'fuzzy' ? '<span class="va-result-badge">התאמה קרובה</span>' : ''}
            </div>
            ${stepsHtml}
            ${actionsHtml}
        `;

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

    static createGuideStep(stepData) {
        const container = DOMController.createElement('div', {
            className: 'va-guide-step'
        });

        const progressHtml = `
            <div class="va-guide-progress">
                <div class="va-guide-progress-bar">
                    <div class="va-guide-progress-fill" style="width: ${stepData.progress}%"></div>
                </div>
                <div class="va-guide-progress-text">שלב ${stepData.stepNumber} מתוך ${stepData.totalSteps}</div>
            </div>
        `;

        const descriptionHtml = stepData.description
            .split('\n\n')
            .map(para => `<p>${this.formatMarkdown(para)}</p>`)
            .join('');

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

        let actionButtonHtml = '';
        if (stepData.actionButton) {
            actionButtonHtml = `
                <button class="va-guide-action-btn">
                    ${stepData.actionButton.text}
                </button>
            `;
        }

        const navigationHtml = `
            <div class="va-guide-navigation">
                ${!stepData.isFirst ? `
                    <button class="va-guide-nav-btn va-guide-prev">
                        → הקודם
                    </button>
                ` : '<div></div>'}

                ${!stepData.isLast ? `
                    <button class="va-guide-nav-btn va-guide-next va-primary">
                        הבא ←
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
     * יצירת תצוגת Quick Action - פעולה מהירה
     */
    static createQuickActionView(action) {
        const container = DOMController.createElement('div', {
            className: 'va-quick-action-view'
        });

        const quickAction = action.quickAction;
        if (!quickAction) {
            logger.warn('No quickAction found for action', { actionId: action.id });
            return container;
        }

        // כותרת ואייקון גדול
        const headerHtml = `
            <div class="va-quick-action-header">
                <div class="va-quick-action-icon-large">${IconSystem.get(action.icon)}</div>
                <h2 class="va-quick-action-title">${action.title}</h2>
            </div>
        `;

        // טקסט עזרה
        const helpTextHtml = `
            <div class="va-quick-action-help">
                ${quickAction.helpText}
            </div>
        `;

        // כפתור הפעולה הראשי - גדול ובולט
        const actionButtonHtml = `
            <button class="va-quick-action-main-btn">
                ${quickAction.buttonText}
            </button>
        `;

        // טיפים (אם יש)
        let tipsHtml = '';
        if (quickAction.tips && quickAction.tips.length > 0) {
            tipsHtml = `
                <div class="va-quick-action-tips">
                    <div class="va-quick-action-tips-title">💡 טיפים מהירים:</div>
                    <ul class="va-quick-action-tips-list">
                        ${quickAction.tips.map(tip => `<li>${tip}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        // קישור למדריך מפורט (אם יש)
        let detailedLinkHtml = '';
        if (action.detailedGuide && action.detailedGuide.available) {
            detailedLinkHtml = `
                <div class="va-quick-action-detailed-link">
                    <button class="va-detailed-guide-link">
                        📖 ${action.detailedGuide.linkText}
                    </button>
                </div>
            `;
        }

        container.innerHTML = `
            ${headerHtml}
            ${helpTextHtml}
            ${actionButtonHtml}
            ${tipsHtml}
            ${detailedLinkHtml}
        `;

        // Event listener לכפתור הפעולה הראשי
        const mainBtn = container.querySelector('.va-quick-action-main-btn');
        mainBtn?.addEventListener('click', () => {
            try {
                eval(quickAction.buttonAction);
                logger.info('Quick action executed', { actionId: action.id });
            } catch (error) {
                errorHandler.handleError(error, 'UIComponentFactory.createQuickActionView.mainButton');
            }
        });

        // Event listener לקישור למדריך מפורט
        const detailedLink = container.querySelector('.va-detailed-guide-link');
        detailedLink?.addEventListener('click', () => {
            eventBus.emit('guide:start-requested', { actionId: action.id });
        });

        return container;
    }

    static createInfoView(action) {
        const container = DOMController.createElement('div', {
            className: 'va-info-view'
        });

        if (!action.info) {
return container;
}

        const { info } = action;

        const headerHtml = `
            <div class="va-info-header">
                <div class="va-info-icon">${IconSystem.get(action.icon)}</div>
                <h2 class="va-info-title">${info.title || action.title}</h2>
            </div>
        `;

        let descriptionHtml = '';
        if (info.description) {
            descriptionHtml = `<p class="va-info-description">${info.description}</p>`;
        }

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

    static highlightText(text, query) {
        if (!query || query.trim().length === 0) {
return text;
}

        const queryLower = query.toLowerCase().trim();
        const words = queryLower.split(/\s+/);

        let highlightedText = text;

        words.forEach(word => {
            if (word.length < 2) {
return;
}

            // Case-insensitive highlighting
            const regex = new RegExp(`(${word})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<mark class="va-highlight">$1</mark>');
        });

        return highlightedText;
    }

    static formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }
}

/**
 * @class ViewManager
 * @description מנהל תצוגות
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

    render(viewName, data, container) {
        if (!container) {
            logger.error('ViewManager.render: No container provided');
            return;
        }

        container.innerHTML = '';

        this.currentView = viewName;

        logger.debug('Rendering view', { viewName, data });

        try {
            switch (viewName) {
                case 'home':
                    this.renderHomeView(container, data);
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
                case 'notifications':
                    this.renderNotificationsView(container);
                    break;
                case 'history':
                    this.renderHistoryView(container, data);
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

    renderHomeView(container, data = {}) {
        // 🎯 זיהוי הטאב הנוכחי
        const currentTab = data?.currentTab || 'budget';

        // מפת קטגוריות לטאבים
        const tabCategories = {
            budget: ['budget', 'getting-started', 'system'],
            timesheet: ['timesheet', 'getting-started', 'system'],
            reports: ['reports', 'getting-started', 'system']
        };

        const header = DOMController.createElement('div', {
            className: 'va-home-header'
        });

        const userName = SystemBridge.getUserName();
        const tabName = currentTab === 'budget' ? 'תקצוב משימות' :
                        currentTab === 'timesheet' ? 'שעתון' : 'דוחות';

        header.innerHTML = `
            <div class="va-home-greeting">
                <svg class="va-greeting-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
                <h1 class="va-home-title">שלום ${userName}!</h1>
            </div>
            <p class="va-home-subtitle">אתה נמצא ב: <strong>${tabName}</strong></p>
            <p class="va-home-context">במה אוכל לעזור לך?</p>
        `;

        container.appendChild(header);

        // 🎓 כפתור "מרכז עזרה מלא" - פתיחת Knowledge Base
        const kbButton = DOMController.createElement('div', {
            className: 'va-kb-expand-button-container'
        });
        kbButton.innerHTML = `
            <button class="va-kb-expand-button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span>מרכז עזרה מלא</span>
                <svg class="va-kb-expand-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </button>
            <p class="va-kb-expand-hint">גישה למאמרי עזרה, חיפוש, וקטגוריות נוספות</p>
        `;

        const expandBtn = kbButton.querySelector('.va-kb-expand-button');
        expandBtn.addEventListener('click', () => {
            if (window.knowledgeBase) {
                window.knowledgeBase.open();
            } else {
                console.error('Knowledge Base not available');
            }
        });

        container.appendChild(kbButton);

        const categories = {};

        // 🎯 סינון פעולות לפי הטאב הנוכחי
        const relevantCategories = tabCategories[currentTab] || ['getting-started', 'system'];

        Object.values(this.database).forEach(action => {
            const cat = action.category || 'general';

            // הצג רק פעולות רלוונטיות לטאב הנוכחי
            if (relevantCategories.includes(cat)) {
                if (!categories[cat]) {
                    categories[cat] = [];
                }
                categories[cat].push(action);
            }
        });

        Object.entries(categories).forEach(([categoryId, actions]) => {
            const categoryInfo = ACTION_CATEGORIES[categoryId] || {
                name: 'כללי',
                icon: 'info'
            };

            const categorySection = DOMController.createElement('div', {
                className: 'va-category-section'
            });

            categorySection.innerHTML = `
                <div class="va-category-header">
                    <span class="va-category-icon">${IconSystem.get(categoryInfo.icon)}</span>
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

    renderSearchView(container, data) {
        const { query, results } = data;

        const header = DOMController.createElement('div', {
            className: 'va-search-header'
        });

        header.innerHTML = `
            <h2 class="va-search-title">תוצאות חיפוש</h2>
            <p class="va-search-query">חיפשת: <strong>"${query}"</strong></p>
            <p class="va-search-count">נמצאו ${results.length} תוצאות</p>
        `;

        container.appendChild(header);

        if (results.length === 0) {
            const emptyState = DOMController.createElement('div', {
                className: 'va-empty-state'
            });

            emptyState.innerHTML = `
                <div class="va-empty-icon">🔍</div>
                <div class="va-empty-message">לא נמצאו תוצאות עבור "${query}"</div>
                <div class="va-empty-suggestions">
                    <p class="va-empty-suggestions-title">נסה לחפש:</p>
                    <div class="va-empty-suggestions-list">
                        <button class="va-suggestion-pill" data-query="דיווח שעות">⏱️ דיווח שעות</button>
                        <button class="va-suggestion-pill" data-query="משימה חדשה">✅ משימה חדשה</button>
                        <button class="va-suggestion-pill" data-query="תיק חדש">📁 תיק חדש</button>
                        <button class="va-suggestion-pill" data-query="סיור במערכת">🎯 סיור במערכת</button>
                    </div>
                </div>
            `;

            // Add click handlers for suggestion pills
            emptyState.querySelectorAll('.va-suggestion-pill').forEach(pill => {
                pill.addEventListener('click', () => {
                    const searchInput = DOMController.querySelector('#va-search-input');
                    if (searchInput) {
                        searchInput.value = pill.dataset.query;
                        searchInput.dispatchEvent(new Event('input'));
                        searchInput.focus();
                    }
                });
            });

            container.appendChild(emptyState);
        } else {
            const resultsContainer = DOMController.createElement('div', {
                className: 'va-search-results'
            });

            results.forEach(result => {
                const resultEl = UIComponentFactory.createSearchResult(result, query);
                resultsContainer.appendChild(resultEl);
            });

            container.appendChild(resultsContainer);
        }
    }

    renderGuideView(container, data) {
        const stepData = data.step;

        if (!stepData) {
            logger.error('No step data provided for guide view');
            return;
        }

        const header = DOMController.createElement('div', {
            className: 'va-guide-header'
        });

        header.innerHTML = `
            <button class="va-guide-back-btn">→ חזרה</button>
            <h2 class="va-guide-title">${data.action.title}</h2>
        `;

        container.appendChild(header);

        const backBtn = header.querySelector('.va-guide-back-btn');
        backBtn?.addEventListener('click', () => {
            eventBus.emit('guide:cancelled');
            eventBus.emit('view:home-requested');
        });

        const stepEl = UIComponentFactory.createGuideStep(stepData);
        container.appendChild(stepEl);
    }

    renderInfoView(container, data) {
        const { action } = data;

        const header = DOMController.createElement('div', {
            className: 'va-info-view-header'
        });

        header.innerHTML = '<button class="va-info-back-btn">→ חזרה</button>';

        container.appendChild(header);

        const backBtn = header.querySelector('.va-info-back-btn');
        backBtn?.addEventListener('click', () => {
            eventBus.emit('view:home-requested');
        });

        const infoView = UIComponentFactory.createInfoView(action);
        container.appendChild(infoView);
    }

    renderNotificationsView(container) {
        const header = DOMController.createElement('div', {
            className: 'va-notifications-header'
        });

        header.innerHTML = `
            <button class="va-notifications-back-btn">→ חזרה</button>
            <h2 class="va-notifications-title">התראות</h2>
            <button class="va-notifications-clear-btn" id="va-clear-all-notifications">נקה הכל</button>
        `;

        container.appendChild(header);

        const backBtn = header.querySelector('.va-notifications-back-btn');
        backBtn?.addEventListener('click', () => {
            eventBus.emit('view:home-requested');
        });

        // Get notifications from the global notification system
        const notifications = window.notificationBell?.notifications || [];

        if (notifications.length === 0) {
            const emptyState = DOMController.createElement('div', {
                className: 'va-notifications-empty'
            });
            emptyState.innerHTML = `
                <div class="va-notifications-empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        <line x1="2" y1="2" x2="22" y2="22"/>
                    </svg>
                </div>
                <h3 class="va-notifications-empty-title">אין התראות</h3>
                <p class="va-notifications-empty-text">כל ההתראות שלך יופיעו כאן</p>
            `;
            container.appendChild(emptyState);
            return;
        }

        // Create notifications list
        const notificationsList = DOMController.createElement('div', {
            className: 'va-notifications-list'
        });

        notifications.forEach(notification => {
            const notificationEl = DOMController.createElement('div', {
                className: `va-notification-item va-notification-${notification.type} ${notification.urgent ? 'va-notification-urgent' : ''}`
            });

            // Map notification types to icons
            const iconMap = {
                'blocked': 'ban',
                'critical': 'alert',
                'urgent': 'clock'
            };

            const iconName = iconMap[notification.type] || 'info';

            notificationEl.innerHTML = `
                <button class="va-notification-close" data-notification-id="${notification.id}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
                <div class="va-notification-content">
                    <div class="va-notification-icon">${IconSystem.get(iconName)}</div>
                    <div class="va-notification-text">
                        <div class="va-notification-title">${notification.title}</div>
                        <div class="va-notification-description">${notification.description}</div>
                        <div class="va-notification-time">${notification.time}</div>
                    </div>
                </div>
            `;

            // Add click handler for close button
            const closeBtn = notificationEl.querySelector('.va-notification-close');
            closeBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                const notifId = parseFloat(closeBtn.dataset.notificationId);
                if (window.notificationBell) {
                    window.notificationBell.removeNotification(notifId);
                    // Re-render the view
                    this.render('notifications', null, container);
                }
            });

            notificationsList.appendChild(notificationEl);
        });

        container.appendChild(notificationsList);

        // Add clear all handler
        const clearAllBtn = header.querySelector('#va-clear-all-notifications');
        clearAllBtn?.addEventListener('click', () => {
            if (window.notificationBell) {
                window.notificationBell.clearAllNotifications();
                // Re-render the view
                this.render('notifications', null, container);
            }
        });
    }

    renderHistoryView(container, data) {
        const { searchHistory, guideHistory } = data;

        const header = DOMController.createElement('div', {
            className: 'va-history-header'
        });

        header.innerHTML = `
            <button class="va-history-back-btn">→ חזרה</button>
            <h2 class="va-history-title">היסטוריה</h2>
        `;

        container.appendChild(header);

        const backBtn = header.querySelector('.va-history-back-btn');
        backBtn?.addEventListener('click', () => {
            eventBus.emit('view:home-requested');
        });

        // Check if there's any history
        if (searchHistory.length === 0 && guideHistory.length === 0) {
            const emptyState = DOMController.createElement('div', {
                className: 'va-history-empty'
            });
            emptyState.innerHTML = `
                <div class="va-history-empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                    </svg>
                </div>
                <h3 class="va-history-empty-title">אין היסטוריה</h3>
                <p class="va-history-empty-text">כל הפעילות שלך תופיע כאן</p>
            `;
            container.appendChild(emptyState);
            return;
        }

        const historyContent = DOMController.createElement('div', {
            className: 'va-history-content'
        });

        // Search History Section
        if (searchHistory.length > 0) {
            const searchSection = DOMController.createElement('div', {
                className: 'va-history-section'
            });

            searchSection.innerHTML = `
                <h3 class="va-history-section-title">
                    ${IconSystem.get('search')}
                    <span>חיפושים אחרונים</span>
                </h3>
                <div class="va-history-list" id="va-search-history-list"></div>
            `;

            const searchList = searchSection.querySelector('#va-search-history-list');

            searchHistory.slice(0, 10).reverse().forEach(query => {
                const item = DOMController.createElement('div', {
                    className: 'va-history-item'
                });

                item.innerHTML = `
                    <div class="va-history-item-icon">${IconSystem.get('search')}</div>
                    <div class="va-history-item-text">${query}</div>
                `;

                item.addEventListener('click', () => {
                    const searchInput = DOMController.querySelector('#va-search-input');
                    if (searchInput) {
                        searchInput.value = query;
                        searchInput.dispatchEvent(new Event('input'));
                    }
                });

                searchList.appendChild(item);
            });

            historyContent.appendChild(searchSection);
        }

        // Guide History Section
        if (guideHistory.length > 0) {
            const guideSection = DOMController.createElement('div', {
                className: 'va-history-section'
            });

            guideSection.innerHTML = `
                <h3 class="va-history-section-title">
                    ${IconSystem.get('book')}
                    <span>מדריכים שהושלמו</span>
                </h3>
                <div class="va-history-list" id="va-guide-history-list"></div>
            `;

            const guideList = guideSection.querySelector('#va-guide-history-list');

            guideHistory.slice(0, 10).reverse().forEach(actionId => {
                const action = ACTION_DATABASE[actionId];
                if (!action) {
return;
}

                const item = DOMController.createElement('div', {
                    className: 'va-history-item'
                });

                item.innerHTML = `
                    <div class="va-history-item-icon">${IconSystem.get(action.icon || 'check')}</div>
                    <div class="va-history-item-text">${action.title}</div>
                `;

                item.addEventListener('click', () => {
                    eventBus.emit('action:card-clicked', { actionId });
                });

                guideList.appendChild(item);
            });

            historyContent.appendChild(guideSection);
        }

        container.appendChild(historyContent);
    }

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

    getCurrentView() {
        return this.currentView;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 9: MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class VirtualAssistant
 * @description העוזר הווירטואלי המרכזי - Singleton
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

        this.stateManager = new StateManager({
            view: 'home',
            isOpen: false,
            searchQuery: '',
            currentAction: null,
            guideActive: false,
            currentTab: 'budget' // 🎯 Context: budget, timesheet, reports
        });

        this.searchEngine = null;
        this.guideEngine = null;
        this.actionEngine = null;
        this.viewManager = null;

        VirtualAssistant.instance = this;

        logger.info('VirtualAssistant instance created');
    }

    async init() {
        if (this.isInitialized) {
            logger.warn('VirtualAssistant already initialized');
            return;
        }

        try {
            logger.info('Initializing VirtualAssistant...');

            // קבלת user ID
            const userId = SystemBridge.getUserName() || 'anonymous';

            // אתחול מנועי חיפוש ומדריכים קיימים
            this.searchEngine = new SearchEngine(ACTION_DATABASE);
            this.guideEngine = new GuideEngine();
            this.actionEngine = new ActionEngine();
            this.viewManager = new ViewManager(
                ACTION_DATABASE,
                this.searchEngine,
                this.guideEngine,
                this.actionEngine
            );

            // אתחול מערכות חדשות - Context, Analytics & Feedback
            this.contextDetector = new ContextDetector();
            this.smartSuggestions = new SmartSuggestionsEngine(this.contextDetector);
            this.feedbackSystem = new FeedbackSystem(userId);
            this.analyticsEngine = new AnalyticsEngine(userId);
            this.statisticsDashboard = new StatisticsDashboard(userId, this.analyticsEngine);

            // הרשמה לשינויי הקשר
            this.contextDetector.subscribe((context) => {
                this.onContextChanged(context);
            });

            this.buildHTML();

            this.attachEventListeners();

            this.subscribeToStateChanges();

            // Sync notification badge with external notification system
            this.startNotificationSync();

            // הפעלת ניטור הקשר
            this.contextDetector.startMonitoring(2000);

            // 🎯 Setup Tab Detection
            this.setupTabDetection();

            this.isInitialized = true;

            logger.info('VirtualAssistant initialized successfully with advanced features');
            eventBus.emit('va:initialized');

            return true;
        } catch (error) {
            errorHandler.handleError(error, 'VirtualAssistant.init');
            return false;
        }
    }

    buildHTML() {
        let container = DOMController.querySelector('#va-container');

        if (container) {
            logger.warn('VirtualAssistant container already exists');
            this.container = container;
            return;
        }

        container = DOMController.createElement('div', {
            id: 'va-container',
            className: 'va-container va-hidden'
        });

        container.innerHTML = `
            <!-- Header -->
            <div class="va-header">
                <div class="va-header-title">
                    <svg class="va-header-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span class="va-header-text">העוזר החכם</span>
                </div>
                <div class="va-header-actions">
                    <button class="va-header-btn va-minimize-btn" title="מזער">−</button>
                    <button class="va-header-btn va-close-btn" title="סגור">×</button>
                </div>
            </div>

            <!-- Content -->
            <div class="va-content" id="va-content">
                <!-- תוכן דינמי יוצג כאן -->
            </div>

            <!-- Search Bar - Moved to bottom -->
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

            <!-- Footer -->
            <div class="va-footer">
                <button class="va-footer-btn" id="va-home-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span>הבית</span>
                </button>
                <button class="va-footer-btn" id="va-notifications-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <span>התראות</span>
                    <span class="va-notification-badge" id="va-notification-badge"></span>
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

        // Create floating button
        const floatingBtn = DOMController.createElement('button', {
            id: 'va-floating-btn',
            className: 'va-floating-btn',
            attributes: {
                'title': 'פתח עוזר חכם (F1)',
                'aria-label': 'פתח עוזר חכם'
            }
        });

        floatingBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span class="va-floating-badge">?</span>
        `;

        document.body.appendChild(floatingBtn);

        this.floatingBtn = floatingBtn;
        this.container = container;
        this.searchInput = DOMController.querySelector('#va-search-input');
        this.contentContainer = DOMController.querySelector('#va-content');

        logger.debug('VirtualAssistant HTML built');
    }

    attachEventListeners() {
        // Floating button
        this.floatingBtn?.addEventListener('click', () => this.toggle());

        // Notifications button - show inline view
        const notificationsBtn = DOMController.querySelector('#va-notifications-btn');
        notificationsBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            // Show notifications view in the chatbot
            eventBus.emit('view:notifications-requested');
        });

        const minimizeBtn = DOMController.querySelector('.va-minimize-btn');
        minimizeBtn?.addEventListener('click', () => this.minimize());

        const closeBtn = DOMController.querySelector('.va-close-btn');
        closeBtn?.addEventListener('click', () => this.close());

        this.searchInput?.addEventListener('input', (e) => {
            const query = e.target.value;

            const clearBtn = DOMController.querySelector('#va-search-clear');
            if (query) {
                DOMController.removeClass(clearBtn, 'va-hidden');
            } else {
                DOMController.addClass(clearBtn, 'va-hidden');
            }

            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = setTimeout(() => {
                this.performSearch(query);
            }, 300);
        });

        const clearBtn = DOMController.querySelector('#va-search-clear');
        clearBtn?.addEventListener('click', () => {
            this.searchInput.value = '';
            DOMController.addClass(clearBtn, 'va-hidden');
            this.showHome();
            this.searchInput.focus();
        });

        this.searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(this.searchDebounceTimer);
                this.performSearch(e.target.value);
            }
        });

        const homeBtn = DOMController.querySelector('#va-home-btn');
        homeBtn?.addEventListener('click', () => this.showHome());

        const historyBtn = DOMController.querySelector('#va-history-btn');
        historyBtn?.addEventListener('click', () => this.showHistory());

        eventBus.on('action:card-clicked', ({ actionId }) => {
            this.handleActionClick(actionId);
        });

        eventBus.on('search:result-clicked', ({ actionId }) => {
            this.handleActionClick(actionId);
        });

        eventBus.on('guide:start-requested', ({ actionId }) => {
            this.startGuide(actionId);
        });

        // Handler for contextual suggestion guides
        eventBus.on('guide:requested', ({ guideId }) => {
            logger.info('Guide requested from suggestion', { guideId });

            // Map guide IDs to actual actions
            const guideToActionMap = {
                'getting-started': 'report_hours', // First time users - show how to report hours
                'quick-tour': 'system_tour' // System tour
            };

            const actionId = guideToActionMap[guideId] || guideId;

            if (ACTION_DATABASE[actionId]) {
                this.handleActionClick(actionId);
            } else {
                logger.warn('Guide not found', { guideId, actionId });
            }
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

        eventBus.on('view:notifications-requested', () => {
            this.showNotifications();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'F1') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        logger.debug('Event listeners attached');
    }

    subscribeToStateChanges() {
        this.stateManager.subscribe('va-main', (newState, oldState, updates) => {
            logger.debug('State changed', { updates });
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        if (!this.isInitialized) {
            logger.warn('Cannot open - not initialized');
            return;
        }

        DOMController.removeClass(this.container, 'va-hidden');
        DOMController.addClass(this.floatingBtn, 'open');
        this.isOpen = true;

        this.stateManager.setState({ isOpen: true }, 'VirtualAssistant.open');

        if (!this.stateManager.getState().view || this.stateManager.getState().view === 'home') {
            this.showHome();
        }

        setTimeout(() => this.searchInput?.focus(), 100);

        // Analytics tracking
        if (this.analyticsEngine) {
            this.analyticsEngine.trackOpen();
        }

        logger.info('VirtualAssistant opened');
        eventBus.emit('va:opened');
    }

    close() {
        DOMController.addClass(this.container, 'va-hidden');
        DOMController.removeClass(this.floatingBtn, 'open');
        this.isOpen = false;

        this.stateManager.setState({ isOpen: false }, 'VirtualAssistant.close');

        if (this.guideEngine.hasActiveGuide()) {
            this.guideEngine.cancelGuide();
        }

        // Analytics tracking
        if (this.analyticsEngine) {
            this.analyticsEngine.trackClose();
        }

        logger.info('VirtualAssistant closed');
        eventBus.emit('va:closed');
    }

    minimize() {
        this.close();
    }

    showHome() {
        this.stateManager.setState({ view: 'home' }, 'VirtualAssistant.showHome');

        // 🎯 העבר את הטאב הנוכחי ל-ViewManager
        const currentTab = this.stateManager.getState().currentTab || 'budget';
        this.viewManager.render('home', { currentTab }, this.contentContainer);

        this.searchInput.value = '';
        const clearBtn = DOMController.querySelector('#va-search-clear');
        DOMController.addClass(clearBtn, 'va-hidden');
    }

    showNotifications() {
        this.stateManager.setState({ view: 'notifications' }, 'VirtualAssistant.showNotifications');

        this.viewManager.render('notifications', null, this.contentContainer);

        logger.debug('Showing notifications view');
    }

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

    handleActionClick(actionId) {
        const action = ACTION_DATABASE[actionId];

        if (!action) {
            logger.warn('Action not found', { actionId });
            return;
        }

        logger.info('Action clicked', { actionId, title: action.title });

        // 🎯 Two-Tier Help System: Quick Action First
        if (action.quickAction) {
            // רמה 1: הצג Quick Action
            this.showQuickAction(actionId);
        } else if (action.fullGuide) {
            // Legacy: מדריך מלא (עבור פעולות שעדיין לא עברו למודל החדש)
            this.startGuide(actionId);
        } else if (action.info) {
            this.showInfo(actionId);
        } else if (action.directAction) {
            this.executeAction(actionId);
        } else {
            logger.warn('No action available for this item', { actionId });
        }
    }

    /**
     * הצגת Quick Action View
     */
    showQuickAction(actionId) {
        const action = ACTION_DATABASE[actionId];

        if (!action || !action.quickAction) {
            logger.warn('Cannot show quick action - no quickAction available', { actionId });
            return;
        }

        this.stateManager.setState({
            view: 'quick-action',
            currentAction: actionId
        }, 'VirtualAssistant.showQuickAction');

        // יצירת View של Quick Action
        const container = this.contentContainer;
        container.innerHTML = '';

        // Header עם כפתור חזרה
        const header = DOMController.createElement('div', {
            className: 'va-quick-action-view-header'
        });
        header.innerHTML = '<button class="va-quick-action-back-btn">→ חזרה</button>';
        container.appendChild(header);

        const backBtn = header.querySelector('.va-quick-action-back-btn');
        backBtn?.addEventListener('click', () => {
            this.showHome();
        });

        // הצגת Quick Action עצמו
        const quickActionView = UIComponentFactory.createQuickActionView(action);
        container.appendChild(quickActionView);

        logger.info('Quick action shown', { actionId, title: action.title });
    }

    startGuide(actionId) {
        const action = ACTION_DATABASE[actionId];

        // תמיכה גם במבנה החדש (detailedGuide.fullGuide) וגם בישן (fullGuide)
        const guideData = action.detailedGuide?.fullGuide || action.fullGuide;

        if (!action || !guideData) {
            logger.warn('Cannot start guide - no guide available', { actionId });
            return;
        }

        // Create a temporary action with fullGuide for the GuideEngine
        const actionForGuide = {
            ...action,
            fullGuide: guideData
        };

        const success = this.guideEngine.startGuide(actionForGuide);

        if (success) {
            this.stateManager.setState({
                view: 'guide',
                currentAction: actionId,
                guideActive: true
            }, 'VirtualAssistant.startGuide');

            this.updateGuideView();
        }
    }

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

            if (action.directAction) {
                setTimeout(() => this.close(), 500);
            }
        } else {
            logger.error('Action execution failed', { actionId, error: result.error });
        }

        return result;
    }

    showHistory() {
        const searchHistory = this.searchEngine.getHistory();
        const guideHistory = this.guideEngine.getHistory();

        logger.info('Showing history', {
            searches: searchHistory.length,
            guides: guideHistory.length
        });

        this.stateManager.setState({ view: 'history' }, 'VirtualAssistant.showHistory');

        this.viewManager.render('history', { searchHistory, guideHistory }, this.contentContainer);
    }

    startNotificationSync() {
        // Initial update
        this.updateNotificationBadge();

        // Update every 2 seconds to sync with external notification system
        this.notificationSyncInterval = setInterval(() => {
            this.updateNotificationBadge();
        }, 2000);

        logger.debug('Notification sync started');
    }

    updateNotificationBadge() {
        const badge = DOMController.querySelector('#va-notification-badge');
        if (!badge) {
return;
}

        const count = window.notificationBell?.notifications?.length || 0;

        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.textContent = '';
            badge.style.display = 'none';
        }
    }

    /**
     * 🎯 Smart Tab Detection - מזהה באיזה טאב המשתמש נמצא
     */
    detectCurrentTab() {
        try {
            // בדיקה איזה .tab-content יש active
            const activeTabContent = DOMController.querySelector('.tab-content.active');

            if (activeTabContent) {
                const tabId = activeTabContent.id;

                if (tabId === 'budgetTab') {
                    return 'budget';
                } else if (tabId === 'timesheetTab') {
                    return 'timesheet';
                } else if (tabId === 'reportsTab') {
                    return 'reports';
                }
            }

            // בדיקה נוספת לפי כפתור טאב פעיל
            const activeButton = DOMController.querySelector('.tab-button.active');
            if (activeButton) {
                const onclick = activeButton.getAttribute('onclick');
                if (onclick?.includes('budget')) {
return 'budget';
}
                if (onclick?.includes('timesheet')) {
return 'timesheet';
}
                if (onclick?.includes('reports')) {
return 'reports';
}
            }

            // ברירת מחדל
            return 'budget';
        } catch (error) {
            errorHandler.handleError(error, 'VirtualAssistant.detectCurrentTab');
            return 'budget';
        }
    }

    /**
     * 🎯 Setup Tab Detection - מאזין לשינויי טאבים
     */
    setupTabDetection() {
        try {
            // זיהוי טאב ראשוני
            const currentTab = this.detectCurrentTab();
            this.stateManager.setState({ currentTab }, 'TabDetection.initial');
            logger.info('Initial tab detected', { currentTab });

            // האזנה לקליקים על כפתורי טאב
            document.addEventListener('click', (e) => {
                const tabButton = e.target.closest('.tab-button');
                if (tabButton) {
                    // המתן קצר לאחר החלפת הטאב
                    setTimeout(() => {
                        const newTab = this.detectCurrentTab();
                        const oldTab = this.stateManager.getState().currentTab;

                        if (newTab !== oldTab) {
                            this.stateManager.setState({ currentTab: newTab }, 'TabDetection.switch');
                            logger.info('Tab switched', { from: oldTab, to: newTab });
                            eventBus.emit('va:tab-changed', { from: oldTab, to: newTab });

                            // עדכן הצעות אם הצ'אט בוט פתוח
                            if (this.isOpen && this.stateManager.getState().view === 'home') {
                                this.showHome(); // רענן את התצוגה עם הקשר חדש
                            }
                        }
                    }, 100);
                }
            });

            // האזנה לפונקציית switchTab גלובלית
            const originalSwitchTab = window.switchTab;
            if (typeof originalSwitchTab === 'function') {
                window.switchTab = (...args) => {
                    originalSwitchTab(...args);
                    setTimeout(() => {
                        const newTab = this.detectCurrentTab();
                        const oldTab = this.stateManager.getState().currentTab;

                        if (newTab !== oldTab) {
                            this.stateManager.setState({ currentTab: newTab }, 'TabDetection.switchTab');
                            logger.info('Tab switched via switchTab()', { from: oldTab, to: newTab, args });
                            eventBus.emit('va:tab-changed', { from: oldTab, to: newTab });

                            // עדכן הצעות אם הצ'אט בוט פתוח
                            if (this.isOpen && this.stateManager.getState().view === 'home') {
                                this.showHome();
                            }
                        }
                    }, 100);
                };
            }

            logger.info('Tab detection setup completed');
        } catch (error) {
            errorHandler.handleError(error, 'VirtualAssistant.setupTabDetection');
        }
    }

    /**
     * מטפל בשינויי הקשר
     */
    onContextChanged(context) {
        try {
            logger.debug('Context changed, updating suggestions:', context);

            // עדכון הצעות חכמות
            if (this.isOpen && this.stateManager.getState().view === 'home') {
                this.updateContextualContent(context);
            }

            // מעקב אנליטיקס
            if (this.analyticsEngine) {
                this.analyticsEngine.trackEvent('context_change', {
                    page: context.page,
                    url: context.url
                });
            }
        } catch (error) {
            errorHandler.handleError(error, 'VirtualAssistant.onContextChanged');
        }
    }

    /**
     * עדכון תוכן לפי הקשר
     */
    updateContextualContent(context) {
        try {
            if (!this.contentContainer) {
return;
}

            // קבלת הצעות והתאמות לפי הקשר
            const suggestions = this.smartSuggestions.getSuggestionsForContext(context);
            const quickActions = this.smartSuggestions.getQuickActionsForContext(context);
            const contextTitle = this.smartSuggestions.getContextTitle(context);

            // עדכון כותרת אם יש הקשר ספציפי
            if (context.page !== 'home') {
                this.updateContextBanner(contextTitle, context.page);
            }

            // הוספת Quick Actions אם יש
            if (quickActions && quickActions.length > 0) {
                this.renderQuickActions(quickActions);
            }
        } catch (error) {
            errorHandler.handleError(error, 'VirtualAssistant.updateContextualContent');
        }
    }

    /**
     * רינדור באנר הקשר
     */
    updateContextBanner(title, page) {
        // מציאת או יצירת באנר
        let banner = this.container.querySelector('.va-context-banner');

        if (!banner) {
            banner = DOMController.createElement('div', {
                className: 'va-context-banner'
            });

            // הוספה אחרי החיפוש
            const searchContainer = this.container.querySelector('.va-search-container');
            if (searchContainer && searchContainer.nextSibling) {
                searchContainer.parentNode.insertBefore(banner, searchContainer.nextSibling);
            }
        }

        const icons = {
            clients: '👥',
            tasks: '✅',
            budget: '💰',
            reports: '📊',
            employees: '👔'
        };

        banner.innerHTML = `
            <span class="va-context-icon">${icons[page] || '📍'}</span>
            <span class="va-context-text">אתה נמצא ב${title}</span>
        `;

        banner.style.display = 'flex';
    }

    /**
     * רינדור Quick Actions
     */
    renderQuickActions(actions) {
        if (!actions || actions.length === 0) {
return;
}

        let container = this.contentContainer.querySelector('.va-quick-actions');

        if (!container) {
            container = DOMController.createElement('div', {
                className: 'va-quick-actions'
            });

            // הוספה בראש התוכן
            this.contentContainer.insertBefore(container, this.contentContainer.firstChild);
        }

        let html = '<h3 class="va-quick-actions-title">פעולות מהירות</h3><div class="va-quick-actions-grid">';

        actions.forEach(action => {
            html += `
                <button class="va-quick-action-btn" data-action-id="${action.id}" style="border-color: ${action.color};">
                    <span class="va-quick-action-icon">${action.icon}</span>
                    <span class="va-quick-action-label">${action.label}</span>
                </button>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        // צירוף event listeners
        container.querySelectorAll('.va-quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const actionId = btn.dataset.actionId;
                const action = actions.find(a => a.id === actionId);
                if (action && typeof action.action === 'function') {
                    action.action();

                    // Analytics
                    if (this.analyticsEngine) {
                        this.analyticsEngine.trackEvent('quick_action', {
                            actionId: action.id,
                            actionLabel: action.label
                        });
                    }

                    // סגירת העוזר לאחר פעולה מהירה
                    setTimeout(() => this.close(), 300);
                }
            });
        });
    }

    /**
     * רינדור הצעות מותאמות כפופאפ צף
     */
    renderContextualSuggestions(suggestions) {
        if (!suggestions || suggestions.length === 0) {
return;
}

        // בדיקה אם כבר קיים פופאפ בתוך הצ'אטבוט
        const existingPopup = this.container.querySelector('.va-suggestions-popup');
        if (existingPopup) {
            this.closeContextualPopup(existingPopup);
            return;
        }

        // יצירת הפופאפ
        const popup = DOMController.createElement('div', {
            className: 'va-suggestions-popup'
        });

        // בנית תוכן הפופאפ
        let html = `
            <div class="va-suggestions-popup-header">
                <h3 class="va-suggestions-popup-title">מומלץ עבורך</h3>
                <button class="va-suggestions-popup-close" aria-label="סגור">×</button>
            </div>
            <div class="va-suggestions-popup-content">
                <div class="va-suggestions-popup-items">
        `;

        // הוספת כל ההצעות
        suggestions.forEach(suggestion => {
            html += `
                <div class="va-suggestion-pill" data-action="${suggestion.action}">
                    <div class="va-suggestion-pill-icon">${suggestion.icon}</div>
                    <div class="va-suggestion-pill-text">${suggestion.title}</div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        popup.innerHTML = html;

        // הוספה ל-container של הצ'אטבוט (לא ל-body)
        this.container.appendChild(popup);

        // Event listeners
        const closeBtn = popup.querySelector('.va-suggestions-popup-close');
        closeBtn.addEventListener('click', () => {
            this.closeContextualPopup(popup);
        });

        // טיפול בלחיצה על הצעה
        popup.querySelectorAll('.va-suggestion-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const actionStr = pill.dataset.action;
                if (actionStr && actionStr.startsWith('guide:')) {
                    const guideId = actionStr.replace('guide:', '');
                    // הפעלת המדריך
                    eventBus.emit('guide:requested', { guideId });
                }

                // Analytics tracking
                if (this.analyticsEngine) {
                    this.analyticsEngine.trackEvent('contextual_suggestion_clicked', {
                        action: actionStr
                    });
                }

                // סגירת הפופאפ אחרי לחיצה
                this.closeContextualPopup(popup);
            });
        });

        // NO AUTO-CLOSE - ייסגר רק בסגירה ידנית
    }

    static getInstance() {
        if (!VirtualAssistant.instance) {
            new VirtualAssistant();
        }
        return VirtualAssistant.instance;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 10: ADVANCED FEATURES - Context, Analytics & Feedback
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @class ContextDetector
 * @description זיהוי אוטומטי של ההקשר הנוכחי במערכת
 */
class ContextDetector {
    constructor() {
        this.currentContext = null;
        this.contextHistory = [];
        this.observers = [];
        this.detectionInterval = null;

        logger.info('ContextDetector initialized');
    }

    /**
     * זיהוי הקשר נוכחי לפי URL, DOM ופעילות משתמש
     */
    detectCurrentContext() {
        const context = {
            page: this.getPageType(),
            url: window.location.href,
            tabId: this.getActiveTab(),
            timestamp: Date.now(),
            hash: window.location.hash
        };

        // בדיקה אם השתנה
        if (JSON.stringify(context) !== JSON.stringify(this.currentContext)) {
            this.currentContext = context;
            this.contextHistory.push(context);

            // שמירה רק 20 הקשרים אחרונים
            if (this.contextHistory.length > 20) {
                this.contextHistory.shift();
            }

            this.notifyObservers(context);
            logger.debug('Context changed:', context);
        }

        return context;
    }

    /**
     * זיהוי סוג העמוד לפי אלמנטים גלויים
     */
    getPageType() {
        // בדיקת טאבים פעילים
        const activeTab = this.getActiveTab();

        if (activeTab === 'clients') {
return 'clients';
}
        if (activeTab === 'tasks') {
return 'tasks';
}
        if (activeTab === 'budget') {
return 'budget';
}
        if (activeTab === 'reports') {
return 'reports';
}
        if (activeTab === 'employees') {
return 'employees';
}

        // בדיקת sections גלויים
        if (this.isElementVisible('#clientsSection')) {
return 'clients';
}
        if (this.isElementVisible('#tasksSection')) {
return 'tasks';
}
        if (this.isElementVisible('#budgetSection')) {
return 'budget';
}
        if (this.isElementVisible('#reportsSection')) {
return 'reports';
}
        if (this.isElementVisible('#employeesSection')) {
return 'employees';
}

        return 'home';
    }

    /**
     * מציאת הטאב הפעיל
     */
    getActiveTab() {
        const activeTab = document.querySelector('.tab-button.active');
        return activeTab?.dataset?.tab || null;
    }

    /**
     * בדיקה אם אלמנט גלוי
     */
    isElementVisible(selector) {
        const element = document.querySelector(selector);
        if (!element) {
return false;
}

        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    /**
     * הפעלת ניטור אוטומטי
     */
    startMonitoring(intervalMs = 2000) {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
        }

        this.detectionInterval = setInterval(() => {
            this.detectCurrentContext();
        }, intervalMs);

        // זיהוי ראשוני
        this.detectCurrentContext();

        logger.info('Context monitoring started');
    }

    /**
     * עצירת ניטור
     */
    stopMonitoring() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
            logger.info('Context monitoring stopped');
        }
    }

    /**
     * הרשמה לשינויי הקשר - Observer Pattern
     */
    subscribe(callback) {
        if (typeof callback === 'function') {
            this.observers.push(callback);
        }
    }

    /**
     * עדכון כל המאזינים
     */
    notifyObservers(context) {
        this.observers.forEach(observer => {
            try {
                observer(context);
            } catch (error) {
                errorHandler.handleError(error, 'ContextDetector.notifyObservers');
            }
        });
    }

    /**
     * קבלת ההקשר הנוכחי
     */
    getCurrentContext() {
        return this.currentContext;
    }
}

/**
 * @class SmartSuggestionsEngine
 * @description מנוע הצעות חכמות לפי הקשר
 */
class SmartSuggestionsEngine {
    constructor(contextDetector) {
        this.contextDetector = contextDetector;
        this.suggestionRules = this.initSuggestionRules();

        logger.info('SmartSuggestionsEngine initialized');
    }

    /**
     * הגדרת כללי הצעות לכל סוג עמוד
     */
    initSuggestionRules() {
        return {
            clients: {
                contextTitle: 'ניהול לקוחות',
                suggestions: [
                    {
                        id: 'add_client',
                        title: 'איך להוסיף לקוח חדש?',
                        icon: '👤',
                        action: 'guide:add-client',
                        priority: 1
                    },
                    {
                        id: 'edit_client',
                        title: 'עריכת פרטי לקוח',
                        icon: '✏️',
                        action: 'guide:edit-client',
                        priority: 2
                    },
                    {
                        id: 'client_history',
                        title: 'צפייה בהיסטוריית לקוח',
                        icon: '📋',
                        action: 'guide:client-history',
                        priority: 3
                    }
                ],
                quickActions: [
                    {
                        id: 'quick_add_client',
                        label: 'לקוח חדש',
                        icon: '➕',
                        color: '#3b82f6',
                        action: () => {
                            const addBtn = document.querySelector('#addClientBtn');
                            if (addBtn) {
addBtn.click();
}
                        }
                    }
                ]
            },
            tasks: {
                contextTitle: 'ניהול משימות',
                suggestions: [
                    {
                        id: 'add_task',
                        title: 'איך ליצור משימה חדשה?',
                        icon: '✅',
                        action: 'guide:add-task',
                        priority: 1
                    },
                    {
                        id: 'track_time',
                        title: 'הוספת זמן עבודה למשימה',
                        icon: '⏱️',
                        action: 'guide:track-time',
                        priority: 2
                    },
                    {
                        id: 'task_status',
                        title: 'שינוי סטטוס משימה',
                        icon: '🔄',
                        action: 'guide:task-status',
                        priority: 3
                    }
                ],
                quickActions: [
                    {
                        id: 'quick_add_task',
                        label: 'משימה חדשה',
                        icon: '➕',
                        color: '#10b981',
                        action: () => {
                            const addBtn = document.querySelector('#addTaskBtn');
                            if (addBtn) {
addBtn.click();
}
                        }
                    }
                ]
            },
            budget: {
                contextTitle: 'תקצוב ודיווח',
                suggestions: [
                    {
                        id: 'budget_report',
                        title: 'יצירת דוח תקצוב חודשי',
                        icon: '📊',
                        action: 'guide:budget-report',
                        priority: 1
                    },
                    {
                        id: 'budget_analysis',
                        title: 'ניתוח תקציב לפי לקוח',
                        icon: '📈',
                        action: 'guide:budget-analysis',
                        priority: 2
                    }
                ],
                quickActions: [
                    {
                        id: 'quick_monthly_report',
                        label: 'דוח חודשי',
                        icon: '📊',
                        color: '#8b5cf6',
                        action: () => {
                            const reportBtn = document.querySelector('[data-report="monthly"]');
                            if (reportBtn) {
reportBtn.click();
}
                        }
                    }
                ]
            },
            reports: {
                contextTitle: 'דוחות',
                suggestions: [
                    {
                        id: 'export_report',
                        title: 'ייצוא דוח לאקסל',
                        icon: '📥',
                        action: 'guide:export-report',
                        priority: 1
                    }
                ],
                quickActions: []
            },
            home: {
                contextTitle: 'מסך הבית',
                suggestions: [
                    {
                        id: 'getting_started',
                        title: 'התחלת עבודה במערכת',
                        icon: '🚀',
                        action: 'guide:getting-started',
                        priority: 1
                    },
                    {
                        id: 'quick_tour',
                        title: 'סיור מהיר במערכת',
                        icon: '🗺️',
                        action: 'guide:quick-tour',
                        priority: 2
                    }
                ],
                quickActions: []
            }
        };
    }

    /**
     * קבלת הצעות לפי הקשר נוכחי
     */
    getSuggestionsForContext(context) {
        if (!context || !context.page) {
            return [];
        }

        const rules = this.suggestionRules[context.page];
        if (!rules) {
            return this.suggestionRules.home.suggestions;
        }

        return rules.suggestions || [];
    }

    /**
     * קבלת Quick Actions לפי הקשר נוכחי
     */
    getQuickActionsForContext(context) {
        if (!context || !context.page) {
            return [];
        }

        const rules = this.suggestionRules[context.page];
        if (!rules) {
            return [];
        }

        return rules.quickActions || [];
    }

    /**
     * קבלת כותרת הקשר
     */
    getContextTitle(context) {
        if (!context || !context.page) {
            return 'העוזר הווירטואלי';
        }

        const rules = this.suggestionRules[context.page];
        return rules?.contextTitle || 'העוזר הווירטואלי';
    }
}

/**
 * @class FeedbackSystem
 * @description מערכת פידבק עם Firestore
 */
class FeedbackSystem {
    constructor(userId) {
        this.userId = userId;
        this.db = null;

        // בדיקה אם Firebase זמין
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            this.db = firebase.firestore();
            logger.info('FeedbackSystem initialized with Firestore');
        } else {
            logger.warn('FeedbackSystem: Firebase not available, feedback will be stored locally');
        }
    }

    /**
     * שליחת פידבק
     */
    async submitFeedback(itemId, itemType, rating, comment = null) {
        try {
            const feedbackData = {
                userId: this.userId,
                itemId: itemId,
                itemType: itemType,
                rating: rating,
                comment: comment,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            };

            if (this.db) {
                // שמירה ב-Firestore
                await this.db.collection('va_feedback').add(feedbackData);

                // עדכון מטריקס
                await this.updateItemMetrics(itemId, itemType, rating);

                logger.info('Feedback submitted to Firestore:', feedbackData);
            } else {
                // שמירה מקומית אם אין Firestore
                this.saveFeedbackLocally(feedbackData);
                logger.info('Feedback saved locally:', feedbackData);
            }

            return { success: true };
        } catch (error) {
            errorHandler.handleError(error, 'FeedbackSystem.submitFeedback');
            return { success: false, error };
        }
    }

    /**
     * עדכון מטריקס של פריט
     */
    async updateItemMetrics(itemId, itemType, rating) {
        if (!this.db) {
return;
}

        try {
            const metricsRef = this.db.collection('va_metrics').doc(`${itemType}_${itemId}`);

            await metricsRef.set({
                itemId,
                itemType,
                totalFeedback: firebase.firestore.FieldValue.increment(1),
                positiveRating: rating === 5 ? firebase.firestore.FieldValue.increment(1) : firebase.firestore.FieldValue.increment(0),
                negativeRating: rating === 1 ? firebase.firestore.FieldValue.increment(1) : firebase.firestore.FieldValue.increment(0),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch (error) {
            errorHandler.handleError(error, 'FeedbackSystem.updateItemMetrics');
        }
    }

    /**
     * שמירה מקומית של פידבק
     */
    saveFeedbackLocally(feedbackData) {
        try {
            const key = 'va_feedback_local';
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            existing.push(feedbackData);

            // שמירה רק 100 פידבקים אחרונים
            if (existing.length > 100) {
                existing.shift();
            }

            localStorage.setItem(key, JSON.stringify(existing));
        } catch (error) {
            errorHandler.handleError(error, 'FeedbackSystem.saveFeedbackLocally');
        }
    }

    /**
     * יצירת UI לפידבק
     */
    createFeedbackUI(itemId, itemType) {
        const container = DOMController.createElement('div', {
            className: 'va-feedback-container'
        });

        container.innerHTML = `
            <div class="va-feedback-prompt">האם זה עזר לך?</div>
            <div class="va-feedback-buttons">
                <button class="va-feedback-btn va-feedback-positive" data-rating="5">
                    <span class="va-feedback-icon">👍</span>
                    <span>כן</span>
                </button>
                <button class="va-feedback-btn va-feedback-negative" data-rating="1">
                    <span class="va-feedback-icon">👎</span>
                    <span>לא</span>
                </button>
            </div>
        `;

        // האזנה לקליקים
        container.querySelectorAll('.va-feedback-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const rating = parseInt(btn.dataset.rating);
                await this.submitFeedback(itemId, itemType, rating);
                this.showFeedbackConfirmation(container, rating);
            });
        });

        return container;
    }

    /**
     * הצגת אישור לאחר פידבק
     */
    showFeedbackConfirmation(container, rating) {
        container.innerHTML = `
            <div class="va-feedback-success">
                <span class="va-feedback-success-icon">✓</span>
                <span>${rating === 5 ? 'תודה על המשוב!' : 'תודה, נשפר את זה'}</span>
            </div>
        `;

        setTimeout(() => {
            container.style.opacity = '0';
            setTimeout(() => container.remove(), 300);
        }, 2000);
    }
}

/**
 * @class AnalyticsEngine
 * @description מעקב אחר שימוש ואנליטיקס
 */
class AnalyticsEngine {
    constructor(userId) {
        this.userId = userId;
        this.db = null;
        this.sessionId = `${userId}_${Date.now()}`;
        this.sessionStart = Date.now();
        this.events = [];

        // בדיקה אם Firebase זמין
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            this.db = firebase.firestore();
            logger.info('AnalyticsEngine initialized with Firestore');
        } else {
            logger.warn('AnalyticsEngine: Firebase not available, analytics will be stored locally');
        }
    }

    /**
     * רישום אירוע
     */
    async trackEvent(eventType, eventData = {}) {
        const event = {
            userId: this.userId,
            type: eventType,
            data: eventData,
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            sessionDuration: Date.now() - this.sessionStart
        };

        this.events.push(event);

        try {
            // 🔇 Analytics מושבת זמנית - גורם לשגיאות 400 בלופ אינסופי
            // TODO: להפעיל מחדש אחרי הגדרת Firestore rules נכונה
            if (false && this.db) {
                // שמירה ב-Firestore
                await this.db.collection('va_analytics').add(event);

                // עדכון סטטיסטיקות משתמש
                await this.updateUserStats(eventType);

                logger.debug('Analytics event tracked:', eventType);
            } else {
                // שמירה מקומית בלבד (Analytics מושבת)
                this.saveEventLocally(event);
            }
        } catch (error) {
            errorHandler.handleError(error, 'AnalyticsEngine.trackEvent');
        }
    }

    /**
     * עדכון סטטיסטיקות משתמש
     */
    async updateUserStats(eventType) {
        if (!this.db) {
return;
}

        try {
            const userStatsRef = this.db.collection('va_user_stats').doc(this.userId);

            const updates = {
                totalEvents: firebase.firestore.FieldValue.increment(1),
                lastActivity: firebase.firestore.FieldValue.serverTimestamp()
            };

            // עדכון counter ספציפי לסוג האירוע
            updates[`events.${eventType}`] = firebase.firestore.FieldValue.increment(1);

            await userStatsRef.set(updates, { merge: true });
        } catch (error) {
            errorHandler.handleError(error, 'AnalyticsEngine.updateUserStats');
        }
    }

    /**
     * שמירה מקומית של אירוע
     */
    saveEventLocally(event) {
        try {
            const key = 'va_analytics_local';
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            existing.push(event);

            // שמירה רק 500 אירועים אחרונים
            if (existing.length > 500) {
                existing.shift();
            }

            localStorage.setItem(key, JSON.stringify(existing));
        } catch (error) {
            errorHandler.handleError(error, 'AnalyticsEngine.saveEventLocally');
        }
    }

    // מתודות נוחות לרישום אירועים נפוצים
    trackSearch(query, resultsCount) {
        this.trackEvent('search', { query, resultsCount });
    }

    trackGuideView(guideId, guideTitle) {
        this.trackEvent('guide_view', { guideId, guideTitle });
    }

    trackGuideComplete(guideId, duration) {
        this.trackEvent('guide_complete', { guideId, duration });
    }

    trackActionClick(actionId, actionTitle) {
        this.trackEvent('action_click', { actionId, actionTitle });
    }

    trackOpen() {
        this.trackEvent('assistant_open');
    }

    trackClose() {
        this.trackEvent('assistant_close');
    }
}

/**
 * @class StatisticsDashboard
 * @description לוח סטטיסטיקות אישי
 */
class StatisticsDashboard {
    constructor(userId, analyticsEngine) {
        this.userId = userId;
        this.analytics = analyticsEngine;
        this.db = null;

        if (typeof firebase !== 'undefined' && firebase.firestore) {
            this.db = firebase.firestore();
        }

        logger.info('StatisticsDashboard initialized');
    }

    /**
     * קבלת סטטיסטיקות משתמש
     */
    async getUserStatistics() {
        try {
            let stats = {
                totalUses: 0,
                monthlyUses: 0,
                topGuides: [],
                achievements: [],
                streakDays: 0
            };

            if (this.db) {
                // שליפה מ-Firestore
                const userStats = await this.db.collection('va_user_stats').doc(this.userId).get();
                if (userStats.exists) {
                    const data = userStats.data();
                    stats.totalUses = data.totalEvents || 0;
                    stats.monthlyUses = await this.getMonthlyUsage();
                    stats.topGuides = await this.getTopGuides();
                    stats.achievements = this.calculateAchievements(data);
                    stats.streakDays = await this.calculateStreak();
                }
            } else {
                // חישוב מקומי
                stats = this.getLocalStatistics();
            }

            return stats;
        } catch (error) {
            errorHandler.handleError(error, 'StatisticsDashboard.getUserStatistics');
            return null;
        }
    }

    /**
     * חישוב שימושים חודשיים
     */
    async getMonthlyUsage() {
        if (!this.db) {
return 0;
}

        try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const snapshot = await this.db.collection('va_analytics')
                .where('userId', '==', this.userId)
                .where('timestamp', '>=', startOfMonth.toISOString())
                .get();

            return snapshot.size;
        } catch (error) {
            errorHandler.handleError(error, 'StatisticsDashboard.getMonthlyUsage');
            return 0;
        }
    }

    /**
     * קבלת המדריכים הפופולריים ביותר
     */
    async getTopGuides() {
        if (!this.db) {
return [];
}

        try {
            const snapshot = await this.db.collection('va_analytics')
                .where('userId', '==', this.userId)
                .where('type', '==', 'guide_complete')
                .limit(100)
                .get();

            const guideCounts = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                const guideId = data.data?.guideId;
                if (guideId) {
                    guideCounts[guideId] = (guideCounts[guideId] || 0) + 1;
                }
            });

            return Object.entries(guideCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([guideId, count]) => ({ guideId, count }));
        } catch (error) {
            errorHandler.handleError(error, 'StatisticsDashboard.getTopGuides');
            return [];
        }
    }

    /**
     * חישוב הישגים
     */
    calculateAchievements(data) {
        const achievements = [];

        if (data.totalEvents >= 10) {
            achievements.push({
                id: 'first_steps',
                title: 'צעדים ראשונים',
                icon: '🎯',
                description: 'השתמשת במערכת 10 פעמים'
            });
        }
        if (data.totalEvents >= 50) {
            achievements.push({
                id: 'power_user',
                title: 'משתמש כוח',
                icon: '🚀',
                description: 'השתמשת במערכת 50 פעמים'
            });
        }
        if (data.totalEvents >= 100) {
            achievements.push({
                id: 'expert',
                title: 'מומחה',
                icon: '⭐',
                description: 'השתמשת במערכת 100 פעמים'
            });
        }
        if (data.events?.guide_complete >= 10) {
            achievements.push({
                id: 'guide_master',
                title: 'מומחה מדריכים',
                icon: '🎓',
                description: 'השלמת 10 מדריכים'
            });
        }
        if (data.events?.search >= 50) {
            achievements.push({
                id: 'search_expert',
                title: 'מומחה חיפוש',
                icon: '🔍',
                description: 'ביצעת 50 חיפושים'
            });
        }

        return achievements;
    }

    /**
     * חישוב רצף ימים
     */
    async calculateStreak() {
        // יישום פשוט - ניתן להרחיב
        return 0;
    }

    /**
     * קבלת סטטיסטיקות מקומיות
     */
    getLocalStatistics() {
        try {
            const events = JSON.parse(localStorage.getItem('va_analytics_local') || '[]');

            const now = Date.now();
            const monthAgo = now - (30 * 24 * 60 * 60 * 1000);

            const monthlyEvents = events.filter(e => {
                const eventTime = new Date(e.timestamp).getTime();
                return eventTime >= monthAgo;
            });

            return {
                totalUses: events.length,
                monthlyUses: monthlyEvents.length,
                topGuides: [],
                achievements: [],
                streakDays: 0
            };
        } catch (error) {
            errorHandler.handleError(error, 'StatisticsDashboard.getLocalStatistics');
            return {
                totalUses: 0,
                monthlyUses: 0,
                topGuides: [],
                achievements: [],
                streakDays: 0
            };
        }
    }

    /**
     * רינדור לוח הסטטיסטיקות
     */
    async renderStatistics(container) {
        const stats = await this.getUserStatistics();

        if (!stats) {
            container.innerHTML = `
                <div class="va-stats-error">
                    <span class="va-stats-error-icon">⚠️</span>
                    <p>לא ניתן לטעון סטטיסטיקות כרגע</p>
                </div>
            `;
            return;
        }

        let html = '<div class="va-stats-dashboard">';

        // כרטיסי סטטיסטיקות
        html += `
            <div class="va-stats-grid">
                <div class="va-stat-card">
                    <div class="va-stat-icon">📊</div>
                    <div class="va-stat-value">${stats.monthlyUses}</div>
                    <div class="va-stat-label">שימושים החודש</div>
                </div>

                <div class="va-stat-card">
                    <div class="va-stat-icon">🎯</div>
                    <div class="va-stat-value">${stats.totalUses}</div>
                    <div class="va-stat-label">סה"כ שימושים</div>
                </div>
        `;

        if (stats.streakDays > 0) {
            html += `
                <div class="va-stat-card">
                    <div class="va-stat-icon">🔥</div>
                    <div class="va-stat-value">${stats.streakDays}</div>
                    <div class="va-stat-label">ימים ברצף</div>
                </div>
            `;
        }

        html += '</div>'; // close stats-grid

        // הישגים
        if (stats.achievements.length > 0) {
            html += `
                <div class="va-achievements-section">
                    <h3 class="va-stats-section-title">🏆 ההישגים שלך</h3>
                    <div class="va-achievements-list">
            `;

            stats.achievements.forEach(achievement => {
                html += `
                    <div class="va-achievement-item">
                        <span class="va-achievement-icon">${achievement.icon}</span>
                        <div class="va-achievement-content">
                            <div class="va-achievement-title">${achievement.title}</div>
                            <div class="va-achievement-desc">${achievement.description}</div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        // מדריכים פופולריים
        if (stats.topGuides.length > 0) {
            html += `
                <div class="va-top-guides-section">
                    <h3 class="va-stats-section-title">⭐ המדריכים הפופולריים שלך</h3>
                    <div class="va-top-guides-list">
            `;

            stats.topGuides.forEach((guide, index) => {
                html += `
                    <div class="va-top-guide-item">
                        <span class="va-guide-rank">#${index + 1}</span>
                        <span class="va-guide-name">${guide.guideId}</span>
                        <span class="va-guide-count">${guide.count} פעמים</span>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        html += '</div>'; // close stats-dashboard

        container.innerHTML = html;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL ACCESS & AUTO-INIT
// ═══════════════════════════════════════════════════════════════════════════

window.virtualAssistant = VirtualAssistant.getInstance();

window.openVirtualAssistant = function() {
    window.virtualAssistant.open();
};

window.closeVirtualAssistant = function() {
    window.virtualAssistant.close();
};

logger.info('VirtualAssistant global instance created');

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.virtualAssistant.init();
    });
} else {
    window.virtualAssistant.init();
}

})(); // End of IIFE
