/**
 * pending-clients.js — H.6 "Pending Clients" admin page module.
 *
 * Lists unlinked tofes-mecher sales records (listUnlinkedSalesRecords). The admin
 * fail-closed gate lives in pending-clients.html.
 *
 * H.6.c-1: the unlinked-records approve+create action stays DISABLED. createClientFromSalesRecord
 * now creates a PENDING (pending_signature) client via the two-phase signature-gated flow — not
 * an active client — so the old one-click "approve → active client" UX would misrepresent the
 * result on THAT table. The action button there is rendered disabled with a Hebrew "under
 * construction" notice.
 *
 * H.6.c-3: a SECOND section — "לקוחות ממתינים לחתימה" — lists clients already in
 * `status:'pending_signature'` (queried directly from `clients`, since listUnlinkedSalesRecords
 * deliberately EXCLUDES them — c-2). Each row shows whether a signed fee agreement was uploaded
 * and a "בדוק חתימה ואשר" button (enabled only when feeAgreements has ≥1 entry) that calls
 * releaseClientFromPendingSignature({ salesRecordId }). This is the verify+release UI the design
 * doc describes; it is UNRELATED to the (still-disabled) unlinked-records create button above.
 *
 * Escaping: every tofes/client-controlled field is passed through window.escapeHtml before
 * it reaches any innerHTML sink (the table cells). Toast messages are fixed Hebrew strings by
 * error-code (js/core/pending-clients-format.js) — never raw record data.
 *
 * Pure display helpers (formatAmount / formatDate / signatureFailureMessage /
 * releaseErrorMessage) live in js/core/pending-clients-format.js
 * (window.PendingClientsFormat), unit-tested.
 */
