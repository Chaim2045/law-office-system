/**
 * ════════════════════════════════════════════════════════════════════
 * Client Search - Shared Component
 * רכיב משותף לחיפוש לקוחות
 * ════════════════════════════════════════════════════════════════════
 *
 * @module client-search
 * @version 1.0.0
 * @created 2025-01-19
 *
 * פונקציות גלובליות משותפות לחיפוש לקוחות
 * נמנע code duplication בין timesheet.js ו-forms.js
 *
 * Benefits:
 * - Single Source of Truth for client search logic
 * - Consistent filtering and display across the system
 * - Easy to maintain and update
 * - Reduced code duplication (~135 lines saved)
 *
 * ════════════════════════════════════════════════════════════════════
 * CHANGELOG | יומן שינויים
 * ════════════════════════════════════════════════════════════════════
 *
 * v1.0.0 - 19/01/2025 ✨ INITIAL RELEASE
 * ----------------------------------------
 * 🎉 NEW MODULE: מודול חדש לחיפוש לקוחות משותף
 * ✅ CREATED: 4 פונקציות עיקריות (166 שורות)
 *   - filterClients() - סינון לקוחות לפי מונח חיפוש
 *   - generateClientResultsHTML() - יצירת HTML לתוצאות
 *   - searchClientsReturnHTML() - חיפוש והחזרת HTML
 *   - searchClientsUpdateDOM() - חיפוש ועדכון DOM ישיר
 *
 * 📊 השפעה:
 * - ביטול 67 שורות מ-timesheet.js
 * - ביטול 75 שורות מ-forms.js
 * - סה"כ: ~135 שורות קוד כפול שנמחקו
 *
 * תכונות:
 * - סינון לפי fullName, fileNumber, clientName
 * - HTML עם hover effects מובנים
 * - תמיכה ב-2 דפוסי שימוש (return HTML / update DOM)
 * - אופציות להתאמה אישית (maxResults, fileNumberColor)
 * - הגנת XSS מובנית עם window.safeText
 */

(function() {
  'use strict';

  /**
   * ✅ Use global safeText from core-utils.js (Single Source of Truth)
   * Fallback implementation for safety
   */
  const safeText = window.safeText || function(text) {
    if (!text) {
return '';
}
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  /**
   * Filter clients based on search term
   * @param {Array} clients - Array of client objects
   * @param {string} searchTerm - Search term
   * @returns {Array} Filtered clients
   */
  function filterClients(clients, searchTerm) {
    if (!searchTerm || searchTerm.length < 1) {
      return [];
    }

    const lowerSearch = searchTerm.toLowerCase();

    return clients.filter(
      (client) =>
        client.fullName?.toLowerCase().includes(lowerSearch) ||
        client.fileNumber?.includes(searchTerm) ||
        client.clientName?.toLowerCase().includes(lowerSearch)
    );
  }

  /**
   * Generate HTML for client search results
   * @param {Array} clients - Filtered clients
   * @param {string} onClickHandler - Click handler function name (e.g., "manager.selectClientForEdit")
   * @param {Object} options - Additional options
   * @returns {string} HTML string
   */
  function generateClientResultsHTML(clients, onClickHandler, options = {}) {
    const maxResults = options.maxResults || 8;
    const fileNumberColor = options.fileNumberColor || '#9ca3af';

    if (clients.length === 0) {
      return `
        <div style="padding: 12px; color: #6b7280; text-align: center;">
          <i class="fas fa-search"></i> לא נמצאו לקוחות תואמים
        </div>
      `;
    }

    const resultsHtml = clients
      .slice(0, maxResults)
      .map(
        (client) => `
      <div class="client-result"
           onclick="${onClickHandler}('${client.fullName}', '${client.fileNumber}')"
           style="
             padding: 10px 12px;
             cursor: pointer;
             border-bottom: 1px solid #f3f4f6;
             display: flex;
             justify-content: space-between;
             align-items: center;
             transition: background 0.2s ease;
           "
           onmouseover="this.style.background='#f8fafc'"
           onmouseout="this.style.background='white'">
        <div>
          <div style="font-weight: 600; color: #374151;">${safeText(client.fullName)}</div>
          ${
            client.description
              ? `<div style="font-size: 12px; color: #6b7280;">${safeText(client.description)}</div>`
              : ''
          }
        </div>
        <div style="font-size: 12px; color: ${fileNumberColor}; font-weight: 500;">
          ${client.fileNumber}
        </div>
      </div>
    `
      )
      .join('');

    return resultsHtml;
  }

  /**
   * Search clients and return HTML (for modules that handle DOM themselves)
   * @param {Array} clients - All clients
   * @param {string} searchTerm - Search term
   * @param {string} onClickHandler - Click handler function name
   * @param {Object} options - Additional options
   * @returns {string} HTML string for search results
   */
  function searchClientsReturnHTML(clients, searchTerm, onClickHandler = 'manager.selectClientForEdit', options = {}) {
    if (!searchTerm || searchTerm.length < 1) {
      return '';
    }

    const filteredClients = filterClients(clients, searchTerm);
    return generateClientResultsHTML(filteredClients, onClickHandler, options);
  }

  /**
   * Search clients and update DOM directly (for forms.js compatibility)
   * @param {Array} clients - All clients
   * @param {string} searchTerm - Search term
   * @param {Object} domElements - Object with resultsContainer and optionally hiddenInput
   * @param {string} onClickHandler - Click handler function name
   * @param {Object} options - Additional options
   */
  function searchClientsUpdateDOM(clients, searchTerm, domElements, onClickHandler = 'manager.selectClientForEdit', options = {}) {
    const { resultsContainer, hiddenInput } = domElements;

    if (!resultsContainer) {
return;
}

    if (!searchTerm || searchTerm.length < 1) {
      resultsContainer.style.display = 'none';
      return;
    }

    const filteredClients = filterClients(clients, searchTerm);
    const html = generateClientResultsHTML(filteredClients, onClickHandler, options);

    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
  }

  // Export to global window object
  window.ClientSearch = {
    filterClients,
    generateClientResultsHTML,
    searchClientsReturnHTML,
    searchClientsUpdateDOM
  };

  console.log('✅ Client Search module loaded');
})();
