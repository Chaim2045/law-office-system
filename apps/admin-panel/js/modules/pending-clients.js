/**
 * pending-clients.js — H.6 "Pending Clients" admin page module.
 *
 * Lists unlinked tofes-mecher sales records (listUnlinkedSalesRecords). The admin
 * fail-closed gate lives in pending-clients.html.
 *
 * H.6.c-1: the approve+create action is DISABLED. createClientFromSalesRecord now creates
 * a PENDING (pending_signature) client via the two-phase signature-gated flow — not an
 * active client — so the old one-click "approve → active client" UX would misrepresent the
 * result. The action button is rendered disabled and surfaces a Hebrew "under construction"
 * notice (H.6.c); the create+activate flow returns in a later H.6.c increment. Listing/table
 * rendering is intact; only the create action is blocked.
 *
 * Escaping: every tofes-controlled field is passed through window.escapeHtml before
 * it reaches any innerHTML sink (the table cells).
 *
 * Pure display helpers (formatAmount / formatDate) live in
 * js/core/pending-clients-format.js (window.PendingClientsFormat), unit-tested.
 */
(function () {
  'use strict';

  const SECTION_ID = 'pending-clients-section';
  const fmt = window.PendingClientsFormat;

  let listUnlinkedSalesRecords = null;
  // H.6.c-1: createClientFromSalesRecord is intentionally NOT wired here — the create
  // action is disabled while the signature-gated flow (H.6.c) is under construction.
  let currentData = null;
  let handlerAttached = false;
  // salesRecordId -> record (raw tofes snapshot). Avoids round-tripping
  // clientName through a data- attribute (which the DOM decodes back to raw).
  let recordsById = {};

  function getSection() {
    return document.getElementById(SECTION_ID);
  }

  function formatAmount(amount) {
    return fmt.formatAmount(amount);
  }

  function formatDate(isoString) {
    return fmt.formatDate(isoString);
  }

  function init() {
    const functions = firebase.app().functions('us-central1');
    listUnlinkedSalesRecords = functions.httpsCallable('listUnlinkedSalesRecords');

    // Attach the delegated click handler ONCE on the persistent section element.
    const section = getSection();
    if (section && !handlerAttached) {
      section.addEventListener('click', handleApproveClick);
      handlerAttached = true;
    }

    loadData();
  }

  function renderLoading() {
    const section = getSection();
    if (!section) {
      return;
    }
    section.innerHTML = ''
      + '<div class="pc-loading" role="status" aria-live="polite">'
      + '  <div class="pc-loading__spinner" aria-hidden="true"></div>'
      + '  <p>טוען רשומות ממתינות...</p>'
      + '</div>';
  }

  function renderError(message) {
    const section = getSection();
    if (!section) {
      return;
    }
    section.innerHTML = ''
      + '<div class="pc-error-state" role="alert">'
      + '  <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>'
      + '  <h2>שגיאה בטעינת נתונים</h2>'
      + '  <p>' + window.escapeHtml(message) + '</p>'
      + '  <button class="pc-btn-refresh" onclick="window.PendingClients.refresh()" type="button">'
      + '    <i class="fas fa-sync-alt" aria-hidden="true"></i> נסה שוב'
      + '  </button>'
      + '</div>';
  }

  function renderEmpty() {
    const section = getSection();
    if (!section) {
      return;
    }
    section.innerHTML = ''
      + '<div class="pc-header">'
      + '  <h1>לקוחות ממתינים</h1>'
      + '</div>'
      + '<div class="pc-empty-state" role="status">'
      + '  <i class="fas fa-check-circle" aria-hidden="true"></i>'
      + '  <h2>אין רשומות ממתינות</h2>'
      + '  <p>כל רשומות המכר מקושרות ללקוחות במערכת.</p>'
      + '</div>';
  }

  function renderTable(data) {
    const section = getSection();
    if (!section) {
      return;
    }

    recordsById = {};

    const statsHtml = ''
      + '<div class="pc-stats">'
      + '  <div class="pc-stat-badge">'
      + '    <span class="pc-stat-badge__label">סה"כ מכירות</span>'
      + '    <span class="pc-stat-badge__value">' + window.escapeHtml(String(data.totalSales)) + '</span>'
      + '  </div>'
      + '  <div class="pc-stat-badge">'
      + '    <span class="pc-stat-badge__label">מקושרות</span>'
      + '    <span class="pc-stat-badge__value">' + window.escapeHtml(String(data.linkedCount)) + '</span>'
      + '  </div>'
      + '  <div class="pc-stat-badge pc-stat-badge--warning">'
      + '    <span class="pc-stat-badge__label">ממתינות</span>'
      + '    <span class="pc-stat-badge__value">' + window.escapeHtml(String(data.unlinkedCount)) + '</span>'
      + '  </div>'
      + '</div>';

    let cappedHtml = '';
    if (data.capped) {
      cappedHtml = ''
        + '<div class="pc-capped-notice" role="status">'
        + '  <i class="fas fa-info-circle" aria-hidden="true"></i>'
        + '  מוצגות 500 רשומות ראשונות בלבד. ייתכן שישנן רשומות נוספות.'
        + '</div>';
    }

    let rowsHtml = '';
    for (let i = 0; i < data.unlinkedRecords.length; i++) {
      const record = data.unlinkedRecords[i];
      recordsById[record.salesRecordId] = record;

      const escapedName = window.escapeHtml(record.clientName || '—');
      const escapedId = window.escapeHtml(record.idNumber || '—');
      const escapedType = window.escapeHtml(record.transactionType || '—');
      const escapedSalesId = window.escapeHtml(record.salesRecordId);

      rowsHtml += ''
        + '<tr>'
        + '  <td>' + escapedName + '</td>'
        + '  <td>' + escapedId + '</td>'
        + '  <td class="pc-amount">' + window.escapeHtml(formatAmount(record.amountBeforeVat)) + '</td>'
        + '  <td class="pc-amount">' + window.escapeHtml(formatAmount(record.amountWithVat)) + '</td>'
        + '  <td>' + escapedType + '</td>'
        + '  <td class="pc-date">' + window.escapeHtml(formatDate(record.timestampIso)) + '</td>'
        // H.6.c-1: the approve-and-create action is DISABLED while the signature-gated
        // flow is under construction (H.6.c). createClientFromSalesRecord now creates a
        // PENDING (not active) client via the two-phase pending_signature flow, so the old
        // one-click "approve → active client" UX would misrepresent the result. The button
        // is rendered disabled + a click surfaces a Hebrew "under construction" notice.
        // Listing/table rendering is intact; only the create action is blocked.
        + '  <td>'
        + '    <button class="pc-btn-approve" type="button" disabled'
        + '      data-sales-id="' + escapedSalesId + '"'
        + '      aria-label="יצירת לקוח דרך שער החתימה — בבנייה">'
        + '      <i class="fas fa-hard-hat" aria-hidden="true"></i> בבנייה (H.6.c)'
        + '    </button>'
        + '  </td>'
        + '</tr>';
    }

    section.innerHTML = ''
      + '<div class="pc-header">'
      + '  <h1>לקוחות ממתינים</h1>'
      + '  <button class="pc-btn-refresh" onclick="window.PendingClients.refresh()" type="button"'
      + '    aria-label="רענון רשימה">'
      + '    <i class="fas fa-sync-alt" aria-hidden="true"></i> רענן'
      + '  </button>'
      + '</div>'
      + statsHtml
      + cappedHtml
      + '<div class="pc-table-wrapper">'
      + '  <table class="pc-table">'
      + '    <thead>'
      + '      <tr>'
      + '        <th>שם לקוח</th>'
      + '        <th>ת"ז / ח.פ.</th>'
      + '        <th>סכום לפני מע"מ</th>'
      + '        <th>סכום כולל מע"מ</th>'
      + '        <th>סוג עסקה</th>'
      + '        <th>תאריך</th>'
      + '        <th>פעולה</th>'
      + '      </tr>'
      + '    </thead>'
      + '    <tbody>'
      + rowsHtml
      + '    </tbody>'
      + '  </table>'
      + '</div>';
  }

  // H.6.c-1: the create action is DISABLED while the signature-gated cutover flow
  // (H.6.c) is under construction. createClientFromSalesRecord now creates a PENDING
  // (pending_signature) client via the two-phase flow — not an active client — so the
  // old one-click "approve → create active client" path is intentionally blocked to avoid
  // misrepresenting the result. Any click on the (disabled) button surfaces a Hebrew
  // "under construction" notice instead of calling the CF. The confirmAndCreate flow was
  // removed so no create is triggered from this page; it returns in a later H.6.c increment
  // as a signature-gated confirm+activate flow.
  function handleApproveClick(e) {
    const btn = e.target.closest('.pc-btn-approve');
    if (!btn) {
      return;
    }
    if (window.ModalHelpers) {
      window.ModalHelpers.alert({
        title: 'בבנייה',
        message: 'יצירת לקוח דרך שער החתימה — בבנייה (H.6.c). '
          + 'הפעולה תופעל בהמשך לאחר השלמת בדיקת החתימה.',
        icon: 'fa-hard-hat'
      });
    }
  }

  async function loadData() {
    renderLoading();
    try {
      const result = await listUnlinkedSalesRecords();
      currentData = result.data;

      if (!currentData || !currentData.unlinkedRecords || currentData.unlinkedRecords.length === 0) {
        renderEmpty();
      } else {
        renderTable(currentData);
      }
    } catch (err) {
      console.error('[PendingClients] listUnlinkedSalesRecords failed:', err && err.code);
      let errMsg = 'לא ניתן לטעון את רשימת הרשומות הממתינות. נסה שוב.';
      if (err && err.code === 'permission-denied') {
        errMsg = 'אין הרשאה לצפייה ברשומות. פנה למנהל המערכת.';
      } else if (err && err.code === 'unavailable') {
        errMsg = 'השירות אינו זמין כעת. נסה שוב בעוד מספר דקות.';
      }
      renderError(errMsg);
    }
  }

  function refresh() {
    loadData();
  }

  window.PendingClients = {
    init: init,
    refresh: refresh
  };
})();
