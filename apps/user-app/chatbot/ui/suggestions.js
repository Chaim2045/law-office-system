/**
 * מודול הצעות - Suggestions Chips
 * ניהול כפתורי ההצעות המהירות בצ'אט
 */

/**
 * מציג רשימת הצעות בתחתית הצ'אט
 * @param {string[]} suggestions - מערך של שאלות מוצעות
 * @param {Function} onSuggestionClick - callback שיופעל בלחיצה על הצעה
 * @param {Function} onTourClick - callback שיופעל בלחיצה על "התחל סיור" (optional)
 */
export function showSuggestions(suggestions, onSuggestionClick, onTourClick = null) {
    const suggestionsContainer = document.getElementById('faq-bot-suggestions');
    if (!suggestionsContainer) {
return;
}

    suggestionsContainer.innerHTML = '';

    // הוספת כפתור "התחל סיור" מיוחד בתחילה (אם סופק callback)
    if (onTourClick) {
        const tourButton = document.createElement('button');
        tourButton.className = 'faq-suggestion-chip tour-chip';
        tourButton.innerHTML = '🎓 התחל סיור במערכת';
        tourButton.style.cssText = `
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            font-weight: 600;
            border: none;
        `;
        tourButton.addEventListener('click', onTourClick);
        suggestionsContainer.appendChild(tourButton);
    }

    // הוספת כל ההצעות
    suggestions.forEach(suggestion => {
        const chip = document.createElement('button');
        chip.className = 'faq-suggestion-chip';
        chip.textContent = suggestion;
        chip.addEventListener('click', () => {
            onSuggestionClick(suggestion);
        });
        suggestionsContainer.appendChild(chip);
    });
}

/**
 * מציג הצעות הקשריות בהתאם לטאב הפעיל
 * @param {Object} contextualSuggestions - אובייקט עם הצעות לפי קונטקסט
 * @param {string} currentContext - הקונטקסט הנוכחי (clients/tasks/timesheet/default)
 * @param {Function} onSuggestionClick - callback שיופעל בלחיצה על הצעה
 * @param {Function} onTourClick - callback שיופעל בלחיצה על "התחל סיור" (optional)
 */
export function showContextualSuggestions(contextualSuggestions, currentContext, onSuggestionClick, onTourClick = null) {
    const context = currentContext || 'default';
    const suggestions = contextualSuggestions[context] || contextualSuggestions.default;
    showSuggestions(suggestions, onSuggestionClick, onTourClick);
}

/**
 * מציג שאלות קשורות מאותה קטגוריה
 * @param {Object} faqDatabase - מאגר ה-FAQ
 * @param {string} category - הקטגוריה להצגת שאלות ממנה
 * @param {Function} onSuggestionClick - callback שיופעל בלחיצה על הצעה
 * @param {Function} onTourClick - callback שיופעל בלחיצה על "התחל סיור" (optional)
 * @param {number} maxQuestions - מספר מקסימלי של שאלות להציג (ברירת מחדל: 3)
 */
export function showRelatedQuestions(faqDatabase, category, onSuggestionClick, onTourClick = null, maxQuestions = 3) {
    const items = faqDatabase[category] || [];
    const questions = items.slice(0, maxQuestions).map(item => item.question);
    showSuggestions(questions, onSuggestionClick, onTourClick);
}

/**
 * מנקה את כל ההצעות
 */
export function clearSuggestions() {
    const suggestionsContainer = document.getElementById('faq-bot-suggestions');
    if (suggestionsContainer) {
        suggestionsContainer.innerHTML = '';
    }
}
