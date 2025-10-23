/**
 * הצ'אטבוט המשפטי החכם - Smart Legal Assistant
 * קובץ ראשי מודולרי
 *
 * מבנה התיקיות:
 * chatbot/
 * ├── index.js (זה)
 * ├── data/
 * │   └── faq-database.js
 * ├── utils/
 * │   ├── text-processing.js
 * │   └── highlighter.js
 * ├── ui/
 * │   ├── messages.js
 * │   ├── suggestions.js
 * │   └── chat-interface.js
 * ├── styles/
 * │   └── chatbot-styles.js
 * └── core/
 *     ├── search-engine.js
 *     ├── system-tour.js
 *     └── chatbot-main.js
 */

// ייבוא מודולים
import { faqDatabase, contextualSuggestions } from './data/faq-database.js';
import { normalizeText, calculateSimilarity, calculateMatchScore } from './utils/text-processing.js';
import { highlightElement, removeAllHighlights, addHighlightStyles } from './utils/highlighter.js';
import { addUserMessage, addBotMessage, showTypingIndicator, removeTypingIndicator, scrollToBottom, clearMessages } from './ui/messages.js';
import { showSuggestions, showContextualSuggestions, showRelatedQuestions, clearSuggestions } from './ui/suggestions.js';
import { addBotStyles } from './styles/chatbot-styles.js';
import { SystemTour } from './core/system-tour.js';

/**
 * העוזר המשפטי החכם - Smart Legal Assistant
 * מערכת חיפוש חכמה עם מאגר שאלות ותשובות מדויקות למשרד עו"ד
 * צבעי המערכת: #3b82f6 (כחול ראשי)
 */
class SmartFAQBot {
    constructor() {
        this.isOpen = false;
        this.chatHistory = [];
        this.currentContext = null;

        // השתמש במאגר ה-FAQ המיובא
        this.faqDatabase = faqDatabase;
        this.contextualSuggestions = contextualSuggestions;

        this.init();
    }

