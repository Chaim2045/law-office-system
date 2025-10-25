/**
 * Timesheet Module
 * Module for managing timesheet entries (work hours tracking)
 *
 * This module contains all timesheet-related functionality:
 * - Loading and saving timesheet entries
 * - Rendering timesheet in cards and table views
 * - Filtering and sorting timesheet entries
 * - Editing and managing timesheet entries
 * - Client search for timesheet forms
 *
 * @module TimesheetModule
 */

/* ========================================
   IMPORTS
   ======================================== */

import {
  createCaseNumberBadge,
  createServiceBadge,
  createServiceInfoHeader
} from './timesheet-constants.js';

// Utility functions (assumed to be available globally)
// - safeText(): Sanitizes text for HTML display
// - formatDate(): Formats dates for display
// - formatShort(): Formats dates in short format
// - callFunction(): Calls Firebase Cloud Functions

/* ========================================
   FIREBASE OPERATIONS
   ======================================== */

/**
 * Load timesheet entries from Firebase for a specific employee
 * @param {string} employee - Employee name
 * @returns {Promise<Array>} Array of timesheet entries
 */
export async function loadTimesheetFromFirebase(employee) {
  try {
    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Firebase לא מחובר");
    }

    const snapshot = await db
      .collection("timesheet_entries")
      .where("employee", "==", employee)
      .get();

    const entries = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // Convert Firebase Timestamps to JavaScript Date objects
      entries.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
      });
    });

    // Sort by date (manual sorting instead of orderBy)
    entries.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    return entries;
  } catch (error) {
    console.error("Firebase error:", error);
    throw new Error("שגיאה בטעינת שעתון: " + error.message);
  }
}

/**
 * Save timesheet entry to Firebase
 * @param {Object} entryData - Timesheet entry data
 * @returns {Promise<string>} Entry ID
 */
export async function saveTimesheetToFirebase(entryData) {
  try {
    // Call Firebase Function for secure validation and creation
    const result = await callFunction('createTimesheetEntry', entryData);

    if (!result.success) {
      throw new Error(result.message || 'שגיאה בשמירת שעתון');
    }

    return result.entryId;
  } catch (error) {
    console.error("Firebase error:", error);
    throw error;
  }
}

/**
 * Update timesheet entry in Firebase
 * @param {string} entryId - Entry ID
 * @param {number} minutes - New minutes value
 * @param {string} reason - Edit reason
 * @returns {Promise<Object>} Update result
 */
export async function updateTimesheetEntryFirebase(entryId, minutes, reason = "") {
  try {
    // Call Firebase Function for secure validation and update
    const result = await callFunction('updateTimesheetEntry', {
      entryId: String(entryId),
      minutes,
      reason
    });

    if (!result.success) {
      throw new Error(result.message || 'שגיאה בעדכון שעתון');
    }

    return result;
  } catch (error) {
    console.error("Firebase error:", error);
    throw error;
  }
}

/* ========================================
   FILTERING AND SORTING
   ======================================== */

/**
 * Apply timesheet filters (basic - returns all entries)
 * @param {Array} timesheetEntries - All timesheet entries
 * @returns {Array} Filtered entries
 */
export function applyTimesheetFilters(timesheetEntries) {
  return [...timesheetEntries];
}

/**
 * Filter timesheet entries by date range
 * @param {Array} timesheetEntries - All timesheet entries
 * @param {string} filterValue - Filter type ('today', 'month', 'all')
 * @returns {Array} Filtered entries
 */
export function filterTimesheetEntries(timesheetEntries, filterValue) {
  const now = new Date();

  // Filter based on date range
  if (filterValue === 'today') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return timesheetEntries.filter(entry => {
      if (!entry.date) return false;
      const entryDate = new Date(entry.date);
      const entryDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
      return entryDay.getTime() === today.getTime();
    });
  } else if (filterValue === 'month') {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    return timesheetEntries.filter(entry => {
      if (!entry.date) return true;
      const entryDate = new Date(entry.date);
      return entryDate >= oneMonthAgo;
    });
  } else {
    // Show all
    return [...timesheetEntries];
  }
}

/**
 * Sort timesheet entries
 * @param {Array} entries - Entries to sort
 * @param {string} sortValue - Sort type ('recent', 'client', 'hours')
 * @returns {Array} Sorted entries
 */
