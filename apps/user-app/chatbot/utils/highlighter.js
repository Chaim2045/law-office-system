/**
 * מודול הדגשת אלמנטים - Element Highlighter
 * מאפשר הדגשה ויזואלית של אלמנטים בדף
 */

/**
 * מדגיש אלמנט בדף עם אנימציה ויזואלית
 * @param {string} selector - CSS selector של האלמנט להדגשה
 * @param {string} message - הודעה להציג ליד האלמנט
 * @param {number} duration - משך ההדגשה במילישניות
 * @returns {boolean} - האם ההדגשה הצליחה
 */
export function highlightElement(selector, message = '', duration = 5000) {
    try {
        const element = document.querySelector(selector);
        if (!element) {
            console.warn(`לא נמצא אלמנט: ${selector}`);
            return false;
        }

        // הסר הדגשות קודמות
        removeAllHighlights();

        // צור overlay של הדגשה
        const highlightOverlay = document.createElement('div');
        highlightOverlay.className = 'bot-highlight-overlay';
        highlightOverlay.id = 'bot-active-highlight';

        // מיקום האלמנט
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        highlightOverlay.style.cssText = `
            position: absolute;
            top: ${rect.top + scrollTop - 10}px;
            left: ${rect.left + scrollLeft - 10}px;
            width: ${rect.width + 20}px;
            height: ${rect.height + 20}px;
            border: 3px solid #ef4444;
            border-radius: 8px;
            background: rgba(239, 68, 68, 0.1);
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3), 0 0 20px rgba(239, 68, 68, 0.5);
            z-index: 9997;
            pointer-events: none;
            animation: botPulse 1.5s infinite;
        `;

        document.body.appendChild(highlightOverlay);

        // גלול לאלמנט
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // הוסף חץ מצביע
        const arrow = document.createElement('div');
        arrow.className = 'bot-highlight-arrow';
        arrow.textContent = '👉';
        arrow.style.cssText = `
            position: absolute;
            top: ${rect.top + scrollTop}px;
            left: ${rect.left + scrollLeft - 50}px;
            font-size: 32px;
            z-index: 9998;
            pointer-events: none;
            animation: botArrowBounce 1s infinite;
        `;
        document.body.appendChild(arrow);

        // אם יש הודעה, הוסף bubble
        if (message) {
            const bubble = document.createElement('div');
            bubble.className = 'bot-highlight-bubble';
            bubble.innerHTML = `
                <div style="margin-bottom: 12px;">
                    ${message}
                </div>
                <button
                    onclick="smartFAQBot.removeAllHighlights()"
                    style="background: white; color: #3b82f6; border: none; padding: 8px 16px;
                           border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;
                           transition: all 0.2s ease;"
                    onmouseover="this.style.transform='scale(1.05)'"
                    onmouseout="this.style.transform='scale(1)'"
                >
                    ✓ הבנתי
                </button>
            `;
            bubble.style.cssText = `
                position: absolute;
                top: ${rect.top + scrollTop - 100}px;
                left: ${rect.left + scrollLeft}px;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                color: white;
                padding: 16px;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 9998;
                font-size: 14px;
                font-weight: 500;
                max-width: 280px;
                pointer-events: auto;
                animation: botBubbleAppear 0.3s ease;
            `;
            document.body.appendChild(bubble);
        }

        // הסר לאחר duration
        if (duration > 0) {
            setTimeout(() => {
                removeAllHighlights();
            }, duration);
        }

        return true;
    } catch (error) {
        console.error('שגיאה בהדגשת אלמנט:', error);
        return false;
    }
}

/**
 * מסיר את כל ההדגשות מהדף
 */
export function removeAllHighlights() {
    const highlights = document.querySelectorAll('.bot-highlight-overlay, .bot-highlight-arrow, .bot-highlight-bubble');
    highlights.forEach(el => el.remove());
}

/**
 * מוסיף את האנימציות הנדרשות להדגשה
 * יש לקרוא לפונקציה זו פעם אחת בעת אתחול הבוט
 */
export function addHighlightStyles() {
    if (document.getElementById('bot-highlight-styles')) {
return;
}

    const style = document.createElement('style');
    style.id = 'bot-highlight-styles';
    style.textContent = `
        @keyframes botPulse {
            0%, 100% {
                box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3), 0 0 20px rgba(239, 68, 68, 0.5);
            }
            50% {
                box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.2), 0 0 30px rgba(239, 68, 68, 0.7);
            }
        }

        @keyframes botArrowBounce {
            0%, 100% {
                transform: translateX(0);
            }
            50% {
                transform: translateX(10px);
            }
        }

        @keyframes botBubbleAppear {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;

    document.head.appendChild(style);
}
