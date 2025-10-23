/**
 * סיור במערכת - System Tour
 * מערכת הדרכה אינטראקטיבית למשתמשים חדשים
 */

import { addTourStyles } from '../styles/tour-styles.js';

/**
 * Class לניהול הסיור במערכת
 * מציג למשתמשים חדשים את כל הפיצ'רים העיקריים
 */
export class SystemTour {
    constructor() {
        this.currentStep = 0;
        this.isActive = false;
        this.tourSteps = this.getTourSteps();
    }

    /**
     * שלבי הסיור המלאים במערכת
     * @returns {Array} - מערך של שלבים
     */
    getTourSteps() {
        return [
            {
                title: '🎉 ברוכים הבאים למערכת!',
                description: 'בואו נתחיל סיור קצר שיעזור לכם להכיר את המערכת',
                selector: '.main-header',
                position: 'bottom',
                actionBefore: null
            },
            {
                title: '👤 פרופיל משתמש',
                description: 'כאן תמצאו את שם המשתמש שלכם וכפתור יציאה מהמערכת',
                selector: '.user-section',
                position: 'bottom',
                actionBefore: null
            },
            {
                title: '➕ כפתור הוספה מהירה',
                description: 'הכפתור הכחול הגדול הזה פותח תפריט מהיר: הוסף משימה, דווח שעות, או צור תיק חדש',
                selector: '#smartPlusBtn',
                position: 'bottom',
                actionBefore: null
            },
            {
                title: '📋 תפריט ניווט',
                description: 'מכאן תוכלו לנווט בין החלקים השונים: תקצוב, שעתון, דוחות',
                selector: '.navigation-menu',
                position: 'left',
                actionBefore: null
            },
            {
                title: '📊 טאב תקצוב משימות',
                description: 'זהו המסך הראשי - כאן תנהלו את כל המשימות המתוקצבות שלכם',
                selector: '.tab-button.active',
                position: 'bottom',
                actionBefore: () => {
                    if (typeof switchTab === 'function') switchTab('budget');
                }
            },
            {
                title: '🔍 חיפוש משימות',
                description: 'השתמשו בשדה החיפוש כדי למצוא משימות לפי תיאור, לקוח, או תיק',
                selector: '#budgetSearchBox',
                position: 'bottom',
                actionBefore: () => {
                    if (typeof switchTab === 'function') switchTab('budget');
                }
            },
            {
                title: '👁️ תצוגות שונות',
                description: 'בחרו בין תצוגת כרטיסים (cards) לתצוגת טבלה - כל אחד לפי הנוחות שלו',
                selector: '[data-view="cards"]',
                position: 'bottom',
                actionBefore: () => {
                    if (typeof switchTab === 'function') switchTab('budget');
                }
            },
            {
                title: '📝 רשימת המשימות',
                description: 'כאן תראו את כל המשימות שלכם: תיאור, לקוח, תקצוב, ביצוע, ותאריך יעד',
                selector: '#budgetContainer',
                position: 'top',
                actionBefore: () => {
                    if (typeof switchTab === 'function') switchTab('budget');
                }
            },
            {
                title: '⏱️ טאב שעתון',
                description: 'במסך הזה תדווחו על השעות שביצעתם ותעקבו אחרי הזמן שהשקעתם',
                selector: '.tab-button:nth-child(2)',
                position: 'bottom',
                actionBefore: () => {
                    if (typeof switchTab === 'function') switchTab('timesheet');
                }
            },
            {
                title: '🕐 דיווח שעות',
                description: 'כאן תמצאו את כל הרשומות שלכם - מתי התחלתם, מתי סיימתם, וכמה זמן עבדתם',
                selector: '#timesheetEntriesContainer',
                position: 'top',
                actionBefore: () => {
                    if (typeof switchTab === 'function') switchTab('timesheet');
                }
            },
            {
                title: '📊 דוחות וניתוחים',
                description: 'צפו בדוחות מפורטים - שעות לפי עובד, לקוח, תקופה, ועוד',
                selector: '.nav-item-gray',
                position: 'left',
                actionBefore: () => {
                    const reportsBtn = document.querySelector('.nav-item-gray');
                    if (reportsBtn) reportsBtn.click();
                }
            },
            {
                title: '💬 העוזר החכם',
                description: 'אם אתם תקועים או צריכים עזרה - פשוט לחצו על הכפתור הכחול הזה ושאלו אותי!',
                selector: '.faq-bot-button',
                position: 'top',
                actionBefore: () => {
                    if (typeof switchTab === 'function') switchTab('budget');
                }
            },
            {
                title: '🎓 סיימנו את הסיור!',
                description: 'מעולה! עכשיו אתם מכירים את המערכת. אם יש שאלות - אני תמיד כאן לעזור! 😊',
                selector: null,
                position: 'center',
                actionBefore: null
            }
        ];
    }