export function sortTimesheetEntries(entries, sortValue) {
  const sorted = [...entries];

  sorted.sort((a, b) => {
    switch (sortValue) {
      case 'recent':
        // Sort by date - most recent first
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;

      case 'client':
        // Sort by client name - Hebrew A-Z
        const nameA = (a.clientName || '').trim();
        const nameB = (b.clientName || '').trim();
        if (!nameA && !nameB) return 0;
        if (!nameA) return 1;
        if (!nameB) return -1;
        return nameA.localeCompare(nameB, 'he');

      case 'hours':
        // Sort by hours - highest first
        const minutesA = a.minutes || 0;
        const minutesB = b.minutes || 0;
        return minutesB - minutesA;

      default:
        return 0;
    }
  });

  return sorted;
}

/**
 * Sort timesheet table by field
 * @param {Array} entries - Entries to sort
 * @param {string} field - Field name ('date', 'minutes', 'clientName', etc.)
 * @param {string} direction - Sort direction ('asc' or 'desc')
 * @returns {Array} Sorted entries
 */
export function sortTimesheetTable(entries, field, direction = 'asc') {
  const sorted = [...entries];

  sorted.sort((a, b) => {
    let valueA = a[field];
    let valueB = b[field];

    if (field === "date") {
      valueA = new Date(valueA);
      valueB = new Date(valueB);
    } else if (field === "minutes") {
      valueA = Number(valueA) || 0;
      valueB = Number(valueB) || 0;
    }

    if (valueA < valueB) return direction === "asc" ? -1 : 1;
    if (valueA > valueB) return direction === "asc" ? 1 : -1;
    return 0;
  });

  return sorted;
}

/* ========================================
   RENDERING - CARDS VIEW
   ======================================== */

/**
 * Render timesheet entries in cards view
 * @param {Array} entries - Timesheet entries to display
 * @param {Object} stats - Statistics object
 * @param {Object} paginationStatus - Pagination status
 * @param {string} currentSort - Current sort selection
 * @returns {string} HTML string for cards view
 */
export function renderTimesheetCards(entries, stats, paginationStatus, currentSort = 'recent') {
  const cardsHtml = entries
    .map((entry) => createTimesheetCard(entry))
    .join("");

  const statsBar = window.StatisticsModule.createTimesheetStatsBar(stats);

  // Generate load more button HTML
  const loadMoreButton = paginationStatus.hasMore ? `
    <div class="pagination-controls">
      <button class="load-more-btn" onclick="window.manager.loadMoreTimesheetEntries()">
        <i class="fas fa-chevron-down"></i>
        טען עוד (${paginationStatus.filteredItems - paginationStatus.displayedItems} רשומות נוספות)
      </button>
      <div class="pagination-info">
        מציג ${paginationStatus.displayedItems} מתוך ${paginationStatus.filteredItems} רשומות
      </div>
    </div>
  ` : '';

  return `
    <div class="modern-cards-container">
      <div class="modern-table-header">
        <h3 class="modern-table-title">
          <i class="fas fa-clock"></i>
          רשומות שעות
        </h3>
        <div class="modern-table-subtitle">
          ${entries.length} רשומות • ${stats.totalMinutes} דקות • ${stats.totalHours} שעות
        </div>
      </div>
      <div class="stats-with-sort-row">
        ${statsBar}
        <div class="sort-dropdown">
          <label class="sort-label">
            <i class="fas fa-sort-amount-down"></i>
            מיין לפי:
          </label>
          <select class="sort-select" id="timesheetSortSelect" onchange="manager.sortTimesheetEntries(event)">
            <option value="recent" ${currentSort === 'recent' ? 'selected' : ''}>תאריך אחרון</option>
            <option value="client" ${currentSort === 'client' ? 'selected' : ''}>שם לקוח (א-ת)</option>
            <option value="hours" ${currentSort === 'hours' ? 'selected' : ''}>שעות (גבוה-נמוך)</option>
          </select>
        </div>
      </div>
      <div class="timesheet-cards-grid">
        ${cardsHtml}
      </div>
      ${loadMoreButton}
    </div>
  `;
}

/**
 * Create a single timesheet card
 * @param {Object} entry - Timesheet entry
 * @param {string} entry.id - Entry ID
 * @param {string} entry.clientName - Client name
 * @param {string} entry.action - Action description
 * @param {number} entry.minutes - Time in minutes
 * @param {string} entry.date - Entry date
 * @param {string} [entry.fileNumber] - File number (optional)
 * @param {string} [entry.caseNumber] - Case number (optional)
 * @param {string} [entry.serviceName] - Service name (optional)
 * @param {string} [entry.notes] - Notes (optional)
 * @param {Date} [entry.createdAt] - Creation timestamp (optional)
 * @returns {string} HTML string for the card
 */
