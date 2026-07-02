/**
 * pending-clients.js — H.6 PR2 "Pending Clients" admin page module.
 *
 * Lists unlinked tofes-mecher sales records (listUnlinkedSalesRecords) and lets
 * an admin approve+create a law-office client from each (createClientFromSalesRecord).
 * Read-only display + one admin-triggered create via an already-merged, server-gated,
 * audited CF. The admin fail-closed gate lives in pending-clients.html.
 *
 * Escaping: every tofes-controlled field is passed through window.escapeHtml before
 * it reaches any innerHTML sink — both the table cells AND the ModalHelpers
 * confirm/alert messages (which interpolate `message` into innerHTML).
 *
 * Pure display helpers (formatAmount / formatDate) live in
 * js/core/pending-clients-format.js (window.PendingClientsFormat), unit-tested.
 */
(function () {
  'use strict';

  const SECTION_ID = 'pending-clients-section';
  const fmt = window.PendingClientsFormat;

  let listUnlinkedSalesRecords = null;
  let createClientFromSalesRecord = null;
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
    createClientFromSalesRecord = functions.httpsCallable('createClientFromSalesRecord');

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
        + '  <td>'
        + '    <button class="pc-btn-approve" type="button"'
        + '      data-sales-id="' + escapedSalesId + '"'
        + '      aria-label="אישור ויצירת לקוח עבור ' + escapedName + '">'
        + '      <i class="fas fa-user-plus" aria-hidden="true"></i> אשר וצור'
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

  function handleApproveClick(e) {
    const btn = e.target.closest('.pc-btn-approve');
    if (!btn) {
      return;
    }
    const salesId = btn.getAttribute('data-sales-id');
    const record = recordsById[salesId];
    if (!record) {
      return;
    }
    confirmAndCreate(salesId, record.clientName || '', formatAmount(record.amountBeforeVat));
  }

  async function confirmAndCreate(salesRecordId, clientName, amount) {
    if (!window.ModalHelpers) {
      return;
    }

    // clientName is raw tofes data; ModalHelpers interpolates `message` into
    // innerHTML, so escape at the sink (amount is our own numeric formatting).
    const safeName = window.escapeHtml(clientName || '—');

    const confirmed = await window.ModalHelpers.confirm({
      title: 'אישור יצירת לקוח',
      message: 'האם ליצור לקוח חדש עבור "' + safeName + '" בסכום ' + amount + '?',
      icon: 'fa-user-plus',
      confirmText: 'אשר וצור לקוח',
      cancelText: 'ביטול',
      confirmClass: 'btn-primary'
    });

    if (!confirmed) {
      return;
    }

    const loading = window.ModalHelpers.loading({
      title: 'יוצר לקוח...',
      message: 'מעבד את הבקשה, אנא המתן.'
    });

    try {
      const result = await createClientFromSalesRecord({ salesRecordId: salesRecordId });
      loading.close();

      if (result.data && result.data.created === false) {
        await window.ModalHelpers.alert({
          title: 'לקוח כבר קיים',
          message: 'רשומה זו כבר קושרה ללקוח במערכת. הרשימה תתעדכן.',
          icon: 'fa-info-circle'
        });
      } else if (result.data && result.data.created === true) {
        await window.ModalHelpers.alert({
          title: 'הלקוח נוצר בהצלחה',
          message: 'לקוח "' + safeName + '" נוצר במערכת (מספר תיק: '
            + window.escapeHtml(result.data.caseNumber || '') + ').',
          icon: 'fa-check-circle'
        });
      }

      loadData();
    } catch (err) {
      loading.close();
      let errMsg = 'אירעה שגיאה ביצירת הלקוח. נסה שוב מאוחר יותר.';
      if (err && err.code === 'not-found') {
        errMsg = 'רשומת המכר לא נמצאה. ייתכן שנמחקה. הרשימה תתעדכן.';
      } else if (err && err.code === 'permission-denied') {
        errMsg = 'אין הרשאה לביצוע פעולה זו. פנה למנהל המערכת.';
      }
      // Dev-only diagnostic — code only, never PII, never to the DOM.
      console.error('[PendingClients] createClientFromSalesRecord failed:', err && err.code);
      await window.ModalHelpers.alert({
        title: 'שגיאה',
        message: errMsg,
        icon: 'fa-exclamation-triangle'
      });
      loadData();
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
