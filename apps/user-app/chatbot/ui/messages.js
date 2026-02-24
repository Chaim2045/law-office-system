/**
 * מודול תצוגת הודעות - Messages Display
 * טיפול בהצגת הודעות משתמש, בוט ואינדיקטור הקלדה
 */

/**
 * מוסיף הודעת משתמש לצ'אט
 * @param {string} text - הטקסט של ההודעה
 * @param {Array} chatHistory - היסטוריית הצ'אט (optional)
 * @returns {HTMLElement} - האלמנט שנוצר
 */
export function addUserMessage(text, chatHistory = null) {
    const messagesContainer = document.getElementById('faq-bot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'faq-message user';
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    // שמור בהיסטוריה אם סופק
    if (chatHistory) {
        chatHistory.push({ type: 'user', text });
    }

    return messageDiv;
}

/**
 * מוסיף הודעת בוט לצ'אט
 * @param {string} html - תוכן ה-HTML של ההודעה
 * @param {Array} chatHistory - היסטוריית הצ'אט (optional)
 * @returns {HTMLElement} - האלמנט שנוצר
 */
export function addBotMessage(html, chatHistory = null) {
    const messagesContainer = document.getElementById('faq-bot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'faq-message bot';
    messageDiv.innerHTML = html;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    // שמור בהיסטוריה אם סופק
    if (chatHistory) {
        chatHistory.push({ type: 'bot', html });
    }

    return messageDiv;
}

/**
 * מציג אינדיקטור הקלדה (נקודות מרקדות)
 */
export function showTypingIndicator() {
    const messagesContainer = document.getElementById('faq-bot-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'faq-typing';
    typingDiv.id = 'faq-typing-indicator';
    typingDiv.innerHTML = `
        <div class="faq-typing-dot"></div>
        <div class="faq-typing-dot"></div>
        <div class="faq-typing-dot"></div>
    `;
    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
}

/**
 * מסיר את אינדיקטור ההקלדה
 */
export function removeTypingIndicator() {
    const indicator = document.getElementById('faq-typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

/**
 * גולל למטה לסוף רשימת ההודעות
 */
export function scrollToBottom() {
    const messagesContainer = document.getElementById('faq-bot-messages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

/**
 * מנקה את כל ההודעות מהצ'אט
 */
export function clearMessages() {
    const messagesContainer = document.getElementById('faq-bot-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }
}