    init() {
        this.createBotUI();
        this.attachEventListeners();
        this.detectContext();
        addHighlightStyles(); // הוסף אנימציות להדגשה
        this.setupButtonDelegation(); // הוסף event delegation לכפתורים

        // F1 פותח את הבוט
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F1') {
                e.preventDefault();
                this.toggleBot();
            }
        });
    }

    /**
     * מגדיר event delegation לכפתורי פעולה
     */
    setupButtonDelegation() {
        // האזן לכל הלחיצות על כפתורים בתוך הודעות הבוט
        document.addEventListener('click', (e) => {
            // בדוק אם הלחיצה היא על כפתור פעולה
            if (e.target.classList.contains('bot-action-button')) {
                const action = e.target.dataset.action;
                const selector = e.target.dataset.selector;

                if (action) {
                    this.handleActionButton(action, selector || '');
                }
            }
        });
    }

    createBotUI() {
        const botHTML = `
            <!-- כפתור צף לפתיחת הבוט -->
            <div id="faq-bot-button" class="faq-bot-button" title="צ'אט עזרה - לחץ או F1">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
            </div>

            <!-- חלון הצ'אט -->
            <div id="faq-bot-container" class="faq-bot-container hidden">
                <div class="faq-bot-header">
                    <div class="faq-bot-header-content">
                        <div class="faq-bot-avatar">⚖️</div>
                        <div>
                            <h3>העוזר המשפטי החכם</h3>
                            <span class="faq-bot-status">תמיד כאן לעזור</span>
                        </div>
                    </div>
                    <div class="faq-bot-header-actions">
                        <button class="faq-bot-new-chat" id="faq-bot-new-chat" title="התחל שיחה חדשה">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18M3 12h18M3 18h18"/>
                            </svg>
                        </button>
                        <button class="faq-bot-close" id="faq-bot-close">×</button>
                    </div>
                </div>

                <div class="faq-bot-messages" id="faq-bot-messages">
                    <!-- הודעות יופיעו כאן -->
                </div>

                <div class="faq-bot-suggestions" id="faq-bot-suggestions">
                    <!-- הצעות יופיעו כאן -->
                </div>

                <div class="faq-bot-input-container">
                    <input
                        type="text"
                        id="faq-bot-input"
                        class="faq-bot-input"
                        placeholder="שאל שאלה או חפש נושא..."
                        autocomplete="off"
                    />
                    <button class="faq-bot-send" id="faq-bot-send">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', botHTML);
        addBotStyles(); // הוסף CSS
    }

    attachEventListeners() {
        const button = document.getElementById('faq-bot-button');
        const closeBtn = document.getElementById('faq-bot-close');
        const newChatBtn = document.getElementById('faq-bot-new-chat');
        const sendBtn = document.getElementById('faq-bot-send');
        const input = document.getElementById('faq-bot-input');

        button.addEventListener('click', () => this.toggleBot());
        closeBtn.addEventListener('click', () => this.toggleBot());
        newChatBtn.addEventListener('click', () => this.startNewChat());
        sendBtn.addEventListener('click', () => this.handleUserInput());

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleUserInput();
            }
        });
    }

    /**
     * מתחיל שיחה חדשה - מנקה את ההיסטוריה
     */
    startNewChat() {
        // נקה את כל ההודעות
        clearMessages();

        // נקה היסטוריה
        this.chatHistory = [];

        // הצג הודעת פתיחה מחדש
        const userName = this.getUserName();
        const greeting = userName ? `<strong>שלום ${userName}! 👋</strong>` : `<strong>שלום! 👋</strong>`;

        addBotMessage(`
            ${greeting}
            <p>אני כאן לעזור לך! 😊</p>
            <p>מה תרצה לדעת?</p>
        `, this.chatHistory);

        // הצג הצעות
        this.showContextualSuggestionsWrapper();

        // נקה את שדה הקלט
        document.getElementById('faq-bot-input').value = '';
        document.getElementById('faq-bot-input').focus();
    }

    toggleBot() {
        const container = document.getElementById('faq-bot-container');
        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            container.classList.remove('hidden');
            document.getElementById('faq-bot-input').focus();

            // עדכן סטטוס עם שם המשתמש
            const userName = this.getUserName();
            const statusElement = document.querySelector('.faq-bot-status');
            if (statusElement && userName) {
                statusElement.textContent = `שלום ${userName}!`;
            }

            // אם אין הודעות, הצג הודעת פתיחה
            if (this.chatHistory.length === 0) {
                const greeting = userName ? `<strong>שלום ${userName}! 👋</strong>` : `<strong>שלום! 👋</strong>`;
                addBotMessage(`
                    ${greeting}
                    <p>אני העוזר המשפטי החכם שלך.</p>
                    <p>איך אוכל לעזור לך היום?</p>
                `, this.chatHistory);
                this.showContextualSuggestionsWrapper();
            }
        } else {
            container.classList.add('hidden');
        }
    }

    handleUserInput() {
        const input = document.getElementById('faq-bot-input');
        const query = input.value.trim();

        if (!query) return;

        // הצג את שאלת המשתמש
        addUserMessage(query, this.chatHistory);
        input.value = '';

        // חיפוש תשובה
        showTypingIndicator();

        setTimeout(() => {
            removeTypingIndicator();

            // חפש בFAQ
            const answer = this.searchFAQ(query);

            if (answer) {
                addBotMessage(answer.answer, this.chatHistory);
                this.showRelatedQuestionsWrapper(answer.category);
            } else {
                addBotMessage(`
                    <strong>מצטער, לא מצאתי תשובה מדויקת 😕</strong>
                    <p>נסה לנסח את השאלה אחרת, או בחר אחת מההצעות:</p>
                `, this.chatHistory);
                this.showContextualSuggestionsWrapper();
            }
        }, 800);
    }

    searchFAQ(query) {
        const normalizedQuery = normalizeText(query);
        let bestMatch = null;
        let bestScore = 0;

        // חיפוש בכל הקטגוריות
        for (const category in this.faqDatabase) {
            const items = this.faqDatabase[category];

            for (const item of items) {
                const score = calculateMatchScore(normalizedQuery, item);

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = item;
                }
            }
        }

        // החזר תשובה רק אם הציון מספיק גבוה
        return bestScore > 0.3 ? bestMatch : null;
    }

    // Wrapper functions for suggestions
    showContextualSuggestionsWrapper() {
        showContextualSuggestions(
            this.contextualSuggestions,
            this.currentContext,
            (suggestion) => {
                document.getElementById('faq-bot-input').value = suggestion;
                this.handleUserInput();
            },
            () => this.startSystemTour()
        );
    }

    showRelatedQuestionsWrapper(category) {
        showRelatedQuestions(
            this.faqDatabase,
            category,
            (suggestion) => {
                document.getElementById('faq-bot-input').value = suggestion;
                this.handleUserInput();
            },
            () => this.startSystemTour()
        );
    }

    detectContext() {
        // זיהוי הטאב הפעיל
        const checkActiveTab = () => {
            const activeTab = document.querySelector('.tab-button.active');
            if (activeTab) {
                const tabText = activeTab.textContent.trim();
                if (tabText.includes('לקוחות') || tabText.includes('תיקים')) {
                    this.currentContext = 'clients';
                } else if (tabText.includes('משימות') || tabText.includes('תקצוב')) {
                    this.currentContext = 'tasks';
                } else if (tabText.includes('שעתון')) {
                    this.currentContext = 'timesheet';
                } else {
                    this.currentContext = 'default';
                }
            }
        };

        // בדוק בטעינה
        checkActiveTab();

        // האזן לשינויים בטאבים
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-button')) {
                setTimeout(checkActiveTab, 100);
            }
        });
    }

    getUserName() {
        // נסה לקבל את שם המשתמש מהמערכת
        try {
            // מהמנג'ר הראשי
            if (window.manager && window.manager.currentUsername) {
                return window.manager.currentUsername;
            }

            // מ-Firebase Auth (כשם fallback)
            if (window.firebaseAuth && window.firebaseAuth.currentUser) {
                const user = window.firebaseAuth.currentUser;
                return user.displayName || user.email?.split('@')[0] || 'משתמש';
            }
        } catch (error) {
            console.warn('לא ניתן לקבל שם משתמש:', error);
        }

        return null;
    }

    // פונקציות למערכת הסיור
    startSystemTour() {
        // סגור את הבוט אם הוא פתוח
        if (this.isOpen) {
            this.toggleBot();
        }

        // צור מופע חדש של הסיור והתחל אותו
        const tour = new SystemTour();
        tour.start();
    }

    handleActionButton(action, selector) {
        console.log('Action:', action, 'Selector:', selector);
        // TODO: ליישם טיפול בכפתורי פעולה
    }

    // Expose removeAllHighlights for onclick handlers
    removeAllHighlights() {
        removeAllHighlights();
    }
}

// יצירת מופע גלובלי של הבוט
const smartFAQBot = new SmartFAQBot();

// הפיכת הבוט לגלובלי כדי שניתן לגשת אליו מהקונסול ומכפתורים
window.smartFAQBot = smartFAQBot;

// ייצוא למודולים אחרים
export default smartFAQBot;
