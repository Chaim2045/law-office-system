/**
 * ========================================
 * סיור במערכת - System Tour (גרסה 2.0)
 * ========================================
 * מערכת הדרכה פשוטה ומקצועית למשתמשים חדשים
 * בנוי מחדש מאפס בצורה נקייה וקלאסית
 */

import { addTourStyles } from '../styles/tour-styles.js';

export class SystemTour {
    constructor() {
        this.currentStep = 0;
        this.isActive = false;
        this.steps = this.getSteps();
    }

    /**
     * שלבי הסיור
     */
    getSteps() {
        return [
            {
                title: '🎉 ברוכים הבאים למערכת!',
                text: 'בואו נתחיל סיור קצר שיעזור לכם להכיר את המערכת',
                element: null,
                position: 'center'
            },
            {
                title: '➕ כפתור הוספה מהיר',
                text: 'הכפתור הירוק הזה פותח תפריט מהיר להוספת משימה חדשה או רישום שעות עבודה',
                element: '#smartPlusBtn',
                position: 'bottom'
            },
            {
                title: '📁 תיק חדש',
                text: 'כפתור זה פותח חלון להוספת לקוח חדש או יצירת תיק חדש ללקוח קיים',
                element: 'button[onclick*="casesManager.showCreateCaseDialog"]',
                position: 'bottom'
            },
            {
                title: '📝 הוספת משימה חדשה',
                text: 'זה החלון להוספת משימה:\n\n1️⃣ תיאור המשימה - לדוגמא: "ייצוג משפטי - ישראל ישראלי"\n2️⃣ בחרו לקוח ותיק\n3️⃣ הזינו תקצוב שעות\n4️⃣ קבעו תאריך יעד\n\nהכל פשוט ומהיר!',
                element: '#smartFormModal',
                position: 'left',
                action: () => {
                    if (typeof openSmartForm === 'function') {
                        openSmartForm();
                    }
                }
            },
            {
                title: '📊 טאב תקצוב משימות',
                text: 'כאן תנהלו את כל המשימות המתוקצבות שלכם',
                element: 'button[onclick*="switchTab(\'budget\')"]',
                position: 'bottom',
                action: () => {
                    if (typeof switchTab === 'function') switchTab('budget');
                }
            },
            {
                title: '⏱️ טאב שעתון',
                text: 'כאן תדווחו על השעות שביצעתם ותעקבו אחרי הזמן',
                element: 'button[onclick*="switchTab(\'timesheet\')"]',
                position: 'bottom',
                action: () => {
                    if (typeof switchTab === 'function') switchTab('timesheet');
                }
            },
            {
                title: '💬 העוזר החכם',
                text: 'אם יש שאלות - פשוט לחצו כאן ושאלו אותי!',
                element: '.faq-bot-button',
                position: 'top'
            }
        ];
    }

    /**
     * התחלת הסיור
     */
    start() {
        if (this.isActive) return;

        this.isActive = true;
        this.currentStep = 0;
        this.createOverlay();
        this.showStep(0);
    }