export function createTimesheetCard(entry) {
  // Validate and sanitize entry data
  if (!entry || typeof entry !== 'object') {
    console.error('Invalid entry provided to createTimesheetCard:', entry);
    return '';
  }

  const safeEntry = {
    id: entry.id || entry.entryId || Date.now(),
    clientName: entry.clientName || "",
    action: entry.action || "",
    minutes: Number(entry.minutes) || 0,
    date: entry.date || new Date().toISOString(),
    fileNumber: entry.fileNumber || "",
    caseNumber: entry.caseNumber || "",
    serviceName: entry.serviceName || "",
    notes: entry.notes || "",
    createdAt: entry.createdAt || null
  };

  const hours = Math.round((safeEntry.minutes / 60) * 10) / 10;
  const safeClientName = safeText(safeEntry.clientName);
  const safeAction = safeText(safeEntry.action);
  const safeFileNumber = safeText(safeEntry.fileNumber);
  const safeNotes = safeText(safeEntry.notes);

  // Use helper functions for badges - MUCH cleaner! 🎯
  const caseNumberBadge = createCaseNumberBadge(safeEntry.caseNumber, 'small', {
    marginRight: '6px',
    marginBottom: '8px'
  });

  const serviceBadge = createServiceBadge(safeEntry.serviceName, 'small', {
    marginBottom: '8px'
  });

  // 🎯 שני ה-badges בשורה אחת (inline)
  const badgesRow = (caseNumberBadge || serviceBadge) ? `
    <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
      ${caseNumberBadge}${serviceBadge}
    </div>
  ` : '';

  return `
    <div class="linear-minimal-card timesheet-card" data-entry-id="${safeEntry.id}" onclick="manager.expandTimesheetCard('${safeEntry.id}', event)">
      <div class="linear-card-content">
        ${badgesRow}
        <h3 class="linear-card-title">
          ${safeAction}
        </h3>
        <div class="linear-progress-section">
          <div class="linear-time-info">
            <div class="time-item actual">
              <span class="time-value">${hours}h</span>
              <span class="time-label">${safeEntry.minutes} דק'</span>
            </div>
            <div class="time-item estimated">
              <span class="time-value">${formatShort(safeEntry.date)}</span>
              <span class="time-label">תאריך</span>
            </div>
          </div>
        </div>
        <div class="linear-card-meta">
          <div class="linear-client-row">
            <span class="linear-client-label">לקוח:</span>
            <span class="linear-client-name">
              ${safeClientName}
            </span>
          </div>
          ${safeFileNumber ? `
          <div class="linear-deadline-row">
            <span class="linear-progress-label">תיק:</span>
            <span class="deadline-info">
              ${safeFileNumber}
            </span>
          </div>
          ` : ''}
          ${window.DatesModule.getCreationDateHTML(safeEntry)}
          ${safeNotes ? `
          <div class="linear-deadline-row">
            <span class="linear-progress-label">הערות:</span>
            <span class="deadline-info" style="color: #6b7280; font-size: 12px;">
              ${safeNotes}
            </span>
          </div>
          ` : ''}
        </div>
      </div>
      <button class="linear-expand-btn" onclick="event.stopPropagation(); manager.showEditTimesheetDialog('${safeEntry.id}')" title="ערוך" style="position: absolute; bottom: 15px; left: 15px;">
        <i class="fas fa-edit"></i>
      </button>
    </div>
  `;
}

/**
 * Create expanded timesheet card view
 * @param {Object} entry - Timesheet entry
 * @param {string} [entry.caseNumber] - Case number (optional)
 * @param {string} [entry.serviceName] - Service name (optional)
 * @returns {string} HTML string for expanded card
 */
