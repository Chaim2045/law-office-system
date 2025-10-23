/**
 * עיצוב הצ'אטבוט - Chatbot Styles
 * כל ה-CSS של הבוט המשפטי החכם
 */

/**
 * מוסיף את עיצוב הצ'אטבוט לדף
 * נקרא פעם אחת בעת אתחול הבוט
 */
export function addBotStyles() {
    // בדוק אם ה-CSS כבר נטען
    if (document.getElementById('faq-bot-styles')) return;

    const style = document.createElement('style');
    style.id = 'faq-bot-styles';
    style.textContent = `
        /* Smart FAQ Bot - בצבעי המערכת */
        .faq-bot-button {
            position: fixed;
            bottom: 30px;
            left: 30px;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
            transition: all 0.3s ease;
            z-index: 9998;
            color: white;
        }

        .faq-bot-button:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 30px rgba(59, 130, 246, 0.6);
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        }

        .faq-bot-button svg {
            width: 26px;
            height: 26px;
        }

        .faq-bot-container {
            position: fixed;
            bottom: 100px;
            left: 30px;
            width: 420px;
            max-width: calc(100vw - 60px);
            height: 600px;
            max-height: calc(100vh - 140px);
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            display: flex;
            flex-direction: column;
            z-index: 9999;
            transition: all 0.3s ease;
            overflow: hidden;
            border: 1px solid #e5e7eb;
        }

        .faq-bot-container.hidden {
            opacity: 0;
            pointer-events: none;
            transform: translateY(20px);
        }

        .faq-bot-header {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            padding: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-radius: 16px 16px 0 0;
        }

        .faq-bot-header-content {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .faq-bot-avatar {
            width: 40px;
            height: 40px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }

        .faq-bot-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }

        .faq-bot-status {
            font-size: 12px;
            opacity: 0.9;
        }

        .faq-bot-header-actions {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .faq-bot-new-chat,
        .faq-bot-close {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            line-height: 1;
        }

        .faq-bot-close {
            font-size: 24px;
        }

        .faq-bot-new-chat:hover,
        .faq-bot-close:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: scale(1.1);
        }

        .faq-bot-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            background: #f9fafb;
        }

        .faq-message {
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 12px;
            animation: fadeInUp 0.3s ease;
            line-height: 1.6;
            font-size: 14px;
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .faq-message.user {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            align-self: flex-end;
            border-radius: 12px 12px 0 12px;
        }

        .faq-message.bot {
            background: white;
            color: #374151;
            align-self: flex-start;
            border-radius: 12px 12px 12px 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
        }

        .faq-message.bot strong {
            color: #2563eb;
            display: block;
            margin-bottom: 8px;
            font-size: 15px;
        }

        .faq-message.bot ul,
        .faq-message.bot ol {
            margin: 8px 0;
            padding-right: 20px;
        }

        .faq-message.bot li {
            margin: 6px 0;
        }

        .faq-message.bot p {
            margin: 8px 0;
        }

        .faq-message.bot em {
            display: block;
            margin-top: 8px;
            font-size: 13px;
            color: #6b7280;
            font-style: italic;
        }

        .faq-message.bot kbd {
            background: #f3f4f6;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            padding: 2px 6px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #374151;
        }

        .faq-bot-suggestions {
            padding: 12px;
            background: white;
            border-top: 1px solid #e5e7eb;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            max-height: 120px;
            overflow-y: auto;
        }

        .faq-suggestion-chip {
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
            padding: 8px 14px;
            border-radius: 20px;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            color: #374151;
        }

        .faq-suggestion-chip:hover {
            background: #3b82f6;
            color: white;
            border-color: #3b82f6;
            transform: translateY(-2px);
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }

        .faq-bot-input-container {
            display: flex;
            gap: 8px;
            padding: 16px;
            background: white;
            border-top: 1px solid #e5e7eb;
        }

        .faq-bot-input {
            flex: 1;
            border: 2px solid #e5e7eb;
            border-radius: 24px;
            padding: 10px 16px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
            color: #374151;
        }

        .faq-bot-input:focus {
            border-color: #3b82f6;
        }

        .faq-bot-input::placeholder {
            color: #9ca3af;
        }

        .faq-bot-send {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            border: none;
            border-radius: 50%;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
        }

        .faq-bot-send:hover {
            transform: scale(1.1);
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }

        .faq-bot-send:active {
            transform: scale(0.95);
        }

        .faq-typing {
            background: white;
            padding: 12px 16px;
            border-radius: 12px 12px 12px 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            align-self: flex-start;
            display: flex;
            gap: 4px;
            border: 1px solid #e5e7eb;
        }

        .faq-typing-dot {
            width: 8px;
            height: 8px;
            background: #3b82f6;
            border-radius: 50%;
            animation: typingDot 1.4s infinite;
        }

        .faq-typing-dot:nth-child(2) {
            animation-delay: 0.2s;
        }

        .faq-typing-dot:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes typingDot {
            0%, 60%, 100% {
                transform: translateY(0);
                opacity: 0.4;
            }
            30% {
                transform: translateY(-10px);
                opacity: 1;
            }
        }

        /* Scrollbar styling */
        .faq-bot-messages::-webkit-scrollbar,
        .faq-bot-suggestions::-webkit-scrollbar {
            width: 6px;
        }

        .faq-bot-messages::-webkit-scrollbar-track,
        .faq-bot-suggestions::-webkit-scrollbar-track {
            background: #f3f4f6;
        }

        .faq-bot-messages::-webkit-scrollbar-thumb,
        .faq-bot-suggestions::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 3px;
        }

        .faq-bot-messages::-webkit-scrollbar-thumb:hover,
        .faq-bot-suggestions::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
        }

        /* responsive */
        @media (max-width: 768px) {
            .faq-bot-container {
                left: 15px;
                right: 15px;
                width: auto;
                bottom: 100px;
            }

            .faq-bot-button {
                left: 15px;
                bottom: 15px;
            }
        }
    `;

    document.head.appendChild(style);
}