    /**
     * יצירת overlay
     */
    createOverlay() {
        // הסר overlay קיים
        this.destroy();

        const overlay = document.createElement('div');
        overlay.id = 'tour-overlay';
        overlay.innerHTML = `
            <div class="tour-backdrop"></div>
            <div class="tour-spotlight"></div>
            <div class="tour-tooltip">
                <div class="tour-tooltip-header">
                    <h3 class="tour-tooltip-title"></h3>
                    <button class="tour-close-btn" title="סגור">×</button>
                </div>
                <p class="tour-tooltip-text"></p>
                <div class="tour-tooltip-footer">
                    <div class="tour-progress"></div>
                    <div class="tour-buttons">
                        <button class="tour-btn tour-btn-prev">← הקודם</button>
                        <button class="tour-btn tour-btn-next">הבא →</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        addTourStyles();
        this.attachEvents();
    }

    /**
     * הצגת שלב
     */
    showStep(index) {
        if (index < 0 || index >= this.steps.length) return;

        this.currentStep = index;
        const step = this.steps[index];

        // סגור דיאלוגים פתוחים אם לא זה השלב שלהם
        if (step.title !== '📝 הוספת משימה חדשה') {
            const smartFormModal = document.getElementById('smartFormModal');
            if (smartFormModal && smartFormModal.style.display !== 'none') {
                if (typeof closeSmartForm === 'function') {
                    closeSmartForm();
                } else {
                    smartFormModal.style.display = 'none';
                }
            }
        }

        // הרץ action אם יש
        if (step.action) {
            step.action();
            // המתן יותר זמן לשלבים עם דיאלוגים
            const delay = step.title === '📝 הוספת משימה חדשה' ? 800 : 300;
            setTimeout(() => this.renderStep(step), delay);
        } else {
            this.renderStep(step);
        }
    }

    /**
     * רינדור שלב
     */
    renderStep(step) {
        // אם אין אלמנט (center mode) - הצג באמצע המסך
        if (!step.element) {
            this.showCenterMode(step);
            return;
        }

        // מצא אלמנט
        const element = document.querySelector(step.element);
        if (!element) {
            console.warn('Tour: Element not found -', step.element);
            // אם זה דיאלוג שלא נפתח - הצג center mode כ-fallback
            if (step.element.includes('Modal')) {
                console.log('Tour: Using center mode as fallback for modal');
                this.showCenterMode(step);
                return;
            }
            return;
        }

        const rect = element.getBoundingClientRect();

        // עדכן spotlight
        this.updateSpotlight(rect);

        // עדכן tooltip
        this.updateTooltip(step, rect);

        // עדכן כפתורים
        this.updateButtons();
    }

    /**
     * מצב מרכז - ללא spotlight, רק tooltip באמצע עם רקע כהה
     */
    showCenterMode(step) {
        const spotlight = document.querySelector('.tour-spotlight');
        const tooltip = document.querySelector('.tour-tooltip');
        const title = document.querySelector('.tour-tooltip-title');
        const text = document.querySelector('.tour-tooltip-text');
        const progress = document.querySelector('.tour-progress');

        // הסתר spotlight אבל הפוך אותו לרקע כהה
        if (spotlight) {
            spotlight.style.cssText = `
                display: block;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                pointer-events: none;
                z-index: 99998;
                transition: all 0.3s ease;
                border: none;
                box-shadow: none;
                border-radius: 0;
            `;
        }

        // עדכן תוכן
        if (title) title.textContent = step.title;
        if (text) text.textContent = step.text;
        if (progress) progress.textContent = `שלב ${this.currentStep + 1} מתוך ${this.steps.length}`;

        // מרכז tooltip
        if (tooltip) {
            tooltip.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 99999;
                transition: all 0.3s ease;
            `;
        }