export function showExpandedTimesheetCard(entry) {
  if (!entry || typeof entry !== 'object') {
    console.error('Invalid entry provided to showExpandedTimesheetCard:', entry);
    return '';
  }

  const safeEntry = {
    id: entry.id || entry.entryId || Date.now(),
    clientName: safeText(entry.clientName || ""),
    action: safeText(entry.action || ""),
    minutes: Number(entry.minutes) || 0,
    date: entry.date || new Date().toISOString(),
    fileNumber: safeText(entry.fileNumber || ""),
    caseNumber: entry.caseNumber || "",
    serviceName: entry.serviceName || "",
    notes: safeText(entry.notes || "")
  };

  const hours = Math.round((safeEntry.minutes / 60) * 10) / 10;

  // Use helper function for header - clean and reusable! 🎯
  const serviceInfoHeader = createServiceInfoHeader(safeEntry.caseNumber, safeEntry.serviceName);

  return `
    <div class="linear-expanded-overlay" onclick="manager.closeExpandedCard(event)">
      <div class="linear-expanded-card" onclick="event.stopPropagation()">
        <div class="linear-expanded-header">
          <h2 class="linear-expanded-title">${safeEntry.action}</h2>
          <button class="linear-close-btn" onclick="manager.closeExpandedCard(event)">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="linear-expanded-body">
          ${serviceInfoHeader}
          <div class="linear-info-grid">
            <div class="linear-info-item">
              <label>לקוח:</label>
              <span>${safeEntry.clientName}</span>
            </div>
            <div class="linear-info-item">
              <label>תאריך:</label>
              <span>${formatDate(safeEntry.date)}</span>
            </div>
            <div class="linear-info-item">
              <label>זמן:</label>
              <span>${hours}h (${safeEntry.minutes} דקות)</span>
            </div>
            ${safeEntry.fileNumber ? `
            <div class="linear-info-item">
              <label>תיק:</label>
              <span>${safeEntry.fileNumber}</span>
            </div>
            ` : ''}
          </div>
          ${safeEntry.notes ? `
          <div class="linear-expanded-section">
            <h3>הערות</h3>
            <p>${safeEntry.notes}</p>
          </div>
          ` : ''}
          <div class="linear-expanded-actions">
            <button class="linear-action-btn primary" onclick="manager.showEditTimesheetDialog('${safeEntry.id}'); manager.closeExpandedCard(event)">
              <i class="fas fa-edit"></i>
              ערוך
            </button>
            <button class="linear-action-btn secondary" onclick="manager.closeExpandedCard(event)">
              סגור
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ========================================
   RENDERING - TABLE VIEW
   ======================================== */

/**
 * Render timesheet entries in table view
 * @param {Array} entries - Timesheet entries to display
 * @param {Object} stats - Statistics object
 * @param {Object} paginationStatus - Pagination status
 * @param {string} currentSort - Current sort selection
 * @returns {string} HTML string for table view
 */
export function renderTimesheetTable(entries, stats, paginationStatus, currentSort = 'recent') {
  if (!entries || entries.length === 0) {
    return createEmptyTimesheetState();
  }

  const rowsHtml = entries
    .map(
      (entry) => {
        if (!entry || typeof entry !== 'object') {
          console.warn('Invalid entry in renderTimesheetTable:', entry);
          return '';
        }

        // Use helper functions for badges - consistent styling! 🎯
        const serviceBadge = createServiceBadge(entry.serviceName, 'small', {
          marginRight: '6px'
        });

        const caseBadge = createCaseNumberBadge(entry.caseNumber, 'small');

        const entryId = entry.id || entry.entryId || Date.now();
        const hasBadges = serviceBadge || caseBadge;

        return `
      <tr data-entry-id="${entryId}">
        <td class="timesheet-cell-date">${formatDate(entry.date)}</td>
        <td class="timesheet-cell-action">
          ${serviceBadge}${caseBadge}
          <div style="margin-top: ${hasBadges ? '4px' : '0'};">
            ${safeText(entry.action || "")}
          </div>
        </td>
        <td class="timesheet-cell-time">
          <span class="time-badge">${Number(entry.minutes) || 0} דק'</span>
        </td>
        <td class="timesheet-cell-client">${safeText(
          entry.clientName || ""
        )}</td>
        <td>${safeText(entry.fileNumber || "")}</td>
        <td style="color: #6b7280; font-size: 13px;">${window.DatesModule.getCreationDateTableCell(entry)}</td>
        <td>${safeText(entry.notes || "—")}</td>
        <td class="actions-column">
          <button class="action-btn edit-btn" onclick="manager.showEditTimesheetDialog('${entryId}')" title="ערוך שעתון">
            <i class="fas fa-edit"></i>
          </button>
        </td>
      </tr>
    `;
      }
    )
    .join("");

  const statsBar = window.StatisticsModule.createTimesheetStatsBar(stats);

  // Generate load more button HTML
  const loadMoreButton = paginationStatus.hasMore ? `
    <div class="pagination-controls">
      <button class="load-more-btn" onclick="window.manager.loadMoreTimesheetEntries()">
        <i class="fas fa-chevron-down"></i>
        טען עוד (${paginationStatus.filteredItems - paginationStatus.displayedItems} רשומות נוספות)
      </button>
      <div class="pagination-info">
        מציג ${paginationStatus.displayedItems} מתוך ${paginationStatus.filteredItems} רשומות
      </div>
    </div>
  ` : '';

  return `
    <div class="modern-table-container">
      <div class="modern-table-header">
        <h3 class="modern-table-title">
          <i class="fas fa-clock"></i>
          רשומות שעות
        </h3>
        <div class="modern-table-subtitle">
          ${entries.length} רשומות • ${stats.totalMinutes} דקות • ${stats.totalHours} שעות
        </div>
      </div>
      <div class="stats-with-sort-row">
        ${statsBar}
        <div class="sort-dropdown">
          <label class="sort-label">
            <i class="fas fa-sort-amount-down"></i>
            מיין לפי:
          </label>
          <select class="sort-select" id="timesheetSortSelect" onchange="manager.sortTimesheetEntries(event)">
            <option value="recent" ${currentSort === 'recent' ? 'selected' : ''}>תאריך אחרון</option>
            <option value="client" ${currentSort === 'client' ? 'selected' : ''}>שם לקוח (א-ת)</option>
            <option value="hours" ${currentSort === 'hours' ? 'selected' : ''}>שעות (גבוה-נמוך)</option>
          </select>
        </div>
      </div>
      <div class="table-wrapper">
        <table class="modern-timesheet-table">
          <thead>
            <tr>
              <th>תאריך</th>
              <th>פעולה</th>
              <th>זמן</th>
              <th>לקוח</th>
              <th>תיק</th>
              <th>נוצר</th>
              <th>הערות</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      ${loadMoreButton}
    </div>
  `;
}

/**
 * Create empty timesheet state message
 * @returns {string} HTML string for empty state
 */
export function createEmptyTimesheetState() {
  return `
    <div class="empty-state">
      <i class="fas fa-clock"></i>
      <h4>אין רשומות שעתון</h4>
      <p>רשום את הפעולה הראשונה שלך</p>
    </div>
  `;
}

/* ========================================
   EDIT DIALOG
   ======================================== */

/**
 * Create edit timesheet dialog HTML
 * @param {Object} entry - Timesheet entry to edit
 * @returns {string} HTML string for edit dialog
 */
export function createEditTimesheetDialog(entry) {
  // Prepare entry date for input field
  let entryDateForInput = "";
  try {
    const dateObj = new Date(entry.date);
    entryDateForInput = dateObj.toISOString().split("T")[0];
  } catch (error) {
    entryDateForInput = new Date().toISOString().split("T")[0];
  }

  return `
  <div class="popup-overlay">
    <div class="popup edit-timesheet-popup" style="max-width: 600px;">
      <div class="popup-header">
        <i class="fas fa-edit"></i>
        ערוך רשומת שעתון
      </div>
      <div class="popup-content">
        <div class="task-overview">
          <h3>
            <i class="fas fa-info-circle"></i>
            רשומה מקורית
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 13px; color: #6b7280; background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
            <p><strong>תאריך מקורי:</strong> ${formatDate(entry.date)}</p>
            <p><strong>לקוח מקורי:</strong> ${safeText(entry.clientName)}</p>
            <p><strong>זמן מקורי:</strong> ${entry.minutes} דקות</p>
            <p><strong>פעולה:</strong> ${safeText(entry.action)}</p>
          </div>
        </div>

        <form id="editTimesheetForm">
          <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div class="form-group">
              <label for="editDate">תאריך <span class="required">*</span></label>
              <input
                type="date"
                id="editDate"
                value="${entryDateForInput}"
                required
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid #e1e5e9;
                  border-radius: 8px;
                  font-size: 14px;
                  transition: all 0.2s ease;
                "
              >
            </div>

            <div class="form-group">
              <label for="editMinutes">זמן (דקות) <span class="required">*</span></label>
              <input
                type="number"
                id="editMinutes"
                min="1"
                max="999"
                value="${entry.minutes}"
                required
                placeholder="60"
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid #e1e5e9;
                  border-radius: 8px;
                  font-size: 16px;
                  font-weight: 600;
                  text-align: center;
                  transition: all 0.2s ease;
                "
              >
            </div>
          </div>

          <div class="form-group">
            <label for="editClientName">שם לקוח <span class="required">*</span></label>
            <div class="modern-client-search">
              <input
                type="text"
                class="search-input"
                id="editClientSearch"
                placeholder="התחל להקליד שם לקוח..."
                value="${safeText(entry.clientName)}"
                autocomplete="off"
                oninput="manager.searchClientsForEdit(this.value)"
                style="
                  width: 100%;
                  padding: 12px 16px;
                  border: 2px solid #e1e5e9;
                  border-radius: 8px;
                  font-size: 14px;
                  font-weight: 500;
                  transition: all 0.2s ease;
                "
              />
              <div
                class="search-results"
                id="editClientSearchResults"
                style="
                  position: absolute;
                  top: 100%;
                  left: 0;
                  right: 0;
                  background: white;
                  border: 1px solid #d1d5db;
                  border-top: none;
                  border-radius: 0 0 8px 8px;
                  max-height: 200px;
                  overflow-y: auto;
                  z-index: 1000;
                  display: none;
                "
              ></div>
              <input
                type="hidden"
                id="editClientSelect"
                value="${safeText(entry.clientName)}"
                required
              />
            </div>
            <small class="form-help">
              <i class="fas fa-search"></i>
              התחל להקליד לחיפוש לקוחות קיימים
            </small>
          </div>

          <div class="form-group">
            <label for="editReason">סיבת העריכה <span class="required">*</span></label>
            <textarea
              id="editReason"
              rows="3"
              placeholder="הסבר מדוע אתה משנה את הפרטים (חובה למעקב)"
              required
              style="
                width: 100%;
                padding: 10px 12px;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                font-size: 14px;
                resize: vertical;
                transition: all 0.2s ease;
              "
            ></textarea>
            <small class="form-help">
              <i class="fas fa-exclamation-circle"></i>
              סיבת העריכה נדרשת למעקב ובקרה
            </small>
          </div>
        </form>
      </div>
      <div class="popup-buttons">
        <button class="popup-btn popup-btn-confirm" onclick="manager.submitAdvancedTimesheetEdit('${entry.id || entry.entryId}')" style="min-width: 140px;">
          <i class="fas fa-save"></i> שמור שינויים
        </button>
        <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
          <i class="fas fa-times"></i> ביטול
        </button>
      </div>
    </div>
  </div>
`;
}

/**
 * Search clients for edit dialog
 * @param {Array} clients - All clients
 * @param {string} searchTerm - Search term
 * @returns {string} HTML string for search results
 */
export function searchClientsForEdit(clients, searchTerm) {
  if (!searchTerm || searchTerm.length < 1) {
    return '';
  }

  // Filter clients
  const filteredClients = clients.filter(
    (client) =>
      client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.fileNumber.includes(searchTerm) ||
      client.clientName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filteredClients.length === 0) {
    return `
      <div style="padding: 12px; color: #6b7280; text-align: center;">
        <i class="fas fa-search"></i> לא נמצאו לקוחות תואמים
      </div>
    `;
  }

  const resultsHtml = filteredClients
    .slice(0, 8)
    .map(
      (client) => `
    <div class="client-result" onclick="manager.selectClientForEdit('${
      client.fullName
    }', '${client.fileNumber}')"
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
        <div style="font-weight: 600; color: #374151;">${safeText(
          client.fullName
        )}</div>
        ${
          client.description
            ? `<div style="font-size: 12px; color: #6b7280;">${safeText(
                client.description
              )}</div>`
            : ""
        }
      </div>
      <div style="font-size: 12px; color: #3b82f6; font-weight: 500;">
        ${client.fileNumber}
      </div>
    </div>
  `
    )
    .join("");

  return resultsHtml;
}

/* ========================================
   UTILITY FUNCTIONS
   ======================================== */

/**
 * Calculate total minutes from entries
 * @param {Array} entries - Timesheet entries
 * @returns {number} Total minutes
 */
export function getTotalMinutes(entries) {
  return entries.reduce((total, entry) => total + (entry.minutes || 0), 0);
}

/**
 * Clear timesheet form
 */
export function clearTimesheetForm() {
  const timesheetForm = document.getElementById("timesheetForm");
  if (timesheetForm) timesheetForm.reset();
  const actionDate = document.getElementById("actionDate");
  if (actionDate) {
    actionDate.value = new Date().toISOString().split("T")[0];
  }
}
