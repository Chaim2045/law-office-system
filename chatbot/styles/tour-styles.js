/**
 * ========================================
 * עיצוב הסיור במערכת (גרסה 2.0)
 * ========================================
 * CSS פשוט ונקי עבור הסיור החדש
 */

export function addTourStyles() {
    // בדוק אם ה-CSS כבר נטען
    if (document.getElementById('tour-styles')) return;

    const style = document.createElement('style');
    style.id = 'tour-styles';
    style.textContent = `
        /* ========== Container ========== */
        #tour-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 99997;
            pointer-events: none;
        }

        /* ========== Backdrop (אופציונלי) ========== */
        .tour-backdrop {
            display: none; /* לא בשימוש - box-shadow עושה את העבודה */
        }

        /* ========== Spotlight ========== */
        .tour-spotlight {
            /* הסגנון מוגדר ב-JS באמצעות inline styles */
        }

        /* ========== Tooltip - הכרטיסייה ========== */
        .tour-tooltip {
            position: fixed;
            width: 400px;
            max-width: 90vw;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3),
                       0 2px 8px rgba(0, 0, 0, 0.1);
            pointer-events: all;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            z-index: 99999;
        }

        /* ========== Header ========== */
        .tour-tooltip-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 20px 20px 16px 20px;
            border-bottom: 1px solid #e5e7eb;
        }

        .tour-tooltip-title {
            margin: 0;
            font-size: 20px;
            font-weight: 700;
            color: #1f2937;
            flex: 1;
        }

        .tour-close-btn {
            background: transparent;
            border: none;
            font-size: 28px;
            color: #9ca3af;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: all 0.2s ease;
            line-height: 1;
        }

        .tour-close-btn:hover {
            background: #f3f4f6;
            color: #6b7280;
        }

        /* ========== Text ========== */
        .tour-tooltip-text {
            padding: 16px 20px;
            font-size: 15px;
            line-height: 1.6;
            color: #4b5563;
            margin: 0;
        }

        /* ========== Footer ========== */
        .tour-tooltip-footer {
            padding: 16px 20px 20px 20px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .tour-progress {
            font-size: 13px;
            color: #6b7280;
            font-weight: 500;
            text-align: center;
        }

        /* ========== Buttons ========== */
        .tour-buttons {
            display: flex;
            justify-content: space-between;
            gap: 10px;
        }

        .tour-btn {
            flex: 1;
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: inherit;
        }

        .tour-btn-prev {
            background: #f3f4f6;
            color: #6b7280;
        }

        .tour-btn-prev:hover {
            background: #e5e7eb;
            color: #4b5563;
        }

        .tour-btn-next {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
        }

        .tour-btn-next:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
        }

        .tour-btn-finish {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .tour-btn-finish:hover {
            box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
        }

        /* ========== Responsive ========== */
        @media (max-width: 600px) {
            .tour-tooltip {
                width: calc(100vw - 40px);
            }

            .tour-tooltip-header {
                padding: 16px;
            }

            .tour-tooltip-title {
                font-size: 18px;
            }

            .tour-tooltip-text {
                padding: 12px 16px;
                font-size: 14px;
            }

            .tour-tooltip-footer {
                padding: 12px 16px 16px 16px;
            }

            .tour-buttons {
                flex-direction: column;
            }

            .tour-btn {
                width: 100%;
            }
        }

        /* ========== RTL Support ========== */
        [dir="rtl"] .tour-btn-prev {
            order: 2;
        }

        [dir="rtl"] .tour-btn-next {
            order: 1;
        }
    `;

    document.head.appendChild(style);
}