        // עדכן כפתורים
        this.updateButtons();
    }

    /**
     * עדכון spotlight
     */
    updateSpotlight(rect) {
        const spotlight = document.querySelector('.tour-spotlight');
        if (!spotlight) return;

        const padding = 8;

        spotlight.style.cssText = `
            display: block;
            position: fixed;
            top: ${rect.top - padding}px;
            left: ${rect.left - padding}px;
            width: ${rect.width + padding * 2}px;
            height: ${rect.height + padding * 2}px;
            border-radius: 8px;
            border: 3px solid #3b82f6;
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.7);
            pointer-events: none;
            z-index: 99998;
            transition: all 0.3s ease;
        `;
    }

    /**
     * עדכון tooltip
     */
    updateTooltip(step, rect) {
        const tooltip = document.querySelector('.tour-tooltip');
        const title = document.querySelector('.tour-tooltip-title');
        const text = document.querySelector('.tour-tooltip-text');
        const progress = document.querySelector('.tour-progress');

        if (!tooltip) return;

        // עדכן תוכן
        title.textContent = step.title;
        text.textContent = step.text;
        progress.textContent = `שלב ${this.currentStep + 1} מתוך ${this.steps.length}`;

        // חשב מיקום
        const pos = this.calculateTooltipPosition(rect, step.position);

        tooltip.style.cssText = `
            position: fixed;
            top: ${pos.top}px;
            left: ${pos.left}px;
            z-index: 99999;
            transition: all 0.3s ease;
        `;
    }

    /**
     * חישוב מיקום tooltip
     */
    calculateTooltipPosition(rect, position) {
        const tooltip = document.querySelector('.tour-tooltip');
        const width = 400;
        const height = tooltip.offsetHeight || 200;
        const gap = 20;
        const padding = 20;

        let top, left;

        switch (position) {
            case 'bottom':
                top = rect.bottom + gap;
                left = rect.left + rect.width / 2 - width / 2;
                break;
            case 'top':
                top = rect.top - height - gap;
                left = rect.left + rect.width / 2 - width / 2;
                break;
            case 'left':
                top = rect.top + rect.height / 2 - height / 2;
                left = rect.left - width - gap;
                break;
            case 'right':
                top = rect.top + rect.height / 2 - height / 2;
                left = rect.right + gap;
                break;
            default:
                top = window.innerHeight / 2 - height / 2;
                left = window.innerWidth / 2 - width / 2;
        }

        // ודא שהtooltip בתוך המסך
        top = Math.max(padding, Math.min(top, window.innerHeight - height - padding));
        left = Math.max(padding, Math.min(left, window.innerWidth - width - padding));

        return { top, left };
    }

    /**
     * עדכון כפתורים
     */
    updateButtons() {
        const prevBtn = document.querySelector('.tour-btn-prev');
        const nextBtn = document.querySelector('.tour-btn-next');

        if (!prevBtn || !nextBtn) return;

        // כפתור הקודם
        prevBtn.style.display = this.currentStep === 0 ? 'none' : 'inline-block';

        // כפתור הבא
        if (this.currentStep === this.steps.length - 1) {
            nextBtn.textContent = '✓ סיים';
            nextBtn.classList.add('tour-btn-finish');
        } else {
            nextBtn.textContent = 'הבא →';
            nextBtn.classList.remove('tour-btn-finish');
        }
    }

    /**
     * צירוף events
     */
    attachEvents() {
        document.querySelector('.tour-btn-next').addEventListener('click', () => this.next());
        document.querySelector('.tour-btn-prev').addEventListener('click', () => this.prev());
        document.querySelector('.tour-close-btn').addEventListener('click', () => this.end());

        // ESC לסגירה
        this.escHandler = (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.end();
            }
        };
        document.addEventListener('keydown', this.escHandler);
    }

    /**
     * מעבר לשלב הבא
     */
    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.showStep(this.currentStep + 1);
        } else {
            this.end();
        }
    }

    /**
     * חזרה לשלב קודם
     */
    prev() {
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    }

    /**
     * סיום הסיור
     */
    end() {
        this.isActive = false;

        // סגור דיאלוגים פתוחים
        const smartFormModal = document.getElementById('smartFormModal');
        if (smartFormModal && smartFormModal.style.display !== 'none') {
            if (typeof closeSmartForm === 'function') {
                closeSmartForm();
            } else {
                smartFormModal.style.display = 'none';
            }
        }

        this.destroy();

        // הודעת סיום
        if (window.showNotification) {
            showNotification('הסיור הושלם בהצלחה! 🎉', 'success');
        }
    }

    /**
     * מחיקת overlay
     */
    destroy() {
        const overlay = document.getElementById('tour-overlay');
        if (overlay) {
            overlay.remove();
        }

        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
        }
    }
}

export default SystemTour;