(function () {
  'use strict';

  const SECTION_ID = 'pending-clients-section';
  const fmt = window.PendingClientsFormat;

  let listUnlinkedSalesRecords = null;
  let releaseClientFromPendingSignature = null;
  // H.6.c-1: createClientFromSalesRecord is intentionally NOT wired here — the create
  // action is disabled while the signature-gated flow (H.6.c) is under construction.
  let currentData = null;
  let handlerAttached = false;
  // salesRecordId -> record (raw tofes snapshot). Avoids round-tripping
  // clientName through a data- attribute (which the DOM decodes back to raw).
  let recordsById = {};
  // caseNumber -> pending-signature client doc (raw Firestore data). Same
  // avoid-round-tripping-through-a-data-attribute rationale as recordsById.
  let pendingClientsByCase = {};
  // caseNumber -> true while a release call for that case is in flight (loading state).
  const releasingByCase = {};

  function getSection() {
    return document.getElementById(SECTION_ID);
  }

  function toast(type, message) {
    // message is a FIXED Hebrew string by-code (pending-clients-format.js) — NEVER
    // raw tofes/client data.
    if (window.notify && typeof window.notify[type] === 'function') {
      window.notify[type](message);
    }
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
    releaseClientFromPendingSignature = functions.httpsCallable('releaseClientFromPendingSignature');

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

  /**
   * H.6.c-3: builds the "לקוחות ממתינים לחתימה" section — clients already in
   * status:'pending_signature' (queried directly from `clients`, since
   * listUnlinkedSalesRecords deliberately excludes them). Returns an HTML string
   * (never writes to the DOM directly — the caller composes it into the section).
   */
  function renderPendingSignatureSectionHtml(clients) {
    pendingClientsByCase = {};

    if (!clients || clients.length === 0) {
      return ''
        + '<div class="pc-section-title">'
        + '  <h2>לקוחות ממתינים לחתימה</h2>'
        + '</div>'
        + '<div class="pc-empty-state pc-empty-state--inline" role="status">'
        + '  <i class="fas fa-check-circle" aria-hidden="true"></i>'
        + '  <p>אין לקוחות הממתינים לבדיקת חתימה כרגע.</p>'
        + '</div>';
    }

    let rowsHtml = '';
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      pendingClientsByCase[client.caseNumber] = client;

      const escapedName = window.escapeHtml(client.clientName || client.fullName || '—');
      const escapedCase = window.escapeHtml(client.caseNumber || '—');
      const escapedSalesId = window.escapeHtml(client.sourceSalesRecordId || '');
      const agreementsCount = Array.isArray(client.feeAgreements) ? client.feeAgreements.length : 0;
      const hasAgreement = agreementsCount > 0 && !!client.sourceSalesRecordId;
      const isReleasing = !!releasingByCase[client.caseNumber];

      let actionCellHtml;
      if (!hasAgreement) {
        actionCellHtml = ''
          + '<span class="pc-missing-agreement">'
          + '  <i class="fas fa-file-circle-exclamation" aria-hidden="true"></i> '
          + '  טרם הועלה הסכם שכר טרחה חתום'
          + '</span>';
      } else {
        actionCellHtml = ''
          + '<button class="pc-btn-approve pc-btn-verify" type="button"'
          + (isReleasing ? ' disabled' : '')
          + '  data-case-number="' + escapedCase + '"'
          + '  aria-label="בדוק חתימה ואשר עבור ' + escapedName + '">'
          + '  <i class="fas ' + (isReleasing ? 'fa-spinner fa-spin' : 'fa-signature') + '" aria-hidden="true"></i> '
          + (isReleasing ? 'בודק חתימה...' : 'בדוק חתימה ואשר')
          + '</button>';
      }

      rowsHtml += ''
        + '<tr>'
        + '  <td>' + escapedName + '</td>'
        + '  <td>' + escapedCase + '</td>'
        + '  <td>' + window.escapeHtml(agreementsCount ? String(agreementsCount) : '0') + '</td>'
        + '  <td>' + (escapedSalesId || '—') + '</td>'
        + '  <td>' + actionCellHtml + '</td>'
        + '</tr>';
    }

    return ''
      + '<div class="pc-section-title">'
      + '  <h2>לקוחות ממתינים לחתימה</h2>'
      + '</div>'
      + '<div class="pc-table-wrapper">'
      + '  <table class="pc-table">'
      + '    <thead>'
      + '      <tr>'
      + '        <th>שם לקוח</th>'
      + '        <th>מספר תיק</th>'
      + '        <th>הסכמים שהועלו</th>'
      + '        <th>מזהה מכר מקור</th>'
      + '        <th>פעולה</th>'
      + '      </tr>'
      + '    </thead>'
      + '    <tbody>'
      + rowsHtml
      + '    </tbody>'
      + '  </table>'
      + '</div>';
  }

  function renderEmpty(pendingClients) {
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
      + '</div>'
      + renderPendingSignatureSectionHtml(pendingClients);
  }

  function renderTable(data, pendingClients) {
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
      + '</div>'
      + renderPendingSignatureSectionHtml(pendingClients);
  }

  // H.6.c-1: the unlinked-records create action stays DISABLED — createClientFromSalesRecord
  // creates a PENDING (pending_signature) client via the two-phase flow, so a one-click
  // "approve → active client" UX on THAT table would misrepresent the result. A click on the
  // (disabled) button surfaces a Hebrew "under construction" notice.
  //
  // H.6.c-3: the verify+release button ('.pc-btn-verify') in the pending-signature section
  // IS wired — it calls releaseClientFromPendingSignature after a confirm dialog.
  function handleApproveClick(e) {
    const verifyBtn = e.target.closest('.pc-btn-verify');
    if (verifyBtn) {
      handleVerifyClick(verifyBtn);
      return;
    }
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

  /**
   * H.6.c-3: the "בדוק חתימה ואשר" click handler. Confirms with the admin,
   * disables the button (loading state) for the duration of the (long, AI-backed)
   * call, then calls releaseClientFromPendingSignature and shows a toast for
   * every outcome (released / not-released-with-reason / error). Always ends by
   * refreshing the section so the row reflects the current server state.
   */
  async function handleVerifyClick(btn) {
    const caseNumber = btn.getAttribute('data-case-number');
    const client = pendingClientsByCase[caseNumber];
    if (!client || !client.sourceSalesRecordId) {
      return;
    }
    if (releasingByCase[caseNumber]) {
      return; // already in flight — the button is disabled, but guard re-entrancy anyway.
    }

    const displayName = client.clientName || client.fullName || caseNumber;
    let confirmed = true;
    if (window.ModalHelpers) {
      confirmed = await window.ModalHelpers.confirm({
        title: 'בדיקת חתימה ואישור לקוח',
        message: 'האם לבדוק את חתימות הסכם השכר טרחה ולאשר את הלקוח '
          + '<strong>' + window.escapeHtml(displayName) + '</strong>?',
        confirmText: 'בדוק ואשר',
        cancelText: 'ביטול',
        icon: 'signature'
      });
    }
    if (!confirmed) {
      return;
    }

    releasingByCase[caseNumber] = true;
    if (currentData) {
      renderTable(currentData, pendingClientsById());
    } else {
      renderEmpty(pendingClientsById());
    }

    try {
      const result = await releaseClientFromPendingSignature({ salesRecordId: client.sourceSalesRecordId });
      const data = (result && result.data) || {};
      if (data.released === true) {
        toast('success', 'הלקוח אושר ושוחרר בהצלחה');
      } else if (data.reason === 'CLIENT_ALREADY_RELEASED') {
        toast('info', 'הלקוח כבר שוחרר קודם לכן.');
      } else {
        // A failed/borderline signature verdict — booleans only, NEVER reasoning.
        toast('warning', fmt.signatureFailureMessage(data));
      }
    } catch (err) {
      console.error('[PendingClients] releaseClientFromPendingSignature failed:', err && err.code);
      toast('error', fmt.releaseErrorMessage(err));
    } finally {
      delete releasingByCase[caseNumber];
      loadData();
    }
  }

  /** Snapshot of the currently-known pending clients as an array (for re-render). */
  function pendingClientsById() {
    return Object.keys(pendingClientsByCase).map(function (k) {
      return pendingClientsByCase[k];
    });
  }

  /**
   * H.6.c-3: reads clients in status:'pending_signature' directly from Firestore
   * (listUnlinkedSalesRecords deliberately excludes them — c-2). `clients` is
   * readable by any authenticated user per firestore.rules; the page itself is
   * admin-gated (pending-clients.html render-gate).
   */
  async function loadPendingSignatureClients() {
    const snap = await firebase.firestore()
      .collection('clients')
      .where('status', '==', 'pending_signature')
      .get();
    return snap.docs.map(function (doc) {
      const data = doc.data() || {};
      return {
        caseNumber: doc.id,
        clientName: data.clientName,
        fullName: data.fullName,
        sourceSalesRecordId: data.sourceSalesRecordId,
        feeAgreements: data.feeAgreements
      };
    });
  }

  async function loadData() {
    renderLoading();
    try {
      const [unlinkedResult, pendingClients] = await Promise.all([
        listUnlinkedSalesRecords(),
        loadPendingSignatureClients()
      ]);
      currentData = unlinkedResult.data;

      if (!currentData || !currentData.unlinkedRecords || currentData.unlinkedRecords.length === 0) {
        renderEmpty(pendingClients);
      } else {
        renderTable(currentData, pendingClients);
      }
    } catch (err) {
      console.error('[PendingClients] loadData failed:', err && err.code);
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
