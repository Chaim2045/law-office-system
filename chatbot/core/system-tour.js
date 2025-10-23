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
                title: '🎉 ברוכים הבאים!',
                text: 'בואו נתחיל סיור קצר במערכת',
                element: '.header',
                position: 'bottom'
            },
            {
                title: '📊 טאב תקצוב',
                text: 'כאן תנהלו את כל המשימות המתוקצבות שלכם',
                element: '.tab-button.active',
                position: 'bottom'
            },
            {
                title: '⏱️ טאב שעתון',
                text: 'כאן תדווחו על השעות שביצעתם',
                element: '.tabs-container .tab-button:nth-child(2)',
                position: 'bottom',
                action: () => {
                    if (typeof switchTab === 'function') switchTab('timesheet');
                }
            },
            {
                title: '💬 העוזר החכם',
                text: 'אם יש שאלות - פשוט לחצו כאן ושאלו אותי!',
                element: '.faq-bot-button',
                position: 'left'
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

        // הרץ action אם יש
        if (step.action) {
            step.action();
            setTimeout(() => this.renderStep(step), 300);
        } else {
            this.renderStep(step);
        }
    }

    /**
     * רינדור שלב
     */
    renderStep(step) {
        // מצא אלמנט
        const element = document.querySelector(step.element);
        if (!element) {
            console.warn('Tour: Element not found -', step.element);
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
     * עדכון spotlight
     */
    updateSpotlight(rect) {
        const spotlight = document.querySelector('.tour-spotlight');
        if (!spotlight) return;

        const padding = 8;

        spotlight.style.cssText = `
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