    /**
     * התחלת הסיור
     */
    start() {
        this.currentStep = 0;
        this.isActive = true;
        this.createTourOverlay();
        this.showStep(0);
    }

    /**
     * יצירת ה-overlay והפקדים
     */
    createTourOverlay() {
        // הסרת overlay קיים
        this.removeTourOverlay();

        // יצירת overlay container
        const overlay = document.createElement('div');
        overlay.id = 'system-tour-overlay';
        overlay.innerHTML = `
            <div class="tour-spotlight"></div>
            <div class="tour-content-box">
                <div class="tour-progress">
                    <span class="tour-progress-text"></span>
                    <div class="tour-progress-bar">
                        <div class="tour-progress-fill"></div>
                    </div>
                </div>
                <h2 class="tour-title"></h2>
                <p class="tour-description"></p>
                <div class="tour-controls">
                    <button class="tour-btn tour-btn-skip">דלג על הסיור</button>
                    <div class="tour-nav-buttons">
                        <button class="tour-btn tour-btn-prev">← הקודם</button>
                        <button class="tour-btn tour-btn-next">הבא →</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        addTourStyles(); // טען CSS
        this.setupTourEventListeners();
    }

    /**
     * הצגת שלב ספציפי
     * @param {number} stepIndex - אינדקס השלב להצגה
     */
    showStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.tourSteps.length) return;

        this.currentStep = stepIndex;
        const step = this.tourSteps[stepIndex];

        // ביצוע פעולה לפני (כמו מעבר לטאב)
        if (step.actionBefore) {
            step.actionBefore();
        }

        // המתנה קלה לאחר המעבר
        setTimeout(() => {
            // עדכון התוכן
            document.querySelector('.tour-title').textContent = step.title;
            document.querySelector('.tour-description').textContent = step.description;
            document.querySelector('.tour-progress-text').textContent =
                `שלב ${stepIndex + 1} מתוך ${this.tourSteps.length}`;

            const progressPercent = ((stepIndex + 1) / this.tourSteps.length) * 100;
            document.querySelector('.tour-progress-fill').style.width = `${progressPercent}%`;

            // עדכון כפתורים
            const prevBtn = document.querySelector('.tour-btn-prev');
            const nextBtn = document.querySelector('.tour-btn-next');

            prevBtn.style.display = stepIndex === 0 ? 'none' : 'inline-block';

            if (stepIndex === this.tourSteps.length - 1) {
                nextBtn.textContent = '✓ סיים סיור';
                nextBtn.classList.add('tour-btn-finish');
            } else {
                nextBtn.textContent = 'הבא →';
                nextBtn.classList.remove('tour-btn-finish');
            }

            // הצגת spotlight על האלמנט
            if (step.selector) {
                this.highlightElement(step.selector, step.position);
            } else {
                // שלב אחרון - מרכז המסך
                this.centerTourBox();
            }
        }, 100);
    }

    /**
     * הדגשת אלמנט עם spotlight
     * @param {string} selector - CSS selector של האלמנט
     * @param {string} position - מיקום התיבה (top/bottom/left/right)
     */
    highlightElement(selector, position = 'bottom') {
        const element = document.querySelector(selector);
        if (!element) {
            console.warn(`Tour: Element not found - ${selector}`);
            return;
        }

        const rect = element.getBoundingClientRect();
        const spotlight = document.querySelector('.tour-spotlight');
        const contentBox = document.querySelector('.tour-content-box');

        // הסרת SVG blur קודם אם קיים
        const existingSvg = document.getElementById('tour-blur-svg');
        if (existingSvg) existingSvg.remove();

        // יצירת SVG עם blur filter ומסכה - פתרון מקצועי לטשטוש רקע בלבד
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'tour-blur-svg';
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9998;
        `;

        // הגדרת filter blur
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.id = 'tour-blur-filter';
        const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        feGaussianBlur.setAttribute('in', 'SourceGraphic');
        feGaussianBlur.setAttribute('stdDeviation', '3');
        filter.appendChild(feGaussianBlur);
        defs.appendChild(filter);

        // הגדרת mask עם "חור" במקום האלמנט
        const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
        mask.id = 'tour-mask';

        // רקע לבן (המסך כולו)
        const maskBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        maskBg.setAttribute('x', '0');
        maskBg.setAttribute('y', '0');
        maskBg.setAttribute('width', '100%');
        maskBg.setAttribute('height', '100%');
        maskBg.setAttribute('fill', 'white');

        // "חור" שחור במקום האלמנט
        const maskHole = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        maskHole.setAttribute('x', rect.left - 8);
        maskHole.setAttribute('y', rect.top - 8);
        maskHole.setAttribute('width', rect.width + 16);
        maskHole.setAttribute('height', rect.height + 16);
        maskHole.setAttribute('rx', '8');
        maskHole.setAttribute('fill', 'black');

        mask.appendChild(maskBg);
        mask.appendChild(maskHole);
        defs.appendChild(mask);
        svg.appendChild(defs);

        // רקטנגל מטושטש עם המסכה
        const blurRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        blurRect.setAttribute('x', '0');
        blurRect.setAttribute('y', '0');
        blurRect.setAttribute('width', '100%');
        blurRect.setAttribute('height', '100%');
        blurRect.setAttribute('fill', 'rgba(0, 0, 0, 0.3)');
        blurRect.setAttribute('filter', 'url(#tour-blur-filter)');
        blurRect.setAttribute('mask', 'url(#tour-mask)');

        svg.appendChild(blurRect);
        document.body.appendChild(svg);

        // עדכון spotlight - רק border ללא shadow
        spotlight.style.cssText = `
            position: fixed;
            top: ${rect.top - 8}px;
            left: ${rect.left - 8}px;
            width: ${rect.width + 16}px;
            height: ${rect.height + 16}px;
            border-radius: 8px;
            border: 3px solid #3b82f6;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3),
                        0 0 20px rgba(59, 130, 246, 0.6);
            pointer-events: none;
            z-index: 10000;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        // גלילה לאלמנט
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // מיקום תיבת התוכן
        setTimeout(() => {
            this.positionContentBox(rect, position);
        }, 100);
    }

    /**
     * מיקום תיבת התוכן ביחס לאלמנט - חכם ומותאם
     * אלגוריתם חדש: משתמש ב-position המפורש, רק אם לא אפשרי - בוחר חלופה
     * @param {DOMRect} rect - מלבן האלמנט
     * @param {string} position - מיקום מפורש (top/bottom/left/right)
     */
    positionContentBox(rect, position) {
        const contentBox = document.querySelector('.tour-content-box');
        const boxWidth = contentBox.offsetWidth || 450;
        const boxHeight = contentBox.offsetHeight;
        const padding = 24;
        const minGap = 30; // מרווח גדול מהאלמנט כדי שהכרטיסייה לא תכסה אותו

        // שלב 1: חשב את המרווח הזמין בכל כיוון
        const availableSpace = {
            top: rect.top - padding,
            bottom: window.innerHeight - rect.bottom - padding,
            left: rect.left - padding,
            right: window.innerWidth - rect.right - padding
        };

        // שלב 2: בדוק איזה כיוונים מתאימים לגודל הכרטיסייה
        const canFit = {
            top: availableSpace.top >= boxHeight + minGap,
            bottom: availableSpace.bottom >= boxHeight + minGap,
            left: availableSpace.left >= boxWidth + minGap,
            right: availableSpace.right >= boxWidth + minGap
        };

        // שלב 3: נסה להשתמש ב-position המבוקש
        let chosenPosition = position;

        // אם ה-position המבוקש לא אפשרי, בחר חלופה חכמה
        if (position && !canFit[position]) {
            // נסה את הכיוון ההפוך קודם
            const opposites = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
            const opposite = opposites[position];

            if (opposite && canFit[opposite]) {
                chosenPosition = opposite;
            } else {
                // אם גם ההפוך לא אפשרי, בחר כיוון עם הכי הרבה מקום
                const viablePositions = [
                    { pos: 'bottom', space: availableSpace.bottom, fits: canFit.bottom },
                    { pos: 'top', space: availableSpace.top, fits: canFit.top },
                    { pos: 'right', space: availableSpace.right, fits: canFit.right },
                    { pos: 'left', space: availableSpace.left, fits: canFit.left }
                ]
                .filter(p => p.fits)
                .sort((a, b) => b.space - a.space);

                chosenPosition = viablePositions.length > 0
                    ? viablePositions[0].pos
                    : ['bottom', 'top', 'right', 'left'].reduce((best, curr) =>
                        availableSpace[curr] > availableSpace[best] ? curr : best
                    );
            }
        }

        let top, left;

        // שלב 4: מקם את הכרטיסייה לפי הכיוון הנבחר
        switch (chosenPosition) {
            case 'bottom':
                top = rect.bottom + minGap;
                left = rect.left + (rect.width / 2) - (boxWidth / 2);
                break;
            case 'top':
                top = rect.top - boxHeight - minGap;
                left = rect.left + (rect.width / 2) - (boxWidth / 2);
                break;
            case 'left':
                top = rect.top + (rect.height / 2) - (boxHeight / 2);
                left = rect.left - boxWidth - minGap;
                break;
            case 'right':
                top = rect.top + (rect.height / 2) - (boxHeight / 2);
                left = rect.right + minGap;
                break;
        }

        // שלב 5: וידוא שהכרטיסייה בתוך המסך (fallback למקרה קיצון)
        top = Math.max(padding, Math.min(top, window.innerHeight - boxHeight - padding));
        left = Math.max(padding, Math.min(left, window.innerWidth - boxWidth - padding));

        contentBox.style.top = `${top}px`;
        contentBox.style.left = `${left}px`;
        contentBox.style.transform = 'none';
    }

    /**
     * מיקום תיבה במרכז (לשלב אחרון)
     */
    centerTourBox() {
        const spotlight = document.querySelector('.tour-spotlight');
        const contentBox = document.querySelector('.tour-content-box');

        spotlight.style.display = 'none';

        contentBox.style.top = '50%';
        contentBox.style.left = '50%';
        contentBox.style.transform = 'translate(-50%, -50%)';
    }

    /**
     * מעבר לשלב הבא
     */
    nextStep() {
        if (this.currentStep < this.tourSteps.length - 1) {
            this.showStep(this.currentStep + 1);
        } else {
            this.finish();
        }
    }

    /**
     * חזרה לשלב קודם
     */
    prevStep() {
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    }

    /**
     * סיום הסיור
     */
    finish() {
        this.isActive = false;
        this.removeTourOverlay();

        // הצגת הודעת סיום
        if (window.showNotification) {
            showNotification('הסיור הושלם בהצלחה! 🎉', 'success');
        }

        // פתיחת הבוט עם הודעת סיום
        setTimeout(() => {
            if (window.smartFAQBot) {
                if (typeof window.smartFAQBot.toggleBot === 'function' && !window.smartFAQBot.isOpen) {
                    window.smartFAQBot.toggleBot();
                }
                // הוסף הודעה (אם יש פונקציה כזו)
                if (typeof window.smartFAQBot.addBotMessage === 'function') {
                    // קרא למודול messages ישירות
                    import('../ui/messages.js').then(({ addBotMessage }) => {
                        addBotMessage(`
                            <strong>כל הכבוד! סיימתם את הסיור! 🎓</strong>
                            <p>עכשיו אתם מכירים את כל הפיצ'רים של המערכת.</p>
                            <p>💬 יש שאלות? אני כאן בשבילכם!</p>
                        `, window.smartFAQBot.chatHistory);
                    });
                }
            }
        }, 500);
    }

    /**
     * הגדרת event listeners
     */
    setupTourEventListeners() {
        document.querySelector('.tour-btn-next').addEventListener('click', () => this.nextStep());
        document.querySelector('.tour-btn-prev').addEventListener('click', () => this.prevStep());
        document.querySelector('.tour-btn-skip').addEventListener('click', () => this.finish());

        // ESC לסגירה
        const escHandler = (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.finish();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * הסרת overlay
     */
    removeTourOverlay() {
        const existingOverlay = document.getElementById('system-tour-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        // הסרת SVG blur
        const existingSvg = document.getElementById('tour-blur-svg');
        if (existingSvg) {
            existingSvg.remove();
        }
    }
}

// ייצוא מחלקה כברירת מחדל
export default SystemTour;
