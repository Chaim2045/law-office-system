/**
 * עיצוב הסיור במערכת - System Tour Styles
 * CSS עבור תכונת הסיור (onboarding tour)
 */

/**
 * מוסיף את עיצוב הסיור לדף
 * נקרא פעם אחת בעת התחלת הסיור
 */
export function addTourStyles() {
    // בדוק אם ה-CSS כבר נטען
    if (document.getElementById('system-tour-styles')) return;

    const style = document.createElement('style');
    style.id = 'system-tour-styles';
    style.textContent = `
        #system-tour-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 9999;
            pointer-events: none;
        }

        .tour-spotlight {
            position: fixed;
            pointer-events: none;
            z-index: 10000;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .tour-content-box {
            position: fixed;
            width: 450px;
            max-width: 90vw;
            background: white;
            border-radius: 12px;
            padding: 28px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15),
                       0 2px 8px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(0, 0, 0, 0.08);
            z-index: 10001;
            pointer-events: all;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .tour-progress {
            margin-bottom: 16px;
        }

        .tour-progress-text {
            display: block;
            font-size: 13px;
            color: #64748b;
            margin-bottom: 8px;
            font-weight: 500;
        }

        .tour-progress-bar {
            width: 100%;
            height: 6px;
            background: #e2e8f0;
            border-radius: 10px;
            overflow: hidden;
        }

        .tour-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
            border-radius: 10px;
            transition: width 0.3s ease;
        }

        .tour-title {
            font-size: 22px;
            font-weight: 700;
            color: #1e293b;
            margin: 0 0 12px 0;
        }

        .tour-description {
            font-size: 16px;
            line-height: 1.6;
            color: #475569;
            margin: 0 0 24px 0;
        }

        .tour-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
        }

        .tour-nav-buttons {
            display: flex;
            gap: 8px;
        }

        .tour-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: inherit;
        }

        .tour-btn-skip {
            background: transparent;
            color: #64748b;
            border: 1px solid #cbd5e1;
        }

        .tour-btn-skip:hover {
            background: #f1f5f9;
            color: #475569;
        }

        .tour-btn-prev {
            background: #f1f5f9;
            color: #475569;
        }

        .tour-btn-prev:hover {
            background: #e2e8f0;
        }

        .tour-btn-next {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
        }

        .tour-btn-next:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .tour-btn-finish {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .tour-btn-finish:hover {
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        @media (max-width: 600px) {
            .tour-content-box {
                width: 90vw;
                padding: 20px;
            }

            .tour-title {
                font-size: 18px;
            }

            .tour-description {
                font-size: 14px;
            }

            .tour-controls {
                flex-direction: column;
            }

            .tour-nav-buttons {
                width: 100%;
                justify-content: space-between;
            }

            .tour-btn {
                flex: 1;
            }
        }
    `;

    document.head.appendChild(style);
}
