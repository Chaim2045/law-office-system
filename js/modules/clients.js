/**
 * Clients Module
 * Handles client search, selection and display operations
 *
 * ⚠️ DEPRECATED - This module contains OLD client search functions
 * ✅ NEW: Use ClientCaseSelector component (js/modules/client-case-selector.js)
 *
 * Created: 2025
 * Part of Law Office Management System
 */

import { safeText, debounce } from './core-utils.js';

/* === Client Search Functions === */
/* ⚠️ DEPRECATED - Use ClientCaseSelector component instead */

/**
 * Debounced client search wrapper
 */
const debouncedSearchClients = debounce((formType, query) => {
  searchClientsInternal(formType, query);
}, 300);

/**
 * Public search function - triggers debounced search
 */
function searchClients(formType, query) {
  debouncedSearchClients(formType, query);
}

/**
 * Internal search implementation
 * Searches clients by name and file number, displays results
 */
function searchClientsInternal(formType, query) {
  const resultsContainer = document.getElementById(`${formType}SearchResults`);
  if (!resultsContainer) return;

  if (query.length < 1) {
    resultsContainer.classList.remove("show");
    return;
  }

  const allClients = window.manager ? window.manager.clients : [];
  const matches = (allClients || [])
    .filter((client) => {
      if (!client) return false;
      const searchText = `${client.fullName || ""} ${
        client.fileNumber || ""
      }`.toLowerCase();
      return searchText.includes(query.toLowerCase());
    })
    .slice(0, 8);

  if (matches.length === 0) {
    resultsContainer.innerHTML =
      '<div class="no-results">לא נמצאו לקוחות מתאימים</div>';
  } else {
    const resultsHtml = matches
      .map((client) => {
        const icon = client.type === "fixed" ? "📋" : "⏰";
        const details =
          client.type === "fixed"
            ? `שלב ${client.currentStage || 1} | פיקס`
            : `${client.hoursRemaining || 0} שעות נותרות`;

        return `
          <div class="search-result-item" onclick="selectClient('${formType}', '${safeText(
          client.fullName
        )}', '${safeText(client.fileNumber)}', '${safeText(client.type)}')">
            <div class="result-icon">${icon}</div>
            <div class="result-text">
              <div class="result-name">${safeText(client.fullName)}</div>
              <div class="result-details">תיק ${safeText(
                client.fileNumber
              )} • ${safeText(details)}</div>
            </div>
          </div>
        `;
      })
      .join("");

    resultsContainer.innerHTML = resultsHtml;
  }

  resultsContainer.classList.add("show");
}

/**
 * Handle client selection from search results
 * Updates form fields with selected client data
 * ✅ NEW: Integrates smart case selection (Progressive Disclosure)
 */
async function selectClient(formType, clientName, fileNumber, clientType) {
  try {
    const searchInput = document.getElementById(`${formType}ClientSearch`);
    if (searchInput) {
      const icon = clientType === "fixed" ? "📋" : "⏰";
      searchInput.value = `${icon} ${clientName}`;
    }

    const hiddenField = document.getElementById(`${formType}ClientSelect`);
    if (hiddenField) {
      hiddenField.value = clientName;
    }

    if (formType === "timesheet") {
      const fileNumberField = document.getElementById("fileNumber");
      if (fileNumberField) {
        fileNumberField.value = fileNumber;
      }
    }

    const resultsElement = document.getElementById(`${formType}SearchResults`);
    if (resultsElement) {
      resultsElement.classList.remove("show");
    }

    // ✅ NEW: Smart Case Selection Integration
    // Only integrate cases for budget and timesheet forms
    if (formType === 'budget' || formType === 'timesheet') {
      await handleCaseSelectionForClient(formType, clientName);
    }

  } catch (error) {
    console.error("Error in selectClient:", error);
  }
}

/**
 * ✅ NEW: Handle smart case selection when client is selected
 * Implements Progressive Disclosure: 1 case = auto-select, multiple = show dropdown
 */
async function handleCaseSelectionForClient(formType, clientName) {
  try {
    // Get the case integration manager
    const casesIntegration = window.casesIntegration;
    if (!casesIntegration) {
      console.log('⚠️ Cases integration not available yet');
      return;
    }

    // Find the client ID
    const allClients = window.manager ? window.manager.clients : [];
    const client = allClients.find(c => c.fullName === clientName || c.clientName === clientName);

    if (!client || !client.id) {
      console.log('⚠️ Client not found or has no ID:', clientName);
      return;
    }

    // Get the container for case selection UI
    const caseContainer = document.getElementById(`${formType}CaseContainer`);
    if (!caseContainer) {
      console.log('⚠️ Case container not found:', `${formType}CaseContainer`);
      return;
    }

    // Check if we should show case selection
    const result = await casesIntegration.shouldShowCaseSelection(client.id, caseContainer);

    console.log('📁 Case selection result:', result);

    if (result.needsDefaultCase) {
      // No cases exist - this is an old client, hide case UI
      caseContainer.innerHTML = '';
      caseContainer.style.display = 'none';
      return;
    }

    if (result.shouldShow) {
      // Multiple cases - show dropdown
      caseContainer.style.display = 'block';
      casesIntegration.renderCaseSelection(result.cases, caseContainer, (selectedCase) => {
        console.log('📁 Case selected:', selectedCase);
        // Store selected case in hidden fields for form submission
        storeCaseSelection(formType, selectedCase);
      });
    } else if (result.selectedCase) {
      // One case - auto-select and show green badge
      caseContainer.style.display = 'block';
      casesIntegration.renderAutoSelectedCase(result.selectedCase, caseContainer);
      // Store auto-selected case
      storeCaseSelection(formType, result.selectedCase);
    } else {
      // No case selection needed
      caseContainer.innerHTML = '';
      caseContainer.style.display = 'none';
    }

  } catch (error) {
    console.error('❌ Error handling case selection:', error);
  }
}

/**
 * ✅ NEW: Store selected case data in hidden fields for form submission
 */
function storeCaseSelection(formType, caseData) {
  // Store caseId
  let caseIdField = document.getElementById(`${formType}CaseId`);
  if (!caseIdField) {
    caseIdField = document.createElement('input');
    caseIdField.type = 'hidden';
    caseIdField.id = `${formType}CaseId`;
    document.getElementById(`${formType}Form`)?.appendChild(caseIdField);
  }
  caseIdField.value = caseData.id;

  // Store caseTitle
  let caseTitleField = document.getElementById(`${formType}CaseTitle`);
  if (!caseTitleField) {
    caseTitleField = document.createElement('input');
    caseTitleField.type = 'hidden';
    caseTitleField.id = `${formType}CaseTitle`;
    document.getElementById(`${formType}Form`)?.appendChild(caseTitleField);
  }
  caseTitleField.value = caseData.caseTitle;

  console.log('✅ Case stored:', { formType, caseId: caseData.id, caseTitle: caseData.caseTitle });
}

// Exports
export {
  searchClients,
  searchClientsInternal,
  selectClient
};
